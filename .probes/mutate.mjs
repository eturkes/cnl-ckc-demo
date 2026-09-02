// Mutation driver for rows c05/c12/c13/c19/c20/c22.
// Each mutant: apply one edit, run one command, record rc, restore bytes.
// Usage: node .probes/mutate.mjs [idFilter]
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SUITE = 'pnpm test';
const ASSET = 'pnpm kb:asset-check';
const REBUILD = 'node tools/kb/build.mjs --force';

const SER = 'src/questions/serialize.ts';
const CAT = 'tools/kb/catalog.mjs';
const LIVE = 'tests/questions-live.test.ts';

const EMIT =
  "return `solutions([${unique.map((row) => `sol([${row.text.join(',')}])`).join(',')}])`;";

/** @type {{id:string,row:string,file:string,from:string,to:string,cmd:string}[]} */
const MUTANTS = [
  // c12 — a byte sort of rendered text must not survive the committed suite.
  {
    id: 'c12-rowsort-bytes',
    row: 'c12',
    file: SER,
    from: '  rows.sort(compareRows);',
    to: "  rows.sort((a, b) => compareText(a.text.join(','), b.text.join(',')));",
    cmd: SUITE,
  },
  {
    id: 'c12-comparerows-bytes',
    row: 'c12',
    file: SER,
    from: 'const compareRows = (a: Row, b: Row): number => {\n  for (const [index, term] of a.terms.entries()) {',
    to: "const compareRows = (a: Row, b: Row): number => {\n  if (a.text.length + b.text.length >= 0) return compareText(a.text.join(','), b.text.join(','));\n  for (const [index, term] of a.terms.entries()) {",
    cmd: SUITE,
  },
  {
    id: 'c12-compareterms-bytes',
    row: 'c12',
    file: SER,
    from: 'export const compareTerms = (left: PlTerm, right: PlTerm): number => {\n  const a = normalize(left);',
    to: 'export const compareTerms = (left: PlTerm, right: PlTerm): number => {\n  if (left.kind !== undefined) return compareText(JSON.stringify(left), JSON.stringify(right));\n  const a = normalize(left);',
    cmd: SUITE,
  },
  {
    id: 'c12-arity-name-swapped',
    row: 'c12',
    file: SER,
    from: '      const arity = sign(compound.args.length - other.args.length);\n      if (arity !== 0) return arity;\n      const functor = compareText(compound.functor, other.functor);\n      if (functor !== 0) return functor;',
    to: '      const functor = compareText(compound.functor, other.functor);\n      if (functor !== 0) return functor;\n      const arity = sign(compound.args.length - other.args.length);\n      if (arity !== 0) return arity;',
    cmd: SUITE,
  },
  {
    id: 'c12-atom-string-rank-swapped',
    row: 'c12',
    file: SER,
    from: '  atom: 2,\n  string: 3,',
    to: '  atom: 3,\n  string: 2,',
    cmd: SUITE,
  },
  {
    id: 'c12-number-atom-rank-swapped',
    row: 'c12',
    file: SER,
    from: '  integer: 1,\n  float: 1,\n  rational: 1,\n  atom: 2,',
    to: '  integer: 3,\n  float: 3,\n  rational: 3,\n  atom: 2,',
    cmd: SUITE,
  },
  {
    id: 'c12-dedup-removed',
    row: 'c12',
    file: SER,
    from: '  const unique = rows.filter(\n    (row, index) => index === 0 || compareRows(row, rows[index - 1] as Row) !== 0,\n  );',
    to: '  const unique = rows;',
    cmd: SUITE,
  },

  // c13 — one-byte drift on either side of the byte claim must turn red.
  { id: 'c13-runtime-separator', row: 'c13', file: SER, from: EMIT, to: EMIT.replace(".join(',')}])`;", ".join(', ')}])`;"), cmd: SUITE },
  { id: 'c13-runtime-functor', row: 'c13', file: SER, from: EMIT, to: EMIT.replace('solutions([', 'solution([') , cmd: SUITE },
  { id: 'c13-runtime-sol-spacing', row: 'c13', file: SER, from: EMIT, to: EMIT.replace('`sol([', '`sol( ['), cmd: SUITE },
  {
    id: 'c13-expected-off-by-one',
    row: 'c13',
    file: LIVE,
    from: "  const open = text.indexOf('result(') + 'result('.length;",
    to: "  const open = text.indexOf('result(') + 'result('.length + 1;",
    cmd: SUITE,
  },
  {
    id: 'c13-expected-transcribed-substring',
    row: 'c13',
    file: LIVE,
    from: "    expect(live).toBe(committedResult('category-a-recommendations'));",
    to: "    expect(live.startsWith('solutions([')).toBe(true);",
    cmd: SUITE,
  },

  // c05 — the substitution guard, exercised through the real build.
  {
    id: 'c05-guard-relaxed-to-atleast-one',
    row: 'c05',
    file: CAT,
    from: '  if (hits !== 1) throw new Error(`${label}: ${token} occurs ${hits} times, expected exactly 1`);',
    to: '  if (hits < 1) throw new Error(`${label}: ${token} occurs ${hits} times, expected at least 1`);',
    cmd: `${REBUILD} && ${ASSET} && ${SUITE}`,
  },
  {
    id: 'c05-authored-goal-unsubstituted',
    row: 'c05',
    file: CAT,
    from: '      goal: replaceOnce(base.goal, `\'${was}\'`, `\'${now}\'`, `${id} goal`),',
    to: '      goal: base.goal,',
    cmd: `${REBUILD} && ${ASSET} && ${SUITE}`,
  },
  {
    id: 'c05-authored-goal-unquoted-token',
    row: 'c05',
    file: CAT,
    from: '      goal: replaceOnce(base.goal, `\'${was}\'`, `\'${now}\'`, `${id} goal`),',
    to: '      goal: replaceOnce(base.goal, was, now, `${id} goal`),',
    cmd: `${REBUILD} && ${ASSET} && ${SUITE}`,
  },

  // c20 — expectation independence.
  {
    id: 'c20-wrong-goal',
    row: 'c20',
    file: CAT,
    from: "  const goal = argOf(projectionArgs, 'goal').trim();",
    to: "  const goal = argOf(projectionArgs, 'goal').trim().replace('recommendation,countable', 'implementation,countable');",
    cmd: `${REBUILD} && ${ASSET} && ${SUITE}`,
  },
  {
    id: 'c20-hardcoded-yes',
    row: 'c20',
    file: SER,
    from: "  if (entry.projection.length === 0) return solutions.length > 0 ? 'yes' : 'no';",
    to: "  if (entry.projection.length === 0) return 'yes';",
    cmd: SUITE,
  },
  {
    id: 'c20-hardcoded-no',
    row: 'c20',
    file: SER,
    from: "  if (entry.projection.length === 0) return solutions.length > 0 ? 'yes' : 'no';",
    to: "  if (entry.projection.length === 0) return 'no';",
    cmd: SUITE,
  },
  {
    id: 'c20-humanizer-corpus-gloss',
    row: 'c20',
    file: 'src/questions/humanize.ts',
    from: '  return `${id} — sentence ${ordinal}, ${place}`;',
    to: "  return `${id.replace('rec', 'Recommendation')} — sentence ${ordinal}, ${place}`;",
    cmd: SUITE,
  },
  {
    id: 'c20-service-ignores-id',
    row: 'c20',
    file: 'src/questions/service.ts',
    from: '    const entry = QUESTION_CATALOG[id];',
    to: "    const entry = QUESTION_CATALOG['category-a-recommendations'];",
    cmd: SUITE,
  },
];

const filter = process.argv[2];
const out = [];
for (const mutant of MUTANTS) {
  if (filter !== undefined && !mutant.id.includes(filter)) continue;
  const path = join(ROOT, mutant.file);
  const original = readFileSync(path, 'utf8');
  const hits = original.split(mutant.from).length - 1;
  if (hits !== 1) {
    out.push(`${mutant.row} ${mutant.id}: ANCHOR ${hits} hits — NOT APPLIED`);
    process.stderr.write(`${out.at(-1)}\n`);
    continue;
  }
  writeFileSync(path, original.replace(mutant.from, mutant.to));
  let rc = 0;
  let tail = '';
  try {
    const stdout = execSync(mutant.cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    tail = stdout.split('\n').filter((l) => /Tests\s+\d|ok —/.test(l)).join(' | ');
  } catch (error) {
    rc = typeof error.status === 'number' ? error.status : 1;
    tail = `${error.stdout ?? ''}${error.stderr ?? ''}`
      .split('\n')
      .filter((l) => /Tests\s+\d|FAIL|failed —|Error:|AssertionError|→/.test(l))
      .slice(0, 3)
      .join(' | ');
  } finally {
    writeFileSync(path, original);
  }
  out.push(`${mutant.row} ${mutant.id}: ${rc === 0 ? 'GREEN *** SURVIVED ***' : 'RED'} rc=${rc} :: ${tail.replace(/\s+/gu, ' ').slice(0, 220)}`);
  process.stderr.write(`${out.at(-1)}\n`);
}
process.stdout.write(out.join('\n') + '\n');
