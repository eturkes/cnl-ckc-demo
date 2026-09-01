// Diff-blind contract for the ID-only question catalog. The four exported goals
// and questions are read from the verified bag; no expected query text is transcribed.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { BudgetSpec } from '../src/engine/protocol.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import type { EngineClient, QueryOutcome } from '../src/engine/client.js';
import {
  isQuestionId,
  QUESTION_CATALOG,
  QUESTION_IDS,
  type QuestionId,
} from '../src/questions/catalog.js';
import { AnswerService } from '../src/questions/service.js';
import { verifyBag } from '../tools/kb/bag.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IDS = [
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
  'category-b-recommendations',
  'evidence-type-3-recommendation',
] as const satisfies readonly QuestionId[];
const EXPORTED = IDS.slice(0, 4);
const BUDGET: BudgetSpec = { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 1_000 };

const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`expected one vendored bag, found ${archives.length}`);
const files = verifyBag(readFileSync(join(ROOT, 'kb', archives[0] as string))).files;

const member = (suffix: string): string => {
  const matches = [...files.keys()].filter((path) => path.endsWith(suffix));
  if (matches.length !== 1)
    throw new Error(`${suffix}: expected one bag member, found ${matches.length}`);
  return matches[0] as string;
};

const text = (suffix: string): string =>
  Buffer.from(files.get(member(suffix)) as Uint8Array).toString('utf8');

// Extracts only goal/1's balanced argument. This parser is test-owned, independent
// of the generator whose result it checks.
const bagGoal = (id: string): string => {
  const source = text(`/queries/pl/${id}.pl`);
  const marker = "'$guideline_query_projection'(goal(";
  const start = source.indexOf(marker) + marker.length;
  if (start < marker.length) throw new Error(`${id}: projection clause missing`);
  let depth = 1;
  let quoted = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === "'" && source[index + 1] === "'") index += 1;
      else if (character === "'") quoted = false;
    } else if (character === "'") quoted = true;
    else if (character === '(') depth += 1;
    else if (character === ')' && --depth === 0) return source.slice(start, index);
  }
  throw new Error(`${id}: unterminated goal/1`);
};

const bagQuestion = (id: string): string => text(`/queries/${id}.ace`).trim();

const substituteOnce = (source: string, from: string, to: string): string => {
  expect(source.split(from), `${from}: source token count`).toHaveLength(2);
  return source.replace(from, to);
};

const harness = (outcome: QueryOutcome = { kind: 'failure' }) => {
  const query = vi.fn(async (): Promise<QueryOutcome> => outcome);
  const client = { query } as unknown as EngineClient;
  return { query, service: new AnswerService(client) };
};

const rejected = { kind: 'rejected', reason: 'unknown-id' } as const;

describe('question catalog closed surface', () => {
  it('t.ids6 P1.1/P1.4-P1.6 exposes exactly six bag-derived, projected entries', () => {
    expect(QUESTION_IDS).toEqual(IDS);
    expect(new Set(QUESTION_IDS).size).toBe(IDS.length);
    expect(Object.keys(QUESTION_CATALOG).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      expect(isQuestionId(id), id).toBe(true);
      expect(QUESTION_CATALOG[id].id).toBe(id);
      expect(QUESTION_CATALOG[id].goal.length).toBeGreaterThan(0);
      expect(QUESTION_CATALOG[id].question.length).toBeGreaterThan(0);
    }
    expect(isQuestionId('not-a-question')).toBe(false);

    const projections = {
      'category-a-recommendations': [
        { variable: 'A', descriptor: 'noun(recommendation,countable)' },
      ],
      'dosage-reduction-content': [{ variable: 'C', descriptor: 'wh(what)' }],
      'evidence-type-1-recommendation': [
        { variable: 'A', descriptor: 'noun(recommendation,countable)' },
      ],
      'recommendation-exists': [],
      'category-b-recommendations': [
        { variable: 'A', descriptor: 'noun(recommendation,countable)' },
      ],
      'evidence-type-3-recommendation': [
        { variable: 'A', descriptor: 'noun(recommendation,countable)' },
      ],
    } as const;
    for (const id of IDS) expect(QUESTION_CATALOG[id].projection, id).toEqual(projections[id]);

    for (const id of EXPORTED) {
      expect(QUESTION_CATALOG[id].goal, `${id} goal`).toBe(bagGoal(id));
      expect(QUESTION_CATALOG[id].question, `${id} question`).toBe(bagQuestion(id));
      expect(QUESTION_CATALOG[id].provenance, id).toBe('bag-exported');
    }
    expect(QUESTION_CATALOG['category-b-recommendations']).toMatchObject({
      provenance: 'repo-authored',
      goal: substituteOnce(
        bagGoal('category-a-recommendations'),
        "'category-A-recommendation'",
        "'category-B-recommendation'",
      ),
      question: substituteOnce(
        bagQuestion('category-a-recommendations'),
        'category-A-recommendation',
        'category-B-recommendation',
      ),
    });
    expect(QUESTION_CATALOG['evidence-type-3-recommendation']).toMatchObject({
      provenance: 'repo-authored',
      goal: substituteOnce(
        bagGoal('evidence-type-1-recommendation'),
        "'evidence-type-1-recommendation'",
        "'evidence-type-3-recommendation'",
      ),
      question: substituteOnce(
        bagQuestion('evidence-type-1-recommendation'),
        'evidence-type-1-recommendation',
        'evidence-type-3-recommendation',
      ),
    });
  });

  it('t.unknown P1.2 rejects an unknown id without reaching the engine', async () => {
    const { query, service } = harness();
    await expect(service.ask('not-a-question', BUDGET)).resolves.toEqual(rejected);
    expect(query).not.toHaveBeenCalled();
  });

  it('t.freetext P1.3 rejects empty, ACE, and raw-Prolog text identically', async () => {
    const { query, service } = harness();
    for (const input of [
      '',
      '   ',
      bagQuestion('category-a-recommendations'),
      bagGoal('category-a-recommendations'),
    ]) {
      await expect(service.ask(input, BUDGET), JSON.stringify(input)).resolves.toEqual(rejected);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('t.proto P1.1/P1.2 closes prototype keys while accepting a computed valid id', async () => {
    const { query, service } = harness();
    for (const input of ['__proto__', 'constructor']) {
      await expect(service.ask(input, BUDGET), input).resolves.toEqual(rejected);
    }
    const carrier: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    carrier['selected-question'] = IDS[0];
    await expect(service.ask(carrier['selected-question'], BUDGET)).resolves.toEqual({
      kind: 'failure',
      id: IDS[0],
    });
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(QUESTION_CATALOG[IDS[0]].goal, BUDGET);
  });
});
