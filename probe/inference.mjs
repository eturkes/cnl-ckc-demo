import { performance } from 'node:perf_hooks';
import { all, boot, categoryA, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
once(
  engine,
  'dynamic(probe_recur/1),retractall(probe_recur(_)),assertz(probe_recur(0)),assertz((probe_recur(N):-N>0,M is N-1,probe_recur(M)))',
);
const multi = all(engine, 'call_with_inference_limit((X=a;X=b;X=c),100,I)');
const exceeded = once(
  engine,
  'call_with_inference_limit(probe_recur(1000),10,I),term_string(I,S,[quoted(true),ignore_ops(true)]),atom_string(Outcome,S)',
);
const branchy = all(engine, 'call_with_inference_limit(((N=1;N=1000),probe_recur(N)),50,I)');
const plainGoal = `(${categoryA})`;
const boundedGoal = `call_with_inference_limit((${categoryA}),100000,I)`;
for (let warmup = 0; warmup < 3; warmup += 1) {
  all(engine, plainGoal);
  all(engine, boundedGoal);
}
const runs = 30;
const plainMs = [];
const boundedMs = [];
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
  let bounded;
  if (run % 2 === 0) {
    plain = timed(plainGoal);
    bounded = timed(boundedGoal);
  } else {
    bounded = timed(boundedGoal);
    plain = timed(plainGoal);
  }
  plainMs.push(plain);
  boundedMs.push(bounded);
  pairedDiffs.push(bounded - plain);
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values) => {
  const ordered = [...values].sort((a, b) => a - b);
  return (ordered[(ordered.length - 1) >> 1] + ordered[ordered.length >> 1]) / 2;
};
const plainMean = mean(plainMs);
const boundedMean = mean(boundedMs);
console.log(`multi_solutions=${multi.length}`);
console.log(`multi_values=${multi.map(({ X }) => X).join(',')}`);
console.log(`multi_outcomes=${multi.map(({ I }) => I).join(',')}`);
console.log(`exceeded=${exceeded.Outcome}`);
console.log(`branchy=${branchy.map(({ N, I }) => `${typeof N === 'number' ? N : '_'}:${I}`).join(',')}`);
console.log(`perf_runs=${runs}`);
console.log(`plain_mean_ms=${plainMean.toFixed(3)}`);
console.log(`inference_mean_ms=${boundedMean.toFixed(3)}`);
console.log(`mean_overhead_ms=${(boundedMean - plainMean).toFixed(3)}`);
console.log(`plain_median_ms=${median(plainMs).toFixed(3)}`);
console.log(`inference_median_ms=${median(boundedMs).toFixed(3)}`);
console.log(`paired_median_overhead_ms=${median(pairedDiffs).toFixed(3)}`);
console.log(`diagnostics=${diagnostics.length}`);
