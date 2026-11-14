import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { BudgetSpec } from '../src/engine/protocol.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import { AnswerService } from '../src/questions/service.js';

import { scopeConditions, sentenceKey, supersessionRecords } from './acceptance-gi-bag.js';
import { liveClient } from './acceptance-gi-live.js';
import { SEED } from './support/property.js';

interface RunContext {
  readonly evaluationDate: string | null;
}
interface ScopeCondition {
  id: string;
  text: string;
  sources: { document: string; sentence: number }[];
}
interface SupersessionRecord {
  document: string;
  sentence: number;
  citation: string;
  url: string;
  date: string;
}
interface SupersededStatement extends SupersessionRecord {
  text: string;
  derived: boolean;
}
type ErrorOutcome = { kind: 'failure' | 'limit' | 'cancelled' | 'error'; error?: { code: string } };
interface RecordsService {
  scope(
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
  ): Promise<{ kind: 'scope'; goal: string; conditions: ScopeCondition[] } | ErrorOutcome>;
  superseded(
    id: QuestionId,
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
  ): Promise<
    { kind: 'superseded'; goal: string; statements: SupersededStatement[] } | ErrorOutcome
  >;
  supersessions(
    budget: BudgetSpec,
    signal?: AbortSignal,
  ): Promise<{ kind: 'supersessions'; goal: string; records: SupersessionRecord[] } | ErrorOutcome>;
}
const budget: BudgetSpec = {
  stackBytes: 16_777_216,
  depth: 256,
  inferences: 300_000,
  wallClockMs: 3_000,
  answerCap: 100,
};
const dates = [null, '2022-12-28', '2022-12-29', '2022-12-30'] as const;
let client: ReturnType<typeof liveClient>;
let service: RecordsService;
beforeAll(async () => {
  client = liveClient();
  expect((await client.boot()).kind).toBe('booted');
  service = new AnswerService(client);
}, 30_000);
afterAll(() => client.dispose());
const sourceKeys = (sources: { document: string; sentence: number }[]): string[] =>
  sources.map(sentenceKey);
const reading = (value: string): string =>
  value.toLowerCase().replaceAll('-', ' ').replace(/\s+/gu, ' ').trim().replace(/[.]$/u, '');
const expectedRecords = supersessionRecords
  .map(({ text: _text, ...record }) => record)
  .sort((a, b) => sentenceKey(a).localeCompare(sentenceKey(b)));
const sortRecords = <T extends SupersessionRecord>(rows: T[]): T[] =>
  [...rows].sort((a, b) => sentenceKey(a).localeCompare(sentenceKey(b)));
const assertScope = (conditions: ScopeCondition[]): void => {
  expect(conditions).toHaveLength(scopeConditions.length);
  expect(new Set(conditions.map(({ id }) => id)).size).toBe(scopeConditions.length);
  expect(conditions.every(({ id }) => id.trim() !== '')).toBe(true);
  expect(conditions.reduce((sum, condition) => sum + condition.sources.length, 0)).toBe(12);
  for (const expected of scopeConditions) {
    const keys = sourceKeys(expected.sources).sort();
    const actual = conditions.find(
      (condition) => JSON.stringify(sourceKeys(condition.sources)) === JSON.stringify(keys),
    );
    expect(actual, keys.join(',')).toBeDefined();
    if (actual === undefined) throw new Error('exclusion source group is missing');
    // Both the full source sentence and its entire condition span preserve the KB's wording.
    const accepted = expected.sources
      .flatMap(({ text }) => [
        text,
        text
          .replace(/^If /u, '')
          .replace(/ then it is false that a recommendation applies to the patient\.$/u, ''),
      ])
      .map(reading);
    expect(accepted).toContain(reading(actual.text));
    expect(actual.text).not.toMatch(
      /(?:otherwise|all other|everyone else|in every other case).*appl/iu,
    );
  }
};

describe('gi acceptance A2 — live scope records', () => {
  it('A2.1 returns all eight body-distinct conditions and all twelve source sentences without merging distinct guards', async () => {
    const result = await service.scope(budget, { evaluationDate: null });
    expect(result.kind).toBe('scope');
    if (result.kind !== 'scope') throw new Error('scope read did not settle with records');
    expect(result.goal.trim()).not.toBe('');
    assertScope(result.conditions);
  });

  it('A2.2 keeps condition ids, full condition text and source membership invariant under generated evaluation dates', async () => {
    const baseline = await service.scope(budget, { evaluationDate: null });
    if (baseline.kind !== 'scope') throw new Error('scope read did not settle with records');
    const canonical = (rows: ScopeCondition[]): ScopeCondition[] =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));
    await fc.assert(
      fc.asyncProperty(
        fc.date({
          min: new Date('0001-01-01T00:00:00Z'),
          max: new Date('9999-12-31T00:00:00Z'),
          noInvalidDate: true,
        }),
        async (date) => {
          const result = await service.scope(budget, {
            evaluationDate: date.toISOString().slice(0, 10),
          });
          expect(result.kind).toBe('scope');
          if (result.kind !== 'scope')
            throw new Error('dated scope read did not settle with records');
          expect(canonical(result.conditions)).toEqual(canonical(baseline.conditions));
          assertScope(result.conditions);
        },
      ),
      { seed: SEED, numRuns: 16 },
    );
  });

  it('A2.3 refuses an invalid evaluation date instead of reporting no exclusions', async () => {
    expect(await service.scope(budget, { evaluationDate: '2022-02-29' })).toMatchObject({
      kind: 'error',
      error: { code: 'context' },
    });
  });
});

describe('gi acceptance A3 — family supersession records and genuine dated derivation', () => {
  it.each(dates)(
    'A3.1 returns each family statement with its bag-owned law, URL, date and derivability at %s',
    async (evaluationDate) => {
      const result = await service.superseded('opioid-use-disorder-treatment', budget, {
        evaluationDate,
      });
      expect(result.kind).toBe('superseded');
      if (result.kind !== 'superseded') throw new Error('family read did not settle with records');
      expect(result.goal.trim()).not.toBe('');
      expect(sortRecords(result.statements)).toEqual(
        sortRecords(
          supersessionRecords.map((record) => ({
            ...record,
            derived: evaluationDate !== null && evaluationDate < record.date,
          })),
        ),
      );
    },
  );

  it.each(QUESTION_IDS.filter((id) => id !== 'opioid-use-disorder-treatment'))(
    'A3.2 keeps unrelated family %s empty',
    async (id) => {
      for (const evaluationDate of dates) {
        const result = await service.superseded(id, budget, { evaluationDate });
        expect(result.kind).toBe('superseded');
        if (result.kind !== 'superseded')
          throw new Error('family read did not settle with records');
        expect(result.statements).toEqual([]);
      }
    },
  );

  it('A3.3 changes derivation at exactly the supersession boundary over generated before/on/after dates', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -3660, max: 3660 }), async (offset) => {
        const date = new Date('2022-12-29T00:00:00Z');
        date.setUTCDate(date.getUTCDate() + offset);
        const evaluationDate = date.toISOString().slice(0, 10);
        const result = await service.superseded('opioid-use-disorder-treatment', budget, {
          evaluationDate,
        });
        expect(result.kind).toBe('superseded');
        if (result.kind !== 'superseded')
          throw new Error('dated family read did not settle with records');
        expect(result.statements).toHaveLength(3);
        expect(result.statements.map(({ derived }) => derived)).toEqual([
          offset < 0,
          offset < 0,
          offset < 0,
        ]);
      }),
      { seed: SEED, numRuns: 24 },
    );
  });

  it('A3.4 returns all fixed supersession records unchanged before, on, after and without a date', async () => {
    const first = await service.supersessions(budget);
    expect(first.kind).toBe('supersessions');
    if (first.kind !== 'supersessions')
      throw new Error('supersession read did not settle with records');
    expect(first.goal.trim()).not.toBe('');
    expect(sortRecords(first.records)).toEqual(expectedRecords);
    for (const evaluationDate of dates) {
      await service.superseded('opioid-use-disorder-treatment', budget, { evaluationDate });
      const result = await service.supersessions(budget);
      expect(result).toEqual(first);
    }
  });

  it('A3.5 refuses invalid context without misreporting superseded statements as underived', async () => {
    expect(
      await service.superseded('opioid-use-disorder-treatment', budget, {
        evaluationDate: '2022-04-31',
      }),
    ).toMatchObject({ kind: 'error', error: { code: 'context' } });
  });
});
