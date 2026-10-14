// M1.u2 P3.7: decode → encode → re-query is an identity, improper-list tails included — an atom
// `''` or integer `0` tail once collapsed to `[]` through the wrapper's falsy `toList` check.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine } from '../src/engine/session.js';
import { createEncoder, DecodeError, decodeOnce, type PlTerm } from '../src/engine/terms.js';

const require = createRequire(import.meta.url);
let engine: Engine;
let session: EngineSession;
beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
  const manifest = JSON.parse(
    readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
  ) as {
    contract: { schemaVersion: number; documents: number };
  };
  engine = await load(image)({});
  session = new EngineSession({
    loadImage: (bytes) => load(bytes)({}),
    expected: manifest.contract,
  });
  await session.boot(image);
}, 120_000);

const goalTerm = (goal: string): PlTerm => {
  const result = decodeOnce(engine.prolog.query(goal).once());
  if (result.kind !== 'bindings' || result.bindings.X === undefined) {
    throw new Error(`goal bound no X: ${goal}`);
  }
  return result.bindings.X;
};
const termOf = (literal: string): PlTerm => goalTerm(`X = ${literal}.`);
const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';
const solveOk = async (goal: string): Promise<PlSolution[]> => {
  const outcome = await session.solve(goal, BUDGET_MAX);
  if (outcome.kind !== 'solutions') throw new Error(`expected solutions, got ${outcome.kind}`);
  return outcome.solutions;
};
const requery = (term: PlTerm): PlTerm => {
  const result = decodeOnce(
    engine.prolog.query('Output = Input.', { Input: createEncoder(engine.prolog)(term) }).once(),
  );
  if (result.kind !== 'bindings' || result.bindings.Output === undefined)
    throw new Error('re-query bound no Output');
  return result.bindings.Output;
};
const variants = (literal: string, term: PlTerm): boolean =>
  decodeOnce(
    engine.prolog.query(`T =@= (${literal}).`, { T: createEncoder(engine.prolog)(term) }).once(),
  ).kind === 'bindings';
const atom = (text: string): string => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

// Deterministic grammar, independent of decode/encode; repeated A/B exercise aliasing.
const generatedTerms = (): string[] => {
  let state = 0x2c0ffee;
  const choose = (size: number): number => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state % size;
  };
  const leaves = [
    'a',
    "''",
    "'reader\\'s atom'",
    "'$private'",
    "'MixedCase'",
    "'a-b'",
    '0',
    '-7',
    '9007199254740993',
    '-9007199254740993',
    '1.5',
    '1r3',
    '-2r5',
    '"same text"',
    '[]',
    'A',
    'B',
  ];
  const term = (depth: number): string => {
    const kind = depth === 0 ? 0 : choose(5);
    if (kind === 0) return leaves[choose(leaves.length)] ?? 'a';
    if (kind === 1) return `foo(${term(depth - 1)},${term(depth - 1)})`;
    if (kind === 2) return `[${term(depth - 1)},${term(depth - 1)}]`;
    if (kind === 3) return `[${term(depth - 1)}|${term(depth - 1)}]`;
    return `${atom(`u2-${String(choose(100))}`)}(${term(depth - 1)})`;
  };
  return [...leaves, ...Array.from({ length: 96 }, (_, index) => term(1 + (index % 4)))];
};

it('P3.7 round-trips decode to encode to re-query as an identity', async () => {
  const answers = await solveOk(CATEGORY_A_GOAL);
  expect(answers).toHaveLength(7);
  for (const answer of answers) {
    for (const [name, term] of Object.entries(answer.bindings))
      expect(requery(term), name).toEqual(term);
  }
  // A false shared-variable identity must fail in the independent Prolog oracle.
  expect(variants('pair(A,A)', termOf('pair(A,B)'))).toBe(false);
  const violations: string[] = [];
  for (const literal of ["[a|'']", '[a|0]', ...generatedTerms()]) {
    if (!variants(literal, termOf(literal))) violations.push(literal);
  }
  expect(violations).toEqual([]);
});

it('P3.7 holds for a long improper list, falsy tail included, without deep recursion', () => {
  for (const tail of ['tail', "''", '0']) {
    const literal = `[${Array.from({ length: 10_000 }, () => 'a').join(',')}|${tail}]`;
    expect(variants(literal, termOf(literal)), `10,000 cells | ${tail}`).toBe(true);
  }
});

it('decodes a compound named functor and re-enters it unchanged, nested included', () => {
  // The wrapper keeps a compound's name under `functor` and its arguments under the name, so
  // for this one name the arguments overwrite the name.
  expect(termOf('functor(a,b)')).toEqual({
    kind: 'compound',
    functor: 'functor',
    args: [
      { kind: 'atom', value: 'a' },
      { kind: 'atom', value: 'b' },
    ],
  });
  for (const literal of ['functor(a,b)', 'functor(A,B,A)', 'f(functor(functor(a)))', 'functor']) {
    expect(variants(literal, termOf(literal)), literal).toBe(true);
  }
});

it('decodes a compound named $t and refuses its re-entry by name', () => {
  // The wrapper writes the type tag to `$t`, then the arguments to the name's own key, so for
  // this one name the arguments overwrite the tag; its encoder reads the tag the same way.
  expect(termOf("'$t'(a)")).toEqual({
    kind: 'compound',
    functor: '$t',
    args: [{ kind: 'atom', value: 'a' }],
  });
  const encode = createEncoder(engine.prolog);
  expect(() => encode(termOf("'$t'(a)"))).toThrow(DecodeError);
  expect(() => encode(termOf("f('$t'(a,b))"))).toThrow('a compound named $t cannot re-enter');
});

it('refuses a dict whose keys spell a compound named functor or $t', () => {
  // A dict reaches the decoder as a plain object — an anonymous one with no `$tag` at all — so its
  // own keys can spell either wrapper shape above; only a wrapper instance takes those arms.
  for (const goal of [
    "X = _{'$t': t, functor: [[a]]}.",
    "X = d{'$t': t, functor: [[a]]}.",
    "X = _{'$t': [[a]], functor: '$t'}.",
    "X = d{'$t': [[a]], functor: '$t'}.",
    // A `__proto__` key sets the object's prototype, so a prototype test alone is steerable.
    "X = _{'$t': t, functor: [[a]], '__proto__': []}.",
    "X = d{'$t': [[a]], functor: '$t', '__proto__': []}.",
    "X = _{'$t': t, functor: [[a]], '__proto__': f(a)}.",
  ]) {
    expect(() => goalTerm(goal), goal).toThrow(DecodeError);
  }
});

it('refuses to re-encode a decoded dict, standalone or as an improper-list tail (user ruling)', () => {
  // swipl-wasm has no supported path to re-enter a TAGGED dict: re-encoded, `tag{a:0}` came back
  // as `_{'$tag':tag,a:0}`, no variant of the original. Refusing it fails closed.
  const dict = termOf('point{a:0}');
  expect(dict).toMatchObject({ kind: 'dict', tag: 'point' });
  const encode = createEncoder(engine.prolog);
  expect(() => encode(dict)).toThrow(DecodeError);
  expect(() => encode(dict)).toThrow('a dict cannot re-enter the engine with its tag');
  const tailed = termOf('[x|point{a:0}]');
  expect(tailed).toMatchObject({ kind: 'improper-list', tail: { kind: 'dict' } });
  expect(() => encode(tailed)).toThrow(DecodeError);
  expect(() => encode(termOf('wrap(point{a:0})'))).toThrow(DecodeError);
});
