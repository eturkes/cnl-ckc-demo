import { performance } from 'node:perf_hooks';
import { inspect } from 'node:util';
import { boot, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
once(
  engine,
  'dynamic(probe_burn_cancel/1),retractall(probe_burn_cancel(_)),assertz(probe_burn_cancel(0)),assertz((probe_burn_cancel(N):- nb_getval(probe_cancelled,false),N>0,M is N-1,probe_burn_cancel(M))),nb_setval(probe_cancelled,false)',
);
let timerFired = false;
let timerFiredAt;
const start = performance.now();
const timerDone = new Promise((resolve) => {
  setTimeout(() => {
    once(engine, 'nb_setval(probe_cancelled,true)');
    timerFired = true;
    timerFiredAt = performance.now();
    resolve();
  }, 10);
});
const burn = once(engine, 'probe_burn_cancel(500000)');
const burnReturnedAt = performance.now();
const timerObservedInsideNext = timerFired;
await timerDone;
const flagAfterTimer = once(engine, 'nb_getval(probe_cancelled,V)').V;
once(engine, 'nb_setval(probe_cancelled,false)');

const iterator = engine.prolog
  .query(
    'catch(((X=a;X=b;X=c),(nb_getval(probe_cancelled,true)->throw(cooperative_cancelled);true)),cooperative_cancelled,Outcome=cooperative_cancelled).',
  )
  [Symbol.iterator]();
const first = iterator.next();
const flipStart = performance.now();
once(engine, 'nb_setval(probe_cancelled,true)');
const flipMs = performance.now() - flipStart;
const flagBetween = once(engine, 'nb_getval(probe_cancelled,V)').V;
const second = iterator.next();
const terminal = iterator.next();
console.log(`burn_success=${burn.success === true}`);
console.log(`burn_ms=${(burnReturnedAt - start).toFixed(3)}`);
console.log(`timer_fired_before_next_return=${timerObservedInsideNext}`);
console.log(`timer_fired_at_ms=${(timerFiredAt - start).toFixed(3)}`);
console.log(`flag_after_timer=${flagAfterTimer}`);
console.log(`first_solution=${first.value?.X}`);
console.log(`between_solution_flip_ms=${flipMs.toFixed(3)}`);
console.log(`flag_between_solutions=${flagBetween}`);
console.log(`second_outcome=${second.value?.Outcome}`);
console.log(`second_raw=${inspect(second, { depth: null, colors: false, compact: true })}`);
console.log(`terminal_done=${terminal.done === true}`);
console.log(`diagnostics=${diagnostics.length}`);
