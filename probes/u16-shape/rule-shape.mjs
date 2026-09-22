// Follow-on to premise-shape.mjs. The premises turned out to be skolem scaffolding
// (42 shapes, 45/46 sentences assuming only "a clinician exists"), so they cannot
// discriminate one patient from another. This locates the signal that CAN: the
// conditions and action modifiers carried on each clinical_rule/3.
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
if (createHash('sha256').update(bytes).digest('hex') !== sidecar) throw new Error('bag mismatch');

const { files } = verifyBag(bytes);
const { source } = payloadSource(files);
const rules = [...source.matchAll(/^clinical_rule\('([^']+)',(\d+),rule\((.+)\)\)\.$/gmu)];

const tally = (xs) => {
  const m = new Map();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

const conds = [];
const mods = [];
const objs = [];
const modes = [];
const perDoc = new Map();
let unconditional = 0;

for (const [, doc, sent, body] of rules) {
  const condBlock = /^\[(.*?)\],"/su.exec(body)?.[1] ?? '';
  const cs = [...condBlock.matchAll(/"([^"]+)"/gu)].map((m) => m[1]);
  if (cs.length === 0) unconditional += 1;
  conds.push(...cs);
  modes.push(/,(should|can|fact),\[action/u.exec(body)?.[1] ?? '??');
  for (const m of body.matchAll(/modifier\((\w+),"([^"]+)"\)/gu)) mods.push(`${m[1]} ${m[2]}`);
  for (const m of body.matchAll(/action\((\w+),(\w+),"([^"]+)"/gu)) objs.push(`${m[1]} ${m[2]} ${m[3]}`);
  perDoc.set(doc, (perDoc.get(doc) ?? 0) + 1);
  void sent;
}

console.log(`clinical_rule facts            : ${rules.length}`);
console.log(`rules with NO condition        : ${unconditional} / ${rules.length}`);
console.log(`condition occurrences          : ${conds.length}`);
console.log(`DISTINCT condition strings     : ${new Set(conds).size}`);
console.log(`DISTINCT action modifiers      : ${new Set(mods).size}`);
console.log(`DISTINCT action verb+object    : ${new Set(objs).size}`);
console.log(`mode split                     : ${JSON.stringify(Object.fromEntries(tally(modes)))}`);

console.log(`\nevery distinct condition:`);
for (const [c, n] of tally(conds)) console.log(`  ${String(n).padStart(2)}x  ${c}`);

console.log(`\ntop action modifiers (the situation vocabulary):`);
for (const [m, n] of tally(mods).slice(0, 18)) console.log(`  ${String(n).padStart(2)}x  ${m}`);

console.log(`\nrules per document:`);
for (const [d, n] of [...perDoc].sort()) console.log(`  ${String(n).padStart(2)}  ${d}`);
