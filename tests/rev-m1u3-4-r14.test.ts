// R14 / P4.4 / D5 — hard cancel terminates, respawns, refetches, reloads, and gates
// readiness on the replacement engine's own contract re-verification.
//
// The fake worker mirrors `src/engine/worker.ts` structurally: one `EngineSession`
// and one image cache per worker instance, because a real `Worker` gets a fresh
// module instance. Every seam the row names — factory, terminate, fetch, load,
// contract read, boot response — is counted and ordered here.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const realLoad: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

/** Same text `session.ts` uses; the replacement must re-run it, not recall its answer. */
const DOCUMENTS = 'guideline_document';

/** Reports one document fewer than the image really holds, through the same read path. */
const understate = (engine: Engine, count: number): Engine => {
  const prolog = Object.create(engine.prolog as object, {
    query: {
      value: (goal: string, bindings?: Record<string, unknown>): unknown =>
        goal.includes(DOCUMENTS)
          ? { once: () => ({ $tag: 'bindings', success: true, N: count }) }
          : (engine.prolog as { query: (g: string, b?: object) => unknown }).query(goal, bindings),
    },
  }) as Engine['prolog'];
  return Object.create(engine as object, { prolog: { value: prolog, enumerable: true } }) as Engine;
};

interface Trace {
  events: string[];
  workers: ProbeWorker[];
  fetches: number;
  loads: number;
  terminations: number;
  engines: unknown[];
}

class ProbeWorker {
  terminated = false;
  readonly session: EngineSession;
  readonly seen: EngineRequest[] = [];
  #image: Promise<Uint8Array> | undefined;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(
    readonly generation: number,
    private readonly trace: Trace,
    skewTo?: number,
  ) {
    this.session = new EngineSession({
      expected: manifest.contract,
      loadImage: async (image) => {
        trace.loads += 1;
        trace.events.push(`load#${generation}`);
        const engine = await realLoad(image);
        trace.engines.push(engine);
        return skewTo === undefined ? engine : understate(engine, skewTo);
      },
    });
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  /** Mirrors `worker.ts`: the image is cached per worker, so a respawn refetches. */
  #fetch(): Promise<Uint8Array> {
    this.trace.fetches += 1;
    this.trace.events.push(`fetch#${this.generation}`);
    return Promise.resolve(new Uint8Array(readGenerated('kb.pvm')));
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    setTimeout(() => {
      if (this.terminated) return;
      this.#image ??= this.#fetch();
      void this.#image
        .then(async (image) => this.session.handle(request, image))
        .then((response: EngineResponse) => {
          if (this.terminated) return;
          this.trace.events.push(`post#${this.generation}:${response.kind}`);
          for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
        });
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
    this.trace.terminations += 1;
    this.trace.events.push(`terminate#${this.generation}`);
  }
}

const probeClient = (
  skewReplacementTo?: number,
): { client: EngineClient; trace: Trace } => {
  const trace: Trace = {
    events: [],
    workers: [],
    fetches: 0,
    loads: 0,
    terminations: 0,
    engines: [],
  };
  const client = new EngineClient({
    spawn: () => {
      const generation = trace.workers.length + 1;
      trace.events.push(`spawn#${generation}`);
      const worker = new ProbeWorker(
        generation,
        trace,
        generation > 1 ? skewReplacementTo : undefined,
      );
      trace.workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  return { client, trace };
};

const budget = { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 10 };

describe('R14 hard cancel rebuilds worker, session and engine', () => {
  it('R14a terminates once, respawns once, refetches, reloads, then reports ready', async () => {
    const { client, trace } = probeClient();
    try {
      expect(await client.boot()).toEqual({ kind: 'booted', contract: manifest.contract });
      expect(await client.query('between(1,3,X).', budget)).toMatchObject({ kind: 'solutions' });

      trace.events.push('reset-called');
      const outcome = await client.reset('R14 hard cancel');
      trace.events.push('reset-resolved');

      expect(outcome).toEqual({ kind: 'booted', contract: manifest.contract });
      expect(trace.workers).toHaveLength(2);
      expect(trace.terminations).toBe(1);
      expect(trace.workers[0]?.terminated).toBe(true);
      expect(trace.workers[1]?.terminated).toBe(false);
      // A fresh worker means a fresh session and a fresh engine, not a reused one.
      expect(trace.workers[1]?.session).not.toBe(trace.workers[0]?.session);
      expect(trace.fetches).toBe(2);
      expect(trace.loads).toBe(2);
      expect(trace.engines).toHaveLength(2);
      expect(trace.engines[1]).not.toBe(trace.engines[0]);

      const at = (event: string): number => trace.events.indexOf(event);
      expect(at('terminate#1')).toBeGreaterThan(at('reset-called') - 1);
      expect(at('spawn#2')).toBeGreaterThan(at('terminate#1'));
      expect(at('fetch#2')).toBeGreaterThan(at('spawn#2'));
      expect(at('load#2')).toBeGreaterThan(at('fetch#2'));
      // Readiness is the last thing to happen: the replacement had to load and
      // verify before any caller could observe a booted client.
      expect(at('post#2:booted')).toBeGreaterThan(at('load#2'));
      expect(at('reset-resolved')).toBeGreaterThan(at('post#2:booted'));
      expect(trace.events.filter((event) => event === 'post#2:booted')).toHaveLength(1);
    } finally {
      client.dispose();
    }
  }, 180_000);

  it('R14b withholds readiness when the replacement disagrees with the manifest', async () => {
    const { client, trace } = probeClient(manifest.contract.documents - 1);
    try {
      expect(await client.boot()).toEqual({ kind: 'booted', contract: manifest.contract });

      const outcome = await client.reset('R14 hard cancel with a skewed replacement');

      expect(outcome.kind).toBe('error');
      if (outcome.kind !== 'error') return;
      expect(outcome.error.code).toBe('contract');
      expect(outcome.error.message).toContain(String(manifest.contract.documents - 1));
      // Loading happened; readiness did not. Verification is the gate, not the load.
      expect(trace.loads).toBe(2);
      expect(trace.terminations).toBe(1);
      expect(trace.events.filter((event) => event === 'post#2:booted')).toHaveLength(0);
    } finally {
      client.dispose();
    }
  }, 180_000);
});
