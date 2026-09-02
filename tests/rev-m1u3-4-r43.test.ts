// R43 / D7 / P2.8 — limit classification is selected by decoded term structure alone.
//
// The decisive pairs: identical misleading text under different structures must
// classify differently, and identical structure under different payloads must
// classify the same. Every case is thrown into the real PVM through the shipped
// wrapper, so the classifier under test is the one that ships.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { BudgetSpec } from '../src/engine/protocol.js';
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

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 100,
  ...overrides,
});

/** The text every misleading case carries; only structure may decide anything. */
const BAIT = 'resource_error(stack) stack_limit_exceeded depth_limit_exceeded';

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readGenerated('kb.pvm')));
}, 120_000);

const errorCodeOf = async (goal: string): Promise<string> => {
  const response = await session.handle(
    { id: 'r43', kind: 'query', goal, budget: budget() },
    new Uint8Array(0),
  );
  if (response.kind !== 'error') throw new Error(`expected error, got ${response.kind}`);
  return response.error.code;
};

describe('R43 structural limit classification', () => {
  it('classifies a real stack trip as stack', async () => {
    const solved = await session.solve('length(L,20000000).', budget({ stackBytes: 8388608 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind === 'limit') expect(solved.limit).toBe('stack');
  }, 120_000);

  it('keeps limit text out of the decision: same bait, three structures', async () => {
    // Structure 1: not a resource error at all, so the wrapper's catch cannot unify
    // it. Observed: the iterator path swallows the exception and the run reports
    // `failure` — no limit is selected, which is what R43 asks. That an uncaught
    // exception is indistinguishable from honest zero-solution is a separate,
    // already-registered finding (`rev-m1u3-2` register row).
    const unrelated = await session.solve(
      `throw(error(type_error(evaluable,'${BAIT}'),context(a,b))).`,
      budget(),
    );
    expect(unrelated.kind).toBe('failure');

    // Structure 2: the bait as an ordinary binding value. A user variable is not a
    // wrapper variable, so it decodes as a solution.
    const bound = await session.solve(`X = '${BAIT}'.`, budget());
    expect(bound.kind).toBe('solutions');
    if (bound.kind === 'solutions') {
      expect(bound.solutions[0]?.bindings.X).toEqual({ kind: 'atom', value: BAIT });
    }

    // Structure 3: a genuine resource error carrying the same bait as its context.
    // Same text as case 1, opposite verdict — structure is the only difference.
    const resourced = await session.solve(
      `throw(error(resource_error(stack),'${BAIT}')).`,
      budget(),
    );
    expect(resourced.kind).toBe('limit');
    if (resourced.kind === 'limit') expect(resourced.limit).toBe('stack');
  }, 120_000);

  it('selects the limit from the resource atom, holding the structure fixed', async () => {
    const stack = await session.solve("throw(error(resource_error(stack),'x')).", budget());
    const heap = await session.solve("throw(error(resource_error(memory),'x')).", budget());
    expect(stack).toMatchObject({ kind: 'limit', limit: 'stack' });
    expect(heap).toMatchObject({ kind: 'limit', limit: 'heap' });
    // An atom this build has no state for stays unclassified rather than guessed.
    expect(await errorCodeOf("throw(error(resource_error(threads),'x')).")).toBe('prolog');
  }, 120_000);

  it('binds depth and inference outcomes from the wrapper variables, not from text', async () => {
    await session.solve(
      'assertz((r43_deep(0):-!)),assertz((r43_deep(N):-N>0,M is N-1,r43_deep(M))).',
      budget(),
    );
    const depth = await session.solve('r43_deep(5000).', budget({ depth: 50 }));
    const inference = await session.solve('r43_deep(5000).', budget({ inferences: 1000 }));
    expect(depth).toMatchObject({ kind: 'limit', limit: 'depth' });
    expect(inference).toMatchObject({ kind: 'limit', limit: 'inference' });
  }, 120_000);
});
