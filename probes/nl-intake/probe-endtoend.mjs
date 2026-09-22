// End-to-end: names the judgment layer GROUNDED -> a real query -> real KB rows.
// The names below were selected by jev-1.13.0 from the 800 clause-reachable vocabulary;
// nothing here was written by a model, only chosen from names the KB defines.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const factory = createRequire(import.meta.url)('swipl-wasm/dist/loadImageDefault.js');
const load = typeof factory === 'function' ? factory : factory.default;
const engine = await load(new Uint8Array(readFileSync('kb/generated/kb.pvm')))({ arguments: ['-q'] });

// Bare `name` args override the default set, so a freshly grounded name can be resolved
// without editing the table M9 reproduces from.
const OVERRIDE = process.argv.slice(2).map((n) => [n, n]);

const GROUNDED = OVERRIDE.length ? OVERRIDE : [
  ['urine drug test', 'toxicology-testing'],
  ['liver problems', 'hepatic-insufficiency'],
  ['kidney problems', 'renal-insufficiency'],
  ['addiction', 'substance-use-disorder'],
  ['quitting cold turkey', 'abrupt-opioid-discontinuation'],
  ['overdose reversal', 'naloxone-overdose-reversal-precaution'],
  ['talk to the patient', 'clinician-patient-communication'],
  ['painkiller', 'opioid-pain-medication'],
];

for (const [phrase, name] of GROUNDED) {
  // Code assembles the goal from a fixed template; the model contributed only `name`.
  const goal =
    `findall(D,user:clause(guideline_entity('$guideline_id'(context,D,_,_,_),_,'${name}',_),_),L),sort(L,Docs),length(Docs,N).`;
  const t = Date.now();
  let out = '(no solutions)';
  try {
    for (const s of engine.prolog.query(goal)) {
      if (s == null) break;
      out = `${s.N} document(s): ${JSON.stringify(s.Docs).slice(0, 120)}`;
      break;
    }
  } catch (e) { out = `RAISED ${String(e).slice(0, 80)}`; }
  console.log(`${phrase.padEnd(22)} -> ${name.padEnd(38)} ${String(Date.now() - t).padStart(3)} ms  ${out}`);
}
process.exit(0);
