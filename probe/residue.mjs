import { all, boot, categoryA, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
once(
  engine,
  'dynamic(probe_recur/1),retractall(probe_recur(_)),assertz(probe_recur(0)),assertz((probe_recur(N):-N>0,M is N-1,probe_recur(M)))',
);
const wrapped = (goal, { stack = 67108864, depth = 1000, inferences = 100000 } = {}) =>
  `current_prolog_flag(stack_limit,Old),` +
  `setup_call_cleanup(set_prolog_flag(stack_limit,${stack}),` +
  `catch(call_with_inference_limit(call_with_depth_limit((${goal}),${depth},D),${inferences},I),` +
  `error(resource_error(stack),_),Stack=tripped),` +
  `set_prolog_flag(stack_limit,Old)),` +
  `(Stack==tripped->Outcome=stack_limit_exceeded;` +
  `D==depth_limit_exceeded->Outcome=depth_limit_exceeded;` +
  `I==inference_limit_exceeded->Outcome=inference_limit_exceeded;Outcome=success)`;
const state = () => ({
  documents: once(engine, 'findall(X,guideline_document(X,_,_),L),length(L,N)').N,
  answers: once(engine, `findall(1,(${categoryA}),L),length(L,N)`).N,
  stackLimit: once(engine, 'current_prolog_flag(stack_limit,N)').N,
});
const cases = [
  ['stack', wrapped('length(_,100000000)', { stack: 8388608, depth: 100000, inferences: 1000000 })],
  ['depth', wrapped('probe_recur(100)', { depth: 5, inferences: 1000000 })],
  ['inference', wrapped('probe_recur(1000)', { depth: 10000, inferences: 10 })],
];
for (const [name, goal] of cases) {
  const outcomes = all(engine, goal).map(({ Outcome }) => Outcome);
  const after = state();
  console.log(`${name}_outcome=${outcomes.join(',')}`);
  console.log(`${name}_after=${after.documents}docs,${after.answers}answers,stack=${after.stackLimit}`);
}
const missingWallclock = once(
  engine,
  "catch(call_with_time_limit(0.001,true),E,true),E=error(existence_error(procedure,_),_)",
);
const afterMissing = state();
console.log(`wallclock_available=${missingWallclock.success !== true}`);
console.log(`wallclock_probe_after=${afterMissing.documents}docs,${afterMissing.answers}answers,stack=${afterMissing.stackLimit}`);
console.log(`diagnostics=${diagnostics.length}`);
