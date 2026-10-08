// `pnpm spec:check` over copies of the real spec in the states a phase leaves behind. Each
// control strips a row of one kind, so a block holding none of that kind needs a planted row,
// or the control fires nothing and a sound block fails the gate.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SPEC = readFileSync(join(ROOT, '.agent', 'spec.md'), 'utf8');
const DIR = mkdtempSync(join(tmpdir(), 'spec-check-'));

/** A top-level `Tasks` row of one kind, with its indented continuation lines. */
const rows = (mark: 'x' | ' '): RegExp =>
  new RegExp(String.raw`^- \[${mark}\] .*\n(?: {2}.*\n)*`, 'gmu');

const specCheck = (spec: string): { status: number | null; output: string } => {
  const file = join(DIR, 'spec.md');
  writeFileSync(file, spec);
  const run = spawnSync(process.execPath, [join(ROOT, 'tools', 'spec-check.mjs'), file], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
};

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

describe('spec:check', () => {
  it('passes a Tasks block holding open rows alone, its SHA control on a planted row', () => {
    const spec = SPEC.replace(rows('x'), '');
    expect(spec).not.toMatch(rows('x'));
    expect(spec).toMatch(rows(' '));
    const { status, output } = specCheck(spec);
    expect(output).toMatch(/ 0 ticked with SHAs/u);
    expect(output).toContain('a planted ticked row stripped of its SHA');
    expect(status).toBe(0);
  });

  it('passes a Tasks block holding ticked rows alone, its open-unit controls on a planted row', () => {
    const spec = SPEC.replace(rows(' '), '');
    expect(spec).not.toMatch(rows(' '));
    expect(spec).toMatch(rows('x'));
    const { status, output } = specCheck(spec);
    expect(output).toMatch(/ — 0 open, /u);
    expect(output).toContain('a planted open unit written as a plain bullet');
    expect(output).toContain('a planted open unit written with a star bullet');
    expect(status).toBe(0);
  });
});
