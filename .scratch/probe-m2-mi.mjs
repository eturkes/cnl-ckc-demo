// M2 precondition probe: can the SHIPPED saved state derive a live proof?
// Boots kb.pvm exactly as the runtime does, then asks four questions:
//   P1 clause/2 access on a static multifile schema predicate
//   P2 a vanilla meta-interpreter proves a real catalog goal
//   P3 derived sentence(Doc,S) multiset vs the committed trace
//   P4 cost: plain query vs first-solution proof vs all-solution proof
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
console.log('boot diagnostics:', JSON.stringify(drain()));

const once = (g) => {
  try {
    return { ok: true, v: engine.prolog.query(g).once() };
  } catch (e) {
    return { ok: false, v: String(e) };
  }
};
const timed = (label, g) => {
  const t0 = performance.now();
  const r = once(g);
  const ms = performance.now() - t0;
  console.log(`${label}: ${ms.toFixed(1)}ms`, r.ok ? JSON.stringify(r.v).slice(0, 300) : r.v.slice(0, 300));
  return { ms, ...r };
};

// P1 — static predicate clause access.
timed(
  'P1 clause/2',
  "catch((clause(guideline_entity(actual,I,recommendation,countable),B),term_string(B,S,[quoted(true)])),E,(S='ERR',term_string(E,S2))),(var(S2)->S2='';true).",
);
timed('P1 dynamic?', 'predicate_property(guideline_entity(_,_,_,_),dynamic) -> R = yes ; R = no.');
timed('P1 nclauses', 'predicate_property(guideline_entity(_,_,_,_),number_of_clauses(N)).');
timed(
  'P1 clause/3 props',
  "clause(guideline_entity(actual,_,recommendation,countable),_,R),findall(P,(member(P0,[file(_),line_count(_),size(_),predicate(_)]),catch(clause_property(R,P0),_,fail),P=P0),Ps),term_string(Ps,S).",
);

// P2 — meta-interpreter, consulted into the loaded state.
const MI = `
:- dynamic mi_node/0.
mi(true,[]) :- !.
mi((A,B),P) :- !, mi(A,PA), mi(B,PB), append(PA,PB,P).
mi(H,[n(H,Sub)|[]]) :- clause(H,B), mi(B,Sub).
sent(T,S) :- sub_term(S,T), nonvar(S), S = '$guideline_id'(_,_,_,_,_), !.
nodesents([],[]).
nodesents([n(H,Sub)|T],[s(D,N)-Kids|R]) :-
  ( sent(H,'$guideline_id'(_,D,N,_,_)) -> true ; D = none, N = 0 ),
  nodesents(Sub,Kids), nodesents(T,R).
`;
engine.FS.writeFile('mi.pl', MI);
once("consult('mi.pl').");
console.log('consult diagnostics:', JSON.stringify(drain()));
timed('P2 mi loaded', 'predicate_property(mi(_,_),number_of_clauses(N)).');

const GOAL =
  "guideline_entity(actual,A,'dosage-reduction',countable),guideline_cardinality(actual,A,na,eq,1),guideline_event(actual,B,have),guideline_arg(actual,B,1,A),guideline_arg(actual,B,2,C)";

// P4 — cost comparison.
timed('P4 plain all', `findall(C,(${GOAL}),Cs),length(Cs,N).`);
timed('P4 mi first', `once((mi((${GOAL}),P),nodesents(P,S0),term_string(S0,S,[quoted(true)]))).`);
timed('P4 mi all', `findall(S,(mi((${GOAL}),P),nodesents(P,S)),Ss),length(Ss,N).`);

// P3 — derived sentence multiset for every solution, flattened.
const r = once(
  `findall(Flat,(mi((${GOAL}),P),findall(D-N,(sub_term(T,P),nonvar(T),T=n(H,_),sent(H,'$guideline_id'(_,D,N,_,_))),Flat)),All),term_string(All,S,[quoted(true)]).`,
);
console.log('P3 derived:', r.ok ? String(r.v['S']).slice(0, 900) : r.v.slice(0, 300));
console.log('trailing diagnostics:', JSON.stringify(drain()));
