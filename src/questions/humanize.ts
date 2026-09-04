// Reader-facing text for a guideline identifier.
//
// Structural only. The document id is opaque schema content — 337 distinct ids
// whose internal tokens belong to whichever guideline produced them — so glossing
// `rec` as "recommendation" or `cdc2022-opioid` as a title would hard-code one
// corpus into a formatter every future guideline also has to pass through.

import type { PlTerm } from '../engine/terms.js';

import { presentClinicalAdvice } from './advice.js';

const ID = '$guideline_id';
const ARITY = 5;

const atom = (term: PlTerm | undefined): string | undefined =>
  term?.kind === 'atom' ? term.value : undefined;

const integer = (term: PlTerm | undefined): string | undefined =>
  term?.kind === 'integer' ? String(term.value) : undefined;

/** `ref(N)` or `box(N)`; the functor stays verbatim because it names a schema position. */
const locator = (term: PlTerm | undefined): string | undefined => {
  if (term?.kind !== 'compound' || term.args.length !== 1) return undefined;
  const position = integer(term.args[0]);
  return position === undefined ? undefined : `${term.functor} ${position}`;
};

/**
 * Format `'$guideline_id'(Role,DocId,Sentence,Locator,Deps)` for a reader.
 *
 * Any other shape returns `display` — the engine's own canonical text — so an
 * unrecognized term degrades to the truth rather than to a guessed label.
 *
 * @param term decoded binding
 * @param display canonical text the engine rendered for the same binding
 */
export const humanizeGuidelineId = (term: PlTerm, display: string): string => {
  if (term.kind !== 'compound' || term.functor !== ID || term.args.length !== ARITY) return display;
  const [, document, sentence, position] = term.args;
  const id = atom(document);
  const ordinal = integer(sentence);
  const place = locator(position);
  if (id === undefined || ordinal === undefined || place === undefined) return display;
  return `${id} — sentence ${ordinal}, ${place}`;
};

export interface AnswerPresentation {
  text: string;
  items: readonly string[];
  structured: boolean;
  sourcePassage?: string;
  document?: string;
}

/** Reader-facing value plus any structured list and exact source fallback it carries. */
export const presentAnswerTerm = (term: PlTerm, display: string): AnswerPresentation => {
  const clinical = presentClinicalAdvice(term);
  if (clinical !== undefined) return clinical;
  if (term.kind === 'string') return { text: term.value, items: [], structured: false };
  return { text: humanizeGuidelineId(term, display), items: [], structured: false };
};

/** String-only compatibility surface for callers that do not render structured lists. */
export const humanizeAnswerTerm = (term: PlTerm, display: string): string =>
  presentAnswerTerm(term, display).text;
