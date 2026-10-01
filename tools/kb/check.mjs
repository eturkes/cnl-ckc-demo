// `pnpm kb:asset-check` — prove the generated artifacts still match a manifest
// that still matches the vendored bag. Verifies only; never rebuilds.
//
// Usage: node tools/kb/check.mjs [--scan-only]
//
// `--scan-only` runs the source scans alone. `tests/kb-reach.test.ts` spawns this check once per
// planted input, and re-deriving every asset from the bag is most of each run's CPU: on a loaded
// machine that work pushed those cases past vitest's 5000 ms timeout while grading nothing they
// plant. The gate's own `kb:asset-check` step runs the full check.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { requireFiring } from '../control.mjs';
import { sha256, verifyBag } from './bag.mjs';
import { catalogJson, catalogRecords } from './catalog.mjs';
import {
  deriveSemanticGraph,
  validateSemanticGraphAsset,
  GRAPH_SCHEMA_VERSION,
} from './graph.mjs';
import { deriveIntakeVocabulary, validateIntakeVocabulary } from './intake.mjs';
import { deriveProvenance, PROVENANCE_SCHEMA_VERSION } from './provenance.mjs';
import { GENERATED_DIR, ROOT, loadManifest, payloadSource } from './paths.mjs';

/** Build inputs and runtime assets. Excludes `.agent/` and `CLAUDE.md`, where the sibling project is legitimately discussed. */
const SCAN_ROOTS = [
  'tools',
  'src',
  'worker',
  'kb/generated',
  'vite.config.ts',
  'package.json',
  'index.html',
];
/**
 * Roots the answer-oracle ban covers. `tests/` is absent on purpose: a regression
 * test proves live output against the committed answers, which is exactly what
 * makes them oracles. Production reading them would make the demo's answers
 * indistinguishable from a lookup. `kb/generated` is in: the runtime loads those assets, so
 * an oracle path inside one is production reach the source scan alone would never see.
 */
const PRODUCTION_ROOTS = ['src', 'tools', 'worker', 'vite.config.ts', 'index.html', 'kb/generated'];
/**
 * A byte scan sees a static import, a dynamic `import()` and an `fs` read alike, which an
 * ESLint import rule cannot — the core rule visits import and export declarations only.
 * Written without either bare segment as a string literal, so ASSEMBLED does not match it.
 */
const ANSWERS = /quer(?:ies)\/answers/u;
/**
 * A path assembled at run time from its two segments (concatenated, joined, or a template
 * head) slips past ANSWERS, so source holding BOTH bare segments as string literals reaches
 * the oracles too. Comments strip first: their code spans quote paths without building one.
 */
const ASSEMBLED = [/(['"`])\/?queries\/?(?:\1|\$\{)/u, /(?:['"`]|\})\/?answers[/'"`]/u];
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

/** @typedef {{root: string, paths: string[]}} BoundScanRoot */
/**
 * @param {readonly string[]} roots
 * @returns {BoundScanRoot[]}
 */
const bindScanRoots = (roots) =>
  roots.map((root) => ({ root, paths: walk(join(ROOT, root)) }));

/**
 * @param {readonly BoundScanRoot[]} roots
 * @returns {string[]}
 */
const gradeScanRoots = (roots) => {
  if (roots.length === 0) {
    return ['SCAN_ROOTS table is empty, so the sibling-path scan grades no root'];
  }
  return roots.flatMap(({ root, paths }) =>
    paths.length === 0 ? [`SCAN_ROOTS entry "${root}" yielded no paths`] : [],
  );
};

/**
 * A scan root table must name roots, and each root must bind paths: an emptied table, or a
 * root that walks to nothing, scans nothing while its line in the success message still reads
 * clean.
 *
 * @param {string} name @param {readonly string[]} roots
 * @returns {string[]}
 */
const gradeRootTable = (name, roots) => {
  if (roots.length === 0) return [`${name} table is empty, so its scan grades no root`];
  return bindScanRoots(roots).flatMap(({ root, paths }) =>
    paths.length === 0 ? [`${name} entry "${root}" yielded no paths`] : [],
  );
};

/** @type {string[]} */
const failures = [];
/** @param {string} message */
const fail = (message) => failures.push(message);

const ROOT_TABLES = /** @type {const} */ ([
  ['PRODUCTION_ROOTS', PRODUCTION_ROOTS],
  ['SERIALIZE_ROOTS', SERIALIZE_ROOTS],
  ['QUESTION_ROOTS', QUESTION_ROOTS],
]);
/** @type {string[]} */
const rootTableControls = [];
/** Tables that already failed, so a scan control over them is not asked to fire. */
const brokenTables = new Set();
for (const [name, roots] of ROOT_TABLES) {
  const problems = gradeRootTable(name, roots);
  if (problems.length > 0) brokenTables.add(name);
  for (const problem of problems) fail(problem);
  rootTableControls.push(
    requireFiring(
      'kb:asset-check',
      { mutation: `${name} emptied`, expect: [`${name} table is empty`] },
      () => gradeRootTable(name, []),
    ),
  );
}

const boundScanRoots = bindScanRoots(SCAN_ROOTS);
const scanFailures = gradeScanRoots(boundScanRoots);
for (const problem of scanFailures) fail(problem);
let controlsFired = 0;
if (scanFailures.length === 0) {
  requireFiring(
    'kb:asset-check',
    {
      mutation: 'the first SCAN_ROOTS entry pointed at zz-missing-scan-root',
      expect: ['SCAN_ROOTS', 'zz-missing-scan-root'],
    },
    () =>
      gradeScanRoots(
        bindScanRoots(
          SCAN_ROOTS.map((root, index) =>
            index === 0 ? `${root}/zz-missing-scan-root` : root,
          ),
        ),
      ),
  );
  controlsFired = 1;
}
let scopeControlsFired = 0;
let scopeRecordsValidated = 0;
let intakeControlsFired = 0;
let intakeRulesValidated = 0;

const scanOnly = process.argv.includes('--scan-only');
const manifest = loadManifest();
if (scanOnly) {
  // The scans below need no verified asset.
} else if (manifest === undefined) {
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
      if (catalog.names.length !== manifest.catalog.sourceFiles) fail(`catalog uses ${catalog.names.length} controlled sources, manifest says ${manifest.catalog.sourceFiles}`);
      if (catalog.records.length !== manifest.catalog.entries) fail(`catalog derives ${catalog.records.length} entries, manifest says ${manifest.catalog.entries}`);
      const emitted = Buffer.from(catalogJson(catalog.records), 'utf8');
      if (sha256(emitted) !== manifest.catalog.sha256) fail('recomputed catalog digest does not match the manifest');
      const shipped = readFileSync(join(GENERATED_DIR, 'question-catalog.json'));
      if (!emitted.equals(shipped)) fail('question-catalog.json does not match the catalog re-derived from the bag');

      const provenance = deriveProvenance(files);
      const graph = deriveSemanticGraph(files, provenance.clauses);
      const scopeFailures = validateSemanticGraphAsset(graph.model);
      for (const problem of scopeFailures) fail(`semantic graph: ${problem}`);
      if (scopeFailures.length === 0) {
        requireFiring(
          'kb:asset-check',
          {
            mutation: 'the real scopes table emptied',
            expect: ['scopes table is empty', 'grades no record'],
          },
          () => validateSemanticGraphAsset({ ...graph.model, scopes: graph.model.scopes.slice(0, 0) }),
        );
        scopeControlsFired = 1;
        scopeRecordsValidated = graph.model.scopes.length;
      }
      const intake = deriveIntakeVocabulary(files);
      const intakeFailures = validateIntakeVocabulary(intake.model);
      for (const problem of intakeFailures) fail(`intake vocabulary: ${problem}`);
      if (intakeFailures.length === 0) {
        // The real model with one section's documents emptied: every rule of that section
        // loses its home, which a validator that stopped reading sections would not notice.
        requireFiring(
          'kb:asset-check',
          {
            mutation: 'the real intake model with section s2 emptied of documents',
            expect: ['section s2 has no documents', 'lies in 0 sections'],
          },
          () =>
            validateIntakeVocabulary({
              ...intake.model,
              sections: intake.model.sections.map((section) =>
                section.id === 's2' ? { ...section, documents: [] } : section,
              ),
            }),
        );
        intakeControlsFired = 1;
        intakeRulesValidated = intake.model.rules.length;
      }
      if (
        manifest.intake.vocabularyVersion !== intake.model.vocabularyVersion ||
        manifest.intake.rules !== intake.model.rules.length ||
        manifest.intake.digest !== intake.model.digest
      ) {
        fail('manifest intake metadata does not match the bag-derived vocabulary');
      }
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
        { kind: 'intake-vocabulary', path: intake.path, bytes: intake.bytes },
      ];
      const derivedKinds = new Set([
        'provenance-index',
        'provenance-document',
        'source-pdf',
        'semantic-graph',
        'intake-vocabulary',
      ]);
      const recorded = manifest.assets.filter((entry) => derivedKinds.has(entry.kind));
      if (recorded.length !== derived.length) {
        fail(`manifest records ${recorded.length} derived provenance/graph/intake assets, expected ${derived.length}`);
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

if (manifest !== undefined && !scanOnly) {
  const expected = new Set(['kb-manifest.json', ...manifest.assets.map((entry) => entry.path)]);
  for (const path of walk(GENERATED_DIR)) {
    const generatedPath = relative(GENERATED_DIR, path);
    if (!expected.has(generatedPath)) fail(`unexpected generated asset ${generatedPath}`);
  }
}

for (const { paths } of boundScanRoots) {
  for (const path of paths) {
    // latin1 keeps the byte↔char mapping 1:1, so the ASCII pattern reads the same in the binary assets.
    if (SIBLING.test(readFileSync(path, 'latin1'))) fail(`sibling path in ${relative(ROOT, path)}`);
  }
}

/**
 * @param {readonly string[]} roots
 * @param {(path: string) => string} read
 * @returns {string[]}
 */
const answerReach = (roots, read) =>
  roots.flatMap((root) =>
    walk(join(ROOT, root))
      .flatMap((path) => {
        const text = read(path);
        if (ANSWERS.test(text)) return [`answer-oracle reach in ${relative(ROOT, path)}`];
        const code = /\.(?:[cm]?[jt]s|svelte)$/u.test(path)
          ? text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/.*$/gmu, '$1')
          : text;
        return ASSEMBLED.every((segment) => segment.test(code))
          ? [`answer-oracle path assembled in ${relative(ROOT, path)}`]
          : [];
      }),
  );
/** @param {string} path @returns {string} latin1 keeps bytes 1:1 with chars, binary assets included */
const latin1 = (path) => readFileSync(path, 'latin1');
const reach = answerReach(PRODUCTION_ROOTS, latin1);
for (const problem of reach) fail(problem);
let reachControlFired = 0;
const plantedAsset = join(GENERATED_DIR, 'question-catalog.json');
if (reach.length === 0 && !brokenTables.has('PRODUCTION_ROOTS')) {
  // The real generated tree, one asset read as if the build had written an oracle path into it.
  requireFiring(
    'kb:asset-check',
    {
      mutation: 'an oracle path read into kb/generated/question-catalog.json',
      expect: ['answer-oracle reach in kb/generated/question-catalog.json'],
    },
    () =>
      answerReach(PRODUCTION_ROOTS, (path) =>
        path === plantedAsset ? `${latin1(path)}${'quer'}ies/answers` : latin1(path),
      ),
  );
  reachControlFired = 1;
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
} else if (scanOnly) {
  process.stdout.write(
    `kb:asset-check --scan-only ok — sibling-path, answer-oracle, JSON-serialization and ` +
      `question-text scans clean, ${String(controlsFired)} SCAN_ROOTS control fired, ` +
      `controls: ${rootTableControls.join(', ')}; assets not verified\n`,
  );
} else {
  const assets = /** @type {NonNullable<typeof manifest>} */ (manifest).assets;
  process.stdout.write(
    `kb:asset-check ok — ${assets.length} assets verified, catalog re-derived from the bag, ` +
      `sibling-path scan clean over ${SCAN_ROOTS.length} roots, ` +
      `answer-oracle scan clean over ${PRODUCTION_ROOTS.length} roots (${String(reachControlFired)} control fired), ` +
      `JSON-serialization scan clean over ${SERIALIZE_ROOTS.length} root, ` +
      `${questions.length} question sentences absent from ${QUESTION_ROOTS.length} roots, ` +
      `${String(controlsFired)} SCAN_ROOTS control fired, controls: ${rootTableControls.join(', ')}, ` +
      `${String(scopeRecordsValidated)} graph scopes verified, ` +
      `${String(scopeControlsFired)} scopes control fired, ` +
      `${String(intakeRulesValidated)} intake rules verified, ` +
      `${String(intakeControlsFired)} intake control fired\n`,
  );
}
