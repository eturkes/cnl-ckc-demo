/* eslint-disable */
// @ts-nocheck
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './catalog.mjs';

const TEMP = join(ROOT, '.scratch', 'm1u4-gen-dx');
const MAX_BUFFER = 32 * 1024 * 1024;
const IMPORT =
  "import { QUESTION_CATALOG, type QuestionId } from '@kb/question-catalog.generated';";
const CONSUMER = `${IMPORT}

export const findQuestion = (id: QuestionId) =>
  QUESTION_CATALOG.find((question) => question.id === id);
`;

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: TEMP,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    maxBuffer: MAX_BUFFER,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    command: [command, ...args].join(' '),
    rc: result.status ?? -1,
    errors: output.split('\n').filter((line) => line.includes(' ERROR ')),
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
  symlinkSync(join(ROOT, 'node_modules'), join(TEMP, 'node_modules'), 'dir');
};

let output;
try {
  archiveCheckout();
  const freshCheck = run('pnpm', ['check']);
  const kbBuild = run('pnpm', ['kb:build']);
  if (kbBuild.rc !== 0) throw new Error('private kb:build failed');
  writeFileSync(join(TEMP, 'src', 'spike-catalog-consumer.ts'), CONSUMER);
  const absentCatalogCheck = run('pnpm', ['check']);
  const generated = run(process.execPath, [
    'tools/spikes/m1u4-gen/catalog.mjs',
    '--output',
    join(TEMP, 'kb', 'generated', 'question-catalog.generated.ts'),
  ]);
  if (generated.rc !== 0) throw new Error('private catalog generation failed');
  const presentCatalogCheck = run('pnpm', ['check']);
  output = { importSnippet: IMPORT, freshCheck, absentCatalogCheck, presentCatalogCheck };
} finally {
  rmSync(TEMP, { recursive: true, force: true });
}
process.stdout.write(`${JSON.stringify(output)}\n`);
