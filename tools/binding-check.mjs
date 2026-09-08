// `pnpm binding:check` — run the whole suite, then require every declared binding check to
// have PASSED in that same run.
//
// The non-negotiable is that every answer traces to a genuine Prolog solution. The checks
// that decide it all existed before this step and none of them was load-bearing: deleting a
// suite dropped the test count and nothing noticed. Naming each case here is what turns
// "present" into "required" — a rename, a deletion or an `it.skip` fails the gate.
//
// This step REPLACES `pnpm test` in the gate chain. Grading a separate run would execute
// every live suite twice and grade a run the gate did not use; grading a report from an
// earlier run raises a staleness question no cheap check settles. Running the suite through
// the inventory settles both.
//
// Usage: node tools/binding-check.mjs [-- <vitest args>]

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LANE_SUITE } from './kb/exports.mjs';
import { ROOT } from './kb/paths.mjs';

/** @typedef {{ fullName: string, status: string }} CaseResult */
/** @typedef {{ name: string, assertionResults: CaseResult[] }} SuiteResult */

/**
 * The required binding checks, by suite and EXACT case name.
 *
 * `why` is the register: it says which part of the non-negotiable the row holds up, so a
 * later unit can tell a load-bearing case from a convenient one.
 */
const REQUIRED = Object.freeze([
  {
    suite: 'tests/clinical-binding.test.ts',
    why: 'perturbing guideline_* moves the answer and the line-keyed proof',
    cases: [
      'guideline_* perturbation E1 an additive schema overlay adds its own solution to a live exported answer',
      'guideline_* perturbation E2 erasing one cited clause drops that document and its proof, and nothing else',
      'guideline_* perturbation E3 shifting the compiled source moves every proof line and leaves the answers identical',
    ],
  },
  {
    suite: 'tests/clinical-answer-live.test.ts',
    why: 'the answer is derived at run time, not read back',
    cases: [
      'runtime clinical answers A1 twelve answers derive from the shipped goal',
      'runtime clinical answers A2/A3 every derived answer and source id is term-identical to u1 oracle',
      'runtime clinical answers A4 the payload carries no clinical_advice fact, only the derivation rules',
      'runtime clinical answers A5 clinical_advice/3 is static, so no assertz can fabricate an answer',
      'runtime clinical answers A6 withholding one document premises drops exactly that answer',
    ],
  },
  {
    suite: 'tests/clinical-proof-live.test.ts',
    why: 'the proof is the derivation, not a rendering of the answer',
    cases: [
      'live clinical proof B1 nothing precomputed survives: no advice_source record, no fabricated node builder',
      'live clinical proof B2/B4 every clause step cites a line from its own gate, and the union is the gate set',
      'live clinical proof B3 every clause step head unifies with the clause compiled at the line it names',
      'live clinical proof B5 erasing a cited clause line removes the proof it was cited by',
      'live clinical proof B7 a wrong answer term yields no proof, so the proof is not fabricated from the answer',
    ],
  },
  {
    suite: 'tests/clinical-inference.test.ts',
    why: 'the evaluator is complete, exhaustively site-bound and side-effect free',
    cases: [
      'clinical assumption evaluator P3 derives all 48 sentences at cap 2 and exactly 47 at cap 1',
      'clinical assumption evaluator P4 fails the derivation for every one of the 686 cited clauses erased alone',
      'clinical assumption evaluator P5 yields no full document recommendation under either negative control',
      'clinical assumption evaluator P7 mutates no world state and leaves every schema predicate static',
      'clinical assumption evaluator P8 keeps every derivation inside the reviewed proof budget',
    ],
  },
  {
    suite: 'tests/clinical-gate-live.test.ts',
    why: 'each cited site is the site that carries the derivation',
    cases: [
      'clinical gate binding T2 each gate executes every line it names, under its own premises',
      'clinical gate binding T15 exact-site refutation: deletion fails, same-head reassertion stays failed',
    ],
  },
  {
    suite: LANE_SUITE,
    why: 'the compiled KB still answers the upstream export exactly',
    cases: [
      'legacy export lane D1 the declared exports are exactly the compiled queries the bag carries',
      'legacy export lane D2 a renamed, extra or missing exported query is refused by name',
      'legacy export lane D3/D4 every exported goal answers its committed oracle byte for byte',
      'legacy export lane D5 erasing one payload dependency reddens exactly its export',
    ],
  },
  {
    suite: 'tests/kb-live.test.ts',
    why: 'fail closed on a missing or partial image',
    cases: [
      'generated runtime payload refuses a truncated saved state instead of booting a partial engine',
    ],
  },
  {
    suite: 'tests/engine-session.test.ts',
    why: 'fail closed on a boot that never produced an engine',
    cases: ['Q corpus census E27 settles a request typed when boot failed before it'],
  },
  {
    suite: 'tests/engine-recovery.test.ts',
    why: 'fail closed on a consult that did not load',
    cases: [
      'Q consult corpus — the diagnostic sinks in isolation Q treats a FAILING DIRECTIVE as fatal, not only a syntax error',
    ],
  },
  {
    suite: 'tests/engine-budgets.test.ts',
    why: 'fail closed on a solve that does not terminate',
    cases: [
      'P2 typed limit states P2.3 surfaces inference exhaustion as its own state',
      'P5 fail-closed inputs P5.4 discards the engine after a load that emitted a diagnostic',
    ],
  },
]);

const VITEST = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

/** @type {string[]} */
const failures = [];
/** @param {string} message */
const fail = (message) => failures.push(message);

const scratch = mkdtempSync(join(tmpdir(), 'binding-check-'));
const report = join(scratch, 'suite.json');
let graded = 0;
try {
  const run = spawnSync(
    process.execPath,
    [
      VITEST,
      'run',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${report}`,
      ...process.argv.slice(2),
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (run.status !== 0) fail(`vitest exited ${String(run.status)}`);

  /** @type {SuiteResult[]} */
  let suites = [];
  try {
    // Same `JSON.parse` discipline as `loadManifest`: through `unknown`, so the shape claim
    // is an explicit cast rather than an `any` lint would refuse.
    const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(report, 'utf8')));
    suites = /** @type {{ testResults: SuiteResult[] }} */ (parsed).testResults;
  } catch {
    fail('the suite produced no readable report');
  }

  for (const { suite, why, cases } of REQUIRED) {
    const ran = suites.filter((file) => file.name.endsWith(suite));
    if (ran.length === 0) {
      fail(`${suite}: never ran — ${why}`);
      continue;
    }
    const results = ran.flatMap((file) => file.assertionResults);
    for (const name of cases) {
      const matched = results.filter((entry) => entry.fullName === name);
      const only = matched[0];
      if (matched.length !== 1 || only === undefined) {
        fail(`${suite}: "${name}" names ${String(matched.length)} cases, expected exactly 1`);
      } else if (only.status !== 'passed') fail(`${suite}: "${name}" ${only.status}`);
      else graded += 1;
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  process.stderr.write(
    `binding:check failed —\n${failures.map((line) => `  ${line}`).join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `binding:check ok — ${String(graded)} required binding cases passed ` +
      `across ${String(REQUIRED.length)} suites\n`,
  );
}
