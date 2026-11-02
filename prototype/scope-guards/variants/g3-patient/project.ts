import original from '@kb/graph/semantic-graph.json';
import records from '../../generated/records.json';

const graph = structuredClone(original) as any;
const added: any[] = [];
const clean = (s: string) => s.replace(/^'|'$/g, '');
const node = (label: string, kind = 'entity') => {
  const existing = graph.nodes.find((n: any) => n.label === label && n.kind === kind);
  if (existing) return existing.id;
  const id = `g3:${kind}:${label}`;
  graph.nodes.push({ id, kind, label });
  return id;
};
const patient = node('patient'), recommendation = node('recommendation');
function edge(source: string, target: string, label: string, record: any, negated = false, kind = 'property', inverse?: string) {
  const id = `g3:${added.length}`;
  let scope;
  if (negated) {
    scope = graph.scopes.length;
    graph.scopes.push({ id: `scope:${id}`, chain: ['actual', id], operator: '-', document: record.document, sentence: record.sentence, reference: id });
  }
  const e = { id, source, target, label, kind, inverse, document: record.document, sentence: record.sentence, line: record.line, predicate: negated ? 'guideline_exclusion' : 'scope_condition', ...(scope === undefined ? {} : {scope}) };
  added.push(e);
  return e;
}
for (const r of records.exclusions) {
  const literals = r.body.filter((g: any) => !g.negated).flatMap((g: any) => g.literals);
  const condition = literals.find((l: any) => l.name === 'guideline_entity' && clean(l.args[2]) !== 'patient');
  if (!condition) continue;
  const label = clean(condition.args[2]);
  const c = node(label);
  const conditionText = label === 'age' ? 'age less than 18 years' : label === 'observational-setting-care' ? 'observational care with possible inpatient admission' : label.replaceAll('-', ' ');
  const exceptionText = r.body.some((g: any) => g.negated) ? '; unless prescription at discharge is provable' : '';
  edge(recommendation, patient, `does not apply to when ${conditionText}${exceptionText}`, r, true, 'property', `outside recommendation scope when ${conditionText}${exceptionText}`);
  edge(c, recommendation, 'when: recommendation does not apply', r, false, 'property', 'does not apply when');
  edge(c, patient, 'when patient has / receives', r, false, 'property', 'scope condition');
  const bound = literals.find((l: any) => l.name === 'guideline_satisfies');
  if (bound) edge(c, node(`${bound.args[3]} than ${bound.args[4]} ${bound.args[5]}`, 'value'), 'condition bound', r, false, 'threshold', 'bounds age');
  for (const group of r.body.filter((g: any) => g.negated)) {
    const prescription = group.literals.find((l: any) => l.name === 'guideline_entity' && clean(l.args[2]).includes('prescription'));
    const discharge = group.literals.find((l: any) => l.name === 'guideline_entity' && clean(l.args[2]).includes('discharge'));
    if (prescription) {
      const exception = node(`${clean(prescription.args[2]).replaceAll('-', ' ')} at ${clean(discharge?.args[2] ?? 'facility-discharge').replaceAll('-', ' ')}`, 'value');
      edge(exception, c, 'unless provably received; exclusion requires absence', r, true, 'property', 'unless prescription at discharge is provable');
    }
  }
}
const superseded = new Set<string>();
for (const r of records.supersessions) {
  const law = node(`${r.citation} — effective ${r.date}`, 'value');
  const targets = [node('buprenorphine-prescribing-waiver'), node('obtain', 'event')];
  const date = node('evaluation date', 'value');
  edge(date, node(`before ${r.date}`, 'value'), 'condition bound for historical statement', r, false, 'threshold');
  for (const id of targets) {
    superseded.add(id);
    edge(id, law, `superseded from ${r.date} (statement ${r.sentence})`, r, false, 'property', 'supersedes statement');
    edge(id, date, 'historical derivation requires', r, false, 'property', 'guards historical statement');
  }
}
// A scope lens keeps the new relationships readable; the full bag remains available separately.
const keep = new Set(added.flatMap(e => [e.source, e.target]));
const base = graph.edges.filter((e: any) => keep.has(e.source) && keep.has(e.target) && e.document === 'cdc2022-opioid-rec12-imp08' && e.kind !== 'implies' && e.kind !== 'operator');
const lens = { ...graph, nodes: graph.nodes.filter((n: any) => keep.has(n.id)), edges: [...added, ...base] };
for (const n of lens.nodes) if (superseded.has(n.id)) n.label += ' [rec12-imp08 superseded]';
const oldScopes = [...lens.scopes];
lens.scopes.sort((a: any, b: any) => a.id.localeCompare(b.id));
for (const e of lens.edges) if (e.scope !== undefined) e.scope = lens.scopes.indexOf(oldScopes[e.scope]);
lens.stats = { ...lens.stats, documents: 0, nodes: lens.nodes.length, edges: lens.edges.length,
  byNodeKind: Object.fromEntries(Object.keys(graph.stats.byNodeKind).map(k => [k, lens.nodes.filter((n: any) => n.kind === k).length])),
  byEdgeKind: Object.fromEntries(Object.keys(graph.stats.byEdgeKind).map(k => [k, lens.edges.filter((e: any) => e.kind === k).length]))
};
export const graphUrl = URL.createObjectURL(new Blob([JSON.stringify(lens)], {type:'application/json'}));
export { records };
