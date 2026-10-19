// Review witnesses for what the missing-marks notice claims, not the approved join behaviour.
import { flushSync, mount, unmount } from 'svelte';
import { expect, it } from 'vitest';

import AnswerPanel from '../src/demo/AnswerPanel.svelte';
import type { AnswerRow } from '../src/demo/describe.js';
import { locale } from '../src/i18n/locale.svelte.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import type { DocumentMarks, MarksState } from '../src/questions/marks.js';
import { answerSolution, marksSolution } from './support/marks-terms.js';

const id = QUESTION_IDS[0];
const document: DocumentMarks = {
  document: 'source-a',
  grades: [{ dimension: 'strength', value: 'strong', label: 'source-grade' }],
  groups: [
    [
      {
        sentence: 2,
        qualifiers: [{ kind: 'manner', word: 'carefully' }],
        preferences: [],
        times: [],
      },
    ],
  ],
};
const row = (name: string): AnswerRow => ({
  document: name,
  structured: true,
  cells: [],
  label: 'Same statement.',
  items: ['Same statement.'],
});

it.each([
  ['en', 'returned no annotations'],
  ['ja', '注記を返しませんでした'],
] as const)(
  'CS2 %s notice must not claim no returned annotations when valid marks returned twice',
  async (language, claim) => {
    locale.set(language);
    const host = documentBody();
    const solution = marksSolution(document);
    const marks: MarksState = {
      kind: 'settled',
      id,
      goal: `clinical_marks('${id}',Source,Marks)`,
      outcome: { kind: 'solutions', solutions: [solution, solution] },
    };
    const app = mount(AnswerPanel, {
      target: host,
      props: {
        rows: [row(document.document)],
        solutions: [answerSolution(document.document)],
        marks,
        selectedIndex: 0,
        busy: false,
        question: id,
        summary: '',
        serialized: '',
        onSelect: () => {},
      },
    });
    try {
      flushSync();
      expect(host.querySelectorAll('.mark-goals li')).toHaveLength(2);
      expect(host.querySelectorAll('.marks-missing')).toHaveLength(1);
      expect(host.querySelector('.marks-missing')?.textContent).not.toContain(claim);
    } finally {
      await unmount(app);
      host.remove();
      locale.set('en');
    }
  },
);

it.each([
  ['en', 'Statements from those documents show no annotations.'],
  ['ja', 'これらの文書の記述には注記を表示していません。'],
] as const)(
  'CS2 %s notice must not claim an annotated shared statement shows no annotations',
  async (language, claim) => {
    locale.set(language);
    const host = documentBody();
    const marks: MarksState = {
      kind: 'settled',
      id,
      goal: `clinical_marks('${id}',Source,Marks)`,
      outcome: { kind: 'solutions', solutions: [marksSolution(document)] },
    };
    const app = mount(AnswerPanel, {
      target: host,
      props: {
        rows: [row(document.document), row('source-b')],
        solutions: [answerSolution(document.document), answerSolution('source-b')],
        marks,
        selectedIndex: 0,
        busy: false,
        question: id,
        summary: '',
        serialized: '',
        onSelect: () => {},
      },
    });
    try {
      flushSync();
      expect(host.querySelectorAll('.answer-point')).toHaveLength(1);
      expect(host.querySelectorAll('.citations button')).toHaveLength(2);
      expect(host.querySelector('.facts')?.textContent).toContain('carefully');
      expect(host.querySelectorAll('.marks-missing')).toHaveLength(1);
      expect(host.querySelector('.marks-missing')?.textContent).not.toContain(claim);
    } finally {
      await unmount(app);
      host.remove();
      locale.set('en');
    }
  },
);

function documentBody(): HTMLElement {
  return globalThis.document.body.appendChild(globalThis.document.createElement('div'));
}
