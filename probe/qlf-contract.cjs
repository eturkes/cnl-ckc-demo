'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const SWIPL = require('swipl-wasm');

const kbDir = process.env.KB_PL_DIR || process.argv[2];
const outputDir = resolve(process.argv[3] || 'probe/results/s4-s5');
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

function options(diagnostics) {
  return {
    arguments: ['-q'],
    print() {},
    printErr() {},
    on_output(text, stream) { diagnostics.push({ stream, text }); },
  };
}

function describe(buffer) {
  return { sha256: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

async function build(label) {
  const diagnostics = [];
  const module = await SWIPL(options(diagnostics));
  module.FS.writeFile('/all.pl', source);
  const queryResult = module.prolog.query("qcompile('/all.pl').").once();
  const artifact = Buffer.from(module.FS.readFile('/all.qlf'));
  writeFileSync(`${outputDir}/${label}.qlf`, artifact);
  return { artifact, queryResult, diagnostics };
}

function difference(a, b) {
  const offsets = [];
  for (let offset = 0; offset < Math.max(a.length, b.length); offset += 1) {
    if (a[offset] !== b[offset]) offsets.push(offset);
  }
  return { differingOffsetCount: offsets.length, offsets };
}

async function contract(artifact) {
  const diagnostics = [];
  const module = await SWIPL(options(diagnostics));
  module.FS.writeFile('/all.qlf', artifact);
  await module.prolog.consult('/all.qlf');
  const schemaResult = module.prolog
    .query('findall(V,guideline_schema_version(V),Vs),length(Vs,N),sort(Vs,Distinct).')
    .once();
  const documents = module.prolog.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).').once().N;
  const categoryA = module.prolog.query(`findall(A,(${categoryAGoal}),As).`).once().As;
  return {
    schema: { solutionCount: schemaResult.N, distinctSolutions: schemaResult.Distinct },
    documents,
    categoryAIds: categoryA.map((term) => term.$guideline_id[0][1]),
    categoryASolutionCount: categoryA.length,
    diagnostics,
  };
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const a = await build('a');
  const b = await build('b');
  process.stdout.write(`${JSON.stringify({
    a: { ...describe(a.artifact), queryResult: a.queryResult, diagnostics: a.diagnostics },
    b: { ...describe(b.artifact), queryResult: b.queryResult, diagnostics: b.diagnostics },
    difference: difference(a.artifact, b.artifact),
    contract: await contract(a.artifact),
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
