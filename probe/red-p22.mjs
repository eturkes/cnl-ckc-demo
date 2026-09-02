// RED at base 6132bc6. Acceptance check for the U11 defect.
//
// P2.2: "Before saving the image, the producer MUST assert inside the building
// engine that `guideline_schema_version` reports schema 1 and that exactly 337
// `guideline_document/3` documents are loaded, and MUST abort nonzero otherwise."
//
// `requireLoaded` (produce.mjs:143-151) only asserts schemaVersion >= 1 and
// documents >= 1, so a short or wrong-schema corpus is saved and recorded.
// The only 337/schema-1 guard in the repo is tests/kb-live.test.ts, which runs
// after kb:build has already written every artifact and the manifest.
//
// rc 0 = fixed, rc 1 = defect present.
import { readFileSync } from 'node:fs';
import { verifyBag } from '../tools/kb/bag.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

const { files } = verifyBag(readFileSync('kb/cnl-ckc-kb-g952cc950a0c6.tar.gz'));
const { names } = payloadSource(files);
const join = (list) => list.map((n) => `\n% file:${n}\n${Buffer.from(files.get(n)).toString('utf8')}`).join('\n');

const failures = [];
const mustRefuse = async (label, source) => {
  try {
    const { contract } = await buildImage(source);
    failures.push(`${label}: saved an image reporting schema ${contract.schemaVersion} / ${contract.documents} documents`);
  } catch {
    /* refused, as P2.2 requires */
  }
};

await mustRefuse('one payload file dropped', join(names.slice(0, -1)));
await mustRefuse('single payload file', join(names.slice(0, 1)));
await mustRefuse('schema version 2', join(names.slice(0, 1)).replace(/guideline_schema_version\(1\)/g, 'guideline_schema_version(2)'));

// Control: the real corpus must still build, so the check cannot pass by refusing everything.
try {
  const { contract } = await buildImage(join(names));
  if (contract.documents !== 337 || contract.schemaVersion !== 1) {
    failures.push(`control: real corpus reported ${contract.schemaVersion}/${contract.documents}`);
  }
} catch (error) {
  failures.push(`control: real corpus was refused — ${error.message.split('\n')[0]}`);
}

if (failures.length > 0) {
  process.stderr.write(`red-p22 FAILED (defect present) —\n${failures.map((l) => `  ${l}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('red-p22 ok — the producer asserts schema 1 and exactly 337 documents before qsave_program\n');
}
