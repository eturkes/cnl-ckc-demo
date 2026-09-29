import { describe, expect, it } from 'vitest';

import {
  extractCandidates,
  MAX_CANDIDATES,
  MAX_CANDIDATE_LENGTH,
  STOPWORDS,
} from '../src/intake/chunker.js';
import { extractCandidates as reference, STOPWORDS as stopwords } from './intake-oracle/chunker.js';
import { description, random } from './intake-oracle/fixtures.js';

const texts = (input: string) => extractCandidates(input).candidates.map(({ text }) => text);

const examples: readonly [string, readonly string[]][] = [
  ['', []],
  [' \t\n\r\n  ', []],
  ['the patient is taking a', []],
  ['alpha  beta\tgamma', ['alpha  beta\tgamma']],
  ['no opioid dependence', ['no opioid dependence']],
  ['No history of opioid use disorder', ['No history', 'opioid use disorder']],
  ['use uses used using', ['use uses used using']],
  ['not never without denies denied pain', ['not never without denies denied pain']],
  ["'the' pain ’and’ fever", ['pain', 'fever']],
  ["'THE’ pain ’the' fever", ['pain', 'fever']],
  ["pain can't improve", ["pain can't improve"]],
  ['pain ’the’ pain', ['pain']],
  ['PAIN, pain; Pain', ['PAIN']],
  ['2.5 mg. next', ['2.5 mg', 'next']],
  ['.5 mg and 5. mg', ['5 mg', '5', 'mg']],
  ['1.2.3 and ٢.٥', ['1.2.3', '٢', '٥']],
  ['痛み and café or 𐐀', ['痛み', 'café', '𐐀']],
  ['🩺 — ---', []],
  ['🩺痛み', ['🩺痛み']],
  ['— and ٣', ['٣']],
  ['x'.repeat(80), ['x'.repeat(80)]],
  ['x'.repeat(81), []],
  ['𐐀'.repeat(40), ['𐐀'.repeat(40)]],
  ['𐐀'.repeat(41), []],
  [`${'x'.repeat(39)} ${'y'.repeat(40)}`, [`${'x'.repeat(39)} ${'y'.repeat(40)}`]],
  [`${'x'.repeat(40)} ${'y'.repeat(40)}`, ['x'.repeat(40), 'y'.repeat(40)]],
  [`alpha${' '.repeat(80)}beta`, ['alpha', 'beta']],
  [`alpha ${'x'.repeat(81)} beta`, ['alpha', 'beta']],
  ['---'.repeat(30), []],
];

describe('K1 candidate chunker', () => {
  it('discards punctuation-only split pieces without counting overflow', () => {
    const input = `alpha ${'-'.repeat(79)} beta`;
    expect(extractCandidates(input)).toEqual({
      candidates: [
        { text: 'alpha', start: 0, end: 5 },
        { text: 'beta', start: input.length - 4, end: input.length },
      ],
      overflow: 0,
    });
  });

  it.each(examples)('chunks %j into verbatim bounded runs', (input, expected) => {
    const actual = extractCandidates(input);
    expect(actual.candidates.map(({ text }) => text)).toEqual(expected);
    for (const candidate of actual.candidates) {
      expect(candidate.text).toBe(input.slice(candidate.start, candidate.end));
    }
  });

  it.each([
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
    '\n',
    '\r',
    '\r\n',
    ' ',
    ' ',
    '.',
  ])('treats %j as a hard boundary', (boundary) =>
    expect(texts(`alpha${boundary}beta`)).toEqual(['alpha', 'beta']),
  );

  it('exports the exact stopword set and limits', () => {
    expect(MAX_CANDIDATES).toBe(16);
    expect(MAX_CANDIDATE_LENGTH).toBe(80);
    expect([...STOPWORDS].sort()).toEqual([...stopwords].sort());
    for (const word of stopwords) {
      expect(texts(`left ${word.toUpperCase()} right`), word).toEqual(['left', 'right']);
    }
    for (const negator of ['no', 'not', 'never', 'without', 'denies', 'denied']) {
      expect(STOPWORDS.has(negator)).toBe(false);
    }
  });

  it('retains the first 16 distinct chunks; duplicates never consume slots or overflow', () => {
    const words = Array.from({ length: 17 }, (_, index) => `term${String(index)}`);
    expect(extractCandidates(words.slice(0, 16).join(','))).toMatchObject({ overflow: 0 });
    const actual = extractCandidates(
      [...words, ...words.map((word) => word.toUpperCase())].join(','),
    );
    expect(actual.candidates.map(({ text }) => text)).toEqual(words.slice(0, 16));
    expect(actual.overflow).toBe(1);
  });

  it('adds each discarded overlong token and each distinct excess chunk to overflow', () => {
    const words = Array.from({ length: 19 }, (_, index) => `term${String(index)}`);
    const input = `${words.join(',')},${'x'.repeat(81)},${'x'.repeat(81)},${'y'.repeat(82)}`;
    expect(extractCandidates(input).overflow).toBe(6);
    expect(extractCandidates('---'.repeat(30)).overflow).toBe(0);
  });

  it('preserves UTF-16 offsets, internal whitespace, first spelling and non-normalized forms', () => {
    const input = '🩺 and Élan\t  痛み, éLAN\t  痛み, élan';
    const actual = extractCandidates(input);
    expect(actual.candidates).toEqual([
      { text: 'Élan\t  痛み', start: input.indexOf('Élan'), end: input.indexOf(',') },
      { text: 'élan', start: input.indexOf('élan'), end: input.length },
    ]);
  });
});

describe('ORACLE-K independent chunker differential', () => {
  it('agrees over 750 seeded descriptions and satisfies slice/order/uniqueness/determinism', () => {
    const next = random(0x16c001);
    for (let iteration = 0; iteration < 750; iteration++) {
      const input = description(next);
      const actual = extractCandidates(input);
      expect(actual, `seed 0x16c001 iteration ${String(iteration)}: ${input}`).toEqual(
        reference(input),
      );
      expect(extractCandidates(input)).toEqual(actual);
      expect(actual.candidates.length).toBeLessThanOrEqual(16);
      expect(new Set(actual.candidates.map(({ text }) => text.toLowerCase())).size).toBe(
        actual.candidates.length,
      );
      expect(Number.isInteger(actual.overflow) && actual.overflow >= 0).toBe(true);
      let end = 0;
      for (const candidate of actual.candidates) {
        expect(candidate.start).toBeGreaterThanOrEqual(end);
        expect(candidate.end).toBeLessThanOrEqual(input.length);
        expect(candidate.text).toBe(input.slice(candidate.start, candidate.end));
        expect(candidate.text.length).toBeGreaterThan(0);
        expect(candidate.text.length).toBeLessThanOrEqual(80);
        end = candidate.end;
      }
    }
  });
});
