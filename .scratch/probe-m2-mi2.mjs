// M2 probe 2: characterise the naive meta-interpreter blow-up on the shipped image.
// No library is present in swipl-bundle-no-data, so the MI is self-contained and
// depth-bounded; the goal recorded at the depth cap names the recursion.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const diagnostics = [];
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(m) => m.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (l) => diagnostics.push(l),
  on_output: (t, s) => {
    if (s === 'stderr') diagnostics.push(t);
  },
});
const drain = () => diagnostics.splice(0).join('\n');
const once = (g) => {
  const t0 = performance.now();
  try {
    return { ms: performance.now() - t0, v: engine.prolog.query(g).once() };
  } catch (e) {
    return { ms: performance.now() - t0, err: String(e) };
  }
};
const show = (label, g, cap = 400) => {
  const r = once(g);
  console.log(`${label}: ${r.ms.toFixed(1)}ms`, (r.err ?? JSON.stringify(r.v)).slice(0, cap));
  return r;
};

show('flag unknown', 'current_prolog_flag(unknown,X).');
show('has append/3', 'current_predicate(append/3) -> R=yes ; R=no.');
show('has autoload', 'current_prolog_flag(autoload,X).');

const MI = `
app([],L,L).
app([H|T],L,[H|R]) :- app(T,L,R).
d(true,_,[]) :- !.
d((A,B),D,P) :- !, d(A,D,PA), d(B,D,PB), app(PA,PB,P).
d(_,0,[cap]) :- !.
d(H,D,[n(H,Sub)]) :- D > 0, D1 is D-1, clause(H,B), d(B,D1,Sub).
depth([],0).
depth([cap|_],1000000) :- !.
depth([n(_,S)|T],M) :- depth(S,A), depth(T,B), A1 is A+1, (A1 > B -> M = A1 ; M = B).
capped(P) :- sub_term(cap,P), !.
`;
engine.FS.writeFile('mi.pl', MI);
once("consult('mi.pl').");
console.log('consult diagnostics:', JSON.stringify(drain()));
show('mi clauses', 'predicate_property(d(_,_,_),number_of_clauses(N)).');
show('sub_term?', 'current_predicate(sub_term/2) -> R=yes ; R=no.');

const GOAL =
  "guideline_entity(actual,A,'dosage-reduction',countable),guideline_cardinality(actual,A,na,eq,1),guideline_event(actual,B,have),guideline_arg(actual,B,1,A),guideline_arg(actual,B,2,C)";

for (const cap of [3, 5, 8, 12, 20]) {
  show(`depth<=${cap} first`, `once((d((${GOAL}),${cap},P),depth(P,M),term_string(P,S,[quoted(true),max_depth(0)]))),string_length(S,L).`, 220);
}

// Which single subgoal explodes?
const subs = [
  "guideline_entity(actual,A,'dosage-reduction',countable)",
  'guideline_cardinality(actual,A,na,eq,1)',
  'guideline_event(actual,B,have)',
  'guideline_arg(actual,B,1,A)',
];
for (const s of subs) show(`sub d<=12 ${s.slice(0, 34)}`, `once((d((${s}),12,P),depth(P,M))).`, 160);

// Clause-shape census: how many clauses of each schema predicate are rules, not facts?
for (const p of ['guideline_entity(_,_,_,_)', 'guideline_cardinality(_,_,_,_,_)', 'guideline_event(_,_,_)', 'guideline_arg(_,_,_,_)', 'guideline_operator(_,_,_)']) {
  show(`rules ${p.split('(')[0]}`, `findall(1,(clause(${p},B),B \\== true),Rs),length(Rs,R),findall(1,clause(${p},_),As),length(As,N).`, 160);
}
console.log('trailing diagnostics:', JSON.stringify(drain()));
