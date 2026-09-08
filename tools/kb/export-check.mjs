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

import { verifyBag } from './bag.mjs';
import { EXPORTED, exportedQueries } from './exports.mjs';
import { ROOT, loadManifest } from './paths.mjs';

const manifest = loadManifest();
if (manifest === undefined) {
  process.stderr.write('kb:export-check failed — no manifest at kb/generated; run pnpm kb:build\n');
  process.exitCode = 1;
} else {
  try {
    const queries = exportedQueries(
      verifyBag(readFileSync(join(ROOT, 'kb', manifest.source.bag))).files,
    );
    process.stdout.write(
      `kb:export-check ok — ${String(queries.length)} of ${String(EXPORTED.length)} declared ` +
        `exports read from the bag: ${queries.map(({ id }) => id).join(', ')}\n`,
    );
  } catch (/** @type {unknown} */ error) {
    process.stderr.write(
      `kb:export-check failed — ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
