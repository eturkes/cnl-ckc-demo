// Pins the exact shape of the NUL-in-long-name outcome: refusal, or repair?
import { readBag, verifyBag } from '../tools/kb/bag.mjs';
import { ROOT, tar, sha, reasonOf, PAYLOAD, BODY, DECL, NOTICE } from './mkbag.mjs';

const NUL = String.fromCharCode(0);
const CTRL = String.fromCharCode(1);
const pad = 'n'.repeat(80);

const hostile = `${ROOT}/data/g/pl/${pad}${NUL}evil.pl`;
console.log('--- readBag on a long name carrying an embedded NUL ---');
console.log('  declared name :', JSON.stringify(hostile));
try {
  const { root, files } = readBag(tar([{ name: hostile, data: 'x' }]));
  console.log('  OUTCOME       : ACCEPTED');
  console.log('  root          :', JSON.stringify(root));
  console.log('  stored as     :', JSON.stringify([...files.keys()]));
  console.log('  name rewritten:', JSON.stringify([...files.keys()][0]) !== JSON.stringify(hostile.slice(ROOT.length + 1)));
} catch (e) {
  console.log('  OUTCOME       : refused', e.reason);
}

console.log('--- control char (non-NUL) in a long name ---');
console.log('  ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/data/g/pl/${pad}${CTRL}evil.pl`, data: 'x' }]))));

console.log('--- NUL truncation used to smuggle a name past safeName ---');
// The truncated stem is what lands in the map; the tail after the NUL is dropped.
for (const tail of ['/../../../../etc/passwd', '..', '/x']) {
  const n = `${ROOT}/data/g/pl/${pad}.pl${NUL}${tail}`;
  let out;
  try {
    out = JSON.stringify([...readBag(tar([{ name: n, data: 'x' }])).files.keys()]);
  } catch (e) {
    out = `refused ${e.reason}`;
  }
  console.log(`  tail=${JSON.stringify(tail).padEnd(28)} -> ${out}`);
}

console.log('--- full verifyBag on a bag whose manifest lists the TRUNCATED name ---');
// Worst case for the project: does a NUL-bearing member survive end-to-end?
const truncated = `data/g/pl/${pad}.pl`;
const realName = `${ROOT}/${truncated}${NUL}${'z'.repeat(40)}`;
const manifest = `${sha(BODY)}  ${truncated}\n`;
const tagManifest = `${sha(DECL)}  bagit.txt\n${sha(NOTICE)}  NOTICE\n${sha(manifest)}  manifest-sha256.txt\n`;
const bag = tar([
  { name: `${ROOT}/bagit.txt`, data: DECL },
  { name: `${ROOT}/NOTICE`, data: NOTICE },
  { name: `${ROOT}/manifest-sha256.txt`, data: manifest },
  { name: `${ROOT}/tagmanifest-sha256.txt`, data: tagManifest },
  { name: realName, data: BODY },
]);
try {
  const { payload } = verifyBag(bag);
  console.log('  OUTCOME: bag VERIFIES; payload =', JSON.stringify(payload));
} catch (e) {
  console.log('  OUTCOME: refused', e.reason, '/', e.detail);
}

console.log('--- control: same bag with the manifest listing the REAL (NUL-bearing) name ---');
const m2 = `${sha(BODY)}  ${truncated}${NUL}${'z'.repeat(40)}\n`;
const t2 = `${sha(DECL)}  bagit.txt\n${sha(NOTICE)}  NOTICE\n${sha(m2)}  manifest-sha256.txt\n`;
console.log(
  '  ->',
  reasonOf(() =>
    verifyBag(
      tar([
        { name: `${ROOT}/bagit.txt`, data: DECL },
        { name: `${ROOT}/NOTICE`, data: NOTICE },
        { name: `${ROOT}/manifest-sha256.txt`, data: m2 },
        { name: `${ROOT}/tagmanifest-sha256.txt`, data: t2 },
        { name: realName, data: BODY },
      ]),
    ),
  ),
);
console.log('--- sanity: the well-formed PAYLOAD constant still verifies ---');
console.log('  ->', reasonOf(() => verifyBag(tar([]))), '(empty archive control)', PAYLOAD);
