// `pnpm kb:export-check` — the legacy export lane's gate step.
//
// Two jobs, both fail closed. It runs the `EXPORTED` preflight itself, so a bag whose
// exported set drifted is refused even when the suite below never runs. Then it runs the lane
// and requires every declared case id to have PASSED — deleting the suite, renaming a case or
// skipping one all fail here, which is what keeps the byte oracle load-bearing.
//
// The comparison lives in `tests/` because `kb:asset-check` bans answer-oracle reach over
// `tools/` — including a comment that merely spells the path, which is what keeps a runtime
// assembly from evading the byte scan. That ban is what makes those files oracles rather than
// a lookup table.
//
// Usage: node tools/kb/export-check.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { verifyBag } from './bag.mjs';
import { EXPORTED, LANE_CASES, LANE_SUITE, exportedQueries } from './exports.mjs';
import { ROOT, loadManifest } from './paths.mjs';

/** @typedef {{ title: string, status: string }} LaneCase */

/** @type {string[]} */
const failures = [];
/** @param {string} message */
const fail = (message) => failures.push(message);

const VITEST = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

const manifest = loadManifest();
if (manifest === undefined) fail('no manifest at kb/generated; run pnpm kb:build');
else {
  try {
    exportedQueries(verifyBag(readFileSync(join(ROOT, 'kb', manifest.source.bag))).files);
  } catch (/** @type {unknown} */ error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

let passed = 0;
if (failures.length === 0) {
  const scratch = mkdtempSync(join(tmpdir(), 'kb-export-check-'));
  const report = join(scratch, 'lane.json');
  try {
    const run = spawnSync(
      process.execPath,
      [VITEST, 'run', '--project', 'node', '--reporter=json', `--outputFile=${report}`, LANE_SUITE],
      { cwd: ROOT, encoding: 'utf8' },
    );
    /** @type {LaneCase[]} */
    let cases = [];
    try {
      // Same `JSON.parse` discipline as `loadManifest`: through `unknown`, so the shape
      // claim is an explicit cast rather than an `any` lint would refuse.
      const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(report, 'utf8')));
      cases = /** @type {{ testResults: { assertionResults: LaneCase[] }[] }} */ (
        parsed
      ).testResults.flatMap((file) => file.assertionResults);
    } catch {
      fail(`${LANE_SUITE}: the lane produced no readable report`);
    }
    for (const id of LANE_CASES) {
      const matched = cases.filter((entry) => entry.title.startsWith(id));
      const only = matched[0];
      if (matched.length !== 1 || only === undefined) {
        fail(`${LANE_SUITE}: ${id} names ${String(matched.length)} cases, expected exactly 1`);
      } else if (only.status !== 'passed') fail(`${LANE_SUITE}: ${id} ${only.status}`);
      else passed += 1;
    }
    // A case outside the declared set still has to pass; a red one below is a red lane.
    for (const entry of cases) {
      if (entry.status !== 'passed') fail(`${LANE_SUITE}: ${entry.title} ${entry.status}`);
    }
    if (failures.length > 0) process.stderr.write(`${run.stdout ?? ''}${run.stderr ?? ''}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  process.stderr.write(`kb:export-check failed —\n${failures.map((line) => `  ${line}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `kb:export-check ok — ${String(EXPORTED.length)} exported queries preflighted, ` +
      `${String(passed)} required lane cases passed in ${LANE_SUITE}\n`,
  );
}
