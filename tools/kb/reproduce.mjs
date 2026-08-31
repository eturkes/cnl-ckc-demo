// `pnpm kb:reproduce` — prove the producer is idempotent by building twice.
//
// Kept out of `pnpm gate` because each forced build costs a full compile; the
// claim it backs is durable, so it must stay rerunnable from committed state.
//
// Usage: node tools/kb/reproduce.mjs

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ROOT, loadManifest } from './paths.mjs';

const build = () => {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'kb', 'build.mjs'), '--force'], { stdio: 'pipe' });
  const manifest = loadManifest();
  if (manifest === undefined) throw new Error('build produced no manifest');
  return manifest;
};

// Exact equality is the claim: the producer pins every clock the engine reads, so
// two builds of one input have no legitimate reason to differ at all.
const first = JSON.stringify(build(), null, 2);
const second = build();

if (first !== JSON.stringify(second, null, 2)) {
  process.stderr.write('kb:reproduce failed — two forced builds produced different manifests\n');
  process.exitCode = 1;
} else {
  process.stdout.write(
    `kb:reproduce ok — two forced builds are byte-identical: ` +
      `${second.assets.map((asset) => `${asset.path} ${asset.sha256.slice(0, 12)}`).join(', ')}\n`,
  );
}
