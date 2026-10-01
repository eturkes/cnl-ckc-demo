// Every mutant in `tools/mutants.mjs` must find its anchor exactly once: `pnpm mutate` refuses
// the whole table on one stale anchor, after its baseline runs and outside the gate. A refactor
// that moves an anchored line reddens the gate here instead.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MUTANTS, type Mutant } from '../tools/mutants.mjs';

import { ROOT } from './clinical-test-support.js';

/** One refusal per edit whose anchor does not occur exactly once in its file. */
const staleAnchors = (mutants: readonly Mutant[], read: (path: string) => string): string[] =>
  mutants.flatMap(({ label, edits }) =>
    edits
      .map(({ path, old }) => ({ path, count: read(path).split(old).length - 1 }))
      .filter(({ count }) => count !== 1)
      .map(({ path, count }) => `${label}: anchor occurs ${String(count)} times in ${path}`),
  );

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

describe('mutant anchors', () => {
  it('finds every mutant anchor exactly once in the tree', () => {
    expect(MUTANTS.length).toBeGreaterThan(0);
    expect(staleAnchors(MUTANTS, read)).toEqual([]);
  });

  it('refuses a mutant whose anchor the tree no longer holds, by label and path', () => {
    const [first] = MUTANTS;
    const edit = first?.edits[0];
    if (first === undefined || edit === undefined) throw new Error('no mutant to perturb');
    const stale = { ...first, edits: [{ ...edit, old: `${edit.old}\u0000` }] };
    expect(staleAnchors([stale], read)).toEqual([
      `${first.label}: anchor occurs 0 times in ${edit.path}`,
    ]);
  });
});
