// Live contract for the engine session, driven against the real generated image.
//
// Node has no DOM `Worker`, so the test drives `EngineSession` directly — the same
// object `worker.ts` wraps. Boot costs ~121-335 ms and the category-A goal ~131-220 ms,
// so one engine is shared across the file.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { BudgetSpec, PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import {
  createEncoder,
  decodeOnce,
  decodeTerm,
  DecodeError,
  type PlTerm,
} from '../src/engine/terms.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');

/** Fails rather than skips when the payload is missing; `pnpm kb:build` produces it. */
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));

const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

/** The compiled goal lives outside the image, so the test supplies it like the app will. */
const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';

/** Roomy enough that no u2 case trips a limit; u3's own suite drives the trip points. */
const BUDGET: BudgetSpec = BUDGET_MAX;

/** Unwraps the solutions a u2 case expects, so a limit or a cancel fails loudly here. */
const solveOk = async (goal: string): Promise<PlSolution[]> => {
  const solved = await session.solve(goal, BUDGET);
  if (solved.kind !== 'solutions') throw new Error(`expected solutions, got ${solved.kind}`);
  return solved.solutions;
};

let session: EngineSession;
let engine: Engine;

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readGenerated('kb.pvm')));
  // `solve` needs the booted engine; reuse the same one for term probes.
  engine = await loadImage(new Uint8Array(readGenerated('kb.pvm')));
}, 120_000);

/** Binds `X` in a one-solution goal; `decodeOnce` already returns decoded terms. */
const termOf = (goal: string): PlTerm => {
  const result = decodeOnce(engine.prolog.query(goal).once());
  if (result.kind !== 'bindings') throw new Error(`goal did not bind: ${goal}`);
  const term = result.bindings.X;
  if (term === undefined) throw new Error(`goal bound no X: ${goal}`);
  return term;
};

/** Re-encodes a decoded term and asks Prolog whether the result is a structural variant. */
const roundTrips = (goal: string): boolean => {
  const encode = createEncoder(engine.prolog);
  const check = decodeOnce(
    engine.prolog
      .query('T =@= Round.', { T: encode(termOf(goal)), Round: encode(termOf(goal)) })
      .once(),
  );
  return check.kind === 'bindings';
};

describe('P1 boot and live contract', () => {
  it('P1.3 reads schema and document count out of the engine', () => {
    expect(manifest.contract).toEqual({ schemaVersion: 1, documents: 337 });
  });

  it('P1.3 agrees with the manifest the build wrote', async () => {
    const contract = await session.boot(new Uint8Array(readGenerated('kb.pvm')));
    expect(contract).toEqual(manifest.contract);
  });

  it('P1.5 reuses one engine rather than re-booting', async () => {
    expect(session.booted).toBe(true);
    const again = await session.boot(new Uint8Array(0));
    expect(again).toEqual(manifest.contract);
  });

  it('P1.3 fails typed when the engine disagrees with the manifest', async () => {
    const wrong = new EngineSession({
      loadImage,
      expected: { schemaVersion: 1, documents: 336 },
    });
    const response = await wrong.handle(
      { id: 'x', kind: 'boot' },
      new Uint8Array(readGenerated('kb.pvm')),
    );
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('contract');
  });
});

describe('P5 real goals through the shipped surface', () => {
  it('P5.2 returns the seven category-A solutions', async () => {
    const solutions = await solveOk(CATEGORY_A_GOAL);
    expect(solutions).toHaveLength(7);
    const ids = solutions.map((s) => {
      const a = s.bindings.A;
      return a?.kind === 'compound' && a.args[1]?.kind === 'atom' ? a.args[1].value : 'missing';
    });
    expect(ids).toEqual([
      'cdc2022-opioid-rec02',
      'cdc2022-opioid-rec03',
      'cdc2022-opioid-rec04',
      'cdc2022-opioid-rec06',
      'cdc2022-opioid-rec07',
      'cdc2022-opioid-rec08',
      'cdc2022-opioid-rec12',
    ]);
  });

  it('P3.8 round-trips the real answer shape with five arguments', async () => {
    const solutions = await solveOk(CATEGORY_A_GOAL);
    const first = solutions[0]?.bindings.A;
    expect(first?.kind).toBe('compound');
    if (first?.kind !== 'compound') return;
    expect(first.functor).toBe('$guideline_id');
    expect(first.args).toHaveLength(5);
    expect(first.args[3]).toEqual({
      kind: 'compound',
      functor: 'ref',
      args: [{ kind: 'integer', value: 1 }],
    });
    expect(first.args[4]).toEqual({ kind: 'list', items: [] });
  });

  it('P4.1 renders display text that re-reads as the same term', async () => {
    const solutions = await solveOk(CATEGORY_A_GOAL);
    const display = solutions[0]?.display.A ?? '';
    expect(display).toContain("'$guideline_id'");
    expect(display).toContain("'cdc2022-opioid-rec02'");
    const reread = decodeOnce(engine.prolog.query('term_string(T,S).', { S: display }).once());
    expect(reread.kind).toBe('bindings');
  });

  it('P2.3 reports a failing goal as failure, not as an empty success', async () => {
    const solved = await session.solve('guideline_document(no_such_document,_,_).', BUDGET);
    expect(solved.kind).toBe('failure');
  });

  it('P2.3 settles a malformed goal as a typed error', async () => {
    const response = await session.handle(
      { id: 'q1', kind: 'query', goal: 'guideline_document(', budget: BUDGET },
      new Uint8Array(0),
    );
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('prolog');
  });

  it('P2.2 echoes the request id on every response', async () => {
    const response = await session.handle(
      { id: 'echo-me', kind: 'query', goal: CATEGORY_A_GOAL, budget: BUDGET },
      new Uint8Array(0),
    );
    expect(response.id).toBe('echo-me');
  });
});

describe('P3 decode traps', () => {
  it('P3.2 keeps compound arity distinct from a single list argument', () => {
    expect(roundTrips('X = foo(bar,7).')).toBe(true);
    const two = termOf('X = foo(bar,7).');
    const one = termOf('X = foo([bar,7]).');
    expect(two).toEqual({
      kind: 'compound',
      functor: 'foo',
      args: [
        { kind: 'atom', value: 'bar' },
        { kind: 'integer', value: 7 },
      ],
    });
    expect(one).toEqual({
      kind: 'compound',
      functor: 'foo',
      args: [
        {
          kind: 'list',
          items: [
            { kind: 'atom', value: 'bar' },
            { kind: 'integer', value: 7 },
          ],
        },
      ],
    });
    expect(two).not.toEqual(one);
  });

  it('P3.3 keeps a rational oriented', () => {
    expect(termOf('X is 1 rdiv 3.')).toEqual({
      kind: 'rational',
      numerator: 1,
      denominator: 3,
    });
  });

  it('P3.3 reduces 3r1 to the integer 3', () => {
    expect(termOf('X is 3 rdiv 1.')).toEqual({ kind: 'integer', value: 3 });
  });

  it('P3.4 distinguishes an atom from a string with identical text', () => {
    expect(termOf('X = hello.')).toEqual({ kind: 'atom', value: 'hello' });
    expect(termOf('X = "hello".')).toEqual({ kind: 'string', value: 'hello' });
  });

  it('P3.5 keeps an integer above 2^53 exact', () => {
    const decoded = termOf('X is 123456789012345678901234567890.');
    expect(decoded).toEqual({ kind: 'integer', value: 123456789012345678901234567890n });
  });

  it('P3.6 decodes an unbound variable explicitly', () => {
    const decoded = termOf('X = _.');
    expect(decoded.kind).toBe('variable');
  });

  it('P3.1 decodes the empty list and an improper list', () => {
    expect(termOf('X = [].')).toEqual({ kind: 'list', items: [] });
    const improper = termOf('X = [a|b].');
    expect(improper.kind).toBe('improper-list');
  });

  it('P3.11 fails closed on a value it does not recognize', () => {
    expect(() => decodeTerm(Symbol('nope'))).toThrow(DecodeError);
    expect(() => decodeTerm({ $t: 'unheard-of' })).toThrow(DecodeError);
    // A dict's own tag may be any atom, so an unrecognized `$t` wrapper that also
    // carries `$tag` must fail closed rather than decode as a dict (M1 review E18).
    expect(() => decodeTerm({ $t: 'unheard-of', $tag: 'point' })).toThrow(DecodeError);
    expect(() => decodeTerm(Number.POSITIVE_INFINITY)).toThrow(DecodeError);
  });

  it('P3.7 round-trips every documented shape through re-encoding', () => {
    for (const goal of [
      'X = foo(bar,7).',
      'X = [a,b,c].',
      'X = [a|b].',
      "X = '$guideline_id'(product,'cdc2022-opioid-rec02',1,ref(1),[]).",
      'X = f(A,A).',
      'X is 1 rdiv 3.',
      'X = "text".',
    ]) {
      expect(roundTrips(goal), goal).toBe(true);
    }
  });
});

describe('P2 protocol shape', () => {
  it('P2.1 sends only structured-clone-safe payloads', async () => {
    const response = await session.handle(
      { id: 'clone', kind: 'query', goal: CATEGORY_A_GOAL, budget: BUDGET },
      new Uint8Array(0),
    );
    expect(structuredClone(response)).toEqual(response);
  });
});

// M1 review E27: the Q-corpus shapes the committed suite never drove, plus the two
// defects the census exposed — a boot that loads the image twice under concurrency
// (E05) and a shared variable that re-enters as two (E16).
describe('Q corpus census', () => {
  it('E27 decodes negative and zero integers', () => {
    expect(termOf('X is -7.')).toEqual({ kind: 'integer', value: -7 });
    expect(termOf('X is 0.')).toEqual({ kind: 'integer', value: 0 });
  });

  it('E27 decodes a genuine float', () => {
    expect(termOf('X is 0.5.')).toEqual({ kind: 'float', value: 0.5 });
  });

  it('E27 decodes a variable shared across two arguments as one variable', () => {
    const shared = termOf('X = f(A,A).');
    expect(shared.kind).toBe('compound');
    if (shared.kind !== 'compound') return;
    const [left, right] = shared.args;
    expect(left?.kind).toBe('variable');
    expect(right?.kind).toBe('variable');
    if (left?.kind !== 'variable' || right?.kind !== 'variable') return;
    expect(left.id).toBe(right.id);
    // Negative control: two distinct variables must not collapse into one id.
    const distinct = termOf('X = f(A,B).');
    if (distinct.kind !== 'compound') return;
    const [a, b] = distinct.args;
    if (a?.kind !== 'variable' || b?.kind !== 'variable') return;
    expect(a.id).not.toBe(b.id);
  });

  it('E27 decodes hyphenated, empty and quoted atoms as atoms', () => {
    expect(termOf("X = 'category-B-recommendation'.")).toEqual({
      kind: 'atom',
      value: 'category-B-recommendation',
    });
    expect(termOf("X = ''.")).toEqual({ kind: 'atom', value: '' });
    expect(termOf("X = 'has space'.")).toEqual({ kind: 'atom', value: 'has space' });
  });

  it('E27 decodes an operator term as its compound, not as text', () => {
    expect(termOf('X = (1+2).')).toEqual({
      kind: 'compound',
      functor: '+',
      args: [
        { kind: 'integer', value: 1 },
        { kind: 'integer', value: 2 },
      ],
    });
  });

  it('E27 decodes deep nesting to its full depth', () => {
    let term = termOf('X = f(g(h(i(j(k(1)))))).');
    for (const functor of ['f', 'g', 'h', 'i', 'j', 'k']) {
      expect(term.kind).toBe('compound');
      if (term.kind !== 'compound') return;
      expect(term.functor).toBe(functor);
      const [next] = term.args;
      if (next === undefined) throw new Error(`${functor} lost its argument`);
      term = next;
    }
    expect(term).toEqual({ kind: 'integer', value: 1 });
  });

  it('E16 re-enters a shared variable as one variable, not two', () => {
    const encode = createEncoder(engine.prolog);
    const variant = (goal: string): boolean =>
      decodeOnce(engine.prolog.query('T =@= f(A,A).', { T: encode(termOf(goal)) }).once()).kind ===
      'bindings';
    // The wrapper shares variables by name within one conversion, so an unnamed
    // `Var` splits `f(A,A)` into `f(_,_)` — which is still a variant of itself, and
    // is why comparing two decodes of the same term could not catch it.
    expect(variant('X = f(A,A).')).toBe(true);
    expect(variant('X = f(A,B).')).toBe(false);
  });

  it('E05 loads the image once when two boots race', async () => {
    let loads = 0;
    const counting = new EngineSession({
      loadImage: async (bytes) => {
        loads += 1;
        return loadImage(bytes);
      },
      expected: manifest.contract,
    });
    const pvm = new Uint8Array(readGenerated('kb.pvm'));
    const [first, second] = await Promise.all([counting.boot(pvm), counting.boot(pvm)]);
    expect(first).toEqual(manifest.contract);
    expect(second).toEqual(manifest.contract);
    expect(loads).toBe(1);
  }, 120_000);

  it('E27 settles a request typed when boot failed before it', async () => {
    const broken = new EngineSession({
      loadImage: () => Promise.reject(new Error('image unavailable')),
      expected: manifest.contract,
    });
    const bootResponse = await broken.handle({ id: 'b1', kind: 'boot' }, new Uint8Array(0));
    expect(bootResponse).toMatchObject({ id: 'b1', kind: 'error', error: { code: 'boot' } });
    const queryResponse = await broken.handle(
      { id: 'q1', kind: 'query', goal: CATEGORY_A_GOAL, budget: BUDGET },
      new Uint8Array(0),
    );
    expect(queryResponse.kind).toBe('error');
    expect(queryResponse.id).toBe('q1');
  });

  it('E27 settles a request issued before boot completes, without hanging it', async () => {
    const late = new EngineSession({ loadImage, expected: manifest.contract });
    const pvm = new Uint8Array(readGenerated('kb.pvm'));
    const booting = late.handle({ id: 'boot-1', kind: 'boot' }, pvm);
    const early = late.handle(
      { id: 'query-1', kind: 'query', goal: CATEGORY_A_GOAL, budget: BUDGET },
      pvm,
    );
    const [bootResponse, earlyResponse] = await Promise.all([booting, early]);
    expect(bootResponse).toMatchObject({ id: 'boot-1', kind: 'booted' });
    expect(earlyResponse).toMatchObject({ id: 'query-1', kind: 'error' });
  }, 120_000);

  it('E27 answers two correlated requests with their own ids', async () => {
    const [first, second] = await Promise.all([
      session.handle(
        { id: 'first', kind: 'query', goal: 'true.', budget: BUDGET },
        new Uint8Array(0),
      ),
      session.handle(
        { id: 'second', kind: 'query', goal: 'guideline_document(D,_,_).', budget: BUDGET },
        new Uint8Array(0),
      ),
    ]);
    expect(first.id).toBe('first');
    expect(second.id).toBe('second');
    expect(first.kind).not.toBe('error');
    expect(second.kind).not.toBe('error');
  }, 120_000);
});
