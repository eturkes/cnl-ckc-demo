// ann-u1 M12: deterministic queue, abort and stale-completion probes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoController, DEMO_BUDGET, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { EngineClient, QueryOutcome, BootOutcome } from '../src/engine/client.js';
import type { BudgetSpec, ProofInput, ProofOutcome } from '../src/engine/protocol.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import { AnswerService, type AnswerResult, type MarksOutcome } from '../src/questions/service.js';
import { answerSolution } from './support/marks-terms.js';

const ID = QUESTION_IDS[0];
const GOAL = `clinical_marks('${ID}',Source,Marks)`;
const CONTRACT = { schemaVersion: 1, documents: 385 };
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: Error): void;
}
const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
};
const answer = (): AnswerResult => ({
  kind: 'answer',
  id: ID,
  serialized: 'solutions',
  solutions: [answerSolution('a'), answerSolution('b')],
});
interface Call<T> {
  signal: AbortSignal | undefined;
  budget: BudgetSpec;
  result: Deferred<T>;
}
class DeferredEngine implements DemoEngine {
  readonly order: string[] = [];
  readonly asks: Call<AnswerResult>[] = [];
  readonly markCalls: (Call<MarksOutcome> & { id: unknown })[] = [];
  readonly proofs: (Call<ProofOutcome> & { input: ProofInput })[] = [];
  readonly chats: Call<QueryOutcome>[] = [];
  nextAnswer: AnswerResult | undefined = answer();
  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: CONTRACT });
  }
  ask(_id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult> {
    this.order.push('ask');
    const result = deferred<AnswerResult>();
    this.asks.push({ budget, signal, result });
    if (this.nextAnswer !== undefined) result.resolve(this.nextAnswer);
    return result.promise;
  }
  marks(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<MarksOutcome> {
    this.order.push('marks');
    const result = deferred<MarksOutcome>();
    this.markCalls.push({ id, budget, signal, result });
    return result.promise;
  }
  prove(input: ProofInput, budget: BudgetSpec, signal?: AbortSignal): Promise<ProofOutcome> {
    this.order.push('proof');
    const result = deferred<ProofOutcome>();
    this.proofs.push({ input, budget, signal, result });
    return result.promise;
  }
  runGoal(_goal: string, budget: BudgetSpec, signal?: AbortSignal): Promise<QueryOutcome> {
    this.order.push('chat');
    const result = deferred<QueryOutcome>();
    this.chats.push({ budget, signal, result });
    return result.promise;
  }
  dispose(): void {}
}
let controller: DemoController | undefined;
afterEach(() => {
  controller?.dispose();
  controller = undefined;
});
const boot = async (engine: DemoEngine): Promise<DemoController> => {
  controller = new DemoController(engine);
  await tick();
  controller.select(ID);
  return controller;
};
const run = async (engine: DemoEngine): Promise<DemoController> => {
  const created = await boot(engine);
  await created.run();
  await tick();
  return created;
};

describe('marks lifecycle', () => {
  it('M12 starts marks under DEMO_BUDGET before trace and releases trace only after marks settle', async () => {
    const engine = new DeferredEngine();
    const created = await run(engine);
    expect(engine.order).toEqual(['ask', 'marks']);
    expect(engine.markCalls[0]).toMatchObject({ id: ID, budget: DEMO_BUDGET });
    expect(engine.markCalls[0]?.signal?.aborted).toBe(false);
    expect(created.marks).toEqual({ kind: 'loading', id: ID, goal: GOAL });
    const outcome: MarksOutcome = { kind: 'solutions', solutions: [] };
    engine.markCalls[0]?.result.resolve(outcome);
    await tick();
    expect(created.marks).toEqual({ kind: 'settled', id: ID, goal: GOAL, outcome });
    expect(engine.order).toEqual(['ask', 'marks', 'proof']);
  });
  it('M12 new run resets marks, aborts the previous request and ignores its late outcome', async () => {
    const engine = new DeferredEngine();
    const created = await run(engine);
    expect(engine.markCalls).toHaveLength(1);
    const first = engine.markCalls[0];
    engine.nextAnswer = undefined;
    const next = created.run();
    expect(created.marks).toEqual({ kind: 'idle' });
    expect(first?.signal?.aborted).toBe(true);
    expect(engine.asks).toHaveLength(1);
    first?.result.resolve({ kind: 'error', error: { code: 'prolog', message: 'retired' } });
    await tick();
    expect(created.marks).toEqual({ kind: 'idle' });
    expect(engine.markCalls).toHaveLength(1);
    engine.asks[1]?.result.resolve(answer());
    await next;
    await tick();
    expect(engine.markCalls).toHaveLength(2);
    expect(created.marks).toEqual({ kind: 'loading', id: ID, goal: GOAL });
  });
  it('M12 dispose aborts marks and prevents a late settlement', async () => {
    const engine = new DeferredEngine();
    const created = await run(engine);
    expect(engine.markCalls).toHaveLength(1);
    const before = created.marks;
    created.dispose();
    expect(engine.markCalls[0]?.signal?.aborted).toBe(true);
    engine.markCalls[0]?.result.resolve({ kind: 'solutions', solutions: [] });
    await tick();
    expect(created.marks).toEqual(before);
    expect(engine.proofs).toHaveLength(0);
  });
  it('M12 an aborted queued marks request never reaches the engine', async () => {
    const engine = new DeferredEngine();
    engine.nextAnswer = undefined;
    const created = await boot(engine);
    const first = created.run();
    const chat = created.runGoal('true');
    engine.asks[0]?.result.resolve(answer());
    await first;
    await tick();
    expect(engine.order).toEqual(['ask', 'chat']);
    expect(created.marks).toEqual({ kind: 'loading', id: ID, goal: GOAL });
    const second = created.run();
    expect(created.marks).toEqual({ kind: 'idle' });
    engine.chats[0]?.result.resolve({ kind: 'failure' });
    await chat;
    await tick();
    expect(engine.markCalls).toHaveLength(0);
    expect(engine.proofs).toHaveLength(0);
    engine.asks[1]?.result.resolve({ kind: 'failure', id: ID, serialized: 'none' });
    await second;
    expect(created.marks).toEqual({ kind: 'idle' });
  });
  it('M12 a rejected marks promise settles error and the trace still runs', async () => {
    const engine = new DeferredEngine();
    const created = await run(engine);
    expect(engine.markCalls).toHaveLength(1);
    engine.markCalls[0]?.result.reject(new Error('marks exploded'));
    await tick();
    expect(created.marks).toMatchObject({
      kind: 'settled',
      id: ID,
      goal: GOAL,
      outcome: { kind: 'error', error: { message: 'marks exploded' } },
    });
    expect(engine.order).toEqual(['ask', 'marks', 'proof']);
  });
  it('M12 question and solution selection changes leave the same marks request alive', async () => {
    const engine = new DeferredEngine();
    const created = await run(engine);
    expect(engine.markCalls).toHaveLength(1);
    const loading = created.marks;
    created.select(QUESTION_IDS[1]);
    created.selectSolution(1);
    expect(created.marks).toEqual(loading);
    expect(engine.markCalls[0]?.signal?.aborted).toBe(false);
    expect(engine.markCalls).toHaveLength(1);
    engine.markCalls[0]?.result.resolve({ kind: 'failure' });
    await tick();
    expect(created.marks).toMatchObject({ kind: 'settled', id: ID, outcome: { kind: 'failure' } });
    expect(engine.proofs.at(-1)?.input).toMatchObject({ selected: answerSolution('b').display });
  });
  it('M12 unavailable without marks path while a returned answer survives', async () => {
    const engine: DemoEngine = {
      boot: () => Promise.resolve({ kind: 'booted', contract: CONTRACT }),
      ask: () => Promise.resolve(answer()),
      dispose: () => undefined,
    };
    const created = await run(engine);
    expect(created.marks).toEqual({ kind: 'unavailable' });
    expect(created.state).toMatchObject({ kind: 'settled', result: answer() });
  });
  it.each<AnswerResult>([
    { kind: 'answer', id: ID, serialized: '', solutions: [] },
    { kind: 'failure', id: ID, serialized: '' },
    { kind: 'limit', id: ID, limit: 'inference', serialized: '', solutions: [] },
    { kind: 'cancelled', id: ID, serialized: '', solutions: [] },
    { kind: 'error', id: ID, error: { code: 'prolog', message: 'failed' } },
    { kind: 'rejected', reason: 'unknown-id' },
  ])('M12 idle without solutions for %s', async (result) => {
    const engine = new DeferredEngine();
    engine.nextAnswer = result;
    const created = await run(engine);
    expect(created.marks).toEqual({ kind: 'idle' });
    expect(engine.markCalls).toHaveLength(0);
  });
  it.each(['limit', 'cancelled'] as const)('M12 a partial %s answer starts marks', async (kind) => {
    const engine = new DeferredEngine();
    const partial = { id: ID, serialized: '', solutions: [answerSolution('a')] };
    engine.nextAnswer =
      kind === 'limit' ? { ...partial, kind, limit: 'inference' } : { ...partial, kind };
    const created = await run(engine);
    expect(engine.markCalls).toHaveLength(1);
    expect(created.marks).toEqual({ kind: 'loading', id: ID, goal: GOAL });
  });
  it.each<MarksOutcome>([
    { kind: 'solutions', solutions: [answerSolution('a')] },
    { kind: 'failure' },
    { kind: 'limit', limit: 'wall-clock', solutions: [answerSolution('a')] },
    { kind: 'cancelled', solutions: [answerSolution('a')] },
    { kind: 'error', error: { code: 'prolog', message: 'failed' } },
    { kind: 'rejected', reason: 'unknown-id' },
  ])('M12 preserves the marks outcome as returned: %s', async (outcome) => {
    const engine = new DeferredEngine();
    const created = await run(engine);
    expect(engine.markCalls).toHaveLength(1);
    engine.markCalls[0]?.result.resolve(outcome);
    await tick();
    expect(created.marks).toEqual({ kind: 'settled', id: ID, goal: GOAL, outcome });
  });
});

describe('marks service', () => {
  it('M2 forwards the catalog marks goal, budget and signal and returns the client outcome', async () => {
    const outcome: MarksOutcome = {
      kind: 'limit',
      limit: 'inference',
      solutions: [answerSolution('a')],
    };
    const query = vi.fn(() => Promise.resolve(outcome));
    const service = new AnswerService({ query } as unknown as EngineClient);
    const signal = new AbortController().signal;
    expect(await service.marks(ID, DEMO_BUDGET, signal)).toBe(outcome);
    expect(query).toHaveBeenCalledExactlyOnceWith(GOAL, DEMO_BUDGET, signal);
  });
  it('M2 rejects noncatalog ids without ever querying goal text', async () => {
    const query = vi.fn(() => Promise.resolve({ kind: 'failure' } as const));
    const service = new AnswerService({ query } as unknown as EngineClient);
    for (const value of [
      undefined,
      null,
      {},
      4,
      '',
      '__proto__',
      'constructor',
      'clinical_marks(_,_,_)',
      ID.toUpperCase(),
    ]) {
      expect(await service.marks(value, DEMO_BUDGET)).toEqual({
        kind: 'rejected',
        reason: 'unknown-id',
      });
    }
    expect(query).not.toHaveBeenCalled();
  });
});
