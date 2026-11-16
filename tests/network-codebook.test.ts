// g3 clinical codebook (`.agent/contracts/g3.md` `Predicates`): the hand-made class of every
// concept, total over the derived concept set, held to its two-coder record and carried by the
// shipped asset.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { classify, networkAsset } from '../tools/kb/network.mjs';
import * as codebook from '../tools/kb/network-codebook.mjs';

import { files, project, root } from './support/network-subject.js';
import { holds } from './support/property.js';

const { CLASSES, CODEBOOK, FILLED } = codebook;
const derived = project().concepts;
const ids = derived.map(({ id }) => id);

/** The rubric's class ids in its table order, read from the contract the coders coded under. */
const rubricClasses = (): string[] => {
  const contract = readFileSync(join(root, '.agent/contracts/g3.md'), 'utf8');
  const table = contract.slice(contract.indexOf('### Classes'), contract.indexOf('### Boundaries'));
  return [...table.matchAll(/^\| ([a-z]+) \| /gmu)]
    .map(([, id]) => id ?? '')
    .filter((id) => id !== 'id' && id !== 'none');
};

const refusal = (book: Record<string, string | null>): string => {
  try {
    classify(derived, { CLASSES, CODEBOOK: book });
    return '';
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
};

describe('g3 codebook', () => {
  it('K1 classify is total and closed over the derived concepts: a dropped entry, a stale entry and an undeclared class each refuse by name', () => {
    expect(refusal({ ...CODEBOOK })).toBe('');
    holds(
      fc.property(
        fc.constantFrom(...ids),
        fc.stringMatching(/^zz-[a-z]{3,12}$/u).filter((id) => !(id in CODEBOOK)),
        fc.stringMatching(/^[a-z]{3,10}$/u).filter((cls) => !CLASSES.includes(cls)),
        (dropped, stale, undeclared) => {
          const without = Object.fromEntries(
            Object.entries(CODEBOOK).filter(([id]) => id !== dropped),
          );
          expect(refusal(without)).toMatch(/concepts without a class entry: 1 \(/u);
          expect(refusal(without)).toContain(dropped);
          expect(refusal({ ...CODEBOOK, [stale]: null })).toContain(
            `entries naming no derived concept: 1 (${stale})`,
          );
          expect(refusal({ ...CODEBOOK, [dropped]: undeclared })).toContain(
            `${dropped} → ${undeclared}`,
          );
        },
      ),
    );
  });

  // `kb:asset-check` holds the shipped bytes equal to `networkAsset`'s, so the producer is the subject.
  it('K2 every asset concept carries its codebook class, null for none, and the legend table names every class in rubric order', () => {
    const written = networkAsset(files, '0'.repeat(64));
    const asset = JSON.parse(Buffer.from(written.bytes).toString('utf8')) as {
      concepts: { id: string; label: string; class: string | null }[];
      classes: { id: string; filled: boolean }[];
    };
    expect(asset.concepts.map(({ id }) => id)).toEqual(ids);
    for (const concept of asset.concepts)
      expect(concept.class, concept.id).toBe(CODEBOOK[concept.id] ?? null);
    expect(asset.classes).toEqual(CLASSES.map((id) => ({ id, filled: FILLED.includes(id) })));
  });

  it('K3 the classes are the rubric table; at most 8 carry their own fill (categorical cap), in legend order', () => {
    expect([...CLASSES]).toEqual(rubricClasses());
    expect(FILLED.length).toBeGreaterThan(0);
    expect(FILLED.length).toBeLessThanOrEqual(8);
    expect([...FILLED]).toEqual(CLASSES.filter((id) => FILLED.includes(id)));
  });

  it('K4 the codebook is its coding record: two coders per concept, the agreed class unless a recorded reason rules another', () => {
    const [header, ...rows] = readFileSync(join(root, '.agent/contracts/g3-coding.tsv'), 'utf8')
      .trimEnd()
      .split('\n');
    expect(header).toBe('id\tconcept\tcoder_a\tcoder_b\tclass\tadjudication');
    const valid = new Set([...CLASSES, 'none']);
    const record = rows.map((line) => line.split('\t'));
    expect(record.map(([, concept]) => concept).sort()).toEqual(Object.keys(CODEBOOK).sort());
    for (const [id = '', concept = '', a = '', b = '', cls = '', why = ''] of record) {
      expect(valid.has(a) && valid.has(b) && valid.has(cls), `${id} ${concept}`).toBe(true);
      expect(cls === 'none' ? null : cls, `${id} ${concept}`).toBe(CODEBOOK[concept]);
      // No reason ⇒ both coders gave the final class; an adjudication or MAIN's cross-slice
      // correction always carries its reason.
      if (why.trim() === '') expect([a, b], `${id} unreasoned`).toEqual([cls, cls]);
    }
  });
});
