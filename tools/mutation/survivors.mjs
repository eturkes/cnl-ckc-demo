// `pnpm stryker`'s second half: every mutant the suite did not kill, read out of Stryker's JSON
// report, with Stryker's `Survived` split by whether any test ran against it.
//
// Stryker's vitest runner reports a suite that fails at COLLECTION as `Survived` with zero tests
// completed: the legacy export lane reads the bag through `exportedQueries` at module scope, so
// a mutant breaking that call throws at import and no case ever runs. Such a mutant is neither
// survived nor killed by an assertion, so each one is replayed here by hand — written into the
// working tree, the suite run alone, every touched file restored and proven byte-equal — and
// reported as what the replay saw. A collection failure earns the suite no credit.
//
// Prints one Markdown row per mutant left alive, then the counts. Exit 1 = a stale report or a
// replay that settles nothing.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ROOT } from '../kb/paths.mjs';

const REPORT = join(ROOT, 'reports/mutation/mutation.json');
const SUITE = ['pnpm', 'exec', 'vitest', 'run', '--config', 'tools/mutation/vitest.config.mjs'];

/**
 * @typedef {{line: number, column: number}} Position
 * @typedef {{mutatorName: string, replacement?: string, status: string, testsCompleted?: number,
 *   location: {start: Position, end: Position}}} Mutant
 */

/** @param {string} text @returns {string} */
const digest = (text) => createHash('sha256').update(text).digest('hex');

/** @type {unknown} */
const parsed = JSON.parse(readFileSync(REPORT, 'utf8'));
const report = /** @type {{files: Record<string, {source: string, mutants: Mutant[]}>}} */ (parsed);
const scratch = mkdtempSync(join(tmpdir(), 'cnl-ckc-survivors-'));
const json = join(scratch, 'suite.json');

/** @type {{path: string, text: string} | undefined} */
let live;
/** Put the replayed file back, then prove the bytes match what the report mutated. */
const restore = () => {
  if (live === undefined) return;
  writeFileSync(join(ROOT, live.path), live.text);
  if (digest(readFileSync(join(ROOT, live.path), 'utf8')) !== digest(live.text)) {
    process.stderr.write(`survivors: ${live.path} did not restore byte for byte\n`);
    process.exit(3);
  }
  live = undefined;
};
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

/**
 * Run the one suite against `mutant` written into `path`.
 *
 * @param {string} path @param {string} source @param {Mutant} mutant @returns {string}
 */
const replay = (path, source, mutant) => {
  const lines = source.split('\n');
  /** @param {Position} at */
  const offset = ({ line, column }) =>
    lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0) + column - 1;
  live = { path, text: source };
  try {
    writeFileSync(
      join(ROOT, path),
      source.slice(0, offset(mutant.location.start)) +
        (mutant.replacement ?? '') +
        source.slice(offset(mutant.location.end)),
    );
    rmSync(json, { force: true });
    const [command = 'false', ...args] = SUITE;
    const { status } = spawnSync(command, [...args, '--reporter=json', `--outputFile=${json}`], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    /** @type {unknown} */
    const suite = JSON.parse(readFileSync(json, 'utf8'));
    const result = /** @type {{numTotalTests: number, testResults: {message?: string}[]}} */ (
      suite
    );
    if (status === 0) return 'survived (replayed)';
    if (status === 1 && result.numTotalTests === 0) {
      const message = (result.testResults[0]?.message ?? '').split('\n')[0] ?? '';
      return `collection failure: ${message.slice(0, 100)}`;
    }
    if (status === 1) return 'killed by an assertion on replay';
    throw new Error(`replay settled nothing: rc ${String(status)}`);
  } finally {
    restore();
  }
};

/** @type {Record<string, number>} */
const counts = {};
/** @type {string[]} */
const rows = [];
try {
  for (const [path, { source, mutants }] of Object.entries(report.files)) {
    if (digest(readFileSync(join(ROOT, path), 'utf8')) !== digest(source)) {
      throw new Error(`${path} changed since the report was written; rerun pnpm stryker`);
    }
    // Stryker's report order varies run to run; location order keeps the record diffable.
    const ordered = [...mutants].sort(
      (a, b) =>
        a.location.start.line - b.location.start.line ||
        a.location.start.column - b.location.start.column ||
        a.mutatorName.localeCompare(b.mutatorName) ||
        (a.replacement ?? '').localeCompare(b.replacement ?? ''),
    );
    for (const mutant of ordered) {
      const verdict =
        mutant.status === 'Survived' && mutant.testsCompleted === 0
          ? replay(path, source, mutant)
          : mutant.status;
      const kind = verdict.startsWith('collection failure') ? 'collection failure' : verdict;
      counts[kind] = (counts[kind] ?? 0) + 1;
      if (kind === 'Killed') continue;
      const { line, column } = mutant.location.start;
      // JSON-quoted rather than a code span, which cannot escape the backticks a template holds.
      const replacement = JSON.stringify(
        (mutant.replacement ?? '').replace(/\s+/gu, ' ').slice(0, 60),
      );
      rows.push(
        `| \`${path}:${String(line)}:${String(column)}\` | ${mutant.mutatorName} | ` +
          `${replacement.replace(/\|/gu, '\\|')} | ${verdict.replace(/\|/gu, '\\|')} |`,
      );
    }
  }
} catch (cause) {
  process.stderr.write(`survivors: ${cause instanceof Error ? cause.message : String(cause)}\n`);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

process.stdout.write(
  ['| mutant | mutator | replacement | verdict |', '| --- | --- | --- | --- |', ...rows, ''].join(
    '\n',
  ),
);
process.stdout.write(
  `survivors: ${Object.entries(counts)
    .sort()
    .map(([kind, count]) => `${kind} ${String(count)}`)
    .join(', ')}\n`,
);
