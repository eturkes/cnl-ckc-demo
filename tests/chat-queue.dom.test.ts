import { afterEach, describe, expect, it } from 'vitest';

import {
  CHAT_BUDGET,
  DEMO_BUDGET,
  DemoController,
  type DemoEngine,
} from '../src/demo/DemoController.svelte.js';
import type { BootOutcome, QueryOutcome } from '../src/engine/client.js';
import type { BudgetSpec, PlSolution, ProofInput, ProofOutcome } from '../src/engine/protocol.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

const CONTRACT = { schemaVersion: 1, documents: 337 };
const ID = QUESTION_IDS[0];
const GOAL = 'guideline_document(D,T,S).';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};
type Pending<T> = ReturnType<typeof deferred<T>>;
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const solution = (marker: string): PlSolution => ({
  bindings: { A: { kind: 'atom', value: `${marker}-binding` } },
  display: { A: `${marker}-display` },
});
const answer = (withProof = false): AnswerResult => ({
  kind: 'answer',
  id: ID,
  serialized: 'catalog-only',
  solutions: withProof ? [solution('catalog-0'), solution('catalog-1')] : [],
});
const chatOutcome = (): QueryOutcome => ({ kind: 'solutions', solutions: [solution('chat-only')] });

class QueueEngine implements DemoEngine {
  readonly bootResult = deferred<BootOutcome>();
  readonly asks: { id: unknown; pending: Pending<AnswerResult> }[] = [];
  readonly proofs: {
    input: ProofInput;
    signal: AbortSignal | undefined;
    pending: Pending<ProofOutcome>;
  }[] = [];
  readonly queries: {
    goal: string;
    budget: BudgetSpec;
    signal: AbortSignal | undefined;
    onSolution: ((solution: PlSolution) => void) | undefined;
    options: { readonly?: boolean } | undefined;
    pending: Pending<QueryOutcome>;
  }[] = [];
  readonly events: string[] = [];
  active = 0;
  peak = 0;

  boot(): Promise<BootOutcome> {
    return this.bootResult.promise;
  }
  private enter<T>(kind: string, pending: Pending<T>): Promise<T> {
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    this.events.push(`start:${kind}`);
    return pending.promise.finally(() => {
      this.active -= 1;
      this.events.push(`settled:${kind}`);
    });
  }
  ask(id: QuestionId): Promise<AnswerResult> {
    const pending = deferred<AnswerResult>();
    this.asks.push({ id, pending });
    return this.enter('ask', pending);
  }
  prove(input: ProofInput, _budget: BudgetSpec, signal?: AbortSignal): Promise<ProofOutcome> {
    const pending = deferred<ProofOutcome>();
    this.proofs.push({ input, signal, pending });
    return this.enter('proof', pending);
  }
  query(
    goal: string,
    budget: BudgetSpec,
    signal?: AbortSignal,
    onSolution?: (solution: PlSolution) => void,
    options?: { readonly?: boolean },
  ): Promise<QueryOutcome> {
    const pending = deferred<QueryOutcome>();
    this.queries.push({ goal, budget, signal, onSolution, options, pending });
    return this.enter('query', pending);
  }
  dispose(): void {}
}

const controllers: DemoController[] = [];
const create = (engine: DemoEngine): DemoController => {
  const controller = new DemoController(engine);
  controllers.push(controller);
  return controller;
};
const ready = async () => {
  const engine = new QueueEngine();
  const controller = create(engine);
  engine.bootResult.resolve({ kind: 'booted', contract: CONTRACT });
  await tick();
  controller.select(ID);
  expect(controller.state).toEqual({ kind: 'idle', contract: CONTRACT });
  return { engine, controller };
};
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

describe('chat shares the demo engine queue', () => {
  it('D7 CHAT_BUDGET changes only the answer cap to 50 and dispatches read-only with the same signal', async () => {
    expect(CHAT_BUDGET).toEqual({ ...DEMO_BUDGET, answerCap: 50 });
    const { engine, controller } = await ready();
    const abort = new AbortController();
    const before = controller.state;
    const provenance = controller.provenance;
    const result = controller.runGoal(GOAL, abort.signal);
    expect(result).toBeInstanceOf(Promise);
    await tick();
    expect(engine.queries).toHaveLength(1);
    expect(engine.queries[0]).toMatchObject({
      goal: GOAL,
      budget: CHAT_BUDGET,
      signal: abort.signal,
      options: { readonly: true },
    });
    expect(engine.queries[0]?.onSolution).toBeUndefined();
    const outcome = chatOutcome();
    engine.queries[0]!.pending.resolve(outcome);
    expect(await result).toBe(outcome);
    expect(controller.state).toEqual(before);
    expect(controller.provenance).toEqual(provenance);
  });

  it('D7 no ready engine yields undefined without a query before boot, after boot failure or disposal', async () => {
    const engine = new QueueEngine();
    const controller = create(engine);
    const signal = new AbortController().signal;
    expect(controller.runGoal(GOAL, signal)).toBeUndefined();
    engine.bootResult.resolve({ kind: 'error', error: { code: 'boot', message: 'boot refused' } });
    await tick();
    expect(controller.runGoal(GOAL, signal)).toBeUndefined();
    controller.dispose();
    expect(controller.runGoal(GOAL, signal)).toBeUndefined();
    expect(engine.queries).toHaveLength(0);
  });

  it.each(['fulfilled', 'rejected'] as const)(
    'D7 chat waits for a %s catalog run and cannot overwrite its state',
    async (settlement) => {
      const { engine, controller } = await ready();
      const catalog = controller.run();
      const chat = controller.runGoal(GOAL, new AbortController().signal);
      await tick();
      expect(engine.asks).toHaveLength(1);
      expect(engine.queries).toHaveLength(0);
      if (settlement === 'fulfilled') engine.asks[0]!.pending.resolve(answer());
      else engine.asks[0]!.pending.reject(new Error('catalog failed'));
      await catalog;
      await tick();
      expect(engine.queries).toHaveLength(1);
      const state = controller.state;
      const provenance = controller.provenance;
      engine.queries[0]!.pending.resolve(chatOutcome());
      await chat;
      expect(controller.state).toEqual(state);
      expect(controller.provenance).toEqual(provenance);
      expect(engine.events).toEqual(['start:ask', 'settled:ask', 'start:query', 'settled:query']);
      expect(engine.peak).toBe(1);
    },
  );

  it.each(['fulfilled', 'rejected'] as const)(
    'D7 chat waits for a %s selected-solution proof and keeps that proof state',
    async (settlement) => {
      const { engine, controller } = await ready();
      const catalog = controller.run();
      engine.asks[0]!.pending.resolve(answer(true));
      await catalog;
      await tick();
      expect(engine.proofs).toHaveLength(1);
      const chat = controller.runGoal(GOAL, new AbortController().signal);
      await tick();
      expect(engine.queries).toHaveLength(0);
      if (settlement === 'fulfilled')
        engine.proofs[0]!.pending.resolve({ kind: 'proof', steps: [] });
      else engine.proofs[0]!.pending.reject(new Error('proof failed'));
      await tick();
      expect(engine.queries).toHaveLength(1);
      const state = controller.state;
      const provenance = controller.provenance;
      engine.queries[0]!.pending.resolve(chatOutcome());
      await chat;
      expect(controller.state).toEqual(state);
      expect(controller.provenance).toEqual(provenance);
      expect(engine.events).toEqual([
        'start:ask',
        'settled:ask',
        'start:proof',
        'settled:proof',
        'start:query',
        'settled:query',
      ]);
      expect(engine.peak).toBe(1);
    },
  );

  it.each(['fulfilled', 'rejected'] as const)(
    'D7 catalog waits for a %s chat goal and receives only its own answer',
    async (settlement) => {
      const { engine, controller } = await ready();
      const chat = controller.runGoal(GOAL, new AbortController().signal)!;
      const observed = chat.catch(() => undefined);
      await tick();
      expect(engine.queries).toHaveLength(1);
      const catalog = controller.run();
      await tick();
      expect(engine.asks).toHaveLength(0);
      if (settlement === 'fulfilled') engine.queries[0]!.pending.resolve(chatOutcome());
      else engine.queries[0]!.pending.reject(new Error('chat failed'));
      await observed;
      await tick();
      expect(engine.asks).toHaveLength(1);
      expect(controller.state).toEqual({ kind: 'running', id: ID });
      const own = answer();
      engine.asks[0]!.pending.resolve(own);
      await catalog;
      expect(controller.state).toEqual({ kind: 'settled', id: ID, result: own });
      expect(engine.events).toEqual(['start:query', 'settled:query', 'start:ask', 'settled:ask']);
      expect(engine.peak).toBe(1);
    },
  );
});
