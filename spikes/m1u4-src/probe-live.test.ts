import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { expect, it } from 'vitest';

import type { BudgetSpec } from '../../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS } from './catalog.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const GENERATED = join(ROOT, 'kb', 'generated');
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

const BUDGET = {
  stackBytes: 1_073_741_824,
  depth: 10_000_000,
  inferences: 1_000_000_000,
  wallClockMs: 600_000,
  answerCap: 100_000,
} satisfies BudgetSpec;

it('runs every SRC catalog goal through one real EngineSession', async () => {
  const session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));

  for (const id of QUESTION_IDS) {
    const started = performance.now();
    const solved = await session.solve(QUESTION_CATALOG[id].goal, BUDGET, id);
    const milliseconds = performance.now() - started;
    if (solved.kind !== 'solutions')
      throw new Error(`${id}: expected solutions, got ${solved.kind}`);
    console.log(`SRC_LIVE\t${id}\t${solved.solutions.length}\t${milliseconds.toFixed(3)}`);
    expect(solved.solutions.length).toBeGreaterThan(0);
  }
}, 120_000);
