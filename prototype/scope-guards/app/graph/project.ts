import records from '../../generated/records.json';
import { graphEdgeLabel } from './model.js';

const unquote = (word: string) => word.startsWith("'") ? word.slice(1, -1).replaceAll("''", "'") : word;
export const HUB = 'scope:cdc-2022-opioid';
export const ACT = 'scope:superseding-act';
const key = (row: any) => `${row.document}:${row.sentence}`;
const words = (word: string) => unquote(word).replaceAll('-', ' ');
const dateText = (date: number) => String(date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
const comparison = (operator: string) => ({less:'less than',greater:'greater than',leq:'at most',geq:'at least',eq:'exactly'}[unquote(operator)] ?? words(operator));

// Follow referents and variable joins, never document ids or vocabulary-specific branches.
export function exclusionCondition(record: any) {
  const all = record.body.flatMap((group: any) => group.literals);
  const positive = record.body.filter((group: any) => !group.negated).flatMap((group: any) => group.literals);
  const entity = (ref: string) => all.find((l: any) => l.name === 'guideline_entity' && l.args[1] === ref);
  const noun = (ref: string) => {
    const found = entity(ref);
    if (!found) throw new Error(`exclusion entity missing: ${ref}`);
    const properties = all.filter((l: any) => l.name === 'guideline_property' && l.args[1] === ref).map((l: any) => words(l.args[2]));
    return [...properties, words(found.args[2])].join(' ');
  };
  const argument = (literals: any[], event: string, role: string) => literals.find(l => l.name === 'guideline_arg' && l.args[1] === event && l.args[2] === role)?.args[3];
  const events = positive.filter((l: any) => l.name === 'guideline_event');
  const main = events.find((event: any) => entity(argument(positive, event.args[1], '2')));
  if (!main) throw new Error('exclusion has no entity-bearing event');
  const primary = argument(positive, main.args[1], '2');
  const pps = (literals: any[], event: string) => literals.filter(l => l.name === 'guideline_pp' && l.args[1] === event)
    .map(l => `${words(l.args[2])} ${noun(l.args[3])}`).join(' ');
  const bounds = all.filter((l: any) => l.name === 'guideline_satisfies').map((literal: any) => {
    const a = literal.args;
    const cardinality = all.find((l: any) => l.name === 'guideline_cardinality' && l.args[3] === a[0] && l.args[4] === a[1]);
    const unit = cardinality && all.find((l: any) => l.name === 'guideline_unit' && l.args[1] === cardinality.args[1] && l.args[2] === a[2]);
    if (!cardinality || !unit || a.length !== 6) throw new Error('exclusion comparison has no quantity/unit join');
    const object = all.find((l: any) => l.name === 'guideline_arg' && l.args[2] === '2' && l.args[3] === cardinality.args[1]);
    const owner = object && argument(all, object.args[1], '1');
    if (!owner) throw new Error('exclusion quantity has no owner');
    return {literal, owner, text:`${comparison(a[3])} ${a[4]} ${words(a[5])}${Number(a[4]) === 1 ? '' : 's'}`};
  });
  const ownBounds = bounds.filter((bound: any) => bound.owner === primary).map((bound: any) => bound.text);
  const qualifier = pps(positive, main.args[1]);
  const exceptions = record.body.filter((group: any) => group.negated).map((group: any) => {
    const statements = group.literals.filter((l: any) => l.name === 'guideline_event').map((event: any) => {
      const subject = argument(group.literals, event.args[1], '1');
      const object = argument(group.literals, event.args[1], '2');
      return `the ${noun(subject)} is proved to ${words(event.args[2])}${object ? ` ${/^[aeiou]/i.test(noun(object)) ? 'an' : 'a'} ${noun(object)}` : ''}${pps(group.literals,event.args[1]) ? ` ${pps(group.literals,event.args[1])}` : ''}`;
    });
    if (!statements.length) throw new Error('exclusion exception has no event');
    return `unless ${statements.join(' and ')}`;
  });
  return {primary, bounds, text:[noun(primary), ...ownBounds, qualifier].filter(Boolean).join(' ') + (exceptions.length ? `, ${exceptions.join(' and ')}` : '')};
}


// Static projection only: this page never presents an answer or claims a live derivation.
export function project(data: any, sourceRecords: any = records) {
  const records = sourceRecords;
  const nodes = new Map(data.nodes.map((n: any) => [n.id, n]));
  nodes.set(HUB, {id:HUB, kind:'entity', label:'CDC 2022 opioid recommendations'});
  const source = records.supersessions[0];
  nodes.set(ACT, {id:ACT, kind:'value', label:`${source.citation} (${String(source.date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')})`});
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
    const condition = exclusionCondition(record);
    const relation = `excluded when ${condition.text}`;
    conditionEdges.push({id:`hub:${record.line}`,kind:'property',source:HUB,target:refs.get(condition.primary),
      relation,label:relation,inverse:`excludes these recommendations when ${condition.text}`,scopeOperators:[],farScopeOperators:undefined,
      document:record.document,sentence:record.sentence,line:record.line,predicate:'guideline_exclusion'});
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
          const quantity = condition.bounds.find((bound: any) => bound.literal === literal);
          if (!quantity) throw new Error('exclusion bound was not resolved');
          add(refs.get(quantity.owner), addNode('value', quantity.text), 'condition bound', 'threshold', literal);
        }
      }
    }
  }
  // Keep the source's negated recommendation heads; replace the matching condition relations
  // with exclusion-world occurrences so they never also read as asserted facts.
  const signatures = new Set(conditionEdges.map(e => [key(e), e.kind, e.source, e.target, e.relation].join('|')));
  const edges = data.edges.filter((e: any) => !signatures.has([key(e), e.kind, e.source, e.target, e.relation].join('|'))).map((edge: any) => {
    const r = superseded.get(key(edge));
    const isModal = [...(edge.scopeOperators ?? []), ...(edge.farScopeOperators ?? [])].some((op: string) => ['should','must','may'].includes(op));
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
  // Historical action copies avoid making every occurrence of obtain/prescribe historical.
  for (const record of records.supersessions) {
    const own = edges.filter((e:any) => key(e) === key(record));
    const events = new Map<string,string>();
    for (const e of own) for (const end of ['source','target']) {
      const n:any = nodes.get(e[end]);
      if (n?.kind !== 'event') continue;
      const id = `superseded:${record.sentence}:${n.label}`;
      nodes.set(id,{...n,id,label:`${n.label} (waiver statement ${record.sentence})`});
      events.set(e[end],id);
    }
    for (const e of own) for (const end of ['source','target']) e[end] = events.get(e[end]) ?? e[end];
    const scope = [`superseded ${String(record.date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}`];
    for (const [original,id] of events) {
      if (!(data.edges.some((e:any) => key(e) === key(record) && e.kind === 'event' && e.target === original))) continue;
      edges.push({id:`act:${record.sentence}:${id}`,kind:'property',source:id,target:ACT,relation:'superseded by',inverse:'supersedes',
        label:graphEdgeLabel('superseded by',scope,scope),scopeOperators:scope,farScopeOperators:scope,
        document:record.document,sentence:record.sentence,line:record.line,predicate:'guideline_supersession',supersession:record});
    }
  }
  // Date is a real condition bound, not a new policy hub. Attach it to each superseded action.
  for (const record of records.supersessions) {
    const targets = data.edges.filter((e: any) => e.document === record.document && e.sentence === record.sentence && e.kind === 'event').map((e: any) => e.target);
    for (const target of new Set(targets)) {
      const bound = addNode('value', `evaluation date before ${dateText(record.date)}`);
      const scope = [`superseded ${dateText(record.date)}`];
      edges.push({ id: `evaluation:${record.sentence}:${target}`, kind:'threshold', source:`superseded:${record.sentence}:${(nodes.get(target) as any).label}`, target:bound,
        document:record.document, sentence:record.sentence, line:record.line, predicate:'guideline_satisfies',
        relation:'condition bound', label:graphEdgeLabel('condition bound',scope,scope),
        scopeOperators:scope, farScopeOperators:scope, supersession:record });
    }
  }
  return { ...data, nodes:[...nodes.values()], edges:[...edges,...conditionEdges] };
}
