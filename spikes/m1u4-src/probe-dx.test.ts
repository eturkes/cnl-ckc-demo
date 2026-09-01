import { expect, it } from 'vitest';

import { questionOptions, selectedGoal, selectedQuestion } from './ui-consumer.js';

it('narrows catalog IDs and rejects unsupported strings at the UI boundary', () => {
  expect(questionOptions).toHaveLength(6);
  expect(selectedGoal('category-a-recommendations')).toContain('guideline_entity');
  expect(() => selectedQuestion('free text that must never execute')).toThrow(
    'unsupported question id',
  );
  console.log('SRC_DX\toptions=6\tknown=pass\tfreeText=reject');
});
