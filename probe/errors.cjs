const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const loadImageDefault = require('swipl-wasm/dist/loadImageDefault').default;

(async () => {
  const outputs = [];
  const image = fs.readFileSync(path.join(__dirname, 'kb.pvm'));
  const module = await loadImageDefault(image)({
    arguments: ['-q'],
    print() {},
    printErr() {},
    on_output(text, stream) { outputs.push({ stream, text }); },
  });

  const syncUndefined = module.prolog.query('definitely_missing_predicate(1).').once();
  let asyncUndefined;
  try {
    await module.prolog.forEach('definitely_missing_predicate(1).');
    asyncUndefined = { resolved: true };
  } catch (error) {
    asyncUndefined = { rejected: String(error) };
  }

  let malformedConsult;
  try {
    await module.prolog.load_string('broken(.\n', '/tests/broken.pl');
    malformedConsult = { resolved: true };
  } catch (error) {
    malformedConsult = { rejected: String(error) };
  }
  await module.prolog.load_string('warning_probe(X) :- true.\n', '/tests/warning.pl');
  await module.prolog.load_string('spin :- spin.\n', '/tests/spin.pl');

  const depthBound = module.prolog.query('call_with_depth_limit(spin,100,Result).').once();
  const inferenceStart = performance.now();
  const inferenceBound = module.prolog.query('call_with_inference_limit((repeat,fail),10000,Result).').once();
  const inferenceMs = performance.now() - inferenceStart;

  const heartbeatStart = performance.now();
  const heartbeatPromise = module.prolog.forEach('(between(1,1000000000,_),fail)', {}, { heartbeat: 1000, engine: true });
  setTimeout(() => module.prolog.abort(), 20);
  let heartbeat;
  try {
    await Promise.race([
      heartbeatPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('heartbeat-timeout')), 5000)),
    ]);
    heartbeat = { resolved: true, ms: performance.now() - heartbeatStart };
  } catch (error) {
    heartbeat = { rejected: String(error), ms: performance.now() - heartbeatStart };
  }

  console.log(JSON.stringify({ syncUndefined, asyncUndefined, malformedConsult, depthBound, inferenceBound, inferenceMs, heartbeat, outputs }));
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
