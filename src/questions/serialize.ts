// Canonical answer serialization, in the bag's own result grammar.
//
// The sort is SWI standard order over decoded terms, not a byte sort of rendered
// text. The two agree on this corpus, where every projected value is a
// `'$guideline_id'/5` compound of one shape, and diverge as soon as a projection
// mixes atoms, numbers and compounds — and nothing downstream re-checks a wrong
// order, so the comparator is the guarantee rather than the coincidence.

import type { PlSolution } from '../engine/protocol.js';
import type { PlTerm } from '../engine/terms.js';

import type { CatalogEntry } from './catalog.js';

/** Standard order of terms: `Var @< Number @< Atom @< String @< Compound`. Dicts sort last. */
const TYPE_RANK: Record<PlTerm['kind'], number> = {
  variable: 0,
  integer: 1,
  float: 1,
  rational: 1,
  atom: 2,
  string: 3,
  list: 4,
  'improper-list': 4,
  compound: 4,
  dict: 5,
};

/** On equal value a float precedes a rational, which precedes an integer. */
const NUMBER_RANK: Record<string, number> = { float: 0, rational: 1, integer: 2 };

const sign = (value: number | bigint): number => (value < 0 ? -1 : value > 0 ? 1 : 0);

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Exact numerator over denominator, so a bigint never round-trips through a double. */
const ratio = (term: PlTerm): { n: bigint; d: bigint } | undefined =>
  term.kind === 'integer'
    ? { n: BigInt(term.value), d: 1n }
    : term.kind === 'rational'
      ? { n: BigInt(term.numerator), d: BigInt(term.denominator) }
      : undefined;

const asFloat = (term: PlTerm): number =>
  term.kind === 'float'
    ? term.value
    : term.kind === 'integer'
      ? Number(term.value)
      : term.kind === 'rational'
        ? Number(term.numerator) / Number(term.denominator)
        : Number.NaN;

const compareNumbers = (a: PlTerm, b: PlTerm): number => {
  const left = ratio(a);
  const right = ratio(b);
  // A float in the pair forces float comparison, matching the engine's own rule.
  const value =
    left === undefined || right === undefined
      ? sign(asFloat(a) - asFloat(b))
      : sign(left.n * right.d - right.n * left.d);
  return value !== 0 ? value : sign((NUMBER_RANK[a.kind] ?? 0) - (NUMBER_RANK[b.kind] ?? 0));
};

/** Nested `'[|]'/2`, the compound a list actually is. */
const chain = (items: readonly PlTerm[], tail: PlTerm): PlTerm =>
  items.length === 0
    ? tail
    : { kind: 'compound', functor: '[|]', args: [items[0] as PlTerm, chain(items.slice(1), tail)] };

/** Lists order as their compound chain; the empty list orders as the atom `[]`. */
const normalize = (term: PlTerm): PlTerm =>
  term.kind === 'list'
    ? chain(term.items, { kind: 'atom', value: '[]' })
    : term.kind === 'improper-list'
      ? chain(term.items, term.tail)
      : term;

/**
 * Total order over decoded terms, following SWI's standard order.
 *
 * Totality is the point: a sort that reported two distinct solutions equal would
 * make the serialized bytes depend on the engine's yield order.
 */
export const compareTerms = (left: PlTerm, right: PlTerm): number => {
  const a = normalize(left);
  const b = normalize(right);
  const rank = sign((TYPE_RANK[a.kind] ?? 0) - (TYPE_RANK[b.kind] ?? 0));
  if (rank !== 0) return rank;

  switch (a.kind) {
    case 'variable':
      return sign(a.id - (b as Extract<PlTerm, { kind: 'variable' }>).id);
    case 'atom':
    case 'string':
      return compareText(a.value, (b as Extract<PlTerm, { kind: 'atom' | 'string' }>).value);
    case 'integer':
    case 'float':
    case 'rational':
      return compareNumbers(a, b);
    case 'dict': {
      const other = b as Extract<PlTerm, { kind: 'dict' }>;
      const tag = compareText(a.tag, other.tag);
      if (tag !== 0) return tag;
      const keys = Object.keys(a.entries).sort();
      const otherKeys = Object.keys(other.entries).sort();
      const arity = sign(keys.length - otherKeys.length);
      if (arity !== 0) return arity;
      for (const [index, key] of keys.entries()) {
        const name = compareText(key, otherKeys[index] as string);
        if (name !== 0) return name;
        const value = compareTerms(a.entries[key] as PlTerm, other.entries[key] as PlTerm);
        if (value !== 0) return value;
      }
      return 0;
    }
    default: {
      const other = b as Extract<PlTerm, { kind: 'compound' }>;
      const compound = a as Extract<PlTerm, { kind: 'compound' }>;
      const arity = sign(compound.args.length - other.args.length);
      if (arity !== 0) return arity;
      const functor = compareText(compound.functor, other.functor);
      if (functor !== 0) return functor;
      for (const [index, arg] of compound.args.entries()) {
        const ordered = compareTerms(arg, other.args[index] as PlTerm);
        if (ordered !== 0) return ordered;
      }
      return 0;
    }
  }
};

interface Row {
  terms: PlTerm[];
  /** Engine-rendered canonical text per projected variable; never templated here. */
  text: string[];
}

const compareRows = (a: Row, b: Row): number => {
  for (const [index, term] of a.terms.entries()) {
    const ordered = compareTerms(term, b.terms[index] as PlTerm);
    if (ordered !== 0) return ordered;
  }
  return 0;
};

/**
 * Render one answer in the bag's `result/1` grammar: `yes` or `no` for an
 * existence question, otherwise `solutions([sol([...]),...])`.
 */
export const serializeAnswer = (entry: CatalogEntry, solutions: readonly PlSolution[]): string => {
  if (entry.projection.length === 0) return solutions.length > 0 ? 'yes' : 'no';

  const rows = solutions.map((solution) => {
    const terms: PlTerm[] = [];
    const text: string[] = [];
    for (const { variable } of entry.projection) {
      const term = solution.bindings[variable];
      const display = solution.display[variable];
      if (term === undefined || display === undefined) {
        throw new Error(`${entry.id}: solution does not bind projected variable ${variable}`);
      }
      terms.push(term);
      text.push(display);
    }
    return { terms, text };
  });

  rows.sort(compareRows);
  // Duplicate proofs of one fact are one answer, matching `sort/2` rather than `msort/2`.
  const unique = rows.filter(
    (row, index) => index === 0 || compareRows(row, rows[index - 1] as Row) !== 0,
  );
  return `solutions([${unique.map((row) => `sol([${row.text.join(',')}])`).join(',')}])`;
};
