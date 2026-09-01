// Alternative-A probes: an EngineClient run handle carries correlation, settlement,
// and its bound cooperative cancel without exposing a goal through AnswerService.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient, type QueryOutcome, type QueryRun } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import { AnswerService, type AnswerResult, type AnswerRun } from '../src/questions/service.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({});
};

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: BUDGET_MAX.answerCap,
  ...overrides,
});

/** Worker-shaped adapter: protocol/client are real, and every query step runs in the real WASM engine. */
class SessionWorker {
  readonly #session: EngineSession;
  readonly #image: Uint8Array;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();
  #terminated = false;

  constructor(session: EngineSession, bytes: Uint8Array) {
    this.#session = session;
    this.#image = bytes;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    if (this.#terminated) throw new Error('worker is terminated');
    if (request.kind === 'cancel') {
      this.#reply({
        id: request.id,
        kind: 'ack',
        accepted: this.#session.requestCancel(request.target),
      });
      return;
    }
    void this.#session.handle(request, this.#image).then((response) => this.#reply(response));
  }

  terminate(): void {
    this.#terminated = true;
  }

  #reply(response: EngineResponse): void {
    if (this.#terminated) return;
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }
}

class ControlledWorker {
  static live: ControlledWorker[] = [];
  readonly seen: EngineRequest[] = [];
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();
  terminated = false;

  constructor() {
    ControlledWorker.live.push(this);
  }

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

interface DeferredQuery {
  goal: string;
  budget: BudgetSpec;
  run: QueryRun;
  resolve: (outcome: QueryOutcome) => void;
  readonly cancelCalls: number;
}

class DeferredClient {
  readonly queries: DeferredQuery[] = [];

  query(goal: string, spec: BudgetSpec): QueryRun {
    let resolve!: (outcome: QueryOutcome) => void;
    let cancelCalls = 0;
    const result = new Promise<QueryOutcome>((settleResult) => {
      resolve = settleResult;
    });
    const run: QueryRun = {
      requestId: `deferred-${this.queries.length + 1}`,
      result,
      cancel: () => {
        cancelCalls += 1;
        return Promise.resolve(true);
      },
    };
    this.queries.push({
      goal,
      budget: spec,
      run,
      resolve,
      get cancelCalls() {
        return cancelCalls;
      },
    });
    return run;
  }
}

class LatestRunController {
  readonly #service: AnswerService;
  #selected: QuestionId | null = null;
  #active: AnswerRun | null = null;
  answer: AnswerResult | null = null;

  constructor(service: AnswerService) {
    this.#service = service;
  }

  select(id: QuestionId): void {
    this.#selected = id;
    this.answer = null;
  }

  run(): AnswerRun {
    if (this.#selected === null) throw new Error('select a question first');
    const run = this.#service.ask(this.#selected, budget());
    this.#active = run;
    this.answer = null;
    void run.result.then((answer) => {
      if (this.#active !== run) return;
      this.answer = answer;
    });
    return run;
  }

  start(id: QuestionId): AnswerRun {
    this.select(id);
    return this.run();
  }

  cancel(): Promise<boolean> {
    return this.#active?.cancel() ?? Promise.resolve(false);
  }

  retry(): AnswerRun {
    return this.run();
  }
}

const controlledClient = (): EngineClient => {
  ControlledWorker.live = [];
  return new EngineClient({ spawn: () => new ControlledWorker() as unknown as Worker });
};

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const session = new EngineSession({ loadImage, expected: manifest.contract });
const client = new EngineClient({
  spawn: () => new SessionWorker(session, image) as unknown as Worker,
});

beforeAll(async () => {
  expect((await client.boot()).kind).toBe('booted');
}, 120_000);

afterAll(() => {
  client.dispose();
});

describe.sequential('run handle', () => {
  it('P2 cancels a live synthetic goal through its bound handle', async () => {
    const run = client.query('between(1,100000000,X).', budget());
    await new Promise((resolve) => setTimeout(resolve, 10));
    const started = performance.now();
    const [accepted, outcome] = await Promise.all([run.cancel(), run.result]);
    const cancelLatencyMs = performance.now() - started;

    expect(accepted).toBe(true);
    expect(outcome.kind).toBe('cancelled');
    if (outcome.kind !== 'cancelled') return;
    expect(outcome.solutions.length).toBeGreaterThan(0);
    console.info(
      `P2_METRIC request=${run.requestId} outcome=${outcome.kind} partial=${outcome.solutions.length} cancel_ms=${cancelLatencyMs.toFixed(3)}`,
    );
  });

  it('P3 reports cancel-after-settle as false without an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const run = client.query('true.', budget());
      expect((await run.result).kind).toBe('solutions');
      expect(await run.cancel()).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toHaveLength(0);
      console.info(
        `P3_METRIC request=${run.requestId} accepted=false unhandled=${unhandled.length}`,
      );
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('P4 ignores A when it settles after the active B run', async () => {
    const firstId = QUESTION_IDS.at(0);
    const secondId = QUESTION_IDS.at(1);
    if (firstId === undefined || secondId === undefined) throw new Error('catalog needs two ids');
    const deferred = new DeferredClient();
    const controller = new LatestRunController(
      new AnswerService(deferred as unknown as EngineClient),
    );
    const first = controller.start(firstId);
    const second = controller.start(secondId);

    deferred.queries[1]?.resolve({ kind: 'failure' });
    await second.result;
    await settle();
    deferred.queries[0]?.resolve({ kind: 'failure' });
    await first.result;
    await settle();

    expect(controller.answer).toMatchObject({ kind: 'failure', id: secondId });
    const finalId =
      controller.answer !== null && 'id' in controller.answer ? controller.answer.id : null;
    console.info(
      `P4_METRIC first=${first.requestId} second=${second.requestId} final=${finalId} retired_ignored=true`,
    );
  });

  it('P5 memoizes double cancel issued before the scripted worker starts the run', async () => {
    const probe = controlledClient();
    const run = probe.query('repeat.', budget());
    const firstCancel = run.cancel();
    const secondCancel = run.cancel();
    const worker = ControlledWorker.live[0];
    const cancelRequests = worker?.seen.filter((request) => request.kind === 'cancel') ?? [];
    const cancelRequest = cancelRequests[0];
    if (cancelRequest?.kind !== 'cancel') throw new Error('cancel request missing');

    expect(firstCancel).toBe(secondCancel);
    expect(cancelRequests).toHaveLength(1);
    expect(worker?.seen[0]?.kind).toBe('query');
    expect(cancelRequest.target).toBe(run.requestId);
    worker?.reply({ id: cancelRequest.id, kind: 'ack', accepted: true });
    worker?.reply({ id: run.requestId, kind: 'cancelled', solutions: [] });

    expect(await firstCancel).toBe(true);
    expect(await secondCancel).toBe(true);
    expect((await run.result).kind).toBe('cancelled');
    console.info(
      `P5_METRIC request=${run.requestId} cancel_posts=${cancelRequests.length} same_promise=${String(firstCancel === secondCancel)} accepted=true`,
    );
    probe.dispose();
  });

  it('P6 hard reset settles the live result and cancel caller exactly once', async () => {
    const probe = controlledClient();
    const run = probe.query('repeat.', budget());
    let resultSettles = 0;
    let cancelSettles = 0;
    const result = run.result.then((outcome) => {
      resultSettles += 1;
      return outcome;
    });
    const cancelling = run.cancel().then((accepted) => {
      cancelSettles += 1;
      return accepted;
    });
    const retired = ControlledWorker.live[0];
    const cancelRequest = retired?.seen.find((request) => request.kind === 'cancel');

    const resetting = probe.reset('P6 hard reset');
    const replacement = ControlledWorker.live[1];
    const bootRequest = replacement?.seen[0];
    if (replacement === undefined || bootRequest?.kind !== 'boot') {
      throw new Error('replacement boot missing');
    }
    replacement.reply({ id: bootRequest.id, kind: 'booted', contract: manifest.contract });

    const [outcome, accepted, reboot] = await Promise.all([result, cancelling, resetting]);
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') expect(outcome.error.code).toBe('worker');
    expect(accepted).toBe(false);
    expect(reboot.kind).toBe('booted');
    expect(resultSettles).toBe(1);
    expect(cancelSettles).toBe(1);

    retired?.reply({ id: run.requestId, kind: 'failure' });
    if (cancelRequest?.kind === 'cancel') {
      retired?.reply({ id: cancelRequest.id, kind: 'ack', accepted: true });
    }
    await settle();
    expect(resultSettles).toBe(1);
    expect(cancelSettles).toBe(1);
    console.info(
      `P6_METRIC result=error:worker cancel=false reboot=booted result_settles=${resultSettles} cancel_settles=${cancelSettles}`,
    );
    probe.dispose();
  });

  it('P8 keeps all six service runs id-only and leaves rejected text outside the client', async () => {
    const deferred = new DeferredClient();
    const service = new AnswerService(deferred as unknown as EngineClient);
    const runs = QUESTION_IDS.map((id) => service.ask(id, budget()));
    const rejected = [
      service.ask('not-a-question', budget()),
      service.ask('guideline_entity(actual,A,recommendation,countable).', budget()),
    ];

    expect(deferred.queries).toHaveLength(QUESTION_IDS.length);
    expect(deferred.queries.map((query) => query.goal)).toEqual(
      QUESTION_IDS.map((id) => QUESTION_CATALOG[id].goal),
    );
    for (const run of runs) {
      expect(Object.keys(run).sort()).toEqual(['cancel', 'requestId', 'result']);
      expect('goal' in run).toBe(false);
      expect('consult' in run).toBe(false);
    }
    expect(await Promise.all(runs.map((run) => run.cancel()))).toEqual(
      QUESTION_IDS.map(() => true),
    );
    expect(deferred.queries.every((query) => query.cancelCalls === 1)).toBe(true);
    for (const query of deferred.queries) query.resolve({ kind: 'failure' });
    expect((await Promise.all(runs.map((run) => run.result))).map((answer) => answer.kind)).toEqual(
      QUESTION_IDS.map(() => 'failure'),
    );

    for (const run of rejected) {
      expect(run.requestId).toBeNull();
      expect(await run.cancel()).toBe(false);
      expect(await run.result).toEqual({ kind: 'rejected', reason: 'unknown-id' });
    }
    expect(deferred.queries).toHaveLength(QUESTION_IDS.length);
    console.info(
      `P8_METRIC catalog=${QUESTION_IDS.length} engine_queries=${deferred.queries.length} rejected=${rejected.length} raw_goal_exposed=false consult_exposed=false`,
    );
  });

  it('P9 drives select, run, cancel and retry without reaching EngineClient', async () => {
    const selected = QUESTION_IDS.at(0);
    if (selected === undefined) throw new Error('catalog is empty');
    const deferred = new DeferredClient();
    const controller = new LatestRunController(
      new AnswerService(deferred as unknown as EngineClient),
    );

    controller.select(selected);
    const first = controller.run();
    const cancelling = controller.cancel();
    deferred.queries[0]?.resolve({ kind: 'cancelled', solutions: [] });
    expect(await cancelling).toBe(true);
    expect((await first.result).kind).toBe('cancelled');
    await settle();

    const retry = controller.retry();
    expect(retry.requestId).not.toBe(first.requestId);
    expect(controller.answer).toBeNull();
    deferred.queries[1]?.resolve({ kind: 'failure' });
    expect((await retry.result).kind).toBe('failure');
    await settle();
    expect(controller.answer).toMatchObject({ kind: 'failure', id: selected });
    console.info(
      `P9_METRIC selected=${selected} first=${first.requestId} cancel=true retry=${retry.requestId} final=failure`,
    );
  });
});
