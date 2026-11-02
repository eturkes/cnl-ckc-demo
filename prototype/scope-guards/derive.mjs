// Prototype seam (ITERATE n30): the scope-exclusion + supersession records and the guards that
// read them, derived from the vendored bag → prototype/scope-guards/generated/records.json.
// Every variant reads this one shape; the shipped producer (tools/kb/graph.mjs) stays untouched.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../../tools/kb/bag.mjs';
import { atomText, parseClauseSites, parsePrologCall, splitTopLevel } from '../../tools/kb/provenance.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('no bag in kb/');
const { files } = verifyBag(readFileSync(join(ROOT, 'kb', archive)));
const clauses = parseClauseSites(files);

/** `% S<n>: <ACE>` comment lines, keyed `<document>:<n>`. */
const sentences = new Map();
for (const [path, bytes] of files) {
  const match = /\/pl\/([^/]+)\.pl$/u.exec(path);
  if (match === null) continue;
  for (const line of new TextDecoder().decode(bytes).split('\n')) {
    const s = /^% S([1-9][0-9]*): (.*)$/u.exec(line);
    if (s !== null) sentences.set(`${match[1]}:${s[1]}`, s[2]);
  }
}
const sentence = (document, n) => sentences.get(`${document}:${n}`) ?? null;

/**
 * A rule body as top-level conjuncts: a plain literal, or `\\+` over one literal or a group.
 * `parseClauseSites` flattens negation away, so the body is re-split from the clause text.
 */
const conjuncts = (text) => {
  const at = text.indexOf(' :- ');
  if (at < 0) return [];
  return splitTopLevel(text.slice(at + 4, -1)).map((part) => {
    if (!part.startsWith('\\+')) return { negated: false, literals: [parsePrologCall(part)] };
    const inner = part.slice(2).trim().replace(/^\((.*)\)$/su, '$1');
    return { negated: true, literals: splitTopLevel(inner).map(parsePrologCall) };
  });
};

const exclusions = clauses
  .filter((clause) => clause.predicate === 'guideline_exclusion')
  .map((clause) => ({
    key: atomText(clause.head.args[0] ?? ''),
    document: clause.document,
    sentence: clause.sentence,
    line: clause.line,
    ace: sentence(clause.document, clause.sentence),
    body: conjuncts(clause.text),
  }));

const supersessions = clauses
  .filter((clause) => clause.predicate === 'guideline_supersession')
  .map((clause) => {
    const source = /^source\('((?:[^']|'')*)','((?:[^']|'')*)'\)$/u.exec(clause.head.args[2] ?? '');
    return {
      document: clause.document,
      sentence: Number(clause.head.args[1]),
      line: clause.line,
      ace: sentence(clause.document, Number(clause.head.args[1])),
      citation: source?.[1]?.replace(/''/gu, "'") ?? null,
      url: source?.[2] ?? null,
      date: Number(clause.head.args[3]),
    };
  });

const guardOf = (clause) => ({
  exclusion: conjuncts(clause.text).some((part) => part.negated && part.literals[0]?.name === 'guideline_exclusion'),
  evaluationDate: clause.body.some(({ name }) => name === 'guideline_evaluation_date'),
});
/** Each operator clause carrying a guard: the edge it heads + which guards it carries. */
const guarded = clauses
  .filter((clause) => clause.predicate === 'guideline_operator')
  .map((clause) => ({ clause, guard: guardOf(clause) }))
  .filter(({ guard }) => guard.exclusion || guard.evaluationDate)
  .map(({ clause, guard }) => ({
    document: clause.document,
    sentence: clause.sentence,
    line: clause.line,
    operator: clause.head.args[2],
    ...guard,
  }));

const records = {
  bag: archive,
  exclusions,
  supersessions,
  guarded,
  counts: {
    exclusions: exclusions.length,
    supersessions: supersessions.length,
    guardedOperators: guarded.length,
    guardedDocuments: new Set(guarded.map(({ document }) => document)).size,
  },
};
const target = join(HERE, 'generated/records.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(records, null, 2)}\n`);
process.stdout.write(`derive: ${JSON.stringify(records.counts)} → ${target}\n`);
