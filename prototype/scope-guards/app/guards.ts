import { loadEvidenceDocument } from '../../../src/provenance/assets.js';
import clauseIndexUrl from '@kb/provenance/clause-index.json?url&no-inline';
import { CLAUSES, goalFor, render, proofSteps } from './logic.js';

const scalar = (term: any) => term?.value ?? '';
const readable = (text: string) => text.replaceAll('-', ' ');
const is = (term: any, name: string) => term?.kind === 'compound' && term.functor === name;
const same = (a: any,b: any) => a !== undefined && b !== undefined && render(a) === render(b);
const conjunction = (term: any): any[] => is(term,':') ? conjunction(term.args[1]) : is(term,',') ? term.args.flatMap(conjunction) : [term];
let indexPromise: Promise<any> | undefined;
export const EXCLUSION_GOAL = 'findall(exclusion(Line,Guideline,Body),(clause(guideline_exclusion(Guideline),Body,Ref),clause_property(Ref,line_count(Line))),Records)';

export async function loadExclusionRecords(demo: any) {
  const outcome = await demo.runGoal(EXCLUSION_GOAL);
  const terms = outcome?.kind === 'solutions' ? outcome.solutions[0]?.bindings.Records : undefined;
  if (terms?.kind !== 'list') throw Error('Live exclusion records could not be read.');
  indexPromise ??= fetch(clauseIndexUrl).then(response => { if (!response.ok) throw Error('Clause index could not be read.'); return response.json(); });
  const index = await indexPromise;
  const indexed = new Map(index.clauses.filter((row: any) => row.predicate === 'guideline_exclusion').map((row: any) => [row.line,row]));
  const records = [];
  for (const term of terms.items) {
    if (!is(term,'exclusion')) throw Error('Malformed exclusion record.');
    const line = Number(scalar(term.args[0]));
    const row: any = indexed.get(line);
    if (!row) throw Error(`Live exclusion line ${line} has no clause-index source.`);
    const document = await loadEvidenceDocument(row.document);
    if (!document.clauses.some(clause => clause.line === line && clause.predicate === 'guideline_exclusion' && clause.sentence === row.sentence)) throw Error(`Exclusion source differs from its indexed line ${line}.`);
    records.push({document:row.document,sentence:row.sentence,line,body:term.args[2]});
  }
  return {records,goal:EXCLUSION_GOAL,outcome};
}

const finite = (verb: string) => ({have:'has',be:'is',do:'does'}[verb] ?? (/[sxz]$|[cs]h$|o$/.test(verb) ? `${verb}es` : /[^aeiou]y$/.test(verb) ? `${verb.slice(0,-1)}ies` : `${verb}s`));
const boundWords: Record<string,string> = {less:'less than',leq:'at most',geq:'at least',greater:'more than',eq:'exactly'};
export function exclusionCondition(body: any): string {
  function group(term: any, inherited: any[] = [], subject?: any, negative = false): string {
    const parts = conjunction(term);
    const literals = parts.filter(part => !is(part,'\\+'));
    const available = [...literals,...inherited];
    const events = literals.filter(part => is(part,'guideline_event'));
    const argument = (event: any,position: number) => available.find(part => is(part,'guideline_arg') && same(part.args[1],event.args[1]) && Number(scalar(part.args[2])) === position)?.args[3];
    const root = subject ?? (events[0] ? argument(events[0],1) : undefined);
    if (!events.length || !root) throw Error('Exclusion condition has no event and subject.');
    function noun(ref: any, article = false): string {
      const entity = available.find(part => is(part,'guideline_entity') && same(part.args[1],ref));
      if (entity) {
        const text = readable(String(scalar(entity.args[2])));
        return article ? `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text}` : text;
      }
      const cardinality = available.find(part => is(part,'guideline_cardinality') && same(part.args[1],ref));
      const unit = available.find(part => is(part,'guideline_unit') && same(part.args[1],ref));
      const comparison = available.find(part => is(part,'guideline_satisfies') && cardinality && same(part.args[0],cardinality.args[3]) && same(part.args[1],cardinality.args[4]) && (part.args.length === 4 || (unit && same(part.args[2],unit.args[2]))));
      if (!comparison) throw Error('An exclusion argument has neither a noun nor a comparison.');
      const offset = comparison.args.length === 6 ? 3 : 2;
      const relation = boundWords[String(scalar(comparison.args[offset]))];
      if (!relation) throw Error('Unrecognized exclusion comparison.');
      const value = scalar(comparison.args[offset+1]);
      const measure = comparison.args.length === 6 ? readable(String(scalar(comparison.args[5]))) : '';
      return `${relation} ${value}${measure ? ` ${measure}${Number(value) === 1 ? '' : 's'}` : ''}`;
    }
    const phrases = events.map(event => {
      const actor = argument(event,1), object = argument(event,2);
      const verb = String(scalar(event.args[2]));
      const actorText = same(actor,root) ? '' : `the ${noun(actor)} `;
      const objectContinues = events.some(other => same(argument(other,1),object));
      const objectText = object === undefined ? '' : ` ${noun(object,negative || objectContinues)}`;
      const modifiers = literals.filter(part => is(part,'guideline_pp') && same(part.args[1],event.args[1])).map(part => ` ${readable(String(scalar(part.args[2])))} ${noun(part.args[3],true)}`).join('');
      return `${actorText}${negative && events.length === 1 ? `does not provably ${verb}` : finite(verb)}${objectText}${modifiers}`;
    });
    let text = phrases.join(' and ');
    if (negative && events.length !== 1) text = `it is not provable that the ${noun(root)} ${text}`;
    for (const part of parts.filter(part => is(part,'\\+'))) text += ` and ${group(part.args[0],available,root,true)}`;
    return text;
  }
  return group(body);
}

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
  const live = await loadExclusionRecords(demo);
  const exclusions: any[] = [];
  for (const record of live.records) {
    const label = exclusionCondition(record.body);
    let entry = exclusions.find(row => row.label === label);
    if (!entry) { entry={label,sources:[],body:render(record.body)}; exclusions.push(entry); }
    entry.sources.push({document:record.document,sentence:record.sentence});
  }
  return {superseded,exclusions,rawExclusions:live.records.length,goal,returned:outcome.solutions.length+live.records.length,date,sourceChecks:[{goal:live.goal,outcome:live.outcome}]};
}
