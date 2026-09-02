// @vitest-environment jsdom
// Predicate suite for `.agent/contracts/m1u5.md`. Test names carry the contract's
// predicate ids, so a failure names the breached predicate.

import axe from 'axe-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import QuestionCombobox from '../src/questions/QuestionCombobox.svelte';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';

const LABELS = QUESTION_IDS.map((id) => QUESTION_CATALOG[id].question);

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let onSelect: Mock<(id: QuestionId) => void>;
let scrollIntoView: Mock<(arg?: boolean | ScrollIntoViewOptions) => void>;

const render = (selected: QuestionId | null = null): HTMLElement => {
  app = mount(QuestionCombobox, { target, props: { selected, onSelect } });
  flushSync();
  return target;
};

const combo = (): HTMLElement => {
  const el = target.querySelector<HTMLElement>('[role="combobox"]');
  if (el === null) throw new Error('no combobox rendered');
  return el;
};

const listbox = (): HTMLElement => {
  const el = target.querySelector<HTMLElement>('[role="listbox"]');
  if (el === null) throw new Error('no listbox rendered');
  return el;
};

const options = (): HTMLElement[] => [...target.querySelectorAll<HTMLElement>('[role="option"]')];

const optionAt = (index: number): HTMLElement => {
  const option = options()[index];
  if (option === undefined) throw new Error(`no option at ${String(index)}`);
  return option;
};

/** Index of the option `aria-activedescendant` points at, or -1 when closed. */
const active = (): number => {
  const id = combo().getAttribute('aria-activedescendant');
  return id === null ? -1 : options().findIndex((option) => option.id === id);
};

const isOpen = (): boolean => combo().getAttribute('aria-expanded') === 'true';

const key = (name: string, modifiers: { altKey?: boolean } = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  combo().dispatchEvent(event);
  flushSync();
  return event;
};

const click = (el: HTMLElement): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  flushSync();
};

const selectedIds = (): string[] => onSelect.mock.calls.map(([id]) => String(id));

beforeEach(() => {
  target = document.body.appendChild(document.createElement('div'));
  onSelect = vi.fn<(id: QuestionId) => void>();
  scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
  // jsdom implements no scrolling; the widget calls this unguarded because every
  // browser provides it.
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  target.remove();
  vi.useRealTimers();
});

describe('S structure', () => {
  it('S1 names the combobox from its visible label, not from its value', () => {
    render(QUESTION_IDS[0]);
    const labelledby = combo().getAttribute('aria-labelledby');
    expect(labelledby).not.toBeNull();
    const label = document.getElementById(String(labelledby));
    expect(label?.textContent?.trim()).toBeTruthy();
    expect(label?.textContent).not.toBe(LABELS[0]);
  });

  it('S2 tracks popup state in aria-expanded', () => {
    render();
    expect(combo().getAttribute('aria-expanded')).toBe('false');
    key('ArrowDown');
    expect(combo().getAttribute('aria-expanded')).toBe('true');
    key('Escape');
    expect(combo().getAttribute('aria-expanded')).toBe('false');
  });

  it('S3 points aria-controls at the listbox id in both states', () => {
    render();
    expect(combo().getAttribute('aria-controls')).toBe(listbox().id);
    key('ArrowDown');
    expect(combo().getAttribute('aria-controls')).toBe(listbox().id);
  });

  it('S4 omits aria-haspopup because the combobox role implies listbox', () => {
    render();
    expect(combo().hasAttribute('aria-haspopup')).toBe(false);
  });

  it('S5 renders a named listbox owning the six catalog options in order', () => {
    render();
    key('ArrowDown');
    expect(listbox().getAttribute('aria-labelledby')).toBe(combo().getAttribute('aria-labelledby'));
    expect(options().map((o) => o.textContent?.trim())).toEqual(LABELS);
  });

  it('S6 marks only the selected option aria-selected', () => {
    render(QUESTION_IDS[2]);
    key('ArrowDown');
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('S7 keeps DOM focus on the combobox and moves aria-activedescendant', () => {
    render(QUESTION_IDS[0]);
    combo().focus();
    expect(combo().hasAttribute('aria-activedescendant')).toBe(false);
    key('ArrowDown');
    expect(combo().getAttribute('aria-activedescendant')).toBe(optionAt(0).id);
    key('ArrowDown');
    expect(combo().getAttribute('aria-activedescendant')).toBe(optionAt(1).id);
    expect(document.activeElement).toBe(combo());
    key('Escape');
    expect(combo().hasAttribute('aria-activedescendant')).toBe(false);
    expect(document.activeElement).toBe(combo());
  });

  it('S8 shows the selected question, a prompt when null, and no focusable descendant', () => {
    render(QUESTION_IDS[4]);
    expect(combo().textContent?.trim()).toBe(LABELS[4]);
    expect(combo().querySelector('[tabindex]')).toBeNull();
    void unmount(app as Record<string, unknown>);
    app = undefined;
    render(null);
    const prompt = combo().textContent?.trim() ?? '';
    expect(prompt).toBeTruthy();
    expect(LABELS).not.toContain(prompt);
  });
});

describe('K keyboard, closed', () => {
  it('K1 opens on ArrowDown and Alt+ArrowDown at the selection, emitting nothing', () => {
    render(QUESTION_IDS[3]);
    key('ArrowDown');
    expect(isOpen()).toBe(true);
    expect(active()).toBe(3);
    key('Escape');
    key('ArrowDown', { altKey: true });
    expect(isOpen()).toBe(true);
    expect(active()).toBe(3);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K2 opens on ArrowUp at option 1 and ignores Alt+ArrowUp', () => {
    render();
    key('ArrowUp');
    expect(isOpen()).toBe(true);
    expect(active()).toBe(0);
    key('Escape');
    key('ArrowUp', { altKey: true });
    expect(isOpen()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K3 opens on Enter and on Space without emitting', () => {
    render(QUESTION_IDS[1]);
    key('Enter');
    expect(isOpen()).toBe(true);
    key('Escape');
    key(' ');
    expect(isOpen()).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K4 opens on Home at option 1 and on End at option 6', () => {
    render();
    key('Home');
    expect(active()).toBe(0);
    key('Escape');
    key('End');
    expect(active()).toBe(5);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K5 opens on a printable key and runs a 500 ms prefix buffer', () => {
    vi.useFakeTimers();
    render(QUESTION_IDS[0]);
    // "Is there a recommendation?" is the only label starting with `i`.
    key('i');
    expect(isOpen()).toBe(true);
    expect(active()).toBe(5);
    vi.advanceTimersByTime(600);
    // Same-character repeats cycle; every search starts after the active option.
    key('w');
    expect(active()).toBe(0);
    key('w');
    expect(active()).toBe(1);
    key('w');
    expect(active()).toBe(2);
    // A prefix no label carries leaves the active option where it was.
    key('z');
    expect(active()).toBe(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K5 matches a multi-character prefix case-insensitively', () => {
    vi.useFakeTimers();
    render(QUESTION_IDS[0]);
    // "What does a dosage-reduction have?" is the only `wha` label.
    key('W');
    key('h');
    key('A');
    expect(active()).toBe(2);
  });
});

describe('K keyboard, open', () => {
  it('K6 moves one option per arrow and clamps at both ends', () => {
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    expect(active()).toBe(0);
    key('ArrowUp');
    expect(active()).toBe(0);
    for (let i = 0; i < 7; i += 1) key('ArrowDown');
    expect(active()).toBe(5);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K7 jumps to the first and last option on Home and End', () => {
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    key('End');
    expect(active()).toBe(5);
    key('Home');
    expect(active()).toBe(0);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('K8 commits the active option on Enter and keeps focus', () => {
    render(QUESTION_IDS[0]);
    combo().focus();
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    expect(selectedIds()).toEqual([QUESTION_IDS[1]]);
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(combo());
  });

  it('K9 cancels on Escape and resets the active option to the selection', () => {
    render(QUESTION_IDS[1]);
    key('ArrowDown');
    key('ArrowDown');
    expect(active()).toBe(2);
    key('Escape');
    expect(isOpen()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    key('ArrowDown');
    expect(active()).toBe(1);
  });

  it('K10 commits on Tab without preventing default', () => {
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    key('ArrowDown');
    const event = key('Tab');
    expect(selectedIds()).toEqual([QUESTION_IDS[1]]);
    expect(isOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it('K11 commits on Alt+ArrowUp', () => {
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    key('End');
    key('ArrowUp', { altKey: true });
    expect(selectedIds()).toEqual([QUESTION_IDS[5]]);
    expect(isOpen()).toBe(false);
  });
});

describe('P pointer', () => {
  it('P1 toggles the listbox on a combobox click without emitting', () => {
    render();
    click(combo());
    expect(isOpen()).toBe(true);
    click(combo());
    expect(isOpen()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('P2 commits the clicked option once and returns focus', () => {
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    click(optionAt(4));
    expect(selectedIds()).toEqual([QUESTION_IDS[4]]);
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(combo());
  });

  it('P3 cancels on focusout to a node outside the widget', () => {
    const outside = document.body.appendChild(document.createElement('button'));
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    key('ArrowDown');
    combo().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    flushSync();
    expect(isOpen()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    outside.remove();
  });
});

describe('B behaviour', () => {
  it('B1 scrolls every newly active option into view', () => {
    render(QUESTION_IDS[0]);
    key('ArrowDown');
    const opened = scrollIntoView.mock.calls.length;
    expect(opened).toBeGreaterThan(0);
    key('ArrowDown');
    expect(scrollIntoView.mock.calls.length).toBe(opened + 1);
    expect(scrollIntoView.mock.calls.at(-1)?.[0]).toEqual({ block: 'nearest' });
  });

  it('B2 emits catalog ids only, and holds no selection state of its own', () => {
    render(QUESTION_IDS[0]);
    for (const name of ['ArrowDown', 'End', 'Home', 'w', 'i', '?', 'Enter']) key(name);
    key('ArrowDown');
    for (const name of ['ArrowDown', 'Tab']) key(name);
    expect(selectedIds().length).toBeGreaterThan(0);
    for (const id of selectedIds()) expect(QUESTION_IDS).toContain(id);
    // Controlled leaf: the prop never changed, so the displayed question did not.
    expect(combo().textContent?.trim()).toBe(LABELS[0]);
  });

  it('B3 reports no axe violation closed or open', async () => {
    render(QUESTION_IDS[0]);
    const closed = await axe.run(target);
    expect(closed.violations.map((v) => v.id)).toEqual([]);
    key('ArrowDown');
    const open = await axe.run(target);
    expect(open.violations.map((v) => v.id)).toEqual([]);
    expect(open.incomplete.map((v) => v.id).filter((id) => id !== 'color-contrast')).toEqual([]);
  });
});
