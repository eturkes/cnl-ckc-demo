import {
  ASSUMPTION_SOURCE,
  CASES,
  atom,
  buildProbeImage,
  loadEngine,
  once,
  prepare,
  text,
} from './m5-inference-support.mjs';

export const PREDICATES = [
  ['guideline_arg', 4],
  ['guideline_cardinality', 5],
  ['guideline_entity', 4],
  ['guideline_event', 3],
  ['guideline_operator', 3],
  ['guideline_pp', 4],
  ['guideline_property', 4],
];
const skeleton = ASSUMPTION_SOURCE.split('\n')
  .filter((line) => /^m5_(?:derive|conjunction|all)\(/u.test(line))
  .join('\n');
const interpreter = (name, leaf) =>
  skeleton
    .replace(/^m5_derive\(H,_,A,\[assumption\(H\)\],proved\).*$/mu, leaf)
    .replaceAll('m5_derive', `${name}_derive`)
    .replaceAll('m5_conjunction', `${name}_conjunction`)
    .replaceAll('m5_all', `${name}_all`);

export const MECHANISM_SOURCE = String.raw`
:- dynamic(m5_live_ref/1).
m5_enable_dynamic :- ${PREDICATES.map(([p, a]) => `dynamic(${p}/${a})`).join(',')}.
m5_call_all([]).
m5_call_all([H|T]) :- call(H),m5_call_all(T).
m5_assert([],[]).
m5_assert([H|T],[R|Rs]) :- assertz(H,R),assertz(m5_live_ref(R)),m5_assert(T,Rs).
m5_assert_first([],[]).
m5_assert_first([H|T],[R|Rs]) :- asserta(H,R),assertz(m5_live_ref(R)),m5_assert_first(T,Rs).
m5_erase_refs([]).
m5_erase_refs([R|Rs]) :- retractall(m5_live_ref(R)),erase(R),m5_erase_refs(Rs).
m5_plain_all([],_,[]).
m5_plain_all([H|T],D,P) :- mi(H,D,PH),m5_plain_all(T,D,PT),app(PH,PT,P).
${interpreter('m5_db', 'm5_derive(H,_,_,[assumption(H)],proved) :- m5_live_ref(R),clause(H,true,R),!.')}
${interpreter('m5_compiled', 'm5_derive(H,_,Case,[assumption(H)],proved) :- m5_table(Case,A),m5_has(H,A),!.')}
`;

export const prepareCases = (engine) =>
  CASES.map((c) => {
    const result = once(engine, `${prepare(c)},${text('Heads', 'H')},${text('Assumptions', 'A')}.`);
    const heads = String(result.H),
      assumptions = String(result.A);
    if (result.success !== true || !heads.startsWith('[') || !assumptions.startsWith('['))
      throw new Error(`unprepared ${c.document}:${c.sentence}`);
    return { ...c, heads, assumptions };
  });
export const caseId = (c) => `case(${atom(c.document)},${c.sentence})`;
export const compiledTable = (cases) =>
  ':- dynamic(m5_table/2).\n' +
  cases.map((c) => `m5_table(${caseId(c)},${c.assumptions}).`).join('\n') +
  '\n' +
  PREDICATES.map(([p, a]) => {
    const h = `${p}(${Array.from({ length: a }, (_, i) => `A${i}`).join(',')})`;
    return `${h} :- m5_table(_,As),m5_has(${h},As).`;
  }).join('\n');

export const makeMechanisms = async () => {
  const image = await buildProbeImage(`${MECHANISM_SOURCE}\n:- dynamic(m5_table/2).`);
  const d = await loadEngine(image);
  const cases = prepareCases(d.engine);
  const b = await loadEngine(image);
  const e = await loadEngine(image);
  const f = await loadEngine(image);
  once(b.engine, 'm5_enable_dynamic.');
  once(e.engine, 'm5_enable_dynamic.');
  once(f.engine, 'm5_enable_dynamic.');
  const tableImage = await buildProbeImage(`${MECHANISM_SOURCE}\n${compiledTable(cases)}`);
  const c = await loadEngine(tableImage);
  return { cases, image, tableImage, a: d, b, c, d, e, f };
};

export const allGoals = (c) => `m5_call_all(${c.heads})`;
export const scopedGoal = (mechanism, c, inner) => {
  if (mechanism === 'b')
    return `setup_call_cleanup(m5_assert(${c.assumptions},Refs),(${inner}),m5_erase_refs(Refs))`;
  if (mechanism === 'e') return `snapshot((m5_assert_first(${c.assumptions},_Refs),${inner}))`;
  if (mechanism === 'f')
    return `setup_call_cleanup(m5_assert_first(${c.assumptions},Refs),(${inner}),m5_erase_refs(Refs))`;
  return inner;
};
export const proofGoal = (mechanism, c, cap = 4) => {
  const goal =
    mechanism === 'a'
      ? `m5_plain_all(${c.heads},${cap},P)`
      : mechanism === 'b' || mechanism === 'e' || mechanism === 'f'
        ? `m5_db_all(${c.heads},${cap},[],P)`
        : mechanism === 'c'
          ? `m5_compiled_all(${c.heads},${cap},${caseId(c)},P)`
          : `m5_all(${c.heads},${cap},${c.assumptions},P)`;
  return scopedGoal(mechanism, c, goal);
};
export const answerGoal = (mechanism, c, cap = 4) =>
  mechanism === 'a'
    ? `m5_call_all(${c.assumptions}),${allGoals(c)}`
    : mechanism === 'd'
      ? `m5_all(${c.heads},${cap},${c.assumptions},_)`
      : scopedGoal(mechanism, c, allGoals(c));

export const bounded = (engine, goal, depth = 100, inferences = 100000, after = '') =>
  once(
    engine,
    `(catch(call_with_inference_limit(call_with_depth_limit(once((${goal})),${depth},Depth),${inferences},Inf),error(resource_error(stack),_),Inf=stack) -> ` +
      `(Inf==inference_limit_exceeded -> State=inferences ; Inf==stack -> State=stack ; Depth==depth_limit_exceeded -> State=depth ; State=proved) ; State=failed)` +
      (after === '' ? '.' : `,(State==proved -> (${after}) ; true).`),
  );
