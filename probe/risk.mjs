import { performance } from 'node:perf_hooks';
import { boot } from './lib.mjs';

const { engine, diagnostics } = await boot();
const goal =
  `current_prolog_flag(stack_limit,Old),` +
  `setup_call_cleanup(set_prolog_flag(stack_limit,67108864),` +
  `catch(call_with_inference_limit(call_with_depth_limit(repeat,1000,D),100000,I),` +
  `error(resource_error(stack),_),Stack=tripped),` +
  `set_prolog_flag(stack_limit,Old)),` +
  `(Stack==tripped->Outcome=stack_limit_exceeded;` +
  `D==depth_limit_exceeded->Outcome=depth_limit_exceeded;` +
  `I==inference_limit_exceeded->Outcome=inference_limit_exceeded;Outcome=success)`;
const iterator = engine.prolog.query(`${goal}.`)[Symbol.iterator]();
const cap = 100000;
const depths = new Set();
const inferences = new Set();
const outcomes = new Set();
let timerFired = false;
let timerFiredAt;
const start = performance.now();
const timerDone = new Promise((resolve) => {
  setTimeout(() => {
    timerFired = true;
    timerFiredAt = performance.now();
    resolve();
  }, 10);
});
for (let count = 0; count < cap; count += 1) {
  const step = iterator.next();
  if (step.done === true || step.value === undefined) throw new Error(`wrapper stopped at ${count}`);
  depths.add(step.value.D);
  inferences.add(step.value.I);
  outcomes.add(step.value.Outcome);
}
const capReachedAt = performance.now();
const timerObservedBeforeCap = timerFired;
await timerDone;
console.log(`external_cap=${cap}`);
console.log(`solutions_before_any_limit=${cap}`);
console.log(`depth_outcomes=${[...depths].join(',')}`);
console.log(`inference_outcomes=${[...inferences].join(',')}`);
console.log(`typed_outcomes=${[...outcomes].join(',')}`);
console.log(`cap_elapsed_ms=${(capReachedAt - start).toFixed(3)}`);
console.log(`timer_fired_before_cap=${timerObservedBeforeCap}`);
console.log(`timer_fired_at_ms=${(timerFiredAt - start).toFixed(3)}`);
console.log(`diagnostics=${diagnostics.length}`);
