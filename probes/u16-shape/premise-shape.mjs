// Orientation probe for O4: are the 346 clinical premises a SHARED patient-fact
// vocabulary (one Noul per fact, reusable across sentences) or per-sentence
// one-offs (forcing a per-sentence match instead)? Skolem normalization decides it.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../../tools/kb/bag.mjs';
import { payloadSource } from '../../tools/kb/paths.mjs';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const kbDir = join(ROOT, 'kb');
const bag = readdirSync(kbDir).filter((n) => n.endsWith('.tar.gz'))[0];
const bytes = readFileSync(join(kbDir, bag));
const sidecar = readFileSync(join(kbDir, `${bag}.sha256`), 'utf8').trim().split(/\s+/)[0];
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== sidecar) throw new Error('bag digest mismatch');

const { files } = verifyBag(bytes);
const { source } = payloadSource(files);

const facts = [...source.matchAll(/^clinical_premise\((.+)\)\.$/gmu)].map((m) => m[1]);
// arg4 is the parenthesized literal; split off the three leading scalar args.
const parsed = facts.map((raw) => {
  const m = /^([^,]+),([^,]+),([^,]+),(.+)$/u.exec(raw);
  return { doc: m[1], sentence: m[2], n: m[3], literal: m[4] };
});

// The skolem carries (Doc,S,N) so the SAME clinical fact reads differently per
// sentence. Normalizing it is what exposes whether the vocabulary is shared.
const norm = (lit) => lit.replace(/'\$clinical_hypothetical'\([^)]*\)/gu, '_H');

const byNorm = new Map();
for (const p of parsed) {
  const k = norm(p.literal);
  if (!byNorm.has(k)) byNorm.set(k, []);
  byNorm.get(k).push(`${p.doc}:${p.sentence}`);
}

const sentences = new Set(parsed.map((p) => `${p.doc}:${p.sentence}`));
const rawDistinct = new Set(parsed.map((p) => p.literal));

console.log(`clinical_premise facts        : ${parsed.length}`);
console.log(`distinct sentences            : ${sentences.size}`);
console.log(`distinct literals RAW         : ${rawDistinct.size}`);
console.log(`distinct literals SKOLEM-NORM : ${byNorm.size}`);

const shared = [...byNorm.entries()].filter(([, v]) => new Set(v).size > 1);
console.log(`normalized literals spanning >1 sentence : ${shared.length}`);
console.log(
  `premise occurrences covered by those     : ${shared.reduce((a, [, v]) => a + v.length, 0)}`,
);
console.log(`\ntop shared literals (count x sentences):`);
for (const [k, v] of shared.sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
  console.log(`  ${String(new Set(v).size).padStart(3)}  ${k.slice(0, 96)}`);
}
console.log(`\npredicate histogram (normalized):`);
const preds = new Map();
for (const [k, v] of byNorm) {
  const p = /^\(?([a-z_]+)\(/u.exec(k)?.[1] ?? '??';
  preds.set(p, (preds.get(p) ?? 0) + v.length);
}
for (const [p, c] of [...preds].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${p}`);
