// The step ledger (`tools/gate-ledger.mjs`) is what makes a rerun count only once its red is
// classified, so a red row must enter pending, classification must touch pending rows alone, and
// the tree id must move with content and nothing else. The CLI runs against a temp ledger. P1–P4
// hold the ledger's contract over generated rows; L1–L6 pin named cases.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';

import {
  appendRows,
  CLASSES,
  classify,
  classifyCommand,
  COLUMNS,
  LEDGER,
  ledgerWith,
  loadNote,
  parseLedger,
  pendingRefusal,
  pendingRefusals,
  readLedger,
  rowOf,
  workingTree,
} from '../tools/gate-ledger.mjs';
import { ROOT } from '../tools/kb/paths.mjs';
import { holds } from './support/property.js';

const DIR = mkdtempSync(join(tmpdir(), 'gate-ledger-'));

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

const step = (name: string, red?: string) =>
  rowOf('gate', 'tree1', '2026-11-04T00:00:00.000Z', {
    step: name,
    seconds: '1.0',
    red,
    note: 'load 1.00',
  });

// Every tree id is read with git pinned to the repository under test: a mutant that drops the
// call's cwd or env must still land there, never in the checkout around Stryker's sandbox.
const treeOf = (repo: string): string => {
  const saved = [process.env['GIT_DIR'], process.env['GIT_WORK_TREE']];
  process.env['GIT_DIR'] = join(repo, '.git');
  process.env['GIT_WORK_TREE'] = repo;
  try {
    return workingTree(repo);
  } finally {
    const [dir, tree] = saved;
    if (dir === undefined) delete process.env['GIT_DIR'];
    else process.env['GIT_DIR'] = dir;
    if (tree === undefined) delete process.env['GIT_WORK_TREE'];
    else process.env['GIT_WORK_TREE'] = tree;
  }
};

const cli = (ledger: string, ...args: string[]) => {
  const run = spawnSync(process.execPath, [join(ROOT, 'tools/gate-classify.mjs'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, GATE_LEDGER: ledger },
  });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
};

describe('gate ledger', () => {
  it('L1 a red row enters unclassified and is refused by name; a green row never is', () => {
    const text = ledgerWith('', [step('lint'), step('check', 'exit 1')]);
    expect(text.split('\n')[0]).toBe('date\ttree\tgate\tstep\tseconds\tverdict\tclass\tnote');
    expect(pendingRefusals(text)).toEqual([
      'unclassified red: check (gate 2026-11-04T00:00:00.000Z, red exit 1)',
    ]);
    expect(pendingRefusals(ledgerWith('', [step('lint')]))).toEqual([]);
    expect(parseLedger(text)[0]).toMatchObject({ verdict: 'green', class: '-' });
    expect(loadNote(13.184)).toBe('load 13.18');
  });

  it('L2 classifying touches pending rows alone and keeps their note', () => {
    const before = ledgerWith('', [step('lint'), step('check', 'exit 1')]);
    const once = classify(before, 'flake', 'load 31.2 on 8 cores');
    expect(once.count).toBe(1);
    expect(pendingRefusals(once.text)).toEqual([]);
    const [green, red] = parseLedger(once.text);
    expect(green).toEqual(parseLedger(before)[0]);
    expect(red).toMatchObject({ class: 'flake', note: 'load 1.00; load 31.2 on 8 cores' });
    const again = classify(ledgerWith(once.text, [step('build', 'exit 2')]), 'product', '');
    expect(again.count).toBe(1);
    expect(parseLedger(again.text).map((row) => row.class)).toEqual(['-', 'flake', 'product']);
    // Any note survives, a mutation tool's sentinel text included.
    const kept = classify(ledgerWith('', [step('x', 'exit 1')]), 'gate', 'Stryker was here!');
    expect(parseLedger(kept.text)[0]?.note).toBe('load 1.00; Stryker was here!');
  });

  it('L3 appending keeps every earlier byte, and a cell never carries a tab or a newline', () => {
    const first = ledgerWith('', [step('lint')]);
    const text = ledgerWith(first, [{ ...step('check', 'exit\t1'), note: 'two\nlines\tand tab' }]);
    expect(text.startsWith(first)).toBe(true);
    expect(text.split('\n').filter(Boolean)).toHaveLength(3);
    expect(parseLedger(text)[1]).toMatchObject({
      verdict: 'red exit 1',
      note: 'two lines and tab',
    });
  });

  it('L6 a row cut short or of no known class reads pending, and an unreadable ledger throws', () => {
    const whole = ledgerWith('', [step('lint', 'exit 1')]);
    const cut = whole.slice(0, whole.indexOf('red exit 1') + 'red exit 1'.length);
    expect(pendingRefusals(cut)).toEqual([
      'unclassified red: lint (gate 2026-11-04T00:00:00.000Z, red exit 1)',
    ]);
    expect(pendingRefusals(whole.replace('unclassified', 'maybe'))).toHaveLength(1);
    const green = ledgerWith('', [step('lint')]);
    expect(pendingRefusals(green.replace('\tload 1.00\n', '\n'))).toHaveLength(1);
    expect(pendingRefusals(green.replace('\tload 1.00\n', '\tload 1.00\textra\n'))).toHaveLength(1);
    expect(parseLedger(classify(cut, 'gate', 'cut row').text)[0]).toMatchObject({ class: 'gate' });
    expect(readLedger(join(DIR, 'absent.tsv'))).toBe('');
    writeFileSync(join(DIR, 'present.tsv'), whole);
    expect(readLedger(join(DIR, 'present.tsv'))).toBe(whole);
    expect(() => readLedger(DIR)).toThrow(/EISDIR/u);
  });

  it('L4 the CLI classifies the ledger in place and refuses an unknown class or nothing pending', () => {
    expect(LEDGER).toBe(join(ROOT, '.gate-ledger.tsv'));
    expect(CLASSES).toEqual(['product', 'gate', 'flake', 'planted']);
    const local = join(DIR, 'command.tsv');
    writeFileSync(local, ledgerWith('', [step('lint', 'exit 1')]));
    expect(classifyCommand(['guess'], local)).toEqual({
      status: 2,
      stdout: '',
      stderr: 'usage: pnpm gate:classify <product|gate|flake|planted> [note…]\n',
    });
    expect(classifyCommand([], local).status).toBe(2);
    expect(classifyCommand(['planted', 'a', 'drill'], local)).toEqual({
      status: 0,
      stdout: 'gate:classify: 1 red row(s) → planted\n',
      stderr: '',
    });
    expect(parseLedger(readFileSync(local, 'utf8'))[0]).toMatchObject({
      class: 'planted',
      note: 'load 1.00; a drill',
    });
    expect(classifyCommand(['gate'], local)).toEqual({
      status: 1,
      stdout: '',
      stderr: `gate:classify: no unclassified red row in ${local}\n`,
    });
    const ledger = join(DIR, 'cli.tsv');
    writeFileSync(ledger, ledgerWith('', [step('lint', 'exit 1')]));
    expect(cli(ledger, 'guess')).toMatchObject({ status: 2 });
    expect(cli(ledger, 'gate', 'harness', 'race')).toMatchObject({
      status: 0,
      out: 'gate:classify: 1 red row(s) → gate\n',
    });
    expect(parseLedger(readFileSync(ledger, 'utf8'))[0]).toMatchObject({
      class: 'gate',
      note: 'load 1.00; harness race',
    });
    expect(cli(ledger, 'gate').status).toBe(1);
  });

  it('L7 appending writes the header once and keeps every row; a pending red names its fix', () => {
    const ledger = join(DIR, 'append.tsv');
    appendRows([step('lint')], ledger);
    appendRows([step('check', 'exit 1')], ledger);
    const written = readFileSync(ledger, 'utf8');
    expect(written).toBe(ledgerWith(ledgerWith('', [step('lint')]), [step('check', 'exit 1')]));
    expect(pendingRefusal('gate', ledgerWith('', [step('lint')]))).toBeUndefined();
    expect(pendingRefusal('gate', written)).toBe(
      `gate: unclassified red: check (gate 2026-11-04T00:00:00.000Z, red exit 1) — in ${LEDGER}; ` +
        'a rerun counts once its red is classified: ' +
        'pnpm gate:classify <product|gate|flake|planted> [note]\n',
    );
  });

  it('L5 the tree id moves with tracked and untracked content, never with an ignored file', () => {
    const repo = join(DIR, 'repo');
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
    execFileSync('git', ['init', '-q', repo]);
    // `kept.txt` is tracked although `.gitignore` names it: a tree rebuilt from an empty index
    // would drop it, so the id must come from the real index's entries.
    writeFileSync(join(repo, '.gitignore'), 'ignored.txt\nkept.txt\n');
    writeFileSync(join(repo, 'a.txt'), 'one\n');
    writeFileSync(join(repo, 'kept.txt'), 'tracked\n');
    git('add', '-A');
    git('add', '-f', 'kept.txt');
    git(
      ...['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'],
      ...['-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base'],
    );
    const clean = treeOf(repo);
    expect(clean).toBe(git('rev-parse', 'HEAD^{tree}'));
    writeFileSync(join(repo, 'ignored.txt'), 'noise\n');
    expect(treeOf(repo)).toBe(clean);
    writeFileSync(join(repo, 'b.txt'), 'new\n');
    const untracked = treeOf(repo);
    expect(untracked).not.toBe(clean);
    writeFileSync(join(repo, 'a.txt'), 'two\n');
    const edited = treeOf(repo);
    expect(edited).not.toBe(untracked);
    // The real index stays as the user left it: nothing staged, the untracked file untracked.
    expect(git('diff', '--cached', '--name-only')).toBe('');
    expect(git('ls-files')).toBe('.gitignore\na.txt\nkept.txt');
    writeFileSync(join(repo, 'kept.txt'), 'edited\n');
    expect(treeOf(repo)).not.toBe(edited);
    expect(treeOf(join(DIR, 'nowhere'))).toBe('unknown');
    const fresh = join(DIR, 'fresh');
    execFileSync('git', ['init', '-q', fresh]);
    writeFileSync(join(fresh, 'c.txt'), 'only\n');
    expect(existsSync(join(fresh, '.git', 'index'))).toBe(false);
    const unindexed = treeOf(fresh);
    execFileSync('git', ['add', '-A'], { cwd: fresh });
    expect(unindexed).toBe(
      execFileSync('git', ['write-tree'], { cwd: fresh, encoding: 'utf8' }).trim(),
    );
  });
});

// A cell may hold any whitespace a note or a step name carries; the ledger folds each run to one
// space and trims, so the contract's expected cell is that folding.
const fold = (value: string): string => value.replace(/\s+/gu, ' ').trim();
const text = fc.string({
  unit: fc.constantFrom('a', 'Z', '0', ' ', '\t', '\n', '\r', ';', '|', 'é', '-'),
  maxLength: 12,
});
const anyRow = fc.record({
  date: text,
  tree: text,
  gate: text,
  step: text,
  seconds: text,
  verdict: text,
  class: fc.constantFrom('-', 'unclassified', ...CLASSES),
  note: text,
});
const folded = (row: Record<(typeof COLUMNS)[number], string>) =>
  Object.fromEntries(COLUMNS.map((column) => [column, fold(row[column])]));

describe('gate ledger properties', () => {
  it('P1 every row written reads back as written, each cell folded', () => {
    holds(
      fc.property(fc.array(anyRow, { maxLength: 6 }), (rows) => {
        expect(parseLedger(ledgerWith('', rows))).toEqual(rows.map(folded));
      }),
    );
  });

  it('P2 an append keeps every earlier byte and adds exactly its own rows', () => {
    holds(
      fc.property(
        fc.array(anyRow, { maxLength: 4 }),
        fc.array(anyRow, { maxLength: 4 }),
        (before, after) => {
          const first = ledgerWith('', before);
          const both = ledgerWith(first, after);
          expect(both.startsWith(first)).toBe(true);
          expect(parseLedger(both)).toEqual([...before, ...after].map(folded));
        },
      ),
    );
  });

  it('P3 classifying moves exactly the pending rows to the class and leaves the rest', () => {
    holds(
      fc.property(
        fc.array(anyRow, { maxLength: 6 }),
        fc.constantFrom(...CLASSES),
        text,
        (rows, kind, note) => {
          const before = parseLedger(ledgerWith('', rows));
          const pending = before.filter((row) => row.class === 'unclassified').length;
          const { text: after, count } = classify(ledgerWith('', rows), kind, note);
          expect(count).toBe(pending);
          expect(pendingRefusals(after)).toEqual([]);
          const read = parseLedger(after);
          expect(read).toHaveLength(before.length);
          read.forEach((row, at) => {
            const was = before[at];
            if (was === undefined) throw new Error(`row ${String(at)} vanished`);
            if (was.class !== 'unclassified') expect(row).toEqual(was);
            else {
              expect(row).toEqual({ ...was, class: kind, note: row.note });
              expect(row.note.startsWith(was.note)).toBe(true);
            }
          });
        },
      ),
    );
  });

  it('P4 a pending red cut at every character still reads pending; a cut to nothing reads no row', () => {
    holds(
      fc.property(anyRow, (row) => {
        const line = ledgerWith('', [{ ...row, class: 'unclassified' }]).split('\n')[1] ?? '';
        for (let cut = 0; cut <= line.length; cut += 1) {
          const refusals = pendingRefusals(`${COLUMNS.join('\t')}\n${line.slice(0, cut)}\n`);
          expect(refusals).toHaveLength(cut === 0 ? 0 : 1);
        }
      }),
    );
  });

  it('P5 any text parses without throwing: one row per line, pending unless whole and known', () => {
    const piece = fc.oneof(
      fc.constantFrom('\t', '\n', '-', 'unclassified', 'flake', COLUMNS.join('\t')),
      fc.string({ unit: 'binary', maxLength: 4 }),
    );
    holds(
      fc.property(fc.array(piece, { maxLength: 40 }), (pieces) => {
        const raw = pieces.join('');
        const lines = raw.split('\n').filter((line) => line !== '' && line !== COLUMNS.join('\t'));
        const rows = parseLedger(raw);
        expect(rows).toHaveLength(lines.length);
        rows.forEach((row, at) => {
          const cells = (lines[at] ?? '').split('\t');
          const known = ['-', 'unclassified', ...CLASSES].includes(cells[6] ?? '');
          const whole = cells.length === COLUMNS.length && known;
          expect(row.class).toBe(whole ? cells[6] : 'unclassified');
        });
      }),
    );
  });
});
