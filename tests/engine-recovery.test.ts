// The u3 predicates and Q-corpus cases the unit's battery left uncovered (M1 review R35).
//
// R35's matrix found P4.4 and P4.7 with no committed test and six named Q-corpus
// cases unexercised. Every case here runs against the real generated image, because
// each one asserts something a stubbed engine would satisfy for free: that the
// REPLACEMENT engine is the one whose contract gets verified, that a request landing
// mid-respawn settles typed, and which limit reports when several trip at once.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX, readOutcome } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineContract, EngineRequest } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: EngineContract;
};

const loaderWith = (options: Record<string, unknown> = {}): ImageLoader => {
  return async (image) => {
    const factory = require('swipl-wasm/dist/loadImageDefault.js') as
      | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
      | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
    const load = typeof factory === 'function' ? factory : factory.default;
    return load(image)(options);
  };
};

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

/** Recurses exactly `N` deep and burns one inference per level; drives depth and inference. */
const DEEP_SETUP =
  'assertz((probe_deep(0):-!)),assertz((probe_deep(N):-N>0,M is N-1,probe_deep(M))).';

let image: Uint8Array;

beforeAll(() => {
  image = new Uint8Array(readGenerated('kb.pvm'));
}, 120_000);

/**
 * Worker-shaped adapter owning ONE real session per spawn.
 *
 * `expected` is a constructor argument so a later generation can be given a contract
 * the booted engine will not match — the only way to show that the verification runs
 * against the REPLACEMENT rather than being replayed from the retired one.
 */
class LiveWorker {
  terminated = false;
  readonly #session: EngineSession;
  readonly #diagnostics: string[] = [];
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(expected: EngineContract) {
    this.#session = new EngineSession({
      loadImage: loaderWith(),
      expected,
      drain: () => this.#diagnostics.splice(0, this.#diagnostics.length),
    });
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    setTimeout(() => {
      if (this.terminated) return;
      void this.#session.handle(request, image).then((response) => {
        if (this.terminated) return;
        for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
      });
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
  }
}

let spawned: LiveWorker[] = [];
let client: EngineClient | undefined;

/** `contracts[n]` is generation n+1's expectation; the tail repeats for later spawns. */
const liveClient = (contracts: EngineContract[] = [manifest.contract]): EngineClient => {
  spawned = [];
  client = new EngineClient({
    spawn: () => {
      const expected = contracts[spawned.length] ?? contracts[contracts.length - 1];
      const worker = new LiveWorker(expected ?? manifest.contract);
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

describe('P4 hard-cancel recovery', () => {
  it('P4.4 verifies the contract out of the REPLACEMENT engine before reporting ready', async () => {
    // Generation 2 expects a document count the image cannot produce. A reset that
    // replayed the retired engine's answer, or that reported ready without asking,
    // would still return `booted` here.
    const wrong: EngineContract = {
      ...manifest.contract,
      documents: manifest.contract.documents + 1,
    };
    const engine = liveClient([manifest.contract, wrong]);
    expect(await engine.boot()).toEqual({ kind: 'booted', contract: manifest.contract });

    const replacement = await engine.reset('P4.4 hard cancel');
    expect(replacement.kind).toBe('error');
    if (replacement.kind !== 'error') return;
    expect(replacement.error.code).toBe('contract');
    // The message carries both readings, so a mismatch is diagnosable without a rerun.
    expect(replacement.error.message).toContain(String(manifest.contract.documents));
    expect(replacement.error.message).toContain(String(wrong.documents));

    expect(spawned).toHaveLength(2);
    expect(spawned[0]?.terminated).toBe(true);
    expect(spawned[1]?.terminated).toBe(false);
  }, 180_000);

  it('P4.7 settles a request issued during the respawn window typed, not hanging', async () => {
    const engine = liveClient();
    expect(await engine.boot()).toEqual({ kind: 'booted', contract: manifest.contract });

    // Not awaited: the reset is still booting its replacement when the query is posted,
    // which is exactly the window P4.7 names.
    const resetting = engine.reset('P4.7 hard cancel');
    const during = engine.query('guideline_document(D,_,_).', budget({ answerCap: 1 }));

    const [booted, outcome] = await Promise.all([resetting, during]);
    expect(booted).toEqual({ kind: 'booted', contract: manifest.contract });
    // Typed, and typed as a real engine state rather than a protocol violation: the
    // replacement had not finished booting when the request reached it.
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') return;
    expect(['prolog', 'boot']).toContain(outcome.error.code);
    expect(outcome.error.message).toMatch(/not booted/);

    // Two spawns, not three: the mid-respawn request attached to the live generation.
    expect(spawned).toHaveLength(2);
    // The engine the reset produced is usable, so the failed request cost nothing.
    const after = await engine.query('guideline_document(D,_,_).', budget({ answerCap: 1 }));
    expect(after.kind).toBe('limit');
  }, 180_000);

  it('Q cancel before boot is refused without loading an image', async () => {
    const engine = liveClient();
    // No boot, no query: the cancel is the first request the client ever sends.
    expect(await engine.cancel('r1')).toBe(false);
    expect(spawned).toHaveLength(1);
    // A refused cancel must not have booted anything, so the next boot is the first.
    expect(await engine.boot()).toEqual({ kind: 'booted', contract: manifest.contract });
    expect(spawned).toHaveLength(1);
  }, 180_000);
});

describe('Q budget corpus — several limits armed at once', () => {
  let session: EngineSession;

  beforeAll(async () => {
    session = new EngineSession({ loadImage: loaderWith(), expected: manifest.contract });
    await session.boot(image);
    expect((await session.solve(DEEP_SETUP, budget())).kind).toBe('solutions');
  }, 180_000);

  it('Q reports the outer inference limit when depth and inference both trip', async () => {
    // Two separate claims, and only both together bind the documented precedence.
    //
    // Live: the WRAPPER decides. `call_with_inference_limit` is outermost, so with both
    // budgets low the run ends on inferences and `BudgetDepth_` never binds — which is
    // why swapping `readOutcome`'s branch order leaves this half green.
    const solved = await session.solve('probe_deep(5000).', budget({ depth: 50, inferences: 40 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind === 'limit') expect(solved.limit).toBe('inference');

    // Structural: `readOutcome`'s branch ORDER is observable only when both atoms are
    // bound at once. Nothing else in the suite reaches that state, so the ordering was
    // unpinned until here.
    expect(
      readOutcome({
        BudgetDepth_: { kind: 'atom', value: 'depth_limit_exceeded' },
        BudgetInference_: { kind: 'atom', value: 'inference_limit_exceeded' },
      }),
    ).toEqual({ kind: 'limit', limit: 'inference' });
  }, 120_000);

  it('Q reports one typed limit with all four budgets set low at once', async () => {
    const solved = await session.solve('probe_deep(5000).', {
      depth: 50,
      inferences: 40,
      stackBytes: 8_388_608,
      wallClockMs: 1,
      answerCap: 1,
    });
    expect(solved.kind).toBe('limit');
    if (solved.kind !== 'limit') return;
    // Engine-side limits are read from the first wrapper result, so they settle before
    // the JS deadline or the cap can be consulted.
    expect(solved.limit).toBe('inference');
    expect(solved.solutions).toHaveLength(0);
    // The engine survives a four-way trip; a limit is never a discard.
    const sound = await session.solve('guideline_document(D,_,_).', budget({ answerCap: 1 }));
    expect(sound.kind).toBe('limit');
  }, 120_000);
});

describe('Q consult corpus — the diagnostic sinks in isolation', () => {
  /** One session per case: a fatal diagnostic poisons its engine by design. */
  const sinkSession = async (
    sink: 'printErr' | 'on_output',
  ): Promise<{ session: EngineSession; captured: string[] }> => {
    const captured: string[] = [];
    const options: Record<string, unknown> =
      sink === 'printErr'
        ? { printErr: (line: string) => captured.push(line) }
        : {
            on_output: (line: string, stream: string) => {
              if (stream === 'stderr') captured.push(line);
            },
          };
    const session = new EngineSession({
      loadImage: loaderWith(options),
      expected: manifest.contract,
      drain: () => captured.splice(0, captured.length),
    });
    await session.boot(image);
    return { session, captured };
  };

  it('Q treats a FAILING DIRECTIVE as fatal, not only a syntax error', async () => {
    const { session } = await sinkSession('printErr');
    // Syntactically perfect; the directive simply fails. `consult/1` still returns
    // success, so only the drained warning distinguishes it from a clean load.
    const response = await session.handle(
      { id: 'd1', kind: 'consult', source: 'probe_ok.\n:- fail.\n' },
      image,
    );
    expect(response.kind).toBe('error');
    if (response.kind !== 'error') return;
    expect(response.error.code).toBe('consult');

    // The engine is discarded, so a later request on it is refused rather than served.
    const after = await session.handle(
      { id: 'd2', kind: 'query', goal: 'true.', budget: budget() },
      image,
    );
    expect(after.kind).toBe('error');
    if (after.kind === 'error') expect(after.error.code).toBe('consult');
  }, 180_000);

  it('Q catches a load diagnostic that reaches on_output alone, with printErr absent', async () => {
    // Both hooks are installed together everywhere else, so neither was ever shown to
    // be load-bearing on its own. Here `printErr` does not exist at all.
    const { session, captured } = await sinkSession('on_output');
    const response = await session.handle(
      { id: 'o1', kind: 'consult', source: 'probe_broken(.\n' },
      image,
    );
    expect(response.kind).toBe('error');
    if (response.kind !== 'error') return;
    expect(response.error.code).toBe('consult');
    // Drained by `#failClosed`, so the sink is what produced the failure.
    expect(captured).toHaveLength(0);
  }, 180_000);
});
