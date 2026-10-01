// A worker that never answers boot must settle without an unbounded respawn loop.

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { EngineRequest, EngineResponse } from '../src/engine/protocol.js';

class HungWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;

  #onMessage: ((event: { data: EngineResponse }) => void) | undefined;

  addEventListener(type: string, listener: (event: { data: EngineResponse }) => void): void {
    if (type === 'message') this.#onMessage = listener;
  }

  reply(response: EngineResponse): void {
    this.#onMessage?.({ data: response });
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }
}

class Clock {
  readonly armed = new Map<number, { fn: () => void; ms: number }>();
  #next = 0;

  readonly schedule = (fn: () => void, ms: number): unknown => {
    const handle = ++this.#next;
    this.armed.set(handle, { fn, ms });
    return handle;
  };

  readonly cancel = (handle: unknown): void => {
    this.armed.delete(handle as number);
  };

  fire(): void {
    const timer = this.armed.values().next().value as { fn: () => void } | undefined;
    if (timer === undefined) throw new Error('no watchdog is armed');
    timer.fn();
  }
}

describe('boot watchdog', () => {
  it('recreates one hung worker, then returns a typed boot error', async () => {
    const workers: HungWorker[] = [];
    const clock = new Clock();
    const client = new EngineClient({
      spawn: () => {
        const worker = new HungWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
      schedule: clock.schedule,
      cancelSchedule: clock.cancel,
    });

    try {
      const booting = client.boot();
      expect(workers).toHaveLength(1);
      expect(workers[0]?.seen).toMatchObject([{ kind: 'boot' }]);
      expect([...clock.armed.values()].map(({ ms }) => ms)).toEqual([30_000]);

      clock.fire();
      await Promise.resolve();
      await Promise.resolve();
      expect(workers).toHaveLength(2);
      expect(workers[0]?.terminated).toBe(true);

      clock.fire();
      const result = await booting;
      expect(result).toMatchObject({ kind: 'error', error: { code: 'boot' } });
      expect(workers).toHaveLength(2);
      expect(workers[1]?.terminated).toBe(true);
      expect(clock.armed.size).toBe(0);
    } finally {
      client.dispose();
    }
  });

  it('bounds a heap recreation: a hung replacement settles the query and is retired', async () => {
    const workers: HungWorker[] = [];
    const clock = new Clock();
    const client = new EngineClient({
      spawn: () => {
        const worker = new HungWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
      schedule: clock.schedule,
      cancelSchedule: clock.cancel,
    });
    try {
      const querying = client.query('true.', { ...BUDGET_MAX, wallClockMs: 1000, answerCap: 1 });
      const saturated = workers[0];
      const request = saturated?.seen[0];
      if (request?.kind !== 'query') throw new Error('no query was posted');
      saturated?.reply({ id: request.id, kind: 'limit', limit: 'heap', solutions: [] });
      await Promise.resolve();
      expect(workers).toHaveLength(2);
      expect(workers[1]?.seen).toMatchObject([{ kind: 'boot' }]);
      expect([...clock.armed.values()].map(({ ms }) => ms)).toEqual([30_000]);
      clock.fire();
      expect(await querying).toMatchObject({ kind: 'limit', limit: 'heap' });
      expect(workers[1]?.terminated).toBe(true);
      expect(clock.armed.size).toBe(0);
    } finally {
      client.dispose();
    }
  });

  it('bounds a heap recreation that joins a reset already in flight', async () => {
    const workers: HungWorker[] = [];
    const clock = new Clock();
    const client = new EngineClient({
      spawn: () => {
        const worker = new HungWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
      schedule: clock.schedule,
      cancelSchedule: clock.cancel,
    });
    try {
      const querying = client.query('true.', { ...BUDGET_MAX, wallClockMs: 1000, answerCap: 1 });
      const request = workers[0]?.seen[0];
      if (request?.kind !== 'query') throw new Error('no query was posted');
      workers[0]?.reply({ id: request.id, kind: 'limit', limit: 'heap', solutions: [] });
      // An explicit reset lands before the heap continuation, which then joins it.
      void client.reset('explicit reset before the heap continuation');
      await Promise.resolve();
      await Promise.resolve();
      expect(workers).toHaveLength(2);
      expect([...clock.armed.values()].map(({ ms }) => ms)).toEqual([30_000]);
      clock.fire();
      expect(await querying).toMatchObject({ kind: 'limit', limit: 'heap' });
      expect(workers[1]?.terminated).toBe(true);
      expect(clock.armed.size).toBe(0);
    } finally {
      client.dispose();
    }
  });
});
