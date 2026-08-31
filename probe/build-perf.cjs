'use strict';

const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const SWIPL = require('swipl-wasm');
const { generateImageBuffer } = require('swipl-wasm/dist/generateImage');

const kbDir = process.env.KB_PL_DIR || process.argv[4] || process.argv[2];
if (!kbDir) throw new Error('set KB_PL_DIR or pass the payload directory');

const source = readdirSync(kbDir)
  .filter((name) => name.endsWith('.pl'))
  .sort()
  .map((name) => `\n% file:${name}\n${readFileSync(`${kbDir}/${name}`, 'utf8')}\n`)
  .join('');
const round = (value) => Number(value.toFixed(3));
const describe = (artifact) => ({
  sha256: createHash('sha256').update(artifact).digest('hex'),
  bytes: artifact.length,
});
const quiet = { arguments: ['-q'], print() {}, printErr() {} };

async function child(mode) {
  if (mode === 'pvm') {
    const start = performance.now();
    const artifact = Buffer.from(await generateImageBuffer(source));
    return { mode, totalMs: round(performance.now() - start), ...describe(artifact) };
  }
  if (mode === 'qlf') {
    const start = performance.now();
    const module = await SWIPL(quiet);
    const bootMs = performance.now() - start;
    module.FS.writeFile('/all.pl', source);
    const compileStart = performance.now();
    module.prolog.query("qcompile('/all.pl').").once();
    const qcompileMs = performance.now() - compileStart;
    const artifact = Buffer.from(module.FS.readFile('/all.qlf'));
    return {
      mode,
      totalMs: round(performance.now() - start),
      bootMs: round(bootMs),
      qcompileMs: round(qcompileMs),
      ...describe(artifact),
    };
  }
  throw new Error(`unknown mode: ${mode}`);
}

function summary(runs) {
  const times = runs.map(({ totalMs }) => totalMs).sort((a, b) => a - b);
  return {
    minMs: times[0],
    medianMs: times[1],
    maxMs: times[2],
    artifactBytes: runs.map(({ bytes }) => bytes),
  };
}

async function main() {
  if (process.argv[2] === 'child') {
    process.stdout.write(`${JSON.stringify(await child(process.argv[3]))}\n`);
    return;
  }
  const results = {};
  for (const mode of ['pvm', 'qlf']) {
    results[mode] = Array.from({ length: 3 }, () => {
      const run = spawnSync(process.execPath, [__filename, 'child', mode, kbDir], {
        encoding: 'utf8',
        env: { ...process.env, KB_PL_DIR: kbDir },
      });
      if (run.status !== 0) throw new Error(run.stderr || `${mode} child exited ${run.status}`);
      return JSON.parse(run.stdout);
    });
  }
  process.stdout.write(`${JSON.stringify({
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    sourceBytes: Buffer.byteLength(source),
    runs: results,
    summary: { pvm: summary(results.pvm), qlf: summary(results.qlf) },
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
