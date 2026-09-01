const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const loader = require('swipl-wasm/dist/loadImageDefault');
const loadImageDefault = loader.default?.default ?? loader.default ?? loader;
const imagePath = path.resolve(__dirname, '../kb/generated/kb.pvm');
const queryPath = path.resolve(
  __dirname,
  '../../../kb/data/guidelines/cdc-2022-opioid/queries/pl/category-a-recommendations.pl',
);
const helper = String.raw`
pl_slice_payload(Count, Payload) :-
  findall(Answer,
    ('$guideline_query_projection'(goal(Goal), answers([answer(Answer, _)])), call(Goal)),
    Answers),
  length(Answers, Count),
  with_output_to(atom(Payload),
    write_term(Answers, [quoted(true), ignore_ops(true), numbervars(true)])).
`;

function decodeGuidelineIds(payload) {
  const pattern = /'\$guideline_id'\(([^,]+),'([^']+)',(-?\d+),ref\((-?\d+)\),\[\]\)/g;
  const matches = [...payload.matchAll(pattern)];
  if (payload !== `[${matches.map((match) => match[0]).join(',')}]`) {
    throw new Error(`unexpected canonical payload: ${payload}`);
  }
  return matches.map((match) => ({
    kind: match[1],
    id: match[2],
    version: Number(match[3]),
    reference: Number(match[4]),
    extensions: [],
  }));
}

(async () => {
  const started = performance.now();
  const image = fs.readFileSync(imagePath);
  const module = await loadImageDefault(image)({ arguments: ['-q'], print() {}, printErr() {} });
  const bootMs = performance.now() - started;
  await module.prolog.load_string(
    fs.readFileSync(queryPath, 'utf8'),
    '/queries/category-a-recommendations.pl',
  );
  await module.prolog.load_string(helper, '/probe/pl-slice-helper.pl');

  const documentCount = module.prolog
    .query('findall(D,guideline_document(D,_,_),Ds),length(Ds,Count).')
    .once().Count;
  const queryStarted = performance.now();
  const result = module.prolog.query('pl_slice_payload(Count, Payload).').once();
  const queryMs = performance.now() - queryStarted;
  if (result.error) throw new Error(result.message);
  const solutions = decodeGuidelineIds(result.Payload);
  if (solutions.length !== result.Count) throw new Error('decoded solution count mismatch');

  console.log(
    JSON.stringify({
      bootMs,
      queryMs,
      documentCount,
      solutionCount: result.Count,
      payload: result.Payload,
      solutions,
    }),
  );
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
