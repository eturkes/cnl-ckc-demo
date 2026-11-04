// `pnpm ci:gate <unit>` — `CLAUDE.md` `Execution` `CI gate` for the committed HEAD: push it to
// `ci/<unit>`, watch the fan-out run that push starts (`.github/workflows/fanout.yml`, one job per
// `gate:chain` step), then delete the branch on green or name every red step and keep it for the
// amended push. Every job lands in the step ledger (`tools/gate-ledger.mjs`), and so does a run
// the harness could not see.

import { execFileSync, spawnSync } from 'node:child_process';

import { appendRows, pendingRefusal, readLedger, rowOf } from './gate-ledger.mjs';
import { ROOT } from './kb/paths.mjs';

const WORKFLOW = 'Gate fan-out';
// How long GitHub may take to list the push's run; `CI_GATE_FIND_MS` shortens it for the suite.
const FIND_MS = Number(process.env.CI_GATE_FIND_MS ?? 120_000);

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
const refusal = pendingRefusal('ci:gate', readLedger());
if (refusal !== undefined) {
  process.stderr.write(refusal);
  process.exit(2);
}
const sha = run('git', 'rev-parse', 'HEAD');
const tree = run('git', 'rev-parse', 'HEAD^{tree}');
const date = new Date().toISOString();
/** @param {{ step: string, seconds?: string, red: string | undefined, note: string }[]} steps */
const record = (steps) =>
  appendRows(steps.map((step) => rowOf('ci:gate', tree, date, { seconds: '', ...step })));
const branch = `ci/${unit}`;
/** @param {string} red @param {string} note a red no job row carries, pending like any other */
const harness = (red, note) => record([{ step: 'ci:gate', red, note }]);
/**
 * @template T @param {string} red @param {() => T} act
 * @returns {T} `act`'s value; a throw lands in the ledger as a harness red first
 */
const recorded = (red, act) => {
  try {
    return act();
  } catch (cause) {
    harness(red, branch);
    throw cause;
  }
};
recorded('push failed', () => run('git', 'push', '-f', 'origin', `HEAD:refs/heads/${branch}`));

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
let id = recorded('run list failed', find);
for (const deadline = Date.now() + FIND_MS; id === undefined && Date.now() < deadline;) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  id = recorded('run list failed', find);
}
if (id === undefined) {
  harness('no run listed', branch);
  process.stderr.write(`ci:gate: no "${WORKFLOW}" run for ${sha.slice(0, 7)} on ${branch}\n`);
  process.exit(1);
}

const watch = spawnSync(
  'gh',
  ['run', 'watch', String(id), '--exit-status', '--compact', '--interval', '15'],
  { cwd: ROOT, stdio: 'inherit' },
);
// A watch that never ran or was killed proves nothing about the run, whatever `view` says next.
if (watch.error !== undefined || watch.status === null) {
  const why = watch.error?.message ?? `killed by ${String(watch.signal)}`;
  harness(`watch failed (${why})`, `run ${String(id)}`);
  process.stderr.write(`ci:gate: gh run watch ${String(id)} failed (${why}); ${branch} kept\n`);
  process.exit(1);
}
/** @typedef {{name: string, conclusion: string, startedAt?: string, completedAt?: string}} Job */
/**
 * @param {unknown} value the parsed `gh run view` output
 * @returns {{status: string, conclusion: string, jobs: Job[]}} a throw where it holds no run record,
 *   so a `null` or job-less reply lands as a harness red like unparsable text
 */
const viewOf = (value) => {
  const view = /** @type {{status?: unknown, conclusion?: unknown, jobs?: unknown} | null} */ (
    value
  );
  if (typeof view !== 'object' || view === null || !Array.isArray(view.jobs)) {
    throw new Error('gh run view returned no run record');
  }
  const listed = /** @type {Partial<Job>[]} */ (view.jobs);
  return {
    status: typeof view.status === 'string' ? view.status : '',
    conclusion: typeof view.conclusion === 'string' ? view.conclusion : '',
    jobs: listed.map((job) => ({
      ...job,
      name: String(job.name ?? ''),
      conclusion: String(job.conclusion ?? ''),
    })),
  };
};
const { status, conclusion, jobs } = recorded('run view unreadable', () =>
  viewOf(JSON.parse(run('gh', 'run', 'view', String(id), '--json', 'status,conclusion,jobs'))),
);
/** @param {Job} job @returns {string} empty where GitHub reports no finished span */
const secondsOf = ({ startedAt = '', completedAt = '' }) => {
  const ms = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(ms) && ms >= 0 ? (ms / 1000).toFixed(1) : '';
};
record(
  jobs.map((job) => ({
    step: job.name,
    seconds: secondsOf(job),
    red: job.conclusion === 'success' ? undefined : job.conclusion || 'none',
    note: `run ${String(id)}`,
  })),
);
const red = jobs.filter((job) => job.conclusion !== 'success').map((job) => job.name);
if (status !== 'completed') {
  if (red.length === 0) harness(`run ${status}`, `run ${String(id)}`);
  process.stderr.write(`ci:gate: run ${String(id)} is ${status}, not completed; ${branch} kept\n`);
  process.exit(1);
}
// `--exit-status` exits nonzero on a red run, so green needs the watch, the run and every job.
if (watch.status !== 0 || conclusion !== 'success' || jobs.length === 0 || red.length > 0) {
  if (red.length === 0) {
    const why = `watch exit ${String(watch.status)}, run ${conclusion || 'none'}, ${String(jobs.length)} jobs`;
    harness(why, `run ${String(id)}`);
  }
  process.stderr.write(
    `ci:gate failed — run ${String(id)} ${conclusion}: ${red.join(', ') || 'no job named'}; ` +
      `${branch} kept for the amended push\n`,
  );
  process.exit(1);
}
recorded('branch delete failed', () => run('git', 'push', 'origin', '--delete', branch));
process.stdout.write(
  `ci:gate ok — run ${String(id)}: ${String(jobs.length)} jobs green at ${sha.slice(0, 7)}; ` +
    `${branch} deleted\n`,
);
