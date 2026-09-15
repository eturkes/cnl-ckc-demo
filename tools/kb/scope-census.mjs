// Operator-context census over the verified bag — the measurement u11's contract cites.
//
// Kept as a script because every number in `.agent/contracts/m5u11.md` is an expected-output
// table, and a table nobody can reprint goes stale silently. Reads the bag, never the emitted
// asset, so it stays an INDEPENDENT arm against the producer's own `scopes` table.
//
// Usage: node tools/kb/scope-census.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { verifyBag } from './bag.mjs';
import { GRAPH_ASSET_PATH } from './graph.mjs';
import { GENERATED_DIR, ROOT } from './paths.mjs';
import { parseClauseSites } from './provenance.mjs';

/** @typedef {import('./provenance.mjs').ClauseSite} ClauseSite */
/** @typedef {{ document: string, sentence: number | null, line: number, args: string[] }} Occurrence */
/** @typedef {{ outer: Set<string>, operators: Set<string> }} Context */

const ID_TERM = "'$guideline_id'(";

const readBag = () => {
  const kbDir = join(ROOT, 'kb');
  const archives = readdirSync(kbDir).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) throw new Error(`expected exactly one bag in kb/, found ${archives.length}`);
  return verifyBag(readFileSync(join(kbDir, /** @type {string} */ (archives[0])))).files;
};

/**
 * Every `guideline_operator` call site, head and body alike.
 *
 * @param {ClauseSite[]} clauses @returns {Occurrence[]}
 */
const occurrences = (clauses) => {
  /** @type {Occurrence[]} */
  const found = [];
  for (const clause of clauses) {
    for (const call of [clause.head, ...clause.body]) {
      if (call.name !== 'guideline_operator') continue;
      found.push({
        document: clause.document,
        sentence: clause.sentence,
        line: clause.line,
        args: call.args.map((arg) => arg.trim()),
      });
    }
  }
  return found;
};

/** @param {Iterable<string>} values @returns {[string, number][]} */
const tally = (values) => {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([, a], [, b]) => b - a);
};

/** @param {[string, number][]} rows */
const render = (rows) => rows.map(([key, count]) => `${key} ${String(count)}`).join(', ');

/** @param {Occurrence} op @param {number} index */
const arg = (op, index) => op.args[index] ?? '';

const clauses = parseClauseSites(readBag());
const ops = occurrences(clauses);

// A context is `document + sentence + its own identity term`. The raw occurrence tally is a
// DIFFERENT partition — one context restated across several clauses counts once here and many
// times there — so a case asserting the census must dedupe before it compares.
/** @type {Map<string, Context>} */
const contexts = new Map();
for (const op of ops) {
  const key = `${op.document}|${String(op.sentence)}|${arg(op, 1)}`;
  const entry = contexts.get(key);
  if (entry === undefined) {
    contexts.set(key, { outer: new Set([arg(op, 0)]), operators: new Set([arg(op, 2)]) });
  } else {
    entry.outer.add(arg(op, 0));
    entry.operators.add(arg(op, 2));
  }
}

const modality = tally(
  [...contexts.values()].map((entry) =>
    entry.operators.size === 1
      ? ([...entry.operators][0] ?? '')
      : `MULTI:${[...entry.operators].sort().join('+')}`,
  ),
);

// `outer` being a function is what makes the scope chain total and deterministic. If this ever
// reports a non-zero count, u11's ordered chain has a tie nothing in the schema breaks.
const ambiguous = [...contexts.values()].filter((entry) => entry.outer.size > 1).length;

/** @param {string} key @param {Set<string>} seen @returns {number} */
const depth = (key, seen = new Set()) => {
  if (seen.has(key)) return Number.POSITIVE_INFINITY;
  seen.add(key);
  const entry = contexts.get(key);
  if (entry === undefined) return 0;
  let deepest = 0;
  for (const outer of entry.outer) {
    if (!outer.startsWith(ID_TERM)) {
      deepest = Math.max(deepest, 1);
      continue;
    }
    const sentence = /,([1-9][0-9]*),box/u.exec(outer)?.[1] ?? 'null';
    const parent = `${key.split('|')[0] ?? ''}|${sentence}|${outer}`;
    deepest = Math.max(deepest, 1 + depth(parent, new Set(seen)));
  }
  return deepest;
};

const depths = tally([...contexts.keys()].map((key) => String(depth(key)))).sort(
  ([a], [b]) => Number(a) - Number(b),
);

/** @param {number} index */
const argForm = (index) =>
  tally(
    ops.map((op) => {
      const value = arg(op, index);
      if (value.startsWith(ID_TERM)) return 'context';
      return /^[A-Z][A-Za-z0-9_]*$/u.test(value) ? 'variable' : value;
    }),
  );

console.log(`occurrences ${String(ops.length)}`);
console.log(`contexts ${String(contexts.size)}`);
console.log(`per-context modality: ${render(modality)}`);
console.log(`contexts with more than one outer: ${String(ambiguous)}`);
console.log(`chain depth: ${render(depths)}`);
console.log(`arg0 form: ${render(argForm(0))}`);
console.log(`arg1 form: ${render(argForm(1))}`);

// The budget S5 grades is node `zlib.gzipSync` at DEFAULT options. The `gzip` CLI reads
// 327,090 B on the same bytes because it stores the filename and mtime in the header, and
// `{ level: 9 }` reads 286,015 B — the implementation and the level are both part of the
// number, so the case must name them.
const asset = join(GENERATED_DIR, GRAPH_ASSET_PATH);
try {
  const bytes = readFileSync(asset);
  console.log(
    `asset ${String(bytes.byteLength)} B raw, ${String(gzipSync(bytes).byteLength)} B gzip (node zlib, default options)`,
  );
} catch {
  console.log(`asset ${asset} absent — run pnpm kb:build`);
}
