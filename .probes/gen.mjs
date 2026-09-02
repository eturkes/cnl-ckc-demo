// Probes c04/c05/c06: generator byte-fidelity, substitution guard, fail-closed.
// Run: node .probes/gen.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifyBag } from '../tools/kb/bag.mjs';
import { catalogRecords, catalogJson } from '../tools/kb/catalog.mjs';

const ROOT = join(import.meta.dirname, '..');
const kb = join(ROOT, 'kb');
const archive = readdirSync(kb).filter((n) => n.endsWith('.tar.gz'))[0];
const { files } = verifyBag(readFileSync(join(kb, archive)));
const text = (name) => Buffer.from(files.get(name)).toString('utf8');
const queryNames = [...files.keys()].filter((n) => /\/queries\/pl\/[^/]+\.pl$/.test(n)).sort();

const out = [];
const log = (...a) => out.push(a.join(' '));

// --- c04: byte-equality of each exported goal with the bag goal/1 argument ---
// Independent extraction: balanced-paren scan from the literal `goal(` in the file.
const goalArg = (src) => {
  const at = src.indexOf('goal(') + 'goal('.length;
  let depth = 1;
  for (let i = at; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(at, i);
    }
  }
  throw new Error('unbalanced');
};

const { records } = catalogRecords(files);
const byId = new Map(records.map((r) => [r.id, r]));
log('## c04 goal byte-equality (independent extractor vs shipped catalog)');
for (const name of queryNames) {
  const id = name.split('/').pop().replace(/\.pl$/, '');
  const mine = goalArg(text(name));
  const theirs = byId.get(id).goal;
  log(
    `${id}: equal=${mine === theirs} mineBytes=${Buffer.byteLength(mine)} shippedBytes=${Buffer.byteLength(theirs)} ` +
      `prefixForm=${theirs.startsWith("','(") || !theirs.includes(',')} sha=${Buffer.from(theirs).length}`,
  );
}
log(`records=${records.length} queryFiles=${queryNames.length}`);
log(
  'provenance: ' +
    records.map((r) => `${r.id}=${r.provenance}/proj${r.projection.length}`).join(' '),
);

// --- c05: substitution mutants ---
log('');
log('## c05 substitution mutants (each must throw)');
const mutate = (label, fn) => {
  try {
    fn();
    log(`${label}: NO THROW  <-- guard did not fire`);
  } catch (e) {
    log(`${label}: threw "${e.message}"`);
  }
};
// Rebuild catalog.mjs source with a patched AUTHORED table, load it as a data: module.
const bagUrl = pathToFileURL(join(ROOT, 'tools/kb/bag.mjs')).href;
const catalogSrc = readFileSync(join(ROOT, 'tools/kb/catalog.mjs'), 'utf8').replace(
  "from './bag.mjs'",
  `from ${JSON.stringify(bagUrl)}`,
);
const withAuthored = async (table) => {
  const patched = catalogSrc.replace(
    /const AUTHORED = \[[\s\S]*?\n\];/,
    `const AUTHORED = ${JSON.stringify(table)};`,
  );
  if (patched === catalogSrc) throw new Error('AUTHORED table not patched');
  const mod = await import(`data:text/javascript,${encodeURIComponent(patched)}`);
  return mod.catalogRecords(files);
};
const base = {
  id: 'category-b-recommendations',
  from: 'category-a-recommendations',
  was: 'category-A-recommendation',
  now: 'category-B-recommendation',
};
log('');
log('## c05 substitution mutants (awaited)');
for (const [label, table] of [
  ['zero-hit atom', [{ ...base, was: 'category-Z-recommendation' }]],
  ['near-miss substring (category-B-decision)', [{ ...base, was: 'category-B-decision' }]],
  ['near-miss (evidence-type-2-recommendation)', [{ ...base, was: 'evidence-type-2-recommendation' }]],
  ['two-hit atom (bare `recommendation`)', [{ ...base, was: 'recommendation' }]],
  ['unknown base id', [{ ...base, from: 'no-such-query' }]],
  ['identity substitution (was === now)', [{ ...base, now: 'category-A-recommendation' }]],
]) {
  try {
    const r = await withAuthored(table);
    log(`${label}: NO THROW -> ${r.records.length} records  <-- guard did not fire`);
  } catch (e) {
    log(`${label}: threw "${e.message}"`);
  }
}

// --- c06: determinism + fail-closed on bag mutation ---
log('');
log('## c06 determinism');
const a = catalogJson(catalogRecords(files).records);
const b = catalogJson(catalogRecords(files).records);
log(`two in-process runs byte-identical=${a === b} bytes=${Buffer.byteLength(a)}`);

log('');
log('## c06 fail-closed on structural bag mutation (each must throw)');
const clone = (edit) => {
  const copy = new Map(files);
  edit(copy);
  return copy;
};
const enc = (s) => new TextEncoder().encode(s);
const catA = queryNames.find((n) => n.includes('category-a-recommendations'));
const cases = [
  ['mutated goal/1 (goal( removed)', clone((m) => m.set(catA, enc(text(catA).replace('goal(', 'gaol('))))],
  ['missing query file (category-a deleted)', clone((m) => m.delete(catA))],
  ['extra VALID query file (duplicate content, new path)', clone((m) => m.set(catA.replace('category-a-recommendations', 'extra-query'), files.get(catA)))],
  ['extra query file with distinct id', clone((m) => m.set(catA.replace('category-a-recommendations', 'extra-query'), enc(text(catA).replaceAll('category-a-recommendations', 'extra-query'))))],
  ['projection functor unexpected (answer/2 -> reply/2)', clone((m) => m.set(catA, enc(text(catA).replace('answers([answer(', 'answers([reply('))))],
  ['projection arity wrong (answer/3)', clone((m) => m.set(catA, enc(text(catA).replace('answer(A,noun(recommendation,countable))', 'answer(A,noun(recommendation,countable),x)'))))],
  ['projection names a non-variable', clone((m) => m.set(catA, enc(text(catA).replace('answer(A,', 'answer(aa,'))))],
  ['answers/1 not a list', clone((m) => m.set(catA, enc(text(catA).replace('answers([answer(A,noun(recommendation,countable))])', 'answers(foo)'))))],
  ['question comment removed', clone((m) => m.set(catA, enc(text(catA).replace(/^% Q1: .*$/m, '% removed'))))],
  ['no $guideline_query term', clone((m) => m.set(catA, enc(text(catA).replace("'$guideline_query'(", "'$other_query'("))))],
  ['no projection term', clone((m) => m.set(catA, enc(text(catA).replace("'$guideline_query_projection'(", "'$other'("))))],
  ['duplicate query id in two files', clone((m) => m.set(catA.replace('category-a-recommendations', 'dupe'), files.get(catA)))],
  ['empty goal', clone((m) => m.set(catA, enc(text(catA).replace(/goal\([\s\S]*?\),answers/, 'goal( ),answers'))))],
  ['all queries removed', clone((m) => { for (const n of queryNames) m.delete(n); })],
];
for (const [label, map] of cases) {
  try {
    const r = catalogRecords(map);
    log(`${label}: NO THROW -> ${r.records.length} records [${r.records.map((x) => x.id).join(',')}]`);
  } catch (e) {
    log(`${label}: threw "${e.message}"`);
  }
}

process.stdout.write(out.join('\n') + '\n');
