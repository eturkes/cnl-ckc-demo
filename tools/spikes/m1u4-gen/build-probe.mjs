/* eslint-disable */
// @ts-nocheck
import { cpSync, existsSync, mkdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { ROOT, compileCatalogFromFiles, emitCatalog, readVerifiedArchive } from './catalog.mjs';

const RUNS = 50;
const TEMP = join(ROOT, '.scratch', 'm1u4-gen-gate');
const MAX_BUFFER = 32 * 1024 * 1024;

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const run = (command, args, cwd) => {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    maxBuffer: MAX_BUFFER,
  });
  return {
    command: [command, ...args].join(' '),
    rc: result.status ?? -1,
    wallClockMs: Number((performance.now() - started).toFixed(3)),
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const archiveCheckout = () => {
  rmSync(TEMP, { recursive: true, force: true });
  mkdirSync(TEMP, { recursive: true });
  const archive = spawnSync('git', ['archive', '--format=tar', 'HEAD'], {
    cwd: ROOT,
    maxBuffer: MAX_BUFFER,
  });
  if (archive.status !== 0) throw new Error(`git archive failed: ${String(archive.stderr)}`);
  const extracted = spawnSync('tar', ['-xf', '-', '-C', TEMP], {
    input: archive.stdout,
    maxBuffer: MAX_BUFFER,
  });
  if (extracted.status !== 0) throw new Error(`tar extraction failed: ${String(extracted.stderr)}`);
  cpSync(join(ROOT, 'tools', 'spikes', 'm1u4-gen'), join(TEMP, 'tools', 'spikes', 'm1u4-gen'), {
    recursive: true,
    force: true,
  });
  cpSync(
    join(ROOT, 'tests', 'spike-m1u4-gen-live.test.ts'),
    join(TEMP, 'tests', 'spike-m1u4-gen-live.test.ts'),
    { force: true },
  );
  symlinkSync(join(ROOT, 'node_modules'), join(TEMP, 'node_modules'), 'dir');
};

const measureGeneration = () => {
  const { files } = readVerifiedArchive(ROOT);
  compileCatalogFromFiles(files);
  const samples = [];
  let bytes = 0;
  for (let runIndex = 0; runIndex < RUNS; runIndex += 1) {
    const started = performance.now();
    const compiled = compileCatalogFromFiles(files);
    bytes = Buffer.byteLength(emitCatalog(compiled.records));
    samples.push(performance.now() - started);
  }
  return {
    runs: RUNS,
    medianWallClockMs: Number(median(samples).toFixed(3)),
    minimumWallClockMs: Number(Math.min(...samples).toFixed(3)),
    maximumWallClockMs: Number(Math.max(...samples).toFixed(3)),
    generatedBytes: bytes,
  };
};

const runAugmentedGate = () => {
  archiveCheckout();
  const artifact = join(TEMP, 'kb', 'generated', 'question-catalog.generated.ts');
  const commands = [
    ['pnpm', ['kb:build']],
    [process.execPath, ['tools/spikes/m1u4-gen/catalog.mjs', '--output', artifact]],
    ['pnpm', ['kb:asset-check']],
    ['pnpm', ['format:check']],
    ['pnpm', ['lint']],
    ['pnpm', ['check']],
    ['pnpm', ['test']],
    ['pnpm', ['build']],
  ];
  const steps = [];
  for (const [command, args] of commands) {
    const step = run(command, args, TEMP);
    steps.push(step);
    if (step.rc !== 0) break;
  }
  const failure = steps.find(({ rc }) => rc !== 0);
  const result = {
    passed: failure === undefined && steps.length === commands.length,
    generatedBytes: existsSync(artifact) ? statSync(artifact).size : 0,
    wallClockMs: Number(steps.reduce((total, step) => total + step.wallClockMs, 0).toFixed(3)),
    steps: steps.map(({ command, rc, wallClockMs }) => ({ command, rc, wallClockMs })),
    failure:
      failure === undefined
        ? '<none>'
        : `${failure.command}\n${failure.stdout.slice(-2000)}\n${failure.stderr.slice(-2000)}`,
  };
  rmSync(TEMP, { recursive: true, force: true });
  return result;
};

let gate;
try {
  gate = runAugmentedGate();
} finally {
  rmSync(TEMP, { recursive: true, force: true });
}
const output = { generation: measureGeneration(), gate };
process.stdout.write(`${JSON.stringify(output)}\n`);
if (!gate.passed) process.exitCode = 1;
