import { EngineClient } from '../../../src/engine/client.js';
import { AnswerService } from '../../../src/questions/service.js';
import { proofSteps } from './logic.js';

export function createPrototypeEngine(readDate: () => string, flight: (delta: number) => void = () => {}, readGoalDate = readDate) {
  const client = new EngineClient();
  const audit: any[] = [];
  let answerDate = '';
  function datePremises(date: string) {
    if (!date) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0,4)) < 1 || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw Error('Choose a valid Gregorian date.');
    return [`guideline_evaluation_date(${Number(date.replaceAll('-',''))})`];
  }
  async function query(goal: string, budget: any, signal?: AbortSignal, stream?: any, date = readDate()) {
    flight(1);
    try {
      const premises = datePremises(date);
      // Trusted prototype overlay: snapshot rolls back both the date fact and clinical premises.
      // findall preserves all answers despite snapshot/1's once semantics; enumerate outside it.
      const dateOverlay = `dynamic(guideline_evaluation_date/1),retractall(guideline_evaluation_date(_)),${premises.length ? `assertz(${premises[0]}),` : ''}`;
      const wrapped = `term_variables((${goal}),PrototypeVariables), snapshot((${dateOverlay}dynamic(clinical_context/3),retractall(clinical_context(_,_,_)),assertz((clinical_context(PrototypeDoc,PrototypeSentence,PrototypeAssumptions) :- findall(PrototypeLiteral,clinical_premise(PrototypeDoc,PrototypeSentence,_,PrototypeLiteral),PrototypeBase),app(PrototypeBase,[${premises}],PrototypeAssumptions))),clinical_context('__prototype_date_control',0,PrototypeControl),PrototypeControl=[${premises}],findall(PrototypeVariables,(${goal}),PrototypeRows))),mark_member(PrototypeVariables,PrototypeRows)`;
      const outcome = await client.query(wrapped,budget,signal,stream);
      const positive = await client.query('findall(1,guideline_supersession(_,_,_,_),R),length(R,N)',budget);
      const absent = await client.query('guideline_evaluation_date(D)',budget);
      const context = await client.query("clinical_context('cdc2022-opioid-rec12',2,As),mark_member(guideline_evaluation_date(D),As)",budget);
      audit.push({date,goal,positive,absent,context});
      if (positive.kind !== 'solutions' || positive.solutions[0]?.display.N !== '3' || absent.kind !== 'failure' || context.kind !== 'failure') throw Error('Run-context isolation control failed.');
      (window as any).__scopeAudit = audit;
      if ('solutions' in outcome) {
        const clean = (solution: any) => ({bindings:Object.fromEntries(Object.entries(solution.bindings).filter(([k])=>!k.startsWith('Prototype') || k === 'PrototypeProof')),display:Object.fromEntries(Object.entries(solution.display).filter(([k])=>!k.startsWith('Prototype') || k === 'PrototypeProof'))});
        return {...outcome,solutions:outcome.solutions.map(clean)};
      }
      return outcome;
    } finally { flight(-1); }
  }
  const service = new AnswerService({query: (goal: string,budget: any,signal?: AbortSignal,stream?: any) => query(goal,budget,signal,stream,answerDate)} as any);
  return {
    boot: (progress?: any) => client.boot(progress),
    ask: (...args: any[]) => { answerDate = readDate(); return (service.ask as any)(...args); },
    marks: (...args: any[]) => (service.marks as any)(...args),
    prove: async (input: any, budget: any, signal?: AbortSignal) => {
      const date = answerDate;
      const premises = datePremises(date);
      const clinical = input.goal.replace(/clinical_advice\((.*)\)$/, 'clinical_advice($1,PrototypeClinicalProof)');
      const context = premises.length ? `derive(${premises[0]},4,[${premises}],PrototypeDateProof,proved)` : 'PrototypeDateProof=[]';
      const bindings = Object.entries(input.selected).map(([key,value]) => `${key}=(${value})`).join(',');
      const goal = `${clinical}${bindings ? ','+bindings : ''},${context},app(PrototypeDateProof,PrototypeClinicalProof,PrototypeProof)`;
      const outcome = await query(goal,{...budget,answerCap:1},signal,undefined,date);
      if (outcome.kind === 'solutions') return {kind:'proof',steps:proofSteps(outcome.solutions[0].bindings.PrototypeProof)};
      return outcome;
    },
    runGoal: (goal: string,budget: any,signal?: AbortSignal) => query(goal,budget,signal,undefined,readGoalDate()),
    dispose: () => client.dispose(),
  };
}
