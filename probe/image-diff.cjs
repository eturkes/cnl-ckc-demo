'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { inflateRawSync } = require('node:zlib');
const { generateImageBuffer } = require('swipl-wasm/dist/generateImage');

const kbDir = process.env.KB_PL_DIR || process.argv[2];
const outputDir = resolve(process.argv[3] || 'probe/results/s2');
if (!kbDir) throw new Error('set KB_PL_DIR or pass the payload directory');

const source = readdirSync(kbDir)
  .filter((name) => name.endsWith('.pl'))
  .sort()
  .map((name) => `\n% file:${name}\n${readFileSync(`${kbDir}/${name}`, 'utf8')}\n`)
  .join('');

function describe(value) {
  const buffer = Buffer.from(value);
  return { sha256: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

function window(value, offset, radius = 32) {
  const buffer = Buffer.from(value);
  const start = Math.max(0, offset - radius);
  const end = Math.min(buffer.length, offset + radius + 1);
  const bytes = buffer.subarray(start, end);
  return {
    start,
    end,
    hex: bytes.toString('hex'),
    ascii: [...bytes].map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')).join(''),
  };
}

function difference(aValue, bValue, includeOffsets = true) {
  const a = Buffer.from(aValue);
  const b = Buffer.from(bValue);
  const offsets = [];
  for (let offset = 0; offset < Math.max(a.length, b.length); offset += 1) {
    if (a[offset] !== b[offset]) offsets.push(offset);
  }
  const ranges = [];
  for (const offset of offsets) {
    const last = ranges.at(-1);
    if (last && offset === last[1] + 1) last[1] = offset;
    else ranges.push([offset, offset]);
  }
  let commonPrefixBytes = 0;
  while (commonPrefixBytes < Math.min(a.length, b.length) && a[commonPrefixBytes] === b[commonPrefixBytes]) {
    commonPrefixBytes += 1;
  }
  let commonSuffixBytes = 0;
  while (
    commonSuffixBytes < Math.min(a.length, b.length) - commonPrefixBytes &&
    a[a.length - 1 - commonSuffixBytes] === b[b.length - 1 - commonSuffixBytes]
  ) {
    commonSuffixBytes += 1;
  }
  return {
    differingOffsetCount: offsets.length,
    ...(includeOffsets ? { offsets } : {}),
    ranges,
    commonPrefixBytes,
    commonSuffixBytes,
    aFirstWindow: window(a, offsets[0]),
    bFirstWindow: window(b, offsets[0]),
    aLastWindow: window(a, offsets.at(-1)),
    bLastWindow: window(b, offsets.at(-1)),
  };
}

function zipEntries(value) {
  const archive = Buffer.from(value);
  const entries = {};
  let offset = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const compression = archive.readUInt16LE(offset + 8);
    const dosTime = archive.readUInt16LE(offset + 10);
    const dosDate = archive.readUInt16LE(offset + 12);
    const compressedBytes = archive.readUInt32LE(offset + 18);
    const uncompressedBytes = archive.readUInt32LE(offset + 22);
    const nameBytes = archive.readUInt16LE(offset + 26);
    const extraBytes = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 30, offset + 30 + nameBytes).toString('utf8');
    const dataOffset = offset + 30 + nameBytes + extraBytes;
    const compressed = archive.subarray(dataOffset, dataOffset + compressedBytes);
    const content = compression === 8 ? inflateRawSync(compressed) : compressed;
    entries[name] = {
      localHeaderOffset: offset,
      dosTime,
      dosDate,
      compressedBytes,
      uncompressedBytes,
      content,
      ...describe(content),
    };
    offset = dataOffset + compressedBytes;
  }
  return entries;
}

function stateMtime(state) {
  const path = Buffer.from('/prolog.pl');
  const pathOffset = state.indexOf(path);
  const offset = pathOffset + path.length;
  return { pathOffset, offset, littleEndianDoubleSeconds: state.readDoubleLE(offset), bytesHex: state.subarray(offset, offset + 8).toString('hex') };
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const a = Buffer.from(await generateImageBuffer(source));
  const b = Buffer.from(await generateImageBuffer(source));
  writeFileSync(`${outputDir}/a.pvm`, a);
  writeFileSync(`${outputDir}/b.pvm`, b);
  const aEntries = zipEntries(a);
  const bEntries = zipEntries(b);
  const entryNames = Object.keys(aEntries);
  const entries = Object.fromEntries(
    entryNames.map((name) => {
      const left = aEntries[name];
      const right = bEntries[name];
      return [name, {
        a: { ...left, content: undefined },
        b: { ...right, content: undefined },
        difference: difference(left.content, right.content),
        ...(name === '$prolog/state.qlf' ? { aMtime: stateMtime(left.content), bMtime: stateMtime(right.content) } : {}),
      }];
    }),
  );
  process.stdout.write(`${JSON.stringify({ a: describe(a), b: describe(b), difference: difference(a, b, false), entries }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
