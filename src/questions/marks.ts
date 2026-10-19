// The knowledge base's marks on each answer statement: the grade, qualifiers, preferences and
// time marks `clinical_marks/3` derives for every answer document (`.agent/contracts/ann-u1.md`).
//
// Decoding fails closed: a shape or a scalar outside the contract returns `undefined`, and the
// document then counts as missing, so the panel says so instead of showing a partial or guessed
// mark. Readings use the graph's words for a bound (`tools/kb/graph.mjs` `COMPARISON_WORDS`) and
// the answer renderer's mechanical noun form, so every surface says the same thing.

import type { AnswerPoint, AnswerRow } from '../demo/describe.js';
import type { PlSolution } from '../engine/protocol.js';
import type { PlTerm } from '../engine/terms.js';

import type { QuestionId } from './catalog.js';
import type { MarksOutcome } from './service.js';

export type Comparison = 'eq' | 'exactly' | 'geq' | 'greater' | 'leq' | 'less' | 'about';

export interface Grade {
  dimension: 'strength' | 'evidence';
  value: string;
  label: string;
}

/** `kind` = the qualifier's class; readings never show it (user ruling). */
export interface Qualifier {
  kind: string;
  word: string;
}

/** `alternative` = `null` where the source names no other option (`none`). */
export interface Preference {
  preferred: string;
  alternative: string | null;
}

export type TimeMark =
  | {
      kind: 'interval';
      role: 'after' | 'before' | 'within';
      comparison: Comparison;
      count: number;
      unit: string;
      anchor: string;
    }
  | { kind: 'order'; relation: 'before' | 'after'; anchor: string };

export interface SentenceMarks {
  sentence: number;
  qualifiers: Qualifier[];
  preferences: Preference[];
  times: TimeMark[];
}

export interface DocumentMarks {
  document: string;
  grades: Grade[];
  /** One entry per answer group, in the answer's order; each lists its member sentences. */
  groups: SentenceMarks[][];
}

export type MarksState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'loading'; id: QuestionId; goal: string }
  | { kind: 'settled'; id: QuestionId; goal: string; outcome: MarksOutcome };

export interface StatementMarks {
  qualifier: string;
  /** Empty when no contributor carries a grade or the once-per-run rule hides it. */
  grade: string;
  preferences: string[];
  times: string[];
}

export interface MarksView {
  /** Index-aligned with the points; `undefined` = no document's marks reach that statement. */
  statements: readonly (StatementMarks | undefined)[];
  missing: number;
  total: number;
  notice: boolean;
}

const DIMENSIONS = ['strength', 'evidence'] as const;
const ROLES = ['after', 'before', 'within'] as const;
const COMPARISONS = ['eq', 'exactly', 'geq', 'greater', 'leq', 'less', 'about'] as const;
const RELATIONS = ['before', 'after'] as const;

const COMPARISON_WORDS: Readonly<Record<Comparison, string>> = {
  eq: '',
  exactly: 'exactly ',
  geq: 'at least ',
  greater: 'more than ',
  leq: 'at most ',
  less: 'less than ',
  about: 'about ',
};

type Term = PlTerm | undefined;

const atom = (term: Term): string | undefined =>
  term?.kind === 'atom' && term.value !== '' ? term.value : undefined;

const oneOf = <T extends string>(term: Term, values: readonly T[]): T | undefined =>
  values.find((value) => value === atom(term));

const args = (term: Term, functor: string, arity: number): PlTerm[] | undefined =>
  term?.kind === 'compound' && term.functor === functor && term.args.length === arity
    ? term.args
    : undefined;

const count = (term: Term): number | undefined =>
  term?.kind === 'integer' &&
  typeof term.value === 'number' &&
  Number.isSafeInteger(term.value) &&
  term.value >= 0
    ? term.value
    : undefined;

/** Every item decoded, or `undefined` when one fails: a mark set is never partial. */
const all = <T>(term: Term, decode: (item: PlTerm) => T | undefined): T[] | undefined => {
  if (term?.kind !== 'list') return undefined;
  const decoded: T[] = [];
  for (const item of term.items) {
    const value = decode(item);
    if (value === undefined) return undefined;
    decoded.push(value);
  }
  return decoded;
};

const grade = (term: PlTerm): Grade | undefined => {
  const [dimension, value, label] = args(term, 'grade', 3) ?? [];
  const parts = [oneOf(dimension, DIMENSIONS), atom(value), atom(label)] as const;
  return parts[0] === undefined || parts[1] === undefined || parts[2] === undefined
    ? undefined
    : { dimension: parts[0], value: parts[1], label: parts[2] };
};

const qualifier = (term: PlTerm): Qualifier | undefined => {
  const [kind, word] = (args(term, 'qualifier', 2) ?? []).map(atom);
  return kind === undefined || word === undefined ? undefined : { kind, word };
};

const preference = (term: PlTerm): Preference | undefined => {
  const [preferred, alternative] = (args(term, 'preference', 2) ?? []).map(atom);
  return preferred === undefined || alternative === undefined
    ? undefined
    : { preferred, alternative: alternative === 'none' ? null : alternative };
};

const time = (term: PlTerm): TimeMark | undefined => {
  const interval = args(term, 'interval', 5);
  if (interval !== undefined) {
    const [roleTerm, comparisonTerm, countTerm, unitTerm, anchorTerm] = interval;
    const role = oneOf(roleTerm, ROLES);
    const comparison = oneOf(comparisonTerm, COMPARISONS);
    const quantity = count(countTerm);
    const unit = atom(unitTerm);
    const anchor = atom(anchorTerm);
    return role === undefined ||
      comparison === undefined ||
      quantity === undefined ||
      unit === undefined ||
      anchor === undefined
      ? undefined
      : { kind: 'interval', role, comparison, count: quantity, unit, anchor };
  }
  const [relationTerm, anchorTerm] = args(term, 'order', 2) ?? [];
  const relation = oneOf(relationTerm, RELATIONS);
  const anchor = atom(anchorTerm);
  return relation === undefined || anchor === undefined
    ? undefined
    : { kind: 'order', relation, anchor };
};

const sentence = (term: PlTerm): SentenceMarks | undefined => {
  const [id, qualifiers, preferences, times] = args(term, 'sentence', 4) ?? [];
  const number = count(id);
  const qualifierList = all(qualifiers, qualifier);
  const preferenceList = all(preferences, preference);
  const timeList = all(times, time);
  return number === undefined ||
    number < 1 ||
    qualifierList === undefined ||
    preferenceList === undefined ||
    timeList === undefined
    ? undefined
    : {
        sentence: number,
        qualifiers: qualifierList,
        preferences: preferenceList,
        times: timeList,
      };
};

/** A group lists its member sentences, at least one, strictly ascending. */
const group = (term: PlTerm): SentenceMarks[] | undefined => {
  const members = all(args(term, 'group', 1)?.[0], sentence);
  if (members === undefined || members.length === 0) return undefined;
  const ascending = members.every(
    (member, index) => index === 0 || member.sentence > (members[index - 1]?.sentence ?? 0),
  );
  return ascending ? members : undefined;
};

/** Decode one `marks(Doc, Grades, Groups)` term; `undefined` on any violation. */
export const decodeMarks = (term: PlTerm): DocumentMarks | undefined => {
  const [documentTerm, gradesTerm, groupsTerm] = args(term, 'marks', 3) ?? [];
  const document = atom(documentTerm);
  const grades = all(gradesTerm, grade);
  const groups = all(groupsTerm, group);
  return document === undefined ||
    grades === undefined ||
    groups === undefined ||
    groups.length === 0
    ? undefined
    : { document, grades, groups };
};

/** The answer renderer's mechanical noun form: compound labels become words. */
const words = (value: string): string => value.replace(/[_-]+/gu, ' ');

const upperInitial = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** Keep the first of each equal value, in order. */
const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** The source's own grade labels, strength first whatever the input order. */
export const gradeReading = (grades: readonly Grade[]): string =>
  unique(
    DIMENSIONS.flatMap((dimension) =>
      grades
        .filter((item) => item.dimension === dimension)
        .map(({ label }) => upperInitial(words(label))),
    ),
  ).join(', ');

/** Words alone: one word under two classes shows once, and no class name ever shows. */
export const qualifierReading = (qualifiers: readonly Qualifier[]): string =>
  unique(qualifiers.map(({ word }) => words(word))).join(', ');

export const preferenceReading = ({ preferred, alternative }: Preference): string =>
  alternative === null ? words(preferred) : `${words(preferred)} over ${words(alternative)}`;

export const timeReading = (mark: TimeMark): string => {
  if (mark.kind === 'order') return `${mark.relation} ${words(mark.anchor)}`;
  const unit = words(mark.unit);
  const bound = `${COMPARISON_WORDS[mark.comparison]}${String(mark.count)} ${mark.count === 1 ? unit : `${unit}s`}`;
  return mark.role === 'within'
    ? `within ${bound} of ${words(mark.anchor)}`
    : `${bound} ${mark.role} ${words(mark.anchor)}`;
};

/** The documents a settled outcome returned: a stopped run keeps what it reached. */
const returned = (outcome: MarksOutcome): readonly PlSolution[] =>
  outcome.kind === 'solutions' || outcome.kind === 'limit' || outcome.kind === 'cancelled'
    ? outcome.solutions
    : [];

/** Structural equality of two ground decoded terms; a variable or a dict never matches. */
const sameTerm = (left: PlTerm, right: PlTerm): boolean => {
  const sameItems = (a: readonly PlTerm[], b: readonly PlTerm[]): boolean =>
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return other !== undefined && sameTerm(item, other);
    });
  switch (left.kind) {
    case 'atom':
    case 'string':
      return right.kind === left.kind && right.value === left.value;
    case 'integer':
    case 'float':
      return right.kind === left.kind && right.value === left.value;
    case 'rational':
      return (
        right.kind === 'rational' &&
        right.numerator === left.numerator &&
        right.denominator === left.denominator
      );
    case 'list':
      return right.kind === 'list' && sameItems(left.items, right.items);
    case 'improper-list':
      return (
        right.kind === 'improper-list' &&
        sameItems(left.items, right.items) &&
        sameTerm(left.tail, right.tail)
      );
    case 'compound':
      return (
        right.kind === 'compound' &&
        right.functor === left.functor &&
        sameItems(left.args, right.args)
      );
    case 'variable':
    case 'dict':
      return false;
    default: {
      const exhaustive: never = left;
      return exhaustive;
    }
  }
};

/**
 * Answer solution i's marks, when they are usable: exactly one returned solution with the same
 * `Source` term, decodable, naming the same document, one group per rendered statement.
 */
const usable = (
  row: AnswerRow,
  answer: PlSolution | undefined,
  marks: readonly PlSolution[],
): DocumentMarks | undefined => {
  const source = answer?.bindings['Source'];
  const matches =
    source === undefined
      ? []
      : marks.filter((solution) => {
          const other = solution.bindings['Source'];
          return other !== undefined && sameTerm(other, source);
        });
  const binding = matches.length === 1 ? matches[0]?.bindings['Marks'] : undefined;
  const decoded = binding === undefined ? undefined : decodeMarks(binding);
  return decoded !== undefined &&
    decoded.document === row.document &&
    row.structured === true &&
    row.items?.length === decoded.groups.length
    ? decoded
    : undefined;
};

interface Contribution {
  document: DocumentMarks;
  group: SentenceMarks[];
}

const sameDocuments = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((document, index) => document === right[index]);

const statementMarks = (
  contributions: readonly Contribution[],
  continuesRun: boolean,
): StatementMarks => {
  const documents = unique(contributions.map(({ document }) => document.document));
  const grades = documents.map((name) =>
    gradeReading(
      contributions.find(({ document }) => document.document === name)?.document.grades ?? [],
    ),
  );
  const sentences = contributions.flatMap(({ group: members }) => members);
  return {
    qualifier: qualifierReading(sentences.flatMap(({ qualifiers }) => qualifiers)),
    grade: continuesRun ? '' : grades.filter((reading) => reading !== '').join('; '),
    preferences: unique(sentences.flatMap(({ preferences }) => preferences.map(preferenceReading))),
    times: unique(sentences.flatMap(({ times }) => times.map(timeReading))),
  };
};

/**
 * The marks each synthesized statement shows. Statement text k of answer solution i takes group k
 * of that solution's document marks, over EVERY (solution, item) pair, so a statement repeated
 * inside one document or across two unites all of its groups. A grade shows on the first
 * statement of each run of statements drawing on the same documents — the documents of its
 * answer solutions, marks returned or not, so a missing document still ends its run.
 */
export const marksView = (
  state: MarksState,
  points: readonly AnswerPoint[],
  rows: readonly AnswerRow[],
  answers: readonly PlSolution[],
): MarksView => {
  const total = rows.length;
  const blank = points.map(() => undefined);
  if (state.kind === 'idle' || state.kind === 'loading') {
    return { statements: blank, missing: 0, total, notice: false };
  }
  if (state.kind === 'unavailable') {
    return { statements: blank, missing: total, total, notice: total > 0 };
  }
  const marks = returned(state.outcome);
  const byText = new Map(points.map((point, index) => [point.text, index]));
  const contributions: Contribution[][] = points.map(() => []);
  let missing = 0;
  rows.forEach((row, solution) => {
    const document = usable(row, answers[solution], marks);
    if (document === undefined) {
      missing += 1;
      return;
    }
    (row.items ?? []).forEach((text, item) => {
      const index = byText.get(text);
      const members = document.groups[item];
      if (index !== undefined && members !== undefined) {
        contributions[index]?.push({ document, group: members });
      }
    });
  });
  let previous: readonly string[] = [];
  const statements = contributions.map((contributors, index) => {
    const documents = unique(
      (points[index]?.sources ?? []).map(
        (source) => rows[source]?.document ?? `#${String(source)}`,
      ),
    );
    const continuesRun = sameDocuments(documents, previous);
    previous = documents;
    return contributors.length === 0 ? undefined : statementMarks(contributors, continuesRun);
  });
  return { statements, missing, total, notice: missing > 0 };
};
