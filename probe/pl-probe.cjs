const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { decodeCanonical, encodeCanonical } = require('./canonical.cjs');

const loader = require('swipl-wasm/dist/loadImageDefault');
const loadImageDefault = loader.default?.default ?? loader.default ?? loader;
const imagePath = path.resolve(__dirname, '../kb/generated/kb.pvm');
const queryPath = path.resolve(
  __dirname,
  '../../../kb/data/guidelines/cdc-2022-opioid/queries/pl/category-a-recommendations.pl',
);
const helperPath = path.resolve(__dirname, 'pl-serializer.pl');
const quiet = { arguments: ['-q'], print() {}, printErr() {} };

async function boot({ query = false } = {}) {
  const bootStarted = performance.now();
  const module = await loadImageDefault(fs.readFileSync(imagePath))(quiet);
  const bootMs = performance.now() - bootStarted;
  if (query) {
    await module.prolog.load_string(
      fs.readFileSync(queryPath, 'utf8'),
      '/queries/category-a-recommendations.pl',
    );
  }
  const consultStarted = performance.now();
  await module.prolog.load_string(fs.readFileSync(helperPath, 'utf8'), '/assets/pl-serializer.pl');
  const helperConsultMs = performance.now() - consultStarted;
  return { module, bootMs, helperConsultMs };
}

function serialize(module, source) {
  const result = module.prolog
    .query('pl_serializer:parse_and_serialize(Input, Canonical, Display).', { Input: source })
    .once();
  if (result.error) throw new Error(result.message);
  return {
    term: decodeCanonical(result.Canonical),
    canonical: result.Canonical,
    display: result.Display,
  };
}

const trapCases = [
  ['compound-vector', 'foo(bar,7)'],
  ['rational-1r3', '1r3'],
  ['rational-3r1', '3r1'],
  ['atom', 'plain'],
  ['string', '"plain"'],
  ['big-integer', '123456789012345678901234567890'],
  ['operator', '(a-b)'],
  ['empty-list', '[]'],
  ['unbound-variable', 'pair(X,X)'],
  ['nested-compound', "'$guideline_id'(product,'cdc2022-opioid-rec02',1,ref(1),[])"],
  ['improper-list', '[a,2|tail]'],
];

async function runTraps() {
  const { module, bootMs, helperConsultMs } = await boot();
  const cases = Object.fromEntries(
    trapCases.map(([name, source]) => [name, serialize(module, source)]),
  );
  assert.deepStrictEqual(cases['compound-vector'].term, {
    type: 'compound',
    functor: 'foo',
    args: [
      { type: 'atom', value: 'bar' },
      { type: 'integer', value: '7' },
    ],
  });
  assert.equal(cases['nested-compound'].term.functor, '$guideline_id');
  assert.equal(cases['nested-compound'].term.args[1].value, 'cdc2022-opioid-rec02');
  assert.deepStrictEqual(structuredClone(cases), cases);
  console.log(JSON.stringify({ bootMs, helperConsultMs, structuredClone: true, cases }));
}

async function runRoundTrip() {
  const { module } = await boot();
  const results = trapCases.map(([name, source]) => {
    const first = serialize(module, source);
    const encoded = encodeCanonical(first.term);
    const second = serialize(module, encoded);
    return {
      name,
      encoded,
      identical: assert.deepStrictEqual(second.term, first.term) === undefined,
    };
  });
  console.log(
    JSON.stringify({
      identical: results.filter((result) => result.identical).length,
      total: results.length,
      results,
    }),
  );
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function timedCategory(module, serialized) {
  const started = performance.now();
  const terms = [];
  await module.prolog.forEach(
    serialized
      ? 'pl_serializer:category_a_solution(Canonical,Display).'
      : 'pl_serializer:category_a_native(Answer).',
    {},
    (answer) => {
      terms.push(serialized ? decodeCanonical(answer.Canonical) : answer.Answer);
    },
  );
  return { ms: performance.now() - started, count: terms.length };
}

async function runDisplay() {
  const { module } = await boot();
  const input = "'$guideline_id'(product,'cdc2022-opioid-rec02',1,ref(1),[])";
  const result = module.prolog
    .query('pl_serializer:display_probe(Input,10000,Display,Message,MicrosPerWrite).', {
      Input: input,
    })
    .once();
  if (result.error) throw new Error(result.message);
  const started = performance.now();
  for (let index = 0; index < 10000; index += 1) decodeCanonical(result.Display);
  const microsPerParse = ((performance.now() - started) * 1000) / 10000;
  console.log(
    JSON.stringify({
      display: result.Display,
      writeCanonicalMatch: result.Display === serialize(module, input).display,
      printMessage: result.Message,
      microsPerWrite: result.MicrosPerWrite,
      microsPerParse,
    }),
  );
}

async function runCost() {
  const { module } = await boot({ query: true });
  module.prolog.query('pl_serializer:category_a_cost(100,QueryMs,SerializeMs,Canonical).').once();
  const querySamples = [];
  const serializeSamples = [];
  const parseSamples = [];
  for (let index = 0; index < 9; index += 1) {
    const result = module.prolog
      .query('pl_serializer:category_a_cost(500,QueryMs,SerializeMs,Canonical).')
      .once();
    if (result.error) throw new Error(result.message);
    const parseStarted = performance.now();
    let decoded;
    for (let iteration = 0; iteration < 1000; iteration += 1) {
      decoded = decodeCanonical(result.Canonical);
    }
    assert.equal(decoded.items.length, 7);
    querySamples.push(result.QueryMs);
    serializeSamples.push(result.SerializeMs);
    parseSamples.push((performance.now() - parseStarted) / 1000);
  }
  const plainQueryMs = median(querySamples);
  const serializeMs = median(serializeSamples);
  const parseMs = median(parseSamples);
  const overheadMs = serializeMs + parseMs;
  console.log(
    JSON.stringify({
      repetitions: querySamples.length,
      solutions: 7,
      plainQueryMs,
      serializeMs,
      parseMs,
      overheadMs,
      overheadPerSolutionMs: overheadMs / 7,
      recordedPlainBaselineMs: [140, 220],
    }),
  );
}

function rawSerializedGoal(module, input) {
  return module.prolog
    .query('pl_serializer:run_and_serialize(Input,Canonical,Display).', { Input: input })
    .once();
}

async function runErrors() {
  const { module } = await boot();
  const exceptionGoal =
    "throw(error(spike_exception,context(pl_serializer:run_and_serialize/3,'boom')))";
  const exception = rawSerializedGoal(module, exceptionGoal);
  const failure = rawSerializedGoal(module, 'fail');
  const malformed = rawSerializedGoal(module, 'foo(');
  let asynchronousException;
  try {
    await module.prolog.forEach(
      'pl_serializer:run_and_serialize(Input,Canonical,Display).',
      { Input: exceptionGoal },
      () => {},
    );
    asynchronousException = { resolved: true };
  } catch (error) {
    asynchronousException = { rejected: String(error) };
  }
  assert.equal(exception.error, true);
  assert.equal(failure.success, false);
  assert.equal(malformed.error, true);
  assert.ok('rejected' in asynchronousException);
  console.log(JSON.stringify({ exception, failure, malformed, asynchronousException }));
}

function batchCategory(module) {
  const started = performance.now();
  const result = module.prolog.query('pl_serializer:category_a_batch(Canonical,Display).').once();
  if (result.error) throw new Error(result.message);
  const term = decodeCanonical(result.Canonical);
  assert.equal(term.type, 'list');
  return { ms: performance.now() - started, count: term.items.length };
}

async function streamCategory(module) {
  const started = performance.now();
  let firstMs = null;
  const solutions = [];
  await module.prolog.forEach(
    'pl_serializer:category_a_solution(Canonical,Display).',
    {},
    (answer) => {
      firstMs ??= performance.now() - started;
      solutions.push({
        term: decodeCanonical(answer.Canonical),
        canonical: answer.Canonical,
        display: answer.Display,
      });
    },
  );
  return { ms: performance.now() - started, firstMs, solutions };
}

async function runProtocol() {
  const { module } = await boot({ query: true });
  batchCategory(module);
  await streamCategory(module);
  const batch = batchCategory(module);
  const stream = await streamCategory(module);
  const messages = stream.solutions.map((solution, index) => ({
    requestId: 73,
    type: 'solution',
    index,
    solution,
  }));
  const cloneStarted = performance.now();
  let clone;
  for (let iteration = 0; iteration < 5000; iteration += 1) {
    for (const message of messages) clone = structuredClone(message);
  }
  const cloneMicrosPerMessage =
    ((performance.now() - cloneStarted) * 1000) / (5000 * messages.length);
  assert.equal(clone.requestId, 73);
  assert.equal(messages.length, 7);
  console.log(
    JSON.stringify({
      requestId: clone.requestId,
      batchMs: batch.ms,
      batchCount: batch.count,
      streamFirstMs: stream.firstMs,
      streamTotalMs: stream.ms,
      streamCount: messages.length,
      cloneMicrosPerMessage,
      meanMessageBytes:
        messages.reduce((sum, message) => sum + JSON.stringify(message).length, 0) / 7,
    }),
  );
}

const mode = process.argv[2] ?? 'traps';
(
  ({
    traps: runTraps,
    roundtrip: runRoundTrip,
    display: runDisplay,
    cost: runCost,
    errors: runErrors,
    protocol: runProtocol,
  })[mode]?.() ?? Promise.reject(new Error(`unknown mode: ${mode}`))
).catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
