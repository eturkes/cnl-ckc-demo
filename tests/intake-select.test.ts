import { describe, expect, it } from 'vitest';

import { NOUL_YES, select } from '../src/intake/select.js';
import { extractCandidates } from './intake-oracle/chunker.js';
import {
  description,
  judgment,
  PAINS,
  pick,
  random,
  vocabulary,
} from './intake-oracle/fixtures.js';
import { select as reference } from './intake-oracle/select.js';

const VALUES = [0, 0.5 - Number.EPSILON / 2, 0.5, 0.5 + Number.EPSILON / 2, 1];

describe('S1 deterministic selector', () => {
  it('pins the Noul yes boundary at 0.5', () => expect(NOUL_YES).toBe(0.5));

  it.each(PAINS)('applies every painSet subset to %s for both trigger kinds', (pain) => {
    const vocab = vocabulary();
    const result = select(vocab, judgment(pain, 1));
    if (pain === 'other') {
      expect(result).toEqual({ kind: 'refused' });
    } else {
      expect(result.kind).toBe('answered');
      if (result.kind !== 'answered') throw new Error('agnostic rules must answer');
      expect(result.matches).toEqual(
        vocab.rules
          .filter((rule) => rule.painSet.length === 0 || rule.painSet.some((type) => type === pain))
          .map((rule) => ({
            ruleId: rule.id,
            trigger: {
              kind: rule.trigger.kind,
              id: rule.trigger.kind === 'condition' ? rule.trigger.condition : rule.trigger.section,
              value: 1,
            },
          })),
      );
    }
  });

  it.each(VALUES)('grades each trigger family independently at %s', (value) => {
    const vocab = vocabulary();
    for (const kind of ['condition', 'section'] as const) {
      const input = judgment('unstated');
      if (kind === 'condition') input.conditions = { ...input.conditions, c01: value };
      else input.sections = { ...input.sections, s1: value };
      const actual = select(vocab, input);
      if (value < 0.5)
        expect(actual).toEqual({ kind: 'no-match', pain: 'unstated', gaps: [], overflow: 0 });
      else {
        const expectedRule = vocab.rules.find(
          (rule) => rule.trigger.kind === kind && rule.painSet.length === 0,
        );
        expect(actual).toEqual({
          kind: 'answered',
          pain: 'unstated',
          matches: [
            {
              ruleId: expectedRule?.id,
              trigger: { kind, id: kind === 'condition' ? 'c01' : 's1', value },
            },
          ],
          gaps: [],
          overflow: 0,
        });
      }
    }
  });

  it('unstated is not a wildcard, even when every Noul says yes', () => {
    const vocab = vocabulary();
    vocab.rules = vocab.rules.filter((rule) => rule.painSet.length > 0);
    expect(select(vocab, judgment('unstated', 1))).toEqual({
      kind: 'no-match',
      pain: 'unstated',
      gaps: [],
      overflow: 0,
    });
  });

  it('refused overrides all conditions, sections, gap values and overflow', () => {
    const input = judgment('other', 1);
    input.terms = [{ text: 'insomnia', start: 0, end: 8, value: 1 }];
    input.overflow = 50;
    expect(select(vocabulary(), input)).toEqual({ kind: 'refused' });
    input.conditions = {};
    input.sections = {};
    expect(select(vocabulary(), input)).toEqual({ kind: 'refused' });
  });

  it('keeps artifact order rather than sorting ids or trigger values', () => {
    const vocab = vocabulary();
    vocab.rules = [...vocab.rules].reverse();
    const input = judgment('acute', 1);
    input.sections = Object.fromEntries(Object.keys(input.sections).map((id) => [id, 0.5]));
    const actual = select(vocab, input);
    expect(actual.kind).toBe('answered');
    if (actual.kind !== 'answered') throw new Error('expected matched rules');
    expect(actual.matches.map(({ ruleId }) => ruleId)).toEqual(
      vocab.rules
        .filter((rule) => rule.painSet.length === 0 || rule.painSet.includes('acute'))
        .map(({ id }) => id),
    );
    for (const match of actual.matches)
      expect(match.trigger.value).toBe(match.trigger.kind === 'condition' ? 1 : 0.5);
  });

  it.each([0, 1])(
    'carries exact affirmative gaps and overflow when trigger values are %s',
    (value) => {
      const input = judgment('unstated', value);
      input.overflow = 3;
      input.terms = [
        { text: 'alpha', start: 0, end: 5, value: 0.5 - Number.EPSILON / 2 },
        { text: 'βήτα', start: 10, end: 14, value: 0.5 },
        { text: '2.5 mg', start: 20, end: 26, value: 1 },
      ];
      const result = select(vocabulary(), input);
      expect(result.kind).toBe(value === 1 ? 'answered' : 'no-match');
      if (result.kind === 'refused') throw new Error('in-scope pain must not refuse');
      expect(result.gaps).toEqual(input.terms.slice(1));
      expect(result.overflow).toBe(3);
    },
  );

  it('empty rule table answers nothing and inputs remain unchanged', () => {
    const vocab = vocabulary();
    vocab.rules = [];
    const input = judgment('acute', 1);
    const before = structuredClone({ vocab, input });
    expect(select(vocab, input)).toEqual({
      kind: 'no-match',
      pain: 'acute',
      gaps: [],
      overflow: 0,
    });
    expect({ vocab, input }).toEqual(before);
  });
});

describe('ORACLE-S independent selector differential', () => {
  it('agrees over 750 generated rule orders, triggers, pain subsets, probabilities and gaps', () => {
    const next = random(0x16c002);
    for (let iteration = 0; iteration < 750; iteration++) {
      const vocab = vocabulary();
      const remaining = [...vocab.rules];
      vocab.rules = [];
      const shuffled = [];
      while (remaining.length > 0) {
        const [rule] = remaining.splice(Math.floor(next() * remaining.length), 1);
        if (rule !== undefined && next() >= 0.2) shuffled.push(rule);
      }
      vocab.rules = shuffled;
      const input = judgment(pick(next, PAINS));
      input.conditions = Object.fromEntries(
        vocab.conditions.map(({ id }) => [id, pick(next, VALUES)]),
      );
      input.sections = Object.fromEntries(vocab.sections.map(({ id }) => [id, pick(next, VALUES)]));
      const chunks = extractCandidates(description(next));
      input.terms = chunks.candidates.map((candidate) => ({
        ...candidate,
        value: pick(next, VALUES),
      }));
      input.overflow = chunks.overflow;
      const before = structuredClone({ vocab, input });
      const actual = select(vocab, input);
      expect(actual, `seed 0x16c002 iteration ${String(iteration)}`).toEqual(
        reference(vocab, input),
      );
      expect({ vocab, input }).toEqual(before);
      if (actual.kind === 'answered') {
        expect(actual.matches.length).toBeGreaterThan(0);
        expect(actual.matches.map(({ ruleId }) => ruleId)).toEqual(
          vocab.rules
            .filter((rule) => actual.matches.some((match) => match.ruleId === rule.id))
            .map(({ id }) => id),
        );
      }
    }
  });
});
