// ann-u3 U2–U6: contract-shaped props; no answer fixture and no component implementation read.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AnswerPanel from '../src/demo/AnswerPanel.svelte';
import { synthesizeAnswer, type AnswerPoint, type AnswerRow } from '../src/demo/describe.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { EN } from '../src/i18n/en.js';
import { JA } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import {
  marksView,
  type DocumentMarks,
  type MarksState,
  type StatementMarks,
} from '../src/questions/marks.js';
import type { MarksOutcome } from '../src/questions/service.js';
import { answerSolution, atom, marksSolution } from './support/marks-terms.js';

const id = QUESTION_IDS[0];
const marker = `panel${String(process.pid)}`;
const goal = `clinical_marks('${id}',Source,Marks)`;
const settled = (outcome: MarksOutcome): MarksState => ({ kind: 'settled', id, goal, outcome });
const stateFor = (...solutions: PlSolution[]): MarksState =>
  settled({ kind: 'solutions', solutions });
const labels = ['Qualifier', 'Grade', 'Preferred', 'Time'];
type Pair = [label: string, value: string];
const pairs = (value: StatementMarks | undefined): Pair[] => {
  if (value === undefined) return [];
  return [
    ['Qualifier', value.qualifier],
    ['Grade', value.grade],
    ['Preferred', value.preferences.join('; ')],
    ['Time', value.times.join('; ')],
  ].filter((pair): pair is Pair => pair[1] !== '');
};
const planted = (document: string, seed = 1): DocumentMarks => ({
  document,
  grades: [
    { dimension: 'evidence', value: 'low', label: `${marker}-evidence_${String(seed)}` },
    { dimension: 'strength', value: 'strong', label: `${marker}-category_${String(seed)}` },
  ],
  groups: [
    [
      {
        sentence: 2,
        qualifiers: [
          { kind: 'manner', word: `${marker}-carefully_${String(seed)}` },
          { kind: 'usuality', word: `${marker}_carefully-${String(seed)}` },
          { kind: 'focus', word: `${marker}-especially_${String(seed)}` },
        ],
        preferences: [
          { preferred: `${marker}-preferred_${String(seed)}`, alternative: null },
          {
            preferred: `${marker}-chosen_${String(seed)}`,
            alternative: `${marker}_other-${String(seed)}`,
          },
        ],
        times: [
          {
            kind: 'interval',
            role: 'within',
            comparison: 'leq',
            count: seed,
            unit: 'week',
            anchor: `${marker}-start_${String(seed)}`,
          },
          { kind: 'order', relation: 'before', anchor: `${marker}_review-${String(seed)}` },
        ],
      },
    ],
  ],
});
interface Input {
  rows: AnswerRow[];
  points: AnswerPoint[];
  solutions: PlSolution[];
  marks: MarksState;
  busy: boolean;
}
const inputFor = (...documents: DocumentMarks[]): Input => {
  const rows = documents.map(({ document, groups }): AnswerRow => ({
    document,
    structured: true,
    cells: [],
    label: `${document} answer`,
    items: groups.map((_, index) => `${document} statement ${String(index + 1)}.`),
  }));
  return {
    rows,
    points: synthesizeAnswer(rows),
    solutions: documents.map(({ document }) => answerSolution(document)),
    marks: stateFor(...documents.map((document) => marksSolution(document))),
    busy: false,
  };
};
let host: HTMLElement;
let app: Record<string, unknown> | undefined;
const teardown = (): void => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  host.replaceChildren();
};
const render = (input: Input): void => {
  teardown();
  app = mount(AnswerPanel, {
    target: host,
    props: {
      ...input,
      selectedIndex: 0,
      question: `${marker} question`,
      summary: `${marker} answer`,
      serialized: `${marker} canonical answer`,
      onSelect: () => {},
    },
  });
  flushSync();
};
const facts = (): Pair[][] =>
  [...host.querySelectorAll('.answer-point')].map((point) =>
    [...point.querySelectorAll('dl.facts > div')].map((pair): Pair => [
      pair.querySelector('dt')?.textContent ?? '',
      pair.querySelector('dd')?.textContent ?? '',
    ]),
  );
const expectedFacts = (input: Input): Pair[][] =>
  marksView(input.marks, input.points, input.rows, input.solutions).statements.map(pairs);
const missingText = (missing: number, total: number, language: 'en' | 'ja' = 'en'): string => {
  const text = (language === 'en' ? EN.TEXT : JA.TEXT) as typeof EN.TEXT & {
    marksMissing(missing: number, total: number): string;
  };
  expect(typeof text.marksMissing).toBe('function');
  return text.marksMissing(missing, total);
};
const expectMissing = (missing: number, total: number): void => {
  const notices = host.querySelectorAll('p.marks-missing');
  expect(notices).toHaveLength(1);
  expect(notices[0]?.textContent).toBe(missingText(missing, total));
};
const incomplete = (): Input =>
  inputFor(planted(`${marker}-a`), planted(`${marker}-b`), planted(`${marker}-c`));

beforeEach(() => {
  locale.set('en');
  localStorage.clear();
  host = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
  teardown();
  host.remove();
  locale.set('en');
  localStorage.clear();
});

describe('answer statement facts', () => {
  it('U2 renders PID-unique values verbatim in Qualifier, Grade, Preferred, Time pairs', () => {
    const input = inputFor(planted(`${marker}-all`));
    render(input);
    const expected = expectedFacts(input);
    expect(expected[0]?.map(([label]) => label)).toEqual(labels);
    expect(expected[0]?.every(([, value]) => value.toLowerCase().includes(marker))).toBe(true);
    expect(facts()).toEqual(expected);
    const dl = host.querySelector('dl.facts');
    expect(dl?.children).toHaveLength(4);
    expect(
      [...host.querySelectorAll('dl.facts > div')].map((pair) =>
        [...pair.children].map((child) => child.tagName),
      ),
    ).toEqual(Array.from({ length: 4 }, () => ['DT', 'DD']));
  });

  it('U2 renders a single statement as div.answer-point, never a paragraph containing a definition list', () => {
    render(inputFor(planted(`${marker}-single`)));
    expect(host.querySelectorAll('.answer-point')).toHaveLength(1);
    expect(host.querySelector('.answer-point')?.tagName).toBe('DIV');
    expect(host.querySelector('p > dl.facts')).toBeNull();
  });

  it('U2 omits the facts list for an unmarked statement beside a marked one', () => {
    const empty: DocumentMarks = {
      document: `${marker}-empty`,
      grades: [],
      groups: [[{ sentence: 2, qualifiers: [], preferences: [], times: [] }]],
    };
    const input = inputFor(planted(`${marker}-marked`), empty);
    render(input);
    expect(host.querySelectorAll('.answer-point')).toHaveLength(2);
    expect(host.querySelectorAll('dl.facts')).toHaveLength(1);
    expect(host.querySelectorAll('.answer-point')[1]?.querySelector('dl.facts')).toBeNull();
    expect(facts()).toEqual(expectedFacts(input));
  });

  it('U2 keeps multi-statement facts aligned and the grade on the first statement of its document run', () => {
    const value = planted(`${marker}-run`);
    const later = planted(`${marker}-run`, 4).groups[0]?.[0];
    if (later === undefined) throw new Error('later sentence absent');
    later.sentence = 4;
    value.groups.push([{ sentence: 3, qualifiers: [], preferences: [], times: [] }], [later]);
    const input = inputFor(value, planted(`${marker}-next`));
    render(input);
    const expected = expectedFacts(input);
    expect(expected.map((row) => row.some(([label]) => label === 'Grade'))).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(facts()).toEqual(expected);
    expect(host.querySelectorAll('dl.facts')).toHaveLength(3);
    expect(host.querySelectorAll('.answer-point')[1]?.querySelector('dl.facts')).toBeNull();
  });

  it('U2 generated scalar and optional-pair variations preserve every join value without extra pairs', () => {
    for (let seed = 0; seed < 32; seed += 1) {
      const value = planted(`${marker}-generated${String(seed)}`, seed);
      const sentence = value.groups[0]?.[0];
      if (sentence === undefined) throw new Error('generated sentence absent');
      if (seed % 2 === 0) sentence.qualifiers = [];
      if (seed % 4 < 2) value.grades = [];
      if (seed % 8 < 4) sentence.preferences = [];
      if (seed % 16 < 8) sentence.times = [];
      const input = inputFor(value);
      render(input);
      const expected = expectedFacts(input);
      expect(facts(), `seed ${String(seed)}`).toEqual(expected);
      expect(host.querySelectorAll('dl.facts'), `seed ${String(seed)}`).toHaveLength(
        expected[0]?.length === 0 ? 0 : 1,
      );
    }
  });
});

describe('marks availability notice', () => {
  const withoutSolutions: [string, MarksOutcome][] = [
    ['failure', { kind: 'failure' }],
    ['limit', { kind: 'limit', limit: 'inference', solutions: [] }],
    ['error', { kind: 'error', error: { code: 'worker', message: `${marker} failed` } }],
    ['cancelled', { kind: 'cancelled', solutions: [] }],
    ['rejected', { kind: 'rejected', reason: 'unknown-id' }],
  ];
  it.each(withoutSolutions)(
    'U3 %s counts every missing document without dropping the answer',
    (_name, outcome) => {
      const input = incomplete();
      input.marks = settled(outcome);
      render(input);
      expectMissing(3, 3);
      for (const point of input.points) expect(host.textContent).toContain(point.text);
      expect(host.querySelector('dl.facts')).toBeNull();
    },
  );

  it.each(['missing document', 'undecodable solution'] as const)(
    'U3 %s counts only unusable documents',
    (kind) => {
      const input = incomplete();
      const good = marksSolution(planted(`${marker}-a`));
      const bad = marksSolution(planted(`${marker}-b`));
      bad.bindings.Marks = atom(`${marker}-not-marks`);
      input.marks = stateFor(good, ...(kind === 'undecodable solution' ? [bad] : []));
      render(input);
      expectMissing(2, 3);
      expect(facts()).toEqual(expectedFacts(input));
      expect(host.querySelectorAll('dl.facts')).toHaveLength(1);
    },
  );

  it.each(['limit', 'cancelled'] as const)(
    'U3 partial %s retains returned marks and counts the unreached documents',
    (kind) => {
      const input = incomplete();
      const solutions = [
        marksSolution(planted(`${marker}-a`)),
        marksSolution(planted(`${marker}-c`)),
      ];
      input.marks = settled(
        kind === 'limit' ? { kind, limit: 'answer-cap', solutions } : { kind, solutions },
      );
      render(input);
      expectMissing(1, 3);
      expect(facts()).toEqual(expectedFacts(input));
      expect(host.querySelectorAll('dl.facts')).toHaveLength(2);
    },
  );

  it('U3 unavailable counts every document when the engine has no marks path', () => {
    const input = incomplete();
    input.marks = { kind: 'unavailable' };
    render(input);
    expectMissing(3, 3);
  });

  it.each(['idle', 'loading'] as const)('U3 %s renders no premature notice or facts', (kind) => {
    const input = incomplete();
    input.marks = kind === 'idle' ? { kind } : { kind, id, goal };
    render(input);
    expect(host.querySelector('p.marks-missing')).toBeNull();
    expect(host.querySelector('dl.facts')).toBeNull();
    expect(host.querySelector('details.mark-goals')).toBeNull();
  });

  it('U3 zero answer documents never produces a missing-document notice', () => {
    for (const marks of [settled({ kind: 'failure' }), { kind: 'unavailable' } as const]) {
      render({ ...inputFor(), marks });
      expect(host.querySelector('p.marks-missing')).toBeNull();
      expect(host.querySelector('dl.facts')).toBeNull();
    }
  });

  it.each(['solutions', 'limit', 'cancelled'] as const)(
    'U3 complete %s renders no missing-document notice',
    (kind) => {
      const value = planted(`${marker}-complete`);
      const input = inputFor(value);
      const solutions = [marksSolution(value)];
      input.marks = settled(
        kind === 'limit' ? { kind, limit: 'answer-cap', solutions } : { kind, solutions },
      );
      render(input);
      expect(host.querySelector('p.marks-missing')).toBeNull();
      expect(facts()).toEqual(expectedFacts(input));
    },
  );
});

describe('marks goal evidence', () => {
  it.each(['solutions', 'limit', 'cancelled'] as const)(
    'U4 %s lists the exact goal and every returned display.Marks without normalization',
    (kind) => {
      const input = incomplete();
      const solutions = [
        marksSolution(planted(`${marker}-a`)),
        marksSolution(planted(`${marker}-b`)),
      ];
      solutions.forEach((solution, index) => {
        solution.display.Marks = `marks('${marker} <&> ${String(index)}', [line\n  tab\t'quoted'], []).`;
      });
      input.marks = settled(
        kind === 'limit' ? { kind, limit: 'wall-clock', solutions } : { kind, solutions },
      );
      render(input);
      const disclosure = host.querySelector('details.mark-goals');
      expect(disclosure).not.toBeNull();
      expect(disclosure?.querySelector('code.mark-goal')?.textContent).toBe(goal);
      expect(
        [...disclosure!.querySelectorAll('li > code')].map((code) => code.textContent),
      ).toEqual(solutions.map((solution) => solution.display.Marks));
      expect(disclosure?.querySelectorAll(':scope > summary')).toHaveLength(1);
      expect(disclosure?.querySelector('summary')?.textContent?.trim()).not.toBe('');
      expect(disclosure?.querySelector('p.mark-goals-note')?.textContent).toBe(
        EN.DESCRIPTIONS.chatCardNote,
      );
      if (kind !== 'solutions') {
        expect(disclosure?.querySelectorAll('p.mark-goals-status')).toHaveLength(1);
        const expected =
          kind === 'limit' ? EN.TEXT.chatCardLimit('wall-clock', 2) : EN.TEXT.chatCardCancelled();
        expect(disclosure?.querySelector('p.mark-goals-status')?.textContent).toBe(expected);
      }
    },
  );

  const outcomes: [string, MarksOutcome, string | undefined][] = [
    ['failure', { kind: 'failure' }, EN.TEXT.chatCardFailure()],
    [
      'limit',
      { kind: 'limit', limit: 'inference', solutions: [] },
      EN.TEXT.chatCardLimit('inference', 0),
    ],
    [
      'error',
      { kind: 'error', error: { code: 'worker', message: `${marker} error` } },
      EN.TEXT.chatCardError('worker'),
    ],
    ['cancelled', { kind: 'cancelled', solutions: [] }, EN.TEXT.chatCardCancelled()],
    ['rejected', { kind: 'rejected', reason: 'unknown-id' }, undefined],
  ];
  it.each(outcomes)(
    'U4 %s discloses the goal and non-solutions status with no invented solution',
    (_name, outcome, expected) => {
      const input = incomplete();
      input.marks = settled(outcome);
      render(input);
      const disclosure = host.querySelector('details.mark-goals');
      expect(disclosure).not.toBeNull();
      expect(disclosure?.querySelector('code.mark-goal')?.textContent).toBe(goal);
      expect(disclosure?.querySelectorAll('li > code')).toHaveLength(0);
      expect(disclosure?.querySelectorAll('p.mark-goals-status')).toHaveLength(1);
      const status = disclosure?.querySelector('p.mark-goals-status')?.textContent;
      expect(status?.trim()).not.toBe('');
      if (expected !== undefined) expect(status).toBe(expected);
    },
  );
});

describe('locale and busy boundaries', () => {
  it('U5 Japanese labels are 修飾語/グレード/優先/時期 while every value stays byte-equal to English', () => {
    const input = inputFor(planted(`${marker}-locale`));
    render(input);
    const english = facts();
    expect(english).toEqual(expectedFacts(input));
    expect(english[0]).toHaveLength(4);
    locale.set('ja');
    flushSync();
    const japanese = facts();
    expect(japanese[0]?.map(([label]) => label)).toEqual(['修飾語', 'グレード', '優先', '時期']);
    expect(japanese.map((row) => row.map(([, value]) => value))).toEqual(
      english.map((row) => row.map(([, value]) => value)),
    );
    locale.set('en');
    flushSync();
    expect(facts()).toEqual(english);
  });

  it('U5 Japanese missing notice uses the same document counts and its translated catalog', () => {
    const input = incomplete();
    input.marks = stateFor(marksSolution(planted(`${marker}-a`)));
    locale.set('ja');
    render(input);
    expect(host.querySelectorAll('p.marks-missing')).toHaveLength(1);
    expect(host.querySelector('p.marks-missing')?.textContent).toBe(missingText(2, 3, 'ja'));
  });

  it.each(['ready', 'failed', 'unavailable', 'loading', 'idle'] as const)(
    'U6 busy with %s marks shows no facts, missing notice or goal disclosure',
    (kind) => {
      const input = incomplete();
      input.busy = true;
      if (kind === 'failed') input.marks = settled({ kind: 'failure' });
      else if (kind === 'unavailable' || kind === 'idle') input.marks = { kind };
      else if (kind === 'loading') input.marks = { kind, id, goal };
      render(input);
      expect(host.querySelector('dl.facts')).toBeNull();
      expect(host.querySelector('p.marks-missing')).toBeNull();
      expect(host.querySelector('details.mark-goals')).toBeNull();
      for (const point of input.points) expect(host.textContent).toContain(point.text);
    },
  );
});
