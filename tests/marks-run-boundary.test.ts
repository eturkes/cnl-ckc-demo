// ann-review R2/R5 (`.agent/contracts/ann-review.md`): a document whose marks did not return still
// ends its grade run, so the next run's first statement keeps its grade.
import { expect, it } from 'vitest';

import { synthesizeAnswer, type AnswerRow } from '../src/demo/describe.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import { marksView, type MarksState } from '../src/questions/marks.js';
import { answerSolution, documentMarks, marksSolution, sentence } from './support/marks-terms.js';

it('R2 grade runs follow answer-source boundaries even when one source has no marks', () => {
  const rows: AnswerRow[] = [
    { cells: [], label: '', structured: true, document: 'a', items: ['Shared.', 'A only.'] },
    { cells: [], label: '', structured: true, document: 'b', items: ['Shared.'] },
  ];
  const points = synthesizeAnswer(rows);
  const answers = [answerSolution('a'), answerSolution('b')];
  const a = marksSolution(documentMarks('a', [sentence(2)], [sentence(3)]));
  const b = marksSolution(documentMarks('b', [sentence(2)]));
  const complete: MarksState = {
    kind: 'settled',
    id: QUESTION_IDS[0],
    goal: 'clinical_marks(q,Source,Marks)',
    outcome: { kind: 'solutions', solutions: [a, b] },
  };
  const partial: MarksState = {
    ...complete,
    outcome: { kind: 'solutions', solutions: [a] },
  };
  expect(points.map(({ sources }) => sources)).toEqual([[0, 1], [0]]);
  expect(marksView(complete, points, rows, answers).statements.map((mark) => mark?.grade)).toEqual([
    'A grade; B grade',
    'A grade',
  ]);
  const view = marksView(partial, points, rows, answers);
  expect(view).toMatchObject({ missing: 1, total: 2, notice: true });
  expect(view.statements.map((mark) => mark?.grade)).toEqual(['A grade', 'A grade']);
});
