// P4 witness: gold strings grade every occurrence, not only description.indexOf(text).
import { describe, expect, it } from 'vitest';

import { buildRequest, type PainOption } from '../src/intake/request.js';
import { INTAKE_VOCABULARY } from '../src/intake/vocabulary.js';

import { deriveReport, requestDigest, type GoldCase } from './intake-report.js';

const reportFor = async (description: string, scores: number[], pain: PainOption = 'unstated') => {
  const vocabulary = INTAKE_VOCABULARY;
  const built = buildRequest(vocabulary, description);
  expect(built.candidates).toHaveLength(scores.length);
  let candidate = 0;
  const answers = Object.fromEntries(
    Object.entries(built.request.questions).map(([id, question]) => [
      id,
      question.type === 'choice'
        ? {
            type: 'choice',
            choice: pain,
            probabilities: Object.fromEntries(
              Object.keys(question.criteria).map((option) => [option, Number(option === pain)]),
            ),
          }
        : { type: 'noul', noul: id.startsWith('t') ? scores[candidate++] : 0 },
    ]),
  );
  const gold: GoldCase = {
    id: 'repeated-gap',
    description,
    outcome: 'no-match',
    pain: 'unstated',
    ruleIds: [],
    gapSpans: ['migraine'],
  };
  return deriveReport({
    vocabulary,
    gold: [gold],
    replay: {
      schemaVersion: 1,
      model: built.request.model,
      vocabulary: vocabulary.digest,
      cases: [
        {
          id: gold.id,
          baseline: {
            request: requestDigest(built.request),
            response: { model: built.request.model, answers },
          },
        },
      ],
    },
    derive: () => {
      throw new Error('all rule triggers are zero, so this case never needs an engine');
    },
  });
};

const discardedFirst = `migraine${'x'.repeat(81)}; migraine`;

describe('P4 repeated gold span occurrences', () => {
  it('positive control: a single shown occurrence is found', async () => {
    const report = await reportFor('migraine', [0.5]);
    expect(report.cases[0]?.spans).toEqual([{ text: 'migraine', verdict: 'found' }]);
  });

  it('overflow control: an unjudged seventeenth candidate stays in the denominator', async () => {
    const description = [...Array.from({ length: 16 }, (_, index) => `alpha${index}`), 'migraine'];
    const report = await reportFor(description.join('; '), Array<number>(16).fill(0.5));
    expect(report.cases[0]?.baseline.overflow).toBe(1);
    expect(report.cases[0]?.spans).toEqual([{ text: 'migraine', verdict: 'discovery' }]);
    expect(report.summary.spans).toEqual({
      n: 1,
      found: 0,
      discovery: 1,
      judgment: 0,
      suppressed: 0,
    });
  });

  it.each([
    {
      label: 'later shown occurrence overrides an earlier judgment miss',
      description: 'migraine mentioned; migraine persists',
      scores: [0.49, 0.5],
      verdict: 'found',
    },
    {
      label: 'later shown occurrence overrides an earlier discovery miss',
      description: discardedFirst,
      scores: [0.5],
      verdict: 'found',
    },
    {
      label: 'later low candidate is a judgment miss, not a discovery miss',
      description: discardedFirst,
      scores: [0.49],
      verdict: 'judgment',
    },
    {
      label: 'later high candidate suppressed by the hatch stays suppressed',
      description: 'migraine mentioned; migraine persists',
      scores: [0.49, 0.5],
      pain: 'other' as const,
      verdict: 'suppressed',
    },
  ])('$label', async ({ description, scores, pain, verdict }) => {
    const report = await reportFor(description, scores, pain);
    expect(report.cases[0]?.spans).toEqual([{ text: 'migraine', verdict }]);
    expect(report.summary.spans.n).toBe(1);
  });
});
