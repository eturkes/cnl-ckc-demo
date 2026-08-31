const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const SWIPL = require('swipl-wasm');

const mode = process.argv[2];
const kbDir = path.resolve(__dirname, '../../../kb/data/guidelines/cdc-2022-opioid/pl');
const files = fs.readdirSync(kbDir).filter((name) => name.endsWith('.pl')).sort();
const sources = files.map((name) => fs.readFileSync(path.join(kbDir, name), 'utf8'));
const joined = sources.map((source, index) => `\n% file:${files[index]}\n${source}`).join('\n');
const quiet = { arguments: ['-q'], print() {}, printErr() {} };
const now = () => performance.now();
const docs = (module) => module.prolog.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).').once().N;

async function boot(factory = SWIPL, options = quiet) {
  const start = now();
  const module = await factory(options);
  return { module, ms: now() - start };
}

async function loadCandidate(load) {
  const { module, ms: bootMs } = await boot();
  const start = now();
  await load(module);
  const loadMs = now() - start;
  const queryStart = now();
  const documentCount = docs(module);
  return { bootMs, loadMs, totalMs: bootMs + loadMs, queryMs: now() - queryStart, documentCount };
}

(async () => {
  const base = { mode, files: files.length, sourceBytes: Buffer.byteLength(joined) };
  if (mode === 'api') {
    const { module, ms: bootMs } = await boot();
    const query = module.prolog.query('X = foo(bar, 7), Y = "text", Z is 1 rdiv 3.');
    console.log(JSON.stringify({ ...base, bootMs, prologPrototype: Object.getOwnPropertyNames(Object.getPrototypeOf(module.prolog)).sort(), queryPrototype: Object.getOwnPropertyNames(Object.getPrototypeOf(query)).sort(), sample: query.once() }));
    return;
  }
  if (mode === 'load-string') {
    console.log(JSON.stringify({ ...base, ...(await loadCandidate((module) => module.prolog.load_string(joined, '/kb/all.pl'))) }));
    return;
  }
  if (mode === 'one-source-file') {
    console.log(JSON.stringify({ ...base, ...(await loadCandidate(async (module) => { module.FS.writeFile('/all.pl', joined); await module.prolog.consult('/all.pl'); })) }));
    return;
  }
  if (mode === '337-source-files') {
    console.log(JSON.stringify({ ...base, ...(await loadCandidate(async (module) => { module.FS.mkdir('/kb'); const targets = files.map((name, index) => { const target = `/kb/${name}`; module.FS.writeFile(target, sources[index]); return target; }); await module.prolog.consult(...targets); })) }));
    return;
  }
  if (mode === 'qlf-build') {
    const { module, ms: bootMs } = await boot();
    module.FS.writeFile('/all.pl', joined);
    const start = now();
    const result = module.prolog.query("qcompile('/all.pl').").once();
    const buildMs = now() - start;
    const artifact = module.FS.readFile('/all.qlf');
    fs.writeFileSync(path.join(__dirname, 'all.qlf'), artifact);
    console.log(JSON.stringify({ ...base, bootMs, buildMs, artifactBytes: artifact.byteLength, result }));
    return;
  }
  if (mode === 'qlf-load') {
    const artifact = fs.readFileSync(path.join(__dirname, 'all.qlf'));
    console.log(JSON.stringify({ ...base, artifactBytes: artifact.byteLength, ...(await loadCandidate(async (module) => { module.FS.writeFile('/all.qlf', artifact); await module.prolog.consult('/all.qlf'); })) }));
    return;
  }
  if (mode === 'image-build') {
    const { generateImageBuffer } = require('swipl-wasm/dist/generateImage');
    const start = now();
    const artifact = await generateImageBuffer(joined);
    const buildMs = now() - start;
    fs.writeFileSync(path.join(__dirname, 'kb.pvm'), artifact);
    console.log(JSON.stringify({ ...base, buildMs, artifactBytes: artifact.byteLength }));
    return;
  }
  if (mode === 'image-load') {
    const loadImageDefault = require('swipl-wasm/dist/loadImageDefault').default;
    const artifact = fs.readFileSync(path.join(__dirname, 'kb.pvm'));
    const start = now();
    const module = await loadImageDefault(artifact)(quiet);
    const bootAndLoadMs = now() - start;
    const queryStart = now();
    const documentCount = docs(module);
    console.log(JSON.stringify({ ...base, artifactBytes: artifact.byteLength, bootAndLoadMs, queryMs: now() - queryStart, documentCount }));
    return;
  }
  throw new Error(`unknown mode: ${mode}`);
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
