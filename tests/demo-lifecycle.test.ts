import { describe, expect, it } from 'vitest';

import type { BootOutcome } from '../src/engine/client.js';
import type { BudgetSpec, EngineContract, PlSolution } from '../src/engine/protocol.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';

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
});
