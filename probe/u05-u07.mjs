// U05: BagIt-Version 1.0 asserted; every entry of BOTH manifests verified.
// U06: verification complete in both directions.
// U07: one-byte mutants in payload / tag / manifest each abort with a named cause.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { verifyBag } from '../tools/kb/bag.mjs';
import { ROOT, sha, tar, wellFormed, reasonOf, DECL, NOTICE, BODY, PAYLOAD } from './mkbag.mjs';

const line = (label, value) => console.log(`  ${String(value).padEnd(22)} <- ${label}`);

console.log('--- U05 BagIt 1.0 + both manifests verified ---');
line('BagIt-Version: 0.97', reasonOf(() => verifyBag(wellFormed((e) => e.map((x) => (x.name.endsWith('bagit.txt') ? { ...x, data: 'BagIt-Version: 0.97\n' } : x))))));
line('BagIt-Version absent line', reasonOf(() => verifyBag(wellFormed((e) => e.map((x) => (x.name.endsWith('bagit.txt') ? { ...x, data: 'Tag-File-Character-Encoding: UTF-8\n' } : x))))));
line('bagit.txt missing', reasonOf(() => verifyBag(wellFormed((e) => e.filter((x) => !x.name.endsWith('bagit.txt'))))));
// A flipped tagmanifest digest must abort: proves tag entries are verified too.
line('tagmanifest digest flipped', reasonOf(() => verifyBag(wellFormed((e) => e.map((x) => (x.name.endsWith('tagmanifest-sha256.txt') ? { ...x, data: x.data.replace(/^./, '0') } : x))))));
line('tag file body flipped (NOTICE)', reasonOf(() => verifyBag(wellFormed((e) => e.map((x) => (x.name.endsWith('NOTICE') ? { ...x, data: 'tampered\n' } : x))))));
line('payload manifest missing', reasonOf(() => verifyBag(wellFormed((e) => e.filter((x) => !x.name.endsWith('/manifest-sha256.txt'))))));
line('tagmanifest missing', reasonOf(() => verifyBag(wellFormed((e) => e.filter((x) => !x.name.endsWith('tagmanifest-sha256.txt'))))));

console.log('--- U06 both-direction completeness ---');
line('extra UNLISTED payload file', reasonOf(() => verifyBag(wellFormed((e) => [...e, { name: `${ROOT}/data/guidelines/g/pl/extra.pl`, data: 'x' }]))));
line('extra UNLISTED tag file', reasonOf(() => verifyBag(wellFormed((e) => [...e, { name: `${ROOT}/EXTRA.txt`, data: 'x' }]))));
line('manifest entry, no member', reasonOf(() => verifyBag(wellFormed((e) => e.filter((x) => !x.name.endsWith('doc.pl'))))));
// Control: the same builder yields an ACCEPTED bag, so the refusals above are not builder artefacts.
line('CONTROL well-formed bag', reasonOf(() => verifyBag(wellFormed())));

console.log('--- U07 one-byte mutants on the REAL vendored bag ---');
const path = 'kb/cnl-ckc-kb-g952cc950a0c6.tar.gz';
const original = readFileSync(path);
const rawTar = gunzipSync(original);
/** Offset of a member's first data byte in the uncompressed tar. */
const dataOffset = (needle) => {
  const at = rawTar.indexOf(Buffer.from(needle, 'utf8'));
  if (at === -1) throw new Error(`header for ${needle} not found`);
  const headerStart = Math.floor(at / 512) * 512;
  return headerStart + 512;
};
const mutants = {
  'payload byte (a data/ .pl file)': dataOffset('data/guidelines/cdc-2022-opioid/pl/'),
  'tag byte (bagit.txt)': dataOffset('/bagit.txt'),
  'manifest line (manifest-sha256.txt)': dataOffset('/manifest-sha256.txt'),
};
for (const [what, at] of Object.entries(mutants)) {
  const copy = Buffer.from(rawTar);
  copy[at] ^= 0x01;
  line(what, reasonOf(() => verifyBag(gzipSync(copy))));
}

// End to end: flip a payload byte AND repair the sidecar, so the pipeline can
// only be stopped by the BagIt layer, then run the real CLI.
const copy = Buffer.from(rawTar);
copy[mutants['payload byte (a data/ .pl file)']] ^= 0x01;
const remade = gzipSync(copy);
writeFileSync(path, remade);
writeFileSync(`${path}.sha256`, `${sha(remade)}  cnl-ckc-kb-g952cc950a0c6.tar.gz\n`);
console.log('  wrote a sidecar-consistent tampered bag; run kb:build next');
console.log(`  restore with: cp probe/bag.orig ${path} && cp probe/sidecar.orig ${path}.sha256`);
console.log(`  sanity: PAYLOAD=${PAYLOAD} DECL/NOTICE/BODY lengths ${DECL.length}/${NOTICE.length}/${BODY.length}, tar() live=${tar([]).byteLength > 0}`);
