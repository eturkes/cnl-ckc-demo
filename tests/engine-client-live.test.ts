// The SHIPPED client surface against the real saved image (M1 review E22, R34).
//
// Every other live case drives `EngineSession` directly and every `EngineClient`
// case drives a scripted worker, so nothing joined `EngineClient.query` to the real
// PVM — the one path the browser actually takes. The worker adapter here delivers
// asynchronously and mints a FRESH session per spawn, which is what makes a hard
// reset a genuine engine replacement rather than a reused object.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
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

const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';

/** Declares the static schema predicate dynamic first; a bare `assertz` is refused. */
const OVERLAY = [
  ':- dynamic guideline_document/3.',
  "guideline_document('zz-overlay-doc','zz-overlay',unreviewed).",
].join('\n');
const OVERLAY_GOAL = "guideline_document('zz-overlay-doc',T,_),T='zz-overlay'.";

const budget: BudgetSpec = { ...BUDGET_MAX, wallClockMs: 30_000 };

let image: Uint8Array;

beforeAll(() => {
  image = new Uint8Array(readGenerated('kb.pvm'));
}, 120_000);

/**
 * Worker-shaped adapter owning ONE real session, created per spawn.
 *
 * `terminate()` drops it, so the client's respawn boots a second engine from the
 * same image — the replacement whose contract the reset re-verifies.
 */
class LiveWorker {
  terminated = false;
  readonly #session: EngineSession;
  readonly #diagnostics: string[] = [];
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor() {
    this.#session = new EngineSession({
      loadImage: async (bytes) => {
        const engine = await loadImage(bytes);
        return engine;
      },
      expected: manifest.contract,
      drain: () => this.#diagnostics.splice(0, this.#diagnostics.length),
    });
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    setTimeout(() => {
      if (this.terminated) return;
      void this.#session.handle(request, image).then(
        (response) => {
          if (this.terminated) return;
          for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
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

let spawned: LiveWorker[] = [];
let client: EngineClient | undefined;

const liveClient = (): EngineClient => {
  spawned = [];
  client = new EngineClient({
    spawn: () => {
      const worker = new LiveWorker();
      spawned.push(worker);
      return worker as unknown as Worker;
    },
  });
  return client;
};

afterEach(() => {
  client?.dispose();
  client = undefined;
});

describe('shipped client over the real image', () => {
  it('E22 proves the seven category-A solutions through EngineClient.query', async () => {
    const engine = liveClient();
    const booted = await engine.boot();
    expect(booted).toEqual({ kind: 'booted', contract: manifest.contract });

    const outcome = await engine.query(CATEGORY_A_GOAL, budget);
    expect(outcome.kind).toBe('solutions');
    if (outcome.kind !== 'solutions') return;
    expect(outcome.solutions).toHaveLength(7);
    // Read from the run, never from a fixture: the ids come out of the bindings.
    const ids = outcome.solutions.map((solution) => {
      const a = solution.bindings.A;
      return a?.kind === 'compound' && a.args[1]?.kind === 'atom' ? a.args[1].value : 'missing';
    });
    expect(ids).toEqual([
      'cdc2022-opioid-rec02',
      'cdc2022-opioid-rec03',
      'cdc2022-opioid-rec04',
      'cdc2022-opioid-rec06',
      'cdc2022-opioid-rec07',
      'cdc2022-opioid-rec08',
      'cdc2022-opioid-rec12',
    ]);
  }, 120_000);

  it('R34 drops an asserted overlay and re-reads the corpus from the replacement engine', async () => {
    const engine = liveClient();
    expect(await engine.boot()).toEqual({ kind: 'booted', contract: manifest.contract });

    expect(await engine.consult(OVERLAY)).toEqual({ kind: 'consulted' });
    const withOverlay = await engine.query(OVERLAY_GOAL, budget);
    expect(withOverlay.kind).toBe('solutions');

    const replacement = await engine.reset('R34 hard cancel');
    expect(replacement).toEqual({ kind: 'booted', contract: manifest.contract });
    expect(manifest.contract.documents).toBe(337);
    expect(spawned).toHaveLength(2);
    expect(spawned[0]?.terminated).toBe(true);

    // The overlay lived in the terminated engine alone, so the replacement cannot
    // prove it — the property that makes a hard cancel a real state discard.
    const afterReset = await engine.query(OVERLAY_GOAL, budget);
    expect(afterReset.kind).toBe('failure');
  }, 180_000);
});
