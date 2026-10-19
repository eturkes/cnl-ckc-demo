import type { PlTerm } from '../../src/engine/terms.js';
import type { PlSolution } from '../../src/engine/protocol.js';
import type { DocumentMarks, SentenceMarks } from '../../src/questions/marks.js';

export const atom = (value: string): PlTerm => ({ kind: 'atom', value });
export const integer = (value: number | bigint): PlTerm => ({ kind: 'integer', value });
export const list = (...items: PlTerm[]): PlTerm => ({ kind: 'list', items });
export const compound = (functor: string, ...args: PlTerm[]): PlTerm => ({
  kind: 'compound',
  functor,
  args,
});
export const source = (document: string, sentence = 2): PlTerm =>
  compound(
    '$guideline_id',
    atom('product'),
    atom(document),
    integer(sentence),
    compound('ref', integer(1)),
    list(),
  );
export const sentence = (ordinal: number, word = `word-${String(ordinal)}`): SentenceMarks => ({
  sentence: ordinal,
  qualifiers: [{ kind: 'manner', word }],
  preferences: [{ preferred: `preferred-${String(ordinal)}`, alternative: null }],
  times: [{ kind: 'order', relation: 'before', anchor: `anchor-${String(ordinal)}` }],
});
export const documentMarks = (document: string, ...groups: SentenceMarks[][]): DocumentMarks => ({
  document,
  grades: [{ dimension: 'strength', value: 'strong', label: `${document}-grade` }],
  groups,
});
const sentenceTerm = ({
  sentence: ordinal,
  qualifiers,
  preferences,
  times,
}: SentenceMarks): PlTerm =>
  compound(
    'sentence',
    integer(ordinal),
    list(...qualifiers.map(({ kind, word }) => compound('qualifier', atom(kind), atom(word)))),
    list(
      ...preferences.map(({ preferred, alternative }) =>
        compound('preference', atom(preferred), atom(alternative ?? 'none')),
      ),
    ),
    list(
      ...times.map((time) =>
        time.kind === 'order'
          ? compound('order', atom(time.relation), atom(time.anchor))
          : compound(
              'interval',
              atom(time.role),
              atom(time.comparison),
              integer(time.count),
              atom(time.unit),
              atom(time.anchor),
            ),
      ),
    ),
  );
export const marksTerm = ({ document, grades, groups }: DocumentMarks): PlTerm =>
  compound(
    'marks',
    atom(document),
    list(
      ...grades.map(({ dimension, value, label }) =>
        compound('grade', atom(dimension), atom(value), atom(label)),
      ),
    ),
    list(...groups.map((members) => compound('group', list(...members.map(sentenceTerm))))),
  );

export const marksSolution = (
  marks: DocumentMarks,
  origin = source(marks.document),
): PlSolution => ({
  bindings: { Source: origin, Marks: marksTerm(marks) },
  display: { Source: 'unused source display', Marks: 'unused marks display' },
});
export const answerSolution = (document: string): PlSolution => ({
  bindings: {
    Source: source(document),
    Answer: compound('clinical_answer', atom(document), list(), {
      kind: 'string',
      value: 'source passage',
    }),
  },
  display: { Source: 'unused source display', Answer: 'unused answer display' },
});
