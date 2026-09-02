import assert from 'node:assert/strict';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const probe = 'tests/rev-m1u5-i07-i09.red.dom.test.ts';
const source = `// @vitest-environment jsdom

import { flushSync, mount } from 'svelte';
import { expect, it, vi } from 'vitest';

import QuestionCombobox from '../src/questions/QuestionCombobox.svelte';
import { QUESTION_IDS } from '../src/questions/catalog.js';

Element.prototype.scrollIntoView = vi.fn();

const render = () => {
  const target = document.body.appendChild(document.createElement('div'));
  const onSelect = vi.fn();
  mount(QuestionCombobox, { target, props: { selected: QUESTION_IDS[3], onSelect } });
  flushSync();
  const combo = target.querySelector<HTMLElement>('[role="combobox"]');
  if (combo === null) throw new Error('missing combobox');
  const active = () => {
    const id = combo.getAttribute('aria-activedescendant');
    return [...target.querySelectorAll<HTMLElement>('[role="option"]')].findIndex(
      (option) => option.id === id,
    );
  };
  const key = (name: string) => {
    combo.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    flushSync();
  };
  return { active, key, onSelect };
};

it('I07 opens closed ArrowUp at option 1 from a nonfirst selection', () => {
  const { active, key, onSelect } = render();
  key('ArrowUp');
  expect(active()).toBe(0);
  expect(onSelect).not.toHaveBeenCalled();
});

it('I09 opens fresh typeahead at the first catalog match', () => {
  const { active, key, onSelect } = render();
  key('w');
  expect(active()).toBe(0);
  expect(onSelect).not.toHaveBeenCalled();
});
`;

void test('I07 and I09 contract probes are green', () => {
  assert.equal(existsSync(probe), false, `${probe} already exists`);
  try {
    writeFileSync(probe, source);
    const args = ['exec', 'vitest', 'run', '--project', 'dom', probe];
    if (process.env.M1U5_ROW !== undefined) args.push('-t', process.env.M1U5_ROW);
    const run = spawnSync('pnpm', args, { encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  } finally {
    if (existsSync(probe)) unlinkSync(probe);
  }
});
