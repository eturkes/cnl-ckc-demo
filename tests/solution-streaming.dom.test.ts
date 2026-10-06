// @vitest-environment jsdom
// d17 solution streaming, rendered: each answer the engine streams appears in the answer region
// while the run is still busy, and the settled answer replaces them.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import type { BootOutcome } from '../src/engine/client.js';
import type { EngineContract, PlSolution } from '../src/engine/protocol.js';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };
const ID = QUESTION_IDS[0];

const solution = (index: number): PlSolution => ({
  bindings: { Answer: { kind: 'atom', value: `streamed-${String(index)}` } },
  display: { Answer: `streamed-display-${String(index)}` },
});

/** One run whose answers the test streams by hand before settling it. */
class StreamingEngine implements DemoEngine {
  stream: ((solution: PlSolution) => void) | undefined;
  settle: ((result: AnswerResult) => void) | undefined;

  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: CONTRACT });
  }

  ask(
    _id: unknown,
    _budget: unknown,
    _signal?: AbortSignal,
    onSolution?: (solution: PlSolution) => void,
  ): Promise<AnswerResult> {
    this.stream = onSolution;
    return new Promise((resolve) => {
      this.settle = resolve;
    });
  }

  dispose(): void {}
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let controller: DemoController | undefined;

const drain = async (): Promise<void> => {
  for (let tick = 0; tick < 8; tick++) await Promise.resolve();
  flushSync();
};

const region = (): HTMLElement => {
  const element = target.querySelector<HTMLElement>('section.answer-region');
  if (element === null) throw new Error('answer region is missing');
  return element;
};

const shownPoints = (): string[] =>
  [...region().querySelectorAll('.answer-point')].map((point) => point.textContent.trim());

beforeEach(() => {
  target = document.body.appendChild(document.createElement('div'));
});

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  app = undefined;
  controller?.dispose();
  controller = undefined;
  target.remove();
});

describe('rendered solution streaming', () => {
  it('shows each streamed answer while the run is busy, then the settled answer', async () => {
    const engine = new StreamingEngine();
    controller = new DemoController(engine);
    app = mount(App, { target, props: { controller } });
    await drain();
    controller.select(ID);
    void controller.run();
    await drain();
    expect(region().getAttribute('aria-busy')).toBe('true');
    expect(shownPoints()).toEqual([]);

    engine.stream?.(solution(1));
    await drain();
    expect(region().getAttribute('aria-busy')).toBe('true');
    expect(shownPoints()).toEqual(['streamed-display-1']);

    engine.stream?.(solution(2));
    await drain();
    expect(shownPoints()).toEqual(['streamed-display-1', 'streamed-display-2']);

    engine.settle?.({
      kind: 'answer',
      id: ID,
      serialized: 'settled',
      solutions: [solution(1), solution(2)],
    });
    await drain();
    expect(region().getAttribute('aria-busy')).toBe('false');
    expect(shownPoints().map((text) => text.replace(/\s*\d+$/u, ''))).toEqual([
      'streamed-display-1',
      'streamed-display-2',
    ]);
  });

  it('a repeated Cancel keeps the answers already streamed', async () => {
    const engine = new StreamingEngine();
    controller = new DemoController(engine);
    app = mount(App, { target, props: { controller } });
    await drain();
    controller.select(ID);
    void controller.run();
    await drain();
    engine.stream?.(solution(1));
    await drain();
    void controller.cancel();
    await drain();
    expect(shownPoints()).toEqual(['streamed-display-1']);
    void controller.cancel();
    await drain();
    expect(controller.state).toEqual({ kind: 'cancelling', id: ID, solutions: [solution(1)] });
    expect(shownPoints()).toEqual(['streamed-display-1']);
  });

  it("a retired run's late answer never reaches the next run", async () => {
    const engine = new StreamingEngine();
    controller = new DemoController(engine);
    app = mount(App, { target, props: { controller } });
    await drain();
    controller.select(ID);
    void controller.run();
    await drain();
    const retired = engine.stream;
    const next = QUESTION_IDS[1] ?? ID;
    controller.select(next);
    void controller.run();
    await drain();
    retired?.(solution(9));
    await drain();
    expect(shownPoints()).toEqual([]);
    expect(controller.state).toEqual({ kind: 'running', id: next });
  });
});
