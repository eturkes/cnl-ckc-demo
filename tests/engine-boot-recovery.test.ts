// `.agent/contracts/mnt-d21.md` B1–B3, B5: boot failure retires the image-fetch cache.

import { describe, expect, it } from 'vitest';

import { EngineClient } from '../src/engine/client.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineErrorCode,
  EngineRequest,
  EngineResponse,
} from '../src/engine/protocol.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };
const BUDGET: BudgetSpec = {
  stackBytes: 8_388_608,
  depth: 100,
  inferences: 100_000,
  wallClockMs: 1000,
  answerCap: 10,
};
const ERROR_CODES: readonly EngineErrorCode[] = [
  'boot',
  'contract',
  'prolog',
  'decode',
  'protocol',
  'worker',
  'budget',
  'consult',
];

type ResponseBody = EngineResponse extends infer R
  ? R extends EngineResponse
    ? Omit<R, 'id'>
    : never
  : never;

class StubWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  #message: ((event: MessageEvent<EngineResponse>) => void) | undefined;

  constructor(readonly bootResponse?: ResponseBody) {}

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === 'message') this.#message = listener;
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    const response = this.bootResponse;
    if (request.kind === 'boot' && response !== undefined)
      queueMicrotask(() => this.receive({ ...response, id: request.id }));
  }

  receive(response: EngineResponse): void {
    // A queued message can outlive termination; keep the client's registered callback.
    this.#message?.({ data: response } as MessageEvent<EngineResponse>);
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
    const next = this.armed.entries().next().value;
    if (next === undefined) throw new Error('no watchdog is armed');
    const [handle, timer] = next;
    this.armed.delete(handle);
    timer.fn();
  }
}

const harness = (response?: (index: number) => ResponseBody | undefined) => {
  const workers: StubWorker[] = [];
  const clock = new Clock();
  const client = new EngineClient({
    spawn: () => {
      const worker = new StubWorker(response?.(workers.length));
      workers.push(worker);
      return worker as unknown as Worker;
    },
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
  });
  const worker = (index: number): StubWorker => {
    const value = workers[index];
    if (value === undefined) throw new Error(`worker ${String(index)} was not spawned`);
    return value;
  };
  return { client, workers, clock, worker };
};

const request = (worker: StubWorker): EngineRequest => {
  const value = worker.seen.at(-1);
  if (value === undefined) throw new Error('worker received no request');
  return value;
};

const drain = async (): Promise<void> => {
  for (let tick = 0; tick < 6; tick++) await Promise.resolve();
};

const failure = (code: EngineErrorCode = 'boot', message = 'cached image fetch rejected') =>
  ({ kind: 'error', error: { code, message } }) as const;

const STALE_RESPONSES: readonly ResponseBody[] = [
  { kind: 'booted', contract: { schemaVersion: 999, documents: -1 } },
  { kind: 'solutions', solutions: [] },
  { kind: 'proof', steps: [] },
  { kind: 'failure' },
  { kind: 'limit', limit: 'heap', solutions: [] },
  { kind: 'cancelled', solutions: [] },
  { kind: 'ack', accepted: true },
  { kind: 'consulted' },
  ...ERROR_CODES.map((code) => failure(code, 'retired-worker poison')),
];

const ignoreRetired = async (
  retired: StubWorker,
  current: EngineRequest,
  settled: () => boolean,
): Promise<void> => {
  // Exhaust the response union with old, live and unrelated correlation ids.
  for (const id of [request(retired).id, current.id, 'unclaimed-retired-id']) {
    for (const response of STALE_RESPONSES) {
      retired.receive({ ...response, id });
      await drain();
      expect(settled(), `retired ${response.kind} with id ${id}`).toBe(false);
    }
  }
};

describe('boot-error recovery', () => {
  it('B1 terminates a worker before a typed boot error resolves', async () => {
    for (const code of ERROR_CODES) {
      const { client, workers, clock, worker } = harness(() => failure(code));
      try {
        expect(await client.boot()).toEqual(failure(code));
        expect(worker(0).terminated, code).toBe(true);
        expect(workers, code).toHaveLength(1);
        expect(clock.armed.size, code).toBe(0);
      } finally {
        client.dispose();
      }
    }
  });

  it('B1 spawns the next boot instead of posting to the failed worker', async () => {
    for (const code of ERROR_CODES) {
      const { client, workers, worker } = harness(() => failure(code, ''));
      try {
        expect(await client.boot()).toEqual(failure(code, ''));
        const retry = client.boot();
        await drain();
        expect(workers, code).toHaveLength(2);
        expect(worker(0).seen, code).toHaveLength(1);
        expect(worker(1).seen, code).toMatchObject([{ kind: 'boot' }]);
        expect(await retry).toEqual(failure(code, ''));
      } finally {
        client.dispose();
      }
    }
  });

  it('B2 recovers a cached fetch rejection with exactly one fresh spawn', async () => {
    const { client, workers, worker } = harness((index) =>
      index === 0 ? failure() : { kind: 'booted', contract: CONTRACT },
    );
    try {
      expect(await client.boot()).toEqual(failure());
      const recovered = await client.boot();

      expect(recovered).toEqual({ kind: 'booted', contract: CONTRACT });
      expect(workers).toHaveLength(2);
      expect(worker(0).terminated).toBe(true);
      expect(worker(0).seen).toHaveLength(1);
      expect(worker(1).seen).toMatchObject([{ kind: 'boot' }]);
    } finally {
      client.dispose();
    }
  });

  it('B3 never lets a retired response settle a replacement boot', async () => {
    const { client, worker } = harness();
    try {
      const first = client.boot();
      const retired = worker(0);
      retired.receive({ id: request(retired).id, kind: 'booted', contract: CONTRACT });
      await first;

      let settled = false;
      const replacement = client.reset('B3 retirement');
      void replacement.then(() => {
        settled = true;
      });
      await drain();
      const fresh = worker(1);
      const current = request(fresh);
      expect(retired.terminated).toBe(true);
      await ignoreRetired(retired, current, () => settled);

      fresh.receive({ id: current.id, kind: 'booted', contract: CONTRACT });
      expect(await replacement).toEqual({ kind: 'booted', contract: CONTRACT });
    } finally {
      client.dispose();
    }
  });

  it.each(['query', 'proof', 'consult', 'cancel'] as const)(
    'B3 never lets a retired response settle a replacement %s',
    async (kind) => {
      const { client, worker } = harness();
      try {
        const first = client.boot();
        const retired = worker(0);
        retired.receive({ id: request(retired).id, kind: 'booted', contract: CONTRACT });
        await first;
        const replacement = client.reset('B3 retirement');
        await drain();
        const fresh = worker(1);
        fresh.receive({ id: request(fresh).id, kind: 'booted', contract: CONTRACT });
        await replacement;

        let settled = false;
        const pending =
          kind === 'query'
            ? client.query('true', BUDGET)
            : kind === 'proof'
              ? client.prove({ constrainedGoal: 'true' }, BUDGET)
              : kind === 'consult'
                ? client.consult('b3_fact.')
                : client.cancel('not-a-live-query');
        void pending.then(() => {
          settled = true;
        });
        await drain();
        const current = request(fresh);
        expect(current.kind).toBe(kind);
        await ignoreRetired(retired, current, () => settled);

        const response: ResponseBody =
          kind === 'query'
            ? { kind: 'solutions', solutions: [] }
            : kind === 'proof'
              ? { kind: 'proof', steps: [] }
              : kind === 'consult'
                ? { kind: 'consulted' }
                : { kind: 'ack', accepted: false };
        fresh.receive({ ...response, id: current.id });
        expect(await pending).toEqual(kind === 'cancel' ? false : response);
      } finally {
        client.dispose();
      }
    },
  );

  it('B5 bounds a hung boot to one recreate and one typed error', async () => {
    const { client, workers, clock, worker } = harness();
    try {
      let settlements = 0;
      const booting = client.boot();
      void booting.then(() => {
        settlements++;
      });
      expect(workers).toHaveLength(1);
      expect(worker(0).seen).toMatchObject([{ kind: 'boot' }]);
      expect([...clock.armed.values()].map(({ ms }) => ms)).toEqual([30_000]);

      clock.fire();
      await drain();
      expect(workers).toHaveLength(2);
      expect(worker(0).terminated).toBe(true);
      expect(worker(1).seen).toMatchObject([{ kind: 'boot' }]);
      expect([...clock.armed.values()].map(({ ms }) => ms)).toEqual([30_000]);
      expect(settlements).toBe(0);

      clock.fire();
      expect(await booting).toMatchObject({ kind: 'error', error: { code: 'boot' } });
      await drain();
      expect(settlements).toBe(1);
      expect(workers).toHaveLength(2);
      expect(worker(1).terminated).toBe(true);
      expect(clock.armed.size).toBe(0);
    } finally {
      client.dispose();
    }
  });
});

describe('mnt-d21 retirement stays with the boot that failed', () => {
  /** Holds each boot until the test answers it, so a late error can land after a replacement. */
  class HeldWorker extends StubWorker {
    readonly held: EngineRequest[] = [];

    override postMessage(request: EngineRequest): void {
      this.seen.push(request);
      if (request.kind === 'boot') this.held.push(request);
    }

    answer(body: ResponseBody): void {
      const request = this.held.shift();
      if (request === undefined) throw new Error('no boot is held');
      this.receive({ ...body, id: request.id });
    }
  }

  it('F1 an interrupted boot never retires the worker a reset spawned', async () => {
    const spawned: StubWorker[] = [];
    const queue = [new HeldWorker(), new StubWorker({ kind: 'booted', contract: CONTRACT })];
    const client = new EngineClient({
      spawn: () => {
        const worker = queue.shift();
        if (worker === undefined) throw new Error('unexpected spawn');
        spawned.push(worker);
        return worker as unknown as Worker;
      },
    });
    try {
      const booting = client.boot();
      const [boot, reset] = await Promise.all([booting, client.reset('reset during boot')]);
      expect(boot).toMatchObject({ kind: 'error' });
      expect(reset).toEqual({ kind: 'booted', contract: CONTRACT });
      expect(spawned).toHaveLength(2);
      expect(spawned[1]?.terminated).toBe(false);
    } finally {
      client.dispose();
    }
  });

  it("F1 a boot's late error leaves a newer boot's worker alone", async () => {
    const first = new HeldWorker();
    const second = new HeldWorker();
    const queue = [first, second];
    const client = new EngineClient({
      spawn: () => {
        const worker = queue.shift();
        if (worker === undefined) throw new Error('unexpected spawn');
        return worker as unknown as Worker;
      },
    });
    try {
      const old = client.boot();
      // A reset retires the first worker and boots the second; its boot is still held.
      const resetting = client.reset('replace the first worker');
      expect(await old).toMatchObject({ kind: 'error' });
      // The first worker's own boot answer arrives late, after its replacement exists.
      first.answer({ kind: 'error', error: { code: 'boot', message: 'stale failure' } });
      await Promise.resolve();
      expect(second.terminated).toBe(false);
      second.answer({ kind: 'booted', contract: CONTRACT });
      expect(await resetting).toEqual({ kind: 'booted', contract: CONTRACT });
    } finally {
      client.dispose();
    }
  });
});
