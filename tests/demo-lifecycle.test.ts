import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import manifest from '@kb/kb-manifest.json';
import { describe, expect, it, vi } from 'vitest';

import type { BootOutcome } from '../src/engine/client.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineRequest,
  EngineResponse,
  PlSolution,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine } from '../src/engine/session.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';
import {
  createDemoEngine,
  DEMO_BUDGET,
  DemoController,
  type DemoEngine,
} from '../src/demo/DemoController.svelte.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};

interface AskCall {
  id: unknown;
  budget: BudgetSpec;
  signal: AbortSignal | undefined;
  outcome: Deferred<AnswerResult>;
}

class ScriptedEngine implements DemoEngine {
  readonly bootOutcome = deferred<BootOutcome>();
  readonly asks: AskCall[] = [];
  bootCalls = 0;
  disposeCalls = 0;
  concurrentAsks = 0;
  maxConcurrentAsks = 0;

  boot(): Promise<BootOutcome> {
    this.bootCalls += 1;
    return this.bootOutcome.promise;
  }

  ask(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult> {
    const outcome = deferred<AnswerResult>();
    this.concurrentAsks += 1;
    this.maxConcurrentAsks = Math.max(this.maxConcurrentAsks, this.concurrentAsks);
    this.asks.push({ id, budget, signal, outcome });
    return outcome.promise.finally(() => {
      this.concurrentAsks -= 1;
    });
  }

  dispose(): void {
    this.disposeCalls += 1;
  }
}

const drain = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

const readyController = async (): Promise<{
  controller: DemoController;
  engine: ScriptedEngine;
}> => {
  const engine = new ScriptedEngine();
  const controller = new DemoController(engine);
  engine.bootOutcome.resolve({ kind: 'booted', contract: CONTRACT });
  await drain();
  expect(controller.state).toEqual({ kind: 'idle', contract: CONTRACT });
  return { controller, engine };
};

const solutions = (count: number, prefix = 'engine'): PlSolution[] =>
  Array.from({ length: count }, (_, index) => ({
    bindings: { A: { kind: 'atom', value: `${prefix}-binding-${String(index)}` } },
    display: { A: `${prefix}-display-${String(index)}` },
  }));

const answer = (id: QuestionId, count = 1, prefix = 'engine'): AnswerResult => ({
  kind: 'answer',
  id,
  serialized: `${prefix}-serialized`,
  solutions: solutions(count, prefix),
});

const cancelled = (id: QuestionId): AnswerResult => ({
  kind: 'cancelled',
  id,
  serialized: 'cancelled-serialized',
  solutions: [],
});

const askAt = (engine: ScriptedEngine, index: number): AskCall => {
  const call = engine.asks[index];
  if (call === undefined) throw new Error(`missing scripted ask ${String(index)}`);
  return call;
};

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IMAGE = new Uint8Array(readFileSync(join(ROOT, 'kb', 'generated', 'kb.pvm')));

/** Actual PVM behind the browser Worker protocol, without replacing the engine with a fixture. */
class RealPvmWorker {
  readonly #diagnostics: string[] = [];
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();
  readonly #session = new EngineSession({
    loadImage: this.#loadImage.bind(this),
    drain: () => this.#diagnostics.splice(0),
    expected: manifest.contract,
  });
  #terminated = false;

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    if (request.kind === 'cancel') {
      this.#emit({
        id: request.id,
        kind: 'ack',
        accepted: this.#session.requestCancel(request.target),
      });
      return;
    }
    void this.#session
      .handle(request, IMAGE)
      .then((response) => this.#emit(response))
      .catch((cause: unknown) => {
        this.#emit({
          id: request.id,
          kind: 'error',
          error: {
            code: 'boot',
            message: cause instanceof Error ? cause.message : String(cause),
          },
        });
      });
  }

  terminate(): void {
    this.#terminated = true;
  }

  async #loadImage(image: Uint8Array): Promise<Engine> {
    const factory = require('swipl-wasm/dist/loadImageDefault.js') as
      | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
      | {
          default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
        };
    const load = typeof factory === 'function' ? factory : factory.default;
    return load(image)({ printErr: (line: string) => this.#diagnostics.push(line) });
  }

  #emit(response: EngineResponse): void {
    if (this.#terminated) return;
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }
}

describe('run lifecycle', () => {
  it('R1 boots one injected engine once and stores a typed boot failure', async () => {
    const engine = new ScriptedEngine();
    const controller = new DemoController(engine);
    const error = { code: 'boot' as const, message: 'probe boot failure' };

    expect(controller.state).toEqual({ kind: 'booting' });
    expect(engine.bootCalls).toBe(1);
    engine.bootOutcome.resolve({ kind: 'error', error });
    await drain();

    expect(controller.state).toEqual({ kind: 'boot-error', error });
    expect(engine.bootCalls).toBe(1);
  });

  it('R2 records selection without running, and Q2 ignores run while booting', async () => {
    const engine = new ScriptedEngine();
    const controller = new DemoController(engine);
    const id = QUESTION_IDS[0];

    controller.select(id);
    const before = controller.state;
    await controller.run();

    expect(controller.selected).toBe(id);
    expect(controller.state).toBe(before);
    expect(engine.asks).toHaveLength(0);
  });

  it('R3 enters running synchronously and settles with the exact AnswerResult', async () => {
    const { controller, engine } = await readyController();
    const id = QUESTION_IDS[0];
    const result = answer(id);
    controller.select(id);

    const run = controller.run();
    expect(controller.state).toEqual({ kind: 'running', id });
    expect(engine.asks).toHaveLength(1);

    askAt(engine, 0).outcome.resolve(result);
    await run;
    expect(controller.state).toEqual({ kind: 'settled', id, result });
    if (controller.state.kind !== 'settled') throw new Error('run did not settle');
    expect(controller.state.result).toBe(result);
  });

  it('R4 replaces visibly, aborts first, then starts with zero ask overlap', async () => {
    const { controller, engine } = await readyController();
    const firstId = QUESTION_IDS[0];
    const secondId = QUESTION_IDS[1];
    controller.select(firstId);
    const firstRun = controller.run();
    const first = askAt(engine, 0);

    controller.select(secondId);
    const secondRun = controller.run();
    expect(controller.state).toEqual({ kind: 'running', id: secondId });
    expect(first.signal?.aborted).toBe(true);
    expect(engine.asks).toHaveLength(1);
    expect(engine.concurrentAsks).toBe(1);

    first.outcome.resolve(cancelled(firstId));
    await drain();
    expect(engine.asks).toHaveLength(2);
    expect(askAt(engine, 1).id).toBe(secondId);
    expect(engine.maxConcurrentAsks).toBe(1);

    askAt(engine, 1).outcome.resolve(answer(secondId));
    await Promise.all([firstRun, secondRun]);
    expect(controller.state).toMatchObject({ kind: 'settled', id: secondId });
  });

  it('R5 ignores an aborted predecessor result while the replacement is active', async () => {
    const { controller, engine } = await readyController();
    const firstId = QUESTION_IDS[0];
    const secondId = QUESTION_IDS[1];
    controller.select(firstId);
    const firstRun = controller.run();
    controller.select(secondId);
    const secondRun = controller.run();

    askAt(engine, 0).outcome.resolve(answer(firstId, 1, 'retired'));
    await drain();
    expect(controller.state).toEqual({ kind: 'running', id: secondId });

    const active = answer(secondId, 1, 'active');
    askAt(engine, 1).outcome.resolve(active);
    await Promise.all([firstRun, secondRun]);
    expect(controller.state).toEqual({ kind: 'settled', id: secondId, result: active });
  });

  it('ADV1 Q3 illegal calls preserve a legal state instead of throwing', async () => {
    const { controller, engine } = await readyController();
    const idle = controller.state;

    await controller.run();
    await controller.cancel();
    await controller.retry();
    controller.selectSolution(-5);
    controller.selectSolution(1e9);

    expect(controller.state).toBe(idle);
    expect(controller.selected).toBeNull();
    expect(controller.solutionIndex).toBe(-1);
    expect(engine.asks).toHaveLength(0);
  });

  it('R6 cancel enters cancelling, aborts, and awaits the active settlement', async () => {
    const { controller, engine } = await readyController();
    const id = QUESTION_IDS[0];
    controller.select(id);
    const run = controller.run();
    const active = askAt(engine, 0);
    let cancelSettled = false;

    const cancel = controller.cancel().then(() => {
      cancelSettled = true;
    });
    expect(controller.state).toEqual({ kind: 'cancelling', id });
    expect(active.signal?.aborted).toBe(true);
    await drain();
    expect(cancelSettled).toBe(false);

    const result = { ...cancelled(id), solutions: solutions(2, 'partial') };
    active.outcome.resolve(result);
    await Promise.all([run, cancel]);
    expect(cancelSettled).toBe(true);
    expect(controller.state).toEqual({ kind: 'settled', id, result });
  });

  it('R7 retry uses the settled id and a fresh signal after selection changes', async () => {
    const { controller, engine } = await readyController();
    const runId = QUESTION_IDS[0];
    controller.select(runId);
    const firstRun = controller.run();
    const first = askAt(engine, 0);
    const cancel = controller.cancel();
    first.outcome.resolve(cancelled(runId));
    await Promise.all([firstRun, cancel]);
    expect(first.signal?.aborted).toBe(true);

    controller.select(QUESTION_IDS[1]);
    const retry = controller.retry();
    const second = askAt(engine, 1);
    expect(controller.state).toEqual({ kind: 'running', id: runId });
    expect(second.id).toBe(runId);
    expect(second.signal).not.toBe(first.signal);
    expect(second.signal?.aborted).toBe(false);

    second.outcome.resolve(answer(runId));
    await retry;
    expect(controller.state).toMatchObject({ kind: 'settled', id: runId });
  });

  it('R8 dispose aborts and disposes once, then suppresses the late state write', async () => {
    const { controller, engine } = await readyController();
    const id = QUESTION_IDS[0];
    controller.select(id);
    const run = controller.run();
    const active = askAt(engine, 0);
    const before = controller.state;

    controller.dispose();
    expect(active.signal?.aborted).toBe(true);
    expect(engine.disposeCalls).toBe(1);
    expect(controller.state).toBe(before);

    active.outcome.resolve(answer(id, 1, 'after-dispose'));
    await run;
    expect(controller.state).toBe(before);
  });

  it('R9 freezes one demo budget and exposes no goal or consult escape hatch', async () => {
    expect(Object.isFrozen(DEMO_BUDGET)).toBe(true);
    expect(DEMO_BUDGET.wallClockMs).toBe(5000);
    const { controller, engine } = await readyController();
    controller.select(QUESTION_IDS[0]);
    const run = controller.run();

    expect(askAt(engine, 0).budget).toBe(DEMO_BUDGET);
    expect('goal' in controller).toBe(false);
    expect('consult' in controller).toBe(false);

    askAt(engine, 0).outcome.resolve(answer(QUESTION_IDS[0]));
    await run;
  });

  it('R10 returns every selected clinical recommendation through createDemoEngine', async () => {
    vi.stubGlobal('Worker', RealPvmWorker);
    const engine = createDemoEngine();
    try {
      expect(await engine.boot()).toEqual({ kind: 'booted', contract: manifest.contract });
      const counts: number[] = [];
      for (const id of QUESTION_IDS) {
        const result = await engine.ask(id, DEMO_BUDGET);
        expect(result.kind, id).toBe('answer');
        if (result.kind !== 'answer') throw new Error(`${id}: ${result.kind}`);
        counts.push(result.solutions.length);
      }
      expect(counts).toEqual([2, 2, 1, 1, 4, 1, 1]);
    } finally {
      engine.dispose();
      vi.unstubAllGlobals();
    }
  }, 120_000);
});
