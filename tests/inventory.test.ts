// `.agent/contracts/mnt5-inventory.md` = every check this repo runs, each with the record of it
// refusing a planted wrong input (`CLAUDE.md` `Engineering`: a check that cannot fail and
// a clean tree emit the same green). This suite holds the inventory to the tree: a suite, gate
// step or lane without a row reddens the gate, and so does a record that no longer resolves. A
// `commit:` SHA is graded for form alone — a shallow CI clone cannot resolve old commits.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LANE_SUITE } from '../tools/kb/exports.mjs';
import { ROOT } from '../tools/kb/paths.mjs';
import { MUTANTS, type Mutant } from '../tools/mutants.mjs';
import { queueRows } from '../tools/queue.mjs';
import { cells } from '../tools/validate-report.mjs';

const INVENTORY = '.agent/contracts/mnt5-inventory.md';
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface Facts {
  suites: string[];
  steps: string[];
  lanes: string[];
  answerSuites: Set<string>;
  mutants: readonly Mutant[];
  queueTitles: Set<string>;
  readText: (path: string) => string | undefined;
}

const facts = (): Facts => {
  const binding = read('tools/binding-check.mjs');
  const required = binding.slice(
    binding.indexOf('const REQUIRED'),
    binding.indexOf('const LIFECYCLE'),
  );
  const gate = read('.claude/rules/gate.md');
  const lanes = gate.slice(gate.indexOf('\nOut of the chain'));
  const script = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts[
    'gate:chain'
  ];
  return {
    suites: readdirSync(join(ROOT, 'tests'))
      .filter((file) => file.endsWith('.test.ts'))
      .map((file) => `tests/${file}`),
    steps: (script ?? '').split('&&').map((step) => step.trim().replace(/^pnpm /u, '')),
    lanes: [...lanes.matchAll(/^\| `pnpm ([\w:-]+)[^`]*` \|/gmu)].map(([, lane]) => lane ?? ''),
    answerSuites: new Set([
      LANE_SUITE,
      ...[...required.matchAll(/suite: '([^']+)'/gu)].map(([, suite]) => suite ?? ''),
    ]),
    mutants: MUTANTS,
    queueTitles: new Set(queueRows(read('.agent/deferred.md')).map(({ title }) => title)),
    readText: (path) => (existsSync(join(ROOT, path)) ? read(path) : undefined),
  };
};

/** Rows of the table under `## <heading>`, cells split on unescaped pipes. */
const table = (inventory: string, heading: string): string[][] => {
  const at = inventory.indexOf(`\n## ${heading}\n`);
  if (at < 0) return [];
  const end = inventory.indexOf('\n## ', at + 1);
  return inventory
    .slice(at, end < 0 ? undefined : end)
    .split('\n')
    .filter((line) => line.startsWith('| ') && !/^\| (?:check|suite) \|/u.test(line))
    .map(cells);
};

const unquote = (cell: string): string => cell.replace(/^`|`$/gu, '');

/** Every refusal, by row: a missing or extra row, or a record that does not resolve. */
const gradeInventory = (inventory: string, known: Facts): string[] => {
  const failures: string[] = [];
  const record = (where: string, kind: string, anchor: string, suite?: string): void => {
    const text = unquote(anchor);
    if (kind === 'mutate') {
      const mutant = known.mutants.find(({ label }) => label === text);
      if (mutant === undefined) failures.push(`${where}: names no mutant labelled "${text}"`);
      else if (
        suite !== undefined &&
        !(Array.isArray(mutant.check) ? mutant.check.includes(suite) : mutant.check.test === suite)
      )
        failures.push(`${where}: mutant "${text}" does not run ${suite}`);
    } else if (kind === 'commit') {
      if (!/^[0-9a-f]{7,40} \S/u.test(text))
        failures.push(`${where}: "${text}" is no SHA + anchor`);
    } else if (kind === 'text') {
      const [path = '', ...rest] = text.split(' ');
      const verbatim = rest.join(' ');
      const body = known.readText(path);
      // An empty anchor is found in every file, so a bare path would resolve without a record.
      if (verbatim.trim() === '') failures.push(`${where}: ${path} names no verbatim text`);
      else if (body === undefined) failures.push(`${where}: ${path} does not exist`);
      else if (!body.includes(verbatim))
        failures.push(`${where}: ${path} no longer holds "${verbatim}"`);
    } else if (kind === 'queue') {
      if (!known.queueTitles.has(text)) failures.push(`${where}: no queue row titled "${text}"`);
    } else if (kind !== 'none') {
      failures.push(`${where}: unknown record kind "${kind}"`);
    }
  };
  const roster = (name: string, rows: string[][], expected: string[], key: number): void => {
    const listed = rows.map((row) => unquote(row[key] ?? ''));
    for (const item of expected)
      if (!listed.includes(item)) failures.push(`${name}: no row for ${item}`);
    for (const item of listed)
      if (!expected.includes(item)) failures.push(`${name}: ${item} is no ${name} in the tree`);
    for (const item of new Set(listed.filter((entry, at) => listed.indexOf(entry) !== at)))
      failures.push(`${name}: ${item} has more than one row`);
  };
  const steps = table(inventory, 'Gate steps');
  const lanes = table(inventory, 'Lanes');
  const suites = table(inventory, 'Suites');
  roster('gate step', steps, known.steps, 0);
  roster('lane', lanes, known.lanes, 0);
  roster('suite', suites, known.suites, 0);
  for (const [check = '', , kind = '', anchor = ''] of [...steps, ...lanes])
    record(unquote(check), kind, anchor);
  // `none` is a lane that reports and grades nothing; a gate step grades, so it owes a record.
  for (const [check = '', , kind = ''] of steps)
    if (kind === 'none') failures.push(`${unquote(check)}: a gate step needs a firing record`);
  for (const [suite = '', path = '', , kind = '', anchor = ''] of suites) {
    const name = unquote(suite);
    const answer = known.answerSuites.has(name) ? 'answer' : 'off';
    if (path !== answer) failures.push(`${name}: path is ${answer}, the row says ${path}`);
    if (kind === 'none') failures.push(`${name}: a suite needs a firing record`);
    record(name, kind, anchor, name);
  }
  return failures;
};

describe('check inventory', () => {
  const known = facts();
  const inventory = read(INVENTORY);

  it('lists every suite, gate step and lane, each with a firing record that resolves', () => {
    expect(known.suites.length).toBeGreaterThan(0);
    expect(known.steps.length).toBeGreaterThan(0);
    expect(known.lanes.length).toBeGreaterThan(0);
    expect(known.answerSuites.size).toBeGreaterThan(1);
    expect(gradeInventory(inventory, known)).toEqual([]);
  });

  it('refuses an inventory missing a suite row, by suite', () => {
    const [first] = table(inventory, 'Suites');
    const line = inventory.split('\n').find((row) => row.startsWith(`| ${first?.[0] ?? '?'} |`));
    if (first === undefined || line === undefined) throw new Error('no suite row to drop');
    expect(gradeInventory(inventory.replace(`${line}\n`, ''), known)).toEqual([
      `suite: no row for ${unquote(first[0] ?? '')}`,
    ]);
  });

  it('refuses a record that no longer resolves, by row', () => {
    const relabelled = known.mutants.map((mutant) => ({ ...mutant, label: `${mutant.label}?` }));
    const failures = gradeInventory(inventory, { ...known, mutants: relabelled });
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.every((failure) => failure.includes('names no mutant labelled'))).toBe(true);
    expect(gradeInventory(inventory, { ...known, readText: () => '' })).toContainEqual(
      expect.stringMatching(/no longer holds/u),
    );
    expect(gradeInventory(inventory, { ...known, steps: [...known.steps, 'zz:check'] })).toEqual([
      'gate step: no row for zz:check',
    ]);
    const [suite] = table(inventory, 'Suites');
    const row = inventory.split('\n').find((line) => line.startsWith(`| ${suite?.[0] ?? '?'} |`));
    if (suite === undefined || row === undefined) throw new Error('no suite row to repeat');
    expect(gradeInventory(inventory.replace(row, `${row}\n${row}`), known)).toEqual([
      `suite: ${unquote(suite[0] ?? '')} has more than one row`,
    ]);
    const command = known.mutants.find(({ check }) => Array.isArray(check) && check[1] === 'exec');
    if (command === undefined) throw new Error('no command-checked mutant to cite');
    const cited = `| ${suite.slice(0, 3).join(' | ')} | mutate | \`${command.label}\` |`;
    expect(gradeInventory(inventory.replace(row, cited), known)).toEqual([
      `${unquote(suite[0] ?? '')}: mutant "${command.label}" does not run ${unquote(suite[0] ?? '')}`,
    ]);
  });
});
