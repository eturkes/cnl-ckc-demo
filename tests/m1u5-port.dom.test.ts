// @vitest-environment jsdom
// Contract-only additions: `.agent/archive/contracts/m1u5.md` S2/S8/K5/K6/B1/B2.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import QuestionCombobox from '../src/questions/QuestionCombobox.svelte';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';

const LABELS = QUESTION_IDS.map((id) => QUESTION_CATALOG[id].question);
const LOWER = LABELS.map((label) => label.toLowerCase());
const SELECTIONS = [null, ...QUESTION_IDS];

type ScrollCall = { option: Element; argument: boolean | ScrollIntoViewOptions | undefined };
let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let onSelect: ReturnType<typeof vi.fn<(id: QuestionId) => void>>;
let scrolls: ScrollCall[];
let originalScroll: Element['scrollIntoView'];

const render = (selected: QuestionId | null = null): void => {
  app = mount(QuestionCombobox, { target, props: { selected, onSelect } });
  flushSync();
};
const box = (): HTMLElement => {
  const found = target.querySelector<HTMLElement>('[role="combobox"]');
  if (found === null) throw new Error('combobox missing');
  return found;
};
const options = (): HTMLElement[] => [...target.querySelectorAll<HTMLElement>('[role="option"]')];
const active = (): number =>
  options().findIndex((option) => option.id === box().getAttribute('aria-activedescendant'));
const key = (name: string, altKey = false): void => {
  box().dispatchEvent(new KeyboardEvent('keydown', { key: name, altKey, bubbles: true }));
  flushSync();
};
const click = (node: HTMLElement): void => {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  flushSync();
};
const hidden = (element: HTMLElement): boolean => {
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || style.display === 'none' || style.visibility === 'hidden') return true;
  }
  return false;
};

beforeEach(() => {
  target = document.body.appendChild(document.createElement('div'));
  onSelect = vi.fn<(id: QuestionId) => void>();
  scrolls = [];
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    ?.value as Element['scrollIntoView'];
  Element.prototype.scrollIntoView = function (argument) {
    scrolls.push({ option: this, argument });
  };
});
afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  target.remove();
  Element.prototype.scrollIntoView = originalScroll;
  vi.useRealTimers();
});

describe('m1u5 uncovered contract constituents', () => {
  it('S2 aria-expanded agrees with actual popup visibility after opening and cancellation', () => {
    render();
    for (const open of [false, true, false, true, false]) {
      const popup = target.querySelector<HTMLElement>('[role="listbox"]');
      expect(box().getAttribute('aria-expanded')).toBe(String(open));
      expect(popup === null || hidden(popup)).toBe(!open);
      if (open) key('Escape');
      else key('ArrowDown');
    }
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(SELECTIONS)(
    'S8 has no naturally or explicitly focusable descendant for %s',
    (selected) => {
      render(selected);
      const descendants = [...box().querySelectorAll<HTMLElement>('*')];
      for (const descendant of descendants) {
        expect(descendant.tabIndex).toBeLessThan(0);
        descendant.focus();
        expect(document.activeElement).not.toBe(descendant);
      }
      if (selected !== null)
        expect(box().textContent?.trim()).toBe(QUESTION_CATALOG[selected].question);
    },
  );

  it('K5 starts at the first case-insensitive match and repeated initials cycle with wrap', () => {
    vi.useFakeTimers();
    render(QUESTION_IDS.at(-1) ?? null);
    const initials = [...new Set(LOWER.map((label) => label[0] ?? ''))];
    expect(initials.every((initial) => initial.length === 1)).toBe(true);
    for (const initial of initials) {
      vi.advanceTimersByTime(500);
      key('Escape');
      const matching = LOWER.flatMap((label, index) => (label.startsWith(initial) ? [index] : []));
      key(initial.toUpperCase());
      expect(active()).toBe(matching[0]);
      for (let repeat = 1; repeat <= matching.length + 1; repeat += 1) {
        key(initial.toUpperCase());
        expect(active()).toBe(matching[repeat % matching.length]);
      }
    }
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(QUESTION_IDS)(
    'K6 every arrow moves exactly one option and clamps from %s',
    (selected) => {
      render(selected);
      key('ArrowDown');
      let expected = QUESTION_IDS.indexOf(selected);
      expect(active()).toBe(expected);
      for (let count = 0; count <= QUESTION_IDS.length; count += 1) {
        key('ArrowDown');
        expected = Math.min(expected + 1, QUESTION_IDS.length - 1);
        expect(active()).toBe(expected);
      }
      for (let count = 0; count <= QUESTION_IDS.length; count += 1) {
        key('ArrowUp');
        expected = Math.max(expected - 1, 0);
        expect(active()).toBe(expected);
      }
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  it('B1 every active-option change scrolls that option with nearest block alignment', () => {
    vi.useFakeTimers();
    render();
    const change = (name: string, expected: number): void => {
      const count = scrolls.length;
      key(name);
      expect(active()).toBe(expected);
      expect(scrolls.length).toBeGreaterThan(count);
      for (const call of scrolls.slice(count)) {
        expect(call.option).toBe(options()[expected]);
        expect(call.argument).toEqual({ block: 'nearest' });
      }
    };
    change('ArrowDown', 0);
    for (let index = 1; index < QUESTION_IDS.length; index += 1) change('ArrowDown', index);
    for (let index = QUESTION_IDS.length - 2; index >= 0; index -= 1) change('ArrowUp', index);
    change('End', QUESTION_IDS.length - 1);
    change('Home', 0);
    const different = LOWER.findIndex((label) => label[0] !== LOWER[0]?.[0]);
    expect(different).toBeGreaterThan(0);
    change((LOWER[different]?.[0] ?? '').toUpperCase(), different);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(SELECTIONS)(
    'B2 generated mixed input sequences emit catalog ids only for %s',
    (selected) => {
      render(selected);
      vi.useFakeTimers();
      const displayed = box().textContent;
      const keys = [
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End',
        'Enter',
        ' ',
        'Escape',
        'Tab',
        'a',
        'W',
        'h',
        'z',
        '?',
        '1',
        'é',
        '🙂',
        'F1',
        'Backspace',
        'Delete',
      ];
      let seed = 0x5e1ec7;
      const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
      };
      for (let sequence = 0; sequence < 16; sequence += 1) {
        key('Escape');
        for (let step = 0; step < 32; step += 1) {
          const action = next() % (keys.length + 3);
          if (action < keys.length) key(keys[action] ?? '', next() % 4 === 0);
          else if (action === keys.length) click(box());
          else if (action === keys.length + 1) {
            const option = options()[next() % QUESTION_IDS.length];
            if (box().getAttribute('aria-expanded') === 'true' && option !== undefined)
              click(option);
          } else vi.advanceTimersByTime(next() % 1001);
          for (const [id] of onSelect.mock.calls) expect(QUESTION_IDS).toContain(id);
          expect(box().textContent).toBe(displayed);
        }
      }
      expect(onSelect).toHaveBeenCalled();
    },
  );
});
