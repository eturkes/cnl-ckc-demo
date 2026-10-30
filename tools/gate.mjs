#!/usr/bin/env node
// `pnpm gate` — `package.json` `gate:chain` step by step, each step's wall-clock printed, the
// first red step ending the run with its own status. `pnpm gate:fast` (`--fast`) = the
// iteration gate: `kb:build`, every other step at once with tool caches, then the tests vitest's
// module graph ties to the working-tree change (`.claude/rules/gate.md`).
//
// The chain stays one `&&` string, so `pnpm gate:chain` runs it untimed and
// `tests/inventory.test.ts` rosters the steps from the text this runner parses.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

import { requireFiring } from './control.mjs';
import { ROOT } from './kb/paths.mjs';

/** @typedef {{ name: string, argv: string[] }} Step */
/** @typedef {{ name: string, ms: number, status: number, output: string }} Timed */

const STARTED = performance.now();
const FAST = process.argv.includes('--fast');
const TOOL = FAST ? 'gate:fast' : 'gate';
/** The suite step; `--fast` swaps it for the tests the change reaches. */
const SUITE = 'binding:check';
/** Needs the network; `--fast` runs it only when the dependency set changed. */
const AUDIT = 'audit:check';
/** The files that move the dependency set: `pnpm-workspace.yaml` carries the overrides. */
const DEPENDENCY_FILES = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
/**
 * Content-keyed where the tool allows. ESLint's cache still keys on the linted file alone, so a
 * type-aware finding that moves with an imported file waits for the full gate.
 *
 * @type {Record<string, string[]>}
 */
const CACHED = {
  lint: ['--cache', '--cache-strategy', 'content', '--cache-location', '.vite/eslint/'],
  'format:check': ['--cache', '--cache-location', '.vite/prettier/cache'],
};

/**
 * @param {string} chain @param {Record<string, string>} scripts
 * @returns {string[]} the step names in order; a segment other than `pnpm <declared script>` is
 *   refused, because `&&` would have run it and skipping it would shrink the gate unseen
 */
const parseChain = (chain, scripts) => {
  const segments = chain.split('&&').map((segment) => segment.trim());
  const names = segments.map((segment) => /^pnpm ([\w:-]+)$/u.exec(segment)?.[1] ?? '');
  const bad = segments.filter((_, at) => !Object.hasOwn(scripts, names[at] ?? ''));
  if (bad.length > 0) {
    throw new Error(`gate:chain segment names no package script: ${bad.join(' | ')}`);
  }
  return names;
};

/** @param {string[]} argv @returns {number} the exit status, a signal or spawn error reading 1 */
const runInherit = ([command = '', ...args]) =>
  spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;

/**
 * @param {Step[]} steps @param {(argv: string[]) => number} exec
 * @returns {Timed[]} one entry per step run; nothing runs after the first nonzero status
 */
const runInOrder = (steps, exec) => {
  /** @type {Timed[]} */
  const times = [];
  for (const { name, argv } of steps) {
    const start = performance.now();
    const status = exec(argv);
    times.push({ name, ms: performance.now() - start, status, output: '' });
    if (status !== 0) break;
  }
  return times;
};

/** @param {Step} step @returns {Promise<Timed>} the step's output buffered, never interleaved */
const runBuffered = ({ name, argv: [command = '', ...args] }) =>
  new Promise((done) => {
    const start = performance.now();
    let output = '';
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (/** @type {Buffer} */ chunk) => (output += chunk.toString()));
    child.stderr.on('data', (/** @type {Buffer} */ chunk) => (output += chunk.toString()));
    const settle = (/** @type {number} */ status) =>
      done({ name, ms: performance.now() - start, status, output });
    child.on('error', (cause) => {
      output += `${cause.message}\n`;
      settle(1);
    });
    child.on('close', (code) => settle(code ?? 1));
  });

/**
 * @param {Step[]} steps @param {number} limit
 * @returns {Promise<Timed[]>} every step run, `limit` at a time, in `steps` order
 */
const runTogether = async (steps, limit) => {
  /** @type {Timed[]} */
  const times = [];
  let next = 0;
  const worker = async () => {
    for (let at = next++; at < steps.length; at = next++) {
      const step = steps[at];
      if (step !== undefined) times[at] = await runBuffered(step);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, steps.length) }, worker));
  return times;
};

/** @param {Timed[]} times @returns {string[]} a refusal per red step */
const redOf = (times) =>
  times
    .filter(({ status }) => status !== 0)
    .map(({ name, status }) => `${name} exited ${String(status)}`);

/** @param {Timed[]} times */
const printTimes = (times) => {
  const total = performance.now() - STARTED;
  const row = (/** @type {number} */ ms, /** @type {string} */ name) =>
    `${(ms / 1000).toFixed(1).padStart(7)} s  ${name}`;
  process.stdout.write(
    `${TOOL}: wall-clock per step\n${times
      .map(({ ms, name, status }) =>
        row(ms, status === 0 ? name : `${name}  ← exit ${String(status)}`),
      )
      .join('\n')}\n${row(total, 'total')}\n`,
  );
};

/** @returns {string[] | undefined} paths changed against HEAD, untracked included; undefined outside git */
const changedPaths = () => {
  const git = (/** @type {string[]} */ ...args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((line) => line !== '');
  try {
    return [
      ...git('diff', '--name-only', 'HEAD'),
      ...git('ls-files', '--others', '--exclude-standard'),
    ];
  } catch {
    return undefined;
  }
};

const manifest = /** @type {unknown} */ (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
);
const { scripts } = /** @type {{ scripts: Record<string, string> }} */ (manifest);
/** @type {string[]} */
let names = [];
try {
  names = parseChain(scripts['gate:chain'] ?? '', scripts);
} catch (cause) {
  process.stderr.write(`${TOOL}: ${cause instanceof Error ? cause.message : String(cause)}\n`);
  process.exit(1);
}
const node = (/** @type {number} */ status) => [
  process.execPath,
  '-e',
  `process.exit(${String(status)})`,
];
/** @type {Step[]} */
const planted = [
  { name: 'control-red', argv: node(3) },
  { name: 'control-after', argv: node(0) },
];
const pnpmStep = (/** @type {string} */ name) => ({
  name,
  argv: ['pnpm', 'run', name, ...(FAST ? (CACHED[name] ?? []) : [])],
});

if (!FAST) {
  const control = requireFiring(
    TOOL,
    {
      mutation: 'a planted step exiting 3 ahead of a planted second step',
      expect: ['control-red exited 3', 'control-after never ran'],
    },
    () => {
      const times = runInOrder(planted, runInherit);
      return [
        ...redOf(times),
        ...(times.some(({ name }) => name === 'control-after') ? [] : ['control-after never ran']),
      ];
    },
  );
  const times = runInOrder(names.map(pnpmStep), runInherit);
  printTimes(times);
  const [red] = redOf(times);
  if (red !== undefined) {
    const skipped = names.slice(times.length);
    process.stderr.write(
      `${TOOL} failed — ${red}${skipped.length > 0 ? `; not run: ${skipped.join(', ')}` : ''}\n`,
    );
    process.exit(times.at(-1)?.status ?? 1);
  }
  process.stdout.write(`${TOOL} ok — ${String(times.length)} steps; control: ${control}\n`);
} else {
  const plantedTimes = await runTogether(planted, 2);
  const control = requireFiring(
    TOOL,
    {
      mutation: 'a planted step exiting 3 beside a planted green one',
      expect: ['control-red exited 3'],
    },
    () => redOf(plantedTimes),
  );
  const changed = changedPaths();
  const auditReached = changed === undefined || changed.some((path) => DEPENDENCY_FILES.has(path));
  // `kb:build` first: later steps read `kb/generated`. The tests run last and alone, because
  // suites time out under CPU contention (`.claude/rules/gate.md` load envelope).
  const first = runInOrder([pnpmStep('kb:build')], runInherit);
  const together = names.filter(
    (name) => name !== 'kb:build' && name !== SUITE && (name !== AUDIT || auditReached),
  );
  const times = [
    ...first,
    ...(redOf(first).length > 0
      ? []
      : await runTogether(together.map(pnpmStep), availableParallelism())),
  ];
  if (redOf(first).length === 0) {
    times.push(
      ...(await runTogether(
        [
          {
            name: 'tests the change reaches',
            argv: ['pnpm', 'exec', 'vitest', 'run', '--changed', '--passWithNoTests'],
          },
        ],
        1,
      )),
    );
  }
  for (const { name, status, output } of times) {
    const lines = output.split('\n').filter((line) => line.trim() !== '');
    const shown =
      status !== 0
        ? lines
        : name === 'tests the change reaches'
          ? lines.filter((line) => /\d+ms$|^\s*(Test Files|Tests|Duration) /u.test(line))
          : lines.slice(-1);
    if (shown.length > 0) process.stdout.write(`── ${name}\n${shown.join('\n')}\n`);
  }
  printTimes(times);
  const red = redOf(times);
  const skipped = [
    ...(auditReached ? [] : [`${AUDIT} (dependency set unchanged)`]),
    ...(redOf(first).length > 0 ? ['every step after kb:build'] : []),
  ];
  const tail = `skipped: ${skipped.length > 0 ? skipped.join(', ') : 'none'}; control: ${control}`;
  if (red.length > 0) {
    process.stderr.write(`${TOOL} failed — ${red.join('; ')}; ${tail}\n`);
    process.exit(1);
  }
  process.stdout.write(`${TOOL} ok — ${String(times.length)} steps; ${tail}\n`);
}
