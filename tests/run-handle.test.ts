// Alternative-A probes: an EngineClient run handle carries correlation, settlement,
// and its bound cooperative cancel without exposing a goal through AnswerService.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({});
};

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: BUDGET_MAX.answerCap,
  ...overrides,
});

/** Worker-shaped adapter: protocol/client are real, and every query step runs in the real WASM engine. */
class SessionWorker {
  readonly #session: EngineSession;
  readonly #image: Uint8Array;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();
  #terminated = false;

  constructor(session: EngineSession, bytes: Uint8Array) {
    this.#session = session;
    this.#image = bytes;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    if (this.#terminated) throw new Error('worker is terminated');
    if (request.kind === 'cancel') {
      this.#reply({
        id: request.id,
        kind: 'ack',
        accepted: this.#session.requestCancel(request.target),
      });
      return;
    }
    void this.#session.handle(request, this.#image).then((response) => this.#reply(response));
  }

  terminate(): void {
    this.#terminated = true;
  }

  #reply(response: EngineResponse): void {
    if (this.#terminated) return;
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }
}

const session = new EngineSession({ loadImage, expected: manifest.contract });
const client = new EngineClient({
  spawn: () => new SessionWorker(session, image) as unknown as Worker,
});

beforeAll(async () => {
  expect((await client.boot()).kind).toBe('booted');
}, 120_000);

afterAll(() => {
  client.dispose();
});

describe.sequential('run handle', () => {
  it('P2 cancels a live synthetic goal through its bound handle', async () => {
    const run = client.query('between(1,100000000,X).', budget());
    await new Promise((resolve) => setTimeout(resolve, 10));
    const started = performance.now();
    const [accepted, outcome] = await Promise.all([run.cancel(), run.result]);
    const cancelLatencyMs = performance.now() - started;

    expect(accepted).toBe(true);
    expect(outcome.kind).toBe('cancelled');
    if (outcome.kind !== 'cancelled') return;
    expect(outcome.solutions.length).toBeGreaterThan(0);
    console.info(
      `P2_METRIC request=${run.requestId} outcome=${outcome.kind} partial=${outcome.solutions.length} cancel_ms=${cancelLatencyMs.toFixed(3)}`,
    );
  });

  it('P3 reports cancel-after-settle as false without an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const run = client.query('true.', budget());
      expect((await run.result).kind).toBe('solutions');
      expect(await run.cancel()).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toHaveLength(0);
      console.info(
        `P3_METRIC request=${run.requestId} accepted=false unhandled=${unhandled.length}`,
      );
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
