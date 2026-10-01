// Uncovered cases from wt/test-m1u3; predicates derive from contract m1u3.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({});
};

class ScriptWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(structuredClone(request));
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(response: EngineResponse): void {
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }

  get last(): EngineRequest {
    const request = this.seen.at(-1);
    if (request === undefined) throw new Error('worker received nothing');
    return request;
  }
}

const clients: EngineClient[] = [];
const scriptedClient = (): {
  client: EngineClient;
  workers: ScriptWorker[];
  armed: Map<number, () => void>;
} => {
  const workers: ScriptWorker[] = [];
  const armed = new Map<number, () => void>();
  let next = 0;
  const client = new EngineClient({
    spawn: () => {
      const worker = new ScriptWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    schedule: (fn) => {
      const handle = ++next;
      armed.set(handle, fn);
      return handle;
    },
    cancelSchedule: (handle) => armed.delete(handle as number),
  });
  clients.push(client);
  return { client, workers, armed };
};
const turn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
});

afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
  vi.restoreAllMocks();
});

const stackFlag = async (): Promise<unknown> => {
  const outcome = await session.solve('current_prolog_flag(stack_limit,V).', budget());
  expect(outcome.kind).toBe('solutions');
  if (outcome.kind !== 'solutions') throw new Error('stack flag could not be read');
  const value = outcome.solutions[0]?.bindings.V;
  expect(value?.kind).toBe('integer');
  return value?.kind === 'integer' ? value.value : undefined;
};

describe('M1.u3 uncovered contract predicates', () => {
  it('P1.1 — query without a budget spec is unreachable from the public API', async () => {
    const { client, workers, armed } = scriptedClient();
    // Cross the type boundary deliberately: JS callers still receive a typed refusal.
    const query = client.query.bind(client) as (
      goal: string,
      budget?: BudgetSpec,
    ) => ReturnType<EngineClient['query']>;
    expect(await query('true.')).toMatchObject({ kind: 'error', error: { code: 'budget' } });
    expect(workers).toHaveLength(0);
    expect(armed.size).toBe(0);
  });

  it('P1.2 — zero, negative, fractional, NaN, Infinity, missing and over-max budgets each fail typed', async () => {
    const { client, workers, armed } = scriptedClient();
    for (const field of Object.keys(BUDGET_MAX) as (keyof BudgetSpec)[]) {
      for (const value of [
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        BUDGET_MAX[field] + 1,
        2 ** 53,
      ]) {
        expect(
          await client.query('true.', budget({ [field]: value })),
          `${field}=${value}`,
        ).toMatchObject({
          kind: 'error',
          error: { code: 'budget' },
        });
      }
      const missing: Partial<BudgetSpec> = budget();
      delete missing[field];
      expect(await client.query('true.', missing as BudgetSpec), `missing ${field}`).toMatchObject({
        kind: 'error',
        error: { code: 'budget' },
      });
    }
    expect(workers).toHaveLength(0);
    expect(armed.size).toBe(0);
    for (const field of Object.keys(BUDGET_MAX) as (keyof BudgetSpec)[]) {
      for (const value of [1, BUDGET_MAX[field]]) {
        const valid = budget({ [field]: value });
        const pending = client.query('true.', valid);
        const worker = workers[0];
        if (worker === undefined) throw new Error(`valid ${field}=${value} was refused`);
        expect(worker.last).toMatchObject({ kind: 'query', budget: valid });
        worker.reply({ id: worker.last.id, kind: 'failure' });
        expect(await pending).toEqual({ kind: 'failure' });
        expect(armed.size).toBe(0);
      }
    }
  });

  it('P3.1 — the stack flag is restored on success, failure, limit, exception and cancel', async () => {
    const before = await stackFlag();
    const bounded = budget({ stackBytes: 8_388_608 });
    expect((await session.solve('true.', bounded)).kind).toBe('solutions');
    expect(await stackFlag()).toBe(before);
    expect((await session.solve('fail.', bounded)).kind).toBe('failure');
    expect(await stackFlag()).toBe(before);
    const limited = await session.solve('length(L,20000000).', bounded);
    expect(limited).toMatchObject({ kind: 'limit', limit: 'stack' });
    expect(await stackFlag()).toBe(before);
    const thrown = await session.handle(
      { id: 'u3-exception', kind: 'query', goal: 'throw(u3_test_exception).', budget: bounded },
      image,
    );
    // P3.1 owns cleanup, not the native runtime's generic exception classification.
    expect(thrown.kind).not.toBe('solutions');
    expect(await stackFlag()).toBe(before);
    const running = session.solve('repeat,X=1.', bounded, 'u3-stack-cancel');
    const accepted = await new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(session.requestCancel('u3-stack-cancel')), 0),
    );
    expect(accepted).toBe(true);
    expect((await running).kind).toBe('cancelled');
    expect(await stackFlag()).toBe(before);
  });

  it('P3.3 — the budget bounds display rendering as well as solving', async () => {
    let virtualNow = 0;
    let displayAdvance = 0;
    let displayCalls = 0;
    const timed = new EngineSession({
      expected: manifest.contract,
      loadImage: async (bytes) => {
        const engine = await loadImage(bytes);
        const query = engine.prolog.query.bind(engine.prolog);
        const prolog = new Proxy(engine.prolog, {
          get(target, property, receiver) {
            if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
            return (goal: string, bindings?: Record<string, unknown>) => {
              const result = query(goal, bindings);
              if (!goal.includes('term_string') || !goal.includes('quoted(true)')) return result;
              return new Proxy(result, {
                get(target, property, receiver) {
                  if (property !== 'once')
                    return Reflect.get(target, property, receiver) as unknown;
                  return () => {
                    const value = result.once();
                    displayCalls += 1;
                    virtualNow += displayAdvance;
                    return value;
                  };
                },
              });
            };
          },
        });
        return new Proxy(engine, {
          get(target, property, receiver) {
            return property === 'prolog'
              ? prolog
              : (Reflect.get(target, property, receiver) as unknown);
          },
        });
      },
    });
    await timed.boot(image);
    const epoch = Date.now();
    vi.spyOn(performance, 'now').mockImplementation(() => virtualNow);
    vi.spyOn(Date, 'now').mockImplementation(() => epoch + virtualNow);
    displayAdvance = 5;
    expect((await timed.solve('X=shown.', budget({ wallClockMs: 10 }))).kind).toBe('solutions');
    virtualNow = 0;
    displayCalls = 0;
    displayAdvance = 20;
    const outcome = await timed.solve('X=shown.', budget({ wallClockMs: 10 }));
    expect(
      displayCalls,
      'the real renderer must execute before the clock advances',
    ).toBeGreaterThan(0);
    expect(
      outcome,
      `display elapsed=${virtualNow}ms, budget=10ms, render calls=${displayCalls}, result=${outcome.kind}`,
    ).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
  });

  it('P4.2 — cooperative cancel settles only its target id', async () => {
    const { client, workers } = scriptedClient();
    const signal = new AbortController();
    let otherSettled = false;
    const first = client.query('repeat.', budget(), signal.signal);
    const second = client.query('true.', budget()).then((outcome) => {
      otherSettled = true;
      return outcome;
    });
    const worker = workers[0];
    if (worker === undefined) throw new Error('worker was not spawned');
    const [a, b] = worker.seen.filter((request) => request.kind === 'query');
    if (a === undefined || b === undefined) throw new Error('both queries must be in flight');
    signal.abort();
    const cancel = worker.seen.find((request) => request.kind === 'cancel');
    expect(cancel).toMatchObject({ target: a.id });
    if (cancel === undefined) throw new Error('cancel was not posted');
    worker.reply({ id: cancel.id, kind: 'ack', accepted: true });
    worker.reply({ id: a.id, kind: 'cancelled', solutions: [] });
    expect(await first).toEqual({ kind: 'cancelled', solutions: [] });
    await turn();
    expect(otherSettled).toBe(false);
    worker.reply({ id: b.id, kind: 'failure' });
    expect(await second).toEqual({ kind: 'failure' });
  });

  it('P4.6 — every in-flight request settles once, with no unhandled rejection', async () => {
    const { client, workers, armed } = scriptedClient();
    const unhandled: unknown[] = [];
    const record = (reason: unknown): void => void unhandled.push(reason);
    process.on('unhandledRejection', record);
    try {
      const settlements = [0, 0];
      const pending = settlements.map((_, index) =>
        client.query('repeat.', budget()).then((outcome) => {
          settlements[index] = (settlements[index] ?? 0) + 1;
          return outcome;
        }),
      );
      const retired = workers[0];
      if (retired === undefined) throw new Error('worker was not spawned');
      const reset = client.reset('P4.6 all callers');
      for (const outcome of await Promise.all(pending)) {
        expect(outcome).toMatchObject({ kind: 'error', error: { code: 'worker' } });
      }
      const replacement = workers[1];
      if (replacement === undefined) throw new Error('replacement was not spawned');
      replacement.reply({ id: replacement.last.id, kind: 'booted', contract: manifest.contract });
      expect(await reset).toMatchObject({ kind: 'booted' });
      for (const request of retired.seen) retired.reply({ id: request.id, kind: 'failure' });
      await turn();
      expect(settlements).toEqual([1, 1]);
      expect(unhandled).toEqual([]);
      expect(armed.size).toBe(0);
    } finally {
      process.off('unhandledRejection', record);
    }
  });

  it('P4.10 — a settled request leaves no armed timer', async () => {
    const outcomes: Awaited<ReturnType<EngineClient['query']>>[] = [
      { kind: 'solutions', solutions: [] },
      { kind: 'failure' },
      { kind: 'cancelled', solutions: [] },
      { kind: 'error', error: { code: 'prolog', message: 'probe' } },
      ...(['stack', 'depth', 'inference', 'wall-clock', 'answer-cap', 'heap'] as const).map(
        (limit) => ({
          kind: 'limit' as const,
          limit,
          solutions: [],
        }),
      ),
    ];
    for (const outcome of outcomes) {
      const { client, workers, armed } = scriptedClient();
      const pending = client.query('true.', budget());
      const worker = workers[0];
      if (worker === undefined) throw new Error('worker was not spawned');
      expect(armed.size).toBe(1);
      worker.reply({ id: worker.last.id, ...outcome });
      if (outcome.kind === 'limit' && 'limit' in outcome && outcome.limit === 'heap') {
        await turn();
        const replacement = workers[1];
        if (replacement === undefined) throw new Error('heap did not recreate the worker');
        replacement.reply({ id: replacement.last.id, kind: 'booted', contract: manifest.contract });
      }
      expect(await pending).toEqual(outcome);
      expect(armed.size, `timer leaked after ${JSON.stringify(outcome)}`).toBe(0);
      client.dispose();
    }
    for (const kind of ['boot', 'consult', 'cancel'] as const) {
      const { client, workers, armed } = scriptedClient();
      const pending =
        kind === 'boot'
          ? client.boot()
          : kind === 'consult'
            ? client.consult('probe.')
            : client.cancel('probe');
      const worker = workers[0];
      if (worker === undefined) throw new Error('worker was not spawned');
      if (kind !== 'cancel') expect(armed.size).toBe(1);
      const response: EngineResponse =
        kind === 'boot'
          ? { id: worker.last.id, kind: 'booted', contract: manifest.contract }
          : kind === 'consult'
            ? { id: worker.last.id, kind: 'consulted' }
            : { id: worker.last.id, kind: 'ack', accepted: false };
      worker.reply(response);
      await pending;
      expect(armed.size, `timer leaked after ${kind}`).toBe(0);
      client.dispose();
    }
  });

  it('P5.1 — a malformed goal fails typed and never executes', async () => {
    const response = await session.handle(
      {
        id: 'u3-malformed',
        kind: 'query',
        goal: 'assertz(u3_forbidden_side_effect),guideline_document(',
        budget: budget(),
      },
      image,
    );
    expect(response).toMatchObject({ kind: 'error', error: { code: 'prolog' } });
    const after = await session.solve('current_predicate(u3_forbidden_side_effect/0).', budget());
    expect(after.kind).toBe('failure');
  });
});
