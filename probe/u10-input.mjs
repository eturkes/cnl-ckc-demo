// U10: recompute the concatenated-input digest independently of paths.mjs and
// compare against the manifest's input.sha256, plus prove the order is fixed.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const sha = (d) => createHash('sha256').update(d).digest('hex');
const manifest = JSON.parse(readFileSync('kb/generated/kb-manifest.json', 'utf8'));

// Independent tar walk: no import from tools/kb/.
const raw = gunzipSync(readFileSync('kb/cnl-ckc-kb-g952cc950a0c6.tar.gz'));
const members = new Map();
let offset = 0;
let longName;
while (offset + 512 <= raw.length) {
  const block = raw.subarray(offset, offset + 512);
  if (block.every((b) => b === 0)) break;
  const str = (at, len) => {
    const s = block.subarray(at, at + len);
    const end = s.indexOf(0);
    return Buffer.from(end === -1 ? s : s.subarray(0, end)).toString('utf8');
  };
  const flag = str(156, 1) || '0';
  const size = Number.parseInt(str(124, 12).trim() || '0', 8);
  const start = offset + 512;
  if (flag === 'L') {
    longName = Buffer.from(raw.subarray(start, start + size)).toString('utf8').replace(/\0+$/, '');
  } else {
    const prefix = str(345, 155);
    const base = str(0, 100);
    const name = longName ?? (prefix === '' ? base : `${prefix}/${base}`);
    longName = undefined;
    if (flag === '0') members.set(name, raw.subarray(start, start + size));
  }
  offset = start + Math.ceil(size / 512) * 512;
}
const root = [...members.keys()][0].split('/')[0];
const rel = [...members.keys()].map((n) => n.slice(root.length + 1));

const PL = /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/;
const names = rel.filter((n) => PL.test(n)).sort();
const source = names
  .map((n) => `\n% file:${n}\n${Buffer.from(members.get(`${root}/${n}`)).toString('utf8')}`)
  .join('\n');

console.log(`payload pl/ files       = ${names.length} (manifest input.files = ${manifest.input.files})`);
console.log(`recomputed input bytes  = ${Buffer.byteLength(source, 'utf8')} (manifest = ${manifest.input.bytes})`);
console.log(`recomputed input sha256 = ${sha(Buffer.from(source, 'utf8'))}`);
console.log(`manifest  input.sha256  = ${manifest.input.sha256}`);
console.log(`MATCH = ${sha(Buffer.from(source, 'utf8')) === manifest.input.sha256}`);
console.log(`sorted order is code-fixed: first=${names[0]}  last=${names[names.length - 1]}`);

// Order sensitivity: reversing the order must change the digest, proving the
// digest identifies the ORDER, not just the file set.
const reversed = [...names]
  .reverse()
  .map((n) => `\n% file:${n}\n${Buffer.from(members.get(`${root}/${n}`)).toString('utf8')}`)
  .join('\n');
console.log(`reversed-order digest differs = ${sha(Buffer.from(reversed, 'utf8')) !== manifest.input.sha256}`);
// Marker sensitivity: dropping the `% file:` markers must change the digest too.
const unmarked = names.map((n) => Buffer.from(members.get(`${root}/${n}`)).toString('utf8')).join('\n');
console.log(`marker-free digest differs   = ${sha(Buffer.from(unmarked, 'utf8')) !== manifest.input.sha256}`);
