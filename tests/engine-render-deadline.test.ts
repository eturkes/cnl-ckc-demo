// m1u3 P3.3: the deadline bounds display rendering, which runs after the query closes. A real
// engine renders every display; the clock advances only when a display returns, so each case
// reads exactly how many displays ran past the deadline.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type SolveResult } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const budget = { ...BUDGET_MAX, wallClockMs: 10, answerCap: 1000 };

let virtualNow = 0;
let advance = 0;
let displays = 0;
let session: EngineSession;

beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  session = new EngineSession({
    expected: manifest.contract,
    loadImage: async (bytes) => {
      const engine = await load(bytes)({});
      const query = engine.prolog.query.bind(engine.prolog);
      // Only the display query advances the clock: `term_string/3` with the display options.
      const prolog = new Proxy(engine.prolog, {
        get(target, property, receiver) {
          if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
          return (goal: string, bindings?: Record<string, unknown>) => {
            const result = query(goal, bindings);
            if (!goal.includes('term_string') || !goal.includes('quoted(true)')) return result;
            return new Proxy(result, {
              get(inner, member, innerReceiver) {
                if (member !== 'once') return Reflect.get(inner, member, innerReceiver) as unknown;
                return () => {
                  const value = result.once();
                  displays += 1;
                  virtualNow += advance;
                  return value;
                };
              },
            });
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

const at = (advanceMs: number): void => {
  virtualNow = 0;
  displays = 0;
  advance = advanceMs;
  const epoch = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => epoch + virtualNow);
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** The settled result as the shipped client sees it, through a scripted worker. */
const throughClient = async (result: SolveResult): Promise<{ limit?: string; workers: number }> => {
  const workers: { terminated: boolean }[] = [];
  const client = new EngineClient({
    spawn: () => {
      const listeners: ((event: { data: EngineResponse }) => void)[] = [];
      const worker = {
        terminated: false,
        addEventListener: (type: string, listener: (event: { data: EngineResponse }) => void) => {
          if (type === 'message') listeners.push(listener);
        },
        terminate: () => {
          worker.terminated = true;
        },
        postMessage: (request: EngineRequest) => {
          queueMicrotask(() => {
            const data = (
              request.kind === 'query'
                ? { id: request.id, ...result }
                : { id: request.id, kind: 'booted', contract: manifest.contract }
            ) as EngineResponse;
            for (const listener of listeners) listener({ data });
          });
        },
      };
      workers.push(worker);
      return worker as unknown as Worker;
    },
    schedule: () => 1,
    cancelSchedule: () => undefined,
  });
  try {
    const outcome = await client.query('true.', budget);
    return {
      ...(outcome.kind === 'limit' ? { limit: outcome.limit } : {}),
      workers: workers.length,
    };
  } finally {
    client.dispose();
  }
};

describe('display rendering under the request deadline', () => {
  it('renders every display inside the deadline', async () => {
    at(2);
    const outcome = await session.solve('X=one,Y=two,Z=three.', budget);
    expect(outcome.kind).toBe('solutions');
    expect(displays).toBe(3);
  });

  it('stops at the first display that ends past the deadline', async () => {
    at(20);
    const outcome = await session.solve('X=one,Y=two,Z=three.', budget);
    expect(displays).toBe(1);
    expect(outcome).toEqual({ kind: 'limit', limit: 'wall-clock', solutions: [] });
  });

  it('keeps a heap stop, which recreates the worker, when rendering also runs late', async () => {
    at(20);
    const result = await session.solve(
      '(X=shown;throw(error(resource_error(memory),probe))).',
      budget,
    );
    expect(result).toMatchObject({ kind: 'limit', limit: 'heap' });
    expect(await throughClient(result)).toEqual({ limit: 'heap', workers: 2 });
  });

  it('bounds proof rendering by the same deadline', async () => {
    at(2);
    expect(
      (await session.prove({ constrainedGoal: 'guideline_schema_version(1).' }, budget)).kind,
    ).toBe('proof');
    at(20);
    // Another goal: the arm above cached its proof, and a cache hit renders nothing.
    expect(
      await session.prove({ constrainedGoal: 'guideline_schema_version(_).' }, budget),
    ).toEqual({
      kind: 'limit',
      limit: 'wall-clock',
    });
  });
});
