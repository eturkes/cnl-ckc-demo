'use strict';

const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { generateImageBuffer } = require('swipl-wasm/dist/generateImage');
const loadImageDefault = require('swipl-wasm/dist/loadImageDefault').default;

const kbDir = process.env.KB_PL_DIR || process.argv[2];
const output = process.argv[3] || 'probe/results/s3.pvm';
if (!kbDir) throw new Error('set KB_PL_DIR or pass the payload directory');

const source = readdirSync(kbDir)
  .filter((name) => name.endsWith('.pl'))
  .sort()
  .map((name) => `\n% file:${name}\n${readFileSync(`${kbDir}/${name}`, 'utf8')}\n`)
  .join('');

const categoryAGoal = [
  'guideline_entity(actual,A,recommendation,countable)',
  'guideline_cardinality(actual,A,na,eq,1)',
  "guideline_entity(actual,B,'category-A-recommendation',countable)",
  'guideline_cardinality(actual,B,na,eq,1)',
  'guideline_event(actual,C,be)',
  'guideline_arg(actual,C,1,A)',
  'guideline_arg(actual,C,2,B)',
].join(',');

async function main() {
  const image = Buffer.from(await generateImageBuffer(source));
  writeFileSync(output, image);
  const diagnostics = [];
  const module = await loadImageDefault(image)({
    arguments: ['-q'],
    print() {},
    printErr() {},
    on_output(text, stream) { diagnostics.push({ stream, text }); },
  });
  const schemaResult = module.prolog
    .query('findall(V,guideline_schema_version(V),Vs),length(Vs,N),sort(Vs,Distinct).')
    .once();
  const documents = module.prolog.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).').once().N;
  const categoryA = module.prolog.query(`findall(A,(${categoryAGoal}),As).`).once().As;
  const categoryAIds = categoryA.map((term) => term.$guideline_id[0][1]);
  process.stdout.write(`${JSON.stringify({
    image: { sha256: createHash('sha256').update(image).digest('hex'), bytes: image.length },
    schema: { solutionCount: schemaResult.N, distinctSolutions: schemaResult.Distinct },
    documents,
    categoryAIds,
    categoryASolutionCount: categoryA.length,
    diagnostics,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
