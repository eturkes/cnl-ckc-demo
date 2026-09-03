import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { MI } from './mi-source.mjs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const catalog = JSON.parse(readFileSync('kb/generated/question-catalog.json', 'utf8')).entries;
const diagnostics = [];
const bootStarted = performance.now();
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(module) => module.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (line) => diagnostics.push(line),
  on_output: (text, stream) => {
    if (stream === 'stderr') diagnostics.push(text);
  },
});
const bootMs = performance.now() - bootStarted;
const once = (goal) => {
  const query = engine.prolog.query(goal);
  try {
    return query.once();
  } finally {
    query.close?.();
  }
};
engine.FS.writeFile('m2-mi.pl', MI);
const consultStarted = performance.now();
once("consult('m2-mi.pl').");
const consultMs = performance.now() - consultStarted;
if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));

const OPTIONS = '[quoted(true),numbervars(true),ignore_ops(true),max_depth(0)]';
const projection = (entry) => `[${entry.projection.map(({ variable }) => variable).join(',')}]`;
const values = (entry, meta) => {
  const proof = meta ? `mi((${entry.goal}),1,_)` : `(${entry.goal})`;
  return once(`findall(S,(${proof},term_string(${projection(entry)},S,${OPTIONS})),Values).`).Values.map(String);
};
const sample = (goal, runs = 7) => {
  once(goal);
  const times = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    once(goal);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  return { runs, median: Number(times[Math.floor(times.length / 2)].toFixed(3)), min: Number(times[0].toFixed(3)), max: Number(times.at(-1).toFixed(3)) };
};
const key = (items) => JSON.stringify([...items].sort());
console.log(JSON.stringify({ type: 'boot', engine: 'swipl-bundle-no-data + kb/generated/kb.pvm + tri-state MI', bootMs: Number(bootMs.toFixed(3)), consultMs: Number(consultMs.toFixed(3)) }));
for (const entry of catalog) {
  const plain = values(entry, false);
  const derived = values(entry, true);
  console.log(JSON.stringify({
    type: 'goal',
    id: entry.id,
    provenance: entry.provenance,
    plain,
    derived,
    equal: key(plain) === key(derived),
    costMs: {
      plainAll: sample(`findall(1,((${entry.goal})),Xs),length(Xs,N).`),
      miFirst: sample(`once(mi((${entry.goal}),1,_)).`),
      miAll: sample(`findall(1,mi((${entry.goal}),1,_),Xs),length(Xs,N).`),
    },
  }));
}
