import records from '../../generated/records.json';

export const HUB = 'scope:cdc-2022-opioid';
export const ACT = 'scope:superseding-act';
const clean = (s: string) => s.replace(/^'|'$/g, '').replaceAll('-', ' ');

export function augmentGraph(raw: any) {
  const g = structuredClone(raw);
  const addNode = (id: string, kind: string, label: string, record?: any) => {
    if (!g.nodes.some((n: any) => n.id === id)) g.nodes.push({id, kind, label, ...(record ? {document:record.document, sentence:record.sentence} : {})});
    return id;
  };
  let serial = 0;
  const addEdge = (source: string, target: string, label: string, inverse: string, r: any, kind = 'property', scope?: number) => {
    g.edges.push({id:`scope-edge:${serial++}`,kind,source,target,label,inverse,document:r.document,sentence:r.sentence,line:r.line,predicate:r.document === records.supersessions[0].document ? 'guideline_supersession' : 'guideline_exclusion',...(scope === undefined ? {} : {scope})});
  };
  addNode(HUB, 'entity', 'CDC 2022 opioid recommendations');
  records.exclusions.forEach((r: any, i: number) => {
    const refs = new Map<string, string>();
    const all = r.body.flatMap((b: any) => b.literals);
    for (const l of all) {
      if (l.name === 'guideline_entity' || l.name === 'guideline_event') {
        const id = l.name === 'guideline_entity' && l.args[2] !== 'patient' ? `exclusion-concept:${clean(l.args[2])}` : `exclusion:${i}:${l.args[1]}`;
        refs.set(l.args[1], addNode(id, l.name === 'guideline_entity' ? 'entity' : 'event', clean(l.args[2]), r));
      }
    }
    for (const l of all) {
      if (l.name !== 'guideline_arg' && l.name !== 'guideline_pp') continue;
      if (!refs.has(l.args[3])) refs.set(l.args[3], addNode(`exclusion:${i}:${l.args[3]}`, 'value', 'time quantity', r));
    }
    for (const block of r.body) {
      let scope: number | undefined;
      if (block.negated) {
        const reference = `scope-exception-${i}`;
        scope = g.scopes.length;
        g.scopes.push({id:`zz-prototype:${String(i).padStart(2, '0')}`,chain:[reference],operator:'-',reference,document:r.document,sentence:r.sentence});
      }
      for (const l of block.literals) {
        const a = l.args;
        if (l.name === 'guideline_arg') {
          const role = a[2] === '1' ? 'condition subject' : 'condition object';
          addEdge(refs.get(a[1])!,refs.get(a[3])!,role,`condition ${clean(all.find((x: any) => x.name === 'guideline_event' && x.args[1] === a[1])?.args[2] ?? 'argument')}`,r,'argument',scope);
        }
        if (l.name === 'guideline_pp') addEdge(refs.get(a[1])!,refs.get(a[3])!,`condition ${clean(a[2])}`,`condition location for`,r,'preposition',scope);
        if (l.name === 'guideline_satisfies') {
          const age = all.find((x: any) => x.name === 'guideline_entity' && x.args[2] === 'age');
          const bound = addNode(`exclusion:${i}:bound`,'value','less than 18 years',r);
          addEdge(refs.get(age.args[1])!,bound,'condition bound','bounds condition',r,'threshold');
        }
      }
      const entities = block.literals.filter((l: any) => l.name === 'guideline_entity' && l.args[2] !== 'patient');
      const condition = entities[0];
      const primary = all.find((l: any) => l.name === 'guideline_entity' && l.args[2] !== 'patient');
      if (condition && (block.negated || condition === primary)) {
        const id = refs.get(condition.args[1])!;
        if (block.negated) {
          addEdge(id,HUB,'unless discharge prescription is proved','exclusion exception: discharge prescription',r);
        } else {
          const hospital = r.document.endsWith('s7-02');
          const age = clean(condition.args[2]) === 'age';
          const observational = clean(condition.args[2]) === 'observational setting care';
          addEdge(id,HUB,age ? 'excludes when less than 18 years' : hospital ? `excludes${observational ? ' with possible inpatient admission,' : ''} unless discharge prescription is proved` : 'excludes',age ? 'excluded when less than 18 years' : hospital ? `excluded when${observational ? ' possible inpatient admission and' : ''} no discharge prescription is proved` : 'excluded when',r);
        }
      }
    }
  });
  const sup = records.supersessions[0];
  addNode(ACT,'value',`${sup.citation}\n2022-12-29`);
  const bound = addNode('scope:evaluation-before','value','evaluated before 2022-12-29');
  const superseded = g.edges.filter((e: any) => records.supersessions.some((r: any) => e.document === r.document && e.sentence === r.sentence));
  const eventIds = new Map<string, any>();
  for (const edge of superseded) {
    if (edge.kind !== 'operator' && edge.kind !== 'implies') edge.label += ' [superseded]';
    for (const end of ['source','target']) {
      const node = g.nodes.find((n: any) => n.id === edge[end]);
      if (node?.kind !== 'event') continue;
      const id = `scope-event:${edge.sentence}:${node.label}`;
      addNode(id,'event',`${node.label} (waiver statement ${edge.sentence})`,edge);
      edge[end] = id;
      if ((node.label === 'obtain' && edge.sentence <= 2) || (node.label === 'prescribe' && edge.sentence === 3)) eventIds.set(id, edge);
    }
  }
  for (const [id,r] of eventIds) {
    addEdge(id,ACT,'superseded by','supersedes',r);
    addEdge(id,bound,'historical statement condition','condition for historical statement',r,'property');
  }
  g.stats.nodes = g.nodes.length; g.stats.edges = g.edges.length;
  for (const kind of Object.keys(g.stats.byNodeKind)) g.stats.byNodeKind[kind] = g.nodes.filter((n: any) => n.kind === kind).length;
  for (const kind of Object.keys(g.stats.byEdgeKind)) g.stats.byEdgeKind[kind] = g.edges.filter((e: any) => e.kind === kind).length;
  return g;
}
