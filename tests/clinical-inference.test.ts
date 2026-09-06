// M5 u2 red suite — the query-local cap-2 assumption evaluator, against the real image.
//
// SEED: every case fails until it encodes its ruled predicate from
// `.agent/contracts/m5u2.md`. One case per predicate P1-P8; P9/P10 are MAIN's own
// measurements and carry no case here.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';
import { ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | {
      default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
    };
const load = typeof factory === 'function' ? factory : factory.default;
const diagnostics: string[] = [];
let engine: Engine;

/** One deterministic solution, or a thrown Prolog error. */
export const row = (goal: string): Record<string, unknown> => {
  const result = engine.prolog.query(goal).once();
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`query returned no bindings: ${goal}`);
  }
  if ('$error' in result) throw new Error(JSON.stringify(result));
  return result as Record<string, unknown>;
};

/**
 * Runs `goal` under the reviewed proof envelope and reports which bound stopped it.
 * A bare success/failure cannot tell exhaustion from refutation, and P3/P8 both turn
 * on that difference.
 */
export const bounded = (goal: string, after = ''): Record<string, unknown> =>
  row(
    `(catch(call_with_inference_limit(call_with_depth_limit(once((${goal})),100,Depth),100000,Inf),` +
      `error(resource_error(stack),_),Inf=stack) -> ` +
      `(Inf==inference_limit_exceeded -> State=inferences ; Inf==stack -> State=stack ; ` +
      `Depth==depth_limit_exceeded -> State=depth ; State=proved) ; State=failed)` +
      (after === '' ? '.' : `,(State==proved -> (${after}) ; true).`),
  );

beforeAll(async () => {
  engine = await load(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))))({
    print: () => {},
    printErr: (line: unknown) => diagnostics.push(String(line)),
  });
}, 120_000);

describe('clinical assumption evaluator', () => {
  it('P1 leaves the shipped proof path unchanged', () => {
    expect.fail('unencoded');
  });

  it('P2 moves no content-site line and no gate line list', () => {
    expect.fail('unencoded');
  });

  it('P3 derives all 48 sentences at cap 2 and exactly 47 at cap 1', () => {
    expect.fail('unencoded');
  });

  it('P4 fails the derivation for every one of the 686 cited clauses erased alone', () => {
    expect.fail('unencoded');
  });

  it('P5 yields no full document recommendation under either negative control', () => {
    expect.fail('unencoded');
  });

  it('P6 reports every hypothetical premise as a source-line-free assumption leaf', () => {
    expect.fail('unencoded');
  });

  it('P7 mutates no world state and leaves every schema predicate static', () => {
    expect.fail('unencoded');
  });

  it('P8 keeps every derivation inside the reviewed proof budget', () => {
    expect.fail('unencoded');
  });

  it('emits no engine diagnostic', () => {
    expect(diagnostics).toEqual([]);
  });
});
