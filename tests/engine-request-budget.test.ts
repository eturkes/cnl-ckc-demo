// Budgets bound the whole request: an inference budget that re-armed per solution would let a
// many-solution goal outspend it while every single step stayed inside.

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
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({});
};

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
  const setup = await session.solve(
    'assertz((u3_deep(0):-!)),assertz((u3_deep(N):-N>0,M is N-1,u3_deep(M))).',
    budget(),
  );
  expect(setup.kind).toBe('solutions');
});

describe('request-wide budgets', () => {
  it('P3.2 — depth and inference yield early solutions before terminating', async () => {
    const depth = await session.solve('between(1,20,X),u3_deep(X).', budget({ depth: 8 }));
    expect(depth).toMatchObject({ kind: 'limit', limit: 'depth' });
    if (depth.kind !== 'limit') throw new Error('depth did not trip');
    expect(depth.solutions.length).toBeGreaterThan(0);
    const goal = 'between(1,20,X),forall(between(1,100,_),true).';
    const measured = await session.solve(
      'statistics(inferences,Before),forall((between(1,20,_),forall(between(1,100,_),true)),true),' +
        'statistics(inferences,After),Cost is After-Before.',
      budget(),
    );
    if (measured.kind !== 'solutions') throw new Error('inference calibration did not answer');
    const cost = measured.solutions[0]?.bindings.Cost;
    expect(cost?.kind).toBe('integer');
    if (cost?.kind !== 'integer') throw new Error('inference cost was not an integer');
    expect(Number(cost.value)).toBeGreaterThan(500);
    const inference = await session.solve(goal, budget({ inferences: 500 }));
    expect(
      inference,
      `whole-request cost=${String(cost.value)}, budget=500, result=${inference.kind}, ` +
        `answers=${'solutions' in inference ? inference.solutions.length : 0}`,
    ).toMatchObject({ kind: 'limit', limit: 'inference' });
    if (inference.kind !== 'limit') throw new Error('whole-request inference budget did not trip');
    expect(inference.solutions.length).toBeGreaterThan(0);
    expect(inference.solutions.length).toBeLessThan(20);
  });

  it('meters search that fails after the last answer', async () => {
    // Two answers stay inside 500; the third branch spends ~200 more and fails, so the request
    // outspends its budget with no further answer to carry the total.
    const tail = await session.solve(
      'between(1,3,X),forall(between(1,100,_),true),X<3.',
      budget({ inferences: 500 }),
    );
    expect(tail).toMatchObject({ kind: 'limit', limit: 'inference' });
    if (tail.kind !== 'limit') throw new Error('trailing search was not metered');
    expect(tail.solutions.map((solution) => solution.display.X)).toEqual(['1', '2']);
  });

  it('meters the goal alone, never the rendering of earlier answers', async () => {
    // The goal costs ~630 inferences across three answers. Rendering each answer is an engine
    // query of its own; counted in between, those calls would carry the total past 650.
    const answered = await session.solve(
      'between(1,3,X),forall(between(1,100,_),true).',
      budget({ inferences: 650 }),
    );
    expect(answered).toMatchObject({ kind: 'solutions' });
    if (answered.kind !== 'solutions') throw new Error('display calls entered the meter');
    expect(answered.solutions.map((solution) => solution.display.X)).toEqual(['1', '2', '3']);
  });
});
