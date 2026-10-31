// `pnpm kb:fetch <tag>` — take the KB from a `cnl-ckc` GitHub release: the release's archive and
// its `.sha256` sidecar into `kb/`, and the upstream sources `.claude/rules/kb-build.md` cites into
// `vendor/cnl-ckc/`, each checked before it is written. `pnpm kb:fetch --verify` fetches the
// release `kb/release.json` names again and requires the vendored bytes to equal it.
//
// Usage: node tools/kb/release.mjs <tag> | --verify
// No checkout of `cnl-ckc` is read: every byte comes from the release assets or, for the vendored
// sources, the tag's own commit, each file held to its git blob hash in that commit's tree.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { sha256, verifyBag } from './bag.mjs';
import { ROOT } from './paths.mjs';
import { parseSigners, verifySshSignature } from './sshsig.mjs';

export const REPOSITORY = 'eturkes/cnl-ckc';
export const RECORD_PATH = join(ROOT, 'kb', 'release.json');
export const VENDOR_DIR = join(ROOT, 'vendor', 'cnl-ckc');
export const VENDOR_MANIFEST = 'PROVENANCE.tsv';
/** The release tag as signed: its object id, the signed payload and the armored SSH signature. */
export const TAG_PATH = join(ROOT, 'kb', 'release-tag.json');
/** The keys a release tag may be signed with, in `allowed_signers` form. */
export const SIGNERS_PATH = join(ROOT, 'kb', 'release-signers');
/** The upstream files the provenance port cites, by path in the tag's commit; `/` ends a tree. */
export const VENDORED = Object.freeze([
  'LICENSE',
  'NOTICE',
  'rust/ckc-spec/src/align.rs',
  'rust/ckc-spec/src/check.rs',
  'rust/ckc-spec/src/ui.rs',
  'tests/ui/',
]);

/** @typedef {{ name: string, digest?: string | null, browser_download_url: string }} Asset */
/** @typedef {{ path: string, type: string, sha: string }} TreeEntry */
/** @typedef {{ repository: string, tag: string, commit: string, archive: string, sha256: string, bag: string }} ReleaseRecord */
/** @typedef {{ object: string, payload: string, signature: string }} SignedTag */

/** A refusal names what failed; the caller adds nothing. @param {string} message @returns {never} */
const refuse = (message) => {
  throw new Error(message);
};

/**
 * The one KB archive a release publishes beside its sidecar.
 * @param {Asset[]} assets @returns {{ archive: Asset, sidecar: Asset }}
 */
export const selectAssets = (assets) => {
  const archives = assets.filter(({ name }) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) {
    refuse(`release publishes ${String(archives.length)} .tar.gz assets, expected exactly one`);
  }
  const archive = /** @type {Asset} */ (archives[0]);
  const sidecar = assets.find(({ name }) => name === `${archive.name}.sha256`);
  if (sidecar === undefined) refuse(`release publishes no ${archive.name}.sha256 sidecar`);
  return { archive, sidecar };
};

/**
 * GitHub's own digest of an asset, `sha256:<hex>`, against the bytes the download returned.
 * @param {Asset} asset @param {Uint8Array} bytes
 */
export const gradeAssetDigest = (asset, bytes) => {
  const recorded = /^sha256:([0-9a-f]{64})$/u.exec(asset.digest ?? '')?.[1];
  if (recorded === undefined) refuse(`${asset.name}: GitHub records no sha256 digest`);
  if (recorded !== sha256(bytes)) refuse(`${asset.name}: bytes do not match GitHub's digest ${recorded}`);
};

/**
 * The sidecar is one `sha256sum` line naming the archive; it must digest the archive's bytes.
 * @param {string} text @param {string} archiveName @param {Uint8Array} archiveBytes
 * @returns {string} the digest
 */
export const gradeSidecar = (text, archiveName, archiveBytes) => {
  const line = /^([0-9a-f]{64}) {2}(\S+)\n$/u.exec(text);
  if (line === null) refuse(`${archiveName}.sha256: not one sha256sum line`);
  const [, digest = '', named = ''] = line;
  if (named !== archiveName) refuse(`${archiveName}.sha256: names ${named}, not the archive`);
  if (digest !== sha256(archiveBytes)) refuse(`${archiveName}.sha256: ${digest} does not digest the archive`);
  return digest;
};

/** The bag's root names upstream's input head. @param {Uint8Array} archiveBytes @returns {string} */
export const bagRoot = (archiveBytes) => {
  const { root } = verifyBag(archiveBytes);
  if (!/^cnl-ckc-kb-g[0-9a-f]{12}$/u.test(root)) refuse(`bag root ${root} names no input head`);
  return root;
};

/** Git's object id of a file. @param {Uint8Array} bytes @returns {string} */
export const gitBlobSha = (bytes) =>
  createHash('sha1')
    .update(`blob ${String(bytes.byteLength)}\0`)
    .update(bytes)
    .digest('hex');

/**
 * A tree path the vendor tree may hold: relative, `/`-separated, no empty, `.` or `..` segment and
 * no backslash. The tree listing is untrusted input, and `tests/ui/../..` would pass a prefix test.
 * @param {string} path
 */
const safePath = (path) =>
  path !== '' &&
  !path.includes('\\') &&
  path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');

/** The tree entries `VENDORED` names, sorted. @param {TreeEntry[]} tree @returns {TreeEntry[]} */
export const vendoredEntries = (tree) => {
  const unsafe = tree.find(({ path }) => !safePath(path));
  if (unsafe !== undefined) refuse(`the tag's tree names an unsafe path ${JSON.stringify(unsafe.path)}`);
  const entries = tree
    .filter(({ type }) => type === 'blob')
    .filter(({ path }) =>
      VENDORED.some((wanted) => (wanted.endsWith('/') ? path.startsWith(wanted) : path === wanted)),
    )
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  for (const wanted of VENDORED) {
    const found = entries.some(({ path }) =>
      wanted.endsWith('/') ? path.startsWith(wanted) : path === wanted,
    );
    if (!found) refuse(`the tag's tree holds no ${wanted}`);
  }
  return entries;
};

/**
 * `PROVENANCE.tsv`: the release, then one `<git blob sha>\t<path>` line per vendored file.
 * @param {ReleaseRecord} record @param {TreeEntry[]} entries
 */
export const provenanceText = (record, entries) =>
  `# ${record.repository} ${record.tag} ${record.commit}\n` +
  entries.map(({ sha, path }) => `${sha}\t${path}\n`).join('');

/**
 * Read `PROVENANCE.tsv` back. @param {string} text
 * @returns {{ header: string, files: Map<string, string> }} path → git blob sha
 */
export const parseProvenance = (text) => {
  const [header = '', ...lines] = text.split('\n');
  /** @type {Map<string, string>} */
  const files = new Map();
  for (const line of lines) {
    if (line === '') continue;
    const row = /^([0-9a-f]{40})\t(\S.*)$/u.exec(line);
    if (row === null) refuse(`${VENDOR_MANIFEST}: malformed line ${JSON.stringify(line)}`);
    files.set(row[2] ?? '', row[1] ?? '');
  }
  return { header, files };
};

/**
 * Every vendored file present, unchanged and declared; nothing else under the tree. The
 * manifest's header must name the release `kb/release.json` records.
 * @param {ReleaseRecord} record @param {string} provenance @param {Map<string, Uint8Array>} onDisk
 * @returns {string[]} refusals, each naming its file
 */
export const gradeVendored = (record, provenance, onDisk) => {
  const { header, files } = parseProvenance(provenance);
  /** @type {string[]} */
  const out = [];
  const expected = `# ${record.repository} ${record.tag} ${record.commit}`;
  if (header !== expected) out.push(`${VENDOR_MANIFEST}: header ${JSON.stringify(header)}, expected ${JSON.stringify(expected)}`);
  if (files.size === 0) out.push(`${VENDOR_MANIFEST}: declares no file`);
  for (const [path, sha] of files) {
    const bytes = onDisk.get(path);
    if (bytes === undefined) out.push(`${path}: declared, not vendored`);
    else if (gitBlobSha(bytes) !== sha) out.push(`${path}: git blob ${gitBlobSha(bytes)}, declared ${sha}`);
  }
  for (const path of onDisk.keys()) {
    if (path !== VENDOR_MANIFEST && !files.has(path)) out.push(`${path}: vendored, not declared`);
  }
  return out;
};

/**
 * `kb/` against `kb/release.json`: the archive it names is the one bag, its sidecar names it and
 * digests to the recorded sha256, and its root is the recorded bag.
 * @param {ReleaseRecord} record @param {Map<string, Uint8Array>} kbFiles name → bytes of `kb/*`
 * @returns {string[]} refusals
 */
export const gradeRecord = (record, kbFiles) => {
  /** @type {string[]} */
  const out = [];
  const archives = [...kbFiles.keys()].filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1 || archives[0] !== record.archive) {
    out.push(`kb/ holds ${JSON.stringify(archives)}, release.json names ${record.archive}`);
    return out;
  }
  const bytes = /** @type {Uint8Array} */ (kbFiles.get(record.archive));
  const sidecar = kbFiles.get(`${record.archive}.sha256`);
  try {
    const digest = gradeSidecar(Buffer.from(sidecar ?? []).toString('utf8'), record.archive, bytes);
    if (digest !== record.sha256) out.push(`sidecar digest ${digest}, release.json records ${record.sha256}`);
  } catch (error) {
    out.push(error instanceof Error ? error.message : String(error));
  }
  try {
    const root = bagRoot(bytes);
    if (root !== record.bag) out.push(`bag root ${root}, release.json records ${record.bag}`);
  } catch (error) {
    out.push(error instanceof Error ? error.message : String(error));
  }
  return out;
};

/**
 * The release tag against `kb/release.json`: signed in the `git` namespace by a pinned signer, it
 * names the recorded commit and tag, and its body holds exactly one `sha256sum` line for the
 * archive, equal to the recorded digest. The sidecar and GitHub's asset digest come from the same
 * release as the archive; this line is the one the signer vouches for.
 * @param {SignedTag} tag @param {ReleaseRecord} record
 * @param {{ principal: string, blob: Buffer }[]} signers
 * @returns {string[]} refusals, each naming the tag
 */
export const gradeTag = (tag, record, signers) => {
  const name = `tag ${record.tag}`;
  /** @type {string[]} */
  const out = [];
  try {
    verifySshSignature(Buffer.from(tag.payload), tag.signature, signers, 'git');
  } catch (error) {
    out.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const blank = tag.payload.indexOf('\n\n');
  const header = new Map(
    tag.payload
      .slice(0, Math.max(blank, 0))
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf(' ')), line.slice(line.indexOf(' ') + 1)]),
  );
  if (header.get('object') !== record.commit || header.get('type') !== 'commit') {
    out.push(`${name}: signs ${String(header.get('type'))} ${String(header.get('object'))}, release.json records commit ${record.commit}`);
  }
  if (header.get('tag') !== record.tag) out.push(`${name}: the signed tag is named ${String(header.get('tag'))}`);
  // A header line is `<field> <value>`, never a `sha256sum` line, so every match is the body's.
  const sums = tag.payload
    .split('\n')
    .map((line) => /^([0-9a-f]{64}) {2}(\S+)$/u.exec(line))
    .filter(/** @returns {line is RegExpExecArray} */ (line) => line?.[2] === record.archive);
  const sum = sums.length === 1 ? sums[0] : undefined;
  if (sum === undefined) {
    out.push(`${name}: its body holds ${String(sums.length)} checksum lines for ${record.archive}, expected one`);
  } else if (sum[1] !== record.sha256) {
    out.push(`${name}: its body's checksum ${String(sum[1])} is not the archive's ${record.sha256}`);
  }
  return out;
};

/**
 * The tag with one byte of its signature flipped — the last byte of the blob, inside the raw
 * signature — the control every tag grading fires first.
 * @param {SignedTag} tag @returns {SignedTag}
 */
export const plantedBadSignature = (tag) => {
  const lines = tag.signature.trim().split('\n');
  const blob = Buffer.from(lines.slice(1, -1).join(''), 'base64');
  blob.writeUInt8(blob.readUInt8(blob.length - 1) ^ 1, blob.length - 1);
  return { ...tag, signature: [lines[0], blob.toString('base64'), lines.at(-1), ''].join('\n') };
};

/**
 * Grade a tag after its control: the planted bad signature must be refused by name.
 * @param {SignedTag} tag @param {ReleaseRecord} record
 * @param {{ principal: string, blob: Buffer }[]} signers @returns {string[]}
 */
export const gradeTagControlled = (tag, record, signers) => {
  const control = gradeTag(plantedBadSignature(tag), record, signers);
  if (!control.some((line) => line.includes('the signature does not verify'))) {
    refuse('control did not fire: a flipped signature byte graded clean');
  }
  return gradeTag(tag, record, signers);
};

/** @returns {SignedTag} */
export const readTag = () => {
  const value = /** @type {unknown} */ (JSON.parse(readFileSync(TAG_PATH, 'utf8')));
  return /** @type {SignedTag} */ (value);
};

export const readSigners = () => parseSigners(readFileSync(SIGNERS_PATH, 'utf8'));

/** @returns {ReleaseRecord} */
export const readRecord = () => {
  const value = /** @type {unknown} */ (JSON.parse(readFileSync(RECORD_PATH, 'utf8')));
  return /** @type {ReleaseRecord} */ (value);
};

/** Every file under a directory, by path relative to it. @param {string} dir */
export const readTree = (dir) => {
  /** @type {Map<string, Uint8Array>} */
  const files = new Map();
  /** @param {string} at */
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(dir, path), readFileSync(path));
    }
  };
  walk(dir);
  return files;
};

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'cnl-ckc-demo-kb-fetch',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

/** @param {string} url @returns {Promise<unknown>} */
const getJson = async (url) => {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) refuse(`${url}: HTTP ${String(response.status)}`);
  const value = /** @type {unknown} */ (await response.json());
  return value;
};

/** @param {string} url @returns {Promise<Uint8Array>} */
const getBytes = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'cnl-ckc-demo-kb-fetch' } });
  if (!response.ok) refuse(`${url}: HTTP ${String(response.status)}`);
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * Fetch and check one release in memory; nothing is written here.
 * @param {string} tag
 */
const fetchRelease = async (tag) => {
  const api = `https://api.github.com/repos/${REPOSITORY}`;
  const release = /** @type {{ assets: Asset[] }} */ (await getJson(`${api}/releases/tags/${encodeURIComponent(tag)}`));
  const { archive, sidecar } = selectAssets(release.assets);
  const archiveBytes = await getBytes(archive.browser_download_url);
  const sidecarBytes = await getBytes(sidecar.browser_download_url);
  gradeAssetDigest(archive, archiveBytes);
  gradeAssetDigest(sidecar, sidecarBytes);
  const digest = gradeSidecar(Buffer.from(sidecarBytes).toString('utf8'), archive.name, archiveBytes);
  const bag = bagRoot(archiveBytes);

  // A signed tag is a tag object; a ref naming the commit itself is a lightweight tag, unsigned.
  const ref = /** @type {{ object: { type: string, sha: string } }} */ (
    await getJson(`${api}/git/ref/tags/${encodeURIComponent(tag)}`)
  ).object;
  if (ref.type !== 'tag') refuse(`tag ${tag} is a lightweight tag and carries no signature`);
  const tagObject = /** @type {{ object: { type: string, sha: string }, verification?: { payload?: string | null, signature?: string | null } }} */ (
    await getJson(`${api}/git/tags/${ref.sha}`)
  );
  const { payload, signature } = tagObject.verification ?? {};
  if (typeof payload !== 'string' || typeof signature !== 'string') refuse(`tag ${tag} carries no signature`);
  /** @type {SignedTag} */
  const signedTag = { object: ref.sha, payload, signature };
  if (tagObject.object.type !== 'commit') refuse(`tag ${tag} names a ${tagObject.object.type}, not a commit`);
  const commit = tagObject.object.sha;
  const tree = /** @type {{ truncated: boolean, tree: TreeEntry[] }} */ (
    await getJson(`${api}/git/trees/${commit}?recursive=1`)
  );
  if (tree.truncated) refuse(`the tree of ${commit} came back truncated`);
  const entries = vendoredEntries(tree.tree);
  /** @type {Map<string, Uint8Array>} */
  const sources = new Map();
  for (const entry of entries) {
    // The fixture corpus names files with every hostile character it tests: encode each segment.
    const path = entry.path.split('/').map(encodeURIComponent).join('/');
    const bytes = await getBytes(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/${path}`);
    if (gitBlobSha(bytes) !== entry.sha) refuse(`${entry.path}: bytes do not match blob ${entry.sha}`);
    sources.set(entry.path, bytes);
  }
  /** @type {ReleaseRecord} */
  const record = { repository: REPOSITORY, tag, commit, archive: archive.name, sha256: digest, bag };
  const refusals = gradeTagControlled(signedTag, record, readSigners());
  if (refusals.length > 0) refuse(refusals.join('\n'));
  return { record, archiveBytes, sidecarBytes, entries, sources, tag: signedTag };
};

/** @param {string} path @param {Uint8Array | string} bytes */
const write = (path, bytes) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
};

/** @param {string} tag */
const vendor = async (tag) => {
  const fetched = await fetchRelease(tag);
  const kbDir = join(ROOT, 'kb');
  for (const name of readdirSync(kbDir)) {
    if (name.endsWith('.tar.gz') || name.endsWith('.tar.gz.sha256')) rmSync(join(kbDir, name));
  }
  write(join(kbDir, fetched.record.archive), fetched.archiveBytes);
  write(join(kbDir, `${fetched.record.archive}.sha256`), fetched.sidecarBytes);
  write(RECORD_PATH, `${JSON.stringify(fetched.record, null, 2)}\n`);
  write(TAG_PATH, `${JSON.stringify(fetched.tag, null, 2)}\n`);
  rmSync(VENDOR_DIR, { recursive: true, force: true });
  for (const [path, bytes] of fetched.sources) {
    const target = join(VENDOR_DIR, path);
    if (!target.startsWith(`${VENDOR_DIR}/`)) refuse(`${path} resolves outside vendor/cnl-ckc`);
    write(target, bytes);
  }
  write(join(VENDOR_DIR, VENDOR_MANIFEST), provenanceText(fetched.record, fetched.entries));
  process.stdout.write(
    `kb:fetch ok — ${fetched.record.tag}: ${fetched.record.archive} (${fetched.record.bag}), ` +
      `${String(fetched.sources.size)} upstream files at ${fetched.record.commit.slice(0, 12)}\n`,
  );
};

const verify = async () => {
  const recorded = readRecord();
  const fetched = await fetchRelease(recorded.tag);
  const kbFiles = new Map(
    readdirSync(join(ROOT, 'kb'))
      .filter((name) => name.endsWith('.tar.gz') || name.endsWith('.tar.gz.sha256'))
      .map((name) => [name, readFileSync(join(ROOT, 'kb', name))]),
  );
  /** @param {Map<string, Uint8Array>} kb @param {Map<string, Uint8Array>} sources */
  const grade = (kb, sources) => {
    /** @type {string[]} */
    const out = [];
    if (JSON.stringify(fetched.record) !== JSON.stringify(recorded)) {
      out.push(`kb/release.json ${JSON.stringify(recorded)}, the release reads ${JSON.stringify(fetched.record)}`);
    }
    if (JSON.stringify(readTag()) !== JSON.stringify(fetched.tag)) out.push('kb/release-tag.json differs from the release tag');
    if (!Buffer.from(kb.get(recorded.archive) ?? []).equals(Buffer.from(fetched.archiveBytes))) {
      out.push(`kb/${recorded.archive} differs from the release asset`);
    }
    if (!Buffer.from(kb.get(`${recorded.archive}.sha256`) ?? []).equals(Buffer.from(fetched.sidecarBytes))) {
      out.push(`kb/${recorded.archive}.sha256 differs from the release asset`);
    }
    for (const [path, bytes] of fetched.sources) {
      if (!Buffer.from(sources.get(path) ?? []).equals(Buffer.from(bytes))) out.push(`vendor/cnl-ckc/${path} differs from the tag's commit`);
    }
    const manifest = provenanceText(fetched.record, fetched.entries);
    if (Buffer.from(sources.get(VENDOR_MANIFEST) ?? []).toString('utf8') !== manifest) {
      out.push(`vendor/cnl-ckc/${VENDOR_MANIFEST} differs from the tag's commit tree`);
    }
    for (const path of sources.keys()) {
      if (path !== VENDOR_MANIFEST && !fetched.sources.has(path)) out.push(`vendor/cnl-ckc/${path} is not in the tag's commit`);
    }
    return out;
  };
  const sources = readTree(VENDOR_DIR);
  // The control: one flipped byte in a copy of the vendored archive must be refused by name.
  const flipped = new Uint8Array(kbFiles.get(recorded.archive) ?? []);
  flipped[flipped.length - 1] = (flipped[flipped.length - 1] ?? 0) ^ 1;
  const control = grade(new Map([...kbFiles, [recorded.archive, flipped]]), sources);
  if (!control.some((line) => line.startsWith(`kb/${recorded.archive} differs`))) {
    refuse('control did not fire: a flipped archive byte graded clean');
  }
  const refusals = grade(kbFiles, sources);
  if (refusals.length > 0) refuse(refusals.join('\n'));
  process.stdout.write(
    `kb:fetch --verify ok — kb/ and vendor/cnl-ckc/ equal release ${recorded.tag} ` +
      `(${String(fetched.sources.size)} upstream files), its tag signed by a pinned signer; ` +
      `controls: a flipped archive byte, a flipped signature byte\n`,
  );
};

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [argument] = process.argv.slice(2);
  const run = argument === '--verify' ? verify() : argument === undefined ? refuse('usage: kb:fetch <tag> | --verify') : vendor(argument);
  run.catch((/** @type {unknown} */ error) => {
    process.stderr.write(`kb:fetch failed — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
