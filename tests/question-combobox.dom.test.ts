import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';

import QuestionCombobox from '../src/questions/QuestionCombobox.svelte';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

if (globalThis.PointerEvent === undefined)
  Object.defineProperty(globalThis, 'PointerEvent', { value: TestPointerEvent });
if (globalThis.ResizeObserver === undefined)
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  });

HTMLElement.prototype.scrollIntoView = vi.fn();
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.releasePointerCapture = () => {};

interface MountedCombobox {
  instance: ReturnType<typeof mount>;
  root: HTMLElement;
  selected: QuestionId[];
}

const mounted: MountedCombobox[] = [];

const settle = async (): Promise<void> => {
  flushSync();
  await tick();
  flushSync();
};

const settleFloating = async (): Promise<void> => {
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await settle();
};

const setup = async (selected: QuestionId = QUESTION_IDS[0]): Promise<MountedCombobox> => {
  const root = document.createElement('main');
  root.id = 'app-root';
  document.body.append(root);
  const selections: QuestionId[] = [];
  const instance = mount(QuestionCombobox, {
    target: root,
    props: { selected, onSelect: (id: QuestionId) => selections.push(id) },
  });
  const result = { instance, root, selected: selections };
  mounted.push(result);
  await settle();
  return result;
};

const input = (): HTMLInputElement => {
  const node = document.querySelector<HTMLInputElement>('#question-combobox-input');
  if (node === null) throw new Error('combobox input missing');
  return node;
};

const trigger = (): HTMLButtonElement => {
  const node = document.querySelector<HTMLButtonElement>('[data-combobox-trigger]');
  if (node === null) throw new Error('combobox trigger missing');
  return node;
};

const listbox = (): HTMLElement => {
  const node = document.querySelector<HTMLElement>('[role="listbox"]');
  if (node === null) throw new Error('listbox missing');
  return node;
};

const options = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const highlighted = (): HTMLElement | undefined => options().find((node) => node.hasAttribute('data-highlighted'));
const selected = (): HTMLElement | undefined => options().find((node) => node.getAttribute('aria-selected') === 'true');

const keydown = async (
  node: HTMLElement,
  key: string,
  init: Omit<KeyboardEventInit, 'key'> = {},
): Promise<void> => {
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  await settle();
};

const pointer = async (
  node: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: PointerEventInit = {},
): Promise<void> => {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      ...init,
    }),
  );
  await settle();
};

const open = async (selectedId: QuestionId = QUESTION_IDS[0]): Promise<MountedCombobox> => {
  const result = await setup(selectedId);
  input().focus();
  await keydown(input(), 'ArrowDown');
  await settleFloating();
  return result;
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear();
});

afterEach(async () => {
  for (const item of mounted.splice(0)) await unmount(item.instance);
  document.body.innerHTML = '';
});

describe('QuestionCombobox bits-ui probe', () => {
  it('H1 mounts and opens under the browser-conditioned jsdom project', async () => {
    await setup();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(options()).toHaveLength(0);

    input().focus();
    await keydown(input(), 'ArrowDown');

    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toHaveLength(QUESTION_IDS.length);
    expect(document.activeElement).toBe(input());
    expect(trigger().getAttribute('data-state')).toBe('open');
  });

  it('S1-S4 expose the input semantics but lose the explicit content id', async () => {
    await setup();
    const control = input();
    const label = document.querySelector<HTMLLabelElement>('#question-combobox-label');
    expect(control.tagName).toBe('INPUT');
    expect(control.getAttribute('role')).toBe('combobox');
    expect([...control.labels]).toEqual(expect.arrayContaining([label]));
    expect(control.getAttribute('aria-labelledby')).toBe(label?.id);
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(control.getAttribute('aria-haspopup')).toBe('listbox');

    control.focus();
    await keydown(control, 'ArrowDown');
    expect(control.getAttribute('aria-expanded')).toBe('true');
    expect(control.getAttribute('aria-controls')).toBe('question-combobox-listbox');
    expect(document.getElementById('question-combobox-listbox')).toBeNull();
    expect(listbox().id).toBe('');

    await keydown(control, 'Escape');
    expect(control.getAttribute('aria-expanded')).toBe('false');
  });

  it('S5-S7 expose a named listbox, six options, selection, and active descendant', async () => {
    await open(QUESTION_IDS[2]);
    const popup = listbox();
    const nodes = options();
    expect(popup.getAttribute('aria-labelledby')).toBe('question-combobox-label');
    expect(nodes).toHaveLength(QUESTION_IDS.length);
    expect(nodes.every((node) => node.getAttribute('role') === 'option')).toBe(true);
    expect(selected()?.dataset.value).toBe(QUESTION_IDS[2]);
    expect(nodes.filter((node) => node.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(nodes.filter((node) => node.getAttribute('aria-selected') === null)).toHaveLength(5);
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[2]);
    expect(input().getAttribute('aria-activedescendant')).toBe(highlighted()?.id);
    expect(document.activeElement).toBe(input());

    await keydown(input(), 'Escape');
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
    expect(document.activeElement).toBe(input());
  });

  it('S8 uses a readonly input and exposes the selected question as its value', async () => {
    await setup(QUESTION_IDS[3]);
    expect(input().readOnly).toBe(true);
    expect(input().value).toBe(QUESTION_CATALOG[QUESTION_IDS[3]].question);
    expect(input().getAttribute('aria-autocomplete')).toBe('list');
    expect(input().getAttribute('aria-labelledby')).toBe('question-combobox-label');
  });

  it('K1-K2 opens ArrowDown and ArrowUp variants on the selected option', async () => {
    await setup(QUESTION_IDS[2]);
    input().focus();
    for (const [key, altKey] of [
      ['ArrowDown', false],
      ['ArrowDown', true],
      ['ArrowUp', false],
      ['ArrowUp', true],
    ] as const) {
      await keydown(input(), key, { altKey });
      expect(input().getAttribute('aria-expanded')).toBe('true');
      expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[2]);
      await keydown(input(), 'Escape');
    }
  });

  it('K3 gives closed Enter no action while Space opens', async () => {
    await setup();
    input().focus();
    await keydown(input(), 'Enter');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    await keydown(input(), ' ');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[0]);
  });

  it('K4 opens closed Home and End but leaves the selected option highlighted', async () => {
    await setup(QUESTION_IDS[2]);
    input().focus();
    await keydown(input(), 'Home');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[2]);
    await keydown(input(), 'Escape');
    await keydown(input(), 'End');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[2]);
  });

  it('K5 opens on printable input without typeahead, mutation, or a buffer', async () => {
    const probe = await setup(QUESTION_IDS[2]);
    input().focus();
    const original = input().value;
    await keydown(input(), 'r');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(input().value).toBe(original);
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[2]);
    await keydown(input(), 'e');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[2]);
    expect(probe.selected).toEqual([]);
  });

  it('K6 moves open Arrow keys and stops at both ends', async () => {
    await open();
    await keydown(input(), 'ArrowUp');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[0]);
    await keydown(input(), 'ArrowDown');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[1]);
    for (let index = 2; index < QUESTION_IDS.length; index++) await keydown(input(), 'ArrowDown');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS.at(-1));
    await keydown(input(), 'ArrowDown');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS.at(-1));
  });

  it('K7 moves open Home and End to the first and last options', async () => {
    await open(QUESTION_IDS[2]);
    await keydown(input(), 'End');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS.at(-1));
    await keydown(input(), 'Home');
    expect(highlighted()?.dataset.value).toBe(QUESTION_IDS[0]);
  });

  it('K8 Enter selects the highlighted option, closes, and retains input focus', async () => {
    const probe = await open();
    await keydown(input(), 'ArrowDown');
    await keydown(input(), 'Enter');
    expect(probe.selected).toEqual([QUESTION_IDS[1]]);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().value).toBe(QUESTION_CATALOG[QUESTION_IDS[1]].question);
    expect(document.activeElement).toBe(input());
  });

  it('K9 Escape closes without changing the selected value', async () => {
    const probe = await open();
    const original = input().value;
    await keydown(input(), 'ArrowDown');
    await keydown(input(), 'Escape');
    expect(probe.selected).toEqual([]);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().value).toBe(original);
    expect(document.activeElement).toBe(input());
  });

  it('K10 Tab closes without selection; jsdom leaves default focus traversal unimplemented', async () => {
    const probe = await open();
    await keydown(input(), 'ArrowDown');
    await keydown(input(), 'Tab');
    expect(probe.selected).toEqual([]);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input());
  });

  it('K11 Alt+ArrowUp closes without selection and retains input focus', async () => {
    const probe = await open();
    await keydown(input(), 'ArrowDown');
    await keydown(input(), 'ArrowUp', { altKey: true });
    expect(probe.selected).toEqual([]);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input());
  });

  it('P1 input pointerdown only focuses; trigger pointerdown opens and closes', async () => {
    await setup();
    input().focus();
    await pointer(input(), 'pointerdown');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    await pointer(trigger(), 'pointerdown');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(input());
    await pointer(trigger(), 'pointerdown');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input());
  });

  it('P2 option pointerdown preserves focus and pointerup selects then closes', async () => {
    const probe = await open();
    const next = options()[1];
    await pointer(next, 'pointerdown');
    expect(document.activeElement).toBe(input());
    await pointer(next, 'pointerup');
    expect(probe.selected).toEqual([QUESTION_IDS[1]]);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input());
  });

  it('P3 cannot observe outside dismissal under jsdom focus, pointer, or click', async () => {
    const probe = await open();
    await keydown(input(), 'ArrowDown');
    const outside = document.body.appendChild(document.createElement('button'));
    outside.textContent = 'Outside';
    outside.focus();
    await settle();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    await pointer(outside, 'pointerdown', { clientX: 100, clientY: 100 });
    outside.click();
    await settleFloating();
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(probe.selected).toEqual([]);
    expect(document.activeElement).toBe(outside);
  });

  it('B1 cannot observe scrollIntoView because jsdom never positions the floating layer', async () => {
    await open(QUESTION_IDS[2]);
    await keydown(input(), 'ArrowDown');
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('B2 emits every catalog id and no synthetic free-text value', async () => {
    const probe = await open();
    const order = [...QUESTION_IDS.slice(1), QUESTION_IDS[0]];
    for (const id of order) {
      const item = options().find((node) => node.dataset.value === id);
      if (item === undefined) throw new Error(`missing option ${id}`);
      await pointer(item, 'pointerup');
      if (id !== order.at(-1)) await keydown(input(), 'ArrowDown');
    }
    expect(probe.selected).toEqual(order);
    expect(probe.selected.every((id) => QUESTION_IDS.includes(id))).toBe(true);

    input().value = 'not-a-question-id';
    input().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }));
    await settle();
    await keydown(input(), 'Enter');
    expect(probe.selected).toEqual(order);
  });

  it('B3 reports axe violation ids with the listbox closed and open', async () => {
    await setup();
    const closed = await axe.run(document.body);
    expect(closed.violations.map(({ id }) => id)).toEqual([]);
    expect(closed.incomplete.map(({ id }) => id)).toContain('color-contrast');
    input().focus();
    await keydown(input(), 'ArrowDown');
    const opened = await axe.run(document.body);
    expect(opened.violations.map(({ id }) => id)).toEqual(['region']);
    expect(opened.incomplete.map(({ id }) => id)).toContain('color-contrast');
  });

  it('H2 portals content outside the app root with fixed wrappers and data hooks', async () => {
    const probe = await open();
    const popup = listbox();
    const wrapper = popup.parentElement;
    expect(probe.root.contains(popup)).toBe(false);
    expect(wrapper?.parentElement).toBe(document.body);
    expect(wrapper?.hasAttribute('data-bits-floating-content-wrapper')).toBe(true);
    expect(popup.hasAttribute('data-combobox-content')).toBe(true);
    expect(popup.querySelector('[role="presentation"]')?.hasAttribute('data-combobox-viewport')).toBe(
      true,
    );
    expect(input().hasAttribute('data-combobox-input')).toBe(true);
    expect(trigger().hasAttribute('data-combobox-trigger')).toBe(true);
    expect(options().every((node) => node.hasAttribute('data-combobox-item'))).toBe(true);
  });
});
