// The scope guard is a real search. Every `should`, `must` and `may` edge ends with
// `\+ guideline_exclusion(K)` (README-dist `Scope exclusions`), and a negation over an indicator
// `resolve/3` does not name succeeds by never looking: an interpreter naming 19 of the 22
// indicators proved every guard at every depth. Over the shipped saved image.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';

import { bagFiles, filePath, ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const GUARD = "\\+ guideline_exclusion('cdc-2022-opioid')";
const DOCUMENT = 'cdc2022-opioid-rec01';
const SENTENCE = 3;

let engine: Engine;

beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  engine = await load(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))))({});
}, 120_000);

/** One deterministic solution's bindings, or a thrown Prolog error. */
const row = (goal: string): Record<string, unknown> => {
  const result = engine.prolog.query(goal).once() as Record<string, unknown> | null;
  if (result === null || '$error' in result) throw new Error(`${goal}: ${JSON.stringify(result)}`);
  return result;
};

/** The indicators every compiled document declares, read from the bag itself. */
const declared = (): [string, number][] => {
  const text = Buffer.from(bagFiles.get(filePath(bagFiles, `/pl/${DOCUMENT}.pl`)) ?? []).toString(
    'utf8',
  );
  return [...text.matchAll(/^:- multifile\((guideline_[a-z_]+)\/(\d+)\)\.$/gmu)].map((match) => [
    match[1] ?? '',
    Number(match[2]),
  ]);
};

/** The sentence's gate derives at the shipped depth under its premises plus `extra`. */
const gate = (extra: string): string =>
  String(
    row(
      `clinical_context('${DOCUMENT}',${String(SENTENCE)},Premises),` +
        `mark_member(guideline_entity(actual,Patient,patient,countable),Premises),` +
        `app(Premises,${extra},As),` +
        `clause(clinical_gate('${DOCUMENT}',${String(SENTENCE)},_,_),Body,_),` +
        `gate_heads(Body,Heads),clinical_depth(D),` +
        `(derive_all(Heads,D,As,_) -> R = derived ; R = blocked).`,
    ).R,
  );

const PATIENT = [
  'guideline_entity(actual,p,patient,countable)',
  'guideline_cardinality(actual,p,na,eq,1)',
];
const HOSPITAL = [
  "guideline_entity(actual,care,'hospital-care',countable)",
  'guideline_cardinality(actual,care,na,eq,1)',
  'guideline_event(actual,r,receive)',
  'guideline_arg(actual,r,1,p)',
  'guideline_arg(actual,r,2,care)',
];
const DISCHARGE = [
  "guideline_entity(actual,rx,'pain-management-prescription',countable)",
  'guideline_cardinality(actual,rx,na,eq,1)',
  "guideline_entity(actual,dis,'facility-discharge',countable)",
  'guideline_cardinality(actual,dis,na,eq,1)',
  'guideline_event(actual,dr,receive)',
  'guideline_arg(actual,dr,1,p)',
  'guideline_arg(actual,dr,2,rx)',
  'guideline_pp(actual,dr,at,dis)',
];

/** The guard's reading under premises `as`: the interpreter's, and native Prolog's over them. */
const readings = (as: readonly string[]): { interpreter: string; native: string } => {
  const interpreter = String(
    row(`(derive(${GUARD},4,[${as.join(',')}],_,proved) -> R = in_scope ; R = excluded).`).R,
  );
  const dynamic = [
    'guideline_entity/4',
    'guideline_cardinality/5',
    'guideline_event/3',
    'guideline_arg/4',
    'guideline_pp/4',
  ].map((indicator) => `dynamic(${indicator})`);
  const native = String(
    row(
      `snapshot((${[...dynamic, ...as.map((goal) => `assertz(${goal})`)].join(',')},` +
        `(${GUARD} -> R = in_scope ; R = excluded))).`,
    ).R,
  );
  return { interpreter, native };
};

describe('scope guard resolution', () => {
  it('G1 names every indicator the bag declares as a schema goal', () => {
    const indicators = declared();
    expect(indicators).toHaveLength(22);
    const unnamed = indicators.filter(
      ([name, arity]) =>
        row(
          `(schema_goal(${name}(${Array.from({ length: arity }, () => '_').join(',')}))` +
            ` -> S = yes ; S = no).`,
        ).S !== 'yes',
    );
    expect(unnamed).toEqual([]);
  });

  it('G2 searches the guard: a limit below depth 2, a proof from depth 2', () => {
    const status = (depth: number): string =>
      String(row(`(derive(${GUARD},${String(depth)},[],_,S) -> true ; S = failed).`).S);
    expect([1, 2, 3].map(status)).toEqual(['limit', 'proved', 'proved']);
  });

  it('G3 an exclusion the premises satisfy blocks the recommendation it guards', () => {
    expect(gate('[]')).toBe('derived');
    const cancer =
      "[guideline_entity(actual,g3_pain,'cancer-related-pain',countable)," +
      'guideline_cardinality(actual,g3_pain,na,eq,1),guideline_event(actual,g3_have,have),' +
      'guideline_arg(actual,g3_have,1,Patient),guideline_arg(actual,g3_have,2,g3_pain)]';
    expect(gate(cancer)).toBe('blocked');
  });

  it('G4 reads an exclusion and its exception as native Prolog does, in any premise order', () => {
    // s7-02: hospital care excludes the guideline unless the patient receives a pain-management
    // prescription at discharge. The exception's `receive` event is existential: every premise
    // that unifies is a candidate, not the first one alone.
    expect(readings([...PATIENT, ...HOSPITAL])).toEqual({
      interpreter: 'excluded',
      native: 'excluded',
    });
    expect(readings([...PATIENT, ...HOSPITAL, ...DISCHARGE])).toEqual({
      interpreter: 'in_scope',
      native: 'in_scope',
    });
    expect(readings([...PATIENT, ...DISCHARGE, ...HOSPITAL])).toEqual({
      interpreter: 'in_scope',
      native: 'in_scope',
    });
  });

  it('G5 derives a superseded statement only under an evaluation date before its effective date', () => {
    const head =
      "guideline_operator(actual,'$guideline_id'(context,'cdc2022-opioid-rec12-imp08',1,box(1),[c]),should)";
    const clinician = [
      'guideline_entity(actual,c,clinician,countable)',
      'guideline_cardinality(actual,c,na,eq,1)',
    ];
    const derives = (date: number | null): string =>
      String(
        row(
          `(derive(${head},4,[${[...clinician, ...(date === null ? [] : [`guideline_evaluation_date(${String(date)})`])].join(',')}],_,proved)` +
            ` -> R = derived ; R = blocked).`,
        ).R,
      );
    expect([null, 20221228, 20221229, 20261030].map(derives)).toEqual([
      'blocked',
      'derived',
      'blocked',
      'blocked',
    ]);
  });
});
