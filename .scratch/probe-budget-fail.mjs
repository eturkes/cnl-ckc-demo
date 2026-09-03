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

const OPTIONS = '[quoted(true),numbervars(true),ignore_ops(true),max_depth(0)]';
const projection = (entry) => `[${entry.projection.map(({ variable }) => variable).join(',')}]`;
const timed = (goal) => {
  const started = performance.now();
  const result = once(goal);
  return { result, ms: Number((performance.now() - started).toFixed(3)) };
};
const selected = [];
for (const entry of catalog) {
  const values = once(`findall(S,((${entry.goal}),term_string(${projection(entry)},S,${OPTIONS})),Values).`).Values.map(String);
  const count = entry.projection.length === 0 ? 1 : values.length;
  for (let index = 0; index < count; index += 1) {
    const bind = `term_string(${projection(entry)},${JSON.stringify(values[index])})`;
    const inner = `${bind},once(mi((${entry.goal}),1,P)),term_string(P,S,${OPTIONS})`;
    const measured = timed(`statistics(inferences,I0),${inner},statistics(inferences,I1),Used is I1-I0.`);
    selected.push({ id: entry.id, slot: index + 1, value: values[index], inner, used: measured.result.Used, ms: measured.ms });
  }
}
const depthCandidates = [10, 20, 30, 40, 50, 75, 100];
for (const row of selected) {
  row.minimumOuterDepth = null;
  for (const depth of depthCandidates) {
    const result = once(`call_with_inference_limit(call_with_depth_limit((${row.inner}),${depth},DepthStatus),100000,InferenceStatus).`);
    if (result.DepthStatus !== 'depth_limit_exceeded' && result.InferenceStatus !== 'inference_limit_exceeded' && result.S !== undefined) {
      row.minimumOuterDepth = depth;
      break;
    }
  }
}
const maxInferences = Math.max(...selected.map(({ used }) => Number(used)));
const maxSingleStepMs = Math.max(...selected.map(({ ms }) => ms));
const minimumOuterDepth = Math.max(...selected.map(({ minimumOuterDepth }) => minimumOuterDepth ?? Infinity));
const worst = selected.reduce((left, right) => (left.ms > right.ms ? left : right));
const stackProbe = timed(
  `current_prolog_flag(stack_limit,Old),setup_call_cleanup(set_prolog_flag(stack_limit,16777216),call_with_inference_limit(call_with_depth_limit((${worst.inner}),100,DepthStatus),100000,InferenceStatus),set_prolog_flag(stack_limit,Old)).`,
);
console.log(JSON.stringify({
  type: 'budget',
  engine: 'swipl-bundle-no-data + kb/generated/kb.pvm',
  selectedClaims: selected.length,
  maxInferences,
  minimumOuterDepth,
  maxSingleStepMs,
  worst: { id: worst.id, slot: worst.slot, ms: worst.ms, used: worst.used },
  recommended: { miCap: 1, stackBytes: 16777216, depth: 100, inferences: 100000, answerCap: 1, wallClockMs: 1000 },
  stackProbe: { ms: stackProbe.ms, depthStatus: stackProbe.result.DepthStatus, inferenceStatus: stackProbe.result.InferenceStatus, proof: stackProbe.result.S !== undefined },
  selected,
}));

const noProof = once("(mi(guideline_entity(actual,_,m2_definitely_absent,countable),1,_)->Proof=yes;Proof=no),(mi_limited(guideline_entity(actual,_,m2_definitely_absent,countable),1)->Limited=yes;Limited=no).");
const exists = once("findall(1,mi((guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1)),1,_),Ps),length(Ps,N),(once(mi((guideline_entity(actual,B,recommendation,countable),guideline_cardinality(actual,B,na,eq,1)),1,_))->Answer=yes;Answer=no).");
const solvableRule = once(`once((clause(guideline_entity(A,B,C,D),Body),Body\\==true,call(Body),ground(guideline_entity(A,B,C,D)))),term_string(guideline_entity(A,B,C,D),S,${OPTIONS}).`);
const deeperGoal = String(solvableRule.S);
const depthFailure = [];
for (let cap = 0; cap <= 6; cap += 1) {
  const parsed = `term_string(G,${JSON.stringify(deeperGoal)})`;
  const result = once(`${parsed},(once(mi(G,${cap},P))->State=proof;mi_limited(G,${cap})->State=limit;State=failure),term_string(P,Proof,${OPTIONS}).`);
  depthFailure.push({ cap, state: result.State, proof: result.State === 'proof' ? result.Proof : null });
}
const noDocId = once("mi(guideline_schema_version(1),1,[node(line(L),H,[])]),(H='$guideline_id'(_,D,_,_,_)->Doc=D;Doc=absent).");
console.log(JSON.stringify({ type: 'failure', noProof, exists, deeperGoal, depthFailure, noDocId, policy: { noProof: 'failure', depthCap: 'typed limit', noDocId: 'unalignable node; reject proof display' } }));
