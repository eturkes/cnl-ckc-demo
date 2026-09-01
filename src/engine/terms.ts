// Prolog term representation crossing the worker boundary, plus the decode and
// encode that produce it.
//
// Decoding happens inside the worker, before any DTO is built. Native swipl-wasm
// values must never reach the boundary and must never re-enter a query: passing a
// binding through `JSON.stringify` rewrites `'$guideline_id'/5` into arity 1 with
// `ref([1])` and flips `1r3` to `3r1`, which would silently falsify every answer
// the demo claims came from Prolog.
//
// The wrapper ABI below (`$t` discriminants, the one-element compound argument
// envelope, `$tag` dicts) is undocumented and read off the installed package. An
// unrecognized tag fails closed rather than degrading to text.

export type PlInteger = number | bigint;

export type PlTerm =
  | { kind: 'atom'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'integer'; value: PlInteger }
  | { kind: 'float'; value: number }
  | { kind: 'rational'; numerator: PlInteger; denominator: PlInteger }
  | { kind: 'list'; items: PlTerm[] }
  | { kind: 'improper-list'; items: PlTerm[]; tail: PlTerm }
  | { kind: 'compound'; functor: string; args: PlTerm[] }
  | { kind: 'variable'; id: number }
  | { kind: 'dict'; tag: string; entries: Record<string, PlTerm> };

export type PlBindings = Record<string, PlTerm>;

/** Constructors the engine exposes on `prolog`; re-encoding goes only through these. */
export interface PrologConstructors {
  Compound: new (functor: string, ...args: unknown[]) => unknown;
  List: new (items: unknown[], tail?: unknown) => unknown;
  Rational: new (numerator: PlInteger, denominator: PlInteger) => unknown;
  String: new (value: string) => unknown;
  Var: new (id?: number) => unknown;
}

export class DecodeError extends Error {
  override name = 'DecodeError';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asInteger = (value: unknown, field: string): PlInteger => {
  if (typeof value === 'bigint' || (typeof value === 'number' && Number.isSafeInteger(value)))
    return value;
  throw new DecodeError(`${field} must be a safe integer or bigint`);
};

/**
 * Decode one native binding value.
 *
 * A JS number that is not a safe integer is the only float this boundary can
 * recognize: SWI's `1.0` and `1` both arrive as JS `1`, so an integral float
 * decodes as `integer`. The shipped corpus contains no floats. Asking Prolog for
 * each binding's type would close the gap at one extra call per binding.
 */
export function decodeTerm(value: unknown): PlTerm {
  if (typeof value === 'string') return { kind: 'atom', value };
  if (typeof value === 'bigint') return { kind: 'integer', value };
  if (typeof value === 'number') {
    // `1.0Inf` and `nan` arrive as non-finite numbers; refusing them keeps a
    // corrupt value from being rendered as a plausible atom.
    if (!Number.isFinite(value)) throw new DecodeError('number must be finite');
    return Number.isSafeInteger(value) ? { kind: 'integer', value } : { kind: 'float', value };
  }
  if (Array.isArray(value)) return { kind: 'list', items: value.map(decodeTerm) };
  if (!isRecord(value)) throw new DecodeError(`unsupported native value: ${String(value)}`);

  if (value.$t === 's' && typeof value.v === 'string') return { kind: 'string', value: value.v };
  if (value.$t === 'r') {
    return {
      kind: 'rational',
      numerator: asInteger(value.n, 'rational numerator'),
      denominator: asInteger(value.d, 'rational denominator'),
    };
  }
  if (value.$t === 'v' && typeof value.v === 'number' && Number.isSafeInteger(value.v)) {
    return { kind: 'variable', id: value.v };
  }
  if (value.$t === 'l' && Array.isArray(value.v) && 't' in value) {
    return { kind: 'improper-list', items: value.v.map(decodeTerm), tail: decodeTerm(value.t) };
  }
  if (value.$t === 't' && typeof value.functor === 'string') {
    const packed = value[value.functor];
    if (!Array.isArray(packed) || packed.length !== 1 || !Array.isArray(packed[0])) {
      throw new DecodeError(
        `compound ${value.functor} lacks swipl-wasm's one-element argument envelope`,
      );
    }
    return { kind: 'compound', functor: value.functor, args: packed[0].map(decodeTerm) };
  }
  if (typeof value.$tag === 'string' && value.$tag !== 'bindings') {
    const entries: Record<string, PlTerm> = {};
    for (const [key, item] of Object.entries(value))
      if (key !== '$tag') entries[key] = decodeTerm(item);
    return { kind: 'dict', tag: value.$tag, entries };
  }
  throw new DecodeError(`unsupported native tag: ${String(value.$t ?? value.$tag)}`);
}

export function decodeBindings(value: unknown): PlBindings {
  if (
    !isRecord(value) ||
    value.$tag !== 'bindings' ||
    (value.success !== undefined && value.success !== true)
  ) {
    throw new DecodeError('expected successful swipl-wasm bindings');
  }
  const bindings: PlBindings = {};
  for (const [name, term] of Object.entries(value)) {
    if (name !== '$tag' && name !== 'success') bindings[name] = decodeTerm(term);
  }
  return bindings;
}

/** One `once()` outcome, before it becomes a protocol response. */
export type OnceResult =
  | { kind: 'bindings'; bindings: PlBindings }
  | { kind: 'failure' }
  | { kind: 'prolog-error'; message: string };

export function decodeOnce(value: unknown): OnceResult {
  if (!isRecord(value)) throw new DecodeError('expected swipl-wasm query result');
  // A synchronous `once()` reports an exception as a value rather than throwing.
  if (value.error === true && typeof value.message === 'string') {
    return { kind: 'prolog-error', message: value.message };
  }
  if (value.success === false) return { kind: 'failure' };
  return { kind: 'bindings', bindings: decodeBindings(value) };
}

/**
 * Build a term encoder bound to one engine's constructors.
 *
 * Variables are interned per encoder so a term sharing one variable across two
 * arguments re-enters sharing it too.
 */
export function createEncoder(constructors: PrologConstructors): (term: PlTerm) => unknown {
  const variables = new Map<number, unknown>();
  const encode = (term: PlTerm): unknown => {
    switch (term.kind) {
      case 'atom':
      case 'integer':
      case 'float':
        return term.value;
      case 'string':
        return new constructors.String(term.value);
      case 'rational':
        return new constructors.Rational(term.numerator, term.denominator);
      case 'list':
        return term.items.map(encode);
      case 'improper-list':
        return new constructors.List(term.items.map(encode), encode(term.tail));
      case 'compound':
        return new constructors.Compound(term.functor, ...term.args.map(encode));
      case 'variable': {
        const existing = variables.get(term.id);
        if (existing !== undefined) return existing;
        const created = new constructors.Var();
        variables.set(term.id, created);
        return created;
      }
      case 'dict':
        return Object.fromEntries([
          ['$tag', term.tag],
          ...Object.entries(term.entries).map(([key, item]) => [key, encode(item)] as const),
        ]);
    }
  };
  return encode;
}
