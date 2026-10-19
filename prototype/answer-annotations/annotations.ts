// PROTOTYPE (ITERATE — answer panel annotations). Every annotation shown comes from a read-only
// goal the page's engine runs (`DemoController.runGoal`); nothing here is a fixture. Shortcuts:
// stored heads are read with `clause/2` rather than derived under the clinical premises, and
// copy is English-only.

import type { QueryOutcome } from '../../src/engine/client.js';
import type { PlSolution } from '../../src/engine/protocol.js';
import type { PlTerm } from '../../src/engine/terms.js';
import { presentClinicalAdvice } from '../../src/questions/advice.js';

export interface Grade {
  dimension: string;
  value: string;
  label: string;
}

export interface Qualifier {
  kind: string;
  word: string;
}

export interface Timing {
  role: string;
  comparison: string;
  count: number;
  unit: string;
  anchor: string;
}

export interface PointMarks {
  documents: string[];
  grades: Grade[];
  qualifiers: Qualifier[];
  timing: Timing[];
}

export interface AnnotationRun {
  /** Point text → its marks. */
  points: Map<string, PointMarks>;
  /** Every goal this run sent, with its verbatim engine solutions. */
  goals: { goal: string; display: string }[];
}

type Run = (goal: string) => Promise<QueryOutcome> | undefined;

const quote = (atom: string): string => `'${atom.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const gid = (document: string, sentence = '_'): string =>
  `'$guideline_id'(product,${quote(document)},${sentence},_,_)`;

export const gradeGoal = (document: string): string =>
  `findall(g(D,V,N),(guideline_grade(actual,${gid(document)},D,V,L),guideline_entity(actual,L,N,_)),X)`;

export const ruleGoal = (document: string): string =>
  `findall(r(S,R),clinical_rule(${quote(document)},S,R),X)`;

export const qualifierGoal = (document: string): string =>
  `findall(q(S,K,W),(E=${gid(document, 'S')},clause(guideline_qualifier(_,E,K,W),_)),X)`;

export const timingGoal = (document: string): string =>
  `findall(t(S,Role,C,N,U,A),(E=${gid(document, 'S')},clause(guideline_interval(_,E,Role,Q,U,R),_),` +
  `clause(guideline_cardinality(_,Q,_,C,N),_),clause(guideline_entity(_,R,A,_),_)),X)`;

const args = (term: PlTerm | undefined, functor: string, arity: number): PlTerm[] | undefined =>
  term?.kind === 'compound' && term.functor === functor && term.args.length === arity
    ? term.args
    : undefined;

const text = (term: PlTerm | undefined): string =>
  term?.kind === 'atom' || term?.kind === 'string' ? term.value : '';

const int = (term: PlTerm | undefined): number =>
  term?.kind === 'integer' ? Number(term.value) : Number.NaN;

const list = (solution: PlSolution | undefined): PlTerm[] => {
  const x = solution?.bindings.X;
  return x?.kind === 'list' ? x.items : [];
};

/** Structural identity of a decoded term; decoded data, never an engine value. */
const key = (term: PlTerm): string => JSON.stringify(term);

const ruleKey = (rule: PlTerm): string | undefined => {
  const parts = args(rule, 'rule', 4);
  return parts === undefined ? undefined : parts.slice(1).map(key).join('|');
};

export const words = (value: string): string =>
  value.replace(/[_-]+/gu, ' ').replace(/^(?:a|an|the) /u, '');

const COMPARISON: Record<string, string> = {
  eq: '',
  exactly: 'exactly',
  geq: 'at least',
  greater: 'more than',
  leq: 'at most',
  less: 'less than',
  about: 'about',
};

/** The graph's quantity reading (`sync-u2` B(Q)), so both surfaces say the same words. */
export const timingText = ({ role, comparison, count, unit, anchor }: Timing): string => {
  const bound = [
    COMPARISON[comparison] ?? comparison,
    String(count),
    count === 1 ? unit : `${unit}s`,
  ]
    .filter((part) => part !== '')
    .join(' ');
  const target = words(anchor);
  return role === 'within' ? `within ${bound} of ${target}` : `${bound} ${role} ${target}`;
};

export const gradeValue = (grade: Grade): string => words(grade.value);

export const gradeLabel = (grade: Grade): string => words(grade.label);

const dedupe = <T>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = JSON.stringify(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const answerTerm = (solution: PlSolution): PlTerm | undefined =>
  Object.values(solution.bindings).find((term) => args(term, 'clinical_answer', 3) !== undefined);

/**
 * Run the four annotation goals per answer document and key the marks by rendered point text.
 * Item i of a structured answer renders rule i of its `clinical_answer/3` term; that rule's
 * subject, mode and actions locate the sentences whose stored annotation heads apply.
 */
export const annotate = async (
  solutions: readonly PlSolution[],
  run: Run,
): Promise<AnnotationRun> => {
  const goals: AnnotationRun['goals'] = [];
  const ask = async (goal: string): Promise<PlTerm[]> => {
    const outcome = await run(goal);
    if (outcome?.kind !== 'solutions') {
      goals.push({ goal, display: outcome === undefined ? 'not run' : outcome.kind });
      return [];
    }
    goals.push({ goal, display: outcome.solutions[0]?.display.X ?? '' });
    return list(outcome.solutions[0]);
  };

  const documents = new Map<
    string,
    {
      grades: Grade[];
      rules: Map<string, number[]>;
      qualifiers: Map<number, Qualifier[]>;
      timing: Map<number, Timing[]>;
    }
  >();
  for (const solution of solutions) {
    const term = answerTerm(solution);
    const document = text(args(term, 'clinical_answer', 3)?.[0]);
    if (document === '' || documents.has(document)) continue;
    const grades = (await ask(gradeGoal(document))).flatMap((g) => {
      const [d, v, n] = args(g, 'g', 3) ?? [];
      return d === undefined ? [] : [{ dimension: text(d), value: text(v), label: text(n) }];
    });
    const rules = new Map<string, number[]>();
    for (const r of await ask(ruleGoal(document))) {
      const [s, rule] = args(r, 'r', 2) ?? [];
      const k = rule === undefined ? undefined : ruleKey(rule);
      if (k === undefined) continue;
      rules.set(k, [...(rules.get(k) ?? []), int(s)]);
    }
    const qualifiers = new Map<number, Qualifier[]>();
    for (const q of await ask(qualifierGoal(document))) {
      const [s, k, w] = args(q, 'q', 3) ?? [];
      if (s === undefined) continue;
      qualifiers.set(int(s), [...(qualifiers.get(int(s)) ?? []), { kind: text(k), word: text(w) }]);
    }
    const timing = new Map<number, Timing[]>();
    for (const t of await ask(timingGoal(document))) {
      const [s, role, c, n, u, a] = args(t, 't', 6) ?? [];
      if (s === undefined) continue;
      timing.set(int(s), [
        ...(timing.get(int(s)) ?? []),
        { role: text(role), comparison: text(c), count: int(n), unit: text(u), anchor: text(a) },
      ]);
    }
    documents.set(document, { grades, rules, qualifiers, timing });
  }

  const points = new Map<string, PointMarks>();
  for (const solution of solutions) {
    const term = answerTerm(solution);
    const parts = args(term, 'clinical_answer', 3);
    const document = text(parts?.[0]);
    const data = documents.get(document);
    if (term === undefined || parts === undefined || data === undefined) continue;
    const presented = presentClinicalAdvice(term);
    const rules = parts[1]?.kind === 'list' ? parts[1].items : [];
    if (presented?.structured !== true) continue;
    presented.items.forEach((item, index) => {
      const rule = rules[index];
      const k = rule === undefined ? undefined : ruleKey(rule);
      const sentences = k === undefined ? [] : (data.rules.get(k) ?? []);
      const marks = points.get(item) ?? { documents: [], grades: [], qualifiers: [], timing: [] };
      marks.documents = dedupe([...marks.documents, document]);
      marks.grades = dedupe([...marks.grades, ...data.grades]);
      marks.qualifiers = dedupe([
        ...marks.qualifiers,
        ...sentences.flatMap((s) => data.qualifiers.get(s) ?? []),
      ]);
      marks.timing = dedupe([
        ...marks.timing,
        ...sentences.flatMap((s) => data.timing.get(s) ?? []),
      ]);
      points.set(item, marks);
    });
  }
  return { points, goals };
};

export interface Segment {
  text: string;
  /** The annotation kind this run of text carries; absent = plain text. */
  mark?: string;
}

/** The bound phrase the sentence itself spells, e.g. `at least 1 week`. */
const boundPhrase = ({ comparison, count, unit }: Timing): string =>
  [COMPARISON[comparison] ?? comparison, String(count), count === 1 ? unit : `${unit}s`]
    .filter((part) => part !== '')
    .join(' ');

/** Split a rendered statement where it spells a qualifier word or a time bound. */
export const segments = (text: string, marks: PointMarks | undefined): Segment[] => {
  if (marks === undefined) return [{ text }];
  const phrases = [
    ...marks.qualifiers.map(({ word, kind }) => ({ phrase: word, mark: kind })),
    ...marks.timing.map((timing) => ({ phrase: boundPhrase(timing), mark: 'time' })),
  ];
  const hits: { start: number; end: number; mark: string }[] = [];
  const lower = text.toLowerCase();
  for (const { phrase, mark } of phrases) {
    const needle = phrase.toLowerCase();
    for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + 1)) {
      const before = lower[at - 1] ?? ' ';
      const after = lower[at + needle.length] ?? ' ';
      if (/[a-z0-9]/u.test(before) || /[a-z0-9]/u.test(after)) continue;
      if (hits.some((hit) => at < hit.end && at + needle.length > hit.start)) continue;
      hits.push({ start: at, end: at + needle.length, mark });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) out.push({ text: text.slice(cursor, hit.start) });
    out.push({ text: text.slice(hit.start, hit.end), mark: hit.mark });
    cursor = hit.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
};

/** One line per grade dimension, strength first. */
export const gradeSignature = (grades: readonly Grade[]): string =>
  [...grades]
    .sort((a, b) => a.dimension.localeCompare(b.dimension) * -1)
    .map((grade) => `${grade.dimension}:${grade.value}`)
    .join('|');
