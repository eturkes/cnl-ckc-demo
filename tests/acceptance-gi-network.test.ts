import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { BudgetSpec } from '../src/engine/protocol.js';
import { AnswerService } from '../src/questions/service.js';

import { ROOT, sentenceKey, sentences } from './acceptance-gi-bag.js';
import { liveClient } from './acceptance-gi-live.js';
import { SEED } from './support/property.js';

const path = join(ROOT, 'kb/generated/graph/clinical-network.json');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const readAsset = (): Record<string, unknown> => {
  expect(existsSync(path), 'the declared clinical-network asset exists').toBe(true);
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isRecord(value)) throw new Error('network asset must be an object');
  return value;
};
const walk = (value: unknown): unknown[] => [
  value,
  ...(Array.isArray(value)
    ? value.flatMap(walk)
    : isRecord(value)
      ? Object.values(value).flatMap(walk)
      : []),
];
const known = new Set(sentences.map(sentenceKey));
const reference = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const key = value.replace(/:S(?=\d+$)/u, ':');
    return known.has(key) ? key : undefined;
  }
  if (!isRecord(value)) return undefined;
  if (typeof value.document === 'string' && typeof value.sentence === 'number') {
    const key = sentenceKey({ document: value.document, sentence: value.sentence });
    if (known.has(key)) return key;
  }
  const keys = new Set(
    Object.values(value)
      .map(reference)
      .filter((key) => key !== undefined),
  );
  return keys.size === 1 ? [...keys][0] : undefined;
};

// Coverage field names remain open. Locate the sentence-indexed table by its complete domain,
// not by a producer-specific container name; one-to-one membership remains the assertion.
const coverageTables = (asset: unknown): unknown[][] =>
  walk(asset).filter(
    (value): value is unknown[] =>
      Array.isArray(value) &&
      value.length === sentences.length &&
      value.every((row) => reference(row) !== undefined),
  );
let client: ReturnType<typeof liveClient>;
const budget: BudgetSpec = {
  stackBytes: 16_777_216,
  depth: 256,
  inferences: 300_000,
  wallClockMs: 3_000,
  answerCap: 100,
};
beforeAll(async () => {
  client = liveClient();
  expect((await client.boot()).kind).toBe('booted');
}, 30_000);
afterAll(() => client.dispose());

describe('gi acceptance A7 — full export coverage and shared boundaries', () => {
  it('A7.1 emits the declared schema and a nonempty digest envelope', () => {
    const asset = readAsset();
    expect(asset.schemaVersion).toBe(1);
    expect(isRecord(asset.envelope)).toBe(true);
    expect(Object.keys(isRecord(asset.envelope) ? asset.envelope : {}).length).toBeGreaterThan(0);
    const digests = walk(asset.envelope).filter(
      (value): value is string => typeof value === 'string' && /^[a-f0-9]{12,64}$/u.test(value),
    );
    expect(digests.length, 'input, producer and table digests').toBeGreaterThanOrEqual(3);
  });

  it('A7.2 covers every verified-bag sentence exactly once, including grade, examples and records', () => {
    const tables = coverageTables(readAsset());
    expect(tables.length, 'a complete sentence coverage table').toBeGreaterThan(0);
    for (const table of tables) expect(table.map(reference).sort()).toEqual([...known].sort());
    expect(known.size).toBe(sentences.length);
  });

  it('A7.3 limits every occurrence bucket and document kind to the promised vocabularies', () => {
    const rows = walk(readAsset()).filter(isRecord);
    const buckets = rows.filter((row) => Object.hasOwn(row, 'bucket')).map((row) => row.bucket);
    expect(buckets.length).toBeGreaterThan(0);
    expect(new Set(buckets)).not.toContain(undefined);
    for (const bucket of buckets)
      expect(['line', 'loop', 'shared', 'statement', 'example']).toContain(bucket);
    const occurrences = rows.filter((row) => Object.hasOwn(row, 'bucket'));
    expect(occurrences.length, 'typed sentence occurrences').toBeGreaterThan(0);
    for (const row of occurrences)
      expect(['recommendation', 'implementation', 'supporting']).toContain(row.kind);
  });

  it('A7.4 makes boundary conditions equal the same live scope read, including every source sentence', async () => {
    const asset = readAsset();
    const boundaries = asset.boundaries;
    expect(isRecord(boundaries)).toBe(true);
    if (!isRecord(boundaries)) throw new Error('network boundaries missing');
    expect(boundaries.conditions).toHaveLength(8);
    const scope = await (
      new AnswerService(client) as unknown as {
        scope(
          budget: BudgetSpec,
          context: { evaluationDate: null },
        ): Promise<{ kind: string; conditions: unknown[] }>;
      }
    ).scope(budget, { evaluationDate: null });
    expect(scope.kind).toBe('scope');
    expect(scope.conditions).toHaveLength(8);
    expect(boundaries.conditions).toEqual(scope.conditions);
  });

  it('A7.5 retains coverage for every generated sentence selection from the export', () => {
    const tables = coverageTables(readAsset());
    expect(tables.length).toBeGreaterThan(0);
    const covered = new Set((tables[0] ?? []).map(reference));
    fc.assert(
      fc.property(fc.constantFrom(...sentences), (sentence) => {
        expect(covered.has(sentenceKey(sentence))).toBe(true);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
