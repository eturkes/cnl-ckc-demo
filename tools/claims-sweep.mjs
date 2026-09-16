// `pnpm claims:check` — the registry's mechanical half.
//
// No tool in this stack can decide whether a natural-language claim is TRUE. What a tool can
// decide is whether the registry still covers the claim set: every claim in the tree has a row,
// no row survives a claim that left, and no row is unadjudicated. That is u15 R1 and R6 —
// judgment stays in `docs/claims.md`, completeness is graded here.
//
// Usage: node tools/claims-sweep.mjs [--seed]
// `--seed` writes the all-`unknown` skeleton; without it the registry is graded.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { requireFiring } from './control.mjs';

const REGISTRY = 'docs/claims.md';
const RULES_DIR = '.claude/rules';
const CONTRACT_DIR = '.agent/contracts';

/** u14 owns the shipped-copy rows; its own table is the source, never a second sweep. */
const SHIPPED = join(CONTRACT_DIR, 'm5u14.md');

/** Contracts whose rows another source already owns: u14's claim table, u15's own predicates. */
const CONTRACT_SKIP = new Set(['m5u14.md', 'm5u15.md']);

/**
 * A claim unit is a bullet with its continuation lines, a table row, or a paragraph. Line
 * granularity would split one assertion across rows and count its second half as a new claim.
 *
 * @param {string} text @returns {{line: number, text: string}[]}
 */
const units = (text) => {
  /** @type {{line: number, text: string}[]} */
  const out = [];
  /** @type {string[]} */
  let buffer = [];
  let start = 0;
  let fenced = false;
  const flush = () => {
    if (buffer.length > 0) out.push({ line: start, text: buffer.join(' ').trim() });
    buffer = [];
  };
  text.split('\n').forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      flush();
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    if (trimmed === '' || trimmed.startsWith('#')) {
      flush();
      return;
    }
    if (trimmed.startsWith('|')) {
      flush();
      // A separator row carries no claim, only the table's shape.
      if (!/^\|[\s:|-]+\|$/u.test(trimmed)) out.push({ line, text: trimmed });
      return;
    }
    if (/^[-*] /u.test(trimmed)) {
      flush();
      start = line;
      buffer.push(trimmed);
      return;
    }
    if (buffer.length === 0) start = line;
    buffer.push(trimmed);
  });
  flush();
  return out;
};

/**
 * A durable claim carries a measured number or names a command. Prose that asserts neither
 * states no checkable property, and a row for it would dilute the registry it belongs to.
 *
 * @param {string} text @returns {boolean}
 */
const claimlike = (text) => /[0-9]/u.test(text) || /`?pnpm [a-z:]+/u.test(text);

/** @param {string} text @returns {string} */
const cell = (text) => text.replace(/\|/gu, '\\|').slice(0, 150);

/**
 * Re-derive the whole claim set, in registry order.
 *
 * @param {{rules?: string[], contracts?: string[]}} [override] source lists, for the control
 * @returns {{source: string, at: string, claim: string}[]}
 */
export const claimSet = (override = {}) => {
  /** @type {{source: string, at: string, claim: string}[]} */
  const rows = [];

  // 1. Shipped copy — u14 adjudicated it; `not a claim` rows are excluded by that ruling.
  for (const line of readFileSync(SHIPPED, 'utf8').split('\n')) {
    const row = /^\| (A\d\d) \| `([^`]*)` \| `([^`]*)` \| ([a-z ]+) \|/u.exec(line);
    if (row === null) continue;
    const [, id, at, key, disposition] = row;
    if (id === undefined || at === undefined || disposition === undefined) continue;
    if (disposition.trim() === 'not a claim') continue;
    rows.push({
      source: 'shipped',
      at,
      claim: `u14 ${id}${key === undefined || key === '' ? '' : ` \`${key}\``}`,
    });
  }

  // 2. The spec's own `Artifacts` — the run commands the project promises a reader.
  const artifacts = /# Artifacts\n([\s\S]*?)\n# /u.exec(readFileSync('.agent/spec.md', 'utf8'));
  for (const line of (artifacts?.[1] ?? '').split('\n')) {
    if (line.trim().startsWith('- ')) {
      rows.push({ source: 'spec', at: '.agent/spec.md Artifacts', claim: cell(line.trim()) });
    }
  }

  // 3. Project law.
  const rules =
    override.rules ??
    readdirSync(RULES_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort();
  for (const file of rules) {
    const path = join(RULES_DIR, file);
    for (const unit of units(readFileSync(path, 'utf8'))) {
      if (claimlike(unit.text)) {
        rows.push({ source: 'rules', at: `${path}:${unit.line}`, claim: cell(unit.text) });
      }
    }
  }

  // 4. Every closed unit's acceptance rows — what each unit promised it had done.
  const contracts =
    override.contracts ??
    readdirSync(CONTRACT_DIR)
      .filter((f) => f.startsWith('m5u') && !CONTRACT_SKIP.has(f))
      .sort();
  for (const file of contracts) {
    const path = join(CONTRACT_DIR, file);
    for (const unit of units(readFileSync(path, 'utf8'))) {
      if (
        /^\| [A-Z][0-9]+[a-z]? \|/u.test(unit.text) ||
        /^- \*\*[A-Z][0-9]+[a-z]? /u.test(unit.text)
      ) {
        rows.push({ source: 'contract', at: `${path}:${unit.line}`, claim: cell(unit.text) });
      }
    }
  }
  return rows;
};

/** @param {{source: string, at: string, claim: string}[]} rows @returns {string} */
const table = (rows) =>
  rows
    .map((row, index) => {
      const id = `R${String(index + 1).padStart(3, '0')}`;
      return `| ${id} | ${row.source} | \`${row.at}\` | ${row.claim} | unknown | unknown |`;
    })
    .join('\n');

/**
 * Grade the registry against the re-derived set: same rows, in order, none unadjudicated.
 *
 * @param {{source: string, at: string, claim: string}[]} rows @param {string} registry
 * @returns {string[]}
 */
export const gradeRegistry = (rows, registry) => {
  /** @type {string[]} */
  const failures = [];
  const found = registry
    .split('\n')
    .map((line) => /^\| (R\d+) \| ([a-z]+) \| `([^`]*)` \|(.*)\|([^|]*)\|([^|]*)\|$/u.exec(line))
    .filter((match) => match !== null);
  if (found.length === 0) return ['registry holds no rows, so the claim set grades nothing'];
  if (found.length !== rows.length) {
    failures.push(`registry holds ${found.length} rows against a claim set of ${rows.length}`);
  }
  rows.forEach((row, index) => {
    const at = found[index]?.[3];
    if (at !== row.at) {
      failures.push(`row ${index + 1} is anchored at ${at ?? 'nothing'}, expected ${row.at}`);
    }
  });
  const open = found.filter((match) => (match[5] ?? '').trim() === 'unknown').length;
  if (open > 0) failures.push(`${open} rows are unadjudicated`);
  return failures;
};

const rows = claimSet();

if (process.argv.includes('--seed')) {
  const registry = readFileSync(REGISTRY, 'utf8');
  const anchor = '<!-- rows -->';
  const [head, tail] = registry.split(anchor);
  if (head === undefined || tail === undefined) throw new Error(`${REGISTRY} lacks ${anchor}`);
  writeFileSync(
    REGISTRY,
    `${head}${anchor}\n${table(rows)}\n${anchor}${tail.split(anchor)[1] ?? ''}`,
  );
  process.stdout.write(`claims:seed — ${String(rows.length)} rows written to ${REGISTRY}\n`);
} else {
  // Control: the same grader over a claim set built from ONE rules file. A registry that
  // matched a short set would prove the sweep stopped reading rather than that it agrees.
  const control = requireFiring(
    'claims:check',
    {
      mutation: 'the claim set re-derived from one rules file alone',
      expect: ['against a claim set of'],
    },
    () =>
      gradeRegistry(
        claimSet({ rules: ['stack.md'], contracts: [] }),
        readFileSync(REGISTRY, 'utf8'),
      ),
  );

  const failures = gradeRegistry(rows, readFileSync(REGISTRY, 'utf8'));
  if (failures.length > 0) {
    process.stderr.write(`claims:check failed — ${failures.join('; ')}\n`);
    process.exitCode = 1;
  } else {
    const bySource = rows.reduce((counts, row) => {
      counts[row.source] = (counts[row.source] ?? 0) + 1;
      return counts;
    }, /** @type {Record<string, number>} */ ({}));
    const split = Object.entries(bySource)
      .map(([source, count]) => `${source} ${String(count)}`)
      .join(', ');
    process.stdout.write(
      `claims:check ok — ${String(rows.length)} claims covered (${split}), ` +
        `every row adjudicated; control: ${control}\n`,
    );
  }
}
