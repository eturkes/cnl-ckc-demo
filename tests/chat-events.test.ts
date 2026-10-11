import { describe, expect, it } from 'vitest';

import { parseEvent } from '../src/chat/events.js';

const events: Record<string, unknown>[] = [
  { type: 'conversation', id: 'thread-1' },
  { type: 'commentary', text: 'Reading the knowledge base.' },
  { type: 'query', call: 'q1', goal: 'guideline_document(D,T,S).' },
  { type: 'answer', text: '{"segments":[]}' },
  { type: 'error', reason: 'codex', message: 'upstream-marker' },
  { type: 'done' },
];
const wrongTypes = [null, false, true, 0, 1.25, [], {}, ['text']];

describe('chat event decoder', () => {
  it.each(['openPage', 'findInPage'])(
    'D1 search maps %s URL to opened and keeps every result field',
    (type) => {
      const result = {
        url: 'https://example.org/result',
        title: 'Title',
        domain: 'example.org',
        snippet: 'Exact snippet.',
      };
      const action = { type, url: 'https://example.org/opened', pattern: 'pain' };
      expect(
        parseEvent(
          JSON.stringify({ type: 'search', query: 'pain 日本語', action, results: [result] }),
        ),
      ).toEqual({ type: 'search', query: 'pain 日本語', opened: action.url, results: [result] });
    },
  );

  it.each([
    null,
    { type: 'search', query: 'pain' },
    { type: 'openPage', url: '' },
    { type: 'findInPage', url: 4 },
  ])('D1 a search without an opened page keeps opened undefined: %j', (action) => {
    expect(
      parseEvent(JSON.stringify({ type: 'search', query: 'pain', action, results: [] })),
    ).toEqual({ type: 'search', query: 'pain', opened: undefined, results: [] });
  });

  it('D1 search refuses missing or mistyped query, result list and nested result fields', () => {
    const result = {
      url: 'https://example.org/a',
      title: 'Title',
      domain: 'example.org',
      snippet: 'Snippet',
    };
    const event = {
      type: 'search',
      query: 'pain',
      action: { type: 'search', query: 'pain' },
      results: [result],
    };
    for (const field of ['query', 'results']) {
      const missing: Record<string, unknown> = { ...event };
      delete missing[field];
      expect(parseEvent(JSON.stringify(missing))).toBeUndefined();
    }
    for (const query of wrongTypes)
      expect(parseEvent(JSON.stringify({ ...event, query }))).toBeUndefined();
    for (const results of [null, false, 0, 'text', {}, [null], ['text'], [4]])
      expect(parseEvent(JSON.stringify({ ...event, results }))).toBeUndefined();
    for (const field of Object.keys(result)) {
      const missing: Record<string, unknown> = { ...result };
      delete missing[field];
      expect(parseEvent(JSON.stringify({ ...event, results: [missing] }))).toBeUndefined();
      for (const value of wrongTypes)
        expect(
          parseEvent(JSON.stringify({ ...event, results: [{ ...result, [field]: value }] })),
        ).toBeUndefined();
    }
  });

  it.each(['q0', 'q01', 'q-1', 'Q1', 'q1x', ' q1', 'q1 ', 'q1\\n', '', 'q', '1'])(
    'D1 refuses noncanonical call id %j',
    (call) => {
      expect(
        parseEvent(JSON.stringify({ type: 'query', call, goal: 'guideline_schema_version(V).' })),
      ).toBeUndefined();
    },
  );

  it.each(['q1', 'q9', 'q10', 'q123456789012345678901234567890'])(
    'D1 preserves canonical call id %s',
    (call) => {
      const event = { type: 'query', call, goal: 'guideline_schema_version(V).' };
      expect(parseEvent(JSON.stringify(event))).toEqual(event);
    },
  );

  it.each(events)('D1 preserves documented fields of $type', (event) => {
    expect(parseEvent(JSON.stringify(event))).toEqual(event);
  });

  it.each(['auth', 'busy', 'expired', 'codex', 'timeout', 'interrupted'])(
    'D1 preserves error reason %s',
    (reason) => {
      const event = { type: 'error', reason, message: `message:${reason}` };
      expect(parseEvent(JSON.stringify(event))).toEqual(event);
    },
  );

  it('D1 rejects every missing required field and every non-string replacement', () => {
    let graded = 0;
    for (const event of events) {
      for (const key of Object.keys(event)) {
        const missing = { ...event };
        delete missing[key];
        expect(
          parseEvent(JSON.stringify(missing)),
          `${String(event.type)} missing ${key}`,
        ).toBeUndefined();
        graded += 1;
        for (const wrong of wrongTypes) {
          expect(
            parseEvent(JSON.stringify({ ...event, [key]: wrong })),
            `${String(event.type)} mistyped ${key}`,
          ).toBeUndefined();
          graded += 1;
        }
      }
    }
    expect(graded).toBe(117);
  });

  it.each([
    '',
    '{',
    '{} {}',
    'null',
    '[]',
    'true',
    '123',
    '"text"',
    '{"type":"unrecognised"}',
    '{"type":"error","reason":"unrecognised","message":"x"}',
  ])('D1 refuses non-event line %j', (line) => {
    expect(parseEvent(line)).toBeUndefined();
  });

  it('D1 generated valid string fields round-trip Unicode, quotes, controls and empty text', () => {
    const strings = [
      '',
      ' ',
      '\n\r\t',
      'quote"slash\\',
      '日本語',
      'é́',
      '🩺',
      '\u0000',
      'x'.repeat(8192),
    ];
    let graded = 0;
    for (const value of strings) {
      for (const type of ['commentary', 'answer'] as const) {
        const event = { type, text: value };
        expect(parseEvent(JSON.stringify(event))).toEqual(event);
        graded += 1;
      }
    }
    expect(graded).toBe(18);
  });
});
