// U11 (P2.2): does the producer abort before qsave_program when the corpus is
// not schema 1 / exactly 337 documents?
// U12 (P2.3): is every consult diagnostic fatal, and is the tolerated save noise
// really just the two library(shlib) warnings?
import { readFileSync } from 'node:fs';
import { verifyBag } from '../tools/kb/bag.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage, buildQlf, verifyImage, verifyQlf, readContract } from '../tools/kb/produce.mjs';

const { files } = verifyBag(readFileSync('kb/cnl-ckc-kb-g952cc950a0c6.tar.gz'));
const { source, names } = payloadSource(files);
console.log(`baseline: ${names.length} payload files`);

const run = async (label, text) => {
  try {
    const { image, contract } = await buildImage(text);
    console.log(`  ACCEPTED  schema=${contract.schemaVersion} docs=${contract.documents} image=${image.byteLength}B  <- ${label}`);
    return contract;
  } catch (error) {
    console.log(`  REFUSED   ${String(error.message).split('\n')[0].slice(0, 110)}  <- ${label}`);
    return undefined;
  }
};

console.log('--- U11: corpus-size assertion inside the building engine ---');
// Drop one payload file: 336 documents instead of 337.
const dropped = names
  .slice(0, -1)
  .map((n) => `\n% file:${n}\n${Buffer.from(files.get(n)).toString('utf8')}`)
  .join('\n');
await run('one payload file dropped (336 docs)', dropped);
// Keep a single document: 1 document.
const one = `\n% file:${names[0]}\n${Buffer.from(files.get(names[0])).toString('utf8')}`;
await run('a single payload file (1 doc)', one);
// A corpus declaring schema 2 rather than 1.
await run('schema version 2, not 1', one.replace(/guideline_schema_version\(1\)/g, 'guideline_schema_version(2)'));
// Zero documents but a schema fact present.
await run('schema fact only, 0 documents', '\n% file:x\nguideline_schema_version(1).\n');
// Mixed schema versions -- readContract should catch this one.
await run('mixed schema versions 1 and 2', `${one}\nguideline_schema_version(2).\n`);

console.log('--- U12: consult diagnostics are fatal ---');
await run('payload writes to user_error', `${one}\n:- format(user_error, "boom~n", []).\n`);
await run('payload has a syntax error', `${one}\nthis is not( valid prolog\n`);
await run('payload calls an undefined predicate', `${one}\n:- no_such_predicate_xyz.\n`);
await run('payload emits a warning (discontiguous)', `${one}\nfoo(1).\nbar(1).\nfoo(2).\n`);

console.log('--- U12: what noise does image save actually emit? ---');
// Re-implements buildImage's save step with NO filter, to read the raw lines.
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle');
let diagnostics = [];
const engine = await factory({
  arguments: ['-q', '-f', 'prolog.pl'],
  preRun: [(m) => { m.FS.writeFile('prolog.pl', one); m.FS.utime('prolog.pl', 0, 0); }],
  print: () => {},
  printErr: (l) => diagnostics.push(l),
  on_output: (t, s) => { if (s === 'stderr') diagnostics.push(t); },
});
console.log(`  consult-phase diagnostics: ${diagnostics.length}`);
diagnostics = [];
engine.prolog.query("qsave_program('prolog.pvm').").once();
console.log(`  save-phase diagnostic lines: ${diagnostics.length}`);
for (const l of diagnostics) console.log(`    ${JSON.stringify(l)}`);
const SAVE_NOISE = /qsave\.pl:\d+:|library\(shlib\)/;
console.log(`  lines matching SAVE_NOISE: ${diagnostics.filter((l) => SAVE_NOISE.test(l)).length}`);
console.log(`  lines mentioning library(shlib): ${diagnostics.filter((l) => l.includes('library(shlib)')).length}`);
console.log(`  survivors after the filter: ${JSON.stringify(diagnostics.filter((l) => !SAVE_NOISE.test(l)))}`);

console.log('--- U12: runtime-consult path treats the same text as fatal ---');
const qlf = await buildQlf(one);
console.log(`  verifyQlf(clean qlf)  -> ${JSON.stringify(await verifyQlf(qlf).then((c) => c.documents, (e) => `REFUSED ${e.message.slice(0, 60)}`))}`);
const img = (await buildImage(one)).image;
console.log(`  verifyImage(clean)    -> ${JSON.stringify(await verifyImage(img).then((c) => c.documents, (e) => `REFUSED ${e.message.slice(0, 60)}`))}`);
console.log(`  readContract exported = ${typeof readContract === 'function'}`);
