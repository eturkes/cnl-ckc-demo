import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const catalog = JSON.parse(readFileSync('kb/generated/question-catalog.json', 'utf8')).entries;
const diagnostics = [];
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(module) => module.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (line) => diagnostics.push(line),
  on_output: (text, stream) => {
    if (stream === 'stderr') diagnostics.push(text);
  },
});
const once = (goal) => {
  const query = engine.prolog.query(goal);
  try {
    return query.once();
  } finally {
    query.close?.();
  }
};
const MI = `
resolve(guideline_arg(A,B,C,D),Body) :- clause(guideline_arg(A,B,C,D),Body).
resolve(guideline_cardinality(A,B,C,D,E),Body) :- clause(guideline_cardinality(A,B,C,D,E),Body).
resolve(guideline_document(A,B,C),Body) :- clause(guideline_document(A,B,C),Body).
resolve(guideline_entity(A,B,C,D),Body) :- clause(guideline_entity(A,B,C,D),Body).
resolve(guideline_event(A,B,C),Body) :- clause(guideline_event(A,B,C),Body).
resolve(guideline_operator(A,B,C),Body) :- clause(guideline_operator(A,B,C),Body).
resolve(guideline_pp(A,B,C,D),Body) :- clause(guideline_pp(A,B,C,D),Body).
resolve(guideline_property(A,B,C,D),Body) :- clause(guideline_property(A,B,C,D),Body).
resolve(guideline_schema_version(A),Body) :- clause(guideline_schema_version(A),Body).
app([],L,L).
app([H|T],L,[H|R]) :- app(T,L,R).
mi(true,_,[]) :- !.
mi((A,B),D,P) :- !, mi(A,D,PA), mi(B,D,PB), app(PA,PB,P).
mi(_,0,_) :- !, fail.
mi(H,D,[node(H,B,Sub)]) :- D > 0, D1 is D-1, resolve(H,B), mi(B,D1,Sub).
gid(T,D,S) :- nonvar(T), T = '$guideline_id'(_,D,S,_,_), !.
gid(T,D,S) :- nonvar(T), compound(T), functor(T,_,N), gid_args(N,T,D,S).
gid_args(N,T,D,S) :- N > 0, arg(N,T,A), gid(A,D,S), !.
gid_args(N,T,D,S) :- N > 1, N1 is N-1, gid_args(N1,T,D,S).
proof_sentences([],[]).
proof_sentences([node(H,_,Sub)|Rest],[sentence(D,S)|Tail]) :- gid(H,D,S), !, proof_sentences(Sub,Kids), proof_sentences(Rest,Siblings), app(Kids,Siblings,Tail).
proof_sentences([node(_,_,Sub)|Rest],Tail) :- proof_sentences(Sub,Kids), proof_sentences(Rest,Siblings), app(Kids,Siblings,Tail).
trace_sentences([],[]).
trace_sentences([clause(sentence(D,S),_,_)|Rest],[sentence(D,S)|Tail]) :- trace_sentences(Rest,Tail).
trace_solutions([],[]).
trace_solutions([sol(V,proved(Nodes))|Rest],[row(V,Sents)|Tail]) :- trace_sentences(Nodes,Sents), trace_solutions(Rest,Tail).
trace_rows(Id,Rows) :- '$guideline_traces'(v1,Id,_,_,result(solutions(Solutions))), trace_solutions(Solutions,Rows).
trace_rows(Id,[row([],Sents)]) :- '$guideline_traces'(v1,Id,_,_,result(yes(proved(Nodes)))), trace_sentences(Nodes,Sents).
`;
const traceIds = [
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
];
const traceRoot = '../../kb/data/guidelines/cdc-2022-opioid/queries/traces';
const traces = traceIds.map((id) => readFileSync(`${traceRoot}/${id}.pl`, 'utf8')).join('\n');
engine.FS.writeFile('m2-mi.pl', MI);
engine.FS.writeFile('oracles.pl', traces);
once("consult('m2-mi.pl').");
once("consult('oracles.pl').");
if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));

const OPTIONS = '[quoted(true),numbervars(true),ignore_ops(true),max_depth(0)]';
const projection = (entry) => `[${entry.projection.map(({ variable }) => variable).join(',')}]`;
const timed = (goal) => {
  const started = performance.now();
  const result = once(goal);
  return { result, ms: performance.now() - started };
};
const sample = (goal, runs = 7) => {
  once(goal);
  const times = [];
  let result;
  for (let run = 0; run < runs; run += 1) {
    const measured = timed(goal);
    result = measured.result;
    times.push(measured.ms);
  }
  times.sort((a, b) => a - b);
  return {
    result,
    runs,
    median: Number(times[Math.floor(times.length / 2)].toFixed(3)),
    min: Number(times[0].toFixed(3)),
    max: Number(times.at(-1).toFixed(3)),
  };
};

for (const id of traceIds) {
  const entry = catalog.find((candidate) => candidate.id === id);
  const derivedGoal = id === 'recommendation-exists'
    ? `once((mi((${entry.goal}),1,P),proof_sentences(P,Sents)))`
    : `mi((${entry.goal}),1,P),proof_sentences(P,Sents)`;
  const actual = once(`findall(row(${projection(entry)},Sents),(${derivedGoal}),Rows),term_string(Rows,S,${OPTIONS}).`).S;
  const expected = once(`trace_rows('${id}',Rows),term_string(Rows,S,${OPTIONS}).`).S;
  console.log(JSON.stringify({ type: 'oracle', id, equal: String(actual) === String(expected), actual, expected }));
}

for (const entry of catalog) {
  const values = once(`findall(S,((${entry.goal}),term_string(${projection(entry)},S,${OPTIONS})),Values).`).Values;
  const proofs = once(`findall(S,(mi((${entry.goal}),1,P),term_string(P,S,${OPTIONS})),Proofs).`).Proofs;
  const slots = [];
  const count = entry.projection.length === 0 ? 1 : values.length;
  for (let index = 0; index < count; index += 1) {
    const bind = `term_string(${projection(entry)},${JSON.stringify(String(values[index]))})`;
    const goal = `${bind},once(mi((${entry.goal}),1,P)),term_string(P,S,${OPTIONS}).`;
    const measured = sample(goal);
    slots.push({
      slot: index + 1,
      value: String(values[index]),
      sameProof: String(measured.result.S) === String(proofs[index]),
      ms: { runs: measured.runs, median: measured.median, min: measured.min, max: measured.max },
    });
  }
  console.log(JSON.stringify({ type: 'slots', id: entry.id, allProofCount: proofs.length, selectedCount: count, slots }));
}
