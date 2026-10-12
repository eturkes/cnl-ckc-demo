#!/usr/bin/env node
// `pnpm mutate [substring]` — prove each fixed defect's closing check binds to its fix.
//
// For every mutant in `tools/mutants.mjs` (or those whose label contains `substring`), it
// restores the pre-fix behaviour, runs the closing check, and restores the tree. The check must
// go red; a green row is a fix nothing binds. Exit 0 = every mutant killed.
//
// Outside `pnpm gate`: one vitest run per mutant. It needs a built `kb/generated`, and it must
// run alone — CPU contention turns a 5000 ms test timeout into a false kill.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ROOT } from './kb/paths.mjs';
import { MUTANTS } from './mutants.mjs';

/** @param {string} text @returns {string} */
const digest = (text) => createHash('sha256').update(text).digest('hex');

const only = process.argv[2] ?? '';
const chosen = MUTANTS.filter(({ label }) => label.includes(only));
if (chosen.length === 0) {
  process.stderr.write(`mutate: no mutant label contains ${JSON.stringify(only)}\n`);
  process.exit(2);
}

/** @type {Map<string, string>} */
const pristine = new Map();
/** Put every touched file back, then prove the bytes match what was read. */
const restore = () => {
  for (const [path, text] of pristine) writeFileSync(join(ROOT, path), text);
  for (const [path, text] of pristine) {
    if (digest(readFileSync(join(ROOT, path), 'utf8')) !== digest(text)) {
      process.stderr.write(`mutate: ${path} did not restore byte for byte\n`);
      process.exit(3);
    }
  }
};
// An interrupted run must not leave a mutant in the tree.
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

/** @param {import('./mutants.mjs').Mutant['check']} check @returns {string[]} */
const argvOf = (check) =>
  Array.isArray(check) ? check : ['pnpm', 'exec', 'vitest', 'run', check.test, '-t', check.name];

/**
 * A vitest run whose every failure is a timeout proves nothing about its mutant: a check the
 * mutant stalled, or one starved by load, exits 1 exactly like a refusal. The JUnit report is
 * read because vitest's JSON report carries a timeout's stack alone, never its message.
 *
 * @param {string} report a vitest JUnit report path @returns {boolean}
 */
const timedOutOnly = (report) => {
  let xml;
  try {
    xml = readFileSync(report, 'utf8');
  } catch {
    return false;
  }
  const messages = [...xml.matchAll(/<(?:failure|error)\b[^>]*\bmessage="([^"]*)"/gu)].map(
    ([, message]) => message ?? '',
  );
  return (
    messages.length > 0 &&
    messages.every((message) => /^(?:Test|Hook) timed out in \d+ms/u.test(message))
  );
};

/**
 * A kill means something only if the check passes on the pristine tree and, for a vitest
 * check, its `-t` filter selects at least one test — a filter that matches nothing exits 0.
 */
const scratch = mkdtempSync(join(tmpdir(), 'cnl-ckc-mutate-'));
try {
  for (const key of new Set(chosen.map(({ check }) => JSON.stringify(check)))) {
    const parsed = /** @type {unknown} */ (JSON.parse(key));
    const check = /** @type {import('./mutants.mjs').Mutant['check']} */ (parsed);
    const report = join(scratch, 'baseline.json');
    const argv = Array.isArray(check)
      ? check
      : [...argvOf(check), '--reporter=json', `--outputFile=${report}`];
    const [command = 'false', ...args] = argv;
    const rc = spawnSync(command, args, { cwd: ROOT, stdio: 'ignore' }).status;
    const summary = Array.isArray(check)
      ? { numPassedTests: 1 }
      : /** @type {{numPassedTests: number}} */ (
          /** @type {unknown} */ (JSON.parse(readFileSync(report, 'utf8')))
        );
    const passed = summary.numPassedTests;
    if (rc !== 0 || passed === 0) {
      process.stderr.write(
        `mutate: check ${argvOf(check).join(' ')} ${rc === 0 ? 'selects no test' : 'is red'} on the pristine tree\n`,
      );
      process.exit(2);
    }
  }
  // Control: a check failing by timeout alone must read as one. `--testTimeout=1` stalls every
  // case of a real suite, each of which spawns a process.
  const stalled = join(scratch, 'stalled.xml');
  spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      'tests/spec-check.test.ts',
      '--testTimeout=1',
      '--reporter=junit',
      `--outputFile=${stalled}`,
    ],
    { cwd: ROOT, stdio: 'ignore' },
  );
  if (!timedOutOnly(stalled)) {
    process.stderr.write(
      'mutate: control did not fire — a suite run at --testTimeout=1 did not read as timed out alone\n',
    );
    process.exit(2);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

/** @type {{label: string, rc: number | null | 'timeout'}[]} */
const rows = [];
const runs = mkdtempSync(join(tmpdir(), 'cnl-ckc-mutate-run-'));
process.on('exit', () => rmSync(runs, { recursive: true, force: true }));
const report = join(runs, 'mutant.xml');
for (const { label, edits, check } of chosen) {
  try {
    for (const { path, old, new: replacement } of edits) {
      const text = readFileSync(join(ROOT, path), 'utf8');
      if (!pristine.has(path)) pristine.set(path, text);
      const count = text.split(old).length - 1;
      if (count !== 1) throw new Error(`${label}: anchor occurs ${String(count)} times in ${path}`);
      writeFileSync(join(ROOT, path), text.replace(old, replacement));
    }
    rmSync(report, { force: true });
    const [command = 'false', ...args] = Array.isArray(check)
      ? check
      : [...argvOf(check), '--reporter=junit', `--outputFile=${report}`];
    const status = spawnSync(command, args, { cwd: ROOT, stdio: 'ignore' }).status;
    rows.push({ label, rc: status === 1 && timedOutOnly(report) ? 'timeout' : status });
  } catch (cause) {
    restore();
    process.stderr.write(`mutate: ${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exit(2);
  } finally {
    restore();
    pristine.clear();
  }
}

// Only a refusal kills: exit status 1 with an assertion behind it. A signal (`null`), another
// status or a vitest run failing by timeout alone proves nothing about the mutant.
const width = Math.max(...rows.map(({ label }) => label.length));
for (const { label, rc } of rows) {
  const verdict =
    rc === 1
      ? 'RED — killed'
      : rc === 0
        ? 'GREEN — the check does not bind'
        : rc === 'timeout'
          ? 'INCONCLUSIVE — failed by timeout alone'
          : 'INCONCLUSIVE';
  process.stdout.write(`${label.padEnd(width)}  rc=${String(rc)}  ${verdict}\n`);
}
const killed = rows.filter(({ rc }) => rc === 1).length;
process.stdout.write(
  `mutate: ${String(killed)}/${String(rows.length)} mutants killed; control: a suite run at --testTimeout=1 read as timed out alone\n`,
);
process.exitCode = killed === rows.length ? 0 : 1;
