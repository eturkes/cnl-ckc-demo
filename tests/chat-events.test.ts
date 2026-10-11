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
