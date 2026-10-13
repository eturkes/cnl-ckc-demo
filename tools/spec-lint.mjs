// `pnpm spec:lint` — `.agent/spec-lint` over `.agent/spec.md`: the template's shape check, a byte
// copy of `~/.local/app/agents/claude/spec-lint` (`CLAUDE.md` `Session flow`). Its cases live
// upstream; the controls prove the copy still refuses a broken copy of the real spec here.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { requireFiring } from './control.mjs';
import { ROOT } from './kb/paths.mjs';

const LINT = resolve(ROOT, '.agent/spec-lint');
const SPEC = '.agent/spec.md';

/**
 * @param {{file: string} | {text: string}} input a path, or spec text fed through stdin
 * @returns {{status: number | null, findings: string[]}}
 */
const lint = (input) => {
  const run =
    'file' in input
      ? spawnSync('sh', [LINT, input.file], { cwd: ROOT, encoding: 'utf8' })
      : spawnSync('sh', [LINT, '/dev/stdin'], { cwd: ROOT, encoding: 'utf8', input: input.text });
  return {
    status: run.status,
    findings: `${run.stdout}${run.stderr}`.split('\n').filter((line) => line !== ''),
  };
};

/** @param {string} text @returns {string[]} the refusal of a broken copy; a clean exit reports nothing */
const refusal = (text) => {
  const { status, findings } = lint({ text });
  return status === 1 ? findings : [];
};

const { status, findings } = lint({ file: SPEC });
if (status !== 0) {
  console.error(`spec:lint failed (rc ${String(status)}) — ${findings.join('; ')}`);
  process.exit(1);
}

// A passing spec holds `## Phase` (spec-lint requires the five sections in order), so the pointer
// = the last non-blank line above it; a row planted there stays inside `Tasks`.
const spec = readFileSync(resolve(ROOT, SPEC), 'utf8');
const lines = spec.split('\n');
let pointer = lines.indexOf('## Phase') - 1;
while (pointer > 0 && (lines[pointer] ?? '').trim() === '') pointer -= 1;
const planted = [
  ...lines.slice(0, pointer),
  '- [x] `0000000` planted control row.',
  ...lines.slice(pointer),
];

const controls = [
  requireFiring(
    'spec:lint',
    {
      mutation: 'a ticked row planted before the pointer with its SHA in backticks',
      expect: [`/dev/stdin:${String(pointer + 1)}: Tasks row`],
    },
    () => refusal(planted.join('\n')),
  ),
  requireFiring(
    'spec:lint',
    { mutation: 'the `## Tasks` heading written as H1', expect: ['expected `Tasks`'] },
    () => refusal(spec.replace('\n## Tasks\n', '\n# Tasks\n')),
  ),
];

console.log(`spec:lint ok — .agent/spec-lint passes ${SPEC}; controls: ${controls.join(', ')}`);
