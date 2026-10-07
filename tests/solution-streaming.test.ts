// d17 solution streaming: each solution leaves the session the moment its display is rendered,
// the inference meter never pays for that rendering, a late display is never streamed, and a
// cancel queued during a synchronous step still waits for that step.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineError,
  EngineRequest,
  EngineResponse,
  PlSolution,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const { contract } = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: EngineContract;
};
const TIMEOUT = 120_000;
const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({});
};

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: contract });
  await session.boot(image);
}, TIMEOUT);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session streaming', () => {
  it('streams every solution, rendered, in order, before the run settles', async () => {
    const streamed: PlSolution[] = [];
    let settled = false;
    const result = await session.solve('between(1,4,X).', budget(), 's1', (solution) => {
      expect(settled).toBe(false);
      streamed.push(solution);
    });
    settled = true;
    expect(result.kind).toBe('solutions');
    if (result.kind !== 'solutions') return;
    expect(streamed.map((solution) => solution.display.X)).toEqual(['1', '2', '3', '4']);
    expect(streamed).toEqual(result.solutions);
  });

  it('meters the goal alone while every answer renders between steps', async () => {
    // ~630 inferences across three answers; each render is an engine query of its own, so a
    // meter that paid for them would carry the total past 650.
    const streamed: PlSolution[] = [];
    const answered = await session.solve(
      'between(1,3,X),forall(between(1,100,_),true).',
      budget({ inferences: 650 }),
      's2',
      (solution) => streamed.push(solution),
    );
    expect(answered).toMatchObject({ kind: 'solutions' });
    expect(streamed.map((solution) => solution.display.X)).toEqual(['1', '2', '3']);
  });

  it('still meters search that fails after the last streamed answer', async () => {
    const streamed: PlSolution[] = [];
    const tail = await session.solve(
      'between(1,3,X),forall(between(1,100,_),true),X<3.',
      budget({ inferences: 500 }),
      's3',
      (solution) => streamed.push(solution),
    );
    expect(tail).toMatchObject({ kind: 'limit', limit: 'inference' });
    expect(streamed.map((solution) => solution.display.X)).toEqual(['1', '2']);
  });

  it(
    'a cancel queued during a synchronous step waits for that step, whose answer still streams',
    async () => {
      const streamed: string[] = [];
      const result = await session.solve(
        'between(1,2,X),(X =:= 2 -> forall(between(1,2000000,_),true) ; true).',
        budget(),
        's4',
        (solution) => {
          streamed.push(solution.display.X ?? '');
          // Armed after answer 1; due long before step 2 ends, yet it cannot fire inside it.
          if (streamed.length === 1) setTimeout(() => session.requestCancel('s4'), 5);
        },
      );
      expect(result.kind).toBe('cancelled');
      expect(streamed).toEqual(['1', '2']);
      if (result.kind === 'cancelled') {
        expect(result.solutions.map((solution) => solution.display.X)).toEqual(['1', '2']);
      }
    },
    TIMEOUT,
  );

  it('a throwing listener changes no outcome', async () => {
    const result = await session.solve('between(1,2,X).', budget(), 's5', () => {
      throw new Error('d17 listener failed');
    });
    expect(result).toMatchObject({ kind: 'solutions' });
    if (result.kind === 'solutions') expect(result.solutions).toHaveLength(2);
  });

  it('an error after a streamed answer fails closed, carrying no solution', async () => {
    const seen: EngineResponse[] = [];
    const request: EngineRequest = {
      id: 's7',
      kind: 'query',
      goal: '(X=shown;throw(error(resource_error(d17_probe),probe))).',
      budget: budget(),
    };
    const response = await session.handle(request, image, (partial) => seen.push(partial));
    expect(seen.map((partial) => partial.kind)).toEqual(['partial']);
    expect(response).toMatchObject({ id: 's7', kind: 'error', error: { code: 'prolog' } });
    expect(response).not.toHaveProperty('solutions');
  });

  it('handle posts each answer as a non-terminal partial under the request id', async () => {
    const seen: EngineResponse[] = [];
    const request: EngineRequest = {
      id: 's6',
      kind: 'query',
      goal: 'between(1,2,X).',
      budget: budget(),
    };
    const response = await session.handle(request, image, (partial) => seen.push(partial));
    expect(response).toMatchObject({ id: 's6', kind: 'solutions' });
    if (response.kind !== 'solutions') return;
    expect(seen).toEqual(
      response.solutions.map((solution) => ({ id: 's6', kind: 'partial', solution })),
    );
  });
});

describe('a late display never streams', () => {
  it(
    'the answer whose display ends past the deadline is withheld and the run stops',
    async () => {
      let virtualNow = 0;
      let displays = 0;
      const timed = new EngineSession({
        expected: contract,
        loadImage: async (bytes) => {
          const engine = await loadImage(bytes);
          const query = engine.prolog.query.bind(engine.prolog);
          const prolog = new Proxy(engine.prolog, {
            get(target, property, receiver) {
              if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
              return (goal: string, bindings?: Record<string, unknown>) => {
                const result = query(goal, bindings);
                if (!goal.includes('term_string') || !goal.includes('quoted(true)')) return result;
                return new Proxy(result, {
                  get(target, property, receiver) {
                    if (property !== 'once')
                      return Reflect.get(target, property, receiver) as unknown;
                    return () => {
                      const value = result.once();
                      displays += 1;
                      // The second answer's render ends past a 10 ms deadline.
                      if (displays === 2) virtualNow += 20;
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
      await timed.boot(image);
      const epoch = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => epoch + virtualNow);
      const streamed: string[] = [];
      const outcome = await timed.solve('between(1,3,X).', budget({ wallClockMs: 10 }), 'l1', (s) =>
        streamed.push(s.display.X ?? ''),
      );
      expect(outcome).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
      expect(streamed).toEqual(['1']);
      if (outcome.kind === 'limit') {
        expect(outcome.solutions.map((solution) => solution.display.X)).toEqual(['1']);
      }
    },
    TIMEOUT,
  );
});

/** Answers each request with a scripted reply list, one macrotask apart. */
class ScriptedWorker {
  #listener: ((event: MessageEvent<EngineResponse>) => void) | undefined;

  constructor(readonly script: (request: EngineRequest) => EngineResponse[]) {}

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === 'message') this.#listener = listener;
  }

  postMessage(request: EngineRequest): void {
    void (async () => {
      for (const data of this.script(request)) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.#listener?.({ data } as MessageEvent<EngineResponse>);
      }
    })();
  }

  terminate(): void {}
}

const row = (value: string): PlSolution => ({
  bindings: { X: { kind: 'atom', value } },
  display: { X: value },
});

describe('client partial routing', () => {
  it('query(onSolution) hears each partial in order and settles on the terminal response', async () => {
    const client = new EngineClient({
      spawn: () =>
        new ScriptedWorker(({ id }) => [
          { id, kind: 'partial', solution: row('a') },
          { id, kind: 'partial', solution: row('b') },
          { id, kind: 'solutions', solutions: [row('a'), row('b')] },
        ]) as unknown as Worker,
    });
    const heard: PlSolution[] = [];
    const outcome = await client.query('member(X,[a,b]).', budget(), undefined, (solution) =>
      heard.push(solution),
    );
    expect(heard).toEqual([row('a'), row('b')]);
    expect(outcome).toEqual({ kind: 'solutions', solutions: [row('a'), row('b')] });
    client.dispose();
  });

  it('a watchdog settlement keeps the answers that streamed before the stuck step', async () => {
    const deadlines: (() => void)[] = [];
    const client = new EngineClient({
      spawn: () =>
        new ScriptedWorker(({ id, kind }) =>
          kind === 'query'
            ? [
                { id, kind: 'partial', solution: row('a') },
                { id, kind: 'partial', solution: row('b') },
              ]
            : [],
        ) as unknown as Worker,
      schedule: (fn) => {
        deadlines.push(fn);
        return fn;
      },
      cancelSchedule: () => undefined,
    });
    const heard: PlSolution[] = [];
    const settling = client.query('repeat.', budget(), undefined, (solution) =>
      heard.push(solution),
    );
    await vi.waitFor(() => {
      expect(heard).toHaveLength(2);
    });
    deadlines.shift()?.();
    expect(await settling).toEqual({
      kind: 'limit',
      limit: 'wall-clock',
      solutions: [row('a'), row('b')],
    });
    client.dispose();
  });

  it('a query without a listener drops partials silently; a partial to a boot is a violation', async () => {
    const client = new EngineClient({
      spawn: () =>
        new ScriptedWorker(({ id, kind }) =>
          kind === 'boot'
            ? [
                { id, kind: 'partial', solution: row('x') },
                { id, kind: 'booted', contract },
              ]
            : [
                { id, kind: 'partial', solution: row('a') },
                { id, kind: 'solutions', solutions: [row('a')] },
              ],
        ) as unknown as Worker,
    });
    const violations: EngineError[] = [];
    client.onProtocolViolation = (error) => violations.push(error);
    expect(await client.query('true.', budget())).toEqual({
      kind: 'solutions',
      solutions: [row('a')],
    });
    expect(violations).toEqual([]);
    expect(await client.boot()).toEqual({ kind: 'booted', contract });
    expect(violations).toEqual([
      { code: 'protocol', message: 'partial for r2, which reports none' },
    ]);
    client.dispose();
  });
});

describe('a run ends at its final record', () => {
  it(
    'takes no step past exhaustion, so no other request runs while its query is open',
    async () => {
      // The meter's trailing resume marker leaves a choice point after the final record; stepping
      // into it cost one more yield with the query still open, and a request admitted there nested
      // inside it (the R41 control of `pnpm engine:probe` failed on exactly that in the browser).
      let steps = 0;
      const counted = new EngineSession({
        expected: contract,
        loadImage: async (bytes) => {
          const engine = await loadImage(bytes);
          const query = engine.prolog.query.bind(engine.prolog);
          engine.prolog.query = (goal: string, bindings?: Record<string, unknown>) => {
            const result = query(goal, bindings);
            if (!goal.includes('BudgetMeter_')) return result;
            const iterate = result[Symbol.iterator].bind(result);
            result[Symbol.iterator] = () => {
              const iterator = iterate();
              return {
                next: () => {
                  steps += 1;
                  return iterator.next();
                },
              } as ReturnType<typeof iterate>;
            };
            return result;
          };
          return engine;
        },
      });
      await counted.boot(image);
      expect(await counted.solve('fail.', budget())).toEqual({ kind: 'failure' });
      expect(steps).toBe(1);
      steps = 0;
      const two = await counted.solve('between(1,2,X).', budget());
      expect(two).toMatchObject({ kind: 'solutions' });
      // Two answers, then the final record: three steps, none past it.
      expect(steps).toBe(3);
    },
    TIMEOUT,
  );
});

describe('the exhausting step still reads the deadline', () => {
  it(
    'reports wall-clock when the step that exhausted the goal crossed the deadline',
    async () => {
      let virtualNow = 0;
      const timed = new EngineSession({
        expected: contract,
        loadImage: async (bytes) => {
          const engine = await loadImage(bytes);
          const query = engine.prolog.query.bind(engine.prolog);
          engine.prolog.query = (goal: string, bindings?: Record<string, unknown>) => {
            const result = query(goal, bindings);
            if (!goal.includes('BudgetMeter_')) return result;
            const iterate = result[Symbol.iterator].bind(result);
            result[Symbol.iterator] = () => {
              const iterator = iterate();
              return {
                next: () => {
                  const step = iterator.next();
                  // The final record (`BudgetFinal_ = true`) arrives 20 ms past a 10 ms deadline.
                  const value = step.value as Record<string, unknown> | undefined;
                  if (value?.BudgetFinal_ === 'true') virtualNow += 20;
                  return step;
                },
              } as ReturnType<typeof iterate>;
            };
            return result;
          };
          return engine;
        },
      });
      await timed.boot(image);
      const epoch = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => epoch + virtualNow);
      expect(await timed.solve('fail.', budget({ wallClockMs: 10 }))).toEqual({
        kind: 'limit',
        limit: 'wall-clock',
        solutions: [],
      });
      virtualNow = 0;
      const two = await timed.solve('(true;true).', budget({ wallClockMs: 10 }));
      expect(two).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
      if (two.kind === 'limit') expect(two.solutions).toHaveLength(2);
    },
    TIMEOUT,
  );
});
