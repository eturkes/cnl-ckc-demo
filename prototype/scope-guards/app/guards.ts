import { loadEvidenceDocument } from '../../../src/provenance/assets.js';
import { CLAUSES, goalFor, render, proofSteps } from './logic.js';

const scalar = (term: any) => term?.value ?? '';
const compounds = (term: any): any[] => term?.kind === 'compound' ? [term, ...term.args.flatMap(compounds)] : [];
const readable = (text: string) => text.replaceAll('-', ' ');
export async function loadGuardRecords(demo: any, date: string) {
  const goal = 'guideline_supersession(Document,Sentence,source(Citation,Url),Date)';
  const outcome = await demo.runGoal(goal);
  if (outcome?.kind !== 'solutions') return {goal,error:JSON.stringify(outcome),returned:0};
  const clauses = await demo.runGoal(CLAUSES);
  if (clauses?.kind !== 'solutions') return {goal,error:JSON.stringify(clauses),returned:0};
  const superseded = [];
  for (const solution of outcome.solutions) {
    const b = solution.bindings;
    const doc = scalar(b.Document), sentence = Number(scalar(b.Sentence));
    const document = await loadEvidenceDocument(doc);
    const text = document.ace.sentences.find(s => s.number === sentence)?.text;
    if (!text) throw Error('Controlled-language sentence unavailable.');
    const clause = clauses.solutions.find((s: any) => Number(scalar(s.bindings.S)) === sentence);
    if (!clause) throw Error('Superseded operator clause unavailable.');
    const proofGoal = goalFor(clause.bindings.C,clause.bindings.Body,date);
    const derived = await demo.runGoal(proofGoal);
    if (!derived || !['solutions','failure'].includes(derived.kind)) throw Error('Historical derivation did not finish.');
    const effective = String(scalar(b.Date));
    superseded.push({text,document:doc,sentence,citation:scalar(b.Citation),url:scalar(b.Url),date:`${effective.slice(0,4)}-${effective.slice(4,6)}-${effective.slice(6,8)}`,derived:derived.kind === 'solutions',proofGoal,proof:derived.kind === 'solutions' ? proofSteps(derived.solutions[0].bindings.Proof) : [],canonical:derived});
  }
  const exclusions: any[] = [];
  let rawExclusions = 0;
  const sourceChecks = [];
  for (const suffix of ['s3-03','s9-01','s10-04','s7-02']) {
    const document = await loadEvidenceDocument(`cdc2022-opioid-${suffix}`);
    for (const clause of document.clauses.filter(row => row.predicate === 'guideline_exclusion')) {
      const [head,body] = clause.text.replace(/\.\s*$/,'').split(' :- ');
      const query = `clause(${head},Body),Body=user:(${body})`;
      const result = await demo.runGoal(query);
      if (result?.kind !== 'solutions') throw Error(`Exclusion source could not be matched: ${document.id} S${clause.sentence}`);
      rawExclusions++;
      const terms = compounds(result.solutions[0].bindings.Body);
      const nouns = terms.filter(x => x.functor === 'guideline_entity').map(x => scalar(x.args[2])).filter(x => x !== 'patient');
      const comparison = terms.find(x => x.functor === 'guideline_satisfies');
      let label = '';
      const primary = nouns.find(x => !['possible-inpatient-admission','pain-management-prescription','facility-discharge'].includes(x));
      if (!primary) throw Error('Exclusion has no condition noun');
      if (comparison) label = `has an ${readable(primary)} ${scalar(comparison.args.at(-3)) === 'less' ? 'less than' : scalar(comparison.args.at(-3))} ${scalar(comparison.args.at(-2))} ${readable(scalar(comparison.args.at(-1)))}s`;
      else label = `${primary.includes('pain') ? 'has' : 'receives'} ${readable(primary)}`;
      if (nouns.includes('possible-inpatient-admission')) label += ' with a possible inpatient admission';
      if (nouns.includes('pain-management-prescription')) label += ' and does not provably receive a pain management prescription at facility discharge';
      let entry = exclusions.find(x => x.label === label);
      if (!entry) { entry={label,sources:[],body:result.solutions[0].display.Body}; exclusions.push(entry); }
      entry.sources.push({document:document.id,sentence:clause.sentence});
      sourceChecks.push({query,result});
    }
  }
  return {superseded,exclusions,rawExclusions,goal,returned:outcome.solutions.length+rawExclusions,date,sourceChecks};
}
