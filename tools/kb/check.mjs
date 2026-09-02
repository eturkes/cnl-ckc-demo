// `pnpm kb:asset-check` — prove the generated artifacts still match a manifest
// that still matches the vendored bag. Verifies only; never rebuilds.
//
// Usage: node tools/kb/check.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { sha256, verifyBag } from './bag.mjs';
import { catalogJson, catalogRecords } from './catalog.mjs';
import { GENERATED_DIR, ROOT, loadManifest, payloadSource } from './paths.mjs';

/** Build inputs and runtime assets. Excludes `.agent/` and `CLAUDE.md`, where the sibling project is legitimately discussed. */
const SCAN_ROOTS = ['tools', 'src', 'kb/generated', 'vite.config.ts', 'package.json', 'index.html'];
/**
 * Roots the answer-oracle ban covers. `tests/` is absent on purpose: a regression
 * test proves live output against the committed answers, which is exactly what
 * makes them oracles. Production reading them would make the demo's answers
 * indistinguishable from a lookup.
 */
const PRODUCTION_ROOTS = ['src', 'tools', 'vite.config.ts', 'index.html'];
/**
 * Assembled from parts so this scanner is not itself a match. A byte scan sees a
 * static import, a dynamic `import()` and an `fs` read alike, which an ESLint
 * import rule cannot — the core rule visits import and export declarations only.
 * A path assembled at runtime evades it; nothing in this repo assembles one.
 */
const ANSWERS = new RegExp(['queries', 'answers'].join('/'));
/**
 * The export boundary: the knowledge base arrives as a vendored bag, never as a
 * path into the neighbouring source project. Assembled from parts so this
 * scanner is not itself a match for the pattern it searches for. The trailing
 * boundary keeps longer names that merely share the prefix — this project's own
 * `cnl-ckc-demo` among them — from reading as the sibling.
 */
const SIBLING = new RegExp(`${['\\.\\.', 'cnl-ckc'].join('/')}(?![\\w.-])`);
/**
 * JSON round-tripping an engine value is the one measured corruption path:
 * `'$guideline_id'/5` re-enters as arity 1 with `ref([1])` and `1r3` flips to `3r1`
 * (u2 P3.12). The rule was comment-only, so a new call shipped silently. `src/` is
 * the app the engine runs in and carries no legitimate use; `tools/` writes real
 * JSON artifacts and is out of scope. Assembled from parts so this scanner is not
 * itself a match.
 */
const SERIALIZE = new RegExp(['JSON', 'stringify'].join('\\.'));
const SERIALIZE_ROOTS = ['src'];

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
      const { files } = verifyBag(bag);
      const { source, names } = payloadSource(files);
      if (names.length !== manifest.input.files) fail(`bag holds ${names.length} payload files, manifest says ${manifest.input.files}`);
      if (sha256(Buffer.from(source, 'utf8')) !== manifest.input.sha256) fail('recomputed input digest does not match the manifest');

      // Re-deriving proves the shipped catalog is what this bag yields, which a
      // digest comparison against the manifest alone would not.
      const catalog = catalogRecords(files);
      if (catalog.names.length !== manifest.catalog.queryFiles) fail(`bag holds ${catalog.names.length} queries, manifest says ${manifest.catalog.queryFiles}`);
      if (catalog.records.length !== manifest.catalog.entries) fail(`catalog derives ${catalog.records.length} entries, manifest says ${manifest.catalog.entries}`);
      if (sha256(Buffer.from(catalog.source, 'utf8')) !== manifest.catalog.sha256) fail('recomputed query digest does not match the manifest');
      const emitted = Buffer.from(catalogJson(catalog.records), 'utf8');
      const shipped = readFileSync(join(GENERATED_DIR, 'question-catalog.json'));
      if (!emitted.equals(shipped)) fail('question-catalog.json does not match the catalog re-derived from the bag');
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

for (const root of PRODUCTION_ROOTS) {
  for (const path of walk(join(ROOT, root))) {
    if (ANSWERS.test(readFileSync(path, 'latin1'))) fail(`answer-oracle reach in ${relative(ROOT, path)}`);
  }
}

for (const root of SERIALIZE_ROOTS) {
  for (const path of walk(join(ROOT, root))) {
    if (SERIALIZE.test(readFileSync(path, 'latin1'))) fail(`JSON serialization in ${relative(ROOT, path)}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`kb:asset-check failed —\n${failures.map((line) => `  ${line}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  const assets = /** @type {NonNullable<typeof manifest>} */ (manifest).assets;
  process.stdout.write(
    `kb:asset-check ok — ${assets.length} assets verified, catalog re-derived from the bag, ` +
      `sibling-path scan clean over ${SCAN_ROOTS.length} roots, ` +
      `answer-oracle scan clean over ${PRODUCTION_ROOTS.length} roots, ` +
      `JSON-serialization scan clean over ${SERIALIZE_ROOTS.length} root\n`,
  );
}
