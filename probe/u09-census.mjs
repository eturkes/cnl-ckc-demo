// U09: real-bag member census + GNU `L` long-name handling.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readBag, verifyBag } from '../tools/kb/bag.mjs';

const bytes = readFileSync('kb/cnl-ckc-kb-g952cc950a0c6.tar.gz');
const { root, files, payload, tags } = verifyBag(bytes);
const all = [...files.keys()];
const data = all.filter((n) => n.startsWith('data/'));
const tag = all.filter((n) => !n.startsWith('data/'));
console.log(`root=${root}`);
console.log(`members(regular)=${all.length}  payload(data/)=${data.length}  tag=${tag.length}`);
console.log(`manifest-listed payload=${payload.length}  tagmanifest-listed=${tags.length}`);
console.log(`tag members: ${tag.sort().join(', ')}`);
console.log(`payload+tag+tagmanifest = ${data.length} + ${tags.length} + 1 = ${data.length + tags.length + 1}`);
console.log(`names >100 chars (need a GNU L header): ${all.filter((n) => `${root}/${n}`.length > 100).length}`);
for (const n of all.filter((x) => `${root}/${x}`.length > 100).sort()) console.log(`  ${`${root}/${n}`.length} ${n}`);

// Count `L` headers directly in the raw stream, independent of the reader.
const tarBytes = gunzipSync(bytes);
let offset = 0;
let longHeaders = 0;
let blocks = 0;
while (offset + 512 <= tarBytes.length) {
  const block = tarBytes.subarray(offset, offset + 512);
  if (block.every((b) => b === 0)) break;
  blocks += 1;
  const flag = String.fromCharCode(block[156] || 0x30);
  const size = Number.parseInt(Buffer.from(block.subarray(124, 136)).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8);
  if (flag === 'L') longHeaders += 1;
  offset += 512 + Math.ceil(size / 512) * 512;
}
console.log(`raw scan: header blocks=${blocks}  GNU L headers=${longHeaders}`);
console.log(`readBag standalone member count = ${readBag(bytes).files.size}`);
