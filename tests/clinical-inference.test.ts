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
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import {
  gateRecords,
  orderedHash,
  ROOT,
  scanContentSites,
  sha12,
} from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | {
      default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
    };
const load = typeof factory === 'function' ? factory : factory.default;
const diagnostics: string[] = [];
let engine: Engine;

const atom = (value: string): string => `'${value.replaceAll("'", "''")}'`;

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
    const shape = row(
      `(current_predicate(mi/3)->Mi=yes;Mi=no),` +
        `(current_predicate(mi_limited/2)->Limited=yes;Limited=no),` +
        `(mi_limited(guideline_schema_version(1),0)->AtZero=yes;AtZero=no),` +
        `(mi_limited(guideline_schema_version(1),1)->AtOne=yes;AtOne=no).`,
    );
    expect(shape).toMatchObject({ Mi: 'yes', Limited: 'yes', AtZero: 'yes', AtOne: 'no' });

    const hashes = Object.fromEntries(
      QUESTION_IDS.map((id) => {
        const goal = QUESTION_CATALOG[id].goal;
        const result = row(
          `findall(T,(mi((${goal}),1,P),copy_term(((${goal}),P),C),numbervars(C,0,_),` +
            `term_string(C,T,[quoted(true),numbervars(true)])),Ts),msort(Ts,S),` +
            `atomic_list_concat(S,'\\n',Text).`,
        );
        return [id, sha12(String(result.Text))];
      }),
    );
    expect(hashes).toEqual({
      'when-to-use-opioids': '7a0ed798d5fd',
      'starting-opioid-therapy': '1665049364d4',
      'acute-pain-prescription-duration': '363fe73276f0',
      'opioid-follow-up': 'b2c1697e4257',
      'opioid-safety': 'c1d6d78491fc',
      'continuing-or-tapering-opioids': '1ba2c32a728b',
      'opioid-use-disorder-treatment': '575e5888e390',
    });
  });

  it('P2 moves no content-site line and no gate line list', () => {
    const siteLines = scanContentSites().flatMap(({ sites }) => sites.map(({ line }) => line));
    expect(siteLines).toHaveLength(686);
    expect(orderedHash(siteLines.map(String))).toBe('211e14164a47');

    const gateLines = gateRecords.flatMap(({ lines }) => lines);
    expect(gateRecords).toHaveLength(48);
    expect(
      orderedHash(
        gateRecords.map(
          ({ document, sentence, lines }) =>
            `${document}:${String(sentence)}:${lines.join(',')}`,
        ),
      ),
    ).toBe('4a9aa7427273');
    expect([...gateLines].sort((left, right) => left - right)).toEqual(
      [...siteLines].sort((left, right) => left - right),
    );

    for (const gate of gateRecords) {
      const result = row(
        `clause(clinical_gate(${atom(gate.document)},${String(gate.sentence)},_,Lines),_,_),` +
          `atomic_list_concat(Lines,',',Text).`,
      );
      expect(
        String(result.Text).split(',').filter(Boolean).map(Number),
        `${gate.document}:${String(gate.sentence)}`,
      ).toEqual(gate.lines);
    }
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
