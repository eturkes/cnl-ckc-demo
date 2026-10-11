// The adapter keeps native boot/term wire shapes, then replaces query stepping with a trap.
// Expectations come only from chat-c2 A3/A4; client/session implementation stays unread.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { EngineRequestBody, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const IMAGE = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const { contract } = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const BUDGET = { ...BUDGET_MAX, wallClockMs: 30_000 };
const OOM = 'Could not allocate memory: Out of memory';

const fixture = async (rows: number, lines: string[]) => {
  let armed = false;
  let tripped = false;
  const calls: string[] = [];
  const diagnostics: string[] = [];
  const drained: string[] = [];
  const session = new EngineSession({
    expected: contract,
    drain: () => {
      const pending = diagnostics.splice(0);
      drained.push(...pending);
      return pending;
    },
    loadImage: async (bytes) => {
      calls.push('loadImage');
      const factory = require('swipl-wasm/dist/loadImageDefault.js') as {
        default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
      };
      const engine = await factory.default(bytes)({});
      const writeFile = engine.FS.writeFile.bind(engine.FS);
      engine.FS.writeFile = (...args) => {
        calls.push('writeFile');
        return writeFile(...args);
      };
      const fs = engine.FS as typeof engine.FS & { unlink(path: string): void };
      const unlink = fs.unlink.bind(fs);
      fs.unlink = (path) => {
        calls.push('unlink');
        unlink(path);
      };
      const query = engine.prolog.query.bind(engine.prolog);
      engine.prolog.query = (goal: string, bindings?: Record<string, unknown>) => {
        calls.push('query');
        if (tripped) throw new WebAssembly.RuntimeError('Aborted(probe)');
        const result = query(goal, bindings);
        const close = result.close.bind(result);
        result.close = () => {
          calls.push('close');
          close();
        };
        if (!armed) return result;
        const iterate = result[Symbol.iterator].bind(result);
        result[Symbol.iterator] = () => {
          const iterator = iterate();
          let yielded = 0;
          return {
            next: () => {
              calls.push('next');
              if (yielded === rows) {
                tripped = true;
                diagnostics.push(...lines);
                throw new WebAssembly.RuntimeError('Aborted(probe)');
              }
              yielded += 1;
              return iterator.next();
            },
          } as ReturnType<typeof iterate>;
        };
        return result;
      };
      return engine;
    },
  });
  expect(await session.boot(IMAGE)).toEqual(contract);
  armed = true;
  const abort = (partials: EngineResponse[] = []) =>
    session.handle(
      { id: 'abort', kind: 'query', goal: 'between(1,3,X).', budget: BUDGET },
      IMAGE,
      (partial) => partials.push(partial),
    );
  return { session, abort, calls, diagnostics, drained };
};

const LATER: readonly EngineRequestBody[] = [
  { kind: 'query', goal: 'true.', budget: BUDGET },
  { kind: 'proof', input: { constrainedGoal: 'guideline_schema_version(1).' }, budget: BUDGET },
  { kind: 'consult', source: 'abort_probe.' },
  { kind: 'boot' },
];

const permutations = <T>(items: readonly T[]): T[][] =>
  items.length === 0
    ? [[]]
    : items.flatMap((item, index) =>
        permutations(items.filter((_, other) => other !== index)).map((tail) => [item, ...tail]),
      );

describe('aborted session terminal state', () => {
  it('A3 distinguishes a runtime trap with no diagnostic from a Prolog error', async () => {
    const { abort, diagnostics } = await fixture(0, []);
    expect(await abort()).toMatchObject({
      id: 'abort',
      kind: 'error',
      error: { code: 'aborted' },
    });
    expect(diagnostics).toEqual([]);
  });

  it('A3 retains both streamed solutions when the trap drains Out of memory', async () => {
    const { abort, drained, diagnostics } = await fixture(2, [OOM]);
    const partials: EngineResponse[] = [];
    const response = await abort(partials);
    const solutions = partials.flatMap((part) => (part.kind === 'partial' ? [part.solution] : []));
    expect(solutions.map((solution) => solution.display.X)).toEqual(['1', '2']);
    expect.soft(response).toEqual({ id: 'abort', kind: 'limit', limit: 'heap', solutions });
    expect.soft(drained).toContain(OOM);
    expect.soft(diagnostics).toEqual([]);
  });

  it('A3 drains a non-memory diagnostic but still classifies the trap as aborted', async () => {
    const line = 'probe: unreachable instruction';
    const { abort, drained } = await fixture(0, [line]);
    expect.soft(await abort()).toMatchObject({ kind: 'error', error: { code: 'aborted' } });
    expect.soft(drained).toContain(line);
  });

  it.each([
    ['without memory diagnostic', []],
    ['with memory diagnostic', [OOM]],
  ] as const)('A4 rejects query, proof, consult and boot after abort %s', async (_, lines) => {
    const { session, abort, calls } = await fixture(0, [...lines]);
    await abort();
    const before = [...calls];
    const responses = [];
    for (const request of LATER) {
      responses.push(await session.handle({ ...request, id: request.kind }, IMAGE));
    }
    expect
      .soft(responses)
      .toMatchObject(
        LATER.map(({ kind }) => ({ id: kind, kind: 'error', error: { code: 'aborted' } })),
      );
    expect.soft(session.booted).toBe(false);
    expect.soft(calls).toEqual(before);
  });

  it('A4 preserves the aborted invariant under every later-request permutation and repetition', async () => {
    const { session, abort, calls } = await fixture(0, []);
    await abort();
    const before = [...calls];
    const orders = permutations(LATER);
    expect(orders).toHaveLength(24);
    for (const order of orders) {
      for (const request of [...order, ...order]) {
        const response = await session.handle({ ...request, id: request.kind }, IMAGE);
        expect(response, order.map(({ kind }) => kind).join(' → ')).toMatchObject({
          id: request.kind,
          kind: 'error',
          error: { code: 'aborted' },
        });
        expect(session.booted).toBe(false);
        expect(calls).toEqual(before);
      }
    }
  });
});
