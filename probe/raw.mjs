import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';

const require = createRequire(import.meta.url);
const imported = require('swipl-wasm/dist/loadImageDefault.js');
const loadImage = typeof imported === 'function' ? imported : imported.default;
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const diagnostics = [];
const engine = await loadImage(image)({
  print: (line) => diagnostics.push(`stdout:${line}`),
  printErr: (line) => diagnostics.push(`printErr:${line}`),
  on_output: (text, stream) => diagnostics.push(`${stream}:${text}`),
});

const categoryA =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)';
const goals = [
  'current_prolog_flag(version,V),current_prolog_flag(stack_limit,S)',
  `call_with_depth_limit((${categoryA}),1000,D)`,
  `call_with_inference_limit((${categoryA}),100000,I)`,
  "catch(use_module(library(time)),E,true)",
  "catch(call_with_time_limit(0.01,repeat),E,true)",
  "catch(alarm(0.01,true,Id,[]),E,true)",
];

for (const goal of goals) {
  const result = engine.prolog.query(`${goal}.`).once();
  console.log(`GOAL ${goal}`);
  console.log(inspect(result, { depth: null, colors: false, compact: true }));
}
console.log(`DIAGNOSTICS ${inspect(diagnostics, { depth: null, colors: false })}`);
