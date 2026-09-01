import { performance } from 'node:perf_hooks';
import { boot, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
once(
  engine,
  'dynamic(probe_burn/1),retractall(probe_burn(_)),assertz(probe_burn(0)),assertz((probe_burn(N):-N>0,M is N-1,probe_burn(M)))',
);
const caught = (goal) =>
  once(
    engine,
    `catch((${goal}),E,true),nonvar(E),term_string(E,S,[quoted(true),numbervars(true),ignore_ops(true)]),atom_string(Error,S)`,
  ).Error;
const threads = once(engine, 'current_prolog_flag(threads,T)').T;
const libraryError = caught('use_module(library(time))');
const timeLimitError = caught('call_with_time_limit(0.01,probe_burn(1000000000))');
const alarmError = caught('alarm(0.01,true,_Id,[])');
let timerFired = false;
let firedAt;
const start = performance.now();
const timerDone = new Promise((resolve) => {
  setTimeout(() => {
    timerFired = true;
    firedAt = performance.now();
    resolve();
  }, 10);
});
once(engine, 'probe_burn(2000000)');
const returnedAt = performance.now();
const observedBeforeReturn = timerFired;
await timerDone;
console.log(`threads=${threads}`);
console.log(`library_time=${libraryError}`);
console.log(`call_with_time_limit=${timeLimitError}`);
console.log(`alarm_4=${alarmError}`);
console.log(`burn_ms=${(returnedAt - start).toFixed(3)}`);
console.log(`timer_fired_before_next_return=${observedBeforeReturn}`);
console.log(`timer_fired_at_ms=${(firedAt - start).toFixed(3)}`);
console.log(`diagnostics=${diagnostics.length}`);
