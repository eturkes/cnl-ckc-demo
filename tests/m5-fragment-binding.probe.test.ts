// Source wording is passive metadata. Exact source-site execution gates emission.
// rec01:S2 feasibility only; the all-sentence interpreter remains u1/u2 scope.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import type { PlTerm } from '../src/engine/terms.js';
import { parseAdviceSentence } from '../tools/kb/clinical.mjs';
import { payloadDocuments } from '../tools/kb/payload.mjs';
import { bagFiles, bagText, boot, ROOT, solve } from './m5-probe-support.js';

const files = bagFiles();
const document = 'cdc2022-opioid-rec01';
const sentence = 2;
const selected = parseAdviceSentence(
  bagText(files, `/ace/${document}.ace`).split('\n')[sentence - 1] as string,
  sentence,
);
const atom = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const lexical = `rule([],${JSON.stringify(selected.subject)},${selected.mode},[${selected.actions
  .map(
    ({ polarity, verb, object, modifiers }) =>
      `action(${polarity},${atom(verb)},${JSON.stringify(object)},[${modifiers
        .map(({ preposition, value }) => `modifier(${atom(preposition)},${JSON.stringify(value)})`)
        .join(',')}])`,
  )
  .join(',')}])`;
const sites: { line: number; head: string }[] = [];
let doc = '';
let ordinal = 0;
for (const [index, line] of payloadDocuments(files).source.split('\n').entries()) {
  const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
  if (file !== null) {
    doc = file[1] as string;
    ordinal = 0;
  }
  const marker = /^% S([1-9][0-9]*):/u.exec(line);
  if (marker !== null) ordinal = Number(marker[1]);
  if (doc === document && ordinal === sentence && line.startsWith('guideline_')) {
    sites.push({
      line: index + 1,
      head: line.includes(' :- ') ? (line.split(' :- ')[0] as string) : line.slice(0, -1),
    });
  }
}
const declarations = [
  'guideline_arg/4',
  'guideline_cardinality/5',
  'guideline_entity/4',
  'guideline_event/3',
  'guideline_operator/3',
  'guideline_pp/4',
  'guideline_property/4',
];
const program = `
m5_source_fragment('${document}',${sentence},${lexical}).
m5_bound(Answer,[${sites.map(({ line }) => line).join(',')}]) :-
  ${sites.map(({ line, head }) => `m5_use(${line},${head})`).join(',\n  ')},
  m5_source_fragment('${document}',${sentence},Answer).
m5_use(Line,Head) :- clause(Head,Body,Ref), clause_property(Ref,file('/prolog.pl')),
  clause_property(Ref,line_count(Line)), call(Body).
${declarations.map((predicate) => `m5_predicate(${predicate}).`).join('\n')}
m5_site(Line,Head,Body,Ref) :- m5_predicate(Name/Arity), dynamic(Name/Arity),
  functor(Head,Name,Arity), clause(Head,Body,Ref),
  clause_property(Ref,file('/prolog.pl')), clause_property(Ref,line_count(Line)).
m5_erase(Line) :- m5_site(Line,_,_,Ref), erase(Ref).
m5_relocate(Line) :- m5_site(Line,Head,Body,Ref), erase(Ref), assertz((Head :- Body)).
`;
const context = `dynamic(guideline_entity/4), dynamic(guideline_cardinality/5),
  assertz(guideline_entity(actual,'$m5-actor',clinician,countable)),
  assertz(guideline_cardinality(actual,'$m5-actor',na,eq,1))`;

it('ans.derive-binding: a source fragment requires execution of every exact compiled clause site', async () => {
  expect(sites).toHaveLength(9);
  const session = await boot();
  session.consult(program);
  expect(await solve(session, 'current_predicate(m5_bound/2)')).toHaveLength(1);
  expect(await solve(session, 'm5_bound(Answer,Lines)')).toEqual([]);
  await solve(session, context);
  const result = await solve(session, 'm5_bound(Answer,Lines)');
  expect(result).toHaveLength(1);
  const targets = JSON.parse(
    readFileSync(join(ROOT, 'tests/fixtures/m5-answer-targets.json'), 'utf8'),
  ) as {
    answers: { term: PlTerm }[];
  }[];
  const original = targets[0]?.answers[0]?.term;
  if (original?.kind !== 'compound' || original.args[1]?.kind !== 'list')
    throw new Error('target rule missing');
  expect(result[0]?.bindings.Answer).toEqual(original.args[1].items[0]);
  expect(result[0]?.display.Lines).toBe(`[${sites.map(({ line }) => line).join(',')}]`);
  const controls = [];
  for (const { line } of sites) {
    const mutant = await boot();
    mutant.consult(program);
    await solve(mutant, context);
    expect(await solve(mutant, 'm5_bound(Answer,Lines)')).toHaveLength(1);
    expect(await solve(mutant, `m5_erase(${line})`)).toHaveLength(1);
    expect(await solve(mutant, 'm5_bound(Answer,Lines)'), `removed clause ${line}`).toEqual([]);
    controls.push(line);
  }
  const event = sites.find(({ head }) => head.startsWith('guideline_event('));
  if (event === undefined) throw new Error('event site missing');
  expect(await solve(session, `m5_relocate(${event.line})`)).toHaveLength(1);
  const native = await solve(
    session,
    "guideline_event('$guideline_id'(context,'cdc2022-opioid-rec01',2,_,_),_,maximize)",
  );
  expect(native).toHaveLength(1);
  expect(await solve(session, 'm5_bound(Answer,Lines)')).toEqual([]);
  console.log(
    JSON.stringify({
      exactRule: true,
      contentSites: sites.length,
      removedSites: controls,
      missingContextAnswers: 0,
      withContextAnswers: 1,
      sameHeadNewSiteNativeAnswers: native.length,
      sameHeadNewSiteBoundAnswers: 0,
      scope:
        'source-site execution, not Doc/Sentence lookup; all-sentence generalization and full proof tree not measured',
    }),
  );
}, 120_000);
