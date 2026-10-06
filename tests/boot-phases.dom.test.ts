// @vitest-environment jsdom
// d5 phased boot, rendered: worker progress → EngineClient → DemoController → the run status
// region. Each phase must change that live region exactly once, in order, and no status may
// state a percentage or a size the worker did not declare.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import { EngineClient } from '../src/engine/client.js';
import type { EngineContract, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EN } from '../src/i18n/en.js';
import { JA } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };

/** Answers a boot with scripted replies, one macrotask apart, as `postMessage` delivers them. */
class PhasedWorker {
  #listener: ((event: MessageEvent<EngineResponse>) => void) | undefined;

  constructor(readonly script: (id: string) => EngineResponse[]) {}

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === 'message') this.#listener = listener;
  }

  postMessage(request: EngineRequest): void {
    const replies = request.kind === 'boot' ? this.script(request.id) : [];
    void (async () => {
      for (const data of replies) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.#listener?.({ data } as MessageEvent<EngineResponse>);
      }
    })();
  }

  terminate(): void {}
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let controller: DemoController | undefined;

/** Every text the run status region shows, from mount to `idle`, one entry per DOM change. */
const statusEvents = async (script: (id: string) => EngineResponse[]): Promise<string[]> => {
  const client = new EngineClient({ spawn: () => new PhasedWorker(script) as unknown as Worker });
  const engine: DemoEngine = {
    boot: (onProgress) => client.boot(onProgress),
    ask: () => Promise.reject(new Error('d5 runs no question')),
    dispose: () => {
      client.dispose();
    },
  };
  controller = new DemoController(engine);
  app = mount(App, { target, props: { controller } });
  flushSync();
  const region = target.querySelector<HTMLElement>(
    'p.status[role="status"]:not([data-intake-status])',
  );
  if (region === null) throw new Error('run status region is missing');
  const events = [region.textContent];
  new MutationObserver(() => {
    events.push(region.textContent);
  }).observe(region, { childList: true, characterData: true, subtree: true });
  const view = controller;
  await vi.waitFor(() => {
    expect(view.state.kind).toBe('idle');
  });
  flushSync();
  await Promise.resolve();
  return events;
};

const phased = (id: string, bytes?: number): EngineResponse[] => [
  bytes === undefined
    ? { id, kind: 'progress', phase: 'fetch' }
    : { id, kind: 'progress', phase: 'fetch', bytes },
  { id, kind: 'progress', phase: 'load' },
  { id, kind: 'progress', phase: 'verify' },
  { id, kind: 'booted', contract: CONTRACT },
];

beforeEach(() => {
  locale.set('en');
  localStorage.clear();
  target = document.body.appendChild(document.createElement('div'));
});

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  app = undefined;
  controller?.dispose();
  controller = undefined;
  target.remove();
  locale.set('en');
  localStorage.clear();
});

describe('rendered boot phases', () => {
  it('each phase changes the status region once, in order, then ready', async () => {
    const { TEXT } = EN;
    expect(await statusEvents((id) => phased(id, 457_930))).toEqual([
      TEXT.engineStarting(),
      TEXT.engineFetching(457_930),
      TEXT.engineLoading(),
      TEXT.engineVerifying(),
      TEXT.engineReady(CONTRACT.documents, String(CONTRACT.schemaVersion)),
    ]);
  });

  it('a declared size reads in kilobytes, with no percentage', async () => {
    const events = await statusEvents((id) => phased(id, 457_930));
    expect(events[1]).toContain('458 kB');
    for (const text of events) expect(text).not.toContain('%');
  });

  it('an undeclared size reports no number at all', async () => {
    const events = await statusEvents((id) => phased(id));
    expect(events[1]).toBe(EN.TEXT.engineFetching());
    expect(events[1]).not.toMatch(/\d/u);
    for (const text of events) expect(text).not.toContain('%');
  });

  it('a fallback boot announces the fallback between load and verify', async () => {
    const { TEXT } = EN;
    expect(
      await statusEvents((id) => [
        { id, kind: 'progress', phase: 'fetch' },
        { id, kind: 'progress', phase: 'load' },
        { id, kind: 'progress', phase: 'fallback' },
        { id, kind: 'progress', phase: 'verify' },
        { id, kind: 'booted', contract: CONTRACT },
      ]),
    ).toEqual([
      TEXT.engineStarting(),
      TEXT.engineFetching(),
      TEXT.engineLoading(),
      TEXT.engineFallback(),
      TEXT.engineVerifying(),
      TEXT.engineReady(CONTRACT.documents, String(CONTRACT.schemaVersion)),
    ]);
  });

  it('the Japanese interface announces the same phases in its own catalog', async () => {
    locale.set('ja');
    const { TEXT } = JA;
    expect(await statusEvents((id) => phased(id, 457_930))).toEqual([
      TEXT.engineStarting(),
      TEXT.engineFetching(457_930),
      TEXT.engineLoading(),
      TEXT.engineVerifying(),
      TEXT.engineReady(CONTRACT.documents, String(CONTRACT.schemaVersion)),
    ]);
  });
});
