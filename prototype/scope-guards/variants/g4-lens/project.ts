import records from '../../generated/records.json';

export const metadata = new Map<string, any>();
export function augment(data: any) {
  const nodes = [...data.nodes], edges = [...data.edges], scopes = [...data.scopes];
  const custom = new Set<string>();
  const addNode = (id: string, kind: string, label: string, record: any) => {
    if (!nodes.some(n => n.id === id)) nodes.push({ id, kind, label, document: record.document, sentence: record.sentence });
    metadata.set(id, record);
    return id;
  };
  const scope = (r: any, status: string, negated = false) => {
    const ref = `lens:${scopes.length}`;
    const chain = ['actual', ref];
    scopes.push({id: ref, chain, operator: status, document:r.document, sentence:r.sentence, reference:ref});
    const first = scopes.length - 1;
    if (!negated) return first;
    const nested = `lens:${scopes.length}`;
    scopes.push({id:nested, chain:[...chain,nested], operator:'-', document:r.document, sentence:r.sentence, reference:nested});
    return scopes.length - 1;
  };
  const addEdge = (source: string, target: string, label: string, kind: string, r: any, sc: number) => {
    if (!source || !target || source === target) return;
    const id = `lens-edge:${edges.length}`;
    edges.push({id, source, target, label, kind, document:r.document, sentence:r.sentence, line:r.line, predicate:'scope-limits prototype', scope:sc, inverse:label==='superseded by'?'supersedes':undefined, farScopeOperators:scopes[sc].chain.slice(1).map((ref:string)=>scopes.find(s=>s.reference===ref).operator)});
    custom.add(id); metadata.set(id,r);
  };
  for (const r of records.exclusions) {
    const refs = new Map<string,string>();
    const status = scope(r, 'excluded');
    const patientNode = (kind: string, label: string, ref: string) => {
      const existing = kind === 'entity' ? nodes.find(n => n.kind === kind && n.label === label) : undefined;
      const id = existing?.id ?? (kind === 'event' ? `lens:event:${label}:${ref}` : `lens:${r.document}:${r.sentence}:${ref}`);
      return addNode(id,kind,label,r);
    };
    for (const group of r.body) for (const lit of group.literals) {
      const a = lit.args.map(v=>v.replace(/^'|'$/g,''));
      if (lit.name === 'guideline_entity' || lit.name === 'guideline_event') refs.set(a[1],patientNode(lit.name === 'guideline_entity' ? 'entity':'event',a[2],a[1]));
    }
    for (const group of r.body) {
      const sc = group.negated ? scope(r,'excluded',true) : status;
      for (const lit of group.literals) {
        const a = lit.args.map(v=>v.replace(/^'|'$/g,''));
        if (lit.name === 'guideline_arg') addEdge(refs.get(a[1])!,refs.get(a[3])!,`argument ${a[2]}`,'argument',r,sc);
        if (lit.name === 'guideline_pp') addEdge(refs.get(a[1])!,refs.get(a[3])!,a[2],'preposition',r,sc);
        if (lit.name === 'guideline_property') {
          const value = addNode(`lens:value:${a[2]}`,'value',a[2],r);
          addEdge(refs.get(a[1])!,value,'property','property',r,sc);
        }
        if (lit.name === 'guideline_satisfies') {
          const value = addNode(`lens:bound:${r.document}:${r.sentence}`,'value',`less than ${a[4]} ${a[5]}`,r);
          const age = [...refs.values()].find(id => nodes.find(n=>n.id===id)?.label==='age');
          addEdge(age!,value,'condition bound','threshold',r,sc);
        }
      }
    }
  }
  for (const r of records.supersessions) {
    const sc = scope(r,'superseded 2022-12-29');
    const original = data.edges.filter((e:any)=>e.document===r.document && e.sentence===r.sentence && e.kind !== 'operator' && e.kind !== 'implies' && data.nodes.find((n:any)=>n.id===e.source)?.kind !== 'document');
    for (const edge of original) {
      let nestedScope = sc;
      const originalScope = edge.scope === undefined ? undefined : data.scopes[edge.scope];
      for (const ref of originalScope?.chain.slice(1) ?? []) {
        const originalOperator = data.scopes.find((s:any)=>s.document===r.document && s.sentence===r.sentence && s.reference===ref);
        if (!originalOperator) continue;
        const reference = `lens:${scopes.length}`;
        scopes.push({id:reference,chain:[...scopes[nestedScope].chain,reference],operator:originalOperator.operator,document:r.document,sentence:r.sentence,reference});
        nestedScope=scopes.length-1;
      }
      addEdge(edge.source,edge.target,edge.label,edge.kind,r,nestedScope);
      metadata.set(edge.source,r); metadata.set(edge.target,r);
    }
    const act = addNode('lens:act','value','Public Law 117-328',r);
    const subject = original.find((e:any)=>e.kind==='argument')?.source;
    addEdge(subject,act,'superseded by','property',r,sc);
    const date = addNode('lens:evaluation-date','value','evaluation date before 2022-12-29',r);
    addEdge(act,date,'prior statement derives only before','threshold',r,sc);
  }
  const superseded = new Set(records.supersessions.map(r=>`${r.document}:${r.sentence}`));
  const safeEdges = edges.filter(e=>e.id.startsWith('lens-edge:') || !superseded.has(`${e.document}:${e.sentence}`) || e.kind==='operator');
  return {...data,nodes,edges:safeEdges,scopes,stats:{...data.stats,nodes:nodes.length,edges:edges.length},lensEdges:custom};
}

export function lensSubgraph(model:any) {
 const edges=model.data.edges.filter((e:any)=>e.id.startsWith('lens-edge:'));
 const ids=new Set(edges.flatMap((e:any)=>[e.source,e.target]));
 return {nodes:model.data.nodes.filter((n:any)=>ids.has(n.id)),edges,truncatedNodes:false,truncatedEdges:false};
}
