import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ChatController,
  type AssistantMessage,
  type ChatHost,
} from '../src/chat/ChatController.svelte.js';
import { ReplayChatClient, type ChatClient, type TurnEnd } from '../src/chat/client.js';
import type { ChatEvent } from '../src/chat/events.js';
import { toolResult } from '../src/chat/result.js';
import type { QueryOutcome } from '../src/engine/client.js';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const solution = (text: string): QueryOutcome => ({
  kind: 'solutions',
  solutions: [
    { bindings: { X: { kind: 'atom', value: 'not-the-display' } }, display: { X: text } },
  ],
});
const first = solution("'engine answer 日本語'");
const second: QueryOutcome = { kind: 'failure' };
const goal1 = 'guideline_schema_version(V).';
const goal2 = 'guideline_document(no_such_document,_,_,_).';
const answerText = (source = 'kb', queries = ['q1'], urls: string[] = []): string =>
  JSON.stringify({ segments: [{ text: 'Model wording.', source, queries, urls }] });
const assistant = (controller: ChatController): AssistantMessage => {
  const message = controller.messages.at(-1);
  if (message?.role !== 'assistant') throw new Error('missing assistant message');
  return message;
};
const controllers: ChatController[] = [];
const create = (client: ChatClient, host: ChatHost): ChatController => {
  const controller = new ChatController({ client, host });
  controllers.push(controller);
  return controller;
};
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

class DrivenClient implements ChatClient {
  readonly posted: { conversation: string; call: string; text: string; ok: boolean }[] = [];
  readonly turns: {
    message: string;
    conversation: string | undefined;
    onEvent: (event: ChatEvent) => void | Promise<void>;
    signal: AbortSignal;
    end: ReturnType<typeof deferred<TurnEnd>>;
  }[] = [];
  turn(
    message: string,
    conversation: string | undefined,
    onEvent: (event: ChatEvent) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<TurnEnd> {
    const end = deferred<TurnEnd>();
    this.turns.push({ message, conversation, onEvent, signal, end });
    return end.promise;
  }
  result(conversation: string, call: string, text: string, ok: boolean): Promise<boolean> {
    this.posted.push({ conversation, call, text, ok });
    return Promise.resolve(true);
  }
  async send(event: ChatEvent): Promise<void> {
    const turn = this.turns.at(-1);
    if (!turn) throw new Error('turn not started');
    await turn.onEvent(event);
  }
  async finish(end: TurnEnd = 'done'): Promise<void> {
    if (end === 'done') await this.send({ type: 'done' });
    this.turns.at(-1)!.end.resolve(end);
  }
}
const pendingGoal = () => {
  const outcome = deferred<QueryOutcome>();
  const entered = deferred<void>();
  const runGoal = vi.fn<ChatHost['runGoal']>().mockImplementation(() => {
    entered.resolve();
    return outcome.promise;
  });
  return { outcome, entered, runGoal };
};

describe('recorded chat executes goals rather than reading answer fixtures', () => {
  it('D5 replay serializes two goals, stores ordered cards and posts engine displays before advancing', async () => {
    const segments = [
      { text: 'First claim.', source: 'kb', queries: ['q1'], urls: [] },
      { text: 'No solutions is still a query.', source: 'kb', queries: ['q2'], urls: [] },
      {
        text: 'From this search.',
        source: 'web',
        queries: [],
        urls: ['https://example.org/result'],
      },
      {
        text: 'From this opened page.',
        source: 'web',
        queries: [],
        urls: ['https://example.org/opened'],
      },
      { text: 'Model interpretation.', source: 'model', queries: [], urls: [] },
      { text: 'Unreturned citation.', source: 'kb', queries: ['q999'], urls: [] },
    ];
    const search = {
      type: 'search' as const,
      query: 'pain',
      opened: 'https://example.org/opened',
      results: [
        {
          url: 'https://example.org/result',
          title: 'Source',
          domain: 'example.org',
          snippet: 'Verbatim snippet.',
        },
      ],
    };
    const client = new ReplayChatClient([
      {
        message: 'two questions',
        events: [
          { type: 'conversation', id: 'c1' },
          { type: 'commentary', text: 'Checking both.' },
          { type: 'query', call: 'q1', goal: goal1 },
          { type: 'query', call: 'q2', goal: goal2 },
          search,
          { type: 'answer', text: JSON.stringify({ segments }) },
          { type: 'done' },
        ],
      },
    ]);
    const pending = [deferred<QueryOutcome>(), deferred<QueryOutcome>()];
    let active = 0;
    let peak = 0;
    const runGoal = vi.fn<ChatHost['runGoal']>().mockImplementation((_goal, signal) => {
      expect(signal?.aborted).toBe(false);
      const index = runGoal.mock.calls.length - 1;
      expect(client.posted).toHaveLength(index);
      active += 1;
      peak = Math.max(peak, active);
      return pending[index]!.promise.finally(() => {
        active -= 1;
      });
    });
    const controller = create(client, { runGoal });
    const submitted = controller.submit('two questions');
    await tick();
    expect(controller.busy).toBe(true);
    expect(runGoal).toHaveBeenCalledTimes(1);
    expect(assistant(controller).cards).toEqual([{ call: 'q1', goal: goal1 }]);
    expect(client.posted).toHaveLength(0);
    pending[0]!.resolve(first);
    await tick();
    expect(runGoal).toHaveBeenCalledTimes(2);
    expect(client.posted).toEqual([
      { conversation: 'c1', call: 'q1', text: toolResult(first).text, ok: true },
    ]);
    pending[1]!.resolve(second);
    await submitted;
    expect(controller.busy).toBe(false);
    expect(peak).toBe(1);
    expect(runGoal.mock.calls.map(([goal]) => goal)).toEqual([goal1, goal2]);
    expect(runGoal.mock.calls[0]?.[1]).toBe(runGoal.mock.calls[1]?.[1]);
    expect(client.posted).toEqual([
      { conversation: 'c1', call: 'q1', text: toolResult(first).text, ok: toolResult(first).ok },
      { conversation: 'c1', call: 'q2', text: toolResult(second).text, ok: toolResult(second).ok },
    ]);
    const message = assistant(controller);
    expect(message.status).toBe('answered');
    expect(message.commentary).toEqual(['Checking both.']);
    expect(message.cards).toEqual([
      { call: 'q1', goal: goal1, outcome: first, result: toolResult(first) },
      { call: 'q2', goal: goal2, outcome: second, result: toolResult(second) },
    ]);
    expect(message.searches).toEqual([
      { query: search.query, opened: search.opened, results: search.results },
    ]);
    expect(message.segments).toEqual(
      segments.map((value, index) => ({
        ...value,
        label: ['kb', 'kb', 'web', 'web', 'model', 'unverified'][index],
      })),
    );
  });

  it('D5 KB calls persist in one conversation while web URLs expire at the next turn', async () => {
    const url = 'https://example.org/first-turn';
    const segments = [
      { text: 'Old query.', source: 'kb', queries: ['q1'], urls: [] },
      { text: 'Old search.', source: 'web', queries: [], urls: [url] },
    ];
    const client = new ReplayChatClient([
      {
        message: 'first',
        events: [
          { type: 'conversation', id: 'c1' },
          { type: 'query', call: 'q1', goal: goal1 },
          {
            type: 'search',
            query: 'first',
            opened: undefined,
            results: [{ url, title: 'Title', domain: 'example.org', snippet: 'Snippet' }],
          },
          { type: 'answer', text: answerText() },
          { type: 'done' },
        ],
      },
      {
        message: 'second',
        events: [
          { type: 'conversation', id: 'c1' },
          { type: 'answer', text: JSON.stringify({ segments }) },
          { type: 'done' },
        ],
      },
      {
        message: 'new conversation',
        events: [
          { type: 'conversation', id: 'c2' },
          { type: 'answer', text: answerText() },
          { type: 'done' },
        ],
      },
    ]);
    const controller = create(client, { runGoal: () => Promise.resolve(first) });
    await controller.submit('first');
    await controller.submit('second');
    expect(assistant(controller).segments.map((value) => value.label)).toEqual([
      'kb',
      'unverified',
    ]);
    await controller.submit('new conversation');
    expect(assistant(controller).segments[0]?.label).toBe('unverified');
  });

  it('D5 malformed final answer is exactly one raw unverified segment', async () => {
    const raw = 'not JSON\nVerbatim model output 日本語.';
    const client = new ReplayChatClient([
      {
        message: 'bad answer',
        events: [
          { type: 'conversation', id: 'c1' },
          { type: 'answer', text: raw },
          { type: 'done' },
        ],
      },
    ]);
    const controller = create(client, { runGoal: () => undefined });
    await controller.submit('bad answer');
    expect(assistant(controller).segments).toHaveLength(1);
    expect(assistant(controller).segments[0]).toMatchObject({ text: raw, label: 'unverified' });
  });

  it('D5 a goal that has no ready engine cannot earn a KB label', async () => {
    const client = new ReplayChatClient([
      {
        message: 'not booted',
        events: [
          { type: 'conversation', id: 'c1' },
          { type: 'query', call: 'q1', goal: goal1 },
          { type: 'answer', text: answerText() },
          { type: 'done' },
        ],
      },
    ]);
    const controller = create(client, { runGoal: () => undefined });
    await controller.submit('not booted');
    expect(client.posted).toHaveLength(1);
    expect(client.posted[0]?.ok).toBe(false);
    expect(assistant(controller).segments[0]?.label).toBe('unverified');
  });
});

describe('chat lifecycle retires every late callback', () => {
  it.each(['before-settlement', 'after-settlement-before-post'] as const)(
    'D6 cancellation %s aborts fetch and goal, posts nothing and lands no segments',
    async (when) => {
      const client = new DrivenClient();
      const goal = pendingGoal();
      const controller = create(client, { runGoal: goal.runGoal });
      const submitted = controller.submit('cancel');
      await client.send({ type: 'conversation', id: 'c1' });
      const handling = client.send({ type: 'query', call: 'q1', goal: goal1 });
      await goal.entered.promise;
      if (when === 'after-settlement-before-post') goal.outcome.resolve(first);
      controller.cancel();
      expect(client.turns[0]?.signal.aborted).toBe(true);
      expect(goal.runGoal.mock.calls[0]?.[1]?.aborted).toBe(true);
      if (when === 'before-settlement') goal.outcome.resolve(first);
      await handling;
      await client.send({ type: 'answer', text: answerText() });
      await client.finish();
      await submitted;
      expect(client.posted).toHaveLength(0);
      expect(assistant(controller)).toMatchObject({ status: 'cancelled', segments: [] });
      expect(controller.busy).toBe(false);
    },
  );

  it('D6 cancellation after answer before done never lands provisional labels or later results', async () => {
    const client = new DrivenClient();
    const controller = create(client, { runGoal: () => Promise.resolve(first) });
    const submitted = controller.submit('cancel answer');
    await client.send({ type: 'conversation', id: 'c1' });
    await client.send({ type: 'query', call: 'q1', goal: goal1 });
    expect(client.posted).toHaveLength(1);
    await client.send({ type: 'answer', text: answerText() });
    expect(assistant(controller).segments).toEqual([]);
    expect(assistant(controller).status).toBe('streaming');
    controller.cancel();
    await client.send({ type: 'query', call: 'q2', goal: goal2 });
    await client.finish();
    await submitted;
    expect(client.posted).toHaveLength(1);
    expect(assistant(controller)).toMatchObject({ status: 'cancelled', segments: [] });
  });

  it.each(['auth', 'busy', 'expired', 'codex', 'timeout', 'interrupted'] as const)(
    'D6 error reason %s survives a subsequent answer and prevents labels',
    async (reason) => {
      const client = new ReplayChatClient([
        {
          message: 'error',
          events: [
            { type: 'conversation', id: 'c1' },
            { type: 'error', reason, message: `upstream-${reason}` },
            { type: 'answer', text: answerText('model', []) },
            { type: 'done' },
          ],
        },
      ]);
      const controller = create(client, { runGoal: () => Promise.resolve(first) });
      await controller.submit('error');
      expect(assistant(controller)).toMatchObject({
        status: 'failed',
        segments: [],
        failure: { reason, message: `upstream-${reason}` },
      });
      expect(controller.busy).toBe(false);
    },
  );

  it.each(['network', 'server', 'protocol'] as const)(
    'D6 transport end %s names its failure and discards even a parsed answer',
    async (reason) => {
      const client = new DrivenClient();
      const controller = create(client, { runGoal: () => Promise.resolve(first) });
      const submitted = controller.submit('transport failure');
      await client.send({ type: 'conversation', id: 'c1' });
      await client.send({ type: 'answer', text: answerText('model', []) });
      await client.finish(reason);
      await submitted;
      expect(assistant(controller)).toMatchObject({
        status: 'failed',
        segments: [],
        failure: { reason },
      });
      expect(assistant(controller).failure?.message.length).toBeGreaterThan(0);
      expect(controller.busy).toBe(false);
    },
  );

  it('D6 a second submit while live neither starts a turn nor appends another message', async () => {
    const client = new DrivenClient();
    const controller = create(client, { runGoal: () => Promise.resolve(first) });
    const submitted = controller.submit('first');
    const before = [...controller.messages];
    await controller.submit('second');
    expect(client.turns).toHaveLength(1);
    expect(controller.messages).toEqual(before);
    controller.cancel();
    await client.finish();
    await submitted;
  });

  it('D6 dispose mid-goal aborts the turn and drops its late result and answer', async () => {
    const client = new DrivenClient();
    const goal = pendingGoal();
    const controller = create(client, { runGoal: goal.runGoal });
    const submitted = controller.submit('dispose');
    await client.send({ type: 'conversation', id: 'c1' });
    const handling = client.send({ type: 'query', call: 'q1', goal: goal1 });
    await goal.entered.promise;
    controller.dispose();
    expect(client.turns[0]?.signal.aborted).toBe(true);
    expect(goal.runGoal.mock.calls[0]?.[1]?.aborted).toBe(true);
    goal.outcome.resolve(first);
    await handling;
    await client.send({ type: 'answer', text: answerText() });
    await client.finish();
    await submitted;
    expect(client.posted).toHaveLength(0);
    expect(assistant(controller).segments).toEqual([]);
    expect(controller.busy).toBe(false);
  });

  it('D6 reset empties the conversation and refuses a late result from its retired turn', async () => {
    const client = new DrivenClient();
    const goal = pendingGoal();
    const controller = create(client, { runGoal: goal.runGoal });
    const submitted = controller.submit('old');
    await client.send({ type: 'conversation', id: 'c1' });
    const handling = client.send({ type: 'query', call: 'q1', goal: goal1 });
    await goal.entered.promise;
    controller.reset();
    expect(controller.messages).toEqual([]);
    expect(client.turns[0]?.signal.aborted).toBe(true);
    goal.outcome.resolve(first);
    await handling;
    await client.finish();
    await submitted;
    expect(client.posted).toEqual([]);
    expect(controller.messages).toEqual([]);
    const next = controller.submit('new');
    expect(client.turns[1]?.conversation).toBeUndefined();
    await client.send({ type: 'conversation', id: 'c2' });
    await client.send({ type: 'answer', text: answerText() });
    await client.finish();
    await next;
    expect(assistant(controller).segments[0]?.label).toBe('unverified');
  });
});
