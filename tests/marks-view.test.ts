// ann-u1 M9–M12: contract-generated terms + an independent statement-join oracle.
import { describe, expect, it } from 'vitest';

import type { AnswerPoint, AnswerRow } from '../src/demo/describe.js';
import type { PlTerm } from '../src/engine/terms.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import {
  decodeMarks,
  gradeReading,
  qualifierReading,
  preferenceReading,
  timeReading,
  marksView,
  type Comparison,
  type DocumentMarks,
  type MarksState,
} from '../src/questions/marks.js';
import type { MarksOutcome } from '../src/questions/service.js';
import {
  atom,
  integer,
  list,
  source,
  sentence,
  documentMarks,
  marksTerm,
  marksSolution,
  answerSolution,
} from './support/marks-terms.js';

const full: DocumentMarks = {
  document: 'arbitrary-document',
  grades: [
    { dimension: 'evidence', value: 'very_low', label: 'evidence_type-4' },
    { dimension: 'strength', value: 'strong', label: 'category-A' },
  ],
  groups: [
    [
      {
        sentence: 2,
        qualifiers: [{ kind: 'manner', word: 'very-carefully' }],
        preferences: [
          { preferred: 'treatment-one', alternative: null },
          { preferred: 'treatment-two', alternative: 'treatment-three' },
        ],
        times: [
          {
            kind: 'interval',
            role: 'within',
            comparison: 'leq',
            count: 4,
            unit: 'week',
            anchor: 'therapy-start',
          },
          { kind: 'order', relation: 'after', anchor: 'clinical_event' },
        ],
      },
      { sentence: 3, qualifiers: [], preferences: [], times: [] },
    ],
  ],
};
const term = marksTerm(full);
const children = (value: PlTerm): PlTerm[] =>
  value.kind === 'compound' ? value.args : value.kind === 'list' ? value.items : [];
const walk = (value: PlTerm, path: number[] = []): [number[], PlTerm][] => [
  [path, value],
  ...children(value).flatMap((child, index) => walk(child, [...path, index])),
];
const replaceAt = (value: PlTerm, path: readonly number[], replacement: PlTerm): PlTerm => {
  if (path.length === 0) return replacement;
  const [index, ...rest] = path;
  const changed = children(value).map((child, childIndex) =>
    childIndex === index ? replaceAt(child, rest, replacement) : child,
  );
  if (value.kind === 'compound') return { ...value, args: changed };
  if (value.kind === 'list') return { ...value, items: changed };
  throw new Error('malformed-table path is not a container');
};
const malformed: [string, PlTerm][] = [];
for (const [path, node] of walk(term)) {
  const at = path.join('.') || 'root';
  const variants: [string, PlTerm][] = [
    ['variable', { kind: 'variable', id: 0 }],
    ['dict', { kind: 'dict', tag: 'marks', entries: {} }],
    ['rational', { kind: 'rational', numerator: 1, denominator: 2 }],
  ];
  if (node.kind !== 'integer') variants.push(['float kind', { kind: 'float', value: 1 }]);
  if (node.kind !== 'list')
    variants.push(['improper kind', { kind: 'improper-list', items: [], tail: atom('tail') }]);
  if (node.kind === 'compound')
    variants.push(
      ['functor', { ...node, functor: 'wrong' }],
      ['short arity', { ...node, args: node.args.slice(1) }],
      ['long arity', { ...node, args: [...node.args, atom('extra')] }],
      ['atom kind', atom(node.functor)],
    );
  if (node.kind === 'list')
    variants.push(
      ['improper list', { kind: 'improper-list', items: node.items, tail: atom('tail') }],
      ['atom list', atom('not-list')],
      ['string list', { kind: 'string', value: '[]' }],
    );
  if (node.kind === 'atom')
    variants.push(
      ['empty atom', atom('')],
      ['integer atom', integer(1)],
      ['string atom', { kind: 'string', value: node.value }],
      ['list atom', list()],
    );
  if (node.kind === 'integer')
    variants.push(
      ['bigint', integer(1n)],
      ['negative', integer(-1)],
      ['unsafe', integer(Number.MAX_SAFE_INTEGER + 1)],
      ['fraction', integer(1.5)],
      ['NaN', integer(NaN)],
      ['infinity', integer(Infinity)],
      ['float kind', { kind: 'float', value: 1 }],
    );
  for (const [kind, replacement] of variants)
    malformed.push([`${at} ${kind}`, replaceAt(term, path, replacement)]);
}
for (const [name, path, value] of [
  ['empty groups', [2], list()],
  ['empty sentences', [2, 0, 0], list()],
  ['dimension', [1, 0, 0], atom('quality')],
  ['role', [2, 0, 0, 0, 3, 0, 0], atom('during')],
  ['comparison', [2, 0, 0, 0, 3, 0, 1], atom('neq')],
  ['relation', [2, 0, 0, 0, 3, 1, 0], atom('during')],
  ['zero sentence', [2, 0, 0, 0, 0], integer(0)],
  ['duplicate sentence', [2, 0, 0, 1, 0], integer(2)],
  ['descending sentence', [2, 0, 0, 1, 0], integer(1)],
] as const)
  malformed.push([name, replaceAt(term, path, value)]);

const comparisonWords: Record<Comparison, string> = {
  eq: '',
  exactly: 'exactly ',
  geq: 'at least ',
  greater: 'more than ',
  leq: 'at most ',
  less: 'less than ',
  about: 'about ',
};
const normal = (value: string): string => value.replace(/[-_]/gu, ' ');
const id = QUESTION_IDS[0];
const settled = (outcome: MarksOutcome): MarksState => ({
  kind: 'settled',
  id,
  goal: `clinical_marks('${id}',Source,Marks)`,
  outcome,
});
const stateFor = (...documents: DocumentMarks[]): MarksState =>
  settled({ kind: 'solutions', solutions: documents.map((doc) => marksSolution(doc)) });
const row = (document: string, ...items: string[]): AnswerRow => ({
  cells: [],
  label: items.join(' '),
  items,
  document,
  structured: true,
});
const point = (text: string, ...sources: number[]): AnswerPoint => ({ text, sources });
const blank = { qualifier: '', grade: '', preferences: [], times: [] };

describe('marks decoder', () => {
  it('M9 decodes full and empty-mark sentences without dropping order or repeats', () => {
    expect(decodeMarks(term)).toEqual(full);
    const repeated = structuredClone(full);
    repeated.groups[0]?.[0]?.qualifiers.push({ kind: 'manner', word: 'very-carefully' });
    expect(decodeMarks(marksTerm(repeated))).toEqual(repeated);
    const empty = {
      document: 'empty-marks',
      grades: [],
      groups: [[{ sentence: 1, qualifiers: [], preferences: [], times: [] }]],
    };
    expect(decodeMarks(marksTerm(empty))).toEqual(empty);
    const boundary: DocumentMarks = {
      document: ' ',
      grades: [{ dimension: 'strength', value: ' ', label: ' ' }],
      groups: [
        [
          {
            sentence: Number.MAX_SAFE_INTEGER,
            qualifiers: [{ kind: ' ', word: ' ' }],
            preferences: [{ preferred: ' ', alternative: ' ' }],
            times: [
              {
                kind: 'interval',
                role: 'before',
                comparison: 'eq',
                count: 0,
                unit: ' ',
                anchor: ' ',
              },
            ],
          },
        ],
      ],
    };
    expect(decodeMarks(marksTerm(boundary))).toEqual(boundary);
  });
  it.each(malformed)('M9 refuses malformed %s', (_name, value) => {
    expect(decodeMarks(value)).toBeUndefined();
  });
  it('M9 generated legal terms round-trip over all scalar boundaries', () => {
    for (let seed = 1; seed <= 128; seed += 1) {
      const value = structuredClone(full);
      value.document = `doc-${String(seed)}_名`;
      const item = value.groups[0]?.[0];
      if (item === undefined) throw new Error('missing generated sentence');
      item.sentence = seed;
      value.groups[0] = [item, { ...sentence(seed + 1), qualifiers: [] }];
      item.times = [
        {
          kind: 'interval',
          role: (['after', 'before', 'within'] as const)[seed % 3] ?? 'after',
          comparison: (Object.keys(comparisonWords) as Comparison[])[seed % 7] ?? 'eq',
          count: [0, 1, 2, Number.MAX_SAFE_INTEGER][seed % 4] ?? 0,
          unit: `unit_${String(seed)}`,
          anchor: `start-${String(seed)}`,
        },
      ];
      expect(decodeMarks(marksTerm(value)), `seed ${String(seed)}`).toEqual(value);
    }
  });
});

describe('marks readings', () => {
  it('M10 reads every comparison × role at zero, one, plural and safe-integer maximum', () => {
    for (const comparison of Object.keys(comparisonWords) as Comparison[]) {
      for (const role of ['after', 'before', 'within'] as const) {
        for (const count of [0, 1, 2, Number.MAX_SAFE_INTEGER]) {
          const bound = `${comparisonWords[comparison]}${String(count)} test unit${count === 1 ? '' : 's'}`;
          const expected =
            role === 'within'
              ? `within ${bound} of arbitrary anchor`
              : `${bound} ${role} arbitrary anchor`;
          expect(
            timeReading({
              kind: 'interval',
              comparison,
              role,
              count,
              unit: 'test-unit',
              anchor: 'arbitrary_anchor',
            }),
          ).toBe(expected);
        }
      }
    }
  });
  it('M10 reads both order relations and arbitrary preference nouns', () => {
    for (const relation of ['before', 'after'] as const)
      expect(timeReading({ kind: 'order', relation, anchor: 'unseen_event-名' })).toBe(
        `${relation} unseen event 名`,
      );
    expect(preferenceReading({ preferred: 'new_option-名', alternative: null })).toBe(
      'new option 名',
    );
    expect(preferenceReading({ preferred: 'new_option-名', alternative: 'other-option_x' })).toBe(
      'new option 名 over other option x',
    );
  });
  it('M10 orders labels strength-first independently of input order and uses no common values', () => {
    const grades = full.grades;
    expect(gradeReading(grades)).toBe('Category A, Evidence type 4');
    expect(gradeReading([...grades].reverse())).toBe('Category A, Evidence type 4');
    expect(gradeReading([...grades, ...grades])).toBe('Category A, Evidence type 4');
    expect(gradeReading([])).toBe('');
  });
  it('M10 normalizes before deduplication and preserves first word appearance across classes', () => {
    expect(
      qualifierReading([
        { kind: 'focus', word: 'very-carefully' },
        { kind: 'manner', word: 'very_carefully' },
        { kind: 'usuality', word: 'usually' },
        { kind: 'focus', word: 'very-carefully' },
      ]),
    ).toBe('very carefully, usually');
    expect(qualifierReading([])).toBe('');
  });
  it('M10 generated reading properties hold for arbitrary vocabulary, order and repeated normalized words', () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const noun = `brand${String(seed)}-dose_unit名`;
      const word = `word-${String(seed)}`;
      expect(preferenceReading({ preferred: noun, alternative: `alt_${String(seed)}` })).toBe(
        `${normal(noun)} over alt ${String(seed)}`,
      );
      expect(
        qualifierReading([
          { kind: 'one', word },
          { kind: 'two', word: word.replace('-', '_') },
        ]),
      ).toBe(normal(word));
      const label = `${noun}-label`;
      expect(
        gradeReading([{ dimension: 'evidence', value: `ignored_${String(seed)}`, label }]),
      ).toBe(normal(label).replace(/^./u, (first) => first.toUpperCase()));
    }
  });
});

describe('statement joins', () => {
  const a = documentMarks(
    'a',
    [sentence(2, 'first')],
    [sentence(3, 'second')],
    [sentence(4, 'third')],
  );
  const b = documentMarks('b', [sentence(8, 'fourth')], [sentence(9, 'fifth')]);
  const rows = [row('a', 'Shared.', 'Shared.', 'A only.'), row('b', 'Shared.', 'B only.')];
  const points = [point('Shared.', 0, 1), point('A only.', 0), point('B only.', 1)];
  const answers = [answerSolution('a'), answerSolution('b')];
  const expected = [
    {
      qualifier: 'first, second, fourth',
      grade: 'A grade; B grade',
      preferences: ['preferred 2', 'preferred 3', 'preferred 8'],
      times: ['before anchor 2', 'before anchor 3', 'before anchor 8'],
    },
    {
      qualifier: 'third',
      grade: 'A grade',
      preferences: ['preferred 4'],
      times: ['before anchor 4'],
    },
    {
      qualifier: 'fifth',
      grade: 'B grade',
      preferences: ['preferred 9'],
      times: ['before anchor 9'],
    },
  ];
  it('M11 joins every (solution,item) pair despite repeated text and permuted documents', () => {
    expect(marksView(stateFor(b, a), points, rows, answers)).toEqual({
      statements: expected,
      missing: 0,
      total: 2,
      notice: false,
    });
  });
  it('M11 keeps a good contributor while naming the missing document', () => {
    const view = marksView(stateFor(a), points, rows, answers);
    expect(view).toMatchObject({ missing: 1, total: 2, notice: true });
    expect(view.statements[0]).toEqual({
      qualifier: 'first, second',
      grade: 'A grade',
      preferences: ['preferred 2', 'preferred 3'],
      times: ['before anchor 2', 'before anchor 3'],
    });
    expect(view.statements[2]).toBeUndefined();
  });
  it.each([
    'duplicate',
    'wrong document',
    'wrong Source',
    'undecodable',
    'group count',
    'unstructured',
  ] as const)('M11 refuses a document with %s but keeps the other', (defect) => {
    const solutions: PlSolution[] = [marksSolution(a), marksSolution(b)];
    const changedRows = [...rows];
    if (defect === 'duplicate') solutions.push(marksSolution(a));
    if (defect === 'wrong document')
      solutions[0] = marksSolution({ ...a, document: 'wrong' }, source('a'));
    if (defect === 'wrong Source') solutions[0] = marksSolution(a, source('a', 99));
    if (defect === 'undecodable')
      solutions[0] = { bindings: { Source: source('a'), Marks: atom('broken') }, display: {} };
    if (defect === 'group count') solutions[0] = marksSolution({ ...a, groups: a.groups.slice(1) });
    if (defect === 'unstructured') changedRows[0] = { cells: [], label: 'Shared.', document: 'a' };
    const view = marksView(settled({ kind: 'solutions', solutions }), points, changedRows, answers);
    expect(view).toMatchObject({ missing: 1, total: 2, notice: true });
    expect(view.statements[0]).toEqual({
      qualifier: 'fourth',
      grade: 'B grade',
      preferences: ['preferred 8'],
      times: ['before anchor 8'],
    });
    expect(view.statements[1]).toBeUndefined();
  });
  it.each(['limit', 'cancelled'] as const)(
    'M11 preserves returned documents in a %s marks outcome',
    (kind) => {
      const solutions = [marksSolution(a)];
      const outcome: MarksOutcome =
        kind === 'limit' ? { kind, limit: 'inference', solutions } : { kind, solutions };
      expect(marksView(settled(outcome), points, rows, answers)).toEqual(
        marksView(stateFor(a), points, rows, answers),
      );
      expect(marksView(settled(outcome), points, rows, answers).missing).toBe(1);
    },
  );
  it('M11 grade appears once per contiguous document run and reappears after a different run', () => {
    const documents = [
      documentMarks('a', [sentence(1)], [sentence(2)], [sentence(3)]),
      documentMarks('b', [sentence(1)]),
    ];
    const runRows = [row('a', 'A1', 'A2', 'A3'), row('b', 'B1')];
    const runPoints = [point('A1', 0), point('A2', 0), point('B1', 1), point('A3', 0)];
    const view = marksView(stateFor(...documents), runPoints, runRows, answers);
    expect(view.statements.map((item) => item?.grade)).toEqual([
      'A grade',
      '',
      'B grade',
      'A grade',
    ]);
    expect(view.statements.map((item) => item?.qualifier)).toEqual([
      'word 1',
      'word 2',
      'word 1',
      'word 3',
    ]);
  });
  it('M11 identical readings deduplicate across sentences and documents, not across rows', () => {
    const repeated = sentence(1, 'very-carefully');
    const other = {
      ...sentence(2, 'very_carefully'),
      preferences: repeated.preferences,
      times: repeated.times,
    };
    const docs = [documentMarks('a', [repeated, other]), documentMarks('b', [repeated])];
    const view = marksView(
      stateFor(...docs),
      [point('Shared.', 0, 1)],
      [row('a', 'Shared.'), row('b', 'Shared.')],
      answers,
    );
    expect(view.statements).toEqual([
      {
        qualifier: 'very carefully',
        grade: 'A grade; B grade',
        preferences: ['preferred 1'],
        times: ['before anchor 1'],
      },
    ]);
  });
  it('M11 usable empty marks differ from missing marks', () => {
    const empty = {
      document: 'a',
      grades: [],
      groups: [[{ sentence: 1, qualifiers: [], preferences: [], times: [] }]],
    };
    expect(
      marksView(stateFor(empty), [point('A', 0)], [row('a', 'A')], [answers[0] as PlSolution]),
    ).toEqual({ statements: [blank], total: 1, missing: 0, notice: false });
  });
  it('M11 generated document permutations leave joins unchanged and each pair contributes exactly once', () => {
    for (let seed = 1; seed <= 32; seed += 1) {
      const docs = Array.from({ length: 2 + (seed % 5) }, (_, index) =>
        documentMarks(
          `d${String(index)}`,
          [sentence(1, `first_${String(index)}`)],
          [sentence(2, `second_${String(index)}`)],
        ),
      );
      const generatedRows = docs.map(({ document }) => row(document, 'Shared', 'Shared'));
      const generatedAnswers = docs.map(({ document }) => answerSolution(document));
      const generatedPoints = [point('Shared', ...docs.map((_, index) => index))];
      const expectedWords = docs
        .flatMap((_, index) => [`first ${String(index)}`, `second ${String(index)}`])
        .join(', ');
      const shifted = [...docs.slice(seed % docs.length), ...docs.slice(0, seed % docs.length)];
      const actual = marksView(
        stateFor(...shifted),
        generatedPoints,
        generatedRows,
        generatedAnswers,
      );
      expect(actual).toEqual(
        marksView(stateFor(...docs), generatedPoints, generatedRows, generatedAnswers),
      );
      expect(actual.statements[0]?.qualifier).toBe(expectedWords);
      expect(actual.statements[0]?.grade).toBe(
        docs.map(({ document }) => `${document.toUpperCase()} grade`).join('; '),
      );
      expect(actual).toMatchObject({ total: docs.length, missing: 0, notice: false });
    }
  });
  it.each<MarksState>([{ kind: 'idle' }, { kind: 'loading', id, goal: 'goal' }])(
    'M12 %s shows no facts and no notice',
    (state) => {
      const view = marksView(state, points, rows, answers);
      expect(view.statements.every((item) => item === undefined)).toBe(true);
      expect(view.notice).toBe(false);
      expect(view.total).toBe(2);
    },
  );
  it.each<MarksState>([
    { kind: 'unavailable' },
    settled({ kind: 'failure' }),
    settled({ kind: 'solutions', solutions: [] }),
    settled({ kind: 'limit', limit: 'wall-clock', solutions: [] }),
    settled({ kind: 'cancelled', solutions: [] }),
    settled({ kind: 'error', error: { code: 'prolog', message: 'refused' } }),
    settled({ kind: 'rejected', reason: 'unknown-id' }),
  ])('M12 %s without usable documents marks every answer document missing', (state) => {
    const view = marksView(state, points, rows, answers);
    expect(view.statements.every((item) => item === undefined)).toBe(true);
    expect(view).toMatchObject({ total: 2, missing: 2, notice: true });
    expect(marksView(state, [], [], [])).toEqual({
      statements: [],
      total: 0,
      missing: 0,
      notice: false,
    });
  });
});
