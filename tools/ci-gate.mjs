// `pnpm ci:gate <unit>` — `CLAUDE.md` `Execution` `CI gate` for the committed HEAD: push it to
// `ci/<unit>`, watch the fan-out run that push starts (`.github/workflows/fanout.yml`, one job per
// `gate:chain` step), then delete the branch on green or name every red step and keep it for the
// amended push.

import { execFileSync, spawnSync } from 'node:child_process';

import { ROOT } from './kb/paths.mjs';

const WORKFLOW = 'Gate fan-out';
const FIND_MS = 120_000;

/** @param {string} command @param {string[]} args @returns {string} */
const run = (command, ...args) =>
  execFileSync(command, args, { cwd: ROOT, encoding: 'utf8' }).trim();

const unit = process.argv[2] ?? '';
if (!/^[\w.-]+$/u.test(unit)) {
  process.stderr.write('usage: pnpm ci:gate <unit>  (letters, digits, `.`, `_`, `-`)\n');
  process.exit(2);
}
// The fan-out grades a pushed commit, so a dirty tree would report on bytes it never saw.
if (run('git', 'status', '--porcelain') !== '') {
  process.stderr.write('ci:gate: the working tree is dirty; commit the unit first\n');
  process.exit(2);
}
const sha = run('git', 'rev-parse', 'HEAD');
const branch = `ci/${unit}`;
run('git', 'push', '-f', 'origin', `HEAD:refs/heads/${branch}`);

/**
 * The fan-out run this push started, once GitHub lists it. Matched by workflow NAME: `--workflow`
 * resolves a file on the default branch alone, so a unit that adds or renames it would go unfound.
 *
 * @returns {number | undefined}
 */
const find = () => {
  const listed = run(
    'gh',
    ...['run', 'list', '--branch', branch, '--commit', sha, '--event', 'push'],
    ...['--json', 'databaseId,workflowName'],
    ...['-q', `.[] | select(.workflowName == "${WORKFLOW}") | .databaseId`],
  );
  return listed === '' ? undefined : Number(listed.split('\n')[0]);
};
let id = find();
for (const deadline = Date.now() + FIND_MS; id === undefined && Date.now() < deadline;) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  id = find();
}
if (id === undefined) {
  process.stderr.write(`ci:gate: no "${WORKFLOW}" run for ${sha.slice(0, 7)} on ${branch}\n`);
  process.exit(1);
}

spawnSync('gh', ['run', 'watch', String(id), '--exit-status', '--compact', '--interval', '15'], {
  cwd: ROOT,
  stdio: 'inherit',
});
const view = /** @type {unknown} */ (
  JSON.parse(run('gh', 'run', 'view', String(id), '--json', 'conclusion,jobs'))
);
const { conclusion, jobs } =
  /** @type {{conclusion: string, jobs: {name: string, conclusion: string}[]}} */ (view);
const red = jobs.filter((job) => job.conclusion !== 'success').map((job) => job.name);
if (conclusion !== 'success' || red.length > 0) {
  process.stderr.write(
    `ci:gate failed — run ${String(id)} ${conclusion}: ${red.join(', ') || 'no job named'}; ` +
      `${branch} kept for the amended push\n`,
  );
  process.exit(1);
}
run('git', 'push', 'origin', '--delete', branch);
process.stdout.write(
  `ci:gate ok — run ${String(id)}: ${String(jobs.length)} jobs green at ${sha.slice(0, 7)}; ` +
    `${branch} deleted\n`,
);
