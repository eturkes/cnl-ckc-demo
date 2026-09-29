import type { DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import type { BudgetSpec, PlSolution, ProofInput, ProofOutcome } from '../src/engine/protocol.js';
import type { JudgmentResult } from '../src/intake/judgment.js';
import type { IntakeDerivation } from '../src/intake/service.js';
import type { IntakeVocabulary } from '../src/intake/vocabulary.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

export const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
};

export const turn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
export const QUESTION = QUESTION_IDS[0];
export const NEXT_QUESTION = QUESTION_IDS[1];
export const ENGINE_CONTRACT = { schemaVersion: 1, documents: 337 };

// Injected typed vocabulary: UI orchestration is independent of the producer census.
export const UI_VOCABULARY: IntakeVocabulary = {
  vocabularyVersion: 1,
  digest: 'a'.repeat(64),
  conditions: [
    { id: 'c01', text: 'condition-alpha' },
    { id: 'c02', text: 'condition-beta' },
  ],
  sections: [{ id: 's1', heading: 'section-gamma', documents: ['doc-alpha', 'doc-beta'] }],
  vocabulary: ['condition-alpha', 'condition-beta', 'object-gamma'],
  rules: [
    {
      id: 'doc-alpha:1',
      document: 'doc-alpha',
      sentence: 1,
      trigger: { kind: 'condition', condition: 'c01' },
      painSet: [],
      section: 's1',
      question: QUESTION,
      goal: 'clinical_derive(doc_alpha,1,Rule,Proof)',
    },
    {
      id: 'doc-beta:2',
      document: 'doc-beta',
      sentence: 2,
      trigger: { kind: 'section', section: 's1' },
      painSet: ['acute'],
      section: 's1',
      question: NEXT_QUESTION,
      goal: 'clinical_derive(doc_beta,2,Rule,Proof)',
    },
    {
      id: 'doc-alpha:3',
      document: 'doc-alpha',
      sentence: 3,
      trigger: { kind: 'condition', condition: 'c02' },
      painSet: ['chronic'],
      section: 's1',
      question: QUESTION,
      goal: 'clinical_derive(doc_alpha,3,Rule,Proof)',
    },
  ],
};

export const judgment = (overrides: Partial<JudgmentResult> = {}): JudgmentResult => ({
  model: 'jev-1.13.0',
  conditions: { c01: 0.83, c02: 0 },
  sections: { s1: 0.91 },
  pain: {
    choice: 'acute',
    probabilities: { acute: 1, subacute: 0, chronic: 0, unstated: 0, other: 0 },
  },
  terms: [{ text: 'gap-sentinel', start: 0, end: 12, value: 0.93 }],
  overflow: 0,
  ...overrides,
});

export const derived = (ids: readonly string[]): IntakeDerivation => ({
  kind: 'derived',
  rules: ids.map((ruleId, index) => ({
    ruleId,
    status: 'derived',
    text: `Engine-derived sentinel ${ruleId}.`,
    lines: Array.from({ length: index + 2 }, (_, line) => 101 + line),
  })),
});

export const clinicalSolution = (document: string): PlSolution => ({
  bindings: {
    Answer: {
      kind: 'compound',
      functor: 'clinical_answer',
      args: [
        { kind: 'atom', value: document },
        { kind: 'list', items: [] },
        { kind: 'string', value: `Source passage for ${document}.` },
      ],
    },
  },
  display: { Answer: `clinical_answer('${document}',[],marker)` },
});

export const clinicalAnswer = (
  id: QuestionId = QUESTION,
  documents: readonly string[] = [],
): AnswerResult => ({
  kind: 'answer',
  id,
  serialized: 'serialized-engine-answer',
  solutions: documents.map(clinicalSolution),
});

interface AskCall {
  id: unknown;
  budget: BudgetSpec;
  signal: AbortSignal | undefined;
  result: Deferred<AnswerResult>;
}
interface ProofCall {
  input: ProofInput;
  budget: BudgetSpec;
  signal: AbortSignal | undefined;
  result: Deferred<ProofOutcome>;
}
interface DeriveCall {
  ids: readonly unknown[];
  signal: AbortSignal | undefined;
  result: Deferred<IntakeDerivation>;
}

export class DeferredDemoEngine implements DemoEngine {
  readonly asks: AskCall[] = [];
  readonly proofs: ProofCall[] = [];
  readonly derivations: DeriveCall[] = [];
  readonly events: string[] = [];
  active = 0;
  peak = 0;

  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: ENGINE_CONTRACT });
  }

  #track<T>(kind: string, pending: Deferred<T>): Promise<T> {
    this.events.push(`start:${kind}`);
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    return pending.promise.finally(() => {
      this.active -= 1;
      this.events.push(`settled:${kind}`);
    });
  }

  ask(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult> {
    const result = deferred<AnswerResult>();
    this.asks.push({ id, budget, signal, result });
    return this.#track('ask', result);
  }

  prove(input: ProofInput, budget: BudgetSpec, signal?: AbortSignal): Promise<ProofOutcome> {
    const result = deferred<ProofOutcome>();
    this.proofs.push({ input, budget, signal, result });
    return this.#track('proof', result);
  }

  derive(ids: readonly unknown[], signal?: AbortSignal): Promise<IntakeDerivation> {
    const result = deferred<IntakeDerivation>();
    this.derivations.push({ ids, signal, result });
    return this.#track('derive', result);
  }

  dispose(): void {}
}
