// One chat conversation (`.agent/contracts/chat-c4.md` D5–D7). The model writes goals; every
// goal runs read-only in the demo's own engine, through the same queue as the built-in questions,
// and the model reads the engine's rendering of what it proved. The answer's source labels are
// granted only where this conversation's record backs them (`provenance.ts`).

import type { QueryOutcome } from '../engine/client.js';

import type { ChatClient, TurnEnd } from './client.js';
import type { ChatErrorReason, ChatEvent, SearchResult } from './events.js';
import { ChatRecord, parseAnswer, resolveSegments, type ResolvedSegment } from './provenance.js';
import { toolResult, type ToolResult } from './result.js';

/** The demo's engine queue, seen from the chat: one read-only goal, nothing else. */
export interface ChatHost {
  runGoal(goal: string, signal?: AbortSignal): Promise<QueryOutcome> | undefined;
}

export interface KbCard {
  call: string;
  goal: string;
  /** Absent while the goal runs. */
  outcome?: QueryOutcome;
  result?: ToolResult;
}

export interface WebSource {
  query: string;
  opened: string | undefined;
  results: readonly SearchResult[];
}

export type ChatFailure = ChatErrorReason | Exclude<TurnEnd, 'done'>;

export interface AssistantMessage {
  role: 'assistant';
  status: 'streaming' | 'answered' | 'failed' | 'cancelled';
  commentary: readonly string[];
  cards: readonly KbCard[];
  searches: readonly WebSource[];
  segments: readonly ResolvedSegment[];
  failure?: { reason: ChatFailure; message: string };
}

export type ChatMessage = { role: 'user'; text: string } | AssistantMessage;

/** Diagnostic text per transport end; the panel words each reason through the catalog. */
const TURN_END: Readonly<Record<Exclude<TurnEnd, 'done'>, string>> = {
  network: 'the chat bridge could not be reached',
  server: 'the chat bridge answered with an error status',
  protocol: 'the chat bridge sent a stream that is not the chat wire',
};

const NOT_READY: QueryOutcome = {
  kind: 'error',
  error: { code: 'worker', message: 'the engine is not ready' },
};

const isAbort = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

export class ChatController {
  messages = $state.raw<readonly ChatMessage[]>([]);

  readonly #client: ChatClient;
  readonly #host: ChatHost;
  #conversation: string | undefined;
  /** This conversation's record: calls whose goals ran, URLs its searches returned. */
  #record = new ChatRecord();
  /**
   * The run token: only the holder may write, and `cancel()` or `dispose()` retires it. State, so
   * `busy` — read by the view — follows it.
   */
  #run = $state.raw<AbortController | undefined>(undefined);
  #disposed = false;

  constructor(options: { client: ChatClient; host: ChatHost }) {
    this.#client = options.client;
    this.#host = options.host;
  }

  get busy(): boolean {
    return this.#run !== undefined;
  }

  async submit(input: string): Promise<void> {
    const text = input.trim();
    if (text === '' || this.busy || this.#disposed) return;
    const run = new AbortController();
    this.#run = run;
    this.#record.startTurn();
    const owns = (): boolean => this.#run === run && !run.signal.aborted;
    let message: AssistantMessage = {
      role: 'assistant',
      status: 'streaming',
      commentary: [],
      cards: [],
      searches: [],
      segments: [],
    };
    this.messages = [...this.messages, { role: 'user', text }, message];
    const update = (next: Partial<AssistantMessage>): void => {
      if (this.#run !== run) return;
      const replaced = { ...message, ...next };
      this.messages = this.messages.map((entry) => (entry === message ? replaced : entry));
      message = replaced;
    };
    const card = (call: string, next: KbCard): void => {
      update({ cards: message.cards.map((entry) => (entry.call === call ? next : entry)) });
    };

    let answer: string | undefined;
    let failure: AssistantMessage['failure'];
    const running: Promise<void>[] = [];
    const runCall = async (call: string, goal: string): Promise<void> => {
      update({ cards: [...message.cards, { call, goal }] });
      let outcome: QueryOutcome;
      try {
        outcome = (await this.#host.runGoal(goal, run.signal)) ?? NOT_READY;
      } catch (cause) {
        outcome = {
          kind: 'error',
          error: {
            code: 'worker',
            message: cause instanceof Error ? cause.message : String(cause),
          },
        };
      }
      if (!owns()) return;
      const result = toolResult(outcome);
      if (result.ok) this.#record.ran.add(call);
      card(call, { call, goal, outcome, result });
      const conversation = this.#conversation;
      if (conversation !== undefined) {
        await this.#client.result(conversation, call, result.text, result.ok);
      }
    };

    const onEvent = (event: ChatEvent): Promise<void> | undefined => {
      if (!owns()) return undefined;
      switch (event.type) {
        case 'conversation':
          // Call ids and URLs belong to one conversation: a new one starts an empty record.
          if (event.id !== this.#conversation) {
            this.#conversation = event.id;
            this.#record = new ChatRecord();
          }
          return undefined;
        case 'commentary':
          update({ commentary: [...message.commentary, event.text] });
          return undefined;
        case 'query': {
          const pending = runCall(event.call, event.goal);
          running.push(pending);
          return pending;
        }
        case 'search':
          for (const { url } of event.results) this.#record.urls.add(url);
          if (event.opened !== undefined) this.#record.urls.add(event.opened);
          update({
            searches: [
              ...message.searches,
              { query: event.query, opened: event.opened, results: event.results },
            ],
          });
          return undefined;
        case 'answer':
          answer = event.text;
          return undefined;
        case 'error':
          failure ??= { reason: event.reason, message: event.message };
          return undefined;
        case 'done':
          return undefined;
        default: {
          const exhaustive: never = event;
          return exhaustive;
        }
      }
    };

    let end: TurnEnd;
    try {
      end = await this.#client.turn(text, this.#conversation, onEvent, run.signal);
      await Promise.all(running);
    } catch (cause) {
      if (!isAbort(cause)) throw cause;
      return;
    } finally {
      if (this.#run === run && run.signal.aborted) this.#run = undefined;
    }
    if (!owns()) return;
    if (end !== 'done') failure ??= { reason: end, message: TURN_END[end] };
    if (failure === undefined && answer === undefined) {
      failure = { reason: 'protocol', message: 'the turn ended without an answer' };
    }
    if (failure !== undefined) {
      update({ status: 'failed', failure });
    } else if (answer !== undefined) {
      const segments = parseAnswer(answer);
      // Text that is not the segment shape is shown whole, as one segment no record backs.
      const resolved: ResolvedSegment[] =
        segments === undefined
          ? [{ text: answer, source: 'model', queries: [], urls: [], label: 'unverified' }]
          : resolveSegments(segments, this.#record);
      update({ status: 'answered', segments: resolved });
    }
    this.#run = undefined;
  }

  /** Stop the live turn: its fetch and its running goal are aborted, and it lands cancelled. */
  cancel(): void {
    const run = this.#run;
    if (run === undefined) return;
    const last = this.messages.at(-1);
    if (last?.role === 'assistant' && last.status === 'streaming') {
      this.messages = [...this.messages.slice(0, -1), { ...last, status: 'cancelled' }];
    }
    this.#run = undefined;
    run.abort();
  }

  /** Forget the conversation: the next message starts a new one with an empty record. */
  reset(): void {
    this.cancel();
    this.messages = [];
    this.#conversation = undefined;
    this.#record = new ChatRecord();
  }

  dispose(): void {
    this.#disposed = true;
    this.cancel();
  }
}
