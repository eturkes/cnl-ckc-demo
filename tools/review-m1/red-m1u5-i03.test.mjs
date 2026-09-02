import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import catalogData from '../../kb/generated/question-catalog.json' with { type: 'json' };

const catalog = catalogData.entries;
const surfaces = ['src/questions/QuestionCombobox.svelte', 'tests/question-combobox.dom.test.ts'];

void test('I03 keeps every catalog question literal out of component and suite source', () => {
  const violations = surfaces.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return catalog
      .filter(({ question }) => source.includes(question))
      .map(({ id }) => `${file}:${id}`);
  });
  assert.deepEqual(violations, []);
});
