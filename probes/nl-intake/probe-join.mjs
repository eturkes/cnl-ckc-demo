import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const factory = createRequire(import.meta.url)('swipl-wasm/dist/loadImageDefault.js');
const load = typeof factory === 'function' ? factory : factory.default;
const engine = await load(new Uint8Array(readFileSync('kb/generated/kb.pvm')))({ arguments: ['-q'] });
const run = (label, goal, cap = 3) => {
  const t = Date.now(); const rows = []; let err;
  try { for (const s of engine.prolog.query(goal)) { if (s == null) break; rows.push(JSON.stringify(s).slice(0,240)); if (rows.length>=cap) break; } }
  catch (e) { err = String(e).replace(/\s+/gu,' ').slice(0,130); }
  console.log(`\n### ${label} [${Date.now()-t} ms]`);
  if (err) console.log(`  RAISED ${err}`); else if (!rows.length) console.log('  (no solutions)');
  else rows.forEach(r => console.log(`  ${r}`));
};
run('entity-name census (user: inside findall)',
  'findall(N,user:clause(guideline_entity(_,_,N,_),_),L),length(L,Heads),sort(L,U),length(U,Distinct).',1);
run('event-name census',
  'findall(N,user:clause(guideline_event(_,_,N),_),L),length(L,Heads),sort(L,U),length(U,Distinct).',1);
run('AD-HOC JOIN taper -> its argument entity',
  "user:(clause(guideline_event(W,E,taper),_),clause(guideline_arg(W,E,Role,A),_),clause(guideline_entity(W,A,Name,_),_)).",4);
run('AD-HOC JOIN: documents mentioning a naloxone entity',
  "findall(D,user:(clause(guideline_entity('$guideline_id'(context,D,_,_,_),_,'naloxone-coprescribing',_),_)),L),sort(L,Docs).",1);
run('which topics cite rec08 (reverse lookup)',
  "findall(Q,user:clinical_advice(Q,_,clinical_answer('cdc2022-opioid-rec08',_,_)),Qs).",1);
process.exit(0);
