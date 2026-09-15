/**
 * Secret scan over the working tree, plus a liveness control.
 *
 * A secret scanner that silently stops matching is worse than no scanner: the gate stays
 * green and nothing says the detector died. So every run scans a planted control file too
 * and fails closed unless that control trips.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { requireFiring } from './control.mjs';
import { ROOT } from './kb/paths.mjs';

const SECRETLINT = join(ROOT, 'node_modules', '.bin', 'secretlint');
const TREE_TARGETS = ['**/*'];

// Split so the control literal cannot itself match the rule it exercises. This is a
// structurally valid GitHub token shape, never a credential.
const CONTROL_TOKEN = ['gh', 'p_', '9fK2mQ1rTzXw8LbVn4YsPd6HuA3eJc0iRgOt'].join('');

/**
 * @param {string[]} targets
 * @returns {{status: number, output: string}}
 */
const secretlint = (targets) => {
  const run = spawnSync(
    SECRETLINT,
    ['--secretlintignore', '.secretlintignore', '--maskSecrets', ...targets],
    { cwd: ROOT, encoding: 'utf8', shell: false, stdio: 'pipe' },
  );
  if (run.error !== undefined) {
    return { status: 2, output: `secretlint failed to start: ${run.error.message}` };
  }
  return { status: run.status ?? 2, output: `${run.stdout}${run.stderr}` };
};

/**
 * @param {readonly string[]} targets
 * @returns {string[]}
 */
const gradeTreeTargets = (targets) =>
  targets.length === 0
    ? ['TREE_TARGETS table is empty, so secretlint has no working-tree target']
    : [];

const targetFailures = gradeTreeTargets(TREE_TARGETS);
/** @type {string[]} */
const failures = [...targetFailures];
let controlsFired = 0;
requireFiring(
  'secret:check',
  { mutation: 'the TREE_TARGETS table emptied', expect: ['TREE_TARGETS table is empty'] },
  () => gradeTreeTargets([]),
);
controlsFired += 1;

const control = mkdtempSync(join(tmpdir(), 'secret-control-'));
try {
  const planted = join(control, 'planted.ts');
  writeFileSync(planted, `export const token = '${CONTROL_TOKEN}';\n`, 'utf8');
  const proof = secretlint([planted]);
  if (proof.status !== 1) {
    failures.push(
      `liveness control did not trip: expected status 1 on a planted token, got ${proof.status}\n${proof.output}`,
    );
  } else {
    controlsFired += 1;
  }
} finally {
  rmSync(control, { recursive: true, force: true });
}

if (targetFailures.length === 0) {
  const tree = secretlint(TREE_TARGETS);
  if (tree.status !== 0) failures.push(`secret found in the working tree:\n${tree.output}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`secret:check — tree clean, ${String(controlsFired)} controls fired`);
