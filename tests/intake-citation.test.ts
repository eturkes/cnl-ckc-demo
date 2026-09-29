import { expect, it } from 'vitest';

import type { PlTerm } from '../src/engine/terms.js';
import { IntakeService } from '../src/intake/service.js';

import { referenceVocabulary, ruleRecords } from './intake-backend-support.js';

const vocabulary = referenceVocabulary();
const first = vocabulary.rules[0];
const record = ruleRecords[0];
if (first === undefined || record === undefined) throw new Error('missing reference rule');
const atom = (value: string): PlTerm => ({ kind: 'atom', value });
const integer = (value: number): PlTerm => ({ kind: 'integer', value });
const compound = (functor: string, ...args: PlTerm[]): PlTerm => ({
  kind: 'compound',
  functor,
  args,
});

it('D2 refuses a Proof whose citation is line/2 rather than line/1', async () => {
  const proof: PlTerm = {
    kind: 'list',
    items: [
      compound('node', compound('line', integer(7), integer(8)), atom('head'), {
        kind: 'list',
        items: [],
      }),
    ],
  };
  const service = new IntakeService(
    {
      query: () =>
        Promise.resolve({
          kind: 'solutions',
          solutions: [{ bindings: { Rule: record.rule, Proof: proof }, display: {} }],
        }),
    },
    vocabulary,
  );
  const result = await service.derive([first.id]);
  expect(result).toMatchObject({
    kind: 'derived',
    rules: [{ ruleId: first.id, status: 'error', error: { code: 'decode' } }],
  });
  if (result.kind !== 'derived') throw new Error('valid id rejected');
  expect(result.rules[0]).not.toHaveProperty('text');
});
