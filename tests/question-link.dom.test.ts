// @vitest-environment jsdom
// Queue row `Question deep-links + history`: reload and back/forward restore only a catalog id,
// and never start a run without an explicit user action.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import { QUESTION_CATALOG, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

class CountingEngine implements DemoEngine {
  asks = 0;
  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: { schemaVersion: 1, documents: 337 } });
  }
  ask(): Promise<AnswerResult> {
    this.asks += 1;
    return Promise.reject(new Error('a restored link must not run a question'));
  }
  dispose(): void {}
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let controller: DemoController | undefined;
let engine: CountingEngine;

const render = (): DemoController => {
  engine = new CountingEngine();
  controller = new DemoController(engine);
  app = mount(App, { target, props: { controller } });
  flushSync();
  return controller;
};

const settle = async (): Promise<void> => {
  await Promise.resolve();
  flushSync();
};

/** jsdom delivers `popstate` from a queued task; App's own listener was added first. */
const travel = async (step: () => void): Promise<void> => {
  const popped = new Promise((resolve) => {
    addEventListener('popstate', resolve, { once: true });
  });
  step();
  await popped;
  flushSync();
};

const shown = (): string => target.querySelector('[role="combobox"]')?.textContent?.trim() ?? '';
const linked = (): string | null => new URL(location.href).searchParams.get('q');

beforeEach(() => {
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  controller?.dispose();
  target.remove();
  app = undefined;
  controller = undefined;
});

describe('question deep links', () => {
  it('restores a linked catalog id on load and runs nothing', async () => {
    history.replaceState(null, '', '/?q=opioid-safety');
    const demo = render();
    await settle();
    expect(demo.selected).toBe('opioid-safety');
    expect(shown()).toBe(QUESTION_CATALOG['opioid-safety'].question);
    expect(demo.state.kind).toBe('idle');
    expect(engine.asks).toBe(0);
  });

  it('ignores an id outside the catalog and strips it without a history entry', async () => {
    history.replaceState(null, '', '/?q=drop-table');
    const before = history.length;
    const demo = render();
    await settle();
    expect(demo.selected).toBeNull();
    expect(linked()).toBeNull();
    expect(history.length).toBe(before);
  });

  it('pushes each selection and restores it on back and forward without a run', async () => {
    const demo = render();
    await settle();
    const before = history.length;
    const pick = (id: QuestionId): void => {
      demo.select(id);
      flushSync();
    };
    pick('opioid-follow-up');
    pick('opioid-safety');
    expect(linked()).toBe('opioid-safety');
    expect(history.length).toBe(before + 2);

    await travel(() => {
      history.back();
    });
    expect(demo.selected).toBe('opioid-follow-up');
    await travel(() => {
      history.back();
    });
    expect(demo.selected).toBeNull();
    await travel(() => {
      history.forward();
    });
    expect(demo.selected).toBe('opioid-follow-up');
    expect(shown()).toBe(QUESTION_CATALOG['opioid-follow-up'].question);
    expect(history.length).toBe(before + 2);
    expect(engine.asks).toBe(0);
  });
});
