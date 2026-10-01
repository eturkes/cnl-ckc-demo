// @vitest-environment jsdom
// `.agent/contracts/mnt-d21.md` B4: retry crosses the controller → client → worker seam.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import { EngineClient, type BootOutcome } from '../src/engine/client.js';
import type { EngineContract, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import type { AnswerResult } from '../src/questions/service.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };
const failure = (message: string): BootOutcome => ({
  kind: 'error',
  error: { code: 'boot', message },
});

class CachedBootWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  #message: ((event: MessageEvent<EngineResponse>) => void) | undefined;

  constructor(readonly outcome: BootOutcome) {}

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === 'message') this.#message = listener;
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    if (request.kind === 'boot')
      queueMicrotask(() => {
        this.#message?.({
          data: { ...this.outcome, id: request.id },
        } as MessageEvent<EngineResponse>);
      });
  }

  terminate(): void {
    this.terminated = true;
  }
}

class DeferredBootEngine implements DemoEngine {
  readonly completions: ((outcome: BootOutcome) => void)[] = [];

  boot(): Promise<BootOutcome> {
    return new Promise((resolve) => {
      this.completions.push(resolve);
    });
  }

  ask(): Promise<AnswerResult> {
    return Promise.reject(new Error('B4 must not dispatch a question'));
  }

  dispose(): void {}

  complete(index: number, outcome: BootOutcome): void {
    const resolve = this.completions[index];
    if (resolve === undefined) throw new Error(`boot ${String(index)} was not dispatched`);
    resolve(outcome);
  }
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let controller: DemoController | undefined;

const render = (engine: DemoEngine): DemoController => {
  const instance = new DemoController(engine);
  controller = instance;
  app = mount(App, { target, props: { controller: instance } });
  flushSync();
  return instance;
};

const drain = async (): Promise<void> => {
  for (let tick = 0; tick < 8; tick++) await Promise.resolve();
  flushSync();
};

const INTAKE_REGIONS = '[data-intake-status], [data-intake-alert], [data-intake-result]';
const pageAlerts = (): HTMLElement[] => [...target.querySelectorAll<HTMLElement>('[role="alert"]')];
const alerts = (): HTMLElement[] =>
  pageAlerts().filter((element) => !element.matches(INTAKE_REGIONS));

const retry = (): HTMLButtonElement => {
  const buttons = [...target.querySelectorAll<HTMLButtonElement>('button')].filter((button) =>
    /^retry\b/iu.test(button.textContent?.trim() ?? ''),
  );
  expect(buttons).toHaveLength(1);
  const button = buttons[0];
  if (button === undefined) throw new Error('boot retry control is missing');
  expect(button.disabled).toBe(false);
  return button;
};

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

describe('rendered boot-error recovery', () => {
  it('B4 keeps one run alert and a stable page count across two failed boots', async () => {
    const engine = new DeferredBootEngine();
    const view = render(engine);
    expect(view.state.kind).toBe('booting');
    engine.complete(0, failure('first boot error'));
    await drain();

    expect(view.state).toEqual({
      kind: 'boot-error',
      error: { code: 'boot', message: 'first boot error' },
    });
    const firstPageCount = pageAlerts().length;
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]?.textContent).toContain('first boot error');
    const retrying = view.retry();
    flushSync();
    expect(view.state.kind).toBe('booting');
    expect(engine.completions).toHaveLength(2);
    engine.complete(1, failure('second boot error'));
    await retrying;
    await drain();

    expect(view.state).toEqual({
      kind: 'boot-error',
      error: { code: 'boot', message: 'second boot error' },
    });
    expect(alerts()).toHaveLength(1);
    expect(pageAlerts()).toHaveLength(firstPageCount);
    expect(alerts()[0]?.textContent).toContain('second boot error');
    expect(target.textContent).not.toContain('first boot error');
    retry();
  });

  it('B4 reaches ready on the third attempt through the rendered retry control', async () => {
    const workers: CachedBootWorker[] = [];
    const client = new EngineClient({
      spawn: () => {
        const worker = new CachedBootWorker(
          workers.length < 2
            ? failure(`cached fetch failure ${String(workers.length + 1)}`)
            : { kind: 'booted', contract: CONTRACT },
        );
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });
    const view = render({
      boot: () => client.boot(),
      ask: () => Promise.reject(new Error('B4 must not dispatch a question')),
      dispose: () => client.dispose(),
    });
    await drain();
    expect(view.state.kind).toBe('boot-error');

    retry().click();
    flushSync();
    expect(view.state.kind).toBe('booting');
    await drain();
    expect(view.state.kind).toBe('boot-error');

    retry().click();
    flushSync();
    expect(view.state.kind).toBe('booting');
    await drain();
    expect(view.state).toEqual({ kind: 'idle', contract: CONTRACT });
    expect(workers).toHaveLength(3);
    expect(workers.map((worker) => worker.seen.length)).toEqual([1, 1, 1]);
    expect(workers.map((worker) => worker.terminated)).toEqual([true, true, false]);
    expect(target.querySelector('[role="status"]:not([data-intake-status])')?.textContent).toMatch(
      /ready/iu,
    );
  });
});
