// `pnpm claims:check` — the registry's mechanical half.
//
// No tool in this stack can decide whether a natural-language claim is TRUE. What a tool can
// decide is whether the registry still covers the claim set: every claim in the tree has a row,
// no row survives a claim that left, and no row is unadjudicated. That is u15 R1 and R6 —
// judgment stays in `docs/claims.md`, completeness is graded here.
//
// Usage: node tools/claims-sweep.mjs [--seed]
// `--seed` writes the all-`unknown` skeleton; without it the registry is graded.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { requireFiring } from './control.mjs';

const REGISTRY = 'docs/claims.md';

/**
 * The row block's own table header. `prettier-ignore` is load-bearing: Prettier owns `docs/`
 * and pads every table cell to its column's widest, which at a 150-char claim cell rewrites
 * all 376 rows to 451 characters and leaves `--seed` and `format:check` disagreeing forever.
 * Without the delimiter row the block is not a table at all and renders as literal text.
 */
const HEADER =
  '<!-- prettier-ignore -->\n' +
  '| id | source | at | hash | claim | command | disposition |\n' +
  '| --- | --- | --- | --- | --- | --- | --- |';

/**
 * One registry row: id, source, anchor, hash, the shown claim cell, command, disposition.
 * Whitespace-tolerant, so a formatter that decides to pad this table cannot redden the gate.
 */
const ROW =
  /^\|\s*(R\d+)\s*\|\s*([a-z]+)\s*\|\s*`([^`]*)`\s*\|\s*([0-9a-f]+)\s*\|(.*)\|([^|]*)\|([^|]*)\|$/u;

/**
 * The merge key: a digest of the FULL claim unit. The shown cell is cut at 150 characters, so
 * keying on it carried a verdict across any edit past the cut — an appended branch citation
 * kept its old ruling under a command that never verified the new one.
 *
 * @param {string} text @returns {string}
 */
const digest = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);
/** @typedef {{source: string, at: string, hash: string, claim: string}} Claim */

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
 * @param {string} text @returns {{line: number, lines: number, text: string}[]}
 */
const units = (text) => {
  /** @type {{line: number, lines: number, text: string}[]} */
  const out = [];
  /** @type {string[]} */
  let buffer = [];
  let start = 0;
  let fenced = false;
  const flush = () => {
    if (buffer.length > 0) {
      out.push({ line: start, lines: buffer.length, text: buffer.join(' ').trim() });
    }
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
      if (!/^\|[\s:|-]+\|$/u.test(trimmed)) out.push({ line, lines: 1, text: trimmed });
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

/**
 * Settle a cell into the only shape Prettier will leave alone.
 *
 * Prettier owns `docs/`, so a generated cell it would reformat reddens `format:check` forever.
 * A cut between `\\` and the pipe it escapes leaves a dangling backslash that swallows the
 * row's own delimiter; a cut through a code span leaves an ODD backtick count, and Prettier
 * then reflows the unmatched opener across the rest of the row, gluing pipes to text.
 *
 * Idempotent, and that is load-bearing: the merge keys on the settled text, so a cell written
 * by an EARLIER form of this function settles to the same key as the claim it came from.
 *
 * @param {string} text @returns {string}
 */
const settle = (text) => {
  let out = text.trim();
  if (/(?:^|[^\\])(?:\\\\)*\\$/u.test(out)) out = out.slice(0, -1);
  const ticks = out.match(/`/gu)?.length ?? 0;
  if (ticks % 2 === 1) out = out.slice(0, out.lastIndexOf('`'));
  return out.trim();
};

/**
 * A slice can land mid-word and leave a trailing space Prettier strips, so the cell trims
 * itself before it settles.
 *
 * @param {string} text @returns {string}
 */
const cell = (text) => settle(text.replace(/\|/gu, '\\|').slice(0, 150).trim());

/**
 * Re-derive the whole claim set, in registry order.
 *
 * @param {{rules?: string[], contracts?: string[], read?: (path: string) => string}} [override]
 *   source lists and file reader, for the controls
 * @returns {Claim[]}
 */
export const claimSet = (override = {}) => {
  /** @type {Claim[]} */
  const rows = [];
  const read = override.read ?? ((/** @type {string} */ path) => readFileSync(path, 'utf8'));

  // 1. Shipped copy — u14 adjudicated it; `not a claim` rows are excluded by that ruling.
  for (const line of read(SHIPPED).split('\n')) {
    const row = /^\| (A\d\d) \| `([^`]*)` \| `([^`]*)` \| ([a-z ]+) \|/u.exec(line);
    if (row === null) continue;
    const [, id, at, key, disposition] = row;
    if (id === undefined || at === undefined || disposition === undefined) continue;
    if (disposition.trim() === 'not a claim') continue;
    const claim = `u14 ${id}${key === undefined || key === '' ? '' : ` \`${key}\``}`;
    rows.push({ source: 'shipped', at, hash: digest(claim), claim });
  }

  // 2. The spec's own `Artifacts` — the run commands the project promises a reader.
  const artifacts = /# Artifacts\n([\s\S]*?)\n# /u.exec(read('.agent/spec.md'));
  for (const line of (artifacts?.[1] ?? '').split('\n')) {
    if (line.trim().startsWith('- ')) {
      rows.push({
        source: 'spec',
        at: '.agent/spec.md Artifacts',
        hash: digest(line.trim()),
        claim: cell(line.trim()),
      });
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
    for (const unit of units(read(path))) {
      if (claimlike(unit.text)) {
        rows.push({
          source: 'rules',
          at: `${path}:${unit.line}`,
          hash: digest(unit.text),
          claim: cell(unit.text),
        });
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
    for (const unit of units(read(path))) {
      if (
        /^\| [A-Z][0-9]+[a-z]? \|/u.test(unit.text) ||
        /^- \*\*[A-Z][0-9]+[a-z]? /u.test(unit.text)
      ) {
        rows.push({
          source: 'contract',
          at: `${path}:${unit.line}`,
          hash: digest(unit.text),
          claim: cell(unit.text),
        });
      }
    }
  }
  return rows;
};

/**
 * Carry every adjudicated cell forward onto the re-derived set.
 *
 * Keyed on the digest of the FULL claim text, never on the row id, the line number or the
 * shown cell: editing any source file renumbers every row below it, an id-keyed merge would
 * hand one claim's verdict to its neighbour, and the shown cell is cut short. A claim whose
 * text is unchanged keeps its ruling; any edit, however far past the cut, arrives `unknown`
 * and reddens the gate until someone answers it.
 *
 * @param {Claim[]} rows @param {string} registry
 * @returns {string}
 */
export const table = (rows, registry) => {
  // NUL joins the key halves: it is the one byte a Markdown table cell cannot carry.
  /** @type {Map<string, string[][]>} */
  const kept = new Map();
  for (const line of registry.split('\n')) {
    const found = ROW.exec(line);
    if (found === null) continue;
    // An `unknown` cell is the absence of a ruling, so it must not claim the slot a
    // partition file fills: skipping it is what lets `--seed` fold harvested work in.
    if ((found[7] ?? '').trim() === 'unknown') continue;
    const key = `${found[2] ?? ''}\u0000${found[4] ?? ''}`;
    const cells = [(found[6] ?? '').trim(), (found[7] ?? '').trim()];
    kept.set(key, [...(kept.get(key) ?? []), cells]);
  }
  /** @param {string | undefined} value @returns {string} */
  const held = (value) => (value === undefined || value === '' ? 'unknown' : value);
  return rows
    .map((row, index) => {
      const id = `R${String(index + 1).padStart(3, '0')}`;
      const [command, disposition] = kept.get(`${row.source}\u0000${row.hash}`)?.shift() ?? [];
      return `| ${id} | ${row.source} | \`${row.at}\` | ${row.hash} | ${row.claim} | ${held(command)} | ${held(disposition)} |`;
    })
    .join('\n');
};

/**
 * Grade the registry against the re-derived set: same rows, in order, each carrying the
 * digest of the claim it adjudicated, none unadjudicated.
 *
 * @param {Claim[]} rows @param {string} registry
 * @returns {string[]}
 */
export const gradeRegistry = (rows, registry) => {
  /** @type {string[]} */
  const failures = [];
  const found = registry
    .split('\n')
    .map((line) => ROW.exec(line))
    .filter((match) => match !== null);
  if (found.length === 0) return ['registry holds no rows, so the claim set grades nothing'];
  if (found.length !== rows.length) {
    failures.push(`registry holds ${found.length} rows against a claim set of ${rows.length}`);
  }
  rows.forEach((row, index) => {
    const at = found[index]?.[3];
    if (at !== row.at) {
      failures.push(`row ${index + 1} is anchored at ${at ?? 'nothing'}, expected ${row.at}`);
    } else if (found[index]?.[4] !== row.hash) {
      // An in-place edit keeps the anchor, so only the digest can see it.
      failures.push(`row ${index + 1} (${row.at}) adjudicated other text; run pnpm claims:seed`);
    }
  });
  const open = found.filter((match) => (match[7] ?? '').trim() === 'unknown');
  if (open.length > 0) {
    const where = open.map((match) => match[3] ?? '?').join(', ');
    failures.push(`${String(open.length)} rows are unadjudicated: ${where}`);
  }
  return failures;
};

const QUEUE = '.agent/deferred.md';
const CITATION = /queue row `([^`]+)`/u;

/** @param {string} registry */
const deferredRows = (registry) =>
  registry
    .split('\n')
    .map((line) => ROW.exec(line))
    .filter((match) => match !== null)
    .filter((match) => (match[7] ?? '').trim().startsWith('deferred'));

/**
 * m5u15 R2: `deferred` is an honest answer only while it names the queue row that will re-derive
 * the claim. Pruning that row leaves the citation dangling, so a closed row reddens here until its
 * registry rows are re-adjudicated.
 *
 * @param {string} registry @param {string} queue
 * @returns {string[]}
 */
export const gradeDeferrals = (registry, queue) => {
  const titles = new Set([...queue.matchAll(/^- \*\*(.+?)\*\*/gmu)].map((match) => match[1]));
  return deferredRows(registry).flatMap((match) => {
    const title = CITATION.exec(match[7] ?? '')?.[1];
    if (title !== undefined && titles.has(title)) return [];
    const why =
      title === undefined
        ? 'cites no queue row'
        : `cites queue row "${title}", absent from ${QUEUE}`;
    return [`${match[1] ?? '?'} (${match[3] ?? '?'}) is deferred but ${why}`];
  });
};

/**
 * The first rules claim the shown cell cuts short, lengthened past the cut in memory — the
 * shape of an appended branch citation, which is the edit the cell-keyed merge used to miss.
 *
 * @returns {{at: string, read: (path: string) => string}}
 */
const pastTheCut = () => {
  for (const file of readdirSync(RULES_DIR).sort()) {
    const path = join(RULES_DIR, file);
    const text = readFileSync(path, 'utf8');
    const unit = units(text).find((u) => claimlike(u.text) && cell(u.text).length < u.text.length);
    if (unit === undefined) continue;
    const lines = text.split('\n');
    const last = unit.line + unit.lines - 2;
    lines[last] = `${lines[last] ?? ''} (control)`;
    const edited = lines.join('\n');
    return {
      at: `${path}:${String(unit.line)}`,
      read: (target) => (target === path ? edited : readFileSync(target, 'utf8')),
    };
  }
  throw new Error('no rules claim runs past the cell cut, so the edit controls grade nothing');
};

const rows = claimSet();

if (process.argv.includes('--seed')) {
  const registry = readFileSync(REGISTRY, 'utf8');
  // Extra arguments are harvested partition files. Folding them through the SAME text-keyed
  // merge is what makes a wave re-derivable: ids and line anchors are re-issued from the
  // live sweep, so a partition seeded against a stale row set still lands on the right claim.
  const harvested = process.argv
    .slice(process.argv.indexOf('--seed') + 1)
    .filter((arg) => !arg.startsWith('--'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  const anchor = '<!-- rows -->';
  const [head, , tail] = registry.split(anchor);
  if (head === undefined || tail === undefined) {
    throw new Error(`${REGISTRY} needs ${anchor} twice, wrapped around the row block`);
  }
  // Prettier owns `docs/` and reformats what it disagrees with, so the seed emits Prettier's
  // own shape or `--seed` and `format:check` fight on every run: a blank line between the
  // opening HTML comment and the table, and a final newline.
  const rest = tail.trimStart();
  writeFileSync(
    REGISTRY,
    `${head}${anchor}\n\n${HEADER}\n${table(rows, `${registry}\n${harvested}`)}\n\n${anchor}\n${rest === '' ? '' : `\n${rest}`}`,
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

  const registry = readFileSync(REGISTRY, 'utf8');
  const edit = pastTheCut();
  const edited = claimSet({ read: edit.read });
  const unseeded = requireFiring(
    'claims:check',
    {
      mutation: `${edit.at} lengthened past the cell cut`,
      expect: [`(${edit.at}) adjudicated other text`],
    },
    () => gradeRegistry(edited, registry),
  );
  const reseeded = requireFiring(
    'claims:check',
    { mutation: 'that edit re-seeded', expect: ['unadjudicated: ', edit.at] },
    () => gradeRegistry(edited, table(edited, registry)),
  );

  const queue = readFileSync(QUEUE, 'utf8');
  const [victim] = deferredRows(registry);
  const cited = CITATION.exec(victim?.[7] ?? '')?.[1];
  if (victim === undefined || cited === undefined) {
    throw new Error('no cited deferred row, so the citation controls grade nothing');
  }
  const uncited = requireFiring(
    'claims:check',
    {
      mutation: `${victim[1] ?? ''} citation stripped`,
      expect: [`${victim[1] ?? ''} `, 'cites no queue row'],
    },
    () => gradeDeferrals(registry.replace(victim[0], victim[0].replace(CITATION, '')), queue),
  );
  const dangling = requireFiring(
    'claims:check',
    {
      mutation: `queue row "${cited}" pruned`,
      expect: [`${victim[1] ?? ''} `, `absent from ${QUEUE}`],
    },
    () => gradeDeferrals(registry, queue.replace(`**${cited}**`, '**control**')),
  );

  const failures = [...gradeRegistry(rows, registry), ...gradeDeferrals(registry, queue)];
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
        `every row adjudicated, ${String(deferredRows(registry).length)} deferrals cited; ` +
        `controls: ${control}, ${unseeded}, ${reseeded}, ${uncited}, ${dangling}\n`,
    );
  }
}
