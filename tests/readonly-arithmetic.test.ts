// n34: a read-only goal's arithmetic runs through bounded twins compiled into the image
// (`tools/kb/readonly-arithmetic.mjs`). A1: the rewrite touches the goal positions
// `src/engine/readonly.ts` CONTROL names and nothing else, so a term in a data position stays the
// term the model wrote. A2: where a twin returns a value it is `is/2`'s value; elsewhere it
// raises — never a different value. A3: no expression holds a twin for long.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import { CONTROL } from '../src/engine/readonly.js';
import type { Engine } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;

let engine: Engine;
beforeAll(async () => {
  const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
  engine = await load(image)({ printErr: () => undefined });
}, 120_000);

/** One solution's bindings as text, or the query's own error message. */
const ask = (goal: string, bindings: Record<string, string> = {}): Record<string, unknown> =>
  engine.prolog.query(goal, bindings).once() as Record<string, unknown>;

/** `'$ro_rewrite'/2` over `text`, rendered back canonically. */
const rewritten = (text: string): unknown =>
  ask(
    "term_string(T,S,[variable_names(Vs)]),'$ro_rewrite'(T,R)," +
      'with_output_to(atom(C),write_term(R,[quoted(true),ignore_ops(true),variable_names(Vs)]))',
    { S: text },
  ).C;

/** The 1-based argument slots of `text` its rewrite turned into `'$ro_is'/2`, and those it kept identical. */
const slots = (text: string): { rewritten: unknown; kept: unknown } => {
  const result = ask(
    "term_string(T,S),'$ro_rewrite'(T,R),functor(T,F,A),functor(R,F,A)," +
      "findall(I,(between(1,A,I),arg(I,R,X),X = '$ro_is'(_,_)),W)," +
      'findall(I,(between(1,A,I),arg(I,R,X),arg(I,T,Y),X == Y),K)',
    { S: text },
  );
  return { rewritten: result.W, kept: result.K };
};

describe('read-only arithmetic', () => {
  it('A1 rewrites the goal positions CONTROL names, and nothing in a data position', () => {
    expect(CONTROL.size).toBeGreaterThan(10);
    for (const [indicator, goals] of CONTROL) {
      const [name = '', arity = '0'] = indicator.split(/\/(?=\d+$)/u);
      const all = Array.from({ length: Number(arity) }, (_, index) => index);
      const args = all.map((index) => `X${String(index)} is ${String(index)}`).join(',');
      const quoted = name.replaceAll('\\', '\\\\').replaceAll("'", "''");
      expect(slots(`'${quoted}'(${args})`), indicator).toEqual({
        rewritten: goals.map((index) => index + 1),
        kept: all.filter((index) => !goals.includes(index)).map((index) => index + 1),
      });
    }
    // Outside CONTROL nothing is entered: data, and goals the guard refuses anyway.
    for (const text of ['X = (Y is 1)', 'X = [Y is 1]', 'call(Y is 1)', 'catch(Y is 1,_,true)']) {
      expect(
        ask("term_string(T,S),'$ro_rewrite'(T,R),(R == T -> Same = yes ; Same = no)", { S: text })
          .Same,
        text,
      ).toBe('yes');
    }
    expect(rewritten('findall(X,(Y is 1,X < Y),L)')).toBe(
      "findall(X,','('$ro_is'(Y,1),'$ro_compare'(<(X,Y))),L)",
    );
    expect(rewritten('guideline_product(exactly,2,exactly,3,S,N)')).toBe(
      "'$ro_builtin'(guideline_product(exactly,2,exactly,3,S,N))",
    );
    expect(rewritten('guideline_document(D,A,B,C)')).toBe('guideline_document(D,A,B,C)');
  });

  // Each expression through `is/2` and through its twin: a twin's value must be `is/2`'s.
  const ADMITTED = [
    '1+2',
    '7-10',
    '6*7',
    '7/2',
    '7//2',
    '-7//2',
    '7 mod 3',
    '-7 mod 3',
    '7 rem -3',
    '7 div -2',
    'min(3,4.0)',
    'max(2,2.5)',
    'abs(-5)',
    'sign(-2.5)',
    '-(3)',
    '+(3)',
    'gcd(12,18)',
    'msb(1000)',
    'sqrt(2)',
    'exp(1)',
    'log(10)',
    '2**10',
    '2^10',
    '2**0.5',
    '2** -1',
    '2**61',
    '3**38',
    'float(3)',
    'integer(2.5)',
    'truncate(-2.7)',
    'round(2.5)',
    'ceiling(2.1)',
    'floor(-2.1)',
    '1<<10',
    '1024>>3',
    'pi',
    'e',
    '20221229-20220101',
    '20221229*2',
    '3*1.5',
    '10/4',
    '4/2',
    '4611686018427387903+0',
    '2147483647*2147483647',
  ];
  const BEYOND = [
    '2**62',
    '3**40',
    '4611686018427387904',
    '4611686018427387903+1',
    '3037000500*3037000500',
    '1<<62',
    'integer(1.0e300)',
    '3r4+1',
  ];
  /** Both results as atoms: the value's canonical text, or `error`. */
  const twin = (expression: string) =>
    ask(
      'term_string(E,S),' +
        '(catch(X is E,_,fail) -> term_to_atom(X,N) ; N = error),' +
        "(catch('$ro_is'(Y,E),_,fail) -> term_to_atom(Y,T) ; T = error)",
      { S: expression },
    ) as { N?: unknown; T?: unknown };

  it('A2 a twin admits KB-sized arithmetic and returns exactly what is/2 returns', () => {
    for (const expression of ADMITTED) {
      const { N, T } = twin(expression);
      expect(T, expression).toBe(N);
    }
    for (const expression of BEYOND) {
      const { N, T } = twin(expression);
      expect(N, expression).not.toBe('error');
      expect(T, expression).toBe('error');
    }
  });

  it('A3 an expression a twin refuses or cannot read raises at once, and never runs long', () => {
    const HOSTILE = [
      '7**29582',
      '1<<100000',
      '1>> -10000',
      'truncate(1.0e300)',
      '2.0**1e9',
      '"a"',
      '[97]',
      'cputime',
      'random(5)',
      'foo+1',
      'X+1',
    ];
    for (const expression of HOSTILE) {
      const started = performance.now();
      const result = ask(
        "term_string(E,S),catch('$ro_is'(_,E),Error,true),(var(Error) -> R = value ; R = raised)",
        { S: expression },
      );
      expect(result.R, expression).toBe('raised');
      expect(performance.now() - started, expression).toBeLessThan(1000);
    }
    expect(
      ask("catch('$ro_is'(_,7**29582),error(resource_error(read_only_arithmetic),_),R = refused)")
        .R,
    ).toBe('refused');
  });
});
