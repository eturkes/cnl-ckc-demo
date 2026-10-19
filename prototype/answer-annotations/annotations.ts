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

export interface Preference {
  preferred: string;
  /** `none` when the source names no other option. */
  alternative: string;
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
  preferences: Preference[];
  timing: Timing[];
}

export interface AnnotationRun {
  /** Point text → its marks. */
  points: Map<string, PointMarks>;
  /** Every goal this run sent, with its verbatim engine solutions. */
  goals: { goal: string; display: string; ok: boolean }[];
}

type Run = (goal: string) => Promise<QueryOutcome> | undefined;

const quote = (atom: string): string => `'${atom.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const gid = (document: string, sentence = '_'): string =>
  `'$guideline_id'(product,${quote(document)},${sentence},_,_)`;

/** A referent's noun: an entity, else the property a copula referent resolves to (sync-u2 R15). */
const noun = (ref: string, out: string): string =>
  `(clause(guideline_entity(_,${ref},${out},_),_);clause(guideline_property(_,${ref},${out},_),_))`;

export const gradeGoal = (document: string): string =>
  `findall(g(D,V,N),(guideline_grade(actual,${gid(document)},D,V,L),guideline_entity(actual,L,N,_)),X)`;

export const ruleGoal = (document: string): string =>
  `findall(r(S,R),clinical_rule(${quote(document)},S,R),X)`;

export const qualifierGoal = (document: string): string =>
  `findall(q(S,K,W),(E=${gid(document, 'S')},clause(guideline_qualifier(_,E,K,W),_)),X)`;

export const preferenceGoal = (document: string): string =>
  `findall(p(S,P,A),(E=${gid(document, 'S')},clause(guideline_preference(_,E,PR,AR),_),${noun('PR', 'P')},` +
  `(AR==none->A=none;${noun('AR', 'A')})),X)`;

export const timingGoal = (document: string): string =>
  `findall(t(S,Role,C,N,U,A),(E=${gid(document, 'S')},clause(guideline_interval(_,E,Role,Q,U,R),_),` +
  `clause(guideline_cardinality(_,Q,_,C,N),_),${noun('R', 'A')}),X)`;

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

export const words = (value: string): string => value.replace(/[_-]+/gu, ' ');

const upperInitial = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

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

/** The source's own grade labels, strength first (user ruling r1: source label only). */
/** The documents a statement draws on; a run of equal keys shares one grade line. */
export const documentKey = (marks: PointMarks | undefined): string =>
  marks === undefined ? '' : marks.documents.join('|');

export const gradeText = (grades: readonly Grade[]): string =>
  [...grades]
    .sort((a, b) => (a.dimension === 'strength' ? -1 : b.dimension === 'strength' ? 1 : 0))
    .map((grade) => upperInitial(words(grade.label)))
    .join(', ');

export const preferenceText = ({ preferred, alternative }: Preference): string =>
  alternative === 'none' ? words(preferred) : `${words(preferred)} over ${words(alternative)}`;

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

const bySentence = <T>(
  rows: PlTerm[],
  functor: string,
  arity: number,
  read: (a: PlTerm[]) => T,
) => {
  const out = new Map<number, T[]>();
  for (const row of rows) {
    const parts = args(row, functor, arity);
    if (parts === undefined) continue;
    const s = int(parts[0]);
    out.set(s, [...(out.get(s) ?? []), read(parts.slice(1))]);
  }
  return out;
};

interface DocumentMarks {
  grades: Grade[];
  rules: Map<string, number[]>;
  qualifiers: Map<number, Qualifier[]>;
  preferences: Map<number, Preference[]>;
  timing: Map<number, Timing[]>;
}

/**
 * Run the five annotation goals per answer document and key the marks by rendered point text.
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
      goals.push({ goal, display: outcome === undefined ? 'not run' : outcome.kind, ok: false });
      return [];
    }
    goals.push({ goal, display: outcome.solutions[0]?.display.X ?? '', ok: true });
    return list(outcome.solutions[0]);
  };

  const documents = new Map<string, DocumentMarks>();
  for (const solution of solutions) {
    const document = text(args(answerTerm(solution), 'clinical_answer', 3)?.[0]);
    if (document === '' || documents.has(document)) continue;
    const grades = (await ask(gradeGoal(document))).flatMap((g) => {
      const [d, v, n] = args(g, 'g', 3) ?? [];
      return d === undefined ? [] : [{ dimension: text(d), value: text(v), label: text(n) }];
    });
    const rules = new Map<string, number[]>();
    for (const r of await ask(ruleGoal(document))) {
      const [s, rule] = args(r, 'r', 2) ?? [];
      const k = rule === undefined ? undefined : ruleKey(rule);
      if (k !== undefined) rules.set(k, [...(rules.get(k) ?? []), int(s)]);
    }
    const qualifiers = bySentence(await ask(qualifierGoal(document)), 'q', 3, ([k, w]) => ({
      kind: text(k),
      word: text(w),
    }));
    const preferences = bySentence(await ask(preferenceGoal(document)), 'p', 3, ([p, a]) => ({
      preferred: text(p),
      alternative: text(a),
    }));
    const timing = bySentence(await ask(timingGoal(document)), 't', 6, ([role, c, n, u, a]) => ({
      role: text(role),
      comparison: text(c),
      count: int(n),
      unit: text(u),
      anchor: text(a),
    }));
    documents.set(document, { grades, rules, qualifiers, preferences, timing });
  }

  const points = new Map<string, PointMarks>();
  for (const solution of solutions) {
    const term = answerTerm(solution);
    const parts = args(term, 'clinical_answer', 3);
    const document = text(parts?.[0]);
    const data = documents.get(document);
    const presented = term === undefined ? undefined : presentClinicalAdvice(term);
    if (parts === undefined || data === undefined || presented?.structured !== true) continue;
    const rules = parts[1]?.kind === 'list' ? parts[1].items : [];
    presented.items.forEach((item, index) => {
      const rule = rules[index];
      const k = rule === undefined ? undefined : ruleKey(rule);
      const sentences = k === undefined ? [] : (data.rules.get(k) ?? []);
      const of = <T>(table: Map<number, T[]>): T[] => sentences.flatMap((s) => table.get(s) ?? []);
      const marks = points.get(item) ?? {
        documents: [],
        grades: [],
        qualifiers: [],
        preferences: [],
        timing: [],
      };
      points.set(item, {
        documents: dedupe([...marks.documents, document]),
        grades: dedupe([...marks.grades, ...data.grades]),
        qualifiers: dedupe([...marks.qualifiers, ...of(data.qualifiers)]),
        preferences: dedupe([...marks.preferences, ...of(data.preferences)]),
        timing: dedupe([...marks.timing, ...of(data.timing)]),
      });
    });
  }
  return { points, goals };
};
