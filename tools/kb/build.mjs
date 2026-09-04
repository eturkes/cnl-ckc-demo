// `pnpm kb:build` — verify the vendored bag, then produce the runtime artifacts.
//
// Usage: node tools/kb/build.mjs [--force]
// Exit 0 = artifacts on disk match a manifest this run verified end to end.

import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { sha256, verifyBag } from './bag.mjs';
import { catalogJson, catalogRecords } from './catalog.mjs';
import { deriveSemanticGraph, GRAPH_SCHEMA_VERSION } from './graph.mjs';
import { deriveProvenance, PROVENANCE_SCHEMA_VERSION } from './provenance.mjs';
import { buildImage, buildQlf, swiplWasmVersion, verifyImage, verifyQlf } from './produce.mjs';
import { GENERATED_DIR, MANIFEST_PATH, ROOT, loadManifest, payloadSource } from './paths.mjs';

/** @typedef {import('../../src/kb/manifest.ts').KbManifest} KbManifest */
/** @typedef {import('./produce.mjs').LiveContract} LiveContract */

const MANIFEST_VERSION = 4;

/** Locate the single vendored bag and prove it against its committed sidecar. */
const readVerifiedBag = () => {
  const kbDir = join(ROOT, 'kb');
  const archives = readdirSync(kbDir).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) throw new Error(`expected exactly one bag in kb/, found ${archives.length}`);
  const bag = /** @type {string} */ (archives[0]);
  const bytes = readFileSync(join(kbDir, bag));
  const sidecar = readFileSync(join(kbDir, `${bag}.sha256`), 'utf8').trim().split(/\s+/)[0];
  const digest = sha256(bytes);
  if (digest !== sidecar) throw new Error(`bag digest ${digest} does not match sidecar ${String(sidecar)}`);
  return { bag, digest, ...verifyBag(bytes) };
};

/**
 * @param {KbManifest} manifest
 * @returns {boolean} true when every recorded asset is still on disk and intact
 */
const assetsIntact = (manifest) =>
  manifest.assets.every((asset) => {
    try {
      const bytes = readFileSync(join(GENERATED_DIR, asset.path));
      return bytes.byteLength === asset.bytes && sha256(bytes) === asset.sha256;
    } catch {
      return false;
    }
  });

/** @param {Uint8Array} bytes @param {string} path @param {import('../../src/kb/manifest.ts').KbAssetKind} kind */
const asset = (bytes, path, kind) => ({ kind, path, bytes: bytes.byteLength, sha256: sha256(bytes) });

/** @param {string} path @param {Uint8Array} bytes */
const writeGenerated = (path, bytes) => {
  const target = join(GENERATED_DIR, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
};

const main = async () => {
  const force = process.argv.includes('--force');
  const { bag, digest, files, payload, tags } = readVerifiedBag();
  const { source, names } = payloadSource(files);
  const inputDigest = sha256(Buffer.from(source, 'utf8'));
  const swiplWasm = swiplWasmVersion();
  const catalog = catalogRecords(files);
  const catalogBytes = Buffer.from(catalogJson(catalog.records), 'utf8');
  const provenance = deriveProvenance(files);
  const graph = deriveSemanticGraph(files, provenance.clauses);

  const cached = loadManifest();
  if (
    !force &&
    cached &&
    cached.manifestVersion === MANIFEST_VERSION &&
    cached.input.sha256 === inputDigest &&
    cached.source.sha256 === digest &&
    cached.toolchain.swiplWasm === swiplWasm &&
    cached.catalog.sha256 === sha256(catalogBytes) &&
    assetsIntact(cached)
  ) {
    process.stdout.write(`kb:build cached — ${names.length} files, input ${inputDigest.slice(0, 12)}\n`);
    return;
  }

  const { image, contract } = await buildImage(source);
  const qlf = await buildQlf(source);
  const loaded = await verifyImage(image);
  const fallback = await verifyQlf(qlf);
  // An artifact that loads to a different corpus than the one just built is a
  // silent substitution; refuse it rather than record it.
  const requireSameContract = (/** @type {string} */ label, /** @type {LiveContract} */ observed) => {
    if (observed.schemaVersion !== contract.schemaVersion || observed.documents !== contract.documents) {
      throw new Error(
        `${label} contract drift: built schema ${contract.schemaVersion}/${contract.documents} docs, ` +
          `loaded ${observed.schemaVersion}/${observed.documents}`,
      );
    }
  };
  requireSameContract('image', loaded);
  requireSameContract('qlf', fallback);

  mkdirSync(GENERATED_DIR, { recursive: true });
  // These directories contain a finite derived inventory. Clear them on a real
  // rebuild so a removed document can never survive as an unmanifested asset.
  rmSync(join(GENERATED_DIR, 'provenance'), { recursive: true, force: true });
  rmSync(join(GENERATED_DIR, 'graph'), { recursive: true, force: true });
  writeFileSync(join(GENERATED_DIR, 'kb.pvm'), image);
  writeFileSync(join(GENERATED_DIR, 'kb.qlf'), qlf);
  writeFileSync(join(GENERATED_DIR, 'question-catalog.json'), catalogBytes);
  writeGenerated(provenance.index.path, provenance.index.bytes);
  for (const chunk of provenance.chunks) writeGenerated(chunk.path, chunk.bytes);
  writeGenerated(provenance.pdf.path, provenance.pdf.bytes);
  writeGenerated(graph.path, graph.bytes);

  const provenanceAssets = [
    asset(provenance.index.bytes, provenance.index.path, 'provenance-index'),
    ...provenance.chunks.map((chunk) => asset(chunk.bytes, chunk.path, 'provenance-document')),
    asset(provenance.pdf.bytes, provenance.pdf.path, 'source-pdf'),
  ];

  /** @type {KbManifest} */
  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    source: {
      bag,
      sha256: digest,
      bagitVersion: '1.0',
      payloadFiles: payload.length,
      tagFiles: tags.length,
    },
    input: { files: names.length, bytes: Buffer.byteLength(source, 'utf8'), sha256: inputDigest },
    toolchain: { swiplWasm, prolog: contract.prolog },
    catalog: {
      sourceFiles: catalog.names.length,
      sha256: sha256(catalogBytes),
      entries: catalog.records.length,
    },
    provenance: {
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      documents: provenance.stats.documents,
      clauses: provenance.stats.clauses,
      alignmentSpans: provenance.stats.alignmentSpans,
    },
    graph: {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodes: graph.model.stats.nodes,
      edges: graph.model.stats.edges,
    },
    assets: [
      asset(image, 'kb.pvm', 'pvm'),
      asset(qlf, 'kb.qlf', 'qlf'),
      asset(catalogBytes, 'question-catalog.json', 'catalog'),
      ...provenanceAssets,
      asset(graph.bytes, graph.path, 'semantic-graph'),
    ],
    contract: { schemaVersion: contract.schemaVersion, documents: contract.documents },
  };

  // Written last, and through a rename, so an interrupted build never leaves a
  // manifest claiming artifacts it did not finish producing.
  const temporary = `${MANIFEST_PATH}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(temporary, MANIFEST_PATH);
  process.stdout.write(
    `kb:build ok — ${names.length} files (${basename(bag)}) → ` +
      `pvm ${image.byteLength} B, qlf ${qlf.byteLength} B, ` +
      `catalog ${catalog.records.length} entries from ${catalog.names.length} controlled sources, ` +
      `provenance ${provenance.stats.documents} documents/${provenance.stats.clauses} clauses, ` +
      `graph ${graph.model.stats.nodes} nodes/${graph.model.stats.edges} edges, ` +
      `schema ${contract.schemaVersion}, ${contract.documents} documents\n`,
  );
};

main().catch((/** @type {unknown} */ error) => {
  process.stderr.write(`kb:build failed — ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
