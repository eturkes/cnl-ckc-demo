import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');
const build = read('tools/kb/build.mjs');
const paths = read('tools/kb/paths.mjs');
const catalog = read('tools/kb/catalog.mjs');
const clinical = read('tools/kb/clinical.mjs');

const provenancePasses =
  Number(/const provenance = deriveProvenance\(files\)/u.test(build)) +
  Number(/payloadSource\(files\)/u.test(build) && /clinicalArtifacts\(files\)/u.test(paths)) +
  Number(/catalogRecords\(files\)/u.test(build) && /clinicalArtifacts\(files\)/u.test(catalog));
assert.match(clinical, /const provenance = deriveProvenance\(files\)/u);
assert.equal(
  provenancePasses,
  1,
  `one build currently reaches deriveProvenance ${provenancePasses} times through overlapping APIs`,
);
