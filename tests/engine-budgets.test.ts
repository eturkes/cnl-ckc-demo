// Red suite for M1.u3, written diff-blind against `.scratch/contract-m1u3.md`.
// Every case names the contract predicate it binds to. A case that passes without
// the real engine doing the work is a defect, not a green.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as clientModule from '../src/engine/client.js';
import * as protocolModule from '../src/engine/protocol.js';
import * as sessionModule from '../src/engine/session.js';

interface BudgetSpec {
  stackBytes: number;
  depth: number;
  inferences: number;
  wallClockMs: number;
  answerCap: number;
}

type UnknownRecord = Record<string, unknown>;
type RuntimeFunction = (...args: unknown[]) => unknown;
type RuntimeConstructor = new (...args: unknown[]) => unknown;

interface SessionApi {
  boot(image: Uint8Array): Promise<unknown>;
  handle(request: UnknownRecord, image: Uint8Array): Promise<unknown>;
}

interface ClientApi {
  query(goal: string, budget?: BudgetSpec): unknown;
  dispose(): void;
}

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const IMAGE = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';

const BUDGET: BudgetSpec = {
  stackBytes: 64 * 1024 * 1024,
  depth: 10_000,
  inferences: 1_000_000,
  wallClockMs: 10_000,
  answerCap: 32,
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireFunction = (module: object, name: string): RuntimeFunction => {
  const value = (module as UnknownRecord)[name];
  expect(typeof value, `M1.u3 requires exported ${name}()`).toBe('function');
  return value as RuntimeFunction;
};

const requireConstructor = (module: object, name: string): RuntimeConstructor =>
  requireFunction(module, name) as RuntimeConstructor;

const requireBudgetValidator = (): RuntimeFunction =>
  requireFunction(protocolModule, 'validateBudget');

const canonicalTerminal = (token: string): string => {
  const normalized = token.toLowerCase().replaceAll('_', '-');
  if (['protocol', 'protocol-error', 'invalid-budget'].includes(normalized)) return 'protocol';
  if (
    ['answer-cap', 'answer-limit', 'solution-cap', 'solution-limit', 'answer-cap-exceeded'].includes(
      normalized,
    )
  )
    return 'answer-cap';
  return normalized;
};

const terminalState = (outcome: unknown): string | undefined => {
  if (!isRecord(outcome)) return undefined;
  const error = isRecord(outcome.error) ? outcome.error : undefined;
  for (const token of [outcome.limit, outcome.status, error?.code, error?.kind, outcome.kind]) {
    if (typeof token !== 'string') continue;
    const canonical = canonicalTerminal(token);
    if (canonical !== 'error') return canonical;
  }
  return undefined;
};

const expectTerminal = (outcome: unknown, state: string): void => {
  expect(terminalState(outcome), `terminal payload: ${JSON.stringify(outcome)}`).toBe(state);
};

const solutionsOf = (outcome: unknown): unknown[] => {
  if (!isRecord(outcome)) return [];
  if (Array.isArray(outcome.solutions)) return outcome.solutions;
  if (isRecord(outcome.result) && Array.isArray(outcome.result.solutions)) {
    return outcome.result.solutions;
  }
  return [];
};

interface LiveHarness {
  session: SessionApi;
  goals: string[];
}

const liveSession = async (): Promise<LiveHarness> => {
  requireBudgetValidator();
  const loaded = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: UnknownRecord) => Promise<object>)
    | { default: (image: Uint8Array) => (options?: UnknownRecord) => Promise<object> };
  const load = typeof loaded === 'function' ? loaded : loaded.default;
  const goals: string[] = [];
  const loadImage = async (image: Uint8Array, options: UnknownRecord = {}): Promise<object> => {
    const engine = await load(image)(options);
    const raw = engine as { prolog: { query: (goal: string, bindings?: UnknownRecord) => unknown } };
    const query = raw.prolog.query.bind(raw.prolog);
    const prolog = new Proxy(raw.prolog, {
      get(target, property, receiver) {
        if (property === 'query') {
          return (goal: string, bindings?: UnknownRecord): unknown => {
            goals.push(goal);
            return query(goal, bindings);
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    return new Proxy(engine, {
      get(target, property, receiver) {
        return property === 'prolog' ? prolog : Reflect.get(target, property, receiver);
      },
    });
  };
  const Session = requireConstructor(sessionModule, 'EngineSession');
  const session = new Session({
    loadImage,
    expected: manifest.contract,
  }) as SessionApi;
  await session.boot(IMAGE);
  goals.length = 0;
  return { session, goals };
};

const queryRequest = (id: string, goal: string, budget: BudgetSpec): UnknownRecord => ({
  id,
  kind: 'query',
  goal,
  budget,
});

type ProbeListener = (event: unknown) => void;

class ProbeWorker {
  readonly posted: unknown[] = [];
  readonly #listeners = new Map<string, Set<ProbeListener>>();
  terminated = 0;
  onPost: ((message: unknown, worker: ProbeWorker) => void) | undefined;

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback: ProbeListener =
      typeof listener === 'function'
        ? (listener as unknown as ProbeListener)
        : (event) => listener.handleEvent(event as Event);
    const listeners = this.#listeners.get(type) ?? new Set<ProbeListener>();
    listeners.add(callback);
    this.#listeners.set(type, listeners);
  }

  postMessage(message: unknown): void {
    const cloned = structuredClone(message);
    this.posted.push(cloned);
    queueMicrotask(() => this.onPost?.(cloned, this));
  }

  terminate(): void {
    this.terminated += 1;
  }

  emitMessage(data: unknown): void {
    this.#emit('message', { data });
  }

  #emit(type: string, event: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

interface ClientHarness {
  client: ClientApi;
  workers: ProbeWorker[];
}

const clientHarness = (
  onPost: (message: unknown, worker: ProbeWorker) => void,
): ClientHarness => {
  const workers: ProbeWorker[] = [];
  const factory = (): Worker => {
    const worker = new ProbeWorker();
    worker.onPost = onPost;
    workers.push(worker);
    return worker as unknown as Worker;
  };
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        return factory();
      }
    },
  );
  const Client = requireConstructor(clientModule, 'EngineClient');
  const client = new Client({
    workerFactory: factory,
    createWorker: factory,
    spawnWorker: factory,
  }) as ClientApi;
  return { client, workers };
};

const settle = async (value: unknown): Promise<unknown> => {
  const awaited = await value;
  if (!isRecord(awaited)) return awaited;
  if (awaited.outcome instanceof Promise) return awaited.outcome;
  if (awaited.promise instanceof Promise) return awaited.promise;
  return awaited;
};

const respondNormally = (message: unknown, worker: ProbeWorker): void => {
  if (!isRecord(message) || typeof message.id !== 'string') return;
  if (message.kind === 'boot') {
    worker.emitMessage({ id: message.id, kind: 'booted', contract: manifest.contract });
    return;
  }
  worker.emitMessage({ id: message.id, kind: 'failure' });
};

const postedCount = (workers: ProbeWorker[]): number =>
  workers.reduce((count, worker) => count + worker.posted.length, 0);

const expectRealCategoryAnswer = (outcome: unknown): void => {
  const first = solutionsOf(outcome)[0];
  expect(isRecord(first)).toBe(true);
  if (!isRecord(first) || !isRecord(first.bindings)) return;
  const answer = first.bindings.A;
  expect(answer).toMatchObject({ kind: 'compound', functor: '$guideline_id' });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('M1.u3 budgets, failure modes, cancellation', () => {
  it('P1.1 — query without a budget spec is unreachable from the public API', async () => {
    const { client, workers } = clientHarness(respondNormally);
    const outcome = await settle(client.query(CATEGORY_A_GOAL));
    expectTerminal(outcome, 'protocol');
    expect(postedCount(workers), 'an invalid request crossed the worker boundary').toBe(0);
    client.dispose();
  });

  it('P1.2 — zero, negative, fractional, NaN, Infinity, missing and over-max budgets each fail typed', async () => {
    requireBudgetValidator();
    const { client, workers } = clientHarness(respondNormally);
    const fields = Object.keys(BUDGET) as (keyof BudgetSpec)[];
    const invalid = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53];
    for (const field of fields) {
      for (const value of invalid) {
        const outcome = await settle(client.query(CATEGORY_A_GOAL, { ...BUDGET, [field]: value }));
        expectTerminal(outcome, 'protocol');
      }
      const missing = { ...BUDGET } as Partial<BudgetSpec>;
      delete missing[field];
      const outcome = await settle(client.query(CATEGORY_A_GOAL, missing as BudgetSpec));
      expectTerminal(outcome, 'protocol');
    }
    expect(postedCount(workers), 'client validation happened after postMessage').toBe(0);
    client.dispose();
  });

  it('P1.3 — the worker revalidates a budget the client would have accepted', async () => {
    const { session, goals } = await liveSession();
    const response = await session.handle(
      queryRequest('worker-invalid', CATEGORY_A_GOAL, { ...BUDGET, depth: 0 }),
      IMAGE,
    );
    expectTerminal(response, 'protocol');
    expect(goals, 'worker validation happened after Prolog execution').toEqual([]);
  });

  it('P1.4 — answer cap stops the real 7-solution goal at cap 1', async () => {
    const { session, goals } = await liveSession();
    const response = await session.handle(
      queryRequest('cap-one', CATEGORY_A_GOAL, { ...BUDGET, answerCap: 1 }),
      IMAGE,
    );
    expectTerminal(response, 'answer-cap');
    expect(solutionsOf(response)).toHaveLength(1);
    expectRealCategoryAnswer(response);
    expect(goals.some((goal) => goal.includes('guideline_entity(actual,A,recommendation'))).toBe(
      true,
    );
  });

  it('P2.1 — stack exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.1');
  });

  it('P2.2 — depth exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.2');
  });

  it('P2.3 — inference exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.3');
  });

  it('P2.4 — wall-clock expiry surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.4');
  });

  it('P2.5 — answer cap surfaces its own state, distinct from an exhausted run', () => {
    expect.fail('unimplemented: P2.5');
  });

  it('P2.6 — cancellation surfaces its own state, distinct from every limit', () => {
    expect.fail('unimplemented: P2.6');
  });

  it('P2.7 — heap exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.7');
  });

  it('P2.8 — a limit is classified from term structure, not from message text', () => {
    expect.fail('unimplemented: P2.8');
  });

  it('P3.1 — the stack flag is restored on success, failure, limit, exception and cancel', () => {
    expect.fail('unimplemented: P3.1');
  });

  it('P3.2 — depth and inference yield early solutions before terminating', () => {
    expect.fail('unimplemented: P3.2');
  });

  it('P3.3 — the budget bounds display rendering as well as solving', () => {
    expect.fail('unimplemented: P3.3');
  });

  it('P3.4 — the engine still reports 337 documents and 7 answers after every trip', () => {
    expect.fail('unimplemented: P3.4');
  });

  it('P3.5 — a repeat-shaped goal terminates through the cap or the deadline', () => {
    expect.fail('unimplemented: P3.5');
  });

  it('P3.6 — wall-clock fires soft in the worker and hard on the main thread', () => {
    expect.fail('unimplemented: P3.6');
  });

  it('P4.1 — a cancel message is acted on while a multi-solution query runs', () => {
    expect.fail('unimplemented: P4.1');
  });

  it('P4.2 — cooperative cancel settles only its target id', () => {
    expect.fail('unimplemented: P4.2');
  });

  it('P4.3 — the engine stays usable after a cooperative cancel', () => {
    expect.fail('unimplemented: P4.3');
  });

  it('P4.4 — hard cancel re-verifies the contract from the rebooted engine', () => {
    expect.fail('unimplemented: P4.4');
  });

  it('P4.5 — hard cancel drops a dynamic overlay and still reports 337 documents', () => {
    expect.fail('unimplemented: P4.5');
  });

  it('P4.6 — every in-flight request settles once, with no unhandled rejection', () => {
    expect.fail('unimplemented: P4.6');
  });

  it('P4.7 — a request issued during respawn settles typed', () => {
    expect.fail('unimplemented: P4.7');
  });

  it('P4.8 — a dead-generation response cannot settle a live request', () => {
    expect.fail('unimplemented: P4.8');
  });

  it('P4.9 — concurrent hard cancels produce one termination and one respawn', () => {
    expect.fail('unimplemented: P4.9');
  });

  it('P4.10 — a settled request leaves no armed timer', () => {
    expect.fail('unimplemented: P4.10');
  });

  it('P4.11 — dispose stays terminal and hard cancel is a separate lifecycle', () => {
    expect.fail('unimplemented: P4.11');
  });

  it('P5.1 — a malformed goal fails typed and never executes', () => {
    expect.fail('unimplemented: P5.1');
  });

  it('P5.2 — an honest zero-solution goal stays failure', () => {
    expect.fail('unimplemented: P5.2');
  });

  it('P5.3 — consult stderr is drained and any ERROR line is fatal', () => {
    expect.fail('unimplemented: P5.3');
  });

  it('P5.4 — an engine that emitted consult ERROR is discarded, not returned', () => {
    expect.fail('unimplemented: P5.4');
  });

  it('P6.2 — no unbudgeted query surface is exported', () => {
    expect.fail('unimplemented: P6.2');
  });

  it('P6.5 — terms.ts decode and encode behavior is unchanged', () => {
    expect.fail('unimplemented: P6.5');
  });
});
