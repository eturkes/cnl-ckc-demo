import type { Guideline, Rule } from '../../shared/data.js';
export const key = (r: Rule) => `${r.document}:${r.sentence}`;
export const readable = (s: string) => s.replaceAll('-', ' ');
const noun = (s: string) => s.replace(/^(a|an|the) /u, '').replace(/ cautiously$/u, '');
export function pathway(g: Guideline) {
  const recOf = new Map(g.documents.map(d => [d.id, d.rec]));
  const links = new Map<string, {id:string;source:number;target:number;matches:{from:Rule;to:Rule;action:string;phrase:string}[]}>();
  for (const from of g.rules) for (const a of from.actions) {
    if (a.polarity !== 'positive' || from.mode === 'fact' || from.mode === 'can' || !a.object) continue;
    const object = noun(a.object);
    const verb = a.verb.endsWith('e') ? `${a.verb}s` : /[sxz]$/u.test(a.verb) ? `${a.verb}es` : `${a.verb}s`;
    for (const to of g.rules) {
      const source = recOf.get(from.document), target = recOf.get(to.document);
      if (source == null || target == null || source === target || !to.condition) continue;
      const phrase = `${verb} (?:a |an |the )?${object.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?= |$)`;
      const hit = new RegExp(`\\b${phrase}`, 'u').exec(to.condition);
      if (!hit) continue;
      const id = `${source}>${target}`;
      const link = links.get(id) ?? {id,source,target,matches:[]};
      const edge = g.network.edges.find(e => e.rule === key(from) && e.verb.includes(a.verb) && readable(object).includes(g.network.nodes.find(n=>n.id===e.target)?.label ?? '\0'));
      const action = edge ? `${edge.verb} ${readable(a.object)}${edge.detail ? `, ${edge.detail}` : ''}` : `${from.mode} ${a.qualifiers.filter(q=>typeof q==='string').join(' ')} ${a.verb} ${readable(a.object)}`.replace(/ +/gu,' ');
      link.matches.push({from,to,action,phrase:hit[0]}); links.set(id,link);
    }
  }
  const events = new Map<string,{id:string;label:string;actor:string;verb:string;object:string;rules:Rule[]}>();
  for (const r of g.rules) for (const hit of (r.condition??'').matchAll(/\b(clinician|patient) (considers|starts|prescribes|continues|changes|receives|has) (?:an?|the) ([\w-]+)/gu)) {
    const [,actor,verb,object]=hit;
    if (!/opioid|dosage-increase/u.test(object)) continue;
    const id=`${actor} ${verb} ${object}`;
    const event=events.get(id)??{id,label:readable(`${actor} ${verb} ${object}`),actor,verb,object,rules:[]};
    event.rules.push(r);events.set(id,event);
  }
  // The order is editorial, not a chronology asserted by the KB.
  const order=['considers','starts','prescribes','continues','receives','changes','has'];
  const orderOf=(e:{verb:string;object:string})=>e.verb==='considers'&&e.object==='dosage-increase'?4.5:order.indexOf(e.verb);
  const careSteps=[...events.values()].sort((a,b)=>orderOf(a)-orderOf(b)||a.object.localeCompare(b.object)||a.actor.localeCompare(b.actor));
  const eventLinks=new Map<string,{id:string;source:string;target:string;recLinks:string[]}>();
  for(const link of links.values())for(const m of link.matches){
    const source=careSteps.filter(s=>s.rules.includes(m.from)).sort((a,b)=>(m.from.condition??'').indexOf(`${a.actor} ${a.verb}`)-(m.from.condition??'').indexOf(`${b.actor} ${b.verb}`))[0];
    const target=careSteps.find(s=>s.rules.includes(m.to)&&m.phrase.startsWith(s.verb)&&m.phrase.endsWith(s.object));
    if(!source||!target||source.id===target.id)continue;
    const id=`${source.id}>${target.id}`;const edge=eventLinks.get(id)??{id,source:source.id,target:target.id,recLinks:[]};
    if(!edge.recLinks.includes(link.id))edge.recLinks.push(link.id);eventLinks.set(id,edge);
  }
  return {nodes:g.recommendations,links:[...links.values()],careSteps,eventLinks:[...eventLinks.values()]};
}
