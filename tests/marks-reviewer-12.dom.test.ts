import { flushSync, mount, unmount } from 'svelte';
import { expect, it } from 'vitest';

import AnswerPanel from '../src/demo/AnswerPanel.svelte';
import type { AnswerRow } from '../src/demo/describe.js';
import { locale } from '../src/i18n/locale.svelte.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import { answerSolution, documentMarks, marksSolution, sentence } from './support/marks-terms.js';

it('R5 the first statement after a source-set change keeps its available grade', async () => {
  locale.set('en');
  const host = document.body.appendChild(document.createElement('div'));
  const rows: AnswerRow[] = [
    { cells: [], label: '', structured: true, document: 'a', items: ['Shared.', 'A only.'] },
    { cells: [], label: '', structured: true, document: 'b', items: ['Shared.'] },
  ];
  const app = mount(AnswerPanel, {
    target: host,
    props: {
      rows,
      solutions: [answerSolution('a'), answerSolution('b')],
      marks: {
        kind: 'settled',
        id: QUESTION_IDS[0],
        goal: 'clinical_marks(q,Source,Marks)',
        outcome: {
          kind: 'solutions',
          solutions: [marksSolution(documentMarks('a', [sentence(2)], [sentence(3)]))],
        },
      },
      selectedIndex: 0,
      busy: false,
      question: 'Grade-run boundary',
      summary: '',
      serialized: '',
      onSelect: () => {},
    },
  });
  try {
    flushSync();
    expect(host.querySelectorAll('.answer-point')).toHaveLength(2);
    expect(host.querySelectorAll('.marks-missing')).toHaveLength(1);
    const grades = [...host.querySelectorAll('.answer-point')].map((point) =>
      [...point.querySelectorAll('dl.facts > div')]
        .filter((pair) => pair.querySelector('dt')?.textContent === 'Grade')
        .map((pair) => pair.querySelector('dd')?.textContent),
    );
    expect(grades).toEqual([['A grade'], ['A grade']]);
  } finally {
    await unmount(app);
    host.remove();
    locale.set('en');
  }
});
