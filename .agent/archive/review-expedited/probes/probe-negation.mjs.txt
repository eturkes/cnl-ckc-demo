import { readFileSync } from 'node:fs';

const g = JSON.parse(readFileSync('kb/generated/graph/semantic-graph.json', 'utf8'));
const nodes = new Map(g.nodes.map((n) => [n.id, n]));

const neg = g.nodes.filter((n) => n.kind === 'operator-context' && n.label === '-');
console.log('operator-context nodes labelled "-" (negation):', neg.length);
const modal = g.nodes.filter((n) => n.kind === 'operator-context' && n.label === 'should');
console.log('operator-context nodes labelled "should":', modal.length);

const CONCEPT = new Set(['entity', 'event', 'value']);
const isConcept = (id) => CONCEPT.has(nodes.get(id)?.kind);
const isConceptRel = (e) =>
  e.kind !== 'cardinality' &&
  e.kind !== 'operator' &&
  (e.kind !== 'implies' || e.label === 'condition supports') &&
  isConcept(e.source) &&
  isConcept(e.target);

let shown = 0;
for (const n of neg) {
  const sentEdges = g.edges.filter((e) => e.document === n.document && e.sentence === n.sentence);
  const conceptEdges = sentEdges.filter(isConceptRel);
  if (conceptEdges.length < 3) continue;
  console.log(`\n=== ${n.document} sentence ${n.sentence} ===`);
  console.log(`sentence edges ${sentEdges.length} / concept-view edges ${conceptEdges.length}`);
  console.log('operator edges (dropped by the concept view):');
  for (const e of sentEdges.filter((x) => x.kind === 'operator')) {
    console.log(`   ${nodes.get(e.source).label} -[${e.label}]-> ${nodes.get(e.target).label}`);
  }
  console.log('concept-view edges kept:');
  for (const e of conceptEdges.slice(0, 14)) {
    console.log(`   ${nodes.get(e.source).label} -[${e.kind}:${e.label}]-> ${nodes.get(e.target).label}`);
  }
  if ((shown += 1) >= 2) break;
}
