// rel-u2: the KB enters as a `cnl-ckc` release alone. `kb/` holds the archive and sidecar the
// release `kb/release.json` names, and `vendor/cnl-ckc/` holds the upstream sources the rules cite,
// each file at its git blob hash in the tag's commit. The network half is `pnpm kb:fetch --verify`;
// this suite grades what committed state alone can decide, and the intake's own graders.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  gitBlobSha,
  gradeAssetDigest,
  gradeRecord,
  gradeSidecar,
  gradeVendored,
  readRecord,
  readTree,
  selectAssets,
  VENDOR_DIR,
  VENDOR_MANIFEST,
  vendoredEntries,
} from '../tools/kb/release.mjs';

import { ROOT } from './clinical-test-support.js';

const record = readRecord();
const kbFiles = new Map(
  readdirSync(join(ROOT, 'kb'))
    .filter((name) => name.endsWith('.tar.gz') || name.endsWith('.tar.gz.sha256'))
    .map((name) => [name, new Uint8Array(readFileSync(join(ROOT, 'kb', name)))] as const),
);
const archive = kbFiles.get(record.archive) ?? new Uint8Array();
const vendored = readTree(VENDOR_DIR);
const provenance = Buffer.from(vendored.get(VENDOR_MANIFEST) ?? []).toString('utf8');
const hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('KB release intake', () => {
  it('R1 kb/release.json names the vendored archive, its sidecar, its digest and its bag root', () => {
    expect(record).toMatchObject({ repository: 'eturkes/cnl-ckc', tag: 'kb-2026-10-29-rc.1' });
    expect(gradeRecord(record, kbFiles)).toEqual([]);
    expect(gradeRecord({ ...record, bag: 'cnl-ckc-kb-g000000000000' }, kbFiles)).toEqual([
      `bag root ${record.bag}, release.json records cnl-ckc-kb-g000000000000`,
    ]);
    expect(gradeRecord({ ...record, sha256: '0'.repeat(64) }, kbFiles)).toEqual([
      `sidecar digest ${record.sha256}, release.json records ${'0'.repeat(64)}`,
    ]);
    const renamed = new Map(kbFiles);
    renamed.set(`${record.archive}.sha256`, Buffer.from(`${record.sha256}  another.tar.gz\n`));
    expect(gradeRecord(record, renamed)).toEqual([
      `${record.archive}.sha256: names another.tar.gz, not the archive`,
    ]);
    expect(gradeRecord({ ...record, archive: 'another.tar.gz' }, kbFiles)[0]).toMatch(
      /names another\.tar\.gz$/u,
    );
  });

  it('R2 the vendored upstream tree equals its PROVENANCE.tsv, file by file', () => {
    expect(provenance.split('\n')[0]).toBe(`# ${record.repository} ${record.tag} ${record.commit}`);
    expect(gradeVendored(record, provenance, vendored)).toEqual([]);
    const [first] = [...vendored.keys()].filter((path) => path !== VENDOR_MANIFEST).sort();
    if (first === undefined) throw new Error('vendor/cnl-ckc holds no upstream file');
    const flipped = new Map(vendored);
    const bytes = new Uint8Array(vendored.get(first) ?? []);
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    flipped.set(first, bytes);
    expect(gradeVendored(record, provenance, flipped)).toEqual([
      `${first}: git blob ${gitBlobSha(bytes)}, declared ${gitBlobSha(vendored.get(first) ?? new Uint8Array())}`,
    ]);
    const extra = new Map(vendored).set('stray.txt', new Uint8Array([1]));
    expect(gradeVendored(record, provenance, extra)).toEqual(['stray.txt: vendored, not declared']);
    const missing = new Map(vendored);
    missing.delete(first);
    expect(gradeVendored(record, provenance, missing)).toEqual([
      `${first}: declared, not vendored`,
    ]);
    expect(gradeVendored({ ...record, tag: 'kb-elsewhere' }, provenance, vendored)[0]).toMatch(
      /^PROVENANCE\.tsv: header/u,
    );
  });

  it('R3 every vendor/cnl-ckc path the rules cite is vendored', () => {
    const rules = readFileSync(join(ROOT, '.claude/rules/kb-build.md'), 'utf8');
    const cited = [...rules.matchAll(/`(vendor\/cnl-ckc\/[^`*]+)`/gu)].map(
      (match) => match[1] ?? '',
    );
    expect(cited.length).toBeGreaterThan(3);
    expect(cited.filter((path) => !existsSync(join(ROOT, path)))).toEqual([]);
  });

  it('R4 the intake refuses a release it cannot check, by name', () => {
    const asset = (name: string, digest?: string) => ({
      name,
      browser_download_url: `https://example.invalid/${name}`,
      ...(digest === undefined ? {} : { digest }),
    });
    expect(() => selectAssets([asset('a.tar.gz')])).toThrow('publishes no a.tar.gz.sha256 sidecar');
    expect(() => selectAssets([asset('a.tar.gz'), asset('b.tar.gz')])).toThrow(
      'release publishes 2 .tar.gz assets, expected exactly one',
    );
    expect(selectAssets([asset('a.tar.gz'), asset('a.tar.gz.sha256')]).sidecar.name).toBe(
      'a.tar.gz.sha256',
    );
    expect(() => gradeAssetDigest(asset(record.archive), archive)).toThrow(
      'GitHub records no sha256 digest',
    );
    expect(() =>
      gradeAssetDigest(asset(record.archive, `sha256:${'0'.repeat(64)}`), archive),
    ).toThrow("bytes do not match GitHub's digest");
    expect(() =>
      gradeAssetDigest(asset(record.archive, `sha256:${hex(archive)}`), archive),
    ).not.toThrow();
    expect(() => gradeSidecar('nonsense\n', record.archive, archive)).toThrow(
      'not one sha256sum line',
    );
    expect(() =>
      gradeSidecar(`${'0'.repeat(64)}  ${record.archive}\n`, record.archive, archive),
    ).toThrow('does not digest the archive');
    expect(gradeSidecar(`${hex(archive)}  ${record.archive}\n`, record.archive, archive)).toBe(
      record.sha256,
    );
    expect(() => vendoredEntries([{ path: 'LICENSE', type: 'blob', sha: '0'.repeat(40) }])).toThrow(
      "the tag's tree holds no NOTICE",
    );
    expect(gitBlobSha(new Uint8Array())).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });
});
