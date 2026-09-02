import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const component = 'src/questions/QuestionCombobox.svelte';
const suite = 'tests/question-combobox.dom.test.ts';

void test('I23 binds the exact 500 ms typeahead boundary', () => {
  const baseline = readFileSync(component, 'utf8');
  const outcomes = [];
  try {
    for (const milliseconds of [1, 599]) {
      const mutant = baseline.replace(
        'const TYPEAHEAD_MS = 500;',
        `const TYPEAHEAD_MS = ${milliseconds};`,
      );
      assert.notEqual(mutant, baseline);
      writeFileSync(component, mutant);
      const run = spawnSync(
        'pnpm',
        ['exec', 'vitest', 'run', '--project', 'dom', suite, '-t', 'K5'],
        { encoding: 'utf8' },
      );
      outcomes.push({ milliseconds, rc: run.status });
    }
  } finally {
    writeFileSync(component, baseline);
  }
  assert.deepEqual(outcomes, [
    { milliseconds: 1, rc: 1 },
    { milliseconds: 599, rc: 1 },
  ]);
});
