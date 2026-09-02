// c20/D9: replay wt/spike-m1u4-gen 65f496a's own query parser against the bag and
// diff it against the shipped catalog. Fixes the field path: parseQueryFile
// returns `{ record, sourceSha256 }`, not a flat record.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { verifyBag } from '../tools/kb/bag.mjs';
import { parseQueryFile } from './spike/nested/gen-catalog.mjs';

const ROOT = join(import.meta.dirname, '..');

/** Index of the closing bracket of the group opening at `open`, quotes honoured. */
const close = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i += 1; i < text.length && text[i] !== c; i += 1) if (text[i] === '\\') i += 1;
    } else if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced');
};

const splitTop = (text) => {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i += 1; i < text.length && text[i] !== c; i += 1) if (text[i] === '\\') i += 1;
    } else if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) return [text.slice(0, i), text.slice(i + 1)];
  }
  return [text];
};

/** `','(A,B)` → `A,B`, recursively: the D4 prefix form rendered as the spike's infix form. */
const flatten = (goal) => {
  const text = goal.trim();
  if (!text.startsWith("','(")) return text;
  const end = close(text, 3);
  if (end !== text.length - 1) return text;
  const parts = splitTop(text.slice(4, end));
  return parts.length === 2 ? `${flatten(parts[0])},${flatten(parts[1])}` : text;
};

const kb = join(ROOT, 'kb');
const archive = readdirSync(kb).filter((n) => n.endsWith('.tar.gz'))[0];
const { files } = verifyBag(readFileSync(join(kb, archive)));
const shipped = JSON.parse(readFileSync(join(ROOT, 'kb/generated/question-catalog.json'), 'utf8'));
const byId = new Map(shipped.entries.map((e) => [e.id, e]));

let compared = 0;
let agreed = 0;
for (const name of [...files.keys()].filter((n) => /\/queries\/pl\/[^/]+\.pl$/.test(n)).sort()) {
  const source = Buffer.from(files.get(name)).toString('utf8');
  const { record } = parseQueryFile(source, basename(name));
  const mine = byId.get(record.id);
  if (mine === undefined) {
    process.stdout.write(`UNMATCHED ${record.id}\n`);
    continue;
  }
  compared += 1;
  const spikeGoal = record.goal;
  const sameTerm = flatten(mine.goal) === spikeGoal.trim();
  const sameBytes = spikeGoal === mine.goal;
  const sameProj =
    JSON.stringify(record.projection.map((p) => p.variable)) ===
    JSON.stringify(mine.projection.map((p) => p.variable));
  const sameQuestion = record.question === mine.question;
  if (sameTerm && sameProj && sameQuestion) agreed += 1;
  process.stdout.write(
    `${record.id}: sameTermAfterD4Flatten=${sameTerm} identicalBytes=${sameBytes} ` +
      `sameProjection=${sameProj} sameQuestion=${sameQuestion} spike=${spikeGoal.length}B main=${mine.goal.length}B\n`,
  );
}
process.stdout.write(`SPIKE-GEN AGREEMENT ${agreed}/${compared} exported ids\n`);
