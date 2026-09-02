import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import QuestionCombobox from '../../src/questions/QuestionCombobox.svelte';
import { QUESTION_IDS, type QuestionId } from '../../src/questions/catalog.js';

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
const onSelect = vi.fn<(id: QuestionId) => void>();

const combo = (): HTMLElement => {
  const node = target.querySelector<HTMLElement>('[role="combobox"]');
  if (node === null) throw new Error('missing combobox');
  return node;
};

const options = (): HTMLElement[] => [...target.querySelectorAll<HTMLElement>('[role="option"]')];

const active = (): number => {
  const id = combo().getAttribute('aria-activedescendant');
  return options().findIndex((node) => node.id === id);
};

const key = (name: string): void => {
  combo().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  flushSync();
};

beforeEach(() => {
  target = document.body.appendChild(document.createElement('div'));
  Element.prototype.scrollIntoView = vi.fn();
  onSelect.mockClear();
});

afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  target.remove();
});

it('I07 opens closed ArrowUp at option 1 even when another option is selected', () => {
  app = mount(QuestionCombobox, {
    target,
    props: { selected: QUESTION_IDS[3], onSelect },
  });
  flushSync();
  key('ArrowUp');
  expect(active()).toBe(0);
  expect(onSelect).not.toHaveBeenCalled();
});

it('I09 opens fresh typeahead at the first catalog match', () => {
  app = mount(QuestionCombobox, {
    target,
    props: { selected: QUESTION_IDS[0], onSelect },
  });
  flushSync();
  key('w');
  expect(active()).toBe(0);
  expect(onSelect).not.toHaveBeenCalled();
});
