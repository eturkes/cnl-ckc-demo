import { describe, expect, it } from 'vitest';

import {
  parseAnswer,
  resolveSegments,
  type AnswerSegment,
  type ClaimedSource,
  type Ledger,
} from '../src/chat/provenance.js';

const segment = (
  source: ClaimedSource,
  queries: string[] = [],
  urls: string[] = [],
): AnswerSegment => ({ text: 'Exact model wording 日本語.', source, queries, urls });
const ledger: Ledger = {
  ran: new Set(['q1', 'q2']),
  urls: new Set(['https://example.org/result', 'https://example.org/opened']),
};
const encode = (segments: unknown[]): string => JSON.stringify({ segments });

describe('chat answer schema', () => {
  it('D3 parseAnswer returns the segments themselves and preserves all documented strings and lists', () => {
    const segments = [
      segment('kb', ['q1']),
      segment('web', [], ['https://example.org/result']),
      segment('model'),
    ];
    expect(parseAnswer(encode(segments))).toEqual(segments);
    expect(parseAnswer(encode([]))).toEqual([]);
    expect(parseAnswer(encode([{ text: '', source: 'model', queries: [], urls: [] }]))).toEqual([
      { text: '', source: 'model', queries: [], urls: [] },
    ]);
  });

  it.each([
    '',
    '{',
    'null',
    '[]',
    'true',
    '5',
    '"text"',
    '{}',
    '{"segments":null}',
    '{"segments":{}}',
    '{"segments":[] , "extra":1}',
    '```json\n{"segments":[]}\n```',
  ])('D3 parseAnswer refuses non-schema answer %j', (text) => {
    expect(parseAnswer(text)).toBeUndefined();
  });

  it('D3 parseAnswer rejects every missing, mistyped or extra segment field', () => {
    const valid = segment('kb', ['q1']);
    for (const field of Object.keys(valid)) {
      const missing: Record<string, unknown> = { ...valid };
      delete missing[field];
      expect(parseAnswer(encode([missing]))).toBeUndefined();
    }
    const invalid = [
      null,
      false,
      1,
      'text',
      [],
      { ...valid, text: 1 },
      { ...valid, text: null },
      { ...valid, source: 'unverified' },
      { ...valid, source: 'KB' },
      { ...valid, source: null },
      { ...valid, queries: 'q1' },
      { ...valid, queries: null },
      { ...valid, queries: [1] },
      { ...valid, queries: ['q1', null] },
      { ...valid, urls: 'https://example.org/result' },
      { ...valid, urls: null },
      { ...valid, urls: [{}] },
      { ...valid, extra: 'not-in-schema' },
    ];
    for (const bad of invalid) {
      expect(parseAnswer(encode([bad]))).toBeUndefined();
      expect(parseAnswer(encode([valid, bad]))).toBeUndefined();
    }
  });
});

describe('citation provenance is record-relative, not prose entailment', () => {
  it.each([
    { name: 'successful current-conversation call', value: segment('kb', ['q1']), label: 'kb' },
    { name: 'zero-solution call in ran', value: segment('kb', ['q2']), label: 'kb' },
    { name: 'all cited calls ran', value: segment('kb', ['q1', 'q2']), label: 'kb' },
    { name: 'duplicate valid call', value: segment('kb', ['q1', 'q1']), label: 'kb' },
    { name: 'unknown call', value: segment('kb', ['q999']), label: 'unverified' },
    {
      name: 'other-conversation call omitted from ran',
      value: segment('kb', ['q3']),
      label: 'unverified',
    },
    { name: 'refused call omitted from ran', value: segment('kb', ['q4']), label: 'unverified' },
    {
      name: 'one valid and one unknown call',
      value: segment('kb', ['q1', 'q999']),
      label: 'unverified',
    },
    { name: 'no call', value: segment('kb'), label: 'unverified' },
    {
      name: 'returned result URL',
      value: segment('web', [], ['https://example.org/result']),
      label: 'web',
    },
    {
      name: 'opened page URL',
      value: segment('web', [], ['https://example.org/opened']),
      label: 'web',
    },
    {
      name: 'all URLs returned this turn',
      value: segment('web', [], ['https://example.org/result', 'https://example.org/opened']),
      label: 'web',
    },
    {
      name: 'unreturned URL',
      value: segment('web', [], ['https://elsewhere.example/a']),
      label: 'unverified',
    },
    {
      name: 'earlier-turn URL omitted from urls',
      value: segment('web', [], ['https://example.org/earlier']),
      label: 'unverified',
    },
    {
      name: 'one returned and one earlier URL',
      value: segment('web', [], ['https://example.org/result', 'https://example.org/earlier']),
      label: 'unverified',
    },
    {
      name: 'URL must equal verbatim',
      value: segment('web', [], ['https://example.org/result/']),
      label: 'unverified',
    },
    { name: 'no URL', value: segment('web'), label: 'unverified' },
    { name: 'model with no citation', value: segment('model'), label: 'model' },
    {
      name: 'model with both valid evidence forms',
      value: segment('model', ['q1'], ['https://example.org/result']),
      label: 'model',
    },
    {
      name: 'KB cannot borrow a web citation',
      value: segment('kb', [], ['https://example.org/result']),
      label: 'unverified',
    },
    { name: 'web cannot borrow a KB citation', value: segment('web', ['q1']), label: 'unverified' },
  ])('D3 $name', ({ value, label }) => {
    expect(resolveSegments([value], ledger)).toEqual([{ ...value, label }]);
  });

  it('D3 generated references agree with the independent membership rule and never upgrade or mutate a segment', () => {
    const references = [
      [],
      ['q1'],
      ['q2'],
      ['q999'],
      ['q1', 'q999'],
      ['q2', 'q1'],
      ['q1', 'q1'],
      [''],
    ];
    const urls = [
      [],
      ['https://example.org/result'],
      ['https://example.org/opened'],
      ['https://example.org/earlier'],
      ['https://example.org/result', 'https://example.org/earlier'],
      ['https://example.org/result', 'https://example.org/result'],
      [''],
    ];
    let checked = 0;
    for (const source of ['kb', 'web', 'model'] as const) {
      for (const queries of references) {
        for (const links of urls) {
          const value = segment(source, [...queries], [...links]);
          const before = structuredClone(value);
          const hasEvidence =
            source === 'model' ||
            (source === 'kb'
              ? queries.length > 0 && queries.every((id) => id === 'q1' || id === 'q2')
              : links.length > 0 &&
                links.every(
                  (url) =>
                    url === 'https://example.org/result' || url === 'https://example.org/opened',
                ));
          const resolved = resolveSegments([value], ledger);
          expect(resolved).toEqual([{ ...value, label: hasEvidence ? source : 'unverified' }]);
          expect(value).toEqual(before);
          const empty = resolveSegments([value], { ran: new Set(), urls: new Set() });
          expect(empty[0]?.label).toBe(source === 'model' ? 'model' : 'unverified');
          checked += 1;
        }
      }
    }
    expect(checked).toBe(168);
    expect([...ledger.ran]).toEqual(['q1', 'q2']);
    expect([...ledger.urls]).toEqual(['https://example.org/result', 'https://example.org/opened']);
  });

  it('D3 mixed segments retain order, claimed source and prose even when downgraded', () => {
    const values = [
      segment('kb', ['absent']),
      segment('model'),
      segment('web', [], ['https://example.org/opened']),
      segment('kb', ['q2']),
    ];
    expect(resolveSegments(values, ledger)).toEqual(
      values.map((value, index) => ({
        ...value,
        label: ['unverified', 'model', 'web', 'kb'][index],
      })),
    );
  });
});
