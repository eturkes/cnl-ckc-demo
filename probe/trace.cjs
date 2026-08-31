const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const loadImageDefault = require('swipl-wasm/dist/loadImageDefault').default;

const image = fs.readFileSync(path.join(__dirname, 'kb.pvm'));
const querySource = fs.readFileSync(path.resolve(__dirname, '../../../kb/data/guidelines/cdc-2022-opioid/queries/pl/category-a-recommendations.pl'), 'utf8');
const tracerSource = String.raw`
trace_allowed(guideline_entity/4).
trace_allowed(guideline_cardinality/5).
trace_allowed(guideline_event/3).
trace_allowed(guideline_arg/4).
trace_allowed(guideline_pp/4).
trace_allowed(guideline_property/4).
trace_allowed(guideline_operator/3).
trace_mi((A,B), Nodes) :- !, trace_mi(A, NA), trace_mi(B, NB), trace_append(NA, NB, Nodes).
trace_append([], Tail, Tail).
trace_append([Head|Rest], Tail, [Head|Joined]) :- trace_append(Rest, Tail, Joined).
trace_mi(\+ A, [naf(A)]) :- !, \+ trace_mi(A, _).
trace_solution(Goal, Nodes) :- trace_mi(Goal, Skels), trace_materialize(Skels, Nodes).
trace_mi(Goal, [node0(Ref, Children)]) :-
  functor(Goal, Name, Arity), trace_allowed(Name/Arity),
  clause(user:Goal, Body, Ref), trace_body(Body, Children).
trace_body(true, []) :- !.
trace_body(Body, Children) :- trace_mi(Body, Children).
trace_materialize([], []).
trace_materialize([naf(Goal)|Skels], [naf(Goal)|Nodes]) :- trace_materialize(Skels, Nodes).
trace_materialize([node0(Ref, ChildSkels)|Skels], [clause(sentence(Doc,S),predicate(Name/Arity),source(File,Line),Children)|Nodes]) :-
  clause(user:Head, Body, Ref), functor(Head, Name, Arity), trace_identity(Head, Body, Doc, S),
  (clause_property(Ref, file(File0)) -> File=File0 ; File=none),
  (clause_property(Ref, line_count(Line0)) -> Line=Line0 ; Line=0),
  trace_materialize(ChildSkels, Children), trace_materialize(Skels, Nodes).
trace_identity(Head, Body, Doc, S) :-
  findall(D-Sx, trace_id_sub((Head:-Body), D, Sx), Raw), sort(Raw, [Doc-S]).
trace_id_sub(Term, Doc, S) :-
  nonvar(Term), Term='$guideline_id'(Role,Doc,S,_,_), trace_role(Role), atom(Doc), integer(S), S>0.
trace_id_sub(Term, Doc, S) :-
  compound(Term), functor(Term, _, Arity), between(1, Arity, Index), arg(Index, Term, Child), trace_id_sub(Child, Doc, S).
trace_role(context).
trace_role(product).
trace_role(witness).
`;

function collect(module, goal) {
  const query = module.prolog.query(goal);
  const rows = [];
  for (;;) {
    const step = query.next();
    if (step.value) rows.push(step.value);
    if (step.done) break;
  }
  return rows;
}

(async () => {
  const module = await loadImageDefault(image)({ arguments: ['-q'], print() {}, printErr() {} });
  await module.prolog.load_string(querySource, '/queries/category-a-recommendations.pl');
  await module.prolog.load_string(tracerSource, '/runtime/tracer.pl');
  const nativeGoal = "'$guideline_query_projection'(goal(G),answers([answer(A,_)])),call(G),term_string(A,Answer,[quoted(true),numbervars(true)]).";
  const traceGoal = "'$guideline_query_projection'(goal(G),answers([answer(A,_)])),trace_solution(G,Nodes),term_string(A,Answer,[quoted(true),numbervars(true)]),term_string(Nodes,Trace,[quoted(true),numbervars(true)]).";
  const runs = [];
  for (let i = 0; i < 5; i += 1) {
    let start = performance.now();
    const nativeRows = collect(module, nativeGoal);
    const nativeMs = performance.now() - start;
    start = performance.now();
    const traceRows = collect(module, traceGoal);
    const traceMs = performance.now() - start;
    runs.push({ nativeMs, traceMs, nativeCount: nativeRows.length, traceCount: traceRows.length });
    if (i === 0) {
      runs[0].nativeAnswers = nativeRows.map((row) => row.Answer);
      runs[0].traceAnswers = traceRows.map((row) => row.Answer);
      runs[0].firstTrace = traceRows[0]?.Trace;
    }
  }
  const interception = module.prolog.query('current_predicate(prolog_trace_interception/4),predicate_property(prolog_trace_interception(_,_,_,_),Prop).').once();
  console.log(JSON.stringify({ runs, interception }));
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
