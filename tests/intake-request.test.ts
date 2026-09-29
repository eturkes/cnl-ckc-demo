import { describe, expect, it } from 'vitest';

import { extractCandidates } from '../src/intake/chunker.js';
import { buildRequest, JEV_MODEL, PAIN_OPTIONS } from '../src/intake/request.js';
import { vocabulary } from './intake-oracle/fixtures.js';

const BASE_IDS = [
  ...Array.from({ length: 24 }, (_, index) => `c${String(index + 1).padStart(2, '0')}`),
  'pain',
  's1',
  's2',
  's3',
  's4',
];

describe('Q1 judgment request', () => {
  it.each([
    '',
    ' \n\t ',
    'no sleep-disordered breathing and 2.5 mg',
    Array.from({ length: 18 }, (_, i) => `term${String(i)}`).join(','),
  ])(
    'emits the ordered declared ids, pinned model and description-only state for %j',
    (description) => {
      const built = buildRequest(vocabulary(), description);
      const extracted = extractCandidates(description);
      expect(Object.keys(built.request).sort()).toEqual(['model', 'questions', 'state']);
      expect(built.request.model).toBe('jev-1.13.0');
      expect(built.request.state).toEqual({ description });
      expect(built.candidates).toEqual(extracted.candidates);
      expect(built.overflow).toBe(extracted.overflow);
      expect(Object.keys(built.request.questions)).toEqual([
        ...BASE_IDS,
        ...extracted.candidates.map((_, index) => `t${String(index + 1).padStart(2, '0')}`),
      ]);
      for (const [id, question] of Object.entries(built.request.questions)) {
        expect(question.type, id).toBe(id === 'pain' ? 'choice' : 'noul');
        expect(question.instructions, id).toBeDefined();
      }
    },
  );

  it('exports the pinned model and ordered options', () => {
    expect(JEV_MODEL).toBe('jev-1.13.0');
    expect(PAIN_OPTIONS).toEqual(['acute', 'subacute', 'chronic', 'unstated', 'other']);
    const pain = buildRequest(vocabulary(), 'pain').request.questions.pain;
    expect(pain?.type).toBe('choice');
    expect(Object.keys(pain?.criteria ?? {})).toEqual(PAIN_OPTIONS);
  });

  it('hatch false removes only the other option; default and explicit true are identical', () => {
    const vocab = vocabulary();
    const usual = buildRequest(vocab, 'pain and insomnia');
    const forced = buildRequest(vocab, 'pain and insomnia', { hatch: false });
    expect(buildRequest(vocab, 'pain and insomnia', { hatch: true })).toEqual(usual);
    const expected = structuredClone(usual);
    if (expected.request.questions.pain?.type !== 'choice') throw new Error('missing pain choice');
    delete expected.request.questions.pain.criteria.other;
    expect(forced).toEqual(expected);
  });

  it('condition, section and term questions carry the supplied vocabulary and candidate text', () => {
    const vocab = vocabulary();
    const built = buildRequest(vocab, 'invented-condition and 痛み');
    for (const condition of vocab.conditions) {
      expect(JSON.stringify(built.request.questions[condition.id])).toContain(condition.text);
    }
    for (const section of vocab.sections) {
      expect(JSON.stringify(built.request.questions[section.id])).toContain(section.heading);
    }
    built.candidates.forEach((candidate, index) => {
      const question = built.request.questions[`t${String(index + 1).padStart(2, '0')}`];
      expect(JSON.stringify(question)).toContain(candidate.text);
    });
    const changed = structuredClone(vocab);
    changed.conditions = changed.conditions.map((condition) => ({
      ...condition,
      text: `${condition.text}-changed`,
    }));
    changed.sections = changed.sections.map((section) => ({
      ...section,
      heading: `${section.heading}-changed`,
    }));
    expect(buildRequest(changed, 'invented-condition and 痛み').request.questions).not.toEqual(
      built.request.questions,
    );
  });

  it('question text depends on vocabulary and candidates, not discarded description words', () => {
    const vocab = vocabulary();
    const left = buildRequest(vocab, 'the pain');
    const right = buildRequest(vocab, 'our pain');
    expect(left.candidates).toEqual(right.candidates);
    expect(left.request.questions).toEqual(right.request.questions);
  });

  it('does not mutate its vocabulary', () => {
    const vocab = vocabulary();
    const snapshot = structuredClone(vocab);
    buildRequest(vocab, 'no pain');
    buildRequest(vocab, 'no pain', { hatch: false });
    expect(vocab).toEqual(snapshot);
  });
});
