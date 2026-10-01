// The answer service is id-only: free text, prototype keys, case and punctuation variants and
// goal-shaped strings all reject before any engine call. `questions-live` grades the id guard;
// these grade the service boundary itself.

import { describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec } from '../src/engine/protocol.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { AnswerService } from '../src/questions/service.js';

const BUDGET: BudgetSpec = { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 1_000 };
const ID = QUESTION_IDS[0];
const ENTRY = QUESTION_CATALOG[ID];
const rejected = { kind: 'rejected', reason: 'unknown-id' } as const;

const harness = () => {
  const query = vi.fn<EngineClient['query']>().mockResolvedValue({ kind: 'failure' });
  return { query, service: new AnswerService({ query } as unknown as EngineClient) };
};

describe('M1.u4 question catalog service port', () => {
  it('t.freetext P1.3 rejects empty, ACE, and raw-Prolog text identically', async () => {
    const { query, service } = harness();
    // The displayed clinical question and compiled clinical goal replace the retired exports.
    for (const input of ['', '   ', ENTRY.question, ENTRY.goal]) {
      await expect(service.ask(input, BUDGET), input).resolves.toEqual(rejected);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('t.proto P1.1/P1.2 closes prototype keys while accepting a computed valid id', async () => {
    const { query, service } = harness();
    for (const input of ['__proto__', 'constructor']) {
      await expect(service.ask(input, BUDGET), input).resolves.toEqual(rejected);
    }
    expect(query).not.toHaveBeenCalled();

    const carrier: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    carrier['selected-question'] = ID;
    await expect(service.ask(carrier['selected-question'], BUDGET)).resolves.toEqual({
      kind: 'failure',
      id: ID,
      serialized: 'solutions([])',
    });
    expect(query).toHaveBeenCalledOnce();
    const [goal, budget] = query.mock.calls[0] ?? [];
    expect(goal).toBe(ENTRY.goal);
    expect(budget).toEqual(BUDGET);
  });

  it('t.case P1.1/P1.3 rejects case folds and punctuation variants', async () => {
    const { query, service } = harness();
    const uppercase = ID.toUpperCase();
    const titleCase = ID.replace(/(^|-)[a-z]/gu, (part) => part.toUpperCase());
    expect(uppercase).not.toBe(ID);
    expect(titleCase).not.toBe(ID);
    for (const input of [uppercase, titleCase, `${ID}.`, ` ${ID}`]) {
      await expect(service.ask(input, BUDGET), input).resolves.toEqual(rejected);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('t.goalstr P1.3/P1.4 never compiles strings that resemble goals or catalog ids', async () => {
    const { query, service } = harness();
    for (const input of [
      `goal(${ENTRY.goal})`,
      `${ID}(X).`,
      "'$guideline_query_projection'(goal(true),answers([])).",
    ]) {
      await expect(service.ask(input, BUDGET), input).resolves.toEqual(rejected);
    }
    expect(query).not.toHaveBeenCalled();
  });
});
