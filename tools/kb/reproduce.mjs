// `pnpm kb:reproduce` — prove the producer is idempotent by building twice.
//
// Kept out of `pnpm gate` because each forced build costs a full compile; the
// claim it backs is durable, so it must stay rerunnable from committed state.
//
// Usage: node tools/kb/reproduce.mjs

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { requireFiring } from '../control.mjs';
import { ROOT, loadManifest } from './paths.mjs';

/** @typedef {import('../../src/kb/manifest.ts').KbManifest} KbManifest */

const build = () => {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'kb', 'build.mjs'), '--force'], { stdio: 'pipe' });
  const manifest = loadManifest();
  if (manifest === undefined) throw new Error('build produced no manifest');
  return manifest;
};

/**
 * Exact equality is the claim: the producer pins every clock the engine reads, so two builds
 * of one input have no legitimate reason to differ at all.
 *
 * @param {KbManifest} a @param {KbManifest} b @returns {string[]}
 */
const differences = (a, b) =>
  JSON.stringify(a, null, 2) === JSON.stringify(b, null, 2)
    ? []
    : ['two forced builds produced different manifests'];

const first = build();
const second = build();

// Control: the same comparison over a manifest carrying one changed digest. Two equal builds
// exercise the equal branch alone, so nothing else here proves the comparison can disagree.
const control = requireFiring(
  'kb:reproduce',
  { mutation: 'one asset digest changed in the second manifest', expect: ['different manifests'] },
  () => {
    const perturbed = structuredClone(second);
    const [asset] = perturbed.assets;
    if (asset === undefined) throw new Error('the manifest records no assets');
    asset.sha256 = `${asset.sha256.slice(1)}0`;
    return differences(first, perturbed);
  },
);

const failures = differences(first, second);
if (failures.length > 0) {
  process.stderr.write(`kb:reproduce failed — ${failures.join('; ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `kb:reproduce ok — two forced builds are byte-identical: ` +
      `${second.assets.map((asset) => `${asset.path} ${asset.sha256.slice(0, 12)}`).join(', ')}; ` +
      `control: ${control}\n`,
  );
}
