// Focused proof lifecycle for DemoController. The engine is deliberately
// deferred so stale completion and abort ownership are deterministic.

import { afterEach, describe, expect, it } from 'vitest';

import type { BootOutcome } from '../src/engine/client.js';
import type {
  BudgetSpec,
  PlSolution,
  ProofInput,
  ProofOutcome,
  ProofStep,
} from '../src/engine/protocol.js';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

const ID = QUESTION_IDS[0];
const CONTRACT = { schemaVersion: 1, documents: 337 };

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const solution = (index: number): PlSolution => ({
  bindings: { A: { kind: 'atom', value: `answer-${String(index)}` } },
  display: { A: `canonical-${String(index)}` },
});

const answer = (id: QuestionId, count = 2): AnswerResult => ({
  kind: 'answer',
  id,
  serialized: 'solutions',
  solutions: Array.from({ length: count }, (_, index) => solution(index)),
});

const step = (line: number): ProofStep => ({
  line,
  head: `guideline_document(doc_${String(line)},title,unreviewed)`,
  predicate: 'guideline_document/3',
  document: `doc-${String(line)}`,
  sentence: 1,
  children: [],
});

interface ProofCall {
  input: ProofInput;
  budget: BudgetSpec;
  signal: AbortSignal | undefined;
  result: Deferred<ProofOutcome>;
}

class DeferredProofEngine implements DemoEngine {
  readonly calls: ProofCall[] = [];

  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: CONTRACT });
  }

  ask(): Promise<AnswerResult> {
    return Promise.resolve(answer(ID));
  }

  readonly prove = (
    input: ProofInput,
    budget: BudgetSpec,
    signal?: AbortSignal,
  ): Promise<ProofOutcome> => {
    const result = deferred<ProofOutcome>();
    this.calls.push({ input, budget, signal, result });
    return result.promise;
  };

  dispose(): void {}
}

let controller: DemoController | undefined;

afterEach(() => {
  controller?.dispose();
  controller = undefined;
});

const run = async (engine: DemoEngine): Promise<DemoController> => {
  const created = new DemoController(engine);
  controller = created;
  await tick();
  created.select(ID);
  await created.run();
  return created;
};

describe('automatic selected-solution proof tracing', () => {
  it('starts a proof for the first solution and publishes its result', async () => {
    const engine = new DeferredProofEngine();
    const created = await run(engine);
    expect(engine.calls).toHaveLength(1);
    expect(engine.calls[0]?.input).toMatchObject({ selected: solution(0).display });
    expect(created.provenance).toEqual({ kind: 'loading', solution: 0 });

    engine.calls[0]?.result.resolve({ kind: 'proof', steps: [step(11)] });
    await tick();
    expect(created.provenance).toEqual({ kind: 'ready', solution: 0, steps: [step(11)] });
  });

  it('aborts a prior selection and suppresses its stale completion', async () => {
    const engine = new DeferredProofEngine();
    const created = await run(engine);
    const first = engine.calls[0];
    created.selectSolution(1);
    const second = engine.calls[1];
    expect(first?.signal?.aborted).toBe(true);
    expect(second?.input).toMatchObject({ selected: solution(1).display });

    first?.result.resolve({ kind: 'proof', steps: [step(21)] });
    await tick();
    expect(created.provenance).toEqual({ kind: 'loading', solution: 1 });

    second?.result.resolve({ kind: 'proof', steps: [step(22)] });
    await tick();
    expect(created.provenance).toEqual({ kind: 'ready', solution: 1, steps: [step(22)] });
  });

  it('reports tracing unavailable when the engine has no prove surface', async () => {
    const engine: DemoEngine = {
      boot: () => Promise.resolve({ kind: 'booted', contract: CONTRACT }),
      ask: () => Promise.resolve(answer(ID)),
      dispose: () => undefined,
    };
    const created = await run(engine);
    expect(created.provenance).toEqual({
      kind: 'unavailable',
      message: 'Proof tracing is unavailable.',
    });
  });

  it.each([
    [
      { kind: 'limit', limit: 'inference' } as const,
      { kind: 'limit', solution: 0, limit: 'inference' } as const,
    ],
    [
      { kind: 'error', error: { code: 'prolog', message: 'proof exploded' } } as const,
      {
        kind: 'error',
        solution: 0,
        error: { code: 'prolog', message: 'proof exploded' },
      } as const,
    ],
  ])('maps proof %s into an explicit provenance state', async (outcome, expected) => {
    const engine = new DeferredProofEngine();
    const created = await run(engine);
    engine.calls[0]?.result.resolve(outcome);
    await tick();
    expect(created.provenance).toEqual(expected);
  });
});
