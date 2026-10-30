// `pnpm ci:gate` (`tools/ci-gate.mjs`) decides a unit's full gate, so every way it can see a run
// must fail closed: the real script runs against fake `git` and `gh` binaries placed first on
// `PATH`, each logging its calls and answering from one scripted scenario.

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { ROOT } from '../tools/kb/paths.mjs';

interface Scenario {
  dirty?: boolean;
  listed?: string;
  watch?: number | 'killed';
  view?: { status: string; conclusion: string; jobs: { name: string; conclusion: string }[] };
}

const BIN = mkdtempSync(join(tmpdir(), 'ci-gate-fakes-'));
const FAKE = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const scenario = JSON.parse(process.env.FAKE_SCENARIO);
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_LOG, [require('node:path').basename(process.argv[1]), ...args].join(' ') + '\\n');
const out = (text) => process.stdout.write(text);
if (args[0] === 'status') out(scenario.dirty ? ' M src/x.ts\\n' : '');
else if (args[0] === 'rev-parse') out('${'a'.repeat(40)}\\n');
else if (args[1] === 'list') out(scenario.listed ?? '');
else if (args[1] === 'watch') {
  if (scenario.watch === 'killed') process.kill(process.pid, 'SIGTERM');
  else process.exit(scenario.watch ?? 0);
} else if (args[1] === 'view') out(JSON.stringify(scenario.view));
`;
for (const name of ['git', 'gh']) {
  writeFileSync(join(BIN, name), FAKE);
  chmodSync(join(BIN, name), 0o755);
}

afterAll(() => {
  rmSync(BIN, { recursive: true, force: true });
});

const green = {
  status: 'completed',
  conclusion: 'success',
  jobs: [
    { name: 'plan', conclusion: 'success' },
    { name: 'lint', conclusion: 'success' },
  ],
};

const gate = (scenario: Scenario, unit = 'probe') => {
  const log = join(BIN, `calls-${String(Math.random()).slice(2)}.log`);
  writeFileSync(log, '');
  const run = spawnSync(process.execPath, [join(ROOT, 'tools/ci-gate.mjs'), unit], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${BIN}:${process.env.PATH ?? ''}`,
      FAKE_SCENARIO: JSON.stringify(scenario),
      FAKE_LOG: log,
      CI_GATE_FIND_MS: '1',
    },
  });
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  return { status: run.status, out: `${run.stdout}${run.stderr}`, calls };
};
const deleted = (calls: string[]): boolean =>
  calls.some((call) => call.startsWith('git push origin --delete'));

describe('ci:gate', () => {
  it('a green run deletes the branch and reports every job', () => {
    const run = gate({ listed: '12345', watch: 0, view: green });
    expect(run.status).toBe(0);
    expect(run.out).toContain('ci:gate ok — run 12345: 2 jobs green at aaaaaaa; ci/probe deleted');
    expect(deleted(run.calls)).toBe(true);
    expect(run.calls).toContain(
      `gh run list --branch ci/probe --commit ${'a'.repeat(40)} --event push --json databaseId,workflowName -q .[] | select(.workflowName == "Gate fan-out") | .databaseId`,
    );
  });

  it('a red run names each red job alone and keeps the branch', () => {
    const run = gate({
      listed: '12345',
      watch: 1,
      view: {
        status: 'completed',
        conclusion: 'failure',
        jobs: [
          { name: 'lint', conclusion: 'failure' },
          { name: 'build', conclusion: 'success' },
          { name: 'check', conclusion: 'cancelled' },
        ],
      },
    });
    expect(run.status).toBe(1);
    expect(run.out).toContain('run 12345 failure: lint, check; ci/probe kept');
    expect(deleted(run.calls)).toBe(false);
  });

  it('a killed watch fails closed whatever the run reports', () => {
    const run = gate({ listed: '12345', watch: 'killed', view: green });
    expect(run.status).toBe(1);
    expect(run.out).toContain('gh run watch 12345 failed (killed by SIGTERM); ci/probe kept');
    expect(deleted(run.calls)).toBe(false);
  });

  it('a watch exiting nonzero beside a green record fails closed', () => {
    const run = gate({ listed: '12345', watch: 1, view: green });
    expect(run.status).toBe(1);
    expect(deleted(run.calls)).toBe(false);
  });

  it('a run that has not completed fails closed', () => {
    const run = gate({
      listed: '12345',
      watch: 0,
      view: { ...green, status: 'in_progress', conclusion: '' },
    });
    expect(run.status).toBe(1);
    expect(run.out).toContain('run 12345 is in_progress, not completed');
    expect(deleted(run.calls)).toBe(false);
  });

  it('a successful run holding no job fails closed', () => {
    const run = gate({ listed: '12345', watch: 0, view: { ...green, jobs: [] } });
    expect(run.status).toBe(1);
    expect(deleted(run.calls)).toBe(false);
  });

  it('no listed run for the push fails closed before any watch', () => {
    const run = gate({ listed: '' });
    expect(run.status).toBe(1);
    expect(run.out).toContain('no "Gate fan-out" run for aaaaaaa on ci/probe');
    expect(run.calls.some((call) => call.startsWith('gh run watch'))).toBe(false);
  });

  it('a dirty tree and a bad unit name are refused before any push', () => {
    const dirty = gate({ dirty: true });
    expect(dirty.status).toBe(2);
    expect(dirty.calls.some((call) => call.startsWith('git push'))).toBe(false);
    const bad = gate({}, 'a/b');
    expect(bad.status).toBe(2);
    expect(bad.calls).toEqual([]);
  });
});
