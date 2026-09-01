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

const mode = process.argv[2] ?? 'traps';
(
  ({ traps: runTraps, roundtrip: runRoundTrip })[mode]?.() ??
  Promise.reject(new Error(`unknown mode: ${mode}`))
).catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
