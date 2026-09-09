// `pnpm kb:export-check` — the legacy export lane's `EXPORTED` preflight.
//
// A bag whose exported query set drifted is refused here, early in the chain and without
// booting anything, so the suite below never runs against a bag nobody declared. The lane's
// byte oracle is graded by `pnpm binding:check`, which requires each of its cases to have
// PASSED in the gate's own suite run.
//
// The comparison itself lives in `tests/` because `kb:asset-check` bans answer-oracle reach
// over `tools/` — including a comment that merely spells the path, which is what keeps a
// runtime assembly from evading the byte scan. That ban is what makes those files oracles
// rather than a lookup table.
//
// Usage: node tools/kb/export-check.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { requireFiring } from '../control.mjs';
import { verifyBag } from './bag.mjs';
import { EXPORTED, exportedQueries } from './exports.mjs';
import { ROOT, loadManifest } from './paths.mjs';

const manifest = loadManifest();
if (manifest === undefined) {
  process.stderr.write('kb:export-check failed — no manifest at kb/generated; run pnpm kb:build\n');
  process.exitCode = 1;
} else {
  try {
    const files = verifyBag(readFileSync(join(ROOT, 'kb', manifest.source.bag))).files;

    // Control: the same verified bag with one declared query removed. A preflight that cannot
    // refuse a drifted export set is indistinguishable from a bag that never drifted.
    const control = requireFiring(
      'kb:export-check',
      {
        mutation: 'one declared query dropped from the verified bag',
        expect: ['bag exports differ from the declared set'],
      },
      () => {
        const short = new Map(files);
        const dropped = [...files.keys()].find((path) => /\/queries\/pl\/[^/]+\.pl$/u.test(path));
        if (dropped === undefined) throw new Error('the bag carries no compiled query to drop');
        short.delete(dropped);
        exportedQueries(short);
        return [];
      },
    );

    const queries = exportedQueries(files);
    process.stdout.write(
      `kb:export-check ok — ${String(queries.length)} of ${String(EXPORTED.length)} declared ` +
        `exports read from the bag: ${queries.map(({ id }) => id).join(', ')}; control: ${control}\n`,
    );
  } catch (/** @type {unknown} */ error) {
    process.stderr.write(
      `kb:export-check failed — ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
