import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import type { Engine } from '../src/engine/session';
import { EngineSession, type ImageLoader } from '../src/engine/session';
import type { BudgetSpec } from '../src/engine/protocol';
import { compileCatalog, ROOT } from '../tools/spikes/m1u4-gen/catalog.mjs';

const require = createRequire(import.meta.url);
const GENERATED = join(ROOT, 'kb', 'generated');
const BUDGET: BudgetSpec = {
  stackBytes: 67_108_864,
  depth: 100_000,
  inferences: 10_000_000,
  wallClockMs: 10_000,
  answerCap: 1_000,
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

it('runs the six generated catalog goals through EngineSession', async () => {
  const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
    contract: { schemaVersion: number; documents: number };
  };
  const session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));
  const { records } = compileCatalog();
  const results: Record<string, { solutions: number; wallClockMs: number; outcome: string }> = {};
  for (const record of records) {
    const started = performance.now();
    const result = await session.solve(record.goal, BUDGET, record.id);
    const elapsed = Number((performance.now() - started).toFixed(3));
    expect(result.kind).toBe('solutions');
    results[record.id] = {
      solutions: result.kind === 'solutions' ? result.solutions.length : 0,
      wallClockMs: elapsed,
      outcome: result.kind,
    };
  }
  process.stdout.write(`GEN_LIVE ${JSON.stringify({ budget: BUDGET, results })}\n`);
}, 30_000);
