import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { EngineRequest } from '../src/engine/protocol.js';

const CONTRACT = { schemaVersion: 1, documents: 337 };
const ABORTED = { kind: 'error', error: { code: 'aborted', message: 'Aborted(probe)' } } as const;
const HEAP = { kind: 'limit', limit: 'heap', solutions: [] } as const;
const PROLOG = { kind: 'error', error: { code: 'prolog', message: 'ordinary exception' } } as const;
const BUDGET = { ...BUDGET_MAX, wallClockMs: 1000, answerCap: 10 };

type Operation = 'query' | 'proof' | 'consult';

class FakeWorker {
  readonly seen: EngineRequest[] = [];
  terminations = 0;
  #message: ((event: { data: unknown }) => void) | undefined;

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    if (type === 'message') this.#message = listener;
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  reply(data: unknown): void {
    this.#message?.({ data });
  }

  terminate(): void {
    this.terminations += 1;
  }

  get last(): EngineRequest {
    const request = this.seen.at(-1);
    if (request === undefined) throw new Error('worker has no request');
    return request;
  }
}

const drain = async (): Promise<void> => {
  for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
};

const harness = () => {
  const workers: FakeWorker[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 0;
  const client = new EngineClient({
    spawn: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    schedule: (fn, ms) => {
      timers.set(++nextTimer, { fn, ms });
      return nextTimer;
    },
    cancelSchedule: (handle) => timers.delete(handle as number),
  });
  const worker = (index: number): FakeWorker => {
    const value = workers[index];
    if (value === undefined) throw new Error(`no worker ${String(index)}`);
    return value;
  };
  const request = (operation: Operation) => {
    switch (operation) {
      case 'query':
        return client.query('true.', BUDGET);
      case 'proof':
        return client.prove({ constrainedGoal: 'guideline_schema_version(1).' }, BUDGET);
      case 'consult':
        return client.consult('probe.');
    }
  };
  return { client, workers, worker, timers, request };
};

const RECOVERIES = [
  { operation: 'query', label: 'heap limit', response: HEAP },
  { operation: 'query', label: 'aborted error', response: ABORTED },
  { operation: 'proof', label: 'aborted error', response: ABORTED },
  { operation: 'consult', label: 'aborted error', response: ABORTED },
  { operation: 'proof', label: 'heap limit', response: HEAP },
] as const;

describe('client abort recovery', () => {
  it.each(RECOVERIES)(
    'A5 $operation $label waits for exactly one booted replacement before resolving',
    async ({ operation, response }) => {
      const { client, workers, worker, request, timers } = harness();
      try {
        const boot = client.boot();
        worker(0).reply({ id: worker(0).last.id, kind: 'booted', contract: CONTRACT });
        await boot;
        let settled = false;
        const active = request(operation).then((outcome) => {
          settled = true;
          return outcome;
        });
        const original = worker(0);
        original.reply({ id: original.last.id, ...response });
        await drain();
        expect.soft(original.terminations).toBe(1);
        expect.soft(settled).toBe(false);
        expect(workers).toHaveLength(2);
        const replacement = worker(1);
        expect(replacement.seen).toMatchObject([{ kind: 'boot' }]);
        expect([...timers.values()].map(({ ms }) => ms)).toEqual([30_000]);
        replacement.reply({ id: replacement.last.id, kind: 'progress', phase: 'verify' });
        await drain();
        expect(settled).toBe(false);
        replacement.reply({ id: replacement.last.id, kind: 'booted', contract: CONTRACT });
        const expected =
          operation === 'proof' && response.kind === 'limit'
            ? { kind: 'limit', limit: 'heap' }
            : response;
        expect(await active).toEqual(expected);
        expect(settled).toBe(true);
        expect(workers).toHaveLength(2);
        expect(timers.size).toBe(0);

        const next = client.query('X = replacement.', BUDGET);
        expect(replacement.last).toMatchObject({ kind: 'query', goal: 'X = replacement.' });
        expect(original.seen).toHaveLength(2);
        replacement.reply({ id: replacement.last.id, kind: 'solutions', solutions: [] });
        expect(await next).toEqual({ kind: 'solutions', solutions: [] });
      } finally {
        client.dispose();
      }
    },
  );

  it('A5 an ordinary Prolog error keeps the worker and sends its next query there', async () => {
    const { client, workers, worker, request } = harness();
    try {
      const active = request('query');
      const original = worker(0);
      original.reply({ id: original.last.id, ...PROLOG });
      expect(await active).toEqual(PROLOG);
      expect(workers).toHaveLength(1);
      expect(original.terminations).toBe(0);
      const next = client.query('true.', BUDGET);
      expect(original.seen).toHaveLength(2);
      original.reply({ id: original.last.id, kind: 'solutions', solutions: [] });
      expect(await next).toEqual({ kind: 'solutions', solutions: [] });
      expect(workers).toHaveLength(1);
    } finally {
      client.dispose();
    }
  });

  it.each(RECOVERIES)(
    'A5 $operation $label joins a reset that starts before its recovery continuation',
    async ({ operation, response }) => {
      const { client, workers, worker, request } = harness();
      try {
        let settled = false;
        const active = request(operation).then((outcome) => {
          settled = true;
          return outcome;
        });
        worker(0).reply({ id: worker(0).last.id, ...response });
        const reset = client.reset('reset races the abort continuation');
        await drain();
        expect.soft(settled).toBe(false);
        expect(workers).toHaveLength(2);
        expect(worker(0).terminations).toBe(1);
        expect(worker(1).seen).toMatchObject([{ kind: 'boot' }]);
        worker(1).reply({ id: worker(1).last.id, kind: 'booted', contract: CONTRACT });
        expect(await reset).toEqual({ kind: 'booted', contract: CONTRACT });
        expect(await active).toMatchObject({ kind: response.kind });
        expect(workers).toHaveLength(2);
      } finally {
        client.dispose();
      }
    },
  );
});
