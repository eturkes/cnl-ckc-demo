// Hostile-input battery for the bag reader. Every archive here is synthesized in
// memory by this file, so a fixture can never drift from what it claims to test.

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { BagError, readBag, verifyBag } from '../tools/kb/bag.mjs';

const BLOCK = 512;
const ROOT = 'bag';

const sha = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

interface Entry {
  name: string;
  data?: string;
  typeflag?: string;
  magic?: string;
  /** Overrides the size header without changing the payload. */
  declaredSize?: number;
  corruptChecksum?: boolean;
}

const header = (entry: Entry, size: number): Uint8Array => {
  const block = Buffer.alloc(BLOCK);
  block.write(entry.name.slice(0, 100), 0, 'utf8');
  block.write('0000644\0', 100);
  block.write('0000000\0', 108);
  block.write('0000000\0', 116);
  block.write(`${(entry.declaredSize ?? size).toString(8).padStart(11, '0')}\0`, 124);
  block.write('00000000000\0', 136);
  block.write(entry.typeflag ?? '0', 156);
  block.write(entry.magic ?? 'ustar\0', 257, 'binary');
  block.write('00', 263);
  block.write('        ', 148);
  let sum = 0;
  for (const byte of block) sum += byte;
  if (entry.corruptChecksum) sum += 1;
  block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return block;
};

/** Serialize entries as a gzipped GNU-compatible ustar stream. */
const tar = (entries: Entry[], { endMarker = true } = {}): Uint8Array => {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? '', 'utf8');
    const long = entry.name.length > 100;
    if (long) {
      const nameBytes = Buffer.concat([Buffer.from(entry.name, 'utf8'), Buffer.alloc(1)]);
      parts.push(header({ name: '././@LongLink', typeflag: 'L' }, nameBytes.byteLength));
      parts.push(nameBytes, Buffer.alloc((BLOCK - (nameBytes.byteLength % BLOCK)) % BLOCK));
    }
    parts.push(header(entry, data.byteLength));
    if (data.byteLength > 0) {
      parts.push(data, Buffer.alloc((BLOCK - (data.byteLength % BLOCK)) % BLOCK));
    }
  }
  if (endMarker) parts.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(parts));
};

const PAYLOAD = 'data/guidelines/g/pl/doc.pl';
const PAYLOAD_BODY = 'guideline_schema_version(1).\n';
const DECLARATION = 'BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n';
const NOTICE = 'notice\n';

/** A complete, valid bag, optionally mutated before serialization. */
const wellFormed = (mutate: (entries: Entry[]) => Entry[] = (entries) => entries): Uint8Array => {
  const manifest = `${sha(PAYLOAD_BODY)}  ${PAYLOAD}\n`;
  const tagManifest =
    `${sha(DECLARATION)}  bagit.txt\n` +
    `${sha(NOTICE)}  NOTICE\n` +
    `${sha(manifest)}  manifest-sha256.txt\n`;
  return tar(
    mutate([
      { name: `${ROOT}/bagit.txt`, data: DECLARATION },
      { name: `${ROOT}/NOTICE`, data: NOTICE },
      { name: `${ROOT}/manifest-sha256.txt`, data: manifest },
      { name: `${ROOT}/tagmanifest-sha256.txt`, data: tagManifest },
      { name: `${ROOT}/${PAYLOAD}`, data: PAYLOAD_BODY },
    ]),
  );
};

const reasonOf = (run: () => unknown): string => {
  try {
    run();
    return 'accepted';
  } catch (error) {
    return error instanceof BagError ? error.reason : `other: ${String(error)}`;
  }
};

describe('bag reader', () => {
  it('accepts the well-formed bag it is given', () => {
    const { root, files, payload, tags } = verifyBag(wellFormed());
    expect(root).toBe(ROOT);
    expect(payload).toEqual([PAYLOAD]);
    expect(tags).toEqual(['NOTICE', 'bagit.txt', 'manifest-sha256.txt']);
    expect(files.get(PAYLOAD)).toBeDefined();
  });

  it('reads a GNU long name and holds it to the same rules', () => {
    const long = `${ROOT}/data/guidelines/g/pl/${'n'.repeat(90)}.pl`;
    const { files } = readBag(tar([{ name: long, data: 'x' }]));
    expect([...files.keys()]).toEqual([long.slice(ROOT.length + 1)]);
    expect(
      reasonOf(() => readBag(tar([{ name: `${ROOT}/../${'e'.repeat(100)}`, data: 'x' }]))),
    ).toBe('dotdot-segment');
  });

  const refusals: [string, string, () => Uint8Array][] = [
    [
      'a traversal segment',
      'dotdot-segment',
      () => tar([{ name: `${ROOT}/../escape.pl`, data: 'x' }]),
    ],
    ['an absolute path', 'absolute-path', () => tar([{ name: '/etc/passwd', data: 'x' }])],
    [
      'a symlink entry',
      'unsupported-typeflag',
      () => tar([{ name: `${ROOT}/link`, typeflag: '2' }]),
    ],
    [
      'a hardlink entry',
      'unsupported-typeflag',
      () => tar([{ name: `${ROOT}/link`, typeflag: '1' }]),
    ],
    [
      'a character device',
      'unsupported-typeflag',
      () => tar([{ name: `${ROOT}/dev`, typeflag: '3' }]),
    ],
    ['a fifo entry', 'unsupported-typeflag', () => tar([{ name: `${ROOT}/fifo`, typeflag: '6' }])],
    [
      'a PAX extended header',
      'unsupported-typeflag',
      () => tar([{ name: `${ROOT}/pax`, typeflag: 'x', data: 'p' }]),
    ],
    [
      'a duplicate member',
      'duplicate-name',
      () =>
        tar([
          { name: `${ROOT}/a.pl`, data: 'x' },
          { name: `${ROOT}/a.pl`, data: 'y' },
        ]),
    ],
    ['a control character', 'control-char', () => tar([{ name: `${ROOT}/a\u0001.pl`, data: 'x' }])],
    ['a backslash', 'backslash', () => tar([{ name: `${ROOT}/a\\b.pl`, data: 'x' }])],
    ['a file at archive root', 'root-file', () => tar([{ name: 'loose.pl', data: 'x' }])],
    [
      'two roots',
      'multiple-roots',
      () =>
        tar([
          { name: `${ROOT}/a.pl`, data: 'x' },
          { name: 'other/b.pl', data: 'y' },
        ]),
    ],
    [
      'a corrupt header checksum',
      'bad-checksum',
      () => tar([{ name: `${ROOT}/a.pl`, data: 'x', corruptChecksum: true }]),
    ],
    [
      'a foreign magic',
      'bad-magic',
      () => tar([{ name: `${ROOT}/a.pl`, data: 'x', magic: 'xxxxx\0' }]),
    ],
    [
      'a size past the end of the stream',
      'bad-size',
      () => tar([{ name: `${ROOT}/a.pl`, data: 'x', declaredSize: 1 << 20 }]),
    ],
    [
      'a missing end marker',
      'no-end-marker',
      () => tar([{ name: `${ROOT}/a.pl`, data: 'x' }], { endMarker: false }),
    ],
    [
      'a dangling long name',
      'long-name',
      () => tar([{ name: '././@LongLink', typeflag: 'L', data: `${ROOT}/a.pl\0` }]),
    ],
    [
      'an oversized long name',
      'long-name',
      () => tar([{ name: '././@LongLink', typeflag: 'L', data: 'z'.repeat(5000) }]),
    ],
    ['an empty archive', 'empty-archive', () => tar([])],
    [
      'repeated traversal segments',
      'dotdot-segment',
      () => tar([{ name: `${ROOT}/a/../a/../a.pl`, data: 'x' }]),
    ],
    [
      // Truncating at the interior NUL would hand back an accepted name.
      'a NUL inside a GNU long name',
      'control-char',
      () =>
        tar([{ name: `${ROOT}/data/guidelines/g/pl/${'n'.repeat(80)}\u0000evil.pl`, data: 'x' }]),
    ],
    [
      'a truncated gzip stream',
      'truncated',
      () => tar([{ name: `${ROOT}/a.pl`, data: 'x' }]).slice(0, 20),
    ],
  ];

  it.each(refusals)('refuses %s', (_what, reason, build) => {
    expect(reasonOf(() => readBag(build()))).toBe(reason);
  });

  const bagRefusals: [string, string, () => Uint8Array][] = [
    [
      'a payload byte flip',
      'digest-mismatch',
      () =>
        wellFormed((entries) =>
          entries.map((e) => (e.name.endsWith('doc.pl') ? { ...e, data: 'tampered\n' } : e)),
        ),
    ],
    [
      'a tag byte flip',
      'digest-mismatch',
      () =>
        wellFormed((entries) =>
          entries.map((e) => (e.name.endsWith('NOTICE') ? { ...e, data: 'tampered\n' } : e)),
        ),
    ],
    [
      'an unlisted payload file',
      'unlisted-payload',
      () =>
        wellFormed((entries) => [
          ...entries,
          { name: `${ROOT}/data/guidelines/g/pl/extra.pl`, data: 'x' },
        ]),
    ],
    [
      'a manifest entry with no member',
      'missing-member',
      () => wellFormed((entries) => entries.filter((e) => !e.name.endsWith('doc.pl'))),
    ],
    [
      'an unlisted tag file',
      'unlisted-payload',
      () => wellFormed((entries) => [...entries, { name: `${ROOT}/EXTRA.txt`, data: 'x' }]),
    ],
    [
      'an older BagIt version',
      'bagit-version',
      () =>
        wellFormed((entries) =>
          entries.map((e) =>
            e.name.endsWith('bagit.txt') ? { ...e, data: 'BagIt-Version: 0.97\n' } : e,
          ),
        ),
    ],
    [
      'a missing declaration',
      'bagit-missing',
      () => wellFormed((entries) => entries.filter((e) => !e.name.endsWith('bagit.txt'))),
    ],
    [
      'a missing payload manifest',
      'manifest-missing',
      () =>
        wellFormed((entries) => entries.filter((e) => !e.name.endsWith('/manifest-sha256.txt'))),
    ],
    [
      'a malformed manifest line',
      'manifest-line',
      () =>
        wellFormed((entries) =>
          entries.map((e) =>
            e.name.endsWith('/manifest-sha256.txt') ? { ...e, data: 'not-a-digest line\n' } : e,
          ),
        ),
    ],
    [
      'an edited manifest digest',
      'digest-mismatch',
      () =>
        wellFormed((entries) =>
          entries.map((e) =>
            e.name.endsWith('/manifest-sha256.txt')
              ? { ...e, data: `${sha('other')}  ${PAYLOAD}\n` }
              : e,
          ),
        ),
    ],
    [
      'a payload manifest reaching outside data/',
      'manifest-line',
      () =>
        wellFormed((entries) =>
          entries.map((e) =>
            e.name.endsWith('/manifest-sha256.txt') ? { ...e, data: `${sha('x')}  NOTICE\n` } : e,
          ),
        ),
    ],
  ];

  it.each(bagRefusals)('refuses %s', (_what, reason, build) => {
    expect(reasonOf(() => verifyBag(build()))).toBe(reason);
  });

  it('refuses rather than repairs: the offending name is reported unchanged', () => {
    for (const hostile of [
      `${ROOT}/../escape.pl`,
      '/abs.pl',
      `${ROOT}/a\\b.pl`,
      `${ROOT}/a/../a/../a.pl`,
    ]) {
      let caught: unknown;
      try {
        readBag(tar([{ name: hostile, data: 'x' }]));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(BagError);
      expect((caught as BagError).detail).toContain(hostile);
    }
  });
});
