import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient, type QueryOutcome } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import { AnswerService, type AnswerResult } from '../src/questions/service.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
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

/** Worker-shaped adapter: real EngineSession execution, asynchronous message delivery. */
class LiveWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  #listeners = new Map<string, ((event: unknown) => void)[]>();

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
          for (const listener of this.#listeners.get('message') ?? []) {
            listener({ data: response });
          }
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

const liveClient = (): { client: EngineClient; worker: LiveWorker } => {
  const worker = new LiveWorker();
  return {
    client: new EngineClient({ spawn: () => worker as unknown as Worker }),
    worker,
  };
};

describe('AbortSignal cancellation spike', () => {
  it('P2 cancels a live synthetic run through the hidden correlation id', async () => {
    const samples: { latencyMs: number; partial: number }[] = [];
    for (let trial = 0; trial < 10; trial += 1) {
      const { client, worker } = liveClient();
      const controller = new AbortController();
      const add = vi.spyOn(controller.signal, 'addEventListener');
      const remove = vi.spyOn(controller.signal, 'removeEventListener');
      const running = client.query(
        'between(1,100000000,X).',
        budget({ answerCap: BUDGET_MAX.answerCap }),
        controller.signal,
      );
      await delay(25);
      const abortedAt = performance.now();
      controller.abort();
      const outcome = await running;
      const latencyMs = performance.now() - abortedAt;

      expect(outcome.kind).toBe('cancelled');
      const partial = outcome.kind === 'cancelled' ? outcome.solutions.length : -1;
      expect(partial).toBeGreaterThan(0);
      const query = worker.seen.find((request) => request.kind === 'query');
      const cancels = worker.seen.filter((request) => request.kind === 'cancel');
      expect(cancels).toHaveLength(1);
      expect(cancels[0]).toMatchObject({ target: query?.id });
      expect(add).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
      samples.push({ latencyMs, partial });
      add.mockRestore();
      remove.mockRestore();
      client.dispose();
    }
    const latencies = samples.map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
    const medianMs = ((latencies[4] ?? 0) + (latencies[5] ?? 0)) / 2;
    const maxMs = latencies.at(-1) ?? 0;
    const partials = samples.map(({ partial }) => partial);
    console.info(
      `P2 trials=10 median_ms=${medianMs.toFixed(3)} max_ms=${maxMs.toFixed(3)} ` +
        `partial_min=${Math.min(...partials)} partial_max=${Math.max(...partials)}`,
    );
  }, 120_000);

  it('P3 removes the listener when completion wins, so a later abort is inert', async () => {
    const { client, worker } = liveClient();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const outcome = await client.query('between(1,2,X).', budget(), controller.signal);
      expect(outcome.kind).toBe('solutions');
      const requestsAtSettle = worker.seen.length;
      controller.abort();
      await delay();
      expect(worker.seen).toHaveLength(requestsAtSettle);
      expect(worker.seen.some((request) => request.kind === 'cancel')).toBe(false);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(unhandled).toHaveLength(0);
      console.info(`P3 requests_after_abort=${worker.seen.length - requestsAtSettle} unhandled=0`);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      remove.mockRestore();
      client.dispose();
    }
  }, 120_000);
});

class ScriptWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(response: EngineResponse): void {
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }
}

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

interface DeferredCall {
  goal: string;
  budget: BudgetSpec;
  signal: AbortSignal | undefined;
  resolve: (outcome: QueryOutcome) => void;
}

class DeferredClient {
  readonly calls: DeferredCall[] = [];

  query(goal: string, runBudget: BudgetSpec, signal?: AbortSignal): Promise<QueryOutcome> {
    return new Promise((resolve) => {
      this.calls.push({ goal, budget: runBudget, signal, resolve });
    });
  }
}

type ControllerState =
  | { kind: 'idle' }
  | { kind: 'running'; id: QuestionId }
  | { kind: 'cancelled'; id: QuestionId }
  | { kind: 'settled'; result: AnswerResult };

interface ActiveRun {
  id: QuestionId;
  controller: AbortController;
  done: Promise<void>;
}

/** Starts the visible replacement immediately, but serializes engine dispatch behind cleanup. */
class ProbeController {
  selected: QuestionId | undefined;
  state: ControllerState = { kind: 'idle' };
  readonly #service: AnswerService;
  readonly #budget: BudgetSpec;
  #active: ActiveRun | undefined;

  constructor(service: AnswerService, runBudget: BudgetSpec) {
    this.#service = service;
    this.#budget = runBudget;
  }

  select(id: QuestionId): void {
    this.selected = id;
  }

  run(): Promise<void> {
    const id = this.selected;
    if (id === undefined) throw new Error('select a question before running');
    const controller = new AbortController();
    const previous = this.#active;
    previous?.controller.abort();
    this.state = { kind: 'running', id };
    const done = (async () => {
      await previous?.done;
      if (controller.signal.aborted) return;
      const result = await this.#service.ask(id, this.#budget, controller.signal);
      if (this.#active?.controller === controller && !controller.signal.aborted) {
        this.state = { kind: 'settled', result };
      }
    })();
    this.#active = { id, controller, done };
    const clear = (): void => {
      if (this.#active?.controller === controller) this.#active = undefined;
    };
    void done.then(clear, clear);
    return done;
  }

  async cancel(): Promise<void> {
    const active = this.#active;
    if (active === undefined) return;
    active.controller.abort();
    this.state = { kind: 'cancelled', id: active.id };
    await active.done;
  }

  retry(): Promise<void> {
    return this.run();
  }
}

describe('controller and lifecycle probes', () => {
  it('P4 retires A immediately and waits for its cleanup before dispatching B', async () => {
    const deferred = new DeferredClient();
    const service = new AnswerService(deferred as unknown as EngineClient);
    const controller = new ProbeController(service, budget());
    controller.select('category-a-recommendations');
    const first = controller.run();
    await delay();
    expect(deferred.calls).toHaveLength(1);

    controller.select('dosage-reduction-content');
    const second = controller.run();
    expect(deferred.calls[0]?.signal?.aborted).toBe(true);
    expect(controller.state).toEqual({ kind: 'running', id: 'dosage-reduction-content' });
    expect(deferred.calls).toHaveLength(1);

    deferred.calls[0]?.resolve({ kind: 'solutions', solutions: [] });
    await first;
    await delay();
    expect(deferred.calls).toHaveLength(2);
    expect(controller.state).toEqual({ kind: 'running', id: 'dosage-reduction-content' });
    deferred.calls[1]?.resolve({ kind: 'failure' });
    await second;
    expect(controller.state).toMatchObject({
      kind: 'settled',
      result: { kind: 'failure', id: 'dosage-reduction-content' },
    });
    console.info('P4 stale=A ignored active=B engine_overlap=0');
  });

  it('P5 makes abort idempotent and treats an aborted signal as permanently cancelled', async () => {
    const { client, workers } = scriptedClient();
    const controller = new AbortController();
    const running = client.query('between(1,100000000,X).', budget(), controller.signal);
    const worker = workers[0];
    expect(worker).toBeDefined();
    controller.abort();
    controller.abort();
    const query = worker?.seen.find((request) => request.kind === 'query');
    const cancels = worker?.seen.filter((request) => request.kind === 'cancel') ?? [];
    expect(cancels).toHaveLength(1);
    if (query === undefined || cancels[0] === undefined) throw new Error('missing query or cancel');
    worker?.reply({ id: cancels[0].id, kind: 'ack', accepted: true });
    worker?.reply({ id: query.id, kind: 'cancelled', solutions: [] });
    expect(await running).toEqual({ kind: 'cancelled', solutions: [] });

    const requestsAtSettle = worker?.seen.length ?? 0;
    expect(await client.query('true.', budget(), controller.signal)).toEqual({
      kind: 'cancelled',
      solutions: [],
    });
    expect(worker?.seen).toHaveLength(requestsAtSettle);

    const fresh = scriptedClient();
    const service = new AnswerService(fresh.client);
    const answer = await service.ask('category-a-recommendations', budget(), controller.signal);
    expect(answer.kind).toBe('cancelled');
    expect(fresh.workers).toHaveLength(0);
    console.info('P5 double_abort_cancel_requests=1 reused_posts=0 fresh_spawns=0');
    client.dispose();
    fresh.client.dispose();
  });

  it('P6 hard reset settles each live caller once and detaches both signals', async () => {
    const { client, workers } = scriptedClient();
    const controls = [new AbortController(), new AbortController()];
    const settlements = [0, 0];
    const first = client.query('repeat.', budget(), controls[0]?.signal).then((outcome) => {
      settlements[0] = (settlements[0] ?? 0) + 1;
      return outcome;
    });
    const second = client.query('repeat.', budget(), controls[1]?.signal).then((outcome) => {
      settlements[1] = (settlements[1] ?? 0) + 1;
      return outcome;
    });
    const dead = workers[0];
    const deadQueries = dead?.seen.filter((request) => request.kind === 'query') ?? [];
    const violations: string[] = [];
    client.onProtocolViolation = (error) => violations.push(error.message);
    const resetting = client.reset('probe hard reset');
    expect(dead?.terminated).toBe(true);
    const replacement = workers[1];
    const boot = replacement?.seen.find((request) => request.kind === 'boot');
    if (boot === undefined) throw new Error('replacement boot was not posted');
    replacement?.reply({ id: boot.id, kind: 'booted', contract: manifest.contract });

    const outcomes = await Promise.all([first, second]);
    expect(await resetting).toMatchObject({ kind: 'booted' });
    for (const outcome of outcomes) {
      expect(outcome.kind).toBe('error');
      if (outcome.kind === 'error') expect(outcome.error.code).toBe('worker');
    }
    expect(settlements).toEqual([1, 1]);

    const replacementRequests = replacement?.seen.length ?? 0;
    controls[0]?.abort();
    controls[1]?.abort();
    for (const request of deadQueries) dead?.reply({ id: request.id, kind: 'failure' });
    await delay();
    expect(replacement?.seen).toHaveLength(replacementRequests);
    expect(settlements).toEqual([1, 1]);
    expect(violations).toHaveLength(0);
    console.info('P6 outcomes=worker_error settlements=1,1 late_claims=0 signal_posts=0');
    client.dispose();
  });

  it('P8 keeps the service id-only while all six real catalog ids execute', async () => {
    const { client, worker } = liveClient();
    const service = new AnswerService(client);
    const counts: string[] = [];
    for (const id of QUESTION_IDS) {
      const result = await service.ask(id, budget(), new AbortController().signal);
      expect(result.kind).toBe('answer');
      if (result.kind === 'answer') counts.push(`${id}:${result.solutions.length}`);
    }
    expect(worker.seen.filter((request) => request.kind === 'query')).toHaveLength(
      QUESTION_IDS.length,
    );

    const requestsAtValidSettle = worker.seen.length;
    for (const input of ['What should I do?', 'guideline_entity(X,Y,Z,W).', 'unknown-id']) {
      expect(await service.ask(input, budget(), new AbortController().signal)).toEqual({
        kind: 'rejected',
        reason: 'unknown-id',
      });
    }
    expect(worker.seen).toHaveLength(requestsAtValidSettle);
    console.info(`P8 live_counts=${counts.join(',')} invalid_engine_posts=0`);
    client.dispose();
  }, 120_000);

  it('P9 drives select, run, awaited cancel, and retry with a fresh controller', async () => {
    const deferred = new DeferredClient();
    const service = new AnswerService(deferred as unknown as EngineClient);
    const controller = new ProbeController(service, budget());
    controller.select('category-b-recommendations');
    const first = controller.run();
    await delay();
    const firstSignal = deferred.calls[0]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    const cancelling = controller.cancel();
    expect(firstSignal?.aborted).toBe(true);
    expect(controller.state).toEqual({
      kind: 'cancelled',
      id: 'category-b-recommendations',
    });
    deferred.calls[0]?.resolve({ kind: 'cancelled', solutions: [] });
    await Promise.all([first, cancelling]);

    const retried = controller.retry();
    await delay();
    const retrySignal = deferred.calls[1]?.signal;
    expect(retrySignal).not.toBe(firstSignal);
    expect(retrySignal?.aborted).toBe(false);
    deferred.calls[1]?.resolve({ kind: 'solutions', solutions: [] });
    await retried;
    expect(controller.state).toMatchObject({
      kind: 'settled',
      result: { kind: 'answer', id: 'category-b-recommendations' },
    });
    console.info('P9 controllers=2 cancel_awaited=true retry=answer stale_updates=0');
  });

  it('P10 demonstrates shared-signal fan-out across independent live callers', async () => {
    const { client, workers } = scriptedClient();
    const controller = new AbortController();
    const first = client.query('between(1,100000000,X).', budget(), controller.signal);
    const second = client.query('repeat.', budget(), controller.signal);
    const worker = workers[0];
    const queries = worker?.seen.filter((request) => request.kind === 'query') ?? [];
    expect(queries).toHaveLength(2);

    controller.abort();
    const cancels = worker?.seen.filter((request) => request.kind === 'cancel') ?? [];
    expect(cancels).toHaveLength(2);
    expect(new Set(cancels.map((request) => request.target))).toEqual(
      new Set(queries.map((request) => request.id)),
    );
    for (const request of cancels) {
      worker?.reply({ id: request.id, kind: 'ack', accepted: true });
    }
    for (const request of queries) {
      worker?.reply({ id: request.id, kind: 'cancelled', solutions: [] });
    }
    const outcomes = await Promise.all([first, second]);
    expect(outcomes).toEqual([
      { kind: 'cancelled', solutions: [] },
      { kind: 'cancelled', solutions: [] },
    ]);
    console.info('P10 shared_signals=1 independent_queries=2 cancel_targets=2 cancelled=2');
    client.dispose();
  });
});
