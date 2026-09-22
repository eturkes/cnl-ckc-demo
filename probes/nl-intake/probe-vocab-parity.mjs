// Does the SHIPPED GRAPH's vocabulary equal the CLAUSE-HEAD vocabulary? A candidate list
// drawn from the graph is only usable for query construction if the names it offers are
// the names the clause heads actually carry.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const factory = createRequire(import.meta.url)('swipl-wasm/dist/loadImageDefault.js');
const load = typeof factory === 'function' ? factory : factory.default;
const engine = await load(new Uint8Array(readFileSync('kb/generated/kb.pvm')))({ arguments: ['-q'] });

const names = (pred, arity) => {
  const slots = arity === 4 ? '_,_,N,_' : '_,_,N';
  const goal = `findall(N,user:clause(${pred}(${slots}),_),L),sort(L,U).`;
  for (const s of engine.prolog.query(goal)) {
    if (s == null) break;
    return (s.U ?? []).map(String);
  }
  return [];
};

const graph = JSON.parse(readFileSync('kb/generated/graph/semantic-graph.json', 'utf8'));
const graphLabels = (kind) =>
  [...new Set(graph.nodes.filter((n) => n.kind === kind).map((n) => n.label))].sort();

for (const [kind, pred, arity] of [['entity', 'guideline_entity', 4], ['event', 'guideline_event', 3]]) {
  const fromClauses = new Set(names(pred, arity));
  const fromGraph = graphLabels(kind);
  const missing = fromGraph.filter((l) => !fromClauses.has(l));
  const extra = [...fromClauses].filter((l) => !fromGraph.includes(l));
  console.log(
    `${kind}: clause-head distinct=${fromClauses.size} graph distinct=${fromGraph.length} ` +
      `in-graph-not-in-clauses=${missing.length} in-clauses-not-in-graph=${extra.length}`,
  );
  if (missing.length) console.log(`  graph-only sample: ${missing.slice(0, 12).join(', ')}`);
  if (extra.length) console.log(`  clause-only sample: ${extra.slice(0, 12).join(', ')}`);
  if (kind === 'entity') writeFileSync('/tmp/clause-entities.txt', [...fromClauses].sort().join('\n'));
}
process.exit(0);
