// `pnpm kb:asset-check` — prove the generated artifacts still match a manifest
// that still matches the vendored bag. Verifies only; never rebuilds.
//
// Usage: node tools/kb/check.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { sha256, verifyBag } from './bag.mjs';
import { GENERATED_DIR, ROOT, loadManifest, payloadSource } from './paths.mjs';

/** Build inputs and runtime assets. Excludes `.agent/` and `CLAUDE.md`, where the sibling project is legitimately discussed. */
const SCAN_ROOTS = ['tools', 'src', 'kb/generated', 'vite.config.ts', 'package.json', 'index.html'];
/**
 * The export boundary: the knowledge base arrives as a vendored bag, never as a
 * path into the neighbouring source project. Assembled from parts so this
 * scanner is not itself a match for the pattern it searches for. The trailing
 * boundary keeps longer names that merely share the prefix — this project's own
 * `cnl-ckc-demo` among them — from reading as the sibling.
 */
const SIBLING = new RegExp(`${['\\.\\.', 'cnl-ckc'].join('/')}(?![\\w.-])`);

/** @param {string} path @returns {string[]} every file at or under `path` */
const walk = (path) => {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (stat === undefined) return [];
  if (!stat.isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
};

/** @type {string[]} */
const failures = [];
/** @param {string} message */
const fail = (message) => failures.push(message);

const manifest = loadManifest();
if (manifest === undefined) {
  fail(`no manifest at ${relative(ROOT, join(GENERATED_DIR, 'kb-manifest.json'))}; run pnpm kb:build`);
} else {
  if (manifest.assets.length === 0) fail('manifest records no assets');
  for (const asset of manifest.assets) {
    const path = join(GENERATED_DIR, asset.path);
    try {
      const bytes = readFileSync(path);
      if (bytes.byteLength !== asset.bytes) fail(`${asset.path}: ${bytes.byteLength} bytes, manifest says ${asset.bytes}`);
      else if (sha256(bytes) !== asset.sha256) fail(`${asset.path}: digest does not match the manifest`);
    } catch {
      fail(`${asset.path}: missing`);
    }
  }

  const bagPath = join(ROOT, 'kb', manifest.source.bag);
  try {
    const bag = readFileSync(bagPath);
    if (sha256(bag) !== manifest.source.sha256) fail(`${manifest.source.bag}: digest does not match the manifest`);
    else {
      const { source, names } = payloadSource(verifyBag(bag).files);
      if (names.length !== manifest.input.files) fail(`bag holds ${names.length} payload files, manifest says ${manifest.input.files}`);
      if (sha256(Buffer.from(source, 'utf8')) !== manifest.input.sha256) fail('recomputed input digest does not match the manifest');
    }
  } catch (/** @type {unknown} */ error) {
    fail(`${manifest.source.bag}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const root of SCAN_ROOTS) {
  for (const path of walk(join(ROOT, root))) {
    // latin1 keeps the byte↔char mapping 1:1, so the ASCII pattern reads the same in the binary assets.
    if (SIBLING.test(readFileSync(path, 'latin1'))) fail(`sibling path in ${relative(ROOT, path)}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`kb:asset-check failed —\n${failures.map((line) => `  ${line}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  const assets = /** @type {NonNullable<typeof manifest>} */ (manifest).assets;
  process.stdout.write(
    `kb:asset-check ok — ${assets.length} assets verified, sibling-path scan clean over ${SCAN_ROOTS.length} roots\n`,
  );
}
