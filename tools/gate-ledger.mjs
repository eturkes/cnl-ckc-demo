// The step ledger (`CLAUDE.md` `Execution` gate usefulness): one TSV row per step a full gate
// runs — `pnpm gate` here, `pnpm ci:gate` per fan-out job — the local half of the record of
// which steps buy signal, CI history the other. A red row enters `unclassified`, and both runners
// refuse to start while one stands: a rerun counts once its red is classified, so a rerun to
// green never buries it. `pnpm gate:classify <class> [note…]` (`tools/gate-classify.mjs`)
// classifies every pending red.

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { ROOT } from './kb/paths.mjs';

/** Gitignored. The suites point `GATE_LEDGER` at a temp file, so no test row reaches this one. */
export const LEDGER = resolve(ROOT, process.env.GATE_LEDGER ?? '.gate-ledger.tsv');
export const COLUMNS = /** @type {const} */ ([
  'date',
  'tree',
  'gate',
  'step',
  'seconds',
  'verdict',
  'class',
  'note',
]);
const HEADER = COLUMNS.join('\t');
export const CLASSES = ['product', 'gate', 'flake', 'planted'];
export const PENDING = 'unclassified';
const KNOWN = new Set(['-', PENDING, ...CLASSES]);

/** @typedef {Record<(typeof COLUMNS)[number], string>} Row */

/** @param {string} value @returns {string} one line without a tab, so a row splits back whole */
const cell = (value) => value.replace(/\s+/gu, ' ').trim();

/**
 * @param {string} text the ledger's bytes
 * @returns {Row[]} every row, the header skipped; a row cut short or carrying no known class reads
 *   pending, so a write that died mid-row never buries its red
 */
export const parseLedger = (text) =>
  text
    .split('\n')
    .filter((line) => line !== '' && line !== HEADER)
    .map((line) => {
      const cells = line.split('\t');
      const row = /** @type {Row} */ (
        Object.fromEntries(COLUMNS.map((column, at) => [column, cells[at] ?? '']))
      );
      return cells.length === COLUMNS.length && KNOWN.has(row.class)
        ? row
        : { ...row, class: PENDING };
    });

/** @param {Row} row @returns {string} */
const formatRow = (row) => COLUMNS.map((column) => cell(row[column])).join('\t');

/** @param {string} text @param {Row[]} rows @returns {string} `text` with `rows` appended */
export const ledgerWith = (text, rows) =>
  `${text === '' ? `${HEADER}\n` : text}${rows.map((row) => `${formatRow(row)}\n`).join('')}`;

/**
 * @param {string} gate @param {string} tree @param {string} date
 * @param {{ step: string, seconds: string, red: string | undefined, note: string }} step
 * @returns {Row} a red row enters `unclassified`, a green one `-`
 */
export const rowOf = (gate, tree, date, { step, seconds, red, note }) => ({
  date,
  tree,
  gate,
  step,
  seconds,
  verdict: red === undefined ? 'green' : `red ${red}`,
  class: red === undefined ? '-' : PENDING,
  note,
});

/**
 * @param {string} [path] @returns {string} the ledger's bytes; absent reads empty, and any other
 *   read failure throws, so an unreadable ledger never reads as one holding no pending red
 */
export const readLedger = (path = LEDGER) => {
  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return '';
    throw cause;
  }
};

/** @param {Row[]} rows @param {string} [path] */
export const appendRows = (rows, path = LEDGER) => {
  const text = readLedger(path);
  appendFileSync(path, ledgerWith(text, rows).slice(text.length));
};

/** @param {string} text @returns {string[]} one refusal per red row still unclassified */
export const pendingRefusals = (text) =>
  parseLedger(text)
    .filter((row) => row.class === PENDING)
    .map((row) => `unclassified red: ${row.step} (${row.gate} ${row.date}, ${row.verdict})`);

/**
 * @param {string} text @param {string} kind one of `CLASSES` @param {string} note
 * @returns {{ text: string, count: number }} every pending red classified, other rows unchanged
 */
export const classify = (text, kind, note) => {
  const rows = parseLedger(text);
  const count = rows.filter((row) => row.class === PENDING).length;
  const classified = rows.map((row) =>
    row.class === PENDING
      ? { ...row, class: kind, note: [row.note, note].filter((part) => part !== '').join('; ') }
      : row,
  );
  return { text: ledgerWith('', classified), count };
};

/**
 * @param {number} load a 1-min load, read as a step ends; the load-envelope ruling reads a red
 *   against it @returns {string}
 */
export const loadNote = (load) => `load ${load.toFixed(2)}`;

/**
 * @param {string} tool @param {string} text the ledger's bytes
 * @returns {string | undefined} the refusal a full gate exits 2 with while a red is pending
 */
export const pendingRefusal = (tool, text) => {
  const pending = pendingRefusals(text);
  return pending.length === 0
    ? undefined
    : `${tool}: ${pending.join('; ')} — in ${LEDGER}; a rerun counts once its red is classified: ` +
        `pnpm gate:classify <${CLASSES.join('|')}> [note]\n`;
};

/**
 * The working tree's own tree id, untracked files in and ignored ones out, so a red and a rerun
 * compare by content: the real index copied for its stat cache, never written.
 *
 * @param {string} [root] @returns {string} `unknown` outside git
 */
export const workingTree = (root = ROOT) => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-tree-'));
  const index = join(dir, 'index');
  const git = (/** @type {string[]} */ ...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GIT_INDEX_FILE: index },
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const real = resolve(
      root,
      execFileSync('git', ['rev-parse', '--git-path', 'index'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim(),
    );
    if (existsSync(real)) copyFileSync(real, index);
    else git('read-tree', '--empty');
    git('add', '-A');
    return git('write-tree');
  } catch {
    return 'unknown';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * `pnpm gate:classify <class> [note…]` (`tools/gate-classify.mjs`) over the ledger at `path`.
 *
 * @param {string[]} argv the class, then the note's words @param {string} [path]
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export const classifyCommand = (argv, path = LEDGER) => {
  const [kind = '', ...words] = argv;
  if (!CLASSES.includes(kind)) {
    const usage = `usage: pnpm gate:classify <${CLASSES.join('|')}> [note…]\n`;
    return { status: 2, stdout: '', stderr: usage };
  }
  const { text, count } = classify(readLedger(path), kind, words.join(' '));
  if (count === 0) {
    return { status: 1, stdout: '', stderr: `gate:classify: no unclassified red row in ${path}\n` };
  }
  writeFileSync(path, text);
  return {
    status: 0,
    stdout: `gate:classify: ${String(count)} red row(s) → ${kind}\n`,
    stderr: '',
  };
};
