// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import type { BootOutcome } from '../src/engine/client.js';
import type {
  EngineContract,
  EngineError,
  LimitKind,
  PlSolution,
} from '../src/engine/protocol.js';
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
  bindings: { A: { kind: 'atom', value: `binding-poison-${String(index)}` } },
  display: { A: `${prefix}-display-${String(index)}` },
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
});
