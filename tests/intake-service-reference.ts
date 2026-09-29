import type { BudgetSpec } from '../src/engine/protocol.js';
import type { PlTerm } from '../src/engine/terms.js';
import type { DerivedRule, IntakeEngine } from '../src/intake/service.js';
import type { IntakeVocabulary } from '../src/intake/vocabulary.js';
import { presentClinicalAdvice } from '../src/questions/advice.js';

import { gateRecords } from './clinical-test-support.js';
import { referenceVocabulary, ruleRecords } from './intake-backend-support.js';

export const INTAKE_BUDGET: Readonly<BudgetSpec> = Object.freeze({
  answerCap: 1,
  wallClockMs: 10_000,
  stackBytes: 16_777_216,
  depth: 100,
  inferences: 1_000_000,
});
const lines = (term: PlTerm): number[] => {
  if (term.kind === 'list') return term.items.flatMap(lines);
  if (term.kind !== 'compound') return [];
  if (term.functor === 'line' && term.args.length === 1 && term.args[0]?.kind === 'integer') {
    return [Number(term.args[0].value)];
  }
  return term.args.flatMap(lines);
};
const render = (document: string, Rule: PlTerm) =>
  presentClinicalAdvice({
    kind: 'compound',
    functor: 'clinical_answer',
    args: [
      { kind: 'atom', value: document },
      { kind: 'list', items: [Rule] },
      { kind: 'string', value: 'reference-only-adapter-marker' },
    ],
  });

// Test-only reference; the lookup arm is the reproducible D3 anti-binding mutant.
export class IntakeService {
  constructor(
    private readonly engine: IntakeEngine,
    private readonly vocabulary: IntakeVocabulary = referenceVocabulary(),
  ) {}

  async derive(
    ruleIds: readonly unknown[],
    signal?: AbortSignal,
  ): Promise<{ kind: 'derived'; rules: DerivedRule[] } | { kind: 'rejected'; ruleId: unknown }> {
    const byId = new Map(this.vocabulary.rules.map((rule) => [rule.id, rule]));
    for (const ruleId of ruleIds) {
      if (typeof ruleId !== 'string' || !byId.has(ruleId)) return { kind: 'rejected', ruleId };
    }
    const rules: DerivedRule[] = [];
    for (const ruleId of ruleIds as readonly string[]) {
      const rule = byId.get(ruleId);
      if (rule === undefined) throw new Error('reference id validation failed');
      if (process.env.INTAKE_REFERENCE_MUTANT === 'lookup') {
        const record = ruleRecords.find(({ id }) => id === ruleId);
        if (record === undefined) throw new Error('mutant has no rule record');
        const shown = render(rule.document, record.rule);
        if (shown?.structured !== true) throw new Error('mutant cannot render rule');
        const cited = gateRecords.find(
          ({ document, sentence }) => `${document}:${String(sentence)}` === ruleId,
        );
        rules.push({
          ruleId,
          status: 'derived',
          text: shown.items[0] as string,
          lines: cited?.lines ?? [],
        });
        continue;
      }
      const outcome = await this.engine.query(rule.goal, INTAKE_BUDGET, signal);
      switch (outcome.kind) {
        case 'failure':
          rules.push({ ruleId, status: 'not-derived' });
          break;
        case 'limit':
          rules.push({ ruleId, status: 'limit', limit: outcome.limit });
          break;
        case 'error':
          rules.push({ ruleId, status: 'error', error: outcome.error });
          break;
        case 'cancelled':
          rules.push({ ruleId, status: 'cancelled' });
          break;
        case 'solutions': {
          const bindings = outcome.solutions[0]?.bindings;
          const shown =
            bindings?.Rule === undefined ? undefined : render(rule.document, bindings.Rule);
          if (
            shown?.structured !== true ||
            shown.items.length !== 1 ||
            bindings?.Proof === undefined
          ) {
            rules.push({
              ruleId,
              status: 'error',
              error: { code: 'decode', message: 'invalid Rule or Proof' },
            });
          } else {
            rules.push({
              ruleId,
              status: 'derived',
              text: shown.items[0] as string,
              lines: [...new Set(lines(bindings.Proof))].sort((a, b) => a - b),
            });
          }
        }
      }
    }
    return { kind: 'derived', rules };
  }
}
