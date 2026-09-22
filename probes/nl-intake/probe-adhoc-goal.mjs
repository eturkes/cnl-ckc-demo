// Feasibility probe: what does a RUNTIME-CONSTRUCTED goal actually return from the
// shipped image? This is the question behind a free-text intake that compiles to a
// query rather than to one of 7 curated topic keys.
//
// Must live inside the project tree: `swipl-wasm` resolves from `node_modules`.
//   node .scratch/probe-adhoc-goal.mjs
//
// Raw `engine.prolog.query` runs in module `system`, so every helper compiled into the
// image needs a `user:` prefix; the shipped path gets that from `wrapGoal`.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const factory = createRequire(import.meta.url)('swipl-wasm/dist/loadImageDefault.js');
const load = typeof factory === 'function' ? factory : factory.default;

const engine = await load(new Uint8Array(readFileSync('kb/generated/kb.pvm')))({
  arguments: ['-q'],
});

const run = (label, goal, cap = 3) => {
  const started = Date.now();
  const rows = [];
  let raised;
  try {
    for (const solution of engine.prolog.query(goal)) {
      // swipl-wasm yields undefined for an errored step; a real solution is an object.
      if (solution === undefined || solution === null) break;
      rows.push(JSON.stringify(solution).slice(0, 180));
      if (rows.length >= cap) break;
    }
  } catch (cause) {
    raised = String(cause).replace(/\s+/gu, ' ').slice(0, 140);
  }
  console.log(`\n### ${label}  [${Date.now() - started} ms]`);
  if (raised !== undefined) console.log(`  RAISED ${raised}`);
  else if (rows.length === 0) console.log('  (no solutions)');
  else for (const row of rows) console.log(`  ${row}`);
};

console.log('=== 1. calling the schema predicates on the bare image ===');
run('entity by exact name', "guideline_entity(W,A,'naloxone-coprescribing',C).");
run('operator in world actual', 'guideline_operator(actual,C,should).');

console.log('\n=== 2. the clause DATABASE is reachable where the call is not ===');
run('clause/2 finds the same entity', "clause(guideline_entity(W,A,'naloxone-coprescribing',C),B).", 2);
run(
  'entity name census off clause heads',
  'findall(N,clause(guideline_entity(_,_,N,_),_),L),length(L,Heads),sort(L,U),length(U,Distinct).',
  1,
);
run(
  'AD-HOC JOIN: what does a taper event take as its argument',
  'clause(guideline_event(W,E,taper),_),clause(guideline_arg(W,E,Role,A),_),clause(guideline_entity(W,A,Name,_),_).',
  4,
);

console.log('\n=== 3. the meta-interpreter, and premises as the query-local context ===');
run('mi/3 on the shipped clinical goal', "user:mi(clinical_advice('opioid-safety',S,A),1,P).", 1);
run('the shipped clinical derivation', "user:clinical_derive('cdc2022-opioid-rec01',3,Rule,P).", 1);
run(
  'premises make a should-operator derive',
  'user:derive(guideline_operator(actual,C,should),3,' +
    '[guideline_entity(actual,hyp,clinician,countable),' +
    'guideline_cardinality(actual,hyp,clinician,countable,(na eq 1))],P,S).',
  2,
);

console.log('\n=== 4. hallucination controls: what a WRONG query does ===');
run('unknown predicate', 'guideline_treatment(W,X,Y).');
run('wrong arity', 'guideline_entity(W,A,N).');
run('unknown constant, right shape', "clause(guideline_entity(W,A,'zz-not-a-concept',C),B).");
run('unknown topic key on the shipped goal', "user:clinical_advice('zz-not-a-topic',S,A).");

process.exit(0);
