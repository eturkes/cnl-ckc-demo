// Judgment → one of three outcomes (`.agent/contracts/m5u16.md` Selection, S1, S2).
//
// Refusal is the `other` hatch alone, never a probability threshold: in-scope and out-of-scope
// `covered` scores overlapped in the feasibility probes, so no cut separates them. The answer
// set can only be shipped rules, and a gap term can only be a candidate cut from the user's text.

import type { JudgmentResult } from './judgment.js';
import type { PainOption } from './request.js';
import type { IntakeVocabulary, PainType } from './vocabulary.js';

export const NOUL_YES = 0.5;

export interface Gap {
  text: string;
  start: number;
  end: number;
  value: number;
}

export interface Match {
  ruleId: string;
  trigger: { kind: 'condition' | 'section'; id: string; value: number };
}

export type IntakeOutcome =
  | { kind: 'refused' }
  | { kind: 'no-match'; pain: PainOption; gaps: readonly Gap[]; overflow: number }
  | {
      kind: 'answered';
      pain: PainOption;
      matches: readonly Match[];
      gaps: readonly Gap[];
      overflow: number;
    };

const valueOf = (table: Readonly<Record<string, number>>, id: string): number => {
  const value = table[id];
  if (value === undefined) throw new Error(`judgment carries no value for ${id}`);
  return value;
};

export const select = (vocabulary: IntakeVocabulary, judgment: JudgmentResult): IntakeOutcome => {
  const pain = judgment.pain.choice;
  if (pain === 'other') return { kind: 'refused' };
  const matches: Match[] = [];
  for (const rule of vocabulary.rules) {
    const trigger =
      rule.trigger.kind === 'condition'
        ? { kind: 'condition' as const, id: rule.trigger.condition }
        : { kind: 'section' as const, id: rule.trigger.section };
    const value = valueOf(
      trigger.kind === 'condition' ? judgment.conditions : judgment.sections,
      trigger.id,
    );
    // `unstated` names no pain type, so it can only meet a rule that names none.
    const compatible = rule.painSet.length === 0 || rule.painSet.includes(pain as PainType);
    if (value >= NOUL_YES && compatible)
      matches.push({ ruleId: rule.id, trigger: { ...trigger, value } });
  }
  const gaps = judgment.terms
    .filter((term) => term.value >= NOUL_YES)
    .map(({ text, start, end, value }) => ({ text, start, end, value }));
  return matches.length === 0
    ? { kind: 'no-match', pain, gaps, overflow: judgment.overflow }
    : { kind: 'answered', pain, matches, gaps, overflow: judgment.overflow };
};
