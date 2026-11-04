// Prototype seam (PROTOTYPE graph overhaul): one guideline-level data file every variant reads,
// derived from the vendored bag + the shipped generated assets → generated/guideline.json.
// Offline derivation stands in for live engine runs (shortcut, owed a real design at IMPLEMENT).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../../tools/kb/bag.mjs';
import { clinicalArtifacts } from '../../tools/kb/clinical.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const GEN = join(ROOT, 'kb/generated');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('no bag in kb/');
const { files } = verifyBag(readFileSync(join(ROOT, 'kb', archive)));
const clinical = clinicalArtifacts(files);

execFileSync(process.execPath, [join(ROOT, 'prototype/scope-guards/derive.mjs')], { stdio: 'ignore' });
const records = readJson(join(ROOT, 'prototype/scope-guards/generated/records.json'));

const corpus = readJson(join(GEN, 'provenance/corpus-index.json')).documents;

const recOf = (id, section) => {
  const byId = /-rec(\d\d)(?:-|$)/u.exec(id)?.[1];
  if (byId !== undefined) return Number(byId);
  const bySection = /^(?:Rec|BOX 3 > Recommendation) (\d+)\b/u.exec(section)?.[1];
  return bySection === undefined ? null : Number(bySection);
};
const kindOf = (id) =>
  /-rec\d\d$/u.test(id) ? 'recommendation' : /-rec\d\d-/u.test(id) ? 'implementation' : 'supporting';

/** Text-level split of one ACE sentence — a prototype heuristic, never the KB's own parse. */
const MODALS = ['should', 'may', 'can', 'must'];
const split = (ace) => {
  const rule = /^If (.*?) then (.*)\.$/su.exec(ace);
  const conclusion = rule === null ? ace.replace(/\.$/u, '') : (rule[2] ?? '');
  const negated = /\bit is recommended that .* does not\b|\bdoes not\b|\bdo not\b|\bit is false that\b/u.test(conclusion);
  const modal = /\bit is recommended that\b/u.test(conclusion)
    ? 'should'
    : (MODALS.find((m) => new RegExp(`\\b${m}\\b`, 'u').test(conclusion)) ?? 'fact');
  return { condition: rule === null ? null : (rule[1] ?? null), conclusion, modal, negated };
};

const documents = corpus.map(({ id, region }) => {
  const doc = readJson(join(GEN, 'provenance/documents', `${id}.json`));
  return {
    id,
    rec: recOf(id, region.section),
    kind: kindOf(id),
    section: region.section,
    page: region.page,
    region: region.id,
    source: doc.source.text,
    sentences: doc.ace.sentences.map(({ number, text }) => ({ n: number, ace: text, ...split(text) })),
  };
});

const GRADE = /recommendation category: ([AB]); evidence type: (\d)/u;
const recommendations = documents
  .filter((d) => d.kind === 'recommendation')
  .map((d) => {
    const grade = GRADE.exec(d.source);
    return {
      id: d.id,
      number: d.rec,
      page: d.page,
      source: d.source,
      grade: grade === null ? null : { category: grade[1], evidenceType: Number(grade[2]) },
      implementation: documents.filter((x) => x.kind === 'implementation' && x.rec === d.rec).map((x) => x.id),
      supporting: documents.filter((x) => x.kind === 'supporting' && x.rec === d.rec).map((x) => x.id),
    };
  })
  .sort((a, b) => a.number - b.number);

/** Structured rules: the clinical layer's own parse of each recommendation sentence. */
const rules = new Map();
for (const { document, clause } of clinical.sentences) {
  rules.set(`${document}:${clause.sentence}`, { document, ...clause });
}

const questions = clinical.records.map(({ id, question, goal }) => {
  const cited = clinical.sentences.filter((s) => s.question === id);
  return {
    id,
    question,
    goal,
    statements: cited.map(({ document, clause }) => ({ document, sentence: clause.sentence })),
    documents: [...new Set(cited.map((s) => s.document))],
  };
});

/** Concept mentions from the shipped semantic graph: entity/event/value node → sentences. */
const graph = readJson(join(GEN, 'graph/semantic-graph.json'));
const conceptNodes = new Map(
  graph.nodes
    .filter((n) => n.kind === 'entity' || n.kind === 'event' || n.kind === 'value')
    .map((n) => [n.id, { id: n.id, label: n.label, kind: n.kind, mentions: new Set() }]),
);
for (const e of graph.edges) {
  if (e.document === undefined || e.sentence === undefined) continue;
  for (const end of [e.source, e.target]) conceptNodes.get(end)?.mentions.add(`${e.document}:${e.sentence}`);
}
const concepts = [...conceptNodes.values()]
  // `na eq 1` = the cardinality value every countable referent shares: no clinical content.
  .filter((c) => c.mentions.size > 0 && !c.label.startsWith('na '))
  .map((c) => ({ ...c, mentions: [...c.mentions].sort() }))
  .sort((a, b) => b.mentions.length - a.mentions.length);

const out = {
  bag: archive,
  derivation:
    'Offline derivation from the vendored bag (prototype). The shipped demo derives answers live by Prolog.',
  pdf: '/kb/generated/provenance/guideline.pdf',
  recommendations,
  documents,
  rules: [...rules.values()],
  questions,
  exclusions: records.exclusions.map(({ body: _body, ...rest }) => rest),
  supersessions: records.supersessions,
  concepts,
  counts: {
    documents: documents.length,
    recommendations: recommendations.length,
    rules: rules.size,
    questions: questions.length,
    exclusions: records.exclusions.length,
    supersessions: records.supersessions.length,
    concepts: concepts.length,
  },
};
mkdirSync(join(HERE, 'generated'), { recursive: true });
writeFileSync(join(HERE, 'generated/guideline.json'), `${JSON.stringify(out)}\n`);
console.log(JSON.stringify(out.counts));
