// chat-c1 G1–G7: the real saved image through EngineSession.handle; guard implementation unread.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { EngineRequest, EngineResponse, PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine } from '../src/engine/session.js';
import { decodeOnce, type PlBindings, type PlTerm } from '../src/engine/terms.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const manifest = JSON.parse(
  readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
) as {
  contract: { schemaVersion: number; documents: number };
};
const calls: { goal: string; bindings?: Record<string, unknown> }[] = [];
let engine: Engine;
let session: EngineSession;
let serial = 0;
const KB_ANCHOR = 'once(guideline_schema_version(_))';

const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;

beforeAll(async () => {
  session = new EngineSession({
    expected: manifest.contract,
    loadImage: async (bytes) => {
      engine = await load(bytes)({ printErr: () => undefined });
      const query = engine.prolog.query.bind(engine.prolog);
      const prolog = new Proxy(engine.prolog, {
        get(target, property, receiver) {
          if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
          return (goal: string, bindings?: Record<string, unknown>) => {
            calls.push(bindings === undefined ? { goal } : { goal, bindings });
            return query(goal, bindings);
          };
        },
      });
      return new Proxy(engine, {
        get(target, property, receiver) {
          return property === 'prolog'
            ? prolog
            : (Reflect.get(target, property, receiver) as unknown);
        },
      });
    },
  });
  await session.boot(image);
}, 120_000);

const request = (
  goal: string,
  flag: Record<string, unknown> = { readonly: true },
  target: EngineSession = session,
  budget = BUDGET_MAX,
): Promise<EngineResponse> =>
  target.handle(
    {
      id: `c1-${String(++serial)}`,
      kind: 'query',
      goal,
      budget,
      ...flag,
    } as unknown as EngineRequest,
    new Uint8Array(),
  );

const raw = (goal: string, bindings?: Record<string, unknown>): PlBindings => {
  const result = decodeOnce(engine.prolog.query(goal, bindings).once());
  if (result.kind !== 'bindings') throw new Error(`probe did not bind (${result.kind}): ${goal}`);
  return result.bindings;
};
const solutions = (result: EngineResponse): PlSolution[] => {
  expect(result.kind, result.kind === 'error' ? JSON.stringify(result.error) : result.kind).toBe(
    'solutions',
  );
  if (result.kind !== 'solutions') throw new Error(`expected solutions: ${JSON.stringify(result)}`);
  expect(result.solutions.length).toBeGreaterThan(0);
  return result.solutions;
};
const guard = (result: EngineResponse, reason: RegExp | string): void => {
  expect(result).toMatchObject({ kind: 'error', error: { code: 'guard' } });
  if (result.kind !== 'error') throw new Error('guard refusal missing');
  expect(result.error.message).toMatch(/^read-only query refused: /u);
  if (typeof reason === 'string') expect(result.error.message).toContain(reason);
  else expect(result.error.message).toMatch(reason);
};

const REFUSALS: [string, string | RegExp][] = [
  ['X = "an invented claim"', 'the goal reads no KB predicate'],
  // The every-path rule (close fix, user ruling): the KB branch exists but the claim branch wins.
  [
    'once((X = "an invented claim" ; guideline_schema_version(_)))',
    'the goal can succeed without reading a KB predicate',
  ],
  ['msort([b,a],L)', 'the goal reads no KB predicate'],
  ['assertz(probe_c1(1))', 'assertz/1'],
  ['string_chars("ab",Cs)', 'string_chars/2'],
  ['functor(f(a),F,N)', /functor|decode/iu],
  ['X = functor(a,b,c)', /functor|decode/iu],
  ['X = [functor(a)]', /functor|decode/iu],
  ['X = f(functor(a,b))', /functor|decode/iu],
  ['', /parse|syntax|empty/iu],
  ['clinical_rule(', /parse|syntax/iu],
  ['true. false.', /parse|syntax|term/iu],
  ['retract(_)', 'retract/1'],
  ['nb_setval(k,1)', 'nb_setval/2'],
  ['set_prolog_flag(double_quotes,codes)', 'set_prolog_flag/2'],
  ['consult(f)', 'consult/1'],
  ['user:clinical_rule(D,S,R)', /:\/2|module/iu],
  ['lists:append(X,Y,Z)', /:\/2|module/iu],
  ['G', /variable/iu],
  ['G = true, G', /variable/iu],
  ['findall(X,G,L)', /variable/iu],
  ['\\+ G', /variable/iu],
  ['call(clinical_rule(D,S,R))', 'call/1'],
  ['call(clinical_rule(D),S,R)', 'call/3'],
  ['call(G,X)', 'call/2'],
  ['[f]', /list|goal|callable/iu],
  ['"text"', /string|goal|callable/iu],
  ['42', /integer|number|goal|callable/iu],
  ['clause(H,B)', /clause|variable/iu],
  ['clause(assertz(_),B)', /clause|assertz\/1/iu],
  ['catch(true,_,true)', 'catch/3'],
  ['(true;assertz(x))', 'assertz/1'],
  ['forall(true,assertz(x))', 'assertz/1'],
  ['findall(X,(clinical_rule(X,_,_),assertz(y)),L)', 'assertz/1'],
  ['once(atom_concat(a,b,C))', 'atom_concat/3'],
  ['setof(D,S^R^(clinical_rule(D,S,R),atom_concat(D,x,_)),L)', 'atom_concat/3'],
];
const restore = (): void => {
  raw(
    'catch(abolish(probe_c1/1),_,true),catch(abolish(x/0),_,true),catch(abolish(y/0),_,true),catch(nb_delete(k),_,true),set_prolog_flag(double_quotes,string)',
  );
};

const KB_GOALS = [
  'guideline_arg(A,B,C,D)',
  'guideline_cardinality(A,B,C,D,E)',
  'guideline_document(A,B,C)',
  'guideline_entity(A,B,C,D)',
  'guideline_event(A,B,C)',
  'guideline_operator(A,B,C)',
  'guideline_pp(A,B,C,D)',
  'guideline_property(A,B,C,D)',
  'guideline_schema_version(A)',
  'clinical_advice(A,B,C)',
  'clinical_advice(A,B,C,D)',
  'clinical_rule(A,B,C)',
  'clinical_premise(A,B,C,D)',
  'clinical_gate(A,B,C,D)',
  'clinical_source(A,B,C)',
  'clinical_passage(A,B)',
  'clinical_context(A,B,C)',
  'clinical_derive(A,B,C,D)',
].map((goal) => `once(${goal})`);
const ADMITTED = [
  ...KB_GOALS,
  'findall(D,clinical_rule(D,_,_),Ds),sort(Ds,U),length(U,N)',
  'setof(D,S^R^clinical_rule(D,S,R),Ds)',
  'clause(guideline_entity(A,B,C,D),Body)',
  'clinical_passage(D,T),sub_string(T,_,_,_,"nonopioid")',
  'guideline_operator(actual,C,should)',
];

const BUILTINS: [string, string][] = [
  ['=/2', 'X = 1'],
  ['\\=/2', 'a \\= b'],
  ['==/2', 'a == a'],
  ['\\==/2', 'a \\== b'],
  ['@</2', 'a @< b'],
  ['@>/2', 'b @> a'],
  ['@=</2', 'a @=< a'],
  ['@>=/2', 'a @>= a'],
  ['compare/3', 'compare(Order,a,b)'],
  ['is/2', 'X is 1 + 2'],
  ['=:=/2', '2 =:= 1 + 1'],
  ['=\\=/2', '1 =\\= 2'],
  ['</2', '1 < 2'],
  ['>/2', '2 > 1'],
  ['=</2', '1 =< 1'],
  ['>=/2', '1 >= 1'],
  ['succ/2', 'succ(1,N)'],
  ['plus/3', 'plus(1,2,N)'],
  ['between/3', 'between(1,1,N)'],
  ['var/1', 'var(X)'],
  ['nonvar/1', 'nonvar(a)'],
  ['atom/1', 'atom(a)'],
  ['number/1', 'number(1)'],
  ['integer/1', 'integer(1)'],
  ['float/1', 'float(1.5)'],
  ['atomic/1', 'atomic(a)'],
  ['compound/1', 'compound(f(a))'],
  ['callable/1', 'callable(f(a))'],
  ['is_list/1', 'is_list([a])'],
  ['string/1', 'string("a")'],
  ['ground/1', 'ground(f(a))'],
  ['memberchk/2', 'memberchk(a,[a])'],
  ['length/2', 'length([a,b],N)'],
  ['msort/2', 'msort([b,a],L)'],
  ['sort/2', 'sort([b,a,a],L)'],
  ['sort/4', 'sort(1,@=<,[k(b),k(a)],L)'],
  ['keysort/2', 'keysort([b-2,a-1],L)'],
  ['max_list/2', 'max_list([1,2],N)'],
  ['min_list/2', 'min_list([1,2],N)'],
  ['$member/2', "'$member'(a,[a])"],
  ['$append/3', "'$append'([a],[b],L)"],
  ['sub_string/5', 'sub_string("abc",1,1,1,S)'],
  ['string_concat/3', 'string_concat("a","b",S)'],
  ['split_string/4', 'split_string("a b"," ","",L)'],
  ['string_lower/2', 'string_lower("ABC",S)'],
  ['string_upper/2', 'string_upper("abc",S)'],
  ['string_code/3', 'string_code(2,"ab",98)'],
  ['string_codes/2', 'string_codes("ab",Cs)'],
  ['string_length/2', 'string_length("ab",N)'],
  ['sub_atom_icasechk/3', 'sub_atom_icasechk("Hello",1,"el")'],
  ['atom_length/2', 'atom_length(abc,N)'],
  ['text_to_string/2', 'text_to_string([97,98],S)'],
  ['copy_term/2', 'copy_term(f(1),Copy)'],
  ['term_variables/2', 'term_variables(f(X,Y),Vs)'],
  ['arg/3', 'arg(1,f(a),X)'],
  ['=../2', 'f(a) =.. L'],
];

// G4 amendment: each answer gets its own first-occurrence variable numbering.
const alpha = (answer: PlSolution): PlSolution => {
  const ids = new Map<number, number>();
  const displayIds = new Map<string, string>();
  const term = (value: PlTerm): PlTerm => {
    switch (value.kind) {
      case 'variable': {
        let id = ids.get(value.id);
        if (id === undefined) {
          id = ids.size;
          ids.set(value.id, id);
        }
        return { kind: 'variable', id };
      }
      case 'compound':
        return { ...value, args: value.args.map(term) };
      case 'list':
        return { ...value, items: value.items.map(term) };
      case 'improper-list':
        return { ...value, items: value.items.map(term), tail: term(value.tail) };
      case 'dict':
        return {
          ...value,
          entries: Object.fromEntries(
            Object.entries(value.entries).map(([key, item]) => [key, term(item)]),
          ),
        };
      default:
        return value;
    }
  };
  const bindings = Object.fromEntries(
    Object.entries(answer.bindings).map(([key, value]) => [key, term(value)]),
  );
  const display = Object.fromEntries(
    Object.entries(answer.display).map(([key, value]) => [
      key,
      value.replace(/\b_[0-9]+\b/gu, (name) => {
        let normalized = displayIds.get(name);
        if (normalized === undefined) {
          normalized = `_${String(displayIds.size)}`;
          displayIds.set(name, normalized);
        }
        return normalized;
      }),
    ]),
  );
  return { ...answer, bindings, display };
};
const comparable = (response: EngineResponse): unknown => {
  if (response.kind === 'solutions')
    return { kind: response.kind, solutions: response.solutions.map(alpha) };
  return { kind: response.kind };
};

describe('live read-only session', () => {
  it.each(REFUSALS)('G1 refuses %s before running it', async (goal, reason) => {
    // At the red base a refused candidate actually runs; isolate writes and parser errors.
    const target = new EngineSession({
      expected: manifest.contract,
      loadImage: (bytes) => load(bytes)({ printErr: () => undefined }),
    });
    await target.boot(image);
    guard(
      await request(goal, { readonly: true }, target, {
        ...BUDGET_MAX,
        answerCap: 1,
        wallClockMs: 1000,
      }),
      reason,
    );
  });

  it.each(['_123', '_0', '_G123', '_G0'])(
    'G1 refuses renderer-reserved variable %s',
    async (name) => {
      guard(await request(`${name} = 1`), /variable|reserved/iu);
    },
  );

  it.each(['_123x', '_G123x', '_g123', '_G', '__123'])(
    'G1 admits neighboring variable name %s',
    async (name) => {
      expect(
        solutions(await request(`${KB_ANCHOR}, ${name} = 1, X = ${name}`))[0]?.bindings.X,
      ).toEqual({
        kind: 'integer',
        value: 1,
      });
    },
  );

  it('G1 enforces the 2048-code-unit boundary before parsing', async () => {
    const prefix = `${KB_ANCHOR}/*`;
    const room = 2048 - prefix.length - 2;
    const exact = `${prefix}${'a'.repeat(room)}*/`;
    expect(exact.length).toBe(2048);
    expect(solutions(await request(exact))).toHaveLength(1);
    guard(await request(`${exact} `), /2048|length|long|code.unit/iu);
    // Astral glyphs count twice; retain the same exact code-unit boundary.
    const astral = `${prefix}${'😀'.repeat(Math.floor(room / 2))}${'a'.repeat(room % 2)}*/`;
    expect(astral.length).toBe(2048);
    expect(solutions(await request(astral))).toHaveLength(1);
    guard(await request(`${astral} `), /2048|length|long|code.unit/iu);
  });

  it('G1 reports the first refused subgoal in depth-first left-to-right order', async () => {
    guard(await request('(true;once(assertz(first))),atom_concat(a,b,C)'), 'assertz/1');
    guard(await request('atom_concat(a,b,C),(true;once(assertz(second)))'), 'atom_concat/3');
  });

  it('G2 refused writes change neither predicates nor global variables', async () => {
    restore();
    raw('catch(nb_delete(c1_probe),_,true)');
    try {
      const asserted = await request('assertz(probe_c1(1))');
      const stored = await request('nb_setval(c1_probe,1)');
      const state = solutions(
        await request(
          '(current_predicate(probe_c1/1)->Defined=yes;Defined=no),(nb_current(c1_probe,_)->Stored=yes;Stored=no)',
          {},
        ),
      );
      expect.soft(state[0]?.bindings).toMatchObject({
        Defined: { kind: 'atom', value: 'no' },
        Stored: { kind: 'atom', value: 'no' },
      });
      guard(asserted, 'assertz/1');
      guard(stored, 'nb_setval/2');
    } finally {
      restore();
      raw('catch(nb_delete(c1_probe),_,true)');
    }
  });

  it('G2 cap refusal creates no atom and issues no parse query', async () => {
    const oversized = `X = 'c1_cap_${String(process.pid)}_${'z'.repeat(2100)}'`;
    raw('statistics(atoms,N)');
    const before = raw('statistics(atoms,N)').N;
    calls.length = 0;
    const result = await request(oversized);
    const issued = calls.slice();
    const after = raw('statistics(atoms,N)').N;
    expect.soft(after).toEqual(before);
    expect.soft(issued).toEqual([]);
    guard(result, /2048|length|long|code.unit/iu);
  });

  it.each(ADMITTED)(
    'G3 admits %s',
    async (goal) => {
      const result = await request(goal);
      expect(['solutions', 'failure'], JSON.stringify(result)).toContain(result.kind);
      if (goal === ADMITTED[18])
        expect(solutions(result)[0]?.bindings.N).toEqual({ kind: 'integer', value: 12 });
      if (goal === ADMITTED[22]) expect(result.kind).toBe('failure');
    },
    120_000,
  );

  it.each(BUILTINS)('G3 admits the small builtin goal %s', async (_pi, goal) => {
    expect(solutions(await request(`${KB_ANCHOR},${goal}`)).length).toBeGreaterThan(0);
  });

  it.each([...ADMITTED, ...BUILTINS.map(([, goal]) => `${KB_ANCHOR},${goal}`)])(
    'G4 preserves the unflagged result for %s',
    async (goal) => {
      const original = await request(goal, {});
      const readonly = await request(goal);
      expect(['solutions', 'failure']).toContain(original.kind);
      expect(comparable(readonly)).toEqual(comparable(original));
    },
    120_000,
  );

  it.each(QUESTION_IDS)('G4 preserves catalog goal %s', async (id) => {
    const goal = QUESTION_CATALOG[id].goal;
    const original = await request(goal, {});
    const readonly = await request(goal);
    expect(solutions(original).length).toBeGreaterThan(0);
    expect(comparable(readonly)).toEqual(comparable(original));
  });

  // `/* outer /* inner */ outer */` and the full-stop forms: chat-reviewer-1 F1, refused by the
  // first, regex-based trailing-text check while the engine's own reader accepts them.
  it.each([
    '% trailing comment',
    '/* note */',
    '/* outer /* inner */ outer */',
    '. /* outer /* inner */ outer */',
    '/* note */ .',
  ])('G5 executes canonical text rather than the caller comment %s', async (comment) => {
    const bare = await request('clinical_rule(D,S,R)');
    const commented = await request(`clinical_rule(D,S,R) ${comment}`);
    expect(solutions(bare).length).toBeGreaterThan(0);
    expect(comparable(commented)).toEqual(comparable(bare));
  });

  it.each([
    "'it''s'",
    '"string with spaces"',
    "0'a",
    '-1',
    '- 1',
    '{q}',
    '[]',
    "'[]'",
    '3r4',
    '1.5',
    "'$VAR'(1)",
    '(+)',
    '[a,[b,[c]],[]]',
    'pair(A,A)',
    'pair(A,B)',
  ])('G5 runs a canonical variant of data %s', async (literal) => {
    const source = `once(guideline_schema_version(_KbVersion)), X = ${literal}`;
    const canonicalTerm = raw(
      'term_string(T,Source,[variable_names(Vs)]),term_string(T,Canonical,[quoted(true),ignore_ops(true),numbervars(false),variable_names(Vs)])',
      { Source: source },
    ).Canonical;
    if (canonicalTerm?.kind !== 'string') throw new Error('oracle renderer returned no string');
    const canonical = canonicalTerm.value;
    raw('term_string(T,Before),term_string(U,After),T =@= U', { Before: source, After: canonical });
    calls.length = 0;
    const result = await request(source);
    const execution = calls.filter(({ goal }) => goal.includes('call_with_inference_limit'));
    expect(solutions(result)).toHaveLength(1);
    expect(execution, 'one metered execution').toHaveLength(1);
    expect(execution[0]?.goal).toContain(canonical);
  });

  it('G5 performs one parsed canonicalization before executing a read-only goal', async () => {
    calls.length = 0;
    expect(solutions(await request(`${KB_ANCHOR}, X = 1 + 2`))).toHaveLength(1);
    const executedAt = calls.findIndex(({ goal }) => goal.includes('call_with_inference_limit'));
    expect(executedAt).toBeGreaterThanOrEqual(0);
    const parse = calls.slice(0, executedAt).filter(({ goal }) => goal.includes('term_string('));
    expect(parse).toHaveLength(1);
    // Options may be literal or bound; grade their canonical effect, not that choice of syntax.
    expect(calls[executedAt]?.goal).toContain('=(X,+(1,2))');
  });

  it('G6 refusal keeps the same session booted and the next read-only query usable', async () => {
    const refusal = await request('assertz(probe_c1(1))');
    const after = await request('findall(D,guideline_document(D,_,_),Ds),length(Ds,N)');
    try {
      expect(session.booted).toBe(true);
      expect(solutions(after)[0]?.bindings.N).toEqual({
        kind: 'integer',
        value: manifest.contract.documents,
      });
      guard(refusal, 'assertz/1');
    } finally {
      restore();
    }
  });

  it.each(['true', 1, false, null, undefined, 0, {}, []])(
    'G7 rejects malformed posted readonly value %j without running anything',
    async (flag) => {
      const goal = 'assertz(probe_c1_invalid(1))';
      try {
        const result = await request(goal, { readonly: flag });
        const state = solutions(
          await request('(current_predicate(probe_c1_invalid/1)->State=present;State=absent)', {}),
        );
        expect.soft(state[0]?.bindings.State).toEqual({ kind: 'atom', value: 'absent' });
        guard(result, /readonly flag/iu);
        // A goal the allowlist ADMITS, so only the flag check can refuse it (chat-reviewer-1 F2:
        // a dispatcher taking truthy flags passed every case above, because assertz is refused).
        guard(
          await request('once(guideline_schema_version(_))', { readonly: flag }),
          /readonly flag/iu,
        );
      } finally {
        raw('catch(abolish(probe_c1_invalid/1),_,true)');
      }
    },
  );

  it('G7 preserves unflagged assertz behavior', async () => {
    try {
      expect(solutions(await request('assertz(probe_c1_open(1))', {}))).toHaveLength(1);
      expect(solutions(await request('probe_c1_open(X)', {}))[0]?.bindings.X).toEqual({
        kind: 'integer',
        value: 1,
      });
    } finally {
      raw('catch(abolish(probe_c1_open/1),_,true)');
    }
  });
});
