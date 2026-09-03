import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const catalog = JSON.parse(readFileSync('kb/generated/question-catalog.json', 'utf8')).entries;
const diagnostics = [];
const bootStarted = performance.now();
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(module) => module.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (line) => diagnostics.push(line),
  on_output: (text, stream) => {
    if (stream === 'stderr') diagnostics.push(text);
  },
});
const bootMs = performance.now() - bootStarted;

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
`;
engine.FS.writeFile('m2-mi.pl', MI);

const once = (goal) => {
  const query = engine.prolog.query(goal);
  try {
    return query.once();
  } finally {
    query.close?.();
  }
};
const consultStarted = performance.now();
const consultResult = once("consult('m2-mi.pl').");
const consultMs = performance.now() - consultStarted;
if (diagnostics.length > 0) throw new Error(`diagnostics: ${diagnostics.join('\n')}`);

const OPTIONS = '[quoted(true),numbervars(true),ignore_ops(true),max_depth(0)]';
const projection = (entry) => `[${entry.projection.map(({ variable }) => variable).join(',')}]`;
const values = (entry, mi, cap = 1) => {
  const proof = mi ? `mi((${entry.goal}),${cap},_)` : `(${entry.goal})`;
  return once(`findall(S,(${proof},term_string(${projection(entry)},S,${OPTIONS})),Ss).`).Ss;
};
const multisetKey = (items) => JSON.stringify([...items].map(String).sort());
const sameMultiset = (left, right) => multisetKey(left) === multisetKey(right);
const capCount = (entry, cap, limit = 2_000_000) => {
  const started = performance.now();
  const result = once(
    `call_with_inference_limit((findall(1,mi((${entry.goal}),${cap},_),Xs),length(Xs,N)),${limit},Status).`,
  );
  return { cap, ms: performance.now() - started, status: result.Status, count: result.N ?? null };
};
const sample = (goal, runs = 7) => {
  once(goal);
  const values = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    once(goal);
    values.push(performance.now() - started);
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    runs,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted.at(-1),
  };
};
const rounded = (result) =>
  Object.fromEntries(Object.entries(result).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(3)) : value]));

console.log(JSON.stringify({ type: 'boot', engine: 'swipl-bundle-no-data + kb/generated/kb.pvm', bootMs: Number(bootMs.toFixed(3)), consultMs: Number(consultMs.toFixed(3)), consultResult }));
for (const entry of catalog) {
  const plain = values(entry, false);
  const caps = [];
  let minimum = null;
  for (let cap = 0; cap <= 1; cap += 1) {
    const count = capCount(entry, cap);
    if (count.status !== 'inference_limit_exceeded') {
      const derived = values(entry, true, cap);
      count.derived = derived;
      count.equal = sameMultiset(plain, derived);
      if (minimum === null && count.equal) minimum = cap;
    }
    caps.push(rounded(count));
  }
  if (minimum === null) {
    console.log(JSON.stringify({ type: 'incomplete', id: entry.id, plain, caps }));
    throw new Error(`${entry.id}: no complete cap found`);
  }
  const plainGoal = `findall(1,((${entry.goal})),Xs),length(Xs,N).`;
  const firstGoal = `once(mi((${entry.goal}),${minimum},_)).`;
  const allGoal = `findall(1,mi((${entry.goal}),${minimum},_),Xs),length(Xs,N).`;
  const derived = values(entry, true, minimum);
  console.log(JSON.stringify({
    type: 'goal',
    id: entry.id,
    provenance: entry.provenance,
    projection: projection(entry),
    plain,
    derived,
    equal: sameMultiset(plain, derived),
    minimum,
    caps,
    costMs: {
      plainAll: rounded(sample(plainGoal)),
      miFirst: rounded(sample(firstGoal)),
      miAll: rounded(sample(allGoal)),
    },
  }));
}
