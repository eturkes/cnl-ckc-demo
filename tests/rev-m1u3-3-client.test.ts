// Adversarial review probes for M1.u3 — client-seam half (`rev-m1u3-3`).
//
// Review artifact, not shipped coverage. Each block names the check-set row it
// decides. Blocks expected RED against e3ef450 are marked `RED:` in their title.

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A worker that delivers nothing until the test says so. */
class ScriptWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }

  reply(response: EngineResponse): void {
    this.emit('message', { data: response });
  }

  get last(): EngineRequest {
    const request = this.seen.at(-1);
    if (request === undefined) throw new Error('worker received nothing');
    return request;
  }
}

interface Armed {
  handle: number;
  fn: () => void;
  ms: number;
}

/** Injected clock: nothing fires until `advance` says so, and armed timers are countable. */
class Clock {
  readonly armed = new Map<number, Armed>();
  #next = 0;

  readonly schedule = (fn: () => void, ms: number): unknown => {
    const handle = ++this.#next;
    this.armed.set(handle, { handle, fn, ms });
    return handle;
  };

  readonly cancel = (handle: unknown): void => {
    this.armed.delete(handle as number);
  };

  fireAll(): void {
    for (const entry of [...this.armed.values()]) {
      this.armed.delete(entry.handle);
      entry.fn();
    }
  }
}

const harness = (): { client: EngineClient; workers: ScriptWorker[]; clock: Clock } => {
  const workers: ScriptWorker[] = [];
  const clock = new Clock();
  const client = new EngineClient({
    spawn: () => {
      const worker = new ScriptWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
  });
  return { client, workers, clock };
};

// ---------------------------------------------------------------- R01

describe('R01 every exported Prolog-execution surface carries a bound', () => {
  it('bounds a query with exactly one deadline timer', async () => {
    const { client, workers, clock } = harness();
    const running = client.query('between(1,10,X).', budget({ wallClockMs: 1234 }));
    await tick();
    expect(clock.armed.size).toBe(1);
    expect([...clock.armed.values()][0]?.ms).toBe(1234 + 500);
    const worker = workers[0];
    worker?.reply({ id: worker.last.id, kind: 'failure' });
    expect(await running).toEqual({ kind: 'failure' });
    expect(clock.armed.size).toBe(0);
    client.dispose();
  });

  it('RED: arms no deadline for `consult`, whose directives run arbitrary goals', async () => {
    const { client, clock } = harness();
    // `EngineClient.consult` is public and reaches `consult/1`, which executes every
    // `:- Goal.` directive in the source. `#send` receives no `deadlineMs` for it, so
    // a non-terminating directive has no soft check, no hard watchdog and no cancel.
    void client.consult(':- repeat, fail.\n');
    await tick();
    expect(clock.armed.size).toBe(1);
    client.dispose();
  });
});

// ---------------------------------------------------------------- R29

describe('R29 lifecycle events the committed suite never drives', () => {
  it('settles every in-flight caller once on `messageerror`', async () => {
    const { client, workers, clock } = harness();
    const first = client.query('true.', budget());
    const second = client.query('fail.', budget());
    await tick();
    expect(clock.armed.size).toBe(2);
    workers[0]?.emit('messageerror', {});
    for (const outcome of await Promise.all([first, second])) {
      expect(outcome).toMatchObject({
        kind: 'error',
        error: { code: 'worker', message: 'client could not deserialize a response' },
      });
    }
    expect(clock.armed.size).toBe(0);
    client.dispose();
  });

  it('settles typed when `postMessage` throws, leaving no armed timer', async () => {
    const workers: ScriptWorker[] = [];
    const clock = new Clock();
    const client = new EngineClient({
      spawn: () => {
        const worker = new ScriptWorker();
        // A payload the structured clone algorithm refuses never reaches the worker.
        worker.postMessage = (): never => {
          throw new Error('structured clone failed');
        };
        workers.push(worker);
        return worker as unknown as Worker;
      },
      schedule: clock.schedule,
      cancelSchedule: clock.cancel,
    });
    expect(await client.query('true.', budget())).toMatchObject({
      kind: 'error',
      error: { code: 'protocol' },
    });
    expect(clock.armed.size).toBe(0);
    client.dispose();
  });

  it('ignores a watchdog left over from a retired generation', async () => {
    const { client, workers, clock } = harness();
    const violations: string[] = [];
    client.onProtocolViolation = (error) => violations.push(error.message);
    const first = client.query('true.', budget());
    await tick();
    const stale = [...clock.armed.values()][0];
    void client.reset('probe');
    await tick();
    expect(await first).toMatchObject({ kind: 'error', error: { code: 'worker' } });

    const second = client.query('true.', budget());
    await tick();
    // The retired generation's timer body still exists; firing it must not settle,
    // terminate or violate anything belonging to the live generation.
    stale?.fn();
    const replacement = workers[1];
    expect(replacement?.terminated).toBe(false);
    replacement?.reply({ id: replacement.last.id, kind: 'failure' });
    expect(await second).toEqual({ kind: 'failure' });
    expect(violations).toEqual([]);
    client.dispose();
  });
});
