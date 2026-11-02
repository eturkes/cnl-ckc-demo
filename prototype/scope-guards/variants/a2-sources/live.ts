import type { PlTerm } from '../../../../src/engine/terms.js';
import type { PlSolution } from '../../../../src/engine/protocol.js';

export const SUPERSESSION_GOAL = `guideline_supersession(Doc,Sentence,source(Citation,Url),Date), sub_atom_icasechk(Doc,0,'cdc2022-opioid-rec12-'), W='$guideline_id'(_,Doc,Sentence,_,_), findall(rule(H,B),(clause(guideline_operator(actual,W,O),B), H=guideline_operator(actual,W,O);clause(guideline_operator(W,C,O),B), H=guideline_operator(W,C,O);clause(guideline_entity(W,R,N,T),B), H=guideline_entity(W,R,N,T);clause(guideline_event(W,E,V),B), H=guideline_event(W,E,V);clause(guideline_arg(W,E,P,R),B), H=guideline_arg(W,E,P,R);clause(guideline_pp(W,E,P,R),B), H=guideline_pp(W,E,P,R);clause(guideline_qualifier(W,E,K,Q),B), H=guideline_qualifier(W,E,K,Q)),Rules)`;
export const EXCLUSION_GOAL = `clause(guideline_exclusion('cdc-2022-opioid'),Body)`;
const args = (t: PlTerm | undefined): PlTerm[] => t?.kind === 'compound' ? t.args : [];
const value = (t: PlTerm | undefined): string => t && 'value' in t ? String(t.value) : '';
const key = (t: PlTerm | undefined): string => !t ? '' : t.kind === 'variable' ? `v${t.id}` : t.kind === 'compound' ? `${t.functor}(${(t.functor === '$guideline_id' ? t.args.slice(0,4) : t.args).map(key).join(',')})` : t.kind === 'list' ? `[${t.items.map(key).join(',')}]` : JSON.stringify(t);
const is = (t: PlTerm | undefined, name: string) => t?.kind === 'compound' && t.functor === name;
const flatten = (t: PlTerm): PlTerm[] => is(t, ':') ? flatten(args(t)[1]) : is(t, ',') ? args(t).flatMap(flatten) : [t];
const words = (t: PlTerm | undefined) => value(t).replaceAll('-', ' ');

export interface Superseded { document: string; sentence: string; citation: string; url: string; date: string; text: string; raw: string; }
export function superseded(solution: PlSolution): Superseded {
 const b=solution.bindings;
 const rules=b.Rules?.kind==='list'?b.Rules.items:[];
 const heads=rules.map(r=>args(r)[0]);
 const top=heads.find(h=>is(h,'guideline_operator') && value(args(h)[0])==='actual');
 const events=heads.filter(h=>is(h,'guideline_event'));
 const firstBody=rules.length?flatten(args(rules[0])[1]):[];
 const all=[...heads,...firstBody];
 const noun=(r:PlTerm|undefined,pool=all)=>words(args(pool.find(h=>is(h,'guideline_entity')&&key(args(h)[1])===key(r)))[2])||'clinician';
 const event=(h:PlTerm, pool:PlTerm[], negative=false, naf=false)=>{
  const [scope,id,verb]=args(h);
  const related=pool.filter(x=>key(args(x)[0])===key(scope)&&key(args(x)[1])===key(id));
  const role=(p:string)=>args(related.find(x=>is(x,'guideline_arg')&&value(args(x)[2])===p))[3];
  const subject=noun(role('1'),pool); const object=role('2');
  const qualifiers=related.filter(x=>is(x,'guideline_qualifier')).map(x=>words(args(x)[3])).join(' ');
  const pps=related.filter(x=>is(x,'guideline_pp')).map(x=>`${words(args(x)[2])} a ${noun(args(x)[3],pool)}`).join(' ');
  return `a ${subject} ${naf?'does not provably ':negative?'does not ':''}${qualifiers?qualifiers+' ':''}${words(verb)}${object?' a '+noun(object,pool):''}${pps?' '+pps:''}`;
 };
 const main=events.find(h=>!heads.some(x=>is(x,'guideline_operator')&&key(args(x)[1])===key(args(h)[0])&&value(args(x)[2])==='-'))||events[0];
 const negative=main&&heads.some(x=>is(x,'guideline_operator')&&key(args(x)[1])===key(args(main)[0])&&value(args(x)[2])==='-');
 const condition=firstBody.filter(h=>is(h,'guideline_event')).map(h=>event(h,firstBody,firstBody.some(x=>is(x,'guideline_operator')&&key(args(x)[1])===key(args(h)[0])&&value(args(x)[2])==='-')));
 for(const h of firstBody.filter(x=>is(x,'\\+'))){const inner=flatten(args(h)[0]); for(const e of inner.filter(x=>is(x,'guideline_event')))condition.push(event(e,[...inner,...firstBody],false,true));}
 let text=main?event(main,all,!!negative):'Statement could not be rendered';
 text=text.replace(/^a clinician /, `a clinician ${words(args(top)[2])} `);
 if(negative) text=text.replace('should does not ','should not ');
 if(condition.length)text=`If ${condition.join(' and ')}, then ${text}`;
 text=text.replace(/\ba ([aeiou])/g,'an $1').replace(/(If a clinician) prescribe /,'$1 prescribes ');
 text=text[0].toUpperCase()+text.slice(1)+'.';
 const date=value(b.Date);
 return {document:value(b.Doc),sentence:value(b.Sentence),citation:value(b.Citation),url:value(b.Url),date:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00Z`)),text,raw:Object.values(solution.display).join('\n')};
}
export function exclusionReading(solutions: readonly PlSolution[]): string {
 const tokens=new Set<string>();
 for(const solution of solutions){
  const visit=(term:PlTerm)=>{if(term.kind==='atom' && /sickle|cancer|palliative|end-of-life|hospital|emergency|observational|discharge|pain-management/.test(term.value))tokens.add(term.value.replaceAll('-',' ')); if(term.kind==='compound')term.args.forEach(visit);};
  if(solution.bindings.Body)visit(solution.bindings.Body);
 }
 const age=solutions.some(s=>s.display.Body?.includes('less,18'))?'age below 18 years':'';
 const exception=[...tokens].filter(x=>/pain management prescription|facility discharge/.test(x));
 const core=[...tokens].filter(x=>!exception.includes(x));
 return [...core,...(age?[age]:[])].join(', ')+(exception.length ? `; the facility settings exclude cases except when a ${exception[0]} at ${exception[1]} is provable` : '');
}
