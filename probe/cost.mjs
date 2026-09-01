import { performance } from 'node:perf_hooks';
import { all, boot, categoryA } from './lib.mjs';

const { engine, diagnostics } = await boot();
const plainGoal = `(${categoryA})`;
const wrappedGoal =
  `current_prolog_flag(stack_limit,Old),` +
  `setup_call_cleanup(set_prolog_flag(stack_limit,67108864),` +
  `catch(call_with_inference_limit(call_with_depth_limit((${categoryA}),1000,D),100000,I),` +
  `error(resource_error(stack),_),Stack=tripped),` +
  `set_prolog_flag(stack_limit,Old)),` +
  `(Stack==tripped->Outcome=stack_limit_exceeded;` +
  `D==depth_limit_exceeded->Outcome=depth_limit_exceeded;` +
  `I==inference_limit_exceeded->Outcome=inference_limit_exceeded;Outcome=success)`;
for (let warmup = 0; warmup < 3; warmup += 1) {
  all(engine, plainGoal);
  all(engine, wrappedGoal);
}
const runs = 30;
const plainMs = [];
const wrappedMs = [];
const pairedDiffs = [];
const timed = (goal) => {
  const start = performance.now();
  const answers = all(engine, goal);
  const elapsed = performance.now() - start;
  if (answers.length !== 7) throw new Error(`expected 7 answers, got ${answers.length}`);
  return elapsed;
};
for (let run = 0; run < runs; run += 1) {
  let plain;
  let wrapped;
  if (run % 2 === 0) {
    plain = timed(plainGoal);
    wrapped = timed(wrappedGoal);
  } else {
    wrapped = timed(wrappedGoal);
    plain = timed(plainGoal);
  }
  plainMs.push(plain);
  wrappedMs.push(wrapped);
  pairedDiffs.push(wrapped - plain);
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values) => {
  const ordered = [...values].sort((a, b) => a - b);
  return (ordered[(ordered.length - 1) >> 1] + ordered[ordered.length >> 1]) / 2;
};
const plainMean = mean(plainMs);
const wrappedMean = mean(wrappedMs);
console.log(`runs_per_arm=${runs}`);
console.log(`plain_mean_ms=${plainMean.toFixed(3)}`);
console.log(`wrapped_mean_ms=${wrappedMean.toFixed(3)}`);
console.log(`mean_overhead_ms=${(wrappedMean - plainMean).toFixed(3)}`);
console.log(`mean_overhead_percent=${(((wrappedMean / plainMean) - 1) * 100).toFixed(2)}`);
console.log(`plain_median_ms=${median(plainMs).toFixed(3)}`);
console.log(`wrapped_median_ms=${median(wrappedMs).toFixed(3)}`);
console.log(`paired_median_overhead_ms=${median(pairedDiffs).toFixed(3)}`);
console.log(`diagnostics=${diagnostics.length}`);
