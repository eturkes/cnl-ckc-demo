// Canonical reader-facing rendering for `clinical_answer/3`.
//
// The engine returns structure, not authored summary prose. This module owns one
// small surface grammar for every recommendation: conditions stay conditions,
// modality and negation are never removed, and every action component is emitted
// once. An unfamiliar inner shape falls back to the exact source passage carried
// in the same term instead of guessing at clinical meaning.

import type { PlTerm } from '../engine/terms.js';

type Mode = 'should' | 'can' | 'fact';
type Polarity = 'positive' | 'negative';

interface Modifier {
  preposition: string;
  value: string;
}

interface Action {
  polarity: Polarity;
  verb: string;
  object: string;
  modifiers: Modifier[];
}

interface Rule {
  conditions: string[];
  subject: string;
  mode: Mode;
  actions: Action[];
}

export interface ClinicalAdvicePresentation {
  text: string;
  /** One lossless controlled-clause rendering per list item. Empty on fallback. */
  items: readonly string[];
  /** Exact aligned guideline passage, never rewritten by this renderer. */
  sourcePassage: string;
  /** Opaque corpus identifier carried by the engine. */
  document?: string;
  structured: boolean;
}

const malformed = (): never => {
  throw new Error('malformed clinical answer');
};

const asAtom = (term: PlTerm | undefined): string =>
  term?.kind === 'atom' ? term.value : malformed();

const asString = (term: PlTerm | undefined): string =>
  term?.kind === 'string' ? term.value : malformed();

const asList = (term: PlTerm | undefined): readonly PlTerm[] =>
  term?.kind === 'list' ? term.items : malformed();

const asCompound = (
  term: PlTerm | undefined,
  functor: string,
  arity: number,
): Extract<PlTerm, { kind: 'compound' }> =>
  term?.kind === 'compound' && term.functor === functor && term.args.length === arity
    ? term
    : malformed();

const nonempty = (value: string): string => (value === '' ? malformed() : value);

const parseModifier = (term: PlTerm): Modifier => {
  const modifier = asCompound(term, 'modifier', 2);
  return {
    preposition: nonempty(asAtom(modifier.args[0])),
    value: nonempty(asString(modifier.args[1])),
  };
};

const parseAction = (term: PlTerm): Action => {
  const action = asCompound(term, 'action', 4);
  const polarity = asAtom(action.args[0]);
  if (polarity !== 'positive' && polarity !== 'negative') return malformed();
  return {
    polarity,
    verb: nonempty(asAtom(action.args[1])),
    object: asString(action.args[2]),
    modifiers: asList(action.args[3]).map(parseModifier),
  };
};

const parseRule = (term: PlTerm): Rule => {
  const rule = asCompound(term, 'rule', 4);
  const mode = asAtom(rule.args[2]);
  if (mode !== 'should' && mode !== 'can' && mode !== 'fact') return malformed();
  const actions = asList(rule.args[3]).map(parseAction);
  if (actions.length === 0) return malformed();
  return {
    conditions: asList(rule.args[0]).map((condition) => nonempty(asString(condition))),
    subject: nonempty(asString(rule.args[1])),
    mode,
    actions,
  };
};

/**
 * Mechanical controlled-language presentation only; no clinical vocabulary is
 * substituted. Compound concept labels become words, their parser-required
 * indefinite article is removed, and the universal clinician actor is pluralized.
 */
const words = (value: string): string =>
  value
    .replace(/\b(?:a|an) ([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\b/gu, '$1')
    .replace(/\bevery clinician that does\b/giu, 'Clinicians who do')
    .replace(/\bevery clinician\b/giu, 'Clinicians')
    .replace(/[_-]+/gu, ' ');

const lowerInitial = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

const upperInitial = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const coordinate = (items: readonly string[], conjunction: 'and' | 'or'): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  if (items.length === 2) return `${items[0] as string} ${conjunction} ${items[1] as string}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1) as string}`;
};

const renderAction = (action: Action): string => {
  const verb = words(action.verb);
  const predicate =
    action.polarity === 'positive' ? verb : verb === 'is' ? 'is not' : `not ${verb}`;
  return [
    predicate,
    words(action.object),
    ...action.modifiers.map(({ preposition, value }) => `${words(preposition)} ${words(value)}`),
  ]
    .filter((part) => part !== '')
    .join(' ');
};

const renderRule = (rule: Rule): string => {
  const actions = coordinate(rule.actions.map(renderAction), 'and');
  const subject = words(rule.subject);
  const main =
    rule.mode === 'fact' ? `${subject} ${actions}` : `${subject} ${rule.mode} ${actions}`;
  let rendered;
  if (rule.conditions.length === 0) rendered = main;
  else if (rule.conditions.length === 1) {
    rendered = `If ${words(rule.conditions[0] as string)}, ${lowerInitial(main)}`;
  } else {
    const alternatives = coordinate(rule.conditions.map(words), 'or');
    rendered = `When any applies — ${alternatives} — ${lowerInitial(main)}`;
  }
  return `${upperInitial(rendered)}.`;
};

/**
 * Decode and render one engine-produced `clinical_answer/3` term.
 *
 * Returning `undefined` means the outer term is not ours. Once the outer functor
 * and exact passage are recognizable, malformed structure returns that passage.
 */
export const presentClinicalAdvice = (term: PlTerm): ClinicalAdvicePresentation | undefined => {
  if (term.kind !== 'compound' || term.functor !== 'clinical_answer' || term.args.length !== 3) {
    return undefined;
  }
  const passage = term.args[2]?.kind === 'string' ? term.args[2].value : undefined;
  if (passage === undefined || passage === '') return undefined;
  const document = term.args[0]?.kind === 'atom' ? term.args[0].value : undefined;
  const fallback = (): ClinicalAdvicePresentation => ({
    text: passage,
    items: [],
    sourcePassage: passage,
    ...(document === undefined ? {} : { document }),
    structured: false,
  });
  try {
    if (document === undefined || document === '') return fallback();
    const rules = asList(term.args[1]).map(parseRule);
    if (rules.length === 0) return fallback();
    const items = rules.map(renderRule);
    return {
      text: items.join(' '),
      items,
      sourcePassage: passage,
      document,
      structured: true,
    };
  } catch {
    return fallback();
  }
};
