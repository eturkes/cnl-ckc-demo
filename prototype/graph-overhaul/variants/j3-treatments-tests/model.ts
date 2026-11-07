import type { Guideline, NetworkEdge, NetworkNode } from '../../shared/data.js';

export const HAND_MADE = ['nonopioid-therapy','nonpharmacologic-therapy','nonopioid-pharmacologic-therapy','opioid-therapy','opioid-prescription','opioid-therapy-initiation','immediate-release-opioid','ER-LA-opioid','lowest-effective-dosage','opioid','opioid-dosage','opioid-quantity','risk-mitigation-strategy','management-plan','naloxone-dose','controlled-substance-prescription-history','state-PDMP-record','toxicology-testing','prescribed-medication','prescribed-controlled-substance','nonprescribed-controlled-substance','opioid-pain-medication','benzodiazepine','central-nervous-system-depressant','different-therapy','lower-opioid-dosage','evidence-based-medication-treatment','medication-free-detoxification','chronic-opioid-therapy','initial-opioid-therapy','continued-opioid-therapy','opioid-initiation'];
const terms = (text: string) => HAND_MADE.filter(t => new RegExp(`(?<![\\w-])${t}(?![\\w-])`, 'u').test(text));
export const project = (g: Guideline): Guideline['network'] => {
  const nodes: NetworkNode[] = HAND_MADE.map(id => ({ id, label:id.replaceAll('-',' '), roles:['acted-on'], rules:g.rules.filter(r=>terms(r.original).includes(id)).map(r=>`${r.document}:${r.sentence}`) })).filter(n=>n.rules.length>0);
  const edges: NetworkEdge[]=[];
  for(const r of g.rules) {
    const key=`${r.document}:${r.sentence}`, rec=g.documents.find(d=>d.id===r.document)?.rec??null;
    const add=(source:string,target:string,verb:string,negative:boolean,detail:string) => { if(source===target) return; edges.push({id:`${key}#${edges.length}`,rule:key,rec,source,target,verb,detail,when:r.condition?[r.condition]:[],modal:r.mode,negative}); };
    for(const a of r.actions) {
      const negative=a.polarity==='negative';
      const v=`${r.mode==='fact'?'fact:':r.mode}${negative?' not':''} ${a.qualifiers.filter(q=>typeof q==='string').join(' ')} ${a.verb}`.replace(/\s+/gu,' ');
      const instead=a.object.split(' instead-of ');
      const targets=terms(instead[0]);
      if(instead.length>1) { for(const s of targets) for(const t of terms(instead[1])) add(s,t,`${v} instead of`,negative,'Direct alternative'); continue; }
      if(r.mode==='can') { for(const s of terms(r.subject)) for(const t of targets) add(s,t,v,negative,'Direct capability'); continue; }
      const paired=a.modifiers.filter(m=>['with','to'].includes(m.preposition)).flatMap(m=>terms(m.value).map(t=>({t,p:m.preposition,value:m.value})));
      if(paired.length) { for(const s of targets) for(const p of paired) add(s,p.t,`${v}${/cautiously/u.test(a.object+' '+p.value)?' cautiously':''} ${p.p}`,negative,'Direct modifier'); continue; }
      // The antecedent names context, not the actor or a causal relationship.
      const contexts=terms(r.condition??'');
      const context=contexts.sort((a,b)=>b.length-a.length)[0];
      if(context) for(const target of targets) add(context,target,`in this context: ${v}`,negative,'Conditional advice; source is context, clinician is actor');
    }
    const continued=r.actions.find(a=>a.verb==='continue');
    const optimized=r.actions.find(a=>a.verb==='optimize');
    if(continued&&optimized) for(const s of terms(continued.object)) for(const t of terms(optimized.object)) add(s,t,`${r.mode} continue and optimize`,false,'Both actions recommended under the same complete condition');
  }
  return {nodes,edges};
};
