import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const manifestPath = join(root, 'kb/generated/kb-manifest.json');
const graphPath = join(root, 'kb/generated/graph/semantic-graph.json');
const originalManifest = readFileSync(manifestPath);
const originalGraph = readFileSync(graphPath);

try {
  const changedGraph = Buffer.concat([originalGraph, Buffer.from('\n')]);
  const parsed = /** @type {unknown} */ (JSON.parse(originalManifest.toString('utf8')));
  const manifest = /** @type {{ assets: { path: string, bytes: number, sha256: string }[] }} */ (
    parsed
  );
  const graph = manifest.assets.find(({ path }) => path === 'graph/semantic-graph.json');
  assert.ok(graph, 'manifest must record the semantic graph');
  graph.bytes = changedGraph.byteLength;
  graph.sha256 = createHash('sha256').update(changedGraph).digest('hex');
  writeFileSync(graphPath, changedGraph);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  execFileSync(process.execPath, [join(root, 'tools/kb/build.mjs')], { stdio: 'pipe' });
  assert.deepEqual(
    readFileSync(graphPath),
    originalGraph,
    'kb:build must replace manifest-authorized bytes that differ from its fresh bag derivation',
  );
} finally {
  writeFileSync(graphPath, originalGraph);
  writeFileSync(manifestPath, originalManifest);
}
