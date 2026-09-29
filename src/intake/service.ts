// Selected rule ids → live Prolog derivations (`.agent/contracts/m5u16.md` D1–D4).
//
// The service takes ids, never a goal: each id resolves to the build-time
// `clinical_derive/4` call its artifact row carries, which is the same per-sentence derivation
// `clinical_advice/4` runs for a built-in question — gate heads read from the stored gate body,
// premises applied through `derive/5`, `Rule` bound only once that derivation succeeds. What the
// user sees is rendered from that binding, so a rule the engine cannot derive is never shown.

import type { QueryOutcome } from '../engine/client.js';
import type { BudgetSpec, EngineError, LimitKind } from '../engine/protocol.js';
import type { PlTerm } from '../engine/terms.js';
import { presentClinicalAdvice } from '../questions/advice.js';

import { INTAKE_VOCABULARY, type IntakeRule, type IntakeVocabulary } from './vocabulary.js';

type RuleStatus =
  | { status: 'derived'; text: string; lines: readonly number[] }
  | { status: 'not-derived' }
  | { status: 'limit'; limit: LimitKind }
  | { status: 'error'; error: EngineError }
  | { status: 'cancelled' };

export type DerivedRule = { ruleId: string } & RuleStatus;

export type IntakeDerivation =
  { kind: 'derived'; rules: DerivedRule[] } | { kind: 'rejected'; ruleId: unknown };

export interface IntakeEngine {
  query(goal: string, budget: BudgetSpec, signal?: AbortSignal): Promise<QueryOutcome>;
}

/**
 * One rule's derivation: the demo budget with a single answer. Every shipped rule derives in
 * one solution (48 of 48 on the saved image), so a second would only repeat the first.
 */
export const INTAKE_BUDGET: Readonly<BudgetSpec> = Object.freeze({
  stackBytes: 67_108_864,
  depth: 100_000,
  inferences: 5_000_000,
  wallClockMs: 5_000,
  answerCap: 1,
});

// `presentClinicalAdvice` wants a whole `clinical_answer/3`. `advice.ts` is byte-frozen
// (`clinical-records` T9), so one derived rule reaches the one grammar through this envelope;
// only a structured, single-item rendering is accepted, so its passage never renders.
const ENVELOPE_PASSAGE = 'intake: structured rendering only';

const decodeError = (message: string): { status: 'error'; error: EngineError } => ({
  status: 'error',
  error: { code: 'decode', message },
});

const render = (rule: IntakeRule, term: PlTerm): string | undefined => {
  const presented = presentClinicalAdvice({
    kind: 'compound',
    functor: 'clinical_answer',
    args: [
      { kind: 'atom', value: rule.document },
      { kind: 'list', items: [term] },
      { kind: 'string', value: ENVELOPE_PASSAGE },
    ],
  });
  return presented?.structured === true && presented.items.length === 1
    ? presented.items[0]
    : undefined;
};

/** Every `line(L)` a `node(line(L),Head,Sub)` cites, at any depth of the proof. */
const citedLines = (proof: PlTerm, lines: Set<number>): boolean => {
  if (proof.kind !== 'list') return false;
  for (const step of proof.items) {
    if (step.kind !== 'compound') return false;
    if (step.functor === 'node' && step.args.length === 3) {
      const [cite, , sub] = step.args;
      const line =
        cite?.kind === 'compound' && cite.functor === 'line' && cite.args.length === 1
          ? cite.args[0]
          : undefined;
      if (line?.kind !== 'integer' || sub === undefined) return false;
      lines.add(Number(line.value));
      if (!citedLines(sub, lines)) return false;
    } else if (
      !(step.functor === 'assumption' || step.functor === 'naf') ||
      step.args.length !== 1
    ) {
      return false;
    }
  }
  return true;
};

export class IntakeService {
  readonly #engine: IntakeEngine;
  readonly #rules: ReadonlyMap<string, IntakeRule>;

  constructor(engine: IntakeEngine, vocabulary: IntakeVocabulary = INTAKE_VOCABULARY) {
    this.#engine = engine;
    this.#rules = new Map(vocabulary.rules.map((rule) => [rule.id, rule]));
  }

  async derive(ruleIds: readonly unknown[], signal?: AbortSignal): Promise<IntakeDerivation> {
    const selected: IntakeRule[] = [];
    for (const id of ruleIds) {
      const rule = typeof id === 'string' ? this.#rules.get(id) : undefined;
      if (rule === undefined) return { kind: 'rejected', ruleId: id };
      selected.push(rule);
    }
    const rules: DerivedRule[] = [];
    for (const rule of selected) {
      if (signal?.aborted === true) {
        rules.push({ ruleId: rule.id, status: 'cancelled' });
        continue;
      }
      rules.push({ ruleId: rule.id, ...(await this.#deriveOne(rule, signal)) });
    }
    return { kind: 'derived', rules };
  }

  async #deriveOne(rule: IntakeRule, signal?: AbortSignal): Promise<RuleStatus> {
    const outcome = await this.#engine.query(rule.goal, INTAKE_BUDGET, signal);
    switch (outcome.kind) {
      case 'solutions': {
        const [solution] = outcome.solutions;
        if (solution === undefined) return { status: 'not-derived' };
        const { Rule: term, Proof: proof } = solution.bindings;
        if (term === undefined || proof === undefined) {
          return decodeError(`${rule.id}: the derivation bound no Rule or Proof`);
        }
        const text = render(rule, term);
        if (text === undefined) return decodeError(`${rule.id}: the derived Rule does not render`);
        const lines = new Set<number>();
        if (!citedLines(proof, lines))
          return decodeError(`${rule.id}: the Proof has an unknown shape`);
        return { status: 'derived', text, lines: Object.freeze([...lines].sort((a, b) => a - b)) };
      }
      case 'failure':
        return { status: 'not-derived' };
      case 'limit':
        return { status: 'limit', limit: outcome.limit };
      case 'cancelled':
        return { status: 'cancelled' };
      case 'error':
        return { status: 'error', error: outcome.error };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }
}
