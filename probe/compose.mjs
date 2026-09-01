import { all, boot, categoryA, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
once(
  engine,
  'dynamic(probe_recur/1),retractall(probe_recur(_)),assertz(probe_recur(0)),assertz((probe_recur(N):-N>0,M is N-1,probe_recur(M)))',
);
const initial = once(engine, 'current_prolog_flag(stack_limit,N)').N;
const wrapped = (goal, { stack = 67108864, depth = 1000, inferences = 100000 } = {}) =>
  `current_prolog_flag(stack_limit,Old),` +
  `setup_call_cleanup(set_prolog_flag(stack_limit,${stack}),` +
  `catch(call_with_inference_limit(call_with_depth_limit((${goal}),${depth},D),${inferences},I),` +
  `error(resource_error(stack),_),Stack=tripped),` +
  `set_prolog_flag(stack_limit,Old)),` +
  `(Stack==tripped->Outcome=stack_limit_exceeded;` +
  `D==depth_limit_exceeded->Outcome=depth_limit_exceeded;` +
  `I==inference_limit_exceeded->Outcome=inference_limit_exceeded;Outcome=success)`;
const probes = {
  success: all(engine, wrapped(categoryA)),
  stack: all(engine, wrapped('length(_,100000000)', { stack: 8388608, depth: 100000, inferences: 1000000 })),
  depth: all(engine, wrapped('probe_recur(100)', { depth: 5, inferences: 1000000 })),
  inference: all(engine, wrapped('probe_recur(1000)', { depth: 10000, inferences: 10 })),
  collision: all(engine, wrapped('probe_recur(1000)', { depth: 5, inferences: 10 })),
};
for (const [name, answers] of Object.entries(probes)) {
  console.log(`${name}_solutions=${answers.length}`);
  console.log(`${name}_outcomes=${answers.map(({ Outcome }) => Outcome).join(',')}`);
}
const restored = once(engine, 'current_prolog_flag(stack_limit,N)').N;
console.log(`stack_limit_initial=${initial}`);
console.log(`stack_limit_after=${restored}`);
console.log(`documents_after=${once(engine, 'findall(X,guideline_document(X,_,_),L),length(L,N)').N}`);
console.log(`category_after=${once(engine, `findall(1,(${categoryA}),L),length(L,N)`).N}`);
console.log(`diagnostics=${diagnostics.length}`);
