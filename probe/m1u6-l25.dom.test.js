import { expect, it } from 'vitest';

import { answerRows } from '../src/demo/describe.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';

it('L25 renders the engine display instead of JS-templating a decoded binding', () => {
  const display = 'ENGINE-DISPLAY-SENTINEL';
  const guidelineId = {
    kind: 'compound',
    functor: '$guideline_id',
    args: [
      { kind: 'atom', value: 'recommendation' },
      { kind: 'atom', value: 'binding-poison-document' },
      { kind: 'integer', value: 42 },
      { kind: 'compound', functor: 'ref', args: [{ kind: 'integer', value: 7 }] },
      { kind: 'atom', value: 'binding-poison-dependencies' },
    ],
  };
  const rows = answerRows(QUESTION_IDS[0], [
    { bindings: { A: guidelineId }, display: { A: display } },
  ]);

  expect(rows[0]?.cells[0]?.text).toBe(display);
});
