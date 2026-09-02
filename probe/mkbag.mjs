// Synthetic gzipped ustar/BagIt builder for review probes. Independent of the
// committed suite so a probe cannot inherit a harness bug from it.
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const BLOCK = 512;
export const ROOT = 'bag';
export const sha = (d) => createHash('sha256').update(d).digest('hex');
export const header = (e, size) => {
  const b = Buffer.alloc(BLOCK);
  b.write(e.name.slice(0, 100), 0, 'binary');
  b.write('0000644\0', 100); b.write('0000000\0', 108); b.write('0000000\0', 116);
  b.write(`${(e.declaredSize ?? size).toString(8).padStart(11, '0')}\0`, 124);
  b.write('00000000000\0', 136);
  b.write(e.typeflag ?? '0', 156);
  b.write(e.magic ?? 'ustar\0', 257, 'binary'); b.write('00', 263);
  if (e.prefix) b.write(e.prefix, 345, 'binary');
  b.write('        ', 148);
  let sum = 0; for (const byte of b) sum += byte;
  if (e.corruptChecksum) sum += 1;
  b.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return b;
};
export const tar = (entries, { endMarker = true } = {}) => {
  const parts = [];
  for (const e of entries) {
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data ?? '', 'binary');
    if (e.name.length > 100 && !e.noLong) {
      const nb = Buffer.concat([Buffer.from(e.name, 'binary'), Buffer.alloc(1)]);
      parts.push(header({ name: '././@LongLink', typeflag: 'L' }, nb.byteLength));
      parts.push(nb, Buffer.alloc((BLOCK - (nb.byteLength % BLOCK)) % BLOCK));
    }
    parts.push(header(e, data.byteLength));
    if (data.byteLength > 0) parts.push(data, Buffer.alloc((BLOCK - (data.byteLength % BLOCK)) % BLOCK));
  }
  if (endMarker) parts.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(parts));
};
export const PAYLOAD = 'data/guidelines/g/pl/doc.pl';
export const BODY = 'guideline_schema_version(1).\n';
export const DECL = 'BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n';
export const NOTICE = 'notice\n';
export const wellFormed = (mutate = (e) => e, opts) => {
  const manifest = `${sha(BODY)}  ${PAYLOAD}\n`;
  const tagManifest = `${sha(DECL)}  bagit.txt\n${sha(NOTICE)}  NOTICE\n${sha(manifest)}  manifest-sha256.txt\n`;
  return tar(mutate([
    { name: `${ROOT}/bagit.txt`, data: DECL },
    { name: `${ROOT}/NOTICE`, data: NOTICE },
    { name: `${ROOT}/manifest-sha256.txt`, data: manifest },
    { name: `${ROOT}/tagmanifest-sha256.txt`, data: tagManifest },
    { name: `${ROOT}/${PAYLOAD}`, data: BODY },
  ]), opts);
};
export const reasonOf = (run) => {
  try { run(); return 'ACCEPTED'; } catch (e) { return e?.name === 'BagError' ? e.reason : `other:${e?.message}`; }
};
export const detailOf = (run) => { try { run(); return null; } catch (e) { return e?.detail ?? e?.message; } };
