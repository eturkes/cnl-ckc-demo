import records from '../../generated/records.json';
import { graphEdgeLabel } from './graph/model.js';

const unquote = (word: string) => word.startsWith("'") ? word.slice(1, -1).replaceAll("''", "'") : word;
const key = (row: any) => `${row.document}:${row.sentence}`;

// Static projection only: this page never presents an answer or claims a live derivation.
export function project(data: any) {
  const nodes = new Map(data.nodes.map((n: any) => [n.id, n]));
  const excluded = new Set(records.exclusions.map(key));
  const guarded = new Set(records.guarded.filter(r => r.exclusion).map(key));
  const superseded = new Map(records.supersessions.map(r => [key(r), r]));
  const conditionEdges: any[] = [];
  const addNode = (kind: string, label: string) => {
    const id = `${kind}:${label}`;
    if (!nodes.has(id)) nodes.set(id, { id, kind, label });
    return id;
  };
  for (const record of records.exclusions) {
    const refs = new Map<string, string>();
    const literals = record.body.flatMap(g => g.literals);
    for (const literal of literals) {
      const a = literal.args;
      if (literal.name === 'guideline_entity') refs.set(a[1], addNode('entity', unquote(a[2])));
      if (literal.name === 'guideline_event') refs.set(a[1], addNode('event', unquote(a[2])));
    }
    let ordinal = 0;
    for (const group of record.body) {
      const scope = group.negated ? ['excluded', '-'] : ['excluded'];
      const add = (source: string | undefined, target: string | undefined, relation: string, kind: string, literal: any) => {
        if (!source || !target) return;
        conditionEdges.push({ id: `exclusion:${record.line}:${ordinal++}`, source, target,
          kind, label: graphEdgeLabel(relation, scope, scope), relation,
          scopeOperators: scope, farScopeOperators: scope,
          document: record.document, sentence: record.sentence, line: record.line,
          predicate: literal.name, exclusionText: record.ace });
      };
      for (const literal of group.literals) {
        const a = literal.args;
        if (literal.name === 'guideline_arg') add(refs.get(a[1]), refs.get(a[3]), `argument ${a[2]}`, 'argument', literal);
        if (literal.name === 'guideline_pp') add(refs.get(a[1]), refs.get(a[3]), unquote(a[2]), 'preposition', literal);
        if (literal.name === 'guideline_property') add(refs.get(a[1]), addNode('value', unquote(a[2])), 'property', 'property', literal);
        if (literal.name === 'guideline_satisfies') {
          const cardinality = literals.find(l => l.name === 'guideline_cardinality' && l.args[3] === a[0] && l.args[4] === a[1]);
          const owner = literals.find(l => l.name === 'guideline_arg' && l.args[2] === '1' && refs.get(l.args[3]) === 'entity:age');
          const from = cardinality && refs.get(cardinality.args[1]) || (owner ? refs.get(owner.args[3]) : undefined) || 'entity:age';
          const bound = addNode('value', `${unquote(a.at(-3)!)} ${a.at(-2)} ${unquote(a.at(-1)!)}`);
          add(from, bound, 'condition bound', 'threshold', literal);
        }
      }
    }
  }
  // Keep the source's negated recommendation heads; replace the matching condition relations
  // with exclusion-world occurrences so they never also read as bare patient facts.
  const signatures = new Set(conditionEdges.map(e => [key(e), e.kind, e.source, e.target, e.relation].join('|')));
  const edges = data.edges.filter((e: any) => !signatures.has([key(e), e.kind, e.source, e.target, e.relation].join('|'))).map((edge: any) => {
    const r = superseded.get(key(edge));
    const isModal = (edge.scopeOperators ?? []).some((op: string) => ['should','must','may'].includes(op));
    let scope = [...(edge.scopeOperators ?? [])];
    let far = edge.farScopeOperators && [...edge.farScopeOperators];
    if (excluded.has(key(edge))) {
      scope = ['excluded', ...scope];
      far = ['excluded', ...(far ?? [])];
    }
    if (r) {
      scope = [`superseded ${String(r.date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}`, ...scope];
      far = [`superseded ${String(r.date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}`, ...(far ?? [])];
    }
    return { ...edge, scopeOperators: scope, farScopeOperators: far,
      guarded: guarded.has(key(edge)) && isModal,
      supersession: r,
      label: graphEdgeLabel(edge.relation, scope, far) };
  });
  // Date is a real condition bound, not a new policy hub. Attach it to each superseded action.
  for (const record of records.supersessions) {
    const targets = data.edges.filter((e: any) => e.document === record.document && e.sentence === record.sentence && e.kind === 'event').map((e: any) => e.target);
    for (const target of new Set(targets)) {
      const bound = addNode('value', 'evaluation date before 2022-12-29');
      const scope = ['superseded 2022-12-29'];
      edges.push({ id: `evaluation:${record.sentence}:${target}`, kind:'threshold', source:target, target:bound,
        document:record.document, sentence:record.sentence, line:record.line, predicate:'guideline_satisfies',
        relation:'condition bound', label:graphEdgeLabel('condition bound',scope,scope),
        scopeOperators:scope, farScopeOperators:scope, supersession:record });
    }
  }
  return { ...data, nodes:[...nodes.values()], edges:[...edges,...conditionEdges] };
}
