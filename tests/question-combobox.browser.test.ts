// The combobox predicates jsdom can only stub, driven in real Chromium (`pnpm test:browser`).
//
// jsdom has no accessibility tree, no layout, no native focus traversal and no real timer
// scheduling, so S1/S7, K5, K8/K10, P2/P3, B1 and B3 rested on its stand-ins. Here input arrives
// as real key and pointer events, focus is read after each, the accessible name and the
// activedescendant relation come from Chromium's own accessibility tree, and the typeahead
// buffer expires on the real clock.

import axe from 'axe-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands, userEvent } from 'vitest/browser';

import { EN } from '../src/i18n/en.js';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import QuestionCombobox from '../src/questions/QuestionCombobox.svelte';
import type { AxCombobox } from './support/ax-commands.js';

declare module 'vitest/browser' {
  interface BrowserCommands {
    axCombobox: () => Promise<AxCombobox>;
  }
}

const LABELS = QUESTION_IDS.map((id) => QUESTION_CATALOG[id].question);
const TYPEAHEAD_MS = 500;

let host: HTMLElement;
let app: Record<string, unknown> | undefined;
let onSelect: ReturnType<typeof vi.fn<(id: QuestionId) => void>>;

const render = (selected: QuestionId | null = null): void => {
  host = document.body.appendChild(document.createElement('div'));
  // An outside pointer target above the widget, where the open list cannot cover it.
  const before = host.appendChild(document.createElement('button'));
  before.id = 'before';
  before.textContent = 'before';
  const widget = host.appendChild(document.createElement('div'));
  // The next tabbable element, for native Tab traversal.
  const next = host.appendChild(document.createElement('button'));
  next.id = 'next';
  next.textContent = 'next';
  onSelect = vi.fn<(id: QuestionId) => void>();
  app = mount(QuestionCombobox, { target: widget, props: { selected, onSelect } });
  flushSync();
};

const box = (): HTMLElement => {
  const found = host.querySelector<HTMLElement>('[role="combobox"]');
  if (found === null) throw new Error('no combobox rendered');
  return found;
};
const options = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('[role="option"]')];
const activeIndex = (): number =>
  options().findIndex((option) => option.id === box().getAttribute('aria-activedescendant'));
const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  render();
});

afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  host.remove();
});

describe('combobox in real Chromium', () => {
  it('S1 takes its accessible name from the label, not from its value', async () => {
    if (app !== undefined) void unmount(app);
    host.remove();
    const selected = QUESTION_IDS[2] ?? QUESTION_IDS[0];
    render(selected);
    const ax = await commands.axCombobox();
    expect(ax.name).toBe(EN.LABELS.questionLabel);
    expect(ax.name).not.toBe(QUESTION_CATALOG[selected].question);
  });

  it('S7 announces the active option through activedescendant while focus never moves', async () => {
    box().focus();
    expect((await commands.axCombobox()).activeDescendant).toBeNull();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(box());
    let ax = await commands.axCombobox();
    expect(ax.expanded).toBe(true);
    expect(ax.activeDescendant).toBe(LABELS[0]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(box());
    ax = await commands.axCombobox();
    expect(ax.activeDescendant).toBe(LABELS[1]);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(box());
    ax = await commands.axCombobox();
    expect(ax.expanded).toBe(false);
    expect(ax.activeDescendant).toBeNull();
  });

  // The prefixes are derived from the catalog, never written down: question text is payload.
  const lower = LABELS.map((label) => label.toLowerCase());
  const target = lower.findIndex(
    (label, index) =>
      index > lower.findIndex((other) => other[0] === label[0]) &&
      lower.findIndex((other) => other.startsWith(label.slice(0, 3))) === index,
  );
  const prefix = (lower[target] ?? '').slice(0, 3);

  it('K5 a prefix typed inside 500 ms reaches the first question it starts', async () => {
    expect(target).toBeGreaterThan(0);
    box().focus();
    for (const char of prefix) {
      await userEvent.keyboard(char);
      await pause(TYPEAHEAD_MS / 5);
    }
    expect(activeIndex()).toBe(target);
    expect(document.activeElement).toBe(box());
  });

  it('K5 a pause past 500 ms expires the buffer, so the next key starts a new prefix', async () => {
    box().focus();
    const [first = '', second = ''] = prefix;
    await userEvent.keyboard(first);
    const afterFirst = activeIndex();
    expect(afterFirst).toBe(lower.findIndex((label) => label.startsWith(first)));
    await pause(TYPEAHEAD_MS + 150);
    await userEvent.keyboard(second);
    const fresh = lower.findIndex((label) => label.startsWith(second));
    // A fresh `second` either names its own first question or matches nothing and stays put;
    // either way it is not the two-key prefix the expired buffer would have formed.
    expect(activeIndex()).toBe(fresh >= 0 ? fresh : afterFirst);
    expect(activeIndex()).not.toBe(lower.findIndex((label) => label.startsWith(first + second)));
  });

  it('K8 Enter emits the active question once, closes, and keeps focus', async () => {
    box().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(QUESTION_IDS[1]);
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(box());
  });

  it('K10 Tab emits once, closes, and lets native traversal move focus on', async () => {
    box().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await userEvent.tab();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(QUESTION_IDS[1]);
    expect(box().getAttribute('aria-expanded')).toBe('false');
    // Focus reaching the next tabbable element is what proves no preventDefault.
    expect(document.activeElement?.id).toBe('next');
  });

  it('P2 a pointer click on an option emits it once, closes, and returns focus', async () => {
    box().focus();
    await userEvent.keyboard('{ArrowDown}');
    const option = options()[3];
    if (option === undefined) throw new Error('fewer than four options');
    await userEvent.click(option);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(QUESTION_IDS[3]);
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(box());
  });

  it('P3 a pointer press outside closes the list and emits nothing', async () => {
    box().focus();
    await userEvent.keyboard('{ArrowDown}');
    const outside = host.querySelector<HTMLElement>('#before');
    if (outside === null) throw new Error('no outside target');
    await userEvent.click(outside);
    expect(onSelect).not.toHaveBeenCalled();
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(outside);
  });

  it('B1 scrolls each newly active option into view through the native method', async () => {
    const native = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
      ?.value as Element['scrollIntoView'];
    const calls: { receiver: Element; args: unknown[] }[] = [];
    Element.prototype.scrollIntoView = function (this: Element, ...args: unknown[]) {
      calls.push({ receiver: this, args });
      native.apply(this, args as [ScrollIntoViewOptions]);
    };
    try {
      box().focus();
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{End}');
      const last = options().at(-1);
      expect(calls.at(-1)?.receiver).toBe(last);
      expect(calls.at(-1)?.args).toEqual([{ block: 'nearest' }]);
      // Preserved, not stubbed: the option the native call scrolled to is inside the list's box.
      const list = host.querySelector<HTMLElement>('[role="listbox"]');
      if (list === null || last === undefined) throw new Error('no list rendered');
      const outer = list.getBoundingClientRect();
      const inner = last.getBoundingClientRect();
      expect(inner.top).toBeGreaterThanOrEqual(outer.top - 1);
      expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + 1);
    } finally {
      Element.prototype.scrollIntoView = native;
    }
  });

  it('B3 reports no axe violation closed or open, with real layout', async () => {
    const closed = await axe.run(host);
    expect(closed.violations.map((violation) => violation.id)).toEqual([]);
    box().focus();
    await userEvent.keyboard('{ArrowDown}');
    const open = await axe.run(host);
    expect(open.violations.map((violation) => violation.id)).toEqual([]);
  });
});
