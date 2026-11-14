import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { EngineClient, QueryOutcome } from '../src/engine/client.js';
import type {
  BudgetSpec,
  PlSolution,
  ProofInput,
  ProofOutcome,
  ProofStep,
} from '../src/engine/protocol.js';
import { QUESTION_CATALOG } from '../src/questions/catalog.js';

import { alpha } from './acceptance-gi-bag.js';
import { liveClient } from './acceptance-gi-live.js';
import { SEED } from './support/property.js';

interface RunContext {
  readonly evaluationDate: string | null;
}
type ContextClient = Omit<EngineClient, 'query' | 'prove'> & {
  query(
    goal: string,
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
    onSolution?: (solution: PlSolution) => void,
    options?: { readonly?: boolean },
  ): Promise<QueryOutcome>;
  prove(
    input: ProofInput,
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
  ): Promise<ProofOutcome>;
};
const budget: BudgetSpec = {
  stackBytes: 16_777_216,
  depth: 256,
  inferences: 300_000,
  wallClockMs: 3_000,
  answerCap: 50,
};
const NONE: RunContext = { evaluationDate: null };
let client: ContextClient;
beforeAll(async () => {
  client = liveClient();
  expect((await client.boot()).kind).toBe('booted');
}, 30_000);
afterAll(() => client.dispose());
const readDate = (context: RunContext): Promise<QueryOutcome> =>
  client.query('guideline_evaluation_date(D)', budget, context);
const expectedDate = (value: string): PlSolution => ({
  bindings: { D: { kind: 'integer', value: Number(value.replaceAll('-', '')) } },
  display: { D: String(Number(value.replaceAll('-', ''))) },
});

const alphaStep = (step: ProofStep): ProofStep => {
  if (step.kind === 'clause')
    return { ...step, head: alpha(step.head), children: step.children.map(alphaStep) };
  if ('head' in step) return { ...step, head: alpha(step.head) };
  return { ...step, goal: alpha(step.goal) };
};
const alphaProof = (proof: ProofOutcome): ProofOutcome =>
  proof.kind === 'proof' ? { ...proof, steps: proof.steps.map(alphaStep) } : proof;

// The same context claim holds at both RPC methods, before malformed goal parsing.
describe('gi acceptance A1 — run context at the public engine API', () => {
  it.each(['2022-12-28', '2022-12-29', '2022-12-30', '2000-02-29', '1900-02-28'])(
    'A1.1 reads real Gregorian date %s natively',
    async (evaluationDate) => {
      expect(await readDate({ evaluationDate })).toEqual({
        kind: 'solutions',
        solutions: [expectedDate(evaluationDate)],
      });
    },
  );

  it('A1.2 propagates generated valid dates and restores the undated default', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({
          min: new Date('0001-01-01T00:00:00Z'),
          max: new Date('9999-12-31T00:00:00Z'),
          noInvalidDate: true,
        }),
        async (date) => {
          const evaluationDate = date.toISOString().slice(0, 10);
          expect(await readDate({ evaluationDate })).toEqual({
            kind: 'solutions',
            solutions: [expectedDate(evaluationDate)],
          });
          expect(await readDate(NONE)).toEqual({ kind: 'failure' });
        },
      ),
      { seed: SEED, numRuns: 32 },
    );
  });

  it.each([
    '',
    '2022-2-03',
    '2022-02-3',
    '2022-02-29',
    '1900-02-29',
    '2022-04-31',
    '2022-13-01',
    '2022-00-01',
    '2022-01-00',
    '2022-01-32',
    '2022-12-29T00:00:00Z',
    ' 2022-12-29',
    '2022-12-29 ',
    'not-a-date',
  ])('A1.3 refuses invalid date %j before parsing at query and proof', async (evaluationDate) => {
    const context = { evaluationDate };
    const expected = { kind: 'error', error: { code: 'context' } };
    expect(await client.query('(', budget, context)).toMatchObject(expected);
    expect(await client.prove({ constrainedGoal: '(' }, budget, context)).toMatchObject(expected);
  });

  it('A1.4 rejects generated impossible February days without running Prolog', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1600, max: 9999 }),
        fc.integer({ min: 30, max: 99 }),
        async (year, day) => {
          const evaluationDate = `${String(year)}-02-${String(day)}`;
          expect(
            await client.query('throw(acceptance_must_not_run)', budget, { evaluationDate }),
          ).toMatchObject({ kind: 'error', error: { code: 'context' } });
        },
      ),
      { seed: SEED, numRuns: 32 },
    );
  });

  it.each([
    undefined,
    null,
    {},
    { evaluationDate: undefined },
    { evaluationDate: 20221228 },
    { evaluationDate: false },
    { evaluationDate: new Date('2022-12-28') },
  ])('A1.3b refuses missing or malformed context %j', async (value) => {
    const context = value as RunContext;
    expect(await client.query('(', budget, context)).toMatchObject({
      kind: 'error',
      error: { code: 'context' },
    });
    expect(await client.prove({ constrainedGoal: '(' }, budget, context)).toMatchObject({
      kind: 'error',
      error: { code: 'context' },
    });
  });

  it('A1.7 restores the undated default after a dated error and a dated capped run', async () => {
    expect(
      await client.query('throw(acceptance_expected)', budget, { evaluationDate: '2022-12-28' }),
    ).toMatchObject({ kind: 'error', error: { code: 'prolog' } });
    expect(await readDate(NONE)).toEqual({ kind: 'failure' });
    expect(
      await client.query(
        'repeat,guideline_evaluation_date(D)',
        { ...budget, answerCap: 2 },
        { evaluationDate: '2022-12-28' },
      ),
    ).toMatchObject({
      kind: 'limit',
      limit: 'answer-cap',
      solutions: [expectedDate('2022-12-28'), expectedDate('2022-12-28')],
    });
    expect(await readDate(NONE)).toEqual({ kind: 'failure' });
  });

  it('A1.8 still refuses model-written context mutation', async () => {
    for (const goal of [
      'assertz(guideline_evaluation_date(20221228))',
      'retractall(guideline_evaluation_date(_))',
      'assertz(clinical_context(a,b,c))',
    ]) {
      expect(
        await client.query(goal, budget, NONE, undefined, undefined, { readonly: true }),
      ).toMatchObject({ kind: 'error', error: { code: 'guard' } });
    }
    expect(await readDate(NONE)).toEqual({ kind: 'failure' });
  });

  it('A1.5 freezes admitted context and refuses an overlapping request by name before parsing', async () => {
    const context = { evaluationDate: '2022-12-28' };
    const seen: PlSolution[] = [];
    let signalFirst: (() => void) | undefined;
    const first = new Promise<void>((resolve) => {
      signalFirst = resolve;
    });
    const cancel = new AbortController();
    const open = client.query(
      'repeat,guideline_evaluation_date(D)',
      { ...budget, answerCap: 1000 },
      context,
      cancel.signal,
      (solution) => {
        seen.push(solution);
        signalFirst?.();
      },
    );
    context.evaluationDate = '2022-12-30';
    try {
      await Promise.race([
        first,
        open.then(() => {
          throw new Error('open request settled before its first streamed answer');
        }),
      ]);
      expect(await client.query('(', budget, NONE)).toMatchObject({
        kind: 'error',
        error: { code: 'busy' },
      });
      expect(await client.prove({ constrainedGoal: '(' }, budget, NONE)).toMatchObject({
        kind: 'error',
        error: { code: 'busy' },
      });
    } finally {
      cancel.abort();
    }
    const result = await open;
    expect(result.kind).toBe('cancelled');
    expect(seen.length).toBeGreaterThan(0);
    for (const solution of seen) expect(solution).toEqual(expectedDate('2022-12-28'));
    expect(await readDate(NONE)).toEqual({ kind: 'failure' });
  });

  it('A1.6 places exactly one dated context record first and keeps undated source lines and proof modulo variable names', async () => {
    const goal = QUESTION_CATALOG['opioid-safety'].goal;
    const solved = await client.query(goal, budget, NONE);
    expect(solved.kind).toBe('solutions');
    if (solved.kind !== 'solutions') throw new Error('undated answer did not derive');
    const selected = solved.solutions[0]?.display;
    if (selected === undefined) throw new Error('undated answer missing first solution');
    const input = { goal, selected };
    const before = await client.prove(input, budget, NONE);
    const dated = await client.prove(input, budget, { evaluationDate: '2022-12-28' });
    expect(dated.kind).toBe('proof');
    if (dated.kind !== 'proof') throw new Error('dated proof did not derive');
    expect(dated.steps[0]).toEqual({ kind: 'context', goal: 'evaluation_date(20221228)' });
    expect(dated.steps.filter((step) => String(step.kind) === 'context')).toHaveLength(1);
    const after = await client.prove(input, budget, NONE);
    expect(before.kind).toBe('proof');
    expect(after.kind).toBe('proof');
    expect(alphaProof(after)).toEqual(alphaProof(before));
    expect(JSON.stringify(after)).not.toContain('"kind":"context"');
  });
});
