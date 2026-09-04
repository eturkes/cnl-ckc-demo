// @vitest-environment jsdom

import axe from 'axe-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import type { BootOutcome } from '../src/engine/client.js';
import type { EngineContract, EngineError, LimitKind, PlSolution } from '../src/engine/protocol.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';
import {
  DemoController,
  type DemoEngine,
  type DemoState,
} from '../src/demo/DemoController.svelte.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };
const ID = QUESTION_IDS[0];

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

class ViewEngine implements DemoEngine {
  readonly bootOutcome = deferred<BootOutcome>();

  boot(): Promise<BootOutcome> {
    return this.bootOutcome.promise;
  }

  ask(): Promise<AnswerResult> {
    return new Promise(() => undefined);
  }

  dispose(): void {}
}

const solution = (index: number, prefix = 'allowed'): PlSolution => ({
  bindings: { Answer: { kind: 'atom', value: `binding-poison-${String(index)}` } },
  display: { Answer: `${prefix}-display-${String(index)}` },
});

const answer = (id: QuestionId, count = 1, prefix = 'allowed'): AnswerResult => ({
  kind: 'answer',
  id,
  serialized: `${prefix}-serialized`,
  solutions: Array.from({ length: count }, (_, index) => solution(index, prefix)),
});

const failure = (id: QuestionId, serialized = 'no'): AnswerResult => ({
  kind: 'failure',
  id,
  serialized,
});

const limited = (limit: LimitKind, count = 0): AnswerResult => ({
  kind: 'limit',
  id: ID,
  limit,
  serialized: 'partial-serialized',
  solutions: Array.from({ length: count }, (_, index) => solution(index, 'partial')),
});

const cancelled = (count = 0): AnswerResult => ({
  kind: 'cancelled',
  id: ID,
  serialized: 'cancelled-serialized',
  solutions: Array.from({ length: count }, (_, index) => solution(index, 'cancelled')),
});

const failed = (message = 'view-error-sentinel'): AnswerResult => ({
  kind: 'error',
  id: ID,
  error: { code: 'worker', message },
});

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let controller: DemoController;
let engine: ViewEngine;

const render = (): void => {
  engine = new ViewEngine();
  controller = new DemoController(engine);
  app = mount(App, { target, props: { controller } });
  flushSync();
};

const setState = (state: DemoState): void => {
  controller.state = state;
  flushSync();
};

const roles = (role: string): HTMLElement[] => [
  ...target.querySelectorAll<HTMLElement>(`[role="${role}"]`),
];

const role = (name: string): HTMLElement => {
  const matches = roles(name);
  if (matches.length !== 1)
    throw new Error(`expected one ${name}, found ${String(matches.length)}`);
  return matches[0] as HTMLElement;
};

const answerRegion = (): HTMLElement => {
  const region = target.querySelector<HTMLElement>('[aria-busy]');
  if (region === null) throw new Error('answer region has no aria-busy state');
  return region;
};

const text = (node: Node = target): string => node.textContent?.replace(/\s+/gu, ' ').trim() ?? '';

const buttonNamed = (name: RegExp): HTMLButtonElement => {
  const matches = [...target.querySelectorAll<HTMLButtonElement>('button')].filter((button) =>
    name.test(text(button)),
  );
  if (matches.length !== 1)
    throw new Error(`expected one ${String(name)} button, found ${String(matches.length)}`);
  return matches[0] as HTMLButtonElement;
};

const radios = (): HTMLInputElement[] => [
  ...target.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
];

beforeEach(() => {
  target = document.body.appendChild(document.createElement('div'));
  render();
});

afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  controller.dispose();
  target.remove();
});

describe('view states and accessibility', () => {
  it('V1 mounts exactly one unfocusable status region before its first update', () => {
    expect(roles('status')).toHaveLength(1);
    const status = role('status');
    status.focus();
    expect(document.activeElement).not.toBe(status);
    expect(status.tabIndex).toBe(-1);
  });

  it('V2 mounts one alert and renders error text there alone, never in status', () => {
    const sentinel = 'unique-engine-error-927';
    expect(roles('alert')).toHaveLength(1);
    setState({ kind: 'settled', id: ID, result: failed(sentinel) });

    expect(text(role('alert'))).toContain(sentinel);
    expect(text(role('status'))).not.toContain(sentinel);
    expect(text().split(sentinel)).toHaveLength(2);
  });

  it('V3 gives every enumerated controller state its own visible text label', () => {
    const bootError: EngineError = { code: 'boot', message: 'boot-label-sentinel' };
    const cases: readonly [string, DemoState, RegExp][] = [
      ['booting', { kind: 'booting' }, /boot|load|start/iu],
      ['boot-error', { kind: 'boot-error', error: bootError }, /boot|start|fail|error/iu],
      ['idle', { kind: 'idle', contract: CONTRACT }, /ready/iu],
      ['running', { kind: 'running', id: ID }, /run|answer|query|work/iu],
      ['cancelling', { kind: 'cancelling', id: ID }, /cancell/iu],
      ['answer', { kind: 'settled', id: ID, result: answer(ID) }, /answer|solution/iu],
      ['failure', { kind: 'settled', id: ID, result: failure(ID) }, /no proof/iu],
      ['limit', { kind: 'settled', id: ID, result: limited('depth') }, /limit|depth/iu],
      ['cancelled', { kind: 'settled', id: ID, result: cancelled() }, /cancelled/iu],
      ['error', { kind: 'settled', id: ID, result: failed() }, /error|fail|problem/iu],
    ];
    const labels = new Set<string>();

    for (const [name, state, expected] of cases) {
      setState(state);
      const visible = text();
      expect(visible, name).toMatch(expected);
      labels.add(visible);
    }
    expect(labels.size).toBe(cases.length);
  });

  it.each(['stack', 'depth', 'inference', 'wall-clock', 'answer-cap', 'heap'] as const)(
    'V4 names %s and labels retained solutions as partial',
    (kind) => {
      setState({ kind: 'settled', id: ID, result: limited(kind, 2) });
      const visible = text(answerRegion());

      expect(visible).toMatch(new RegExp(kind.replace('-', '[- ]'), 'iu'));
      expect(visible).toMatch(/partial/iu);
      expect(visible).toMatch(/\b2\b/u);
    },
  );

  it('V4 never relabels a zero-retained limit as no answers or no proof', () => {
    setState({ kind: 'settled', id: ID, result: limited('inference') });
    const visible = text(answerRegion());

    expect(visible).toMatch(/partial/iu);
    expect(visible).not.toMatch(/no answers?|no proof/iu);
  });

  it('V5 announces cancellation and reports the partial count in the answer region', () => {
    setState({ kind: 'settled', id: ID, result: cancelled(2) });

    expect(text()).toMatch(/cancelled/iu);
    expect(text(answerRegion())).toMatch(/partial/iu);
    expect(text(answerRegion())).toMatch(/\b2\b/u);
  });

  it('V6 renders an empty clinical result as no proof, never as an answer row', () => {
    setState({ kind: 'settled', id: ID, result: failure(ID, 'solutions([])') });
    expect(text()).toMatch(/no proof/iu);
    expect(radios()).toHaveLength(0);
    expect(target.querySelector('fieldset')).toBeNull();
  });

  it('V7 renders many answers as one labelled native radio group with index zero checked', () => {
    controller.solutionIndex = 0;
    setState({ kind: 'settled', id: ID, result: answer(ID, 3, 'choice') });
    const fields = [...target.querySelectorAll<HTMLFieldSetElement>('fieldset')];
    const choices = radios();

    expect(fields).toHaveLength(1);
    expect(text(fields[0]?.querySelector('legend') ?? document.createTextNode(''))).toBeTruthy();
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((choice) => choice.name)).size).toBe(1);
    expect(choices[0]?.name).toBeTruthy();
    expect(choices.filter((choice) => choice.checked)).toEqual([choices[0]]);
    for (const choice of choices) {
      expect(choice.hasAttribute('tabindex')).toBe(false);
      expect(choice.labels?.length).toBeGreaterThan(0);
    }
  });

  it('V7 renders one answer without a group and zero answers as terminal state alone', () => {
    controller.solutionIndex = 0;
    setState({ kind: 'settled', id: ID, result: answer(ID, 1, 'sole') });
    expect(radios()).toHaveLength(0);
    expect(target.querySelector('fieldset')).toBeNull();
    expect(text(answerRegion())).toMatch(/sole-(?:serialized|display-0)/u);

    controller.solutionIndex = -1;
    setState({ kind: 'settled', id: ID, result: failure(ID) });
    expect(radios()).toHaveLength(0);
    expect(target.querySelector('fieldset')).toBeNull();
    expect(text()).toMatch(/no proof/iu);
  });

  it('V8 uses native button disabled states and offers Retry for engine errors', () => {
    controller.select(ID);
    flushSync();
    const bootRun = buttonNamed(/^run\b/iu);
    expect(bootRun.type).toBe('button');
    expect(bootRun.disabled).toBe(true);
    expect(bootRun.hasAttribute('aria-disabled')).toBe(false);

    setState({ kind: 'idle', contract: CONTRACT });
    expect(buttonNamed(/^run\b/iu).disabled).toBe(false);
    expect(buttonNamed(/^cancel\b/iu).disabled).toBe(true);

    setState({ kind: 'running', id: ID });
    expect(buttonNamed(/^run\b/iu).disabled).toBe(true);
    const cancelButton = buttonNamed(/^cancel\b/iu);
    expect(cancelButton.type).toBe('button');
    expect(cancelButton.disabled).toBe(false);
    expect(cancelButton.hasAttribute('aria-disabled')).toBe(false);

    setState({ kind: 'settled', id: ID, result: answer(ID) });
    expect(buttonNamed(/^run\b/iu).disabled).toBe(false);
    expect(buttonNamed(/^cancel\b/iu).disabled).toBe(true);
    expect(
      [...target.querySelectorAll('button')].some((button) => /retry/iu.test(text(button))),
    ).toBe(false);

    setState({ kind: 'settled', id: ID, result: failed() });
    const retry = buttonNamed(/^retry\b/iu);
    expect(retry.type).toBe('button');
    expect(retry.disabled).toBe(false);
    expect(retry.hasAttribute('aria-disabled')).toBe(false);

    setState({ kind: 'boot-error', error: { code: 'boot', message: 'retry boot' } });
    expect(buttonNamed(/^retry\b/iu).disabled).toBe(false);
  });

  it('V8 disables Run without a selection even after boot', () => {
    setState({ kind: 'idle', contract: CONTRACT });
    expect(controller.selected).toBeNull();
    expect(buttonNamed(/^run\b/iu).disabled).toBe(true);
    expect(buttonNamed(/^cancel\b/iu).disabled).toBe(true);
  });

  it('V9 preserves unrelated focus and moves retired Cancel focus to Run or Retry', async () => {
    controller.select(ID);
    setState({ kind: 'idle', contract: CONTRACT });
    const combo = role('combobox');
    combo.focus();
    setState({ kind: 'running', id: ID });
    expect(document.activeElement).toBe(combo);
    setState({ kind: 'settled', id: ID, result: answer(ID) });
    expect(document.activeElement).toBe(combo);
    setState({ kind: 'running', id: ID });
    setState({ kind: 'cancelling', id: ID });
    setState({ kind: 'settled', id: ID, result: cancelled() });
    expect(document.activeElement).toBe(combo);

    setState({ kind: 'running', id: ID });
    buttonNamed(/^cancel\b/iu).focus();
    setState({ kind: 'settled', id: ID, result: answer(ID) });
    await Promise.resolve();
    expect(document.activeElement).toBe(buttonNamed(/^run\b/iu));

    setState({ kind: 'running', id: ID });
    buttonNamed(/^cancel\b/iu).focus();
    setState({ kind: 'settled', id: ID, result: failed() });
    await Promise.resolve();
    expect(document.activeElement).toBe(buttonNamed(/^retry\b/iu));
  });

  it('V10 marks the answer region busy only for running and cancelling', () => {
    const cases: readonly [DemoState, string][] = [
      [{ kind: 'booting' }, 'false'],
      [{ kind: 'idle', contract: CONTRACT }, 'false'],
      [{ kind: 'running', id: ID }, 'true'],
      [{ kind: 'cancelling', id: ID }, 'true'],
      [{ kind: 'settled', id: ID, result: answer(ID) }, 'false'],
      [{ kind: 'settled', id: ID, result: failure(ID) }, 'false'],
      [{ kind: 'settled', id: ID, result: limited('depth') }, 'false'],
      [{ kind: 'settled', id: ID, result: cancelled() }, 'false'],
      [{ kind: 'settled', id: ID, result: failed() }, 'false'],
    ];

    for (const [state, busy] of cases) {
      setState(state);
      expect(answerRegion().getAttribute('aria-busy'), state.kind).toBe(busy);
    }
  });

  it('V11 has zero axe violations or non-contrast incomplete checks in every state', async () => {
    const cases: readonly [string, DemoState][] = [
      ['booting', { kind: 'booting' }],
      ['boot-error', { kind: 'boot-error', error: { code: 'boot', message: 'boot failed' } }],
      ['idle', { kind: 'idle', contract: CONTRACT }],
      ['running', { kind: 'running', id: ID }],
      ['cancelling', { kind: 'cancelling', id: ID }],
      ['answer', { kind: 'settled', id: ID, result: answer(ID, 2, 'axe') }],
      ['failure', { kind: 'settled', id: ID, result: failure(ID) }],
      ['limit', { kind: 'settled', id: ID, result: limited('answer-cap', 1) }],
      ['cancelled', { kind: 'settled', id: ID, result: cancelled(1) }],
      ['error', { kind: 'settled', id: ID, result: failed('axe error') }],
    ];

    for (const [name, state] of cases) {
      controller.solutionIndex =
        state.kind === 'settled' && state.result.kind === 'answer' ? 0 : -1;
      setState(state);
      const scan = await axe.run(target);
      expect(
        scan.violations.map((violation) => violation.id),
        name,
      ).toEqual([]);
      expect(
        scan.incomplete.map((item) => item.id).filter((id) => id !== 'color-contrast'),
        name,
      ).toEqual([]);
    }
  });

  it('V12 formats a recognized guideline id from its own tokens, never from JS vocabulary', () => {
    // The atom fixture above takes `humanizeGuidelineId`'s fallback, so only this
    // case exercises the recognized `'$guideline_id'/5` branch V12 permits.
    const binding: PlSolution['bindings'][string] = {
      kind: 'compound',
      functor: '$guideline_id',
      args: [
        { kind: 'atom', value: 'product' },
        { kind: 'atom', value: 'cdc2022-opioid-rec02' },
        { kind: 'integer', value: 42 },
        { kind: 'compound', functor: 'ref', args: [{ kind: 'integer', value: 7 }] },
        { kind: 'list', items: [] },
      ],
    };
    const result: AnswerResult = {
      kind: 'answer',
      id: ID,
      serialized: 'allowed-serialized',
      solutions: [{ bindings: { Answer: binding }, display: { Answer: 'engine-display-text' } }],
    };
    controller.solutionIndex = 0;
    setState({ kind: 'settled', id: ID, result });
    const visible = text(answerRegion());

    expect(visible).toContain('cdc2022-opioid-rec02 — sentence 42, ref 7');
    // Every token in the label is the term's own; nothing is glossed or stringified.
    for (const invented of ['recommendation', 'reference', 'document', 'guideline_id', '$'])
      expect(visible).not.toContain(invented);
    expect(visible).not.toMatch(/["{](?:kind|value|functor|args)[":]/u);
  });

  it('V12 falls back to engine display text for an unrecognized binding, never to JSON', () => {
    const result = answer(ID, 2, 'source-of-truth');
    if (result.kind !== 'answer') throw new Error('answer fixture changed kind');
    controller.solutionIndex = 0;
    setState({ kind: 'settled', id: ID, result });
    const visible = text(answerRegion());
    const allowed = [
      result.serialized,
      ...result.solutions.flatMap((item) => Object.values(item.display)),
    ];

    expect(allowed.some((value) => visible.includes(value))).toBe(true);
    expect(visible).not.toContain('binding-poison');
    expect(visible).not.toMatch(/["{](?:kind|value)[":]/u);
    for (const choice of radios()) {
      const label = text(choice.labels?.[0] ?? document.createTextNode(''));
      expect(allowed.some((value) => label.includes(value))).toBe(true);
      expect(label).not.toContain('binding-poison');
    }
  });
});
