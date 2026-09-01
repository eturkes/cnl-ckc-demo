import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const command = [
  'exec',
  'vitest',
  'run',
  'spikes/m1u4-src/catalog-check.test.ts',
  '--config',
  'spikes/m1u4-src/vitest.config.ts',
  '--reporter=dot',
];
const samples = [];
for (let run = 0; run < 5; run += 1) {
  const started = performance.now();
  const result = spawnSync('pnpm', command, { cwd: ROOT, encoding: 'utf8' });
  const elapsed = performance.now() - started;
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  samples.push(elapsed);
}
const mutated = spawnSync('pnpm', command, {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, SRC_MUTATE_GOAL: '1' },
});
if (mutated.status === 0 || mutated.status === null) {
  process.stderr.write(mutated.stdout);
  process.stderr.write(mutated.stderr);
  process.exit(1);
}

const sorted = [...samples].sort((left, right) => left - right);
const median = sorted[Math.floor(sorted.length / 2)];
if (median === undefined) throw new Error('no timing samples');
process.stdout.write(
  `SRC_CHECK_COST\truns=${samples.length}\tms=${samples.map((value) => value.toFixed(3)).join(',')}\tmedianMs=${median.toFixed(3)}\tmutatedRc=${mutated.status}\n`,
);
