import type { Guideline } from '../../shared/data.js';
export function project(g: Guideline) {
  const nodes = g.recommendations.map(r => {
    const own = g.network.edges.filter(e => e.rec === r.number);
    const first = own.find(e => e.modal !== 'fact' && e.modal !== 'can') ?? own[0];
    const target = g.network.nodes.find(n => n.id === first?.target)?.label ?? '';
    return { ...r, label: first ? `${first.verb} ${target}` : `Recommendation ${r.number}`, terms: [...new Set(own.flatMap(e => [e.source,e.target]))].join(' ').replaceAll('-', ' ') };
  });
  const shares = new Map<string, Map<number, Set<string>>>();
  for (const e of g.network.edges) {
    if (e.rec === null) continue;
    const source = g.network.nodes.find(n => n.id === e.source);
    const target = g.network.nodes.find(n => n.id === e.target);
    const terms = [ ...(source?.roles.includes('situation') ? [`Situation: ${source.label}`] : []), ...(target?.roles.includes('acted-on') && /\b(?:therapy|therapies|medication|medications|opioid|opioids|benzodiazepine|benzodiazepines|depressant|depressants|naloxone)\b/u.test(target.label) ? [`Treatment: ${target.label}`] : []) ];
    for (const term of terms) {
      if (term.endsWith('patient') || term.endsWith(' example')) continue;
      const byRec = shares.get(term) ?? new Map<number, Set<string>>();
      const keys = byRec.get(e.rec) ?? new Set<string>(); keys.add(e.rule); byRec.set(e.rec, keys); shares.set(term, byRec);
    }
  }
  const edges: {id:string;source:number;target:number;terms:string[];rules:string[];weight:number}[] = [];
  for (const a of nodes) for (const b of nodes) {
    if (a.number >= b.number) continue;
    const terms:string[] = [], rules = new Set<string>();
    for (const [term, byRec] of shares) if (byRec.has(a.number) && byRec.has(b.number)) {
      terms.push(term); for (const key of [...byRec.get(a.number)!, ...byRec.get(b.number)!]) rules.add(key);
    }
    if (terms.length) edges.push({id:`${a.number}-${b.number}`,source:a.number,target:b.number,terms,rules:[...rules],weight:rules.size});
  }
  return {nodes,edges};
}
