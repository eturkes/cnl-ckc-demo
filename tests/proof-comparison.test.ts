// n9 (`.agent/contracts/n9-comparison.md`): the meta-interpreter evaluates the comparison
// built-ins `guideline_satisfies/4,6` where they stand and records each as a line-free
// `builtin(G)` leaf, as upstream's traces do — over the shipped saved image, through `derive/5`
// under premises, and through the session's proof RPC.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PROOF_BUDGET_MAX } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { proofClauses } from '../src/provenance/model.js';
import { exportedQueries } from '../tools/kb/exports.mjs';

import { bagFiles, ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

let engine: Engine;
let session: EngineSession;

beforeAll(async () => {
  const image = new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm')));
  engine = await loadImage(image);
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
}, 120_000);

/** One deterministic solution's bindings, or a thrown Prolog error. */
const row = (goal: string): Record<string, unknown> => {
  const result = engine.prolog.query(goal).once() as Record<string, unknown> | null;
  if (result === null || '$error' in result) throw new Error(`${goal}: ${JSON.stringify(result)}`);
  return result;
};

/** The proof `mi/3` returns, rendered by the engine, or `no` when it derives nothing. */
const proved = (goal: string, depth: number): string =>
  String(
    row(`(mi((${goal}),${String(depth)},P) -> with_output_to(string(T), writeq(P)) ; T = no).`).T,
  );

const limited = (goal: string, depth: number): boolean =>
  row(`(mi_limited((${goal}),${String(depth)}) -> L = yes ; L = no).`).L === 'yes';

describe('comparison built-ins in the meta-interpreter', () => {
  it('K1 a comparison derives as one line-free builtin leaf, at any depth, and a false one fails', () => {
    for (const depth of [5, 0]) {
      expect(proved('guideline_satisfies(exactly,60,geq,50)', depth), String(depth)).toBe(
        '[builtin(guideline_satisfies(exactly,60,geq,50))]',
      );
      expect(proved('guideline_satisfies(exactly,40,geq,50)', depth), String(depth)).toBe('no');
      expect(limited('guideline_satisfies(exactly,40,geq,50)', depth), String(depth)).toBe(false);
    }
    expect(proved('\\+ guideline_satisfies(exactly,40,geq,50)', 1)).toBe(
      '[naf(guideline_satisfies(exactly,40,geq,50))]',
    );
    expect(proved('\\+ guideline_satisfies(exactly,60,geq,50)', 1)).toBe('no');
    expect(proved('user:guideline_satisfies(exactly,60,geq,50)', 1)).toBe(
      '[builtin(guideline_satisfies(exactly,60,geq,50))]',
    );
    expect(proved('lists:guideline_satisfies(exactly,60,geq,50)', 1)).toBe('no');
    expect(limited('lists:guideline_satisfies(exactly,60,geq,50)', 1)).toBe(true);
  });

  it('K2 the six-argument form converts units and never compares across dimensions', () => {
    expect(proved('guideline_satisfies(exactly,240,minute,geq,4,hour)', 1)).toBe(
      '[builtin(guideline_satisfies(exactly,240,minute,geq,4,hour))]',
    );
    expect(proved('guideline_satisfies(exactly,239,minute,geq,4,hour)', 1)).toBe('no');
    expect(proved('guideline_satisfies(exactly,1,month,geq,30,day)', 1)).toBe('no');
  });

  it('K3 a rule body that calls the built-in derives under premises, its comparison a leaf of the clause', () => {
    const head =
      "guideline_operator(actual,'$guideline_id'(context,'cdc2022-opioid-rec02-imp07',1,box(1)," +
      '[n9_patient,n9_pain,n9_joint,n9_have,n9_clinician]),may)';
    const premises = (joints: number): string =>
      [
        'guideline_entity(actual,n9_patient,patient,countable)',
        'guideline_cardinality(actual,n9_patient,na,eq,1)',
        "guideline_entity(actual,n9_pain,'osteoarthritis-pain',countable)",
        'guideline_cardinality(actual,n9_pain,na,eq,1)',
        'guideline_entity(actual,n9_joint,joint,countable)',
        `guideline_cardinality(actual,n9_joint,na,exactly,${String(joints)})`,
        'guideline_event(actual,n9_have,have)',
        'guideline_arg(actual,n9_have,1,n9_patient)',
        'guideline_arg(actual,n9_have,2,n9_pain)',
        'guideline_pp(actual,n9_have,in,n9_joint)',
        'guideline_entity(actual,n9_clinician,clinician,countable)',
        'guideline_cardinality(actual,n9_clinician,na,eq,1)',
      ].join(',');
    const derived = (joints: number): string =>
      String(
        row(
          `(derive(${head},2,[${premises(joints)}],P,proved) -> ` +
            'with_output_to(string(T), writeq(P)) ; T = no).',
        ).T,
      );
    const proof = derived(3);
    expect(proof).toMatch(/^\[node\(line\(\d+\),guideline_operator\(actual,/u);
    expect(proof).toContain('builtin(guideline_satisfies(exactly,3,geq,2))');
    expect(proof.match(/assumption\(/gu)).toHaveLength(12);
    expect(proof.match(/line\(/gu)).toHaveLength(1);
    expect(derived(1)).toBe('no');
  });

  it('K4 no premise stands in for a comparison', () => {
    const goal = 'guideline_satisfies(exactly,40,geq,50)';
    expect(row(`(derive(${goal},1,[${goal}],_,proved) -> D = yes ; D = no).`).D).toBe('no');
  });

  it('K5 the proof RPC settles a proof through the tablet-use-spacing export, its comparison line-free', async () => {
    const query = exportedQueries(bagFiles).find(({ id }) => id === 'tablet-use-spacing');
    if (query === undefined) throw new Error('tablet-use-spacing is not a declared export');
    const outcome = await session.prove({ constrainedGoal: query.goal }, PROOF_BUDGET_MAX);
    expect(outcome.kind).toBe('proof');
    const steps = outcome.kind === 'proof' ? outcome.steps : [];
    const clauses = proofClauses(steps);
    expect(clauses.length).toBeGreaterThan(0);
    expect(clauses.every(({ line }) => Number.isSafeInteger(line) && line > 0)).toBe(true);
    const comparisons = steps.filter((step) => step.kind === 'comparison');
    expect(comparisons).toEqual([
      { kind: 'comparison', goal: 'guideline_satisfies(geq,4,hour,geq,4,hour)' },
    ]);
  });
});
