import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  ...overrides,
});
const delay = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let image: Uint8Array;
let session: EngineSession;

beforeAll(async () => {
  image = new Uint8Array(readGenerated('kb.pvm'));
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
}, 120_000);

/** Worker-shaped adapter: real EngineSession execution, asynchronous message delivery. */
class LiveWorker {
  readonly seen: EngineRequest[] = [];
  terminated = false;
  #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    setTimeout(() => {
      if (this.terminated) return;
      void session.handle(request, image).then(
        (response) => {
          if (this.terminated) return;
          for (const listener of this.#listeners.get('message') ?? []) {
            listener({ data: response });
          }
        },
        (cause: unknown) => {
          const message = cause instanceof Error ? cause.message : String(cause);
          for (const listener of this.#listeners.get('error') ?? []) listener({ message });
        },
      );
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
  }
}

const liveClient = (): { client: EngineClient; worker: LiveWorker } => {
  const worker = new LiveWorker();
  return {
    client: new EngineClient({ spawn: () => worker as unknown as Worker }),
    worker,
  };
};

describe('AbortSignal cancellation spike', () => {
  it('P2 cancels a live synthetic run through the hidden correlation id', async () => {
    const { client, worker } = liveClient();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const running = client.query(
      'between(1,100000000,X).',
      budget({ answerCap: BUDGET_MAX.answerCap }),
      controller.signal,
    );
    await delay(25);
    const abortedAt = performance.now();
    controller.abort();
    const outcome = await running;
    const latencyMs = performance.now() - abortedAt;

    expect(outcome.kind).toBe('cancelled');
    const partial = outcome.kind === 'cancelled' ? outcome.solutions.length : -1;
    expect(partial).toBeGreaterThan(0);
    const query = worker.seen.find((request) => request.kind === 'query');
    const cancels = worker.seen.filter((request) => request.kind === 'cancel');
    expect(cancels).toHaveLength(1);
    expect(cancels[0]).toMatchObject({ target: query?.id });
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    console.info(`P2 cancel_latency_ms=${latencyMs.toFixed(3)} partial=${partial}`);
    add.mockRestore();
    remove.mockRestore();
    client.dispose();
  }, 120_000);

  it('P3 removes the listener when completion wins, so a later abort is inert', async () => {
    const { client, worker } = liveClient();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const outcome = await client.query('between(1,2,X).', budget(), controller.signal);
      expect(outcome.kind).toBe('solutions');
      const requestsAtSettle = worker.seen.length;
      controller.abort();
      await delay();
      expect(worker.seen).toHaveLength(requestsAtSettle);
      expect(worker.seen.some((request) => request.kind === 'cancel')).toBe(false);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(unhandled).toHaveLength(0);
      console.info(`P3 requests_after_abort=${worker.seen.length - requestsAtSettle} unhandled=0`);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      remove.mockRestore();
      client.dispose();
    }
  }, 120_000);
});
