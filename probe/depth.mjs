import { all, boot, once } from './lib.mjs';

const { engine, diagnostics } = await boot();
once(
  engine,
  'dynamic(probe_recur/1),retractall(probe_recur(_)),assertz(probe_recur(0)),assertz((probe_recur(N):-N>0,M is N-1,probe_recur(M)))',
);
const multi = all(engine, 'call_with_depth_limit((X=a;X=b;X=c),10,D)');
const exceeded = once(
  engine,
  'call_with_depth_limit(probe_recur(100),3,D),term_string(D,S,[quoted(true),ignore_ops(true)]),atom_string(Outcome,S)',
);
const branchy = all(engine, 'call_with_depth_limit(((N=1;N=20),probe_recur(N)),10,D)');
console.log(`multi_solutions=${multi.length}`);
console.log(`multi_values=${multi.map(({ X }) => X).join(',')}`);
console.log(`multi_outcomes=${multi.map(({ D }) => D).join(',')}`);
console.log(`exceeded=${exceeded.Outcome}`);
console.log(`branchy=${branchy.map(({ N, D }) => `${N}:${D}`).join(',')}`);
console.log(`diagnostics=${diagnostics.length}`);
