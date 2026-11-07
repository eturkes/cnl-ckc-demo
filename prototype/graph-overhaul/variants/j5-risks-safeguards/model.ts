import type { Guideline, Rule } from '../../shared/data.js';
export const RISKS = ['opioid-risk', 'opioid-related-harm', 'high-overdose-risk', 'opioid-use-disorder', 'drug-use-resumption', 'overdose', 'overdose-death', 'life-threatening-warning', 'risk', 'testing-risk', 'testing-benefit'];
export const CARE = ['naloxone-dose', 'risk-mitigation-strategy', 'controlled-substance-prescription-history', 'toxicology-testing', 'evidence-based-medication-treatment', 'medication-free-detoxification', 'opioid-dosage', 'opioid', 'different-therapy'];
export const readable = (s: string) => s.replaceAll('-', ' ');
const has = (s: string, term: string) => new RegExp(`(?<![\\w-])${term}(?![\\w-])`, 'iu').test(s);
const key = (r: Rule) => `${r.document}:${r.sentence}`;
export function project(g: Guideline) {
  const nodes = new Map<string, {id:string; label:string; kind:'risk'|'care'; rules:string[]}>();
  const edges: {id:string; source:string; target:string; rule:string; rules:string[]; type:'rule'|'recommendation'; text:string; negative:boolean; basis:string}[] = [];
  const add = (id:string, kind:'risk'|'care', r:Rule) => { const n=nodes.get(id)??{id,label:readable(id),kind,rules:[]}; if(!n.rules.includes(key(r)))n.rules.push(key(r)); nodes.set(id,n); };
  for(const r of g.rules) {
    const text=JSON.stringify(r);
    const risks=RISKS.filter(t=>has(text,t));
    // A bare generic risk is used only when the rule states no more specific risk.
    const named=risks.filter(t=>t!=='risk'); const ends=named.length?named:risks;
    const interventions=CARE.filter(t=>has(r.subject,t)||r.actions.some(a=>has(a.object,t)&&(!['opioid','opioid-dosage'].includes(t)||['taper','reduce','discontinue'].includes(a.verb))));
    for(const t of interventions) add(t,'care',r);
    for(const t of ends)add(t,'risk',r);
    if(!interventions.length)continue;
    for(const care of interventions) for(const risk of ends) {
      let actions=r.actions.map((a,i)=>({a,i}));
      if(r.mode==='fact') actions=actions.filter(({a})=>has(JSON.stringify(a),risk));
      else actions=actions.filter(({a})=>has(a.object,care)||has(r.subject,care));
      for(const {a,i} of actions) {
        const e=g.network.edges.find(e=>e.id===`${key(r)}#${i}`);
        const phrase=e?`${e.verb} ${readable(a.object)}${e.detail?`, ${e.detail}`:''}`:`${r.mode} ${a.verb} ${readable(a.object)}`;
        edges.push({id:`${key(r)}#${i}/${care}/${risk}`,source:care,target:risk,rule:key(r),rules:[key(r)],type:'rule',text:r.mode==='fact'?`fact: increases risk for ${readable(risk)}`:phrase,negative:a.polarity==='negative',basis:r.mode==='fact'?'The statement names this risk increase.':has(r.condition??'',risk)?'The condition names this risk.':'The same rule names this risk in its actions; this line does not assert prevention.'});
      }
    }
  }
  const all=[...nodes.values()];
  for(const care of all.filter(n=>n.kind==='care'))for(const risk of all.filter(n=>n.kind==='risk')) {
    if(edges.some(e=>e.type==='rule'&&e.source===care.id&&e.target===risk.id))continue;
    for(const rec of g.recommendations) {
      const own=(n:typeof care)=>n.rules.filter(k=>k.startsWith(`${rec.id}:`));
      const left=own(care),right=own(risk);
      if(!left.length||!right.length)continue;
      const rules=[...new Set([...left,...right])];
      edges.push({id:`recommendation/${rec.number}/${care.id}/${risk.id}`,source:care.id,target:risk.id,rule:rules[0],rules,type:'recommendation',text:'named in the same recommendation',negative:false,basis:`Recommendation ${rec.number} names these concepts in separate rules. This is document-level association, not one rule linking them and not prevention.`});
    }
  }
  return {nodes:all,edges};
}
