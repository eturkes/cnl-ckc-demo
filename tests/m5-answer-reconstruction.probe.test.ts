// Projection seam only: successful sentence ids are input, not inferred here.
// u1 must supply genuine successes; this experiment does not close S1.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import type { PlTerm } from '../src/engine/terms.js';
import { presentClinicalAdvice } from '../src/questions/advice.js';
import { parseAdviceSentence, CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { deriveProvenance } from '../tools/kb/provenance.mjs';
import { bagFiles, bagText, boot, ROOT, solve } from './m5-probe-support.js';

const atom = (text: string): string => `'${text.replaceAll("'", "''")}'`;
const str = JSON.stringify;
const list = (items: string[]): string => `[${items.join(',')}]`;
const files = bagFiles();
const documents = CLINICAL_QUESTIONS.flatMap(({ sources }) => sources.map(({ document }) => document));
const clauses = new Map(documents.map((document) => [document,
  bagText(files, `/ace/${document}.ace`).trimEnd().split('\n').slice(1)
    .map((source, i) => parseAdviceSentence(source, i + 2)),
]));
const passages = new Map(deriveProvenance(files).chunks.map(({ document, model }) => [
  document, (model as { source: { text: string } }).source.text,
]));
const surface = [...clauses].flatMap(([document, sentences]) => sentences.map((clause) => {
  const actions = clause.actions.map(({ polarity, verb, object, modifiers }) =>
    `action(${polarity},${atom(verb)},${str(object)},${list(modifiers.map(({ preposition, value }) =>
      `modifier(${atom(preposition)},${str(value)})`))})`);
  return `m5_surface(${atom(document)},${clause.sentence},${clause.condition === undefined ? 'none' : `some(${str(clause.condition)})`},${str(clause.subject)},${clause.mode},${list(actions)}).`;
})).join('\n');
const projector = `
:- discontiguous(m5_surface/6).
${surface}
${documents.map((document) => `m5_passage(${atom(document)},${str(passages.get(document))}).`).join('\n')}
m5_project(Doc,Sentences,clinical_answer(Doc,Rules,Passage)) :-
  Sentences = [_|_], m5_passage(Doc,Passage), m5_groups(Sentences,Doc,[],Rules).
m5_groups([],_,Rules,Rules).
m5_groups([S|Ss],Doc,Acc,Rules) :-
  m5_surface(Doc,S,C,Sub,M,A), m5_add(C,Sub,M,A,Acc,Next), m5_groups(Ss,Doc,Next,Rules).
m5_add(none,Sub,M,A,[],[rule([],Sub,M,A)]).
m5_add(some(C),Sub,M,A,[],[rule([C],Sub,M,A)]).
m5_add(some(C),Sub,M,A,[rule(Cs,Sub,M,A)|Rs],[rule(Next,Sub,M,A)|Rs]) :- !,
  Cs = [_|_], m5_append(Cs,[C],Next).
m5_add(C,Sub,M,A,[R|Rs],[R|Next]) :- m5_add(C,Sub,M,A,Rs,Next).
m5_append([],Ys,Ys).
m5_append([X|Xs],Ys,[X|Zs]) :- m5_append(Xs,Ys,Zs).
`;

type Target = { id: string; answers: { canonical: string; term: PlTerm; presentation: { text: string } }[] };
const targets = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/m5-answer-targets.json'), 'utf8')) as Target[];

it('ans.identity: source-preserving runtime construction equals all shipped terms', async () => {
  const session = await boot();
  session.consult(projector);
  const verdicts = [];
  for (const topic of CLINICAL_QUESTIONS) {
    const target = targets.find(({ id }) => id === topic.id);
    let bytes = 0;
    for (const [index, { document }] of topic.sources.entries()) {
      const ids = (clauses.get(document) ?? []).map(({ sentence }) => String(sentence));
      const rows = await solve(session, `m5_project(${atom(document)},${list(ids)},Answer)`);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.display.Answer, document).toBe(target?.answers[index]?.canonical);
      const answer = rows[0]?.bindings.Answer;
      if (answer === undefined) throw new Error('no constructed answer');
      const presentation = presentClinicalAdvice(answer);
      expect(presentation?.text, document).toBe(target?.answers[index]?.presentation.text);
      bytes += Buffer.byteLength(presentation?.text ?? '');
      // Negative control = remove one contributing success, never an answer fact.
      for (const removed of ids) {
        const mutant = await solve(session, `m5_project(${atom(document)},${list(ids.filter((id) => id !== removed))},Answer)`);
        expect(mutant[0]?.display.Answer, `${document}:remove-S${removed}`).not.toBe(rows[0]?.display.Answer);
      }
    }
    verdicts.push({ id: topic.id, equal: true, documents: topic.sources.length, bytes });
  }
  console.log(JSON.stringify({ assumption: 'successful sentence set supplied by u1', verdicts,
    sourceSentences: [...clauses.values()].reduce((n, cs) => n + cs.length, 0),
    projectorBytes: Buffer.byteLength(projector) }));
}, 120_000);

it('ans.derive: a real schema join constructs the first recommendation, not an answer lookup', async () => {
  const session = await boot();
  session.consult(`
    m5_np('nonopioid-therapy',"a nonopioid-therapy").
    m5_np('acute-pain',"an acute-pain").
    m5_derive(Doc,S,rule([],"Every clinician",Mode,[action(positive,Verb,Obj,[modifier(Prep,Value)])])) :-
      Ctx = '$guideline_id'(context,Doc,S,_,_),
      guideline_operator(actual,Ctx,Mode), guideline_event(Ctx,Event,Verb),
      guideline_arg(Ctx,Event,2,Object), guideline_entity(Ctx,Object,Noun,countable),
      guideline_pp(Ctx,Event,Prep,Entity), guideline_entity(Ctx,Entity,Label,countable),
      m5_np(Noun,Obj), m5_np(Label,Value).
  `);
  expect(await solve(session, "m5_derive('cdc2022-opioid-rec01',2,Rule)")).toEqual([]);
  await solve(session, `dynamic(guideline_entity/4), dynamic(guideline_cardinality/5),
    assertz(guideline_entity(actual,'$m5-clinician',clinician,countable)),
    assertz(guideline_cardinality(actual,'$m5-clinician',na,eq,1))`);
  const rows = await solve(session, "m5_derive('cdc2022-opioid-rec01',2,Rule)");
  const term = targets[0]?.answers[0]?.term;
  if (term?.kind !== 'compound' || term.args[1]?.kind !== 'list') throw new Error('bad baseline target');
  expect(rows).toHaveLength(1);
  expect(rows[0]?.bindings.Rule).toEqual(term.args[1].items[0]);
  // Removing the semantic event removes the result despite intact surface metadata.
  await solve(session, `dynamic(guideline_event/3),
    retractall(guideline_event('$guideline_id'(context,'cdc2022-opioid-rec01',2,_,_),_,_))`);
  expect(await solve(session, "m5_derive('cdc2022-opioid-rec01',2,Rule)")).toEqual([]);
  console.log('real schema-derived rule = baseline rec01:S2; bare/retracted = no answer');
}, 120_000);
