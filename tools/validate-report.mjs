#!/usr/bin/env node
// Structural grader for teammate wave reports (`.claude/rules/waves.md` `Report grading`).
//
// Usage: node tools/validate-report.mjs <report.md> [--units MIN] [--verdict]
//
// Grades the report's row table against a sibling `<stem>.ids` list of expected row ids. A row
// is a `|`-line whose first cell is an expected id; exit 0 = every expected row is filled. A
// seeded all-`unknown` skeleton exits 1, which is what makes the report a deliverable-first
// progress counter. `--units MIN` also grades a `## Units` table; `--verdict` requires each
// finding to open with a verdict.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const PLACEHOLDER = new Set(['unknown', 'todo', 'tbd', 'n/a', 'na', '-', '?', '']);
const MIN_FINDING = 40;
const MIN_EVIDENCE = 8;
const POINTER =
  /https?:\/\/|[\w.-]+\/|\w+\.\w+:\d+|`|[\w.-]+\.(?:md|py|ts|js|mjs|cjs|json|svelte|pl|ace|tsv|txt|html|css)\b/u;
const UNIT_COLS = [
  'unit',
  'title',
  'tier',
  'flags',
  'deliverable',
  'acceptance',
  'depends',
  'size',
];
/** `-` is the seeded contract's truthful spelling for "no flags" and "no dependencies". */
const OPTIONAL_UNIT_COLS = new Set(['flags', 'depends']);
const TIERS = new Set(['kernel', 'data', 'docs']);
const VERDICT = /^(?:pass|fail\((?:low|med|high)\)):/u;

/**
 * Split one table row into trimmed cells.
 *
 * A pipe preceded by an odd run of backslashes is escaped content, not a delimiter. Splitting
 * on every pipe shifted the evidence column whenever a finding quoted one, so a report quoting
 * `a \| b` graded differently from the same report without it.
 *
 * @param {string} line
 * @returns {string[]}
 */
export const cells = (line) => {
  const inner = line
    .trim()
    .replace(/^\|/u, '')
    .replace(/(?<!\\)(?:\\\\)*\|$/u, (m) => m.slice(0, -1));
  /** @type {string[]} */
  const out = [];
  let current = '';
  let slashes = 0;
  for (const char of inner) {
    if (char === '|' && slashes % 2 === 0) {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    slashes = char === '\\' ? slashes + 1 : 0;
  }
  out.push(current.trim());
  return out;
};

/**
 * Python's `repr` of a string, so this port's messages stay byte-equal to the validator it
 * replaced — the differential that proved the port compares whole outputs.
 *
 * @param {string | undefined} text @returns {string}
 */
const repr = (text = '') =>
  text.includes("'") && !text.includes('"')
    ? `"${text.replaceAll('\\', '\\\\')}"`
    : `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** @param {string} cell @returns {boolean} */
const placeholder = (cell) => PLACEHOLDER.has(cell.toLowerCase());

/**
 * Grade the `## Units` table: at least `minimum` rows `uN`, eight filled columns, a valid tier.
 *
 * @param {string} text @param {number} minimum @param {string} name
 * @returns {string[]}
 */
const checkUnits = (text, minimum, name) => {
  const start = text.indexOf('## Units');
  if (start === -1) return [`${name}: no \`## Units\` section`];
  const body = text.slice(start + '## Units'.length);
  /** @type {string[]} */
  const errors = [];
  let rows = 0;
  for (const line of body.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const c = cells(line);
    const [unit = ''] = c;
    if (!/^u\d+$/u.test(unit)) continue;
    rows += 1;
    if (c.length !== UNIT_COLS.length) {
      errors.push(
        `${name} unit ${unit}: ${String(c.length)} columns, need ${String(UNIT_COLS.length)} ` +
          `(${UNIT_COLS.join('|')})`,
      );
      continue;
    }
    UNIT_COLS.forEach((col, index) => {
      const cell = c[index] ?? '';
      if (cell === '-' && OPTIONAL_UNIT_COLS.has(col)) return;
      if (placeholder(cell)) {
        errors.push(`${name} unit ${unit}: ${col} still placeholder (${repr(cell)})`);
      }
    });
    const tier = (c[2] ?? '').toLowerCase();
    if (!TIERS.has(tier))
      errors.push(`${name} unit ${unit}: tier ${repr(c[2])} not in ['data', 'docs', 'kernel']`);
    const acceptance = c[5] ?? '';
    if (acceptance.length < 20) {
      errors.push(
        `${name} unit ${unit}: acceptance too thin (${String(acceptance.length)}<20 chars)`,
      );
    }
  }
  if (rows < minimum) errors.push(`${name}: ${String(rows)} unit rows, need >=${String(minimum)}`);
  return errors;
};

/**
 * Grade one report against its expected ids.
 *
 * @param {{ name: string, text: string, ids: string[], units?: number, verdict?: boolean }} report
 * @returns {{ filled: number, errors: string[] }}
 */
export const gradeReport = ({ name, text, ids, units = 0, verdict = false }) => {
  /** @type {Map<string, {line: number, cells: string[]}>} */
  const rows = new Map();
  /** @type {string[]} */
  const errors = [];
  /** @type {Set<string>} */
  const dupes = new Set();
  text.split('\n').forEach((line, index) => {
    if (!line.trimStart().startsWith('|')) return;
    const c = cells(line);
    const [id = ''] = c;
    if (!ids.includes(id)) return;
    if (rows.has(id)) dupes.add(id);
    rows.set(id, { line: index + 1, cells: c });
  });
  for (const id of [...dupes].sort()) errors.push(`duplicate row id: ${id}`);
  for (const id of ids) if (!rows.has(id)) errors.push(`missing row: ${id}`);

  for (const id of ids) {
    const row = rows.get(id);
    if (row === undefined) continue;
    const at = `${name}:${String(row.line)} ${id}`;
    if (row.cells.length < 3) {
      errors.push(`${at}: need >=3 cells (id|finding|evidence), got ${String(row.cells.length)}`);
      continue;
    }
    const [, finding = '', evidence = ''] = row.cells;
    if (placeholder(finding)) errors.push(`${at}: finding still placeholder (${repr(finding)})`);
    if (placeholder(evidence)) errors.push(`${at}: evidence still placeholder (${repr(evidence)})`);
    if (!placeholder(finding)) {
      if (verdict && !VERDICT.test(finding)) {
        errors.push(`${at}: finding must open \`pass:\` or \`fail(low|med|high):\``);
      }
      if (finding.length < MIN_FINDING) {
        errors.push(
          `${at}: finding too thin (${String(finding.length)}<${String(MIN_FINDING)} chars)`,
        );
      }
    }
    if (!placeholder(evidence)) {
      if (evidence.length < MIN_EVIDENCE) {
        errors.push(
          `${at}: evidence too thin (${String(evidence.length)}<${String(MIN_EVIDENCE)} chars)`,
        );
      } else if (!POINTER.test(evidence)) {
        errors.push(`${at}: evidence lacks a pointer (path / file:line / URL / \`cmd\`)`);
      }
    }
  }
  if (units > 0) errors.push(...checkUnits(text, units, name));
  const filled = ids.filter((id) => {
    const finding = rows.get(id)?.cells[1];
    return finding !== undefined && !placeholder(finding);
  }).length;
  return { filled, errors };
};

if (process.argv[1] === import.meta.filename) {
  const [path, ...rest] = process.argv.slice(2);
  if (path === undefined) {
    process.stderr.write(
      'usage: node tools/validate-report.mjs <report.md> [--units MIN] [--verdict]\n',
    );
    process.exit(2);
  }
  const at = rest.indexOf('--units');
  const ids = readFileSync(path.replace(/\.md$/u, '.ids'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  const name = basename(path);
  const { filled, errors } = gradeReport({
    name,
    text: readFileSync(path, 'utf8'),
    ids,
    units: at === -1 ? 0 : Number(rest[at + 1]),
    verdict: rest.includes('--verdict'),
  });
  process.stdout.write(
    `${name}: ${String(filled)}/${String(ids.length)} rows filled, ${String(errors.length)} problem(s)\n`,
  );
  for (const error of errors) process.stdout.write(`  ${error}\n`);
  process.exitCode = errors.length > 0 ? 1 : 0;
}
