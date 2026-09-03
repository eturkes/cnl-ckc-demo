import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { MI } from './mi-source.mjs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const catalog = JSON.parse(readFileSync('kb/generated/question-catalog.json', 'utf8')).entries;
const diagnostics = [];
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(module) => module.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (line) => diagnostics.push(line),
  on_output: (text, stream) => {
    if (stream === 'stderr') diagnostics.push(text);
  },
});
const once = (goal) => {
  const query = engine.prolog.query(goal);
  try {
    return query.once();
  } finally {
    query.close?.();
  }
};
engine.FS.writeFile('m2-mi.pl', MI);
once("consult('m2-mi.pl').");
if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));

for (const entry of catalog) {
  const caps = [];
  for (const cap of [0, 1, 2, 3, 4, 5, 10, 20]) {
    const started = performance.now();
    const result = once(
      `statistics(inferences,I0),call_with_inference_limit((findall(1,mi((${entry.goal}),${cap},_),Xs),length(Xs,N)),200000,Status),statistics(inferences,I1),Used is I1-I0.`,
    );
    caps.push({ cap, status: result.Status, count: result.N ?? null, inferences: result.Used, ms: Number((performance.now() - started).toFixed(3)) });
  }
  console.log(JSON.stringify({ id: entry.id, engine: 'swipl-bundle-no-data + kb/generated/kb.pvm + tri-state MI', caps }));
}
