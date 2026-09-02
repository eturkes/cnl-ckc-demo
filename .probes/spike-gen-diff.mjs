// c20: replay wt/spike-m1u4-gen 65f496a's own query parser against 9020e62's bag.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { verifyBag } from '../tools/kb/bag.mjs';
import { parseQueryFile } from './spike/nested/gen-catalog.mjs';

const ROOT = join(import.meta.dirname, '..');
const kb = join(ROOT, 'kb');
const archive = readdirSync(kb).filter((n) => n.endsWith('.tar.gz'))[0];
const { files } = verifyBag(readFileSync(join(kb, archive)));
const shipped = JSON.parse(readFileSync(join(ROOT, 'kb/generated/question-catalog.json'), 'utf8'));
const byId = new Map(shipped.entries.map((e) => [e.id, e]));

for (const name of [...files.keys()].filter((n) => /\/queries\/pl\/[^/]+\.pl$/.test(n)).sort()) {
  const source = Buffer.from(files.get(name)).toString('utf8');
  const parsed = parseQueryFile(source, basename(name));
  const mine = byId.get(parsed.id);
  if (mine === undefined) {
    process.stdout.write(`UNMATCHED id=${JSON.stringify(parsed.id)} shape=${JSON.stringify(parsed).slice(0, 500)}\n`);
    continue;
  }
  const spikeGoal = parsed.goalText ?? parsed.goal ?? '<none>';
  process.stdout.write(
    `${parsed.id}: fields=${Object.keys(parsed).join('|')} identicalGoalBytes=${spikeGoal === mine.goal} ` +
      `spike=${Buffer.byteLength(String(spikeGoal))}B main=${Buffer.byteLength(mine.goal)}B ` +
      `question=${parsed.question === mine.question} projVars=${JSON.stringify(parsed.projection ?? parsed.answers)}\n` +
      `  spikeGoalHead=${String(spikeGoal).slice(0, 70)}\n  mainGoalHead=${mine.goal.slice(0, 70)}\n`,
  );
}
