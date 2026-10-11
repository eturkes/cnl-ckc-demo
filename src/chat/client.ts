// The chat bridge, seen from the browser (`.agent/contracts/chat-c4.md` D8). The page never holds
// a model credential: it posts same-origin forms to the local bridge (`server/chat.mjs`), which
// Vite proxies, and reads the turn back as NDJSON. `ReplayChatClient` answers from recorded
// events so the whole path runs offline.

import { parseEvent, type ChatEvent } from './events.js';

export type TurnEnd = 'done' | 'network' | 'server' | 'protocol';

export interface ChatClient {
  turn(
    message: string,
    conversation: string | undefined,
    onEvent: (event: ChatEvent) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<TurnEnd>;
  result(conversation: string, call: string, text: string, ok: boolean): Promise<boolean>;
}

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

const isAbort = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

export class HttpChatClient implements ChatClient {
  readonly #fetch: typeof fetch;
  readonly #base: string;

  constructor(options: { fetch?: typeof fetch; base?: string } = {}) {
    // Bound late so a test's replaced global and a browser's own `fetch` both resolve at call time.
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#base = options.base ?? '/api/chat';
  }

  async turn(
    message: string,
    conversation: string | undefined,
    onEvent: (event: ChatEvent) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<TurnEnd> {
    const form = new URLSearchParams({ message });
    if (conversation !== undefined) form.set('conversation', conversation);
    let response: Response;
    try {
      response = await this.#fetch(`${this.#base}/turn`, {
        method: 'POST',
        headers: FORM,
        body: form,
        signal,
      });
    } catch (cause) {
      if (isAbort(cause)) throw cause;
      return 'network';
    }
    if (response.status !== 200 || response.body === null) return 'server';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let end = buffer.indexOf('\n');
        while (end >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          end = buffer.indexOf('\n');
          if (line.trim() === '') continue;
          const event = parseEvent(line);
          if (event === undefined) return 'protocol';
          if (signal.aborted) throw new DOMException('The turn was aborted.', 'AbortError');
          // Awaited, so events reach the page one at a time and in order; the bridge itself holds
          // the turn until the page posts a call's result.
          await onEvent(event);
          if (event.type === 'done') return 'done';
        }
        if (done) return 'protocol';
      }
    } catch (cause) {
      if (isAbort(cause) || signal.aborted) {
        throw cause instanceof DOMException ? cause : new DOMException('aborted', 'AbortError');
      }
      return 'network';
    } finally {
      reader.releaseLock();
    }
  }

  async result(conversation: string, call: string, text: string, ok: boolean): Promise<boolean> {
    try {
      const response = await this.#fetch(`${this.#base}/result`, {
        method: 'POST',
        headers: FORM,
        body: new URLSearchParams({ conversation, call, text, ok: ok ? 'true' : 'false' }),
      });
      return response.status === 204;
    } catch {
      return false;
    }
  }
}

/** A recorded turn: its events in order. */
export interface RecordedTurn {
  message: string;
  events: readonly ChatEvent[];
}

export class ReplayChatClient implements ChatClient {
  readonly #turns: readonly RecordedTurn[];
  readonly posted: { conversation: string; call: string; text: string; ok: boolean }[] = [];
  #next = 0;

  constructor(turns: readonly RecordedTurn[]) {
    this.#turns = turns;
  }

  async turn(
    message: string,
    _conversation: string | undefined,
    onEvent: (event: ChatEvent) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<TurnEnd> {
    const turn = this.#turns[this.#next];
    if (turn?.message !== message) throw new Error('no recorded turn for this exact message');
    this.#next += 1;
    for (const event of turn.events) {
      // Keeps the production async boundary, so an abort landing mid-turn is honoured here too.
      await Promise.resolve();
      if (signal.aborted) throw new DOMException('The turn was aborted.', 'AbortError');
      // Awaited: a recording replays the model's wait on each call's result.
      await onEvent(structuredClone(event));
    }
    return turn.events.at(-1)?.type === 'done' ? 'done' : 'protocol';
  }

  result(conversation: string, call: string, text: string, ok: boolean): Promise<boolean> {
    this.posted.push({ conversation, call, text, ok });
    return Promise.resolve(true);
  }
}
