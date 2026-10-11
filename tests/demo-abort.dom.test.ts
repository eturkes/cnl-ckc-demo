import { flushSync, mount, unmount } from 'svelte';
import { expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

const ID = QUESTION_IDS[0];
const CONTRACT = { schemaVersion: 1, documents: 337 };
const DISPLAY = 'replacement-engine-answer';

class RecoveringEngine implements DemoEngine {
  readonly asks: unknown[] = [];

  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: CONTRACT });
  }

  ask(id: unknown): Promise<AnswerResult> {
    this.asks.push(id);
    return Promise.resolve(
      this.asks.length === 1
        ? {
            kind: 'limit',
            id: id as QuestionId,
            limit: 'heap',
            serialized: 'heap-trip',
            solutions: [],
          }
        : {
            kind: 'answer',
            id: id as QuestionId,
            serialized: 'next-run',
            solutions: [
              {
                bindings: { Answer: { kind: 'atom', value: DISPLAY } },
                display: { Answer: DISPLAY },
              },
            ],
          },
    );
  }

  dispose(): void {}
}

it('A7 shows the heap limit and lets the next catalog run answer', async () => {
  const target = document.body.appendChild(document.createElement('div'));
  const engine = new RecoveringEngine();
  const controller = new DemoController(engine);
  const app = mount(App, { target, props: { controller } });
  try {
    for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();
    flushSync();
    expect(controller.state).toEqual({ kind: 'idle', contract: CONTRACT });
    controller.select(ID);
    await controller.run();
    flushSync();
    expect(controller.state).toMatchObject({
      kind: 'settled',
      id: ID,
      result: { kind: 'limit', limit: 'heap' },
    });
    const region = target.querySelector<HTMLElement>('[aria-busy]:not([data-chat-conversation])');
    if (region === null) throw new Error('answer region missing');
    expect(region.textContent).toMatch(/heap/iu);
    expect(region.getAttribute('aria-busy')).toBe('false');

    await controller.run();
    flushSync();
    expect(engine.asks).toEqual([ID, ID]);
    expect(controller.state).toMatchObject({ kind: 'settled', id: ID, result: { kind: 'answer' } });
    expect(region.textContent).toContain(DISPLAY);
    expect(region.textContent).not.toMatch(/heap/iu);
    expect(region.getAttribute('aria-busy')).toBe('false');
  } finally {
    await unmount(app);
    controller.dispose();
    target.remove();
  }
});
