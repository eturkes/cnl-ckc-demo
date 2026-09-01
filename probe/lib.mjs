import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const imported = require('swipl-wasm/dist/loadImageDefault.js');
const loadImage = typeof imported === 'function' ? imported : imported.default;
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));

export const categoryA =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B)';

export const boot = async () => {
  const diagnostics = [];
  const engine = await loadImage(image)({
    print: (line) => diagnostics.push(`stdout:${line}`),
    printErr: (line) => diagnostics.push(`printErr:${line}`),
    on_output: (text, stream) => diagnostics.push(`${stream}:${text}`),
  });
  return { engine, diagnostics };
};

export const all = (engine, goal) => {
  const values = [];
  const iterator = engine.prolog.query(`${goal}.`)[Symbol.iterator]();
  for (;;) {
    const step = iterator.next();
    if (step.value !== undefined) values.push(step.value);
    if (step.done === true) return values;
  }
};

export const once = (engine, goal) => engine.prolog.query(`${goal}.`).once();

export const compoundArgs = (term) => term?.[term?.functor]?.[0];
