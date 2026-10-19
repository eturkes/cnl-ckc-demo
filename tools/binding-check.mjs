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
import { join, relative } from 'node:path';

import { requireFiring } from './control.mjs';
import { LANE_SUITE } from './kb/exports.mjs';
import { ROOT } from './kb/paths.mjs';

/** @typedef {{ fullName: string, status: string, duration?: number | null }} CaseResult */
/** @typedef {{ name: string, assertionResults: CaseResult[] }} SuiteResult */
/** @typedef {{ suite: string, why: string, cases: string[] }} Requirement */

/**
 * The required binding checks, by suite and EXACT case name.
 *
 * `why` is the register: it says which part of the non-negotiable the row holds up, so a
 * later unit can tell a load-bearing case from a convenient one.
 *
 * @type {readonly Requirement[]}
 */
const REQUIRED = Object.freeze([
  {
    suite: 'tests/chat-binding.test.ts',
    why: "a chat KB card and the text the model reads are the engine's answer over guideline_*",
    cases: [
      'chat answer binding to exported KB execution D4 real controller cards and posted result change under a PID-unique guideline_entity overlay and restore after retraction',
      'chat answer binding to exported KB execution D4 fixed-outcome host control fails both card and posted-text binding assertions',
      'chat answer binding to exported KB execution D4 no-dispatch controller-path control fails the same binding assertions',
    ],
  },
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
    suite: 'tests/marks-live.test.ts',
    why: "the panel's marks derive at run time over guideline_* under each sentence's premises, never read back, and an answer derives each sentence once",
    cases: [
      'compiled marks catalog and derivation M2 every marks goal settles solutions under DEMO_BUDGET in answer document and Source order',
      'compiled marks catalog and derivation M3 groups partition every content sentence by its answer consequent, in gate order',
      'compiled marks catalog and derivation M4 every grade and its entity label equal the independent ordered bag-head parse',
      'compiled marks catalog and derivation M5 every sentence keeps the bag-head annotation order, repetitions and empty lists',
      'compiled guideline marks binding M6 unprovable bodies remove exactly four documents; an unprovable grade drops only that grade',
      'compiled guideline marks binding M6 a top-level assumed gate head cannot become a KB mark',
      'compiled guideline marks binding M6 clinical_marks has no facts and refuses a direct static assertion',
      'compiled guideline marks binding M7 bag-side label and quantity mutations move exactly their marks and readings',
      'compiled guideline marks binding M8 each unresolved or unsupported branch removes only its document marks, not its answer',
      'compiled guideline marks binding A7 a duplicate S2 clause cannot stand in for missing S3; only rec03 loses answer and marks',
    ],
  },
  {
    suite: 'tests/qualifier-slot.test.ts',
    why: "the answer term names each action's own verb, and every rendered answer stays byte-identical",
    cases: [
      'qualifier slot Q1 live clinical_rule actions have all 75 keyed values and 19 atom qualifier lists',
      'qualifier slot Q1 live clinical_advice groups retain 63 oracle actions and 17 atom qualifier lists',
      'qualifier slot Q3 all 43 live rendered statements stay byte-identical in document/group order',
    ],
  },
  {
    suite: 'tests/marks-view.test.ts',
    why: "each statement shows the marks of its own group's sentences and no other document's",
    cases: [
      'statement joins M11 joins every (solution,item) pair despite repeated text and permuted documents',
    ],
  },
  {
    suite: 'tests/clinical-inference.test.ts',
    why: 'the evaluator is complete, exhaustively site-bound and side-effect free',
    cases: [
      'clinical assumption evaluator P3 derives all 53 sentences at cap 2 and exactly 51 at cap 1',
      'clinical assumption evaluator P4 fails the derivation for every one of the 723 cited clauses erased alone',
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
    suite: 'tests/kb-reach.test.ts',
    why: 'kb:asset-check ships the planted input that reddens it, and a deleted control leaves a dead scan reading like a clean tree',
    cases: [
      'forbidden answer-oracle reach passes with no control in place',
      'forbidden answer-oracle reach fails kb:asset-check on a static import',
      'forbidden answer-oracle reach fails kb:asset-check on a dynamic import',
      'forbidden answer-oracle reach fails kb:asset-check on a filesystem read',
      'forbidden answer-oracle reach fails kb:asset-check on a joined path',
      'forbidden answer-oracle reach fails kb:asset-check on a concatenated path',
      'JSON serialization ban over src/ fails kb:asset-check on a serializing call',
      'catalog question text ban over src/ and tests/ fails kb:asset-check on a copied question sentence',
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

/**
 * The required RUN-LIFECYCLE checks, by suite and EXACT case name.
 *
 * Separate from `REQUIRED` on purpose: these hold up a claim the VIEW makes on its own —
 * that a run reaches a terminal state and says so — rather than a part of the non-negotiable.
 * Keeping the two registers apart is what lets a later unit read `REQUIRED` as the answer-path
 * roll call without a lifecycle row diluting it. Both are graded by the same inventory loop,
 * so a rename, a deletion or an `it.skip` fails the gate either way.
 *
 * @type {readonly Requirement[]}
 */
const LIFECYCLE = Object.freeze([
  {
    suite: 'tests/chat-controller.test.ts',
    why: 'a chat turn settles into a terminal state, and a stopped or failed turn lands no label',
    cases: [
      'chat lifecycle retires every late callback D6 cancellation before-settlement aborts fetch and goal, posts nothing and lands no segments',
      'chat lifecycle retires every late callback D6 cancellation after-settlement-before-post aborts fetch and goal, posts nothing and lands no segments',
      'chat lifecycle retires every late callback D6 cancellation after answer before done never lands provisional labels or later results',
      'chat lifecycle retires every late callback D6 error reason codex survives a subsequent answer and prevents labels',
      'chat lifecycle retires every late callback D6 transport end network names its failure and discards even a parsed answer',
      'chat lifecycle retires every late callback D6 dispose mid-goal aborts the turn and drops its late result and answer',
    ],
  },
  {
    suite: 'tests/demo-controller.dom.test.ts',
    why: 'a rejected ask settles into a terminal state the view renders',
    cases: [
      'rejected run lifecycle P1 settles a rejected ask as a rendered engine error',
      'rejected run lifecycle P2 fulfils the run promise instead of rejecting it',
      'rejected run lifecycle P3 leaves the answer region unbusy with Cancel disabled and Retry offered',
      'rejected run lifecycle P4 announces the failure with the shipped runFailed copy',
      'rejected run lifecycle P5 lets the next run dispatch its own ask after a rejection',
      'rejected run lifecycle P6 ignores a superseded run rejection and keeps the live state',
      'rejected run lifecycle P7 keeps cancel inert once a rejected run has settled',
    ],
  },
  {
    suite: 'tests/demo-controller.model.test.ts',
    why: 'an independent transition model still agrees with the controller',
    cases: [
      'demo controller transition oracle O1 model and controller agree on every driven transition sequence',
      'demo controller transition oracle O2 model and controller agree on the state a rejected ask leaves behind',
      'demo controller transition oracle O3 model and controller agree on a run started after a rejected run',
      'demo controller transition oracle O4 model and controller agree on a superseded rejection writing nothing',
    ],
  },
]);

const REVIEW_SUITE = 'tests/graph-semantics.review.test.ts';

/**
 * The required GRAPH-MEANING checks, by suite and EXACT case name.
 *
 * A third register rather than a row in either table above: `REQUIRED` is the answer-path roll
 * call and `LIFECYCLE` carries claims the view makes about a run settling, while these hold up
 * the user's graph-polarity ruling — negation and modality ride the EDGES, so no projected edge
 * may read as a claim the source denies. Folding them into either table would cost that table
 * the property that makes it readable.
 *
 * @type {readonly Requirement[]}
 */
const MEANING = Object.freeze([
  {
    suite: REVIEW_SUITE,
    why: 'an edge that drops its scope renders the clinical inverse of its source',
    cases: [
      'semantic graph source fidelity review keeps polarity and modality visible for a negated recommendation',
      'semantic graph source fidelity review keeps modal force and numeric scope visible for a qualified action',
      'semantic graph source fidelity review keeps a nested operator edge attached to its asserted outer context',
      'semantic graph source fidelity review does not turn a negated premise into positive event support',
      'semantic graph source fidelity review does not highlight a direct edge that skips hidden negation contexts',
    ],
  },
  {
    suite: REVIEW_SUITE,
    why: 'the view counts and names the membership it actually shows',
    cases: [
      'semantic graph source fidelity review does not count attributes as concepts or actions',
    ],
  },
  {
    suite: REVIEW_SUITE,
    why: 'role-invalid input is refused where it is read, not dropped inside the projection',
    cases: [
      'semantic graph source fidelity review rejects an argument edge whose source is not an event',
    ],
  },
  {
    suite: REVIEW_SUITE,
    why: 'direction and cited provenance survive the projection',
    cases: [
      'semantic graph source fidelity review reverses a directed relation label when HTML navigation starts at its target',
      'semantic graph source fidelity review keeps every prepared answer highlight inside its cited source contribution',
    ],
  },
  {
    suite: 'tests/graph-orphan-scopes.test.ts',
    why: 'a negation or modal context with no edge of its own still rides every relation it scopes',
    cases: [
      'orphan operator contexts O1 records a literal set on exactly the 83 contexts no edge touches',
      'orphan operator contexts O2 shows each orphan operator on at least one edge',
      'orphan operator contexts O3 shows no orphan literal through an edge of another world',
      'orphan operator contexts O4 matches the literal set re-derived from the bag',
    ],
  },
  {
    suite: 'tests/graph-annotations.test.ts',
    why: 'an annotation or comparison edge carries the scope of the clause that states it',
    cases: [
      'graph annotations A1 every annotation clause and goal projects exactly its row',
      'graph annotations A2 reads each fixture from both ends under its scope, dashed where negated',
      'graph annotations A4 holds every threshold to the world of the cardinality it constrains',
    ],
  },
]);

const VITEST = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

/**
 * Grade an inventory against one suite run. Taking the inventory as a parameter is what lets
 * the control feed the same loop a requirement the run cannot satisfy.
 *
 * @param {readonly Requirement[]} required @param {SuiteResult[]} suites
 * @returns {{failures: string[], graded: number}}
 */
const gradeInventory = (required, suites) => {
  /** @type {string[]} */
  const failures = [];
  let graded = 0;
  for (const { suite, why, cases } of required) {
    const ran = suites.filter((file) => file.name.endsWith(suite));
    if (ran.length === 0) {
      failures.push(`${suite}: never ran — ${why}`);
      continue;
    }
    const results = ran.flatMap((file) => file.assertionResults);
    for (const name of cases) {
      const matched = results.filter((entry) => entry.fullName === name);
      const only = matched[0];
      if (matched.length !== 1 || only === undefined) {
        failures.push(
          `${suite}: "${name}" names ${String(matched.length)} cases, expected exactly 1`,
        );
      } else if (only.status !== 'passed') failures.push(`${suite}: "${name}" ${only.status}`);
      else graded += 1;
    }
  }
  return { failures, graded };
};

/**
 * Grade a declared table, refusing an EMPTY one by name.
 *
 * An empty table grades nothing while the success line still prints its count, so a check
 * that stopped reading its own input and a clean tree emit the same green. Taking the table
 * as a parameter is what lets the control feed this same function the real table emptied.
 *
 * @param {readonly Requirement[]} table @param {string} name @param {SuiteResult[]} suites
 * @returns {{failures: string[], graded: number}}
 */
const gradeTable = (table, name, suites) =>
  table.length === 0
    ? { failures: [`the ${name} table is empty, so it grades no case`], graded: 0 }
    : gradeInventory(table, suites);

/** @type {string[]} */
const failures = [];
/** @param {string} message */
const fail = (message) => failures.push(message);

/**
 * Reported inside the run, not after it: the scratch cleanup runs in a `finally`, and a
 * value assigned there for a later read is what `no-useless-assignment` refuses.
 *
 * @param {number} graded @param {number} lifecycle @param {number} meaning @param {string[]} controls
 */
const report = (graded, lifecycle, meaning, controls) => {
  if (failures.length > 0) {
    process.stderr.write(
      `binding:check failed —\n${failures.map((line) => `  ${line}`).join('\n')}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `binding:check ok — ${String(graded)} required binding cases passed ` +
        `across ${String(REQUIRED.length)} suites, ${String(lifecycle)} lifecycle cases ` +
        `across ${String(LIFECYCLE.length)} suites, ${String(meaning)} graph-meaning cases ` +
        `across ${String(MEANING.length)} declared rows; controls: ${controls.join(', ')}\n`,
    );
  }
};

const SLOWEST = 10;
const scratch = mkdtempSync(join(tmpdir(), 'binding-check-'));
const reportPath = join(scratch, 'suite.json');
try {
  const run = spawnSync(
    process.execPath,
    [
      VITEST,
      'run',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${reportPath}`,
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
    const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(reportPath, 'utf8')));
    suites = /** @type {{ testResults: SuiteResult[] }} */ (parsed).testResults;
  } catch {
    fail('the suite produced no readable report');
  }

  // The suite dominates the gate's wall-clock, so its slowest cases print with every run.
  const slowest = suites
    .flatMap(({ name, assertionResults }) =>
      assertionResults.map(({ fullName, duration }) => ({
        ms: duration ?? 0,
        label: `${relative(ROOT, name)} > ${fullName}`,
      })),
    )
    .sort((a, b) => b.ms - a.ms)
    .slice(0, SLOWEST);
  if (slowest.length > 0) {
    process.stdout.write(
      `binding:check slowest cases —\n${slowest
        .map(({ ms, label }) => `${String(Math.round(ms)).padStart(7)} ms  ${label}`)
        .join('\n')}\n`,
    );
  }

  const inventory = gradeTable(REQUIRED, 'REQUIRED', suites);
  for (const line of inventory.failures) fail(line);

  const lifecycle = gradeTable(LIFECYCLE, 'LIFECYCLE', suites);
  for (const line of lifecycle.failures) fail(line);

  const meaning = gradeTable(MEANING, 'MEANING', suites);
  for (const line of meaning.failures) fail(line);

  // Controls: the ways a declared inventory stops binding anything. A rename leaves the case
  // undefined; a deleted or renamed file leaves the suite unrun; an empty table grades no case.
  // Every control uses the gate's OWN suite run, so none costs a second vitest.
  const controls = [
    requireFiring(
      'binding:check',
      {
        mutation: 'a required case no suite defines',
        expect: ['names 0 cases, expected exactly 1'],
      },
      () =>
        gradeInventory([{ suite: LANE_SUITE, why: 'control', cases: ['zz control case'] }], suites)
          .failures,
    ),
    requireFiring(
      'binding:check',
      { mutation: 'a required suite the run never loaded', expect: ['never ran'] },
      () =>
        gradeInventory([{ suite: 'tests/zz-control.test.ts', why: 'control', cases: [] }], suites)
          .failures,
    ),
    requireFiring(
      'binding:check',
      { mutation: 'the first required case reported skipped', expect: ['" skipped'] },
      () => {
        const [first] = REQUIRED;
        const name = first?.cases[0];
        const skipped = suites.map((file) => ({
          ...file,
          assertionResults: file.assertionResults.map((entry) =>
            entry.fullName === name ? { ...entry, status: 'skipped' } : entry,
          ),
        }));
        return first === undefined ? [] : gradeInventory([first], skipped).failures;
      },
    ),
    requireFiring(
      'binding:check',
      { mutation: 'the REQUIRED table emptied', expect: ['REQUIRED table is empty'] },
      () => gradeTable([], 'REQUIRED', suites).failures,
    ),
    requireFiring(
      'binding:check',
      { mutation: 'the LIFECYCLE table emptied', expect: ['LIFECYCLE table is empty'] },
      () => gradeTable([], 'LIFECYCLE', suites).failures,
    ),
    requireFiring(
      'binding:check',
      { mutation: 'the MEANING table emptied', expect: ['MEANING table is empty'] },
      () => gradeTable([], 'MEANING', suites).failures,
    ),
  ];

  report(inventory.graded, lifecycle.graded, meaning.graded, controls);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
