import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

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
const MI = `
resolve(guideline_arg(A,B,C,D),Body) :- clause(guideline_arg(A,B,C,D),Body).
resolve(guideline_cardinality(A,B,C,D,E),Body) :- clause(guideline_cardinality(A,B,C,D,E),Body).
resolve(guideline_document(A,B,C),Body) :- clause(guideline_document(A,B,C),Body).
resolve(guideline_entity(A,B,C,D),Body) :- clause(guideline_entity(A,B,C,D),Body).
resolve(guideline_event(A,B,C),Body) :- clause(guideline_event(A,B,C),Body).
resolve(guideline_operator(A,B,C),Body) :- clause(guideline_operator(A,B,C),Body).
resolve(guideline_pp(A,B,C,D),Body) :- clause(guideline_pp(A,B,C,D),Body).
resolve(guideline_property(A,B,C,D),Body) :- clause(guideline_property(A,B,C,D),Body).
resolve(guideline_schema_version(A),Body) :- clause(guideline_schema_version(A),Body).
app([],L,L).
app([H|T],L,[H|R]) :- app(T,L,R).
mi(true,_,[]) :- !.
mi((A,B),D,P) :- !, mi(A,D,PA), mi(B,D,PB), app(PA,PB,P).
mi(_,0,_) :- !, fail.
mi(H,D,[node(H,B,Sub)]) :- D > 0, D1 is D-1, resolve(H,B), mi(B,D1,Sub).
`;
engine.FS.writeFile('m2-mi.pl', MI);
once("consult('m2-mi.pl').");
if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));

const timed = (goal) => {
  const started = performance.now();
  const result = once(goal);
  return { ms: Number((performance.now() - started).toFixed(3)), result };
};
for (const entry of catalog) {
  const caps = [];
  for (const cap of [1, 20, 10_000_000]) {
    const limit = cap === 10_000_000 ? 2_000_000 : 10_000_000;
    const probe = timed(
      `statistics(inferences,I0),catch(call_with_inference_limit((findall(1,mi((${entry.goal}),${cap},_),Xs),length(Xs,N)),${limit},Status),Error,(Status=error,term_string(Error,ErrorText))),statistics(inferences,I1),Used is I1-I0.`,
    );
    caps.push({ cap, inferenceLimit: limit, ms: probe.ms, status: probe.result.Status, count: probe.result.N ?? null, used: probe.result.Used, error: probe.result.ErrorText ?? null });
  }
  console.log(JSON.stringify({ id: entry.id, engine: 'swipl-bundle-no-data + kb/generated/kb.pvm', caps }));
}
