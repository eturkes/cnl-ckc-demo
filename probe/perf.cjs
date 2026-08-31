const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const memory = () => Object.fromEntries(Object.entries(process.memoryUsage()).map(([key, value]) => [key, value]));
const snapshots = { processStart: memory() };
const loadImageDefault = require('swipl-wasm/dist/loadImageDefault').default;
snapshots.afterRequire = memory();
const image = fs.readFileSync(path.join(__dirname, 'kb.pvm'));
snapshots.afterImageRead = memory();

(async () => {
  const start = performance.now();
  const module = await loadImageDefault(image)({ arguments: ['-q'], print() {}, printErr() {} });
  const bootAndLoadMs = performance.now() - start;
  snapshots.afterBootAndLoad = memory();
  const statsGoal = [
    'current_prolog_flag(stack_limit,StackLimit)',
    'statistics(global_stack,[GlobalUsed,GlobalFree])',
    'statistics(local_stack,[LocalUsed,LocalFree])',
    'statistics(trail,[TrailUsed,TrailFree])',
    'statistics(atoms,Atoms)',
    'statistics(clauses,Clauses)',
  ].join(',');
  const before = module.prolog.query(`${statsGoal}.`).once();
  const setLimit = module.prolog.query('set_prolog_flag(stack_limit,268435456),current_prolog_flag(stack_limit,StackLimit).').once();
  module.prolog.query('dynamic(probe_state/1),assertz(probe_state(42)).').once();
  const persisted = module.prolog.query('probe_state(Value).').once();
  const queryTimes = [];
  for (let i = 0; i < 5; i += 1) {
    const queryStart = performance.now();
    const answer = module.prolog.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).').once();
    queryTimes.push({ ms: performance.now() - queryStart, documents: answer.N });
  }
  snapshots.afterQueries = memory();
  const after = module.prolog.query(`${statsGoal}.`).once();
  console.log(JSON.stringify({ bootAndLoadMs, snapshots, before, setLimit, persisted, queryTimes, after }));
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
