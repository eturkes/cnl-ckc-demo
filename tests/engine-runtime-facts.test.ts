// Runtime facts `.claude/rules/engine.md` states about the pinned swipl-wasm build, each
// re-derived against the shipped saved image rather than carried as a one-off measurement.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';
import { createEncoder, decodeTerm } from '../src/engine/terms.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const image = new Uint8Array(readFileSync(join(ROOT, 'kb', 'generated', 'kb.pvm')));
const ID = "'$guideline_id'(product,doc,1,ref(1),[])";

let engine: Engine;

beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  engine = await load(image)({});
}, 120_000);

/** One binding of a goal, as the native value swipl-wasm hands back. */
const native = (goal: string, name: string): unknown =>
  (engine.prolog.query(goal).once() as Record<string, unknown>)[name];

/** How the engine renders a value passed back in as a query binding. */
const reentered = (value: unknown): { text: string; arity: number } => {
  const result = engine.prolog
    .query('term_string(Z,S), (compound(Z) -> functor(Z,_,A) ; A = 0)', { Z: value })
    .once() as Record<string, unknown>;
  const text = result.S as { v?: string } | string;
  return { text: typeof text === 'string' ? text : (text.v ?? ''), arity: Number(result.A) };
};

describe('engine runtime facts', () => {
  it('corrupts a guideline id round-tripped through JSON: arity 1 and ref([1])', () => {
    const value = native(`X = ${ID}.`, 'X');
    const viaJson = reentered(JSON.parse(JSON.stringify(value)));
    expect(viaJson.arity).toBe(1);
    expect(viaJson.text).toContain('ref([1])');
    // The safe path: decode, then rebuild through the engine's own constructors.
    const viaEncoder = reentered(createEncoder(engine.prolog)(decodeTerm(value)));
    expect(viaEncoder).toEqual({ text: ID, arity: 5 });
  });

  it('serializes the rational 1r3 as 3r1', () => {
    const value = native('X is 1r3.', 'X');
    expect(JSON.stringify(value)).toBe('"3r1"');
    expect(reentered(value).text).toBe('1r3');
  });

  it('starts the saved image at a 1 GiB unified stack limit', () => {
    expect(native('current_prolog_flag(stack_limit, L).', 'L')).toBe(1073741824);
  });

  it('ships a loader that calls direct eval', () => {
    const bundle = readFileSync(
      require.resolve('swipl-wasm/dist/swipl/swipl-bundle-no-data.js'),
      'utf8',
    );
    expect(bundle).toMatch(/[^.\w]eval\(/u);
  });
});
