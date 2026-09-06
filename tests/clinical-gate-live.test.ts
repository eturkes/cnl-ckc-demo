// M5 u1 red suite — exact-site gate binding against the real generated image.
//
// SEED: every case fails until it encodes its ruled row from
// `.agent/contracts/m5u1.md`. Port the mechanism from
// `git show wt/res-m5-2:tests/m5-fragment-binding.probe.test.ts`.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';
import { gateRecords, keyOf, ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | {
      default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
    };
const load = typeof factory === 'function' ? factory : factory.default;
const diagnostics: string[] = [];
let engine: Engine;

const row = (goal: string): Record<string, unknown> => {
  const result = engine.prolog.query(goal).once();
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`query returned no bindings: ${goal}`);
  }
  if ('$error' in result) throw new Error(JSON.stringify(result));
  return result as Record<string, unknown>;
};

const atom = (value: string): string => `'${value.replaceAll("'", "''")}'`;

beforeAll(async () => {
  engine = await load(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))))({
    print: () => {},
    printErr: (line: unknown) => diagnostics.push(String(line)),
  });
  for (const predicate of [
    'guideline_entity/4',
    'guideline_cardinality/5',
    'guideline_event/3',
    'guideline_arg/4',
    'guideline_operator/3',
    'guideline_pp/4',
    'guideline_property/4',
  ]) {
    row(`dynamic(${predicate}).`);
  }
}, 120_000);

const unimplemented = (): never => {
  throw new Error('unimplemented');
};

describe('clinical gate binding', () => {
  it('T2 each gate executes every line it names, under its own premises', () => {
    expect(gateRecords).toHaveLength(48);
    expect([...engine.prolog.query('clause(clinical_gate(_,_,_,_),_,_).')]).toHaveLength(48);
    expect(String(row("(clinical_gate('cdc2022-opioid-rec01',2,_,_) -> R=yes ; R=no).").R)).toBe(
      'no',
    );

    const native: string[] = [];
    const bounded: string[] = [];
    const failures: string[] = [];
    for (const gate of gateRecords) {
      const document = atom(gate.document);
      const result = row(
        `catch(call_with_inference_limit(snapshot((forall(clinical_premise(${document},${String(gate.sentence)},_,P),assertz(P)),(clinical_gate(${document},${String(gate.sentence)},_,L)->R=yes;R=no))),200000,Why),E,(R=error,Why=E)).`,
      );
      const key = keyOf(gate.document, gate.sentence);
      if (String(result.R) === 'yes') {
        native.push(key);
        expect(String(result.L).split(',').filter(Boolean).map(Number), key).toEqual(gate.lines);
      } else if (String(result.Why) === 'inference_limit_exceeded') {
        bounded.push(key);
      } else {
        failures.push(`${key}:${String(result.R)}/${String(result.Why)}`);
      }
    }

    expect(bounded.sort()).toEqual(
      [
        'cdc2022-opioid-rec01:3',
        'cdc2022-opioid-rec02:3',
        'cdc2022-opioid-rec02:8',
        'cdc2022-opioid-rec05:4',
      ].sort(),
    );
    expect(failures).toEqual([]);
    expect(native).toHaveLength(46);
    expect(diagnostics).toEqual([]);
  }, 120_000);
  it(
    'T15 exact-site refutation: deletion fails, same-head reassertion stays failed',
    unimplemented,
  );
});
