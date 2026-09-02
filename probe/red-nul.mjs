// RED at base 6132bc6. Acceptance check for the U03/U04 defect.
//
// P1.3 requires a distinct typed refusal for a NUL in a member name; P1.4
// requires refusal, not repair. `readBag` cuts a GNU `L` long name at the first
// NUL (bag.mjs:130-132) before `safeName` (bag.mjs:82) can see it, so the member
// is accepted under a silently truncated name. Green = both asserts hold.
//
// rc 0 = fixed, rc 1 = defect present.
import { readBag, verifyBag, BagError } from '../tools/kb/bag.mjs';
import { ROOT, tar, sha, DECL, NOTICE, BODY } from './mkbag.mjs';

const NUL = String.fromCharCode(0);
const stem = `data/g/pl/${'n'.repeat(80)}.pl`;
const declared = `${ROOT}/${stem}${NUL}evil`;
const failures = [];

// 1. readBag must refuse the NUL name with a typed reason, not accept a rewrite.
try {
  const { files } = readBag(tar([{ name: declared, data: 'x' }]));
  failures.push(`readBag accepted a NUL-bearing name, rewritten to ${JSON.stringify([...files.keys()])}`);
} catch (error) {
  if (!(error instanceof BagError) || error.reason !== 'control-char') {
    failures.push(`readBag refused with ${String(error.reason ?? error.message)}, expected control-char`);
  }
}

// 2. The refusal must not be recoverable by listing the truncated name in the
//    manifest: a full bag verification must still refuse.
const manifest = `${sha(BODY)}  ${stem}\n`;
const tagManifest = `${sha(DECL)}  bagit.txt\n${sha(NOTICE)}  NOTICE\n${sha(manifest)}  manifest-sha256.txt\n`;
try {
  verifyBag(
    tar([
      { name: `${ROOT}/bagit.txt`, data: DECL },
      { name: `${ROOT}/NOTICE`, data: NOTICE },
      { name: `${ROOT}/manifest-sha256.txt`, data: manifest },
      { name: `${ROOT}/tagmanifest-sha256.txt`, data: tagManifest },
      { name: declared, data: BODY },
    ]),
  );
  failures.push('verifyBag accepted a whole bag carrying a NUL-bearing member name');
} catch (error) {
  if (!(error instanceof BagError) || error.reason !== 'control-char') {
    failures.push(`verifyBag refused with ${String(error.reason ?? error.message)}, expected control-char`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`red-nul FAILED (defect present) —\n${failures.map((l) => `  ${l}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('red-nul ok — NUL in a GNU long name is refused, not truncated\n');
}
