// Adversarial review probes for M1.u3 — client lifecycle half (`rev-m1u3-2`).
//
// Review artifact, not shipped coverage. Each block names the check-set row it
// decides. Rows expected RED against 9020e62 are marked `RED:` in their title.

import { describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineRequest,
  EngineResponse,
} from '../src/engine/protocol.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A worker that delivers nothing until the test says so, and can be made hostile. */
class ScriptWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  postThrows = false;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    if (this.postThrows) throw new Error('structured clone failed');
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

  find(kind: EngineRequest['kind']): EngineRequest | undefined {
    return this.seen.find((request) => request.kind === kind);
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

  /** Fires every armed timer once, newest last, as a real clock overrun would. */
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

const withUnhandled = async (body: () => Promise<void>): Promise<unknown[]> => {
  const seen: unknown[] = [];
  const trap = (reason: unknown): void => void seen.push(reason);
  process.on('unhandledRejection', trap);
  try {
    await body();
    await tick();
    await tick();
  } finally {
    process.off('unhandledRejection', trap);
  }
  return seen;
};

describe('R25 structured-clone safety of every declared payload', () => {
  it('round-trips every response kind and the budget spec deep-equal', () => {
    const solution = {
      bindings: { X: { kind: 'compound' as const, functor: 'f', args: [] } },
      display: { X: 'f' },
    };
    const payloads: unknown[] = [
      budget(),
      { id: 'r1', kind: 'boot' },
      { id: 'r1', kind: 'query', goal: 'true.', budget: budget() },
      { id: 'r1', kind: 'consult', source: 'a.' },
      { id: 'r1', kind: 'cancel', target: 'r0' },
      { id: 'r1', kind: 'booted', contract: CONTRACT },
      { id: 'r1', kind: 'solutions', solutions: [solution] },
      { id: 'r1', kind: 'failure' },
      { id: 'r1', kind: 'limit', limit: 'heap', solutions: [solution] },
      { id: 'r1', kind: 'cancelled', solutions: [] },
      { id: 'r1', kind: 'ack', accepted: false },
      { id: 'r1', kind: 'consulted' },
      { id: 'r1', kind: 'error', error: { code: 'budget', message: 'x' } },
    ];
    for (const payload of payloads) expect(structuredClone(payload)).toEqual(payload);
  });
});

describe('R01/P6.2 unbudgeted exported surfaces', () => {
  it('observed: a public `consult` runs Prolog directives with no bound and never settles', async () => {
    const { client, workers, clock } = harness();
    const pending = client.consult(':- between(1,inf,_), fail.');
    await tick();
    // The request reaches the engine, so consulted `:- Goal.` directives execute.
    expect(workers[0]?.find('consult')).toBeDefined();
    expect(clock.armed.size).toBe(0);
    clock.fireAll();
    expect(await Promise.race([pending, tick().then(() => 'still-pending')])).toBe('still-pending');
    client.dispose();
  });

  it('RED: every public engine-executing call must arm a bound, as `query` does', async () => {
    const { client, clock } = harness();
    await tick();
    void client.query('true.', budget());
    await tick();
    expect(clock.armed.size).toBe(1);
    void client.consult('probe.');
    await tick();
    expect(clock.armed.size).toBe(2);
    client.dispose();
  });
});

describe('R16/R29 worker failure settles every caller exactly once', () => {
  it('RED: `messageerror` on the worker has no committed coverage; probe drives it here', async () => {
    const { client, workers } = harness();
    const counts = [0, 0];
    const unhandled = await withUnhandled(async () => {
      const runs = [client.query('true.', budget()), client.query('fail.', budget())].map(
        (run, index) =>
          run.then((outcome) => {
            counts[index] = (counts[index] ?? 0) + 1;
            return outcome;
          }),
      );
      await tick();
      workers[0]?.emit('messageerror', {});
      for (const outcome of await Promise.all(runs)) {
        expect(outcome).toMatchObject({ kind: 'error', error: { code: 'worker' } });
      }
    });
    expect(counts).toEqual([1, 1]);
    expect(unhandled).toHaveLength(0);
    client.dispose();
  });

  it('empties the pending map and clears timers on `error` and on `messageerror`', async () => {
    for (const event of ['error', 'messageerror']) {
      const { client, workers, clock } = harness();
      const runs = [client.query('true.', budget()), client.query('true.', budget())];
      await tick();
      expect(clock.armed.size).toBe(2);
      workers[0]?.emit(event, { message: 'boom' });
      for (const outcome of await Promise.all(runs)) expect(outcome.kind).toBe('error');
      expect(clock.armed.size).toBe(0);
      client.dispose();
    }
  });
});

describe('R17 a request issued during the respawn window', () => {
  it('settles typed, posts nothing to the dead worker, and works after boot', async () => {
    const { client, workers } = harness();
    const first = client.query('true.', budget());
    await tick();
    const dead = workers[0];
    const deadPosts = dead?.seen.length ?? 0;

    const resetting = client.reset('probe respawn');
    expect(dead?.terminated).toBe(true);
    // Replacement boot is unanswered, so this query is issued inside the window.
    const during = client.query('true.', budget());
    await tick();
    expect(dead?.seen).toHaveLength(deadPosts);
    expect(workers).toHaveLength(2);

    const replacement = workers[1];
    const boot = replacement?.find('boot');
    if (boot === undefined) throw new Error('replacement never booted');
    replacement?.reply({ id: boot.id, kind: 'booted', contract: CONTRACT });
    expect(await resetting).toEqual({ kind: 'booted', contract: CONTRACT });
    expect(await first).toMatchObject({ kind: 'error', error: { code: 'worker' } });

    const query = replacement?.seen.filter((request) => request.kind === 'query').at(-1);
    if (query === undefined) throw new Error('in-window query never reached the replacement');
    replacement?.reply({ id: query.id, kind: 'failure' });
    expect(await during).toEqual({ kind: 'failure' });
    client.dispose();
  });
});

describe('R18 monotonic ids across generations', () => {
  it('ignores a stale response and a stale watchdog from a retired generation', async () => {
    const { client, workers, clock } = harness();
    const violations: string[] = [];
    client.onProtocolViolation = (error) => void violations.push(error.message);
    const first = client.query('true.', budget());
    await tick();
    const dead = workers[0];
    const staleQuery = dead?.find('query');
    const staleTimers = [...clock.armed.values()];

    void client.reset('probe stale');
    await tick();
    expect(await first).toMatchObject({ kind: 'error' });

    const second = client.query('true.', budget());
    await tick();
    const replacement = workers[1];
    const live = replacement?.seen.filter((request) => request.kind === 'query').at(-1);
    if (live === undefined || staleQuery === undefined) throw new Error('probe setup failed');
    // Ids never restart, so the dead generation cannot name a live request.
    expect(Number(live.id.slice(1))).toBeGreaterThan(Number(staleQuery.id.slice(1)));

    dead?.reply({ id: staleQuery.id, kind: 'failure' });
    dead?.reply({ id: live.id, kind: 'solutions', solutions: [] });
    for (const timer of staleTimers) timer.fn();
    await tick();
    expect(replacement?.terminated).toBe(false);
    expect(violations).toHaveLength(0);

    replacement?.reply({ id: live.id, kind: 'failure' });
    expect(await second).toEqual({ kind: 'failure' });
    client.dispose();
  });
});

describe('R19 hard cancel is single-flight across every trigger', () => {
  it('produces one termination and one respawn for concurrent user, watchdog and failure', async () => {
    const { client, workers, clock } = harness();
    const outcome = client.query('true.', budget({ wallClockMs: 1 }));
    await tick();
    const dead = workers[0];
    const resets = [client.reset('a'), client.reset('b')];
    clock.fireAll();
    dead?.emit('error', { message: 'also failed' });
    resets.push(client.reset('c'));
    await tick();

    expect(workers.filter((worker) => worker.terminated)).toHaveLength(1);
    expect(workers).toHaveLength(2);
    const replacement = workers[1];
    const boots = replacement?.seen.filter((request) => request.kind === 'boot') ?? [];
    expect(boots).toHaveLength(1);
    replacement?.reply({ id: boots[0]?.id ?? '', kind: 'booted', contract: CONTRACT });
    for (const settled of await Promise.all(resets)) expect(settled.kind).toBe('booted');
    expect((await outcome).kind).not.toBe('solutions');
    client.dispose();
  });
});

describe('R20 every terminal outcome disarms its watchdog', () => {
  const terminal: [string, EngineResponse | 'post-failure' | 'reset' | 'dispose'][] = [
    ['solutions', { id: '', kind: 'solutions', solutions: [] }],
    ['failure', { id: '', kind: 'failure' }],
    ['limit stack', { id: '', kind: 'limit', limit: 'stack', solutions: [] }],
    ['limit depth', { id: '', kind: 'limit', limit: 'depth', solutions: [] }],
    ['limit inference', { id: '', kind: 'limit', limit: 'inference', solutions: [] }],
    ['limit wall-clock', { id: '', kind: 'limit', limit: 'wall-clock', solutions: [] }],
    ['limit answer-cap', { id: '', kind: 'limit', limit: 'answer-cap', solutions: [] }],
    ['limit heap', { id: '', kind: 'limit', limit: 'heap', solutions: [] }],
    ['cancelled', { id: '', kind: 'cancelled', solutions: [] }],
    ['error', { id: '', kind: 'error', error: { code: 'prolog', message: 'x' } }],
    ['post-failure', 'post-failure'],
    ['reset', 'reset'],
    ['dispose', 'dispose'],
  ];

  it.each(terminal)('leaves no armed timer after %s', async (_name, branch) => {
    const { client, workers, clock } = harness();
    if (branch === 'post-failure') {
      const spawned = new ScriptWorker();
      spawned.postThrows = true;
      const solo = new EngineClient({
        spawn: () => spawned as unknown as Worker,
        schedule: clock.schedule,
        cancelSchedule: clock.cancel,
      });
      expect((await solo.query('true.', budget())).kind).toBe('error');
      expect(clock.armed.size).toBe(0);
      solo.dispose();
      return;
    }
    const run = client.query('true.', budget());
    await tick();
    expect(clock.armed.size).toBe(1);
    if (branch === 'reset') {
      void client.reset('probe');
      await tick();
    } else if (branch === 'dispose') {
      client.dispose();
    } else {
      const worker = workers[0];
      const query = worker?.find('query');
      worker?.reply({ ...branch, id: query?.id ?? '' } as EngineResponse);
    }
    await run;
    // The reset path arms a fresh boot request; only the retired query timer matters.
    const queryTimers = [...clock.armed.values()].filter((entry) => entry.ms >= budget().wallClockMs);
    expect(queryTimers).toHaveLength(0);
    clock.fireAll();
    await tick();
    if (branch !== 'reset') expect(workers.filter((w) => w.terminated).length).toBeLessThan(2);
    client.dispose();
  });
});

describe('R21 dispose during an active query', () => {
  it('terminates once, settles once, and never respawns', async () => {
    const { client, workers, clock } = harness();
    let settlements = 0;
    const unhandled = await withUnhandled(async () => {
      const run = client.query('true.', budget()).then((outcome) => {
        settlements += 1;
        return outcome;
      });
      await tick();
      client.dispose();
      expect(await run).toMatchObject({ kind: 'error', error: { code: 'worker' } });
      clock.fireAll();
      workers[0]?.emit('error', { message: 'late failure' });
      workers[0]?.reply({ id: 'r1', kind: 'failure' });
      expect((await client.reset('after dispose')).kind).toBe('error');
      expect((await client.query('true.', budget())).kind).toBe('error');
    });
    expect(settlements).toBe(1);
    expect(workers).toHaveLength(1);
    expect(workers[0]?.terminated).toBe(true);
    expect(unhandled).toHaveLength(0);
  });
});

describe('R14 hard cancel rebuilds the whole worker before reporting ready', () => {
  it('terminates once, constructs one replacement, and reports the replacement contract', async () => {
    const { client, workers } = harness();
    void client.query('true.', budget());
    await tick();
    const spy = vi.fn();
    const resetting = client.reset('probe rebuild').then(spy);
    await tick();

    expect(workers[0]?.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    const replacement = workers[1];
    expect(replacement?.terminated).toBe(false);
    const boot = replacement?.find('boot');
    if (boot === undefined) throw new Error('replacement never booted');
    // Readiness must not precede the replacement's own contract answer.
    expect(spy).not.toHaveBeenCalled();
    const fresh: EngineContract = { schemaVersion: 1, documents: 337 };
    replacement?.reply({ id: boot.id, kind: 'booted', contract: fresh });
    await resetting;
    expect(spy).toHaveBeenCalledWith({ kind: 'booted', contract: fresh });
    client.dispose();
  });
});
