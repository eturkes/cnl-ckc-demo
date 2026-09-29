import type { JudgmentResult } from '../../src/intake/judgment.js';
import type { BuiltRequest, PainOption } from '../../src/intake/request.js';
import type { IntakeRule, IntakeVocabulary, PainType } from '../../src/intake/vocabulary.js';

export const PAINS = ['acute', 'subacute', 'chronic', 'unstated', 'other'] as const;
export const PAIN_SETS: readonly (readonly PainType[])[] = Array.from({ length: 8 }, (_, mask) =>
  (['acute', 'subacute', 'chronic'] as const).filter((_, index) => (mask & (1 << index)) !== 0),
);

export function vocabulary(): IntakeVocabulary {
  const document = 'cdc2022-opioid-rec01';
  return {
    vocabularyVersion: 1,
    digest: 'd'.repeat(64),
    conditions: Array.from({ length: 24 }, (_, index) => ({
      id: `c${String(index + 1).padStart(2, '0')}`,
      text: `condition-text-${String(index + 1)}`,
    })),
    sections: Array.from({ length: 4 }, (_, index) => ({
      id: `s${String(index + 1)}`,
      heading: `section-heading-${String(index + 1)}`,
      documents: index === 0 ? [document] : [],
    })),
    vocabulary: ['condition-text-1', 'opioid-pain-medication', 'sleep-disordered-breathing'],
    rules: PAIN_SETS.flatMap((painSet, index) =>
      (['condition', 'section'] as const).map((kind, offset): IntakeRule => {
        const sentence = index * 2 + offset + 1;
        return {
          id: `${document}:${String(sentence)}`,
          document,
          sentence,
          // Distinct trigger ids per rule: a selector that looked up one fixed id would
          // otherwise agree with the reference (review INT-F1).
          trigger:
            kind === 'condition'
              ? { kind: 'condition', condition: `c${String(index + 1).padStart(2, '0')}` }
              : { kind: 'section', section: `s${String((index % 4) + 1)}` },
          painSet,
          section: 's1',
          question: 'fixture-question' as IntakeRule['question'],
          goal: `clinical_derive('${document}',${String(sentence)},Rule,Proof)`,
        };
      }),
    ),
  };
}

export interface RawResponse {
  model: string;
  answers: Record<string, unknown>;
  [field: string]: unknown;
}
export function response(built: BuiltRequest, pain: PainOption = 'unstated'): RawResponse {
  const answers: Record<string, unknown> = {};
  for (const [id, question] of Object.entries(built.request.questions)) {
    answers[id] =
      question.type === 'noul'
        ? { type: 'noul', noul: 0 }
        : {
            type: 'choice',
            choice: pain,
            probabilities: Object.fromEntries(
              Object.keys(question.criteria).map((option) => [option, option === pain ? 1 : 0]),
            ),
          };
  }
  return { model: built.request.model, answers };
}

export function judgment(pain: PainOption = 'unstated', value = 0): JudgmentResult {
  const vocab = vocabulary();
  return {
    model: 'jev-1.13.0',
    conditions: Object.fromEntries(vocab.conditions.map(({ id }) => [id, value])),
    sections: Object.fromEntries(vocab.sections.map(({ id }) => [id, value])),
    pain: {
      choice: pain,
      probabilities: Object.fromEntries(PAINS.map((option) => [option, option === pain ? 1 : 0])),
    },
    terms: [],
    overflow: 0,
  };
}

export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pick<T>(next: () => number, values: readonly T[]): T {
  const value = values[Math.floor(next() * values.length)];
  if (value === undefined) throw new Error('empty generator domain');
  return value;
}

export function description(next: () => number): string {
  const tokens = [
    'sleep',
    'apnea',
    '2.5',
    'mg',
    'no',
    'not',
    'NEVER',
    'without',
    'denies',
    'denied',
    'patient',
    'The',
    'and',
    '’the’',
    'a',
    'of',
    'pain',
    'PAIN',
    '痛み',
    'café',
    'Café',
    '𐐀',
    '١٢',
    '🩺',
    '---',
    "can't",
    'x'.repeat(79),
    'y'.repeat(80),
    'z'.repeat(81),
  ];
  const separators = [
    ' ',
    '  ',
    '\t',
    ' ',
    '\n',
    '\r\n',
    ' ',
    '.',
    ',',
    ';',
    ':',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
    '"',
    '!',
    '?',
  ];
  return Array.from(
    { length: Math.floor(next() * 45) },
    () => `${pick(next, tokens)}${pick(next, separators)}`,
  ).join('');
}
