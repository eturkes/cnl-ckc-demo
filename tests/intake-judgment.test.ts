import { describe, expect, it } from 'vitest';

import { JudgmentError, parseJudgment } from '../src/intake/judgment.js';
import { buildRequest } from '../src/intake/request.js';
import { PAINS, response, vocabulary, type RawResponse } from './intake-oracle/fixtures.js';

const request = () => buildRequest(vocabulary(), 'insomnia and 2.5 mg');
const probabilities = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  acute: 0,
  subacute: 0,
  chronic: 0,
  unstated: 1,
  other: 0,
  ...overrides,
});
const choice = (fields: Record<string, unknown> = {}) => ({
  type: 'choice',
  choice: 'unstated',
  probabilities: probabilities(),
  ...fields,
});
function refused(raw: unknown, question?: string, field = question): void {
  try {
    parseJudgment(raw, request());
    throw new Error('parser accepted the planted violation');
  } catch (error) {
    expect(error).toBeInstanceOf(JudgmentError);
    expect((error as JudgmentError).question).toBe(question);
    if (field !== undefined) expect((error as Error).message).toContain(field);
  }
}

const invalid: readonly [string, string, (raw: RawResponse) => void][] = [
  [
    'missing condition',
    'c01',
    (raw) => {
      delete raw.answers.c01;
    },
  ],
  [
    'missing section',
    's1',
    (raw) => {
      delete raw.answers.s1;
    },
  ],
  [
    'missing term',
    't01',
    (raw) => {
      delete raw.answers.t01;
    },
  ],
  [
    'missing choice',
    'pain',
    (raw) => {
      delete raw.answers.pain;
    },
  ],
  [
    'unexpected answer',
    'extra',
    (raw) => {
      raw.answers.extra = { type: 'noul', noul: 0 };
    },
  ],
  [
    'condition wrong type',
    'c01',
    (raw) => {
      raw.answers.c01 = choice();
    },
  ],
  [
    'section wrong type',
    's1',
    (raw) => {
      raw.answers.s1 = choice();
    },
  ],
  [
    'term wrong type',
    't01',
    (raw) => {
      raw.answers.t01 = choice();
    },
  ],
  [
    'choice wrong type',
    'pain',
    (raw) => {
      raw.answers.pain = { type: 'noul', noul: 1 };
    },
  ],
  [
    'missing type',
    'c01',
    (raw) => {
      raw.answers.c01 = { noul: 0.5 };
    },
  ],
  [
    'wrong type casing',
    'c01',
    (raw) => {
      raw.answers.c01 = { type: 'Noul', noul: 0.5 };
    },
  ],
  [
    'missing Noul value',
    'c01',
    (raw) => {
      raw.answers.c01 = { type: 'noul' };
    },
  ],
  [
    'missing probabilities',
    'pain',
    (raw) => {
      raw.answers.pain = { type: 'choice', choice: 'unstated' };
    },
  ],
  [
    'missing probability key',
    'pain',
    (raw) => {
      const values = probabilities();
      delete values.acute;
      raw.answers.pain = choice({ probabilities: values });
    },
  ],
  [
    'extra probability key',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ probabilities: probabilities({ extra: 0 }) });
    },
  ],
  [
    'non-object probabilities',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ probabilities: null });
    },
  ],
  [
    'array probabilities',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ probabilities: [0, 0, 0, 1, 0] });
    },
  ],
  [
    'missing choice value',
    'pain',
    (raw) => {
      raw.answers.pain = { type: 'choice', probabilities: probabilities() };
    },
  ],
  [
    'choice outside options',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ choice: 'invented' });
    },
  ],
  [
    'choice wrong scalar',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ choice: 1 });
    },
  ],
  [
    'choice not maximal',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ choice: 'acute' });
    },
  ],
  [
    'sum above tolerance',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ probabilities: probabilities({ acute: 0.000002 }) });
    },
  ],
  [
    'sum below tolerance',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ probabilities: probabilities({ unstated: 0.999998 }) });
    },
  ],
  [
    'zero probability sum',
    'pain',
    (raw) => {
      raw.answers.pain = choice({ probabilities: probabilities({ unstated: 0 }) });
    },
  ],
];

const invalidNumbers: readonly unknown[] = [
  -Number.EPSILON,
  1 + Number.EPSILON,
  NaN,
  Infinity,
  -Infinity,
  '0.5',
  null,
  undefined,
  true,
  {},
  [],
];

describe('J1 request-relative response parser', () => {
  it('refuses legacy value-only Noul answers in every Noul family', () => {
    for (const id of ['c01', 's1', 't01']) {
      const raw = response(request());
      raw.answers[id] = { type: 'noul', value: 0.5 };
      refused(raw, id);
    }
  });

  it('assembles condition, section and candidate records in request order with overflow', () => {
    const built = buildRequest(
      vocabulary(),
      Array.from({ length: 18 }, (_, i) => `term${String(i)}`).join(','),
    );
    const raw = response(built, 'chronic');
    raw.answers.c01 = { type: 'noul', noul: 0.5 };
    raw.answers.s2 = { type: 'noul', noul: 1 };
    raw.answers.t01 = { type: 'noul', noul: 0.75 };
    raw.terms = [{ text: 'not user text', start: 500, end: 900, value: 1 }];
    raw.usage = 'ignored';
    raw.extra = { arbitrary: true };
    const actual = parseJudgment(raw, built);
    expect(actual).toEqual({
      model: built.request.model,
      conditions: Object.fromEntries(
        vocabulary().conditions.map(({ id }) => [id, id === 'c01' ? 0.5 : 0]),
      ),
      sections: { s1: 0, s2: 1, s3: 0, s4: 0 },
      pain: {
        choice: 'chronic',
        probabilities: Object.fromEntries(
          PAINS.map((option) => [option, option === 'chronic' ? 1 : 0]),
        ),
      },
      terms: built.candidates.map((candidate, index) => ({
        ...candidate,
        value: index === 0 ? 0.75 : 0,
      })),
      overflow: 2,
    });
    expect(
      parseJudgment(
        { ...raw, answers: Object.fromEntries(Object.entries(raw.answers).reverse()) },
        built,
      ),
    ).toEqual(actual);
  });

  it.each([0, -0, Number.MIN_VALUE, 0.5, 1])('accepts finite Noul value %s', (value) => {
    const built = request();
    const raw = response(built);
    raw.answers.c01 = { type: 'noul', noul: value };
    expect(parseJudgment(raw, built).conditions.c01).toBe(value);
  });

  it.each([null, undefined, [], true, 'body', 42])('refuses malformed envelope %j', (raw) =>
    refused(raw),
  );

  it.each([undefined, null, [], true, 'answers'])('refuses malformed answers %j', (answers) => {
    refused({ model: 'jev-1.13.0', answers }, undefined, 'answers');
  });

  it.each([undefined, null, 42, '', 'jev-1.12.0'])('refuses mismatched model %j', (model) => {
    refused({ ...response(request()), model }, undefined, 'model');
  });

  it.each(invalid)('refuses %s and names %s', (_, id, corrupt) => {
    const raw = response(request());
    corrupt(raw);
    refused(raw, id);
  });

  it.each([null, undefined, [], 'answer', 0, false])(
    'refuses non-object answer %j by question id',
    (answer) => {
      const raw = response(request());
      raw.answers.c01 = answer;
      refused(raw, 'c01');
    },
  );

  it.each(invalidNumbers)('refuses invalid Noul scalar %j in all Noul families', (value) => {
    for (const id of ['c01', 's1', 't01']) {
      const raw = response(request());
      raw.answers[id] = { type: 'noul', noul: value };
      refused(raw, id);
    }
  });

  it.each(invalidNumbers)('refuses invalid Choice probability %j', (value) => {
    const raw = response(request());
    raw.answers.pain = choice({ probabilities: probabilities({ acute: value }) });
    refused(raw, 'pain');
  });

  it.each(invalidNumbers)('refuses invalid optional confidence %j', (confidence) => {
    const raw = response(request());
    raw.answers.pain = choice({ confidence });
    refused(raw, 'pain');
  });

  it.each([0, 0.5, 1])('accepts optional confidence %s', (confidence) => {
    const built = request();
    const raw = response(built);
    raw.answers.pain = choice({ confidence });
    expect(parseJudgment(raw, built).pain.choice).toBe('unstated');
  });

  it.each([0.9999995, 1, 1.0000005])('accepts probability sum %s within the tolerance', (sum) => {
    const built = request();
    const raw = response(built);
    raw.answers.pain = choice({
      choice: sum >= 1 ? 'subacute' : 'acute',
      probabilities: probabilities({ acute: 0.5, subacute: sum - 0.5, unstated: 0 }),
    });
    expect(parseJudgment(raw, built).pain.choice).toBe(sum >= 1 ? 'subacute' : 'acute');
  });

  it.each(PAINS)('admits %s in a maximal tie', (pain) => {
    const built = request();
    const raw = response(built, pain);
    raw.answers.pain = choice({
      choice: pain,
      probabilities: Object.fromEntries(PAINS.map((option) => [option, 0.2])),
    });
    expect(parseJudgment(raw, built).pain.choice).toBe(pain);
  });

  it('takes its model, answer ids and Choice option set from the actual request', () => {
    const built = request();
    built.request.model = 'request-owned-model';
    delete built.request.questions.c24;
    const pain = built.request.questions.pain;
    if (pain?.type !== 'choice') throw new Error('missing pain choice');
    pain.criteria = { chronic: 'chronic', unstated: 'unstated' };
    const raw = response(built, 'chronic');
    expect(parseJudgment(raw, built)).toMatchObject({
      model: 'request-owned-model',
      pain: { choice: 'chronic', probabilities: { chronic: 1, unstated: 0 } },
    });
    expect(parseJudgment(raw, built).conditions).not.toHaveProperty('c24');
  });

  it('accepts a forced request without other and rejects a baseline response for it', () => {
    const built = buildRequest(vocabulary(), 'pain', { hatch: false });
    const raw = response(built, 'acute');
    expect(parseJudgment(raw, built).pain.probabilities).not.toHaveProperty('other');
    const baseline = response(buildRequest(vocabulary(), 'pain'), 'acute');
    expect(() => parseJudgment(baseline, built)).toThrow(/pain/u);
    raw.answers.pain = {
      type: 'choice',
      choice: 'other',
      probabilities: { acute: 1, subacute: 0, chronic: 0, unstated: 0 },
    };
    expect(() => parseJudgment(raw, built)).toThrow(/pain/u);
  });
});
