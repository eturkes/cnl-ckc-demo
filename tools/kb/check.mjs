// `pnpm kb:asset-check` — prove the generated artifacts still match a manifest
// that still matches the vendored bag. Verifies only; never rebuilds.
//
// Usage: node tools/kb/check.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { sha256, verifyBag } from './bag.mjs';
import { catalogJson, catalogRecords } from './catalog.mjs';
import { deriveSemanticGraph, GRAPH_SCHEMA_VERSION } from './graph.mjs';
import { deriveProvenance, PROVENANCE_SCHEMA_VERSION } from './provenance.mjs';
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
/**
 * Question sentences are compiled from the bag, so source holds none of them —
 * literal or comment. A copy reads as fact and drifts silently the next time the
 * corpus recompiles. `tests/` is in scope because the suites assert labels through
 * `QUESTION_CATALOG`; the sentences themselves are never the fixture (m1u5 I03).
 */
const QUESTION_ROOTS = ['src', 'tests'];

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

      const provenance = deriveProvenance(files);
      const graph = deriveSemanticGraph(files, provenance.clauses);
      if (
        manifest.provenance.schemaVersion !== PROVENANCE_SCHEMA_VERSION ||
        manifest.provenance.documents !== provenance.stats.documents ||
        manifest.provenance.clauses !== provenance.stats.clauses ||
        manifest.provenance.alignmentSpans !== provenance.stats.alignmentSpans
      ) {
        fail('manifest provenance metadata does not match the bag-derived model');
      }
      if (
        manifest.graph.schemaVersion !== GRAPH_SCHEMA_VERSION ||
        manifest.graph.nodes !== graph.model.stats.nodes ||
        manifest.graph.edges !== graph.model.stats.edges
      ) {
        fail('manifest graph metadata does not match the bag-derived model');
      }

      const derived = [
        { kind: 'provenance-index', path: provenance.index.path, bytes: provenance.index.bytes },
        ...provenance.chunks.map((chunk) => ({
          kind: 'provenance-document',
          path: chunk.path,
          bytes: chunk.bytes,
        })),
        { kind: 'source-pdf', path: provenance.pdf.path, bytes: provenance.pdf.bytes },
        { kind: 'semantic-graph', path: graph.path, bytes: graph.bytes },
      ];
      const derivedKinds = new Set([
        'provenance-index',
        'provenance-document',
        'source-pdf',
        'semantic-graph',
      ]);
      const recorded = manifest.assets.filter((entry) => derivedKinds.has(entry.kind));
      if (recorded.length !== derived.length) {
        fail(`manifest records ${recorded.length} derived provenance/graph assets, expected ${derived.length}`);
      }
      const recordedByPath = new Map(recorded.map((entry) => [entry.path, entry]));
      for (const expected of derived) {
        const entry = recordedByPath.get(expected.path);
        if (entry === undefined) {
          fail(`${expected.path}: absent from manifest`);
          continue;
        }
        if (entry.kind !== expected.kind) fail(`${expected.path}: kind ${entry.kind}, expected ${expected.kind}`);
        if (entry.bytes !== expected.bytes.byteLength || entry.sha256 !== sha256(expected.bytes)) {
          fail(`${expected.path}: manifest metadata differs from fresh derivation`);
        }
        try {
          if (!Buffer.from(expected.bytes).equals(readFileSync(join(GENERATED_DIR, expected.path)))) {
            fail(`${expected.path}: bytes differ from fresh derivation`);
          }
        } catch {
          fail(`${expected.path}: missing`);
        }
      }
    }
  } catch (/** @type {unknown} */ error) {
    fail(`${manifest.source.bag}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (manifest !== undefined) {
  const expected = new Set(['kb-manifest.json', ...manifest.assets.map((entry) => entry.path)]);
  for (const path of walk(GENERATED_DIR)) {
    const generatedPath = relative(GENERATED_DIR, path);
    if (!expected.has(generatedPath)) fail(`unexpected generated asset ${generatedPath}`);
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

/** @type {string[]} */
let questions = [];
try {
  // Same `JSON.parse` discipline as `loadManifest`: through `unknown`, so the shape
  // claim is explicit rather than an `any` that lint would refuse.
  const parsed = /** @type {unknown} */ (
    JSON.parse(readFileSync(join(GENERATED_DIR, 'question-catalog.json'), 'utf8'))
  );
  questions = /** @type {{ entries: { question: string }[] }} */ (parsed).entries.map(
    (entry) => entry.question,
  );
} catch {
  fail('question-catalog.json: unreadable, so the question-literal scan cannot run');
}
for (const root of QUESTION_ROOTS) {
  for (const path of walk(join(ROOT, root))) {
    const source = readFileSync(path, 'latin1');
    for (const question of questions) {
      if (source.includes(question)) fail(`catalog question text in ${relative(ROOT, path)}`);
    }
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
      `JSON-serialization scan clean over ${SERIALIZE_ROOTS.length} root, ` +
      `${questions.length} question sentences absent from ${QUESTION_ROOTS.length} roots\n`,
  );
}
