// chat-c1 G9 + destructive G1 cases; one real session for the whole admitted battery.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import type { BudgetSpec, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const manifest = JSON.parse(
  readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
) as {
  contract: { schemaVersion: number; documents: number };
};
// src/demo/DemoController.svelte.ts DEMO_BUDGET, restated for the node-only engine harness.
const DEMO_BUDGET: BudgetSpec = {
  stackBytes: 67108864,
  depth: 100000,
  inferences: 5000000,
  wallClockMs: 5000,
  answerCap: 32,
};
const DOCUMENTS = 'findall(D,guideline_document(D,_,_,_),Ds),length(Ds,N)';
// The control's untouched reservation shrinks the time to its real abort. The shared battery
// engine boots WITHOUT it: under a ~100 MB heap the battery's own retained stacks exhausted malloc,
// `split_string/4` aborted the runtime mid-battery and the next case hung in it — a harness
// state no browser session reaches, and c2's recovery is the bound on a real abort.
const RESERVE_BYTES = 1700 * 1024 * 1024;
type Reservable = Engine & { _malloc(bytes: number): number };
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Reservable>)
  | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Reservable> };
const load = typeof factory === 'function' ? factory : factory.default;
const loader =
  (protectExit: boolean, reserve: boolean): ImageLoader =>
  async (bytes) => {
    const engine = await load(bytes)({
      printErr: () => undefined,
      // Only halt's red witness intercepts exit; the budget battery keeps the default runtime.
      ...(protectExit
        ? {
            quit: (_status: number, error: unknown) => {
              throw error;
            },
          }
        : {}),
    });
    if (reserve && engine._malloc(RESERVE_BYTES) === 0) {
      throw new Error('heap reservation refused');
    }
    return engine;
  };
const boot = async (protectExit = false, reserve = false): Promise<EngineSession> => {
  const session = new EngineSession({
    loadImage: loader(protectExit, reserve),
    expected: manifest.contract,
  });
  await session.boot(image);
  return session;
};
let sequence = 0;
const run = (session: EngineSession, goal: string, readonly = true): Promise<EngineResponse> =>
  session.handle(
    {
      id: `stress-${String(++sequence)}`,
      kind: 'query',
      goal,
      budget: DEMO_BUDGET,
      ...(readonly ? { readonly: true } : {}),
    },
    new Uint8Array(),
  );
const double = (
  predicate: 'atom_concat' | 'string_concat',
  seed: string,
  steps: number,
): string => {
  const terms = [`S0 = ${seed}`];
  for (let index = 0; index < steps; index += 1)
    terms.push(`${predicate}(S${String(index)},S${String(index)},S${String(index + 1)})`);
  return terms.join(',');
};
const atomChain = `${double('atom_concat', 'ab', 32)},atom_length(S32,N)`;
const STRESS: [string, string][] = [
  [
    'findall 200 four-million-cell lists',
    'findall(L,(between(1,200,_),length(L,4000000)),Ls),length(Ls,N)',
  ],
  ['unbounded length enumeration', 'length(L,N), N > 100000000'],
  ['unbounded between failure', 'between(1,inf,N),fail'],
  ['32 string doublings', `${double('string_concat', '"ab"', 32)},string_length(S32,N)`],
  ['billionth exponent', 'X is 7**(10**9)'],
  [
    'copy three-million-cell list 100 times',
    'length(L,3000000),findall(C,(between(1,100,_),copy_term(L,C)),Cs)',
  ],
  ['msort three million integers', 'findall(X,between(1,3000000,X),L),msort(L,M),length(M,N)'],
  [
    'sort/4 three million compounds',
    'findall(k(X),between(1,3000000,X),L),sort(1,@>=,L,M),length(M,N)',
  ],
  [
    'string_codes doubled string',
    `${double('string_concat', '"abcd"', 22)},string_codes(S22,Cs),length(Cs,N)`,
  ],
  ['string_upper doubled string', `${double('string_concat', '"abcd"', 23)},string_upper(S23,U)`],
  [
    'split_string doubled string',
    `${double('string_concat', '"a b "', 22)},split_string(S22," ","",Parts),length(Parts,N)`,
  ],
  [
    'text_to_string doubled-string codes',
    `${double('string_concat', '"abcd"', 22)},string_codes(S22,Cs),text_to_string(Cs,S),string_length(S,N)`,
  ],
  [
    'sub_string enumeration',
    `${double('string_concat', '"abcd"', 12)},sub_string(S12,B,L,A,Sub),fail`,
  ],
  ['cyclic term', 'X = f(X)'],
  ['$append enumeration', "'$append'(X,Y,Z),fail"],
];
let shared: EngineSession;
beforeAll(async () => {
  shared = await boot();
}, 120_000);

const alive = (response: EngineResponse): void => {
  expect(response.kind, JSON.stringify(response).slice(0, 240)).toBe('solutions');
  if (response.kind !== 'solutions') throw new Error('engine did not answer document probe');
  expect(response.solutions).toHaveLength(1);
  expect(response.solutions[0]?.bindings.N).toEqual({
    kind: 'integer',
    value: manifest.contract.documents,
  });
};

describe('read-only budget battery', () => {
  it.each(STRESS)(
    'G9 %s ends without aborting the shared engine',
    async (_name, stress) => {
      const goal = `once(guideline_schema_version(_)),${stress}`;
      expect(goal.length).toBeLessThanOrEqual(2048);
      const outcome = await run(shared, goal);
      const after = await run(shared, DOCUMENTS);
      expect.soft(['limit', 'failure', 'error']).toContain(outcome.kind);
      if (outcome.kind === 'error') expect.soft(outcome.error.code).not.toBe('guard');
      alive(after);
      expect(shared.booted).toBe(true);
    },
    120_000,
  );

  it('G9 control unflagged atom doubling reports a runtime abort', async () => {
    const control = await boot(false, true);
    const outcome = await run(control, atomChain, false);
    const aborted =
      (outcome.kind === 'error' &&
        (/^Aborted\(\)/u.test(outcome.error.message) ||
          ['aborted'].includes(outcome.error.code))) ||
      (outcome.kind === 'limit' && outcome.limit === 'heap');
    expect(aborted, JSON.stringify(outcome).slice(0, 240)).toBe(true);
  }, 120_000);

  it('G1 refuses 32 atom doublings before they kill the engine', async () => {
    const target = await boot();
    const outcome = await run(target, atomChain);
    expect(outcome).toMatchObject({ kind: 'error', error: { code: 'guard' } });
    if (outcome.kind !== 'error') throw new Error('guard refusal missing');
    expect(outcome.error.message).toMatch(/^read-only query refused: /u);
    expect(outcome.error.message).toContain('atom_concat/3');
    alive(await run(target, DOCUMENTS));
  }, 120_000);

  it('G1 refuses halt before stopping its engine', async () => {
    const target = await boot(true);
    const outcome = await run(target, 'halt');
    expect(outcome).toMatchObject({ kind: 'error', error: { code: 'guard' } });
    if (outcome.kind !== 'error') throw new Error('guard refusal missing');
    expect(outcome.error.message).toMatch(/^read-only query refused: /u);
    expect(outcome.error.message).toContain('halt/0');
    alive(await run(target, DOCUMENTS));
  }, 120_000);
});
