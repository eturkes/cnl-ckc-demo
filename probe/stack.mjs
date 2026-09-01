import { performance } from 'node:perf_hooks';
import { boot, categoryA, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
const initial = once(engine, 'current_prolog_flag(stack_limit,N)').N;
const samples = [];
let exact;
for (let trial = 0; trial < 5; trial += 1) {
  const start = performance.now();
  const result = once(
    engine,
    "set_prolog_flag(stack_limit,8388608),catch(length(_,100000000),E,(term_string(E,S,[quoted(true),numbervars(true),ignore_ops(true)]),atom_string(Exact,S),E=error(resource_error(stack),_)->Kind=resource_error_stack;Kind=other_error))",
  );
  samples.push(performance.now() - start);
  exact ??= result.Exact;
  if (result.Kind !== 'resource_error_stack') throw new Error(`unexpected stack result: ${result.Kind}`);
}
const lowered = once(engine, 'current_prolog_flag(stack_limit,N)').N;
const documents = once(engine, 'findall(X,guideline_document(X,_,_),L),length(L,N)').N;
const categoryCount = once(engine, `findall(1,(${categoryA}),L),length(L,N)`).N;
once(engine, `set_prolog_flag(stack_limit,${initial})`);
const restored = once(engine, 'current_prolog_flag(stack_limit,N)').N;
const ordered = [...samples].sort((a, b) => a - b);
console.log(`stack_limit_initial=${initial}`);
console.log(`stack_limit_lowered=${lowered}`);
console.log(`outcome=${exact}`);
console.log(`trip_ms=${samples.map((n) => n.toFixed(3)).join(',')}`);
console.log(`trip_median_ms=${ordered[2].toFixed(3)}`);
console.log(`post_trip_documents=${documents}`);
console.log(`post_trip_category_solutions=${categoryCount}`);
console.log(`stack_limit_restored=${restored}`);
console.log(`diagnostics=${diagnostics.length}`);
