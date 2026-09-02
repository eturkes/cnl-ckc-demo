// Contract m1u6 C1-C7: cooperative cancellation through an `AbortSignal`.
//
// The signal is the whole design. `EngineClient` mints `rN` internally and
// `cancel(target)` needs exactly that id, so the naive fix is to publish the id —
// which would let any caller cancel a request it never issued. Passing the
// authority instead keeps the id private, and these probes are what hold that.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { AnswerService } from '../src/questions/service.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

// A long wall clock keeps the abort, not the deadline, in charge of every outcome.
const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  ...overrides,
});
const delay = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let image: Uint8Array;
let session: EngineSession;

beforeAll(async () => {
  image = new Uint8Array(readGenerated('kb.pvm'));
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
}, 120_000);

/** Worker-shaped adapter over a real `EngineSession`: genuine execution, async delivery. */
class LiveWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    setTimeout(() => {
      if (this.terminated) return;
      void session.handle(request, image).then(
        (response) => {
          if (this.terminated) return;
          for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
        },
        (cause: unknown) => {
          const message = cause instanceof Error ? cause.message : String(cause);
          for (const listener of this.#listeners.get('error') ?? []) listener({ message });
        },
      );
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
  }
}

/** Delivers nothing until the test says so, which is what makes ordering deterministic. */
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

/** Injected clock: nothing fires until the test says so, and armed timers stay countable. */
class Clock {
  readonly armed = new Map<number, { handle: number; fn: () => void }>();
  #next = 0;

  readonly schedule = (fn: () => void): unknown => {
    const handle = ++this.#next;
    this.armed.set(handle, { handle, fn });
    return handle;
  };

  readonly cancel = (handle: unknown): void => {
    this.armed.delete(handle as number);
  };
}

const liveClient = (): { client: EngineClient; worker: LiveWorker } => {
  const worker = new LiveWorker();
  return { client: new EngineClient({ spawn: () => worker as unknown as Worker }), worker };
};

const scriptedClient = (): { client: EngineClient; workers: ScriptWorker[] } => {
  const workers: ScriptWorker[] = [];
  return {
    client: new EngineClient({
      spawn: () => {
        const worker = new ScriptWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    }),
    workers,
  };
};

const clockedClient = (
  prepare: (worker: ScriptWorker) => void = () => undefined,
): { client: EngineClient; workers: ScriptWorker[]; clock: Clock } => {
  const workers: ScriptWorker[] = [];
  const clock = new Clock();
  const client = new EngineClient({
    spawn: () => {
      const worker = new ScriptWorker();
      prepare(worker);
      workers.push(worker);
      return worker as unknown as Worker;
    },
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
  });
  return { client, workers, clock };
};

describe('signal-bound cancellation', () => {
  it('C1 leaves an unsignalled query behaving exactly as before', async () => {
    const { client, worker } = liveClient();
    try {
      expect(await client.query('between(1,3,X).', budget())).toMatchObject({ kind: 'solutions' });
      expect(worker.seen.filter((request) => request.kind === 'cancel')).toHaveLength(0);
    } finally {
      client.dispose();
    }
  }, 120_000);

  it('C2 keeps the service id-only: no signal makes free text executable', async () => {
    const { client, worker } = liveClient();
    const service = new AnswerService(client);
    const controller = new AbortController();
    try {
      for (const hostile of ['', 'what dose is safe?', 'guideline_entity(X,_,_,_).']) {
        expect(await service.ask(hostile, budget(), controller.signal)).toEqual({
          kind: 'rejected',
          reason: 'unknown-id',
        });
      }
      expect(worker.seen).toHaveLength(0);
    } finally {
      client.dispose();
    }
  }, 120_000);

  it('C3 settles a live run as cancelled, carrying what was already proven', async () => {
    const { client } = liveClient();
    const controller = new AbortController();
    try {
      const running = client.query('between(1,100000000,X).', budget(), controller.signal);
      await delay(25);
      controller.abort();
      const outcome = await running;
      expect(outcome.kind).toBe('cancelled');
      if (outcome.kind !== 'cancelled') return;
      expect(outcome.solutions.length).toBeGreaterThan(0);
    } finally {
      client.dispose();
    }
  }, 120_000);

  it('C4 posts one cancel at the live id and nothing on a second abort', async () => {
    const { client, workers } = scriptedClient();
    const controller = new AbortController();
    try {
      const running = client.query('repeat.', budget(), controller.signal);
      const worker = workers[0];
      const query = worker?.seen.find((request) => request.kind === 'query');
      controller.abort();
      controller.abort();
      const cancels = worker?.seen.filter((request) => request.kind === 'cancel') ?? [];
      expect(cancels).toHaveLength(1);
      expect(cancels[0]).toMatchObject({ target: query?.id });
      if (query === undefined) throw new Error('query was never posted');
      worker?.reply({ id: query.id, kind: 'cancelled', solutions: [] });
      expect(await running).toEqual({ kind: 'cancelled', solutions: [] });
    } finally {
      client.dispose();
    }
  });

  it('C5 answers an already-aborted signal without spawning a worker', async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, workers } = scriptedClient();
    const service = new AnswerService(client);
    try {
      expect(await service.ask('category-a-recommendations', budget(), controller.signal)).toEqual({
        kind: 'cancelled',
        id: 'category-a-recommendations',
        serialized: 'solutions([])',
        solutions: [],
      });
      expect(workers).toHaveLength(0);
    } finally {
      client.dispose();
    }
  });

  it('C6 detaches the listener at settlement, so a later abort is inert', async () => {
    const { client, worker } = liveClient();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => void unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      expect(await client.query('between(1,2,X).', budget(), controller.signal)).toMatchObject({
        kind: 'solutions',
      });
      const settled = worker.seen.length;
      controller.abort();
      await delay();
      expect(worker.seen).toHaveLength(settled);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      remove.mockRestore();
      client.dispose();
    }
  }, 120_000);

  it('C7 settles every signal-bound caller once across a hard reset', async () => {
    const { client, workers } = scriptedClient();
    const controls = [new AbortController(), new AbortController()];
    const settlements = [0, 0];
    const violations: string[] = [];
    client.onProtocolViolation = (error) => void violations.push(error.message);
    try {
      const runs = controls.map((control, index) =>
        client.query('repeat.', budget(), control.signal).then((outcome) => {
          settlements[index] = (settlements[index] ?? 0) + 1;
          return outcome;
        }),
      );
      const dead = workers[0];
      const deadQueries = dead?.seen.filter((request) => request.kind === 'query') ?? [];
      const resetting = client.reset('cancel probe hard reset');
      expect(dead?.terminated).toBe(true);

      const replacement = workers[1];
      const boot = replacement?.seen.find((request) => request.kind === 'boot');
      if (boot === undefined) throw new Error('replacement boot was not posted');
      replacement?.reply({ id: boot.id, kind: 'booted', contract: manifest.contract });

      for (const outcome of await Promise.all(runs)) {
        expect(outcome).toMatchObject({ kind: 'error', error: { code: 'worker' } });
      }
      expect(await resetting).toMatchObject({ kind: 'booted' });
      expect(settlements).toEqual([1, 1]);

      // A retired generation must stay retired: neither its late replies nor its
      // still-live signals may reach the replacement worker.
      const afterBoot = replacement?.seen.length ?? 0;
      for (const control of controls) control.abort();
      for (const request of deadQueries) dead?.reply({ id: request.id, kind: 'failure' });
      await delay();
      expect(replacement?.seen).toHaveLength(afterBoot);
      expect(settlements).toEqual([1, 1]);
      expect(violations).toHaveLength(0);
    } finally {
      client.dispose();
    }
  });
});

// Lifecycle branches the happy-path worker mock never reaches: each is a settlement
// path that only a hostile transport or a retired generation can drive.
describe('worker lifecycle events', () => {
  it('C8 settles every in-flight caller once on `messageerror`', async () => {
    const { client, workers, clock } = clockedClient();
    const first = client.query('true.', budget());
    const second = client.query('fail.', budget());
    await delay();
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

  it('C9 settles typed when `postMessage` throws, leaving no armed timer', async () => {
    const { client, clock } = clockedClient((worker) => {
      // A payload the structured clone algorithm refuses never reaches the worker.
      worker.postMessage = (): never => {
        throw new Error('structured clone failed');
      };
    });
    expect(await client.query('true.', budget())).toMatchObject({
      kind: 'error',
      error: { code: 'protocol' },
    });
    expect(clock.armed.size).toBe(0);
    client.dispose();
  });

  it('C10 ignores a watchdog left over from a retired generation', async () => {
    const { client, workers, clock } = clockedClient();
    const violations: string[] = [];
    client.onProtocolViolation = (error) => violations.push(error.message);
    const first = client.query('true.', budget());
    await delay();
    const stale = [...clock.armed.values()][0];
    void client.reset('probe');
    await delay();
    expect(await first).toMatchObject({ kind: 'error', error: { code: 'worker' } });

    const replacement = workers[1];
    const boot = replacement?.seen.find((request) => request.kind === 'boot');
    if (boot === undefined) throw new Error('replacement boot was not posted');
    replacement?.reply({ id: boot.id, kind: 'booted', contract: manifest.contract });
    const second = client.query('true.', budget());
    await delay();
    // The retired generation's timer body still exists; firing it must not settle,
    // terminate or violate anything belonging to the live generation.
    stale?.fn();
    expect(replacement?.terminated).toBe(false);
    replacement?.reply({ id: replacement.last.id, kind: 'failure' });
    expect(await second).toEqual({ kind: 'failure' });
    expect(violations).toEqual([]);
    client.dispose();
  });
});
