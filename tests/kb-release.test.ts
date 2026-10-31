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
  gradeTag,
  gradeTagControlled,
  gradeVendored,
  plantedBadSignature,
  readRecord,
  readSigners,
  readTag,
  readTree,
  selectAssets,
  VENDOR_DIR,
  VENDOR_MANIFEST,
  vendoredEntries,
} from '../tools/kb/release.mjs';
import { parseSigners, verifySshSignature } from '../tools/kb/sshsig.mjs';

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
const tag = readTag();
const signers = readSigners();
// An Ed25519 key and two signatures OpenSSH made over one payload (`ssh-keygen -Y sign`), under
// the `git` and `file` namespaces: an oracle independent of the verifier's own format code.
const FIXTURE = join(ROOT, 'tests', 'support', 'sshsig');
const fixture = (name: string): string => readFileSync(join(FIXTURE, name), 'utf8');
/** A signature's SSHSIG fields — key, namespace, reserved, hash, signature — to plant variants of. */
const sshsigFields = (armored: string): Buffer[] => {
  const blob = Buffer.from(armored.trim().split('\n').slice(1, -1).join(''), 'base64');
  const fields: Buffer[] = [];
  for (let at = 10; at < blob.length; at += 4 + (fields.at(-1)?.length ?? 0)) {
    fields.push(blob.subarray(at + 4, at + 4 + blob.readUInt32BE(at)));
  }
  return fields;
};
const wire = (value: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(value.length);
  return Buffer.concat([length, value]);
};
const sshsigBlob = (fields: Buffer[], version = 1, magic = 'SSHSIG'): Buffer => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(version);
  return Buffer.concat([Buffer.from(magic), head, ...fields.map(wire)]);
};
/** The raw signature inside an SSHSIG signature field, past its algorithm name. */
const rawSignature = (field: Buffer | undefined): Buffer =>
  field === undefined ? Buffer.alloc(0) : field.subarray(8 + field.readUInt32BE(0));
const armor = (blob: Buffer): string =>
  [
    '-----BEGIN SSH SIGNATURE-----',
    ...(blob.toString('base64').match(/.{1,70}/gu) ?? []),
    '-----END SSH SIGNATURE-----',
    '',
  ].join('\n');

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
    for (const path of [
      'tests/ui/../../../escaped.txt',
      'tests/ui//x',
      'tests/ui/./x',
      'tests\\ui\\x',
    ]) {
      expect(() => vendoredEntries([{ path, type: 'blob', sha: '0'.repeat(40) }]), path).toThrow(
        "the tag's tree names an unsafe path",
      );
    }
    expect(gitBlobSha(new Uint8Array())).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('R5 the release tag is signed by the pinned signer and vouches for the vendored archive', () => {
    expect(signers.map(({ principal }) => principal)).toEqual(['eturkes@bu.edu']);
    expect(gradeTag(tag, record, signers)).toEqual([]);
    expect(tag.payload.split('\n')).toContain(`${hex(archive)}  ${record.archive}`);
  });

  it('R6 the intake refuses a tag it cannot vouch for, by name', () => {
    const name = `tag ${record.tag}`;
    expect(gradeTag(plantedBadSignature(tag), record, signers)).toEqual([
      `${name}: the signature does not verify against eturkes@bu.edu`,
    ]);
    expect(gradeTag(tag, record, parseSigners(fixture('signers')))).toEqual([
      `${name}: signed by SHA256:eJCtE9CPwkojMIH5YMT37SOZ9lSalScUwojKkmD5zuI, which no pinned signer holds`,
    ]);
    expect(gradeTag(tag, { ...record, commit: '0'.repeat(40) }, signers)).toEqual([
      `${name}: signs commit ${record.commit}, release.json records commit ${'0'.repeat(40)}`,
    ]);
    expect(gradeTag(tag, { ...record, tag: 'kb-other' }, signers)).toEqual([
      `tag kb-other: the signed tag is named ${record.tag}`,
    ]);
    expect(gradeTag(tag, { ...record, sha256: '0'.repeat(64) }, signers)).toEqual([
      `${name}: its body's checksum ${record.sha256} is not the archive's ${'0'.repeat(64)}`,
    ]);
    expect(gradeTag(tag, { ...record, archive: 'other.tar.gz' }, signers)).toEqual([
      `${name}: its body holds 0 checksum lines for other.tar.gz, expected one`,
    ]);
    expect(gradeTag({ ...tag, signature: 'unsigned' }, record, signers)).toEqual([
      `${name}: the signature is not an armored SSH signature`,
    ]);
    // Altered payloads: the signature no longer verifies, and each alteration is named beside it.
    const altered = (payload: string, ...refusals: string[]) => {
      expect(gradeTag({ ...tag, payload }, record, signers), payload.slice(-80)).toEqual([
        `${name}: the signature does not verify against eturkes@bu.edu`,
        ...refusals,
      ]);
    };
    const line = `${record.sha256}  ${record.archive}`;
    altered(`${tag.payload}\ntag kb-other\n`);
    altered(
      tag.payload.replace('type commit', 'type tree'),
      `${name}: signs tree ${record.commit}, release.json records commit ${record.commit}`,
    );
    altered(`${tag.payload}see ${line}\n${line} (twice)\n`);
    altered(
      `${tag.payload}${line}\n`,
      `${name}: its body holds 2 checksum lines for ${record.archive}, expected one`,
    );
    expect(gradeTagControlled(tag, record, signers)).toEqual([]);
    // The control fires beside another refusal, and the grading names that refusal.
    expect(gradeTagControlled(tag, { ...record, sha256: '0'.repeat(64) }, signers)).toEqual([
      `${name}: its body's checksum ${record.sha256} is not the archive's ${'0'.repeat(64)}`,
    ]);
    expect(() => gradeTagControlled(tag, record, [])).toThrow(
      'control did not fire: a flipped signature byte graded clean',
    );
  });

  it('R7 the verifier reads an OpenSSH Ed25519 signature and refuses another namespace', () => {
    const payload = Buffer.from(fixture('payload.txt'), 'utf8');
    const own = parseSigners(fixture('signers'));
    expect(verifySshSignature(payload, fixture('git.sig'), own, 'git')).toBe(
      'fixture@cnl-ckc-demo',
    );
    expect(() => verifySshSignature(payload, fixture('file.sig'), own, 'git')).toThrow(
      'signed in namespace "file", not "git"',
    );
    expect(() =>
      verifySshSignature(
        Buffer.concat([payload, Buffer.from('x')]),
        fixture('git.sig'),
        own,
        'git',
      ),
    ).toThrow('the signature does not verify against fixture@cnl-ckc-demo');
    expect(() => parseSigners('fixture@cnl-ckc-demo ssh-rsa AAAAC3NzaC1lZDI1NTE5\n')).toThrow(
      'is not <principal> <key type> <key>',
    );
    expect(verifySshSignature(payload, fixture('git-sha256.sig'), own, 'git')).toBe(
      'fixture@cnl-ckc-demo',
    );
  });

  it('R8 the verifier refuses a malformed signature or signer line, by name', () => {
    const payload = Buffer.from(fixture('payload.txt'), 'utf8');
    const own = parseSigners(fixture('signers'));
    const fields = sshsigFields(fixture('git.sig'));
    const [key = Buffer.alloc(0), namespace = Buffer.alloc(0), reserved = Buffer.alloc(0)] = fields;
    const raw = rawSignature(fields[4]);
    const check = (blob: Buffer) => () => verifySshSignature(payload, armor(blob), own, 'git');
    expect(check(sshsigBlob(fields))()).toBe('fixture@cnl-ckc-demo');
    const refusals: [Buffer, string][] = [
      [sshsigBlob(fields, 2), 'the signature is not SSHSIG version 1'],
      [Buffer.from('SSHSIG'), 'the signature is not SSHSIG version 1'],
      [sshsigBlob(fields, 1, 'SSHSIX'), 'the signature blob lacks the SSHSIG magic'],
      [
        Buffer.concat([sshsigBlob(fields), Buffer.from([0])]),
        'the signature blob carries trailing bytes',
      ],
      [sshsigBlob(fields).subarray(0, -3), 'the signature blob ends inside a field'],
      [sshsigBlob(fields).subarray(0, 12), 'the signature blob ends inside a length'],
      [sshsigBlob([]), 'the signature blob ends inside a length'],
      [
        sshsigBlob([
          ...fields.slice(0, 4),
          Buffer.concat([fields[4] ?? Buffer.alloc(0), Buffer.from([0])]),
        ]),
        'the signature field carries trailing bytes',
      ],
      [
        sshsigBlob([key, namespace, reserved, Buffer.from('md5'), fields[4] ?? Buffer.alloc(0)]),
        'hash algorithm md5 is not sha256 or sha512',
      ],
      [
        sshsigBlob([
          key,
          namespace,
          reserved,
          fields[3] ?? Buffer.alloc(0),
          Buffer.concat([wire(Buffer.from('ssh-rsa')), wire(raw)]),
        ]),
        'signature algorithm ssh-rsa is not ssh-ed25519',
      ],
    ];
    for (const [blob, refusal] of refusals) expect(check(blob), refusal).toThrow(refusal);
    const [begin = '', ...armored] = fixture('git.sig').trim().split('\n');
    const end = armored.pop() ?? '';
    for (const text of [
      `${begin}\n${end}\n`,
      [`${begin} `, ...armored, end].join('\n'),
      [begin, ...armored, `${end}x`].join('\n'),
    ]) {
      expect(() => verifySshSignature(payload, text, own, 'git'), text.slice(0, 40)).toThrow(
        'the signature is not an armored SSH signature',
      );
    }
    const ecdsa = Buffer.concat([
      wire(Buffer.from('ecdsa-sha2-nistp256')),
      wire(Buffer.from('nistp256')),
    ]);
    const pinned = [{ principal: 'ecdsa@cnl-ckc-demo', blob: ecdsa }];
    expect(() =>
      verifySshSignature(payload, armor(sshsigBlob([ecdsa, ...fields.slice(1)])), pinned, 'git'),
    ).toThrow('key type ecdsa-sha2-nistp256 is not supported');
    const [rsaKey = Buffer.alloc(0), ...rsaRest] = sshsigFields(tag.signature);
    const rsaRaw = rawSignature(rsaRest[3]);
    const rsa256 = Buffer.concat([wire(Buffer.from('rsa-sha2-256')), wire(rsaRaw)]);
    expect(() =>
      verifySshSignature(
        Buffer.from(tag.payload, 'utf8'),
        armor(sshsigBlob([rsaKey, ...rsaRest.slice(0, 3), rsa256])),
        signers,
        'git',
      ),
    ).toThrow('signature algorithm rsa-sha2-256 is not rsa-sha2-512');
    const line = fixture('signers').trim();
    expect(parseSigners(`  # pinned\n\n\t${line.replace(' ', ' \t ')}  \n`)).toEqual(own);
    for (const bad of [line.split(' ').slice(0, 2).join(' '), `${line} extra`]) {
      expect(() => parseSigners(bad), bad).toThrow('is not <principal> <key type> <key>');
    }
  });
});
