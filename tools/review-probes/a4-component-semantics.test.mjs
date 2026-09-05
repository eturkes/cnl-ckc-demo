import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const ladder = readFileSync(join(root, 'src/provenance/ProvenanceLadder.svelte'), 'utf8');
const app = readFileSync(join(root, 'src/App.svelte'), 'utf8');

/** @type {[string, string, RegExp][]} */
const checks = [
  ['proof flattening', ladder, /\bflattenProof\(/u],
  ['proof document selection', ladder, /steps\.find\(\(step\) => step\.document/u],
  ['proof-line to clause join', ladder, /evidence\?\.clauses\.filter\(/u],
  ['proof document aggregation', app, /\bflattenProof\(demo\.provenance\.steps\)/u],
];
for (const [label, source, pattern] of checks) {
  assert.equal(
    pattern.test(source),
    false,
    `${label} is domain semantics and must live in a provenance/graph model, not a Svelte component`,
  );
}
