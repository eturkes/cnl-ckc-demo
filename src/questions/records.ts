// n2 (`.agent/contracts/n2.md`): the guideline's scope exclusions and superseded statements, read
// by fixed compiled goals (`tools/kb/proof.mjs` `clinical_scope/1`, `clinical_supersessions/1`,
// `clinical_superseded/2`) — goal texts live here, never in the catalog, whose pinned figures stay.

import type { QueryOutcome } from '../engine/client.js';
import type { PlTerm } from '../engine/terms.js';

import type { QuestionId } from './catalog.js';

export interface SentenceRef {
  document: string;
  sentence: number;
}

/** One exclusion condition: `text` = the KB's sentence stating it; `id` = its first source's key. */
export interface ScopeCondition {
  id: string;
  text: string;
  sources: SentenceRef[];
}

export interface SupersessionRecord extends SentenceRef {
  citation: string;
  url: string;
  /** `YYYY-MM-DD`. */
  date: string;
}

/** A superseded statement of a question's family; `derived` = it derives under the run's date. */
export interface SupersededStatement extends SupersessionRecord {
  text: string;
  derived: boolean;
}

type Failure = Exclude<QueryOutcome, { kind: 'solutions' }>;
export type ScopeOutcome = { kind: 'scope'; goal: string; conditions: ScopeCondition[] } | Failure;
export type SupersededOutcome =
  { kind: 'superseded'; goal: string; statements: SupersededStatement[] } | Failure;
export type SupersessionsOutcome =
  { kind: 'supersessions'; goal: string; records: SupersessionRecord[] } | Failure;

export const SCOPE_GOAL = 'clinical_scope(Conditions)';
export const SUPERSESSIONS_GOAL = 'clinical_supersessions(Records)';
/** `id` is a catalog id the caller already admitted; quoting keeps it one atom. */
export const supersededGoal = (id: QuestionId): string =>
  `clinical_superseded('${id.replaceAll("'", "''")}',Statements)`;

class RecordShapeError extends Error {}

const fail = (what: string): never => {
  throw new RecordShapeError(`unexpected ${what}`);
};
const text = (term: PlTerm | undefined, what: string): string =>
  term?.kind === 'atom' || term?.kind === 'string' ? term.value : fail(what);
const whole = (term: PlTerm | undefined, what: string): number =>
  term?.kind === 'integer' ? Number(term.value) : fail(what);
const items = (term: PlTerm | undefined, what: string): PlTerm[] =>
  term?.kind === 'list' ? term.items : fail(what);
const compound = (term: PlTerm | undefined, functor: string, arity: number): PlTerm[] =>
  term?.kind === 'compound' && term.functor === functor && term.args.length === arity
    ? term.args
    : fail(`${functor}/${String(arity)}`);
/** `20221229` → `2022-12-29`. */
const isoDate = (term: PlTerm | undefined): string => {
  const digits = String(whole(term, 'date')).padStart(8, '0');
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};
const sentenceRef = (term: PlTerm | undefined): SentenceRef => {
  const [document, sentence] = compound(term, 's', 2);
  return { document: text(document, 'document'), sentence: whole(sentence, 'sentence') };
};
const record = (args: PlTerm[]): SupersessionRecord => ({
  document: text(args[0], 'document'),
  sentence: whole(args[1], 'sentence'),
  citation: text(args[2], 'citation'),
  url: text(args[3], 'url'),
  date: isoDate(args[4]),
});

export const decodeConditions = (term: PlTerm | undefined): ScopeCondition[] =>
  items(term, 'condition list').map((condition) => {
    const [first, sentence, sources] = compound(condition, 'condition', 3);
    const { document, sentence: number } = sentenceRef(first);
    return {
      id: `${document}:${String(number)}`,
      text: text(sentence, 'condition text'),
      sources: items(sources, 'source list').map(sentenceRef),
    };
  });

export const decodeRecords = (term: PlTerm | undefined): SupersessionRecord[] =>
  items(term, 'record list').map((row) => record(compound(row, 'record', 5)));

export const decodeStatements = (term: PlTerm | undefined): SupersededStatement[] =>
  items(term, 'statement list').map((row) => {
    const [document, sentence, statement, citation, url, date, derived] = compound(
      row,
      'statement',
      7,
    );
    const flag = text(derived, 'derived flag');
    if (flag !== 'true' && flag !== 'false') fail('derived flag');
    return {
      ...record([document, sentence, citation, url, date] as PlTerm[]),
      text: text(statement, 'statement text'),
      derived: flag === 'true',
    };
  });

/**
 * One read's outcome: its single solution decoded, else the engine's own outcome. A solution
 * that decodes to another shape fails closed as a `decode` error, never as an empty read.
 */
export const readOutcome = <K extends string, V>(
  outcome: QueryOutcome,
  goal: string,
  kind: K,
  variable: string,
  decode: (term: PlTerm | undefined) => V,
): ({ kind: K; goal: string } & { value: V }) | Failure => {
  if (outcome.kind !== 'solutions') return outcome;
  try {
    if (outcome.solutions.length !== 1) fail(`${String(outcome.solutions.length)} solutions`);
    return { kind, goal, value: decode(outcome.solutions[0]?.bindings[variable]) };
  } catch (cause) {
    if (!(cause instanceof RecordShapeError)) throw cause;
    return { kind: 'error', error: { code: 'decode', message: `${goal}: ${cause.message}` } };
  }
};
