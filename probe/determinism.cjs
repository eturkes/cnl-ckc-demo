'use strict';

const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { generateImageBuffer } = require('swipl-wasm/dist/generateImage');

const kbDir = process.env.KB_PL_DIR || process.argv[3];
if (!kbDir) throw new Error('set KB_PL_DIR or pass the payload directory');

function source() {
  return readdirSync(kbDir)
    .filter((name) => name.endsWith('.pl'))
    .sort()
    .map((name) => `\n% file:${name}\n${readFileSync(`${kbDir}/${name}`, 'utf8')}\n`)
    .join('');
}

function describe(buffer) {
  return { sha256: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

async function build() {
  return describe(await generateImageBuffer(source()));
}

async function main() {
  if (process.argv[2] === 'child') {
    process.stdout.write(`${JSON.stringify(await build())}\n`);
    return;
  }

  const sameProcess = [await build(), await build()];
  const separateProcesses = [0, 1].map(() => {
    const child = spawnSync(process.execPath, [__filename, 'child', kbDir], {
      encoding: 'utf8',
      env: { ...process.env, KB_PL_DIR: kbDir },
    });
    if (child.status !== 0) throw new Error(child.stderr || `child exited ${child.status}`);
    return JSON.parse(child.stdout);
  });
  process.stdout.write(`${JSON.stringify({ sameProcess, separateProcesses }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
