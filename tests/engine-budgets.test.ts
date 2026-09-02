// Live contract for u3: budgets, typed limit states, fail-closed loading, and
// cancellation. Every limit case trips against the real generated image — a case
// that would pass with the engine stubbed out proves nothing about a budget.
//
// Boot costs ~121-335 ms, so the limit cases share one engine and each asserts the
// engine is still sound afterwards rather than booting a fresh one.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX, readOutcome, validateBudget, wrapGoal } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { isTerminal } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');

/** Fails rather than skips when the payload is missing; `pnpm kb:build` produces it. */
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));

const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loaderWith = (options: Record<string, unknown>): ImageLoader => {
  return async (image) => {
    const factory = require('swipl-wasm/dist/loadImageDefault.js') as
      | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
      | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
    const load = typeof factory === 'function' ? factory : factory.default;
    return load(image)(options);
  };
};

const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';

/** Recurses exactly `N` deep and burns one inference per level; drives depth and inference. */
const DEEP_SETUP =
  'assertz((probe_deep(0):-!)),assertz((probe_deep(N):-N>0,M is N-1,probe_deep(M))).';

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30000,
  answerCap: 1000,
  ...overrides,
});

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({ loadImage: loaderWith({}), expected: manifest.contract });
  await session.boot(new Uint8Array(readGenerated('kb.pvm')));
  const solved = await session.solve(DEEP_SETUP, budget());
  expect(solved.kind).toBe('solutions');
}, 120_000);

/** Reads a scalar straight out of the engine, so no test asserts a value it computed. */
const engineValue = async (goal: string, name: string): Promise<unknown> => {
  const solved = await session.solve(goal, budget());
  if (solved.kind !== 'solutions') throw new Error(`expected solutions, got ${solved.kind}`);
  const term = solved.solutions[0]?.bindings[name];
  return term?.kind === 'integer' ? term.value : undefined;
};

/** The invariant every budget trip must leave behind. */
const expectEngineSound = async (): Promise<void> => {
  expect(await engineValue('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).', 'N')).toBe(
    manifest.contract.documents,
  );
  const solved = await session.solve(CATEGORY_A_GOAL, budget());
  expect(solved.kind).toBe('solutions');
  if (solved.kind === 'solutions') expect(solved.solutions).toHaveLength(7);
};

describe('P1 budget spec', () => {
  it('P1.2 rejects every malformed budget value as a typed budget failure', () => {
    const bad: unknown[] = [
      undefined,
      null,
      {},
      budget({ depth: 0 }),
      budget({ depth: -1 }),
      budget({ inferences: 1.5 }),
      budget({ wallClockMs: Number.NaN }),
      budget({ wallClockMs: Number.POSITIVE_INFINITY }),
      budget({ answerCap: Number.MAX_SAFE_INTEGER }),
      budget({ stackBytes: BUDGET_MAX.stackBytes + 1 }),
      { ...budget(), depth: undefined },
    ];
    for (const spec of bad) expect(() => validateBudget(spec)).toThrow();
    expect(validateBudget(budget())).toEqual(budget());
  });

  it('P1.3 revalidates in the worker even when the client would have accepted', async () => {
    const request = {
      id: 'b1',
      kind: 'query',
      goal: 'true.',
      budget: { ...budget(), depth: 0 },
    } as unknown as EngineRequest;
    const response = await session.handle(request, new Uint8Array(0));
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('budget');
  });

  it('P1.2 refuses a goal that names a reserved wrapper variable', async () => {
    const response = await session.handle(
      { id: 'b2', kind: 'query', goal: 'BudgetDepth_ = 1.', budget: budget() },
      new Uint8Array(0),
    );
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('budget');
  });

  it('P1.4 stops the real seven-solution goal at an answer cap of one', async () => {
    const solved = await session.solve(CATEGORY_A_GOAL, budget({ answerCap: 1 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind !== 'limit') return;
    expect(solved.limit).toBe('answer-cap');
    expect(solved.solutions).toHaveLength(1);
    await expectEngineSound();
  });
});

describe('P2 typed limit states', () => {
  it('P2.2 surfaces depth exhaustion as its own state', async () => {
    const solved = await session.solve('probe_deep(5000).', budget({ depth: 50 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind === 'limit') expect(solved.limit).toBe('depth');
    await expectEngineSound();
  });

  it('P2.3 surfaces inference exhaustion as its own state', async () => {
    const solved = await session.solve('probe_deep(5000).', budget({ inferences: 1000 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind === 'limit') expect(solved.limit).toBe('inference');
    await expectEngineSound();
  });

  it('P2.1 surfaces stack exhaustion as its own state', async () => {
    const solved = await session.solve('length(L,20000000).', budget({ stackBytes: 8388608 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind === 'limit') expect(solved.limit).toBe('stack');
    await expectEngineSound();
  });

  it('P2.4 surfaces wall-clock expiry as its own state', async () => {
    const solved = await session.solve(
      'between(1,1000000,X).',
      budget({ wallClockMs: 40, answerCap: BUDGET_MAX.answerCap }),
    );
    expect(solved.kind).toBe('limit');
    if (solved.kind === 'limit') expect(solved.limit).toBe('wall-clock');
    await expectEngineSound();
  });

  it('P2.5 keeps the cap distinct from an honestly exhausted run', async () => {
    const capped = await session.solve('between(1,10,X).', budget({ answerCap: 4 }));
    const exhausted = await session.solve('between(1,4,X).', budget({ answerCap: 10 }));
    expect(capped.kind).toBe('limit');
    expect(exhausted.kind).toBe('solutions');
    if (capped.kind === 'limit' && exhausted.kind === 'solutions') {
      expect(capped.solutions).toHaveLength(4);
      expect(exhausted.solutions).toHaveLength(4);
    }
  });

  it('P2.5 reads an exact-fit cap as honest exhaustion rather than truncation', async () => {
    // The cap truncated the run only if the engine still had an answer to give, so
    // the driver proves one solution past the cap and discards it.
    const fit = await session.solve('between(1,4,X).', budget({ answerCap: 4 }));
    const over = await session.solve('between(1,5,X).', budget({ answerCap: 4 }));
    const real = await session.solve(CATEGORY_A_GOAL, budget({ answerCap: 7 }));
    expect(fit.kind).toBe('solutions');
    expect(real.kind).toBe('solutions');
    expect(over.kind).toBe('limit');
    if (fit.kind === 'solutions' && over.kind === 'limit' && real.kind === 'solutions') {
      expect(fit.solutions).toHaveLength(4);
      expect(over.limit).toBe('answer-cap');
      expect(over.solutions).toHaveLength(4);
      expect(real.solutions).toHaveLength(7);
    }
  });

  it('P2.8 classifies from term structure, not from message text', () => {
    expect(
      readOutcome({ BudgetInference_: { kind: 'atom', value: 'inference_limit_exceeded' } }),
    ).toEqual({ kind: 'limit', limit: 'inference' });
    expect(readOutcome({ BudgetResource_: { kind: 'atom', value: 'memory' } })).toEqual({
      kind: 'limit',
      limit: 'heap',
    });
    // A resource this build has no state for stays unclassified rather than guessed.
    expect(readOutcome({ BudgetResource_: { kind: 'atom', value: 'threads' } })).toEqual({
      kind: 'resource',
      resource: 'threads',
    });
    // Text that merely looks like a limit is not one.
    expect(readOutcome({ X: { kind: 'string', value: 'inference_limit_exceeded' } }).kind).toBe(
      'solution',
    );
  });

  it('P2.9 treats every declared response kind as terminal', () => {
    const responses: EngineResponse[] = [
      { id: 'a', kind: 'booted', contract: manifest.contract },
      { id: 'a', kind: 'solutions', solutions: [] },
      { id: 'a', kind: 'failure' },
      { id: 'a', kind: 'limit', limit: 'depth', solutions: [] },
      { id: 'a', kind: 'cancelled', solutions: [] },
      { id: 'a', kind: 'ack', accepted: true },
      { id: 'a', kind: 'consulted' },
      { id: 'a', kind: 'error', error: { code: 'prolog', message: 'x' } },
    ];
    for (const response of responses) expect(isTerminal(response)).toBe(true);
  });
});

describe('P3 budget enforcement', () => {
  it('P3.1 restores the stack flag after a trip, read back from the engine', async () => {
    const before = await engineValue('current_prolog_flag(stack_limit,V).', 'V');
    await session.solve('numlist(1,20000000,L),length(L,_).', budget({ stackBytes: 8388608 }));
    expect(await engineValue('current_prolog_flag(stack_limit,V).', 'V')).toBe(before);
  });

  it('P3.2 yields early solutions before a limit terminates the run', async () => {
    const solved = await session.solve('between(1,20,X),probe_deep(X).', budget({ depth: 8 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind !== 'limit') return;
    expect(solved.limit).toBe('depth');
    // The shallow branches answer before the deep one trips the limit.
    expect(solved.solutions.length).toBeGreaterThan(0);
  });

  it('P3.3 renders display text for every solution it returns', async () => {
    const solved = await session.solve('between(1,3,X).', budget());
    expect(solved.kind).toBe('solutions');
    if (solved.kind !== 'solutions') return;
    for (const solution of solved.solutions) expect(solution.display.X).toMatch(/^\d+$/);
  });

  it('P3.5 bounds a repeat-shaped goal instead of returning forever', async () => {
    const solved = await session.solve('repeat,X=1.', budget({ answerCap: 3 }));
    expect(solved.kind).toBe('limit');
    if (solved.kind !== 'limit') return;
    expect(solved.limit).toBe('answer-cap');
    expect(solved.solutions).toHaveLength(3);
    await expectEngineSound();
  });

  it('P3.6 keeps the wrapper text free of the caller trailing full stop', () => {
    expect(wrapGoal('foo(X).', budget({ depth: 7, inferences: 9 }))).toBe(
      'catch(call_with_inference_limit(call_with_depth_limit((foo(X)),7,BudgetDepth_),9,' +
        'BudgetInference_),error(resource_error(BudgetResource_),_),true).',
    );
  });
});

describe('P4 cancellation', () => {
  it('P4.1 acts on a cancel posted while a multi-solution query runs', async () => {
    const running = session.solve(
      'between(1,1000000,X).',
      budget({ answerCap: BUDGET_MAX.answerCap }),
      'q-cancel',
    );
    // Landing this from a timer is the whole point: it can only be observed because
    // `solve` returns to the task queue between solutions.
    const accepted = await new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(session.requestCancel('q-cancel')), 25),
    );
    const solved = await running;
    expect(accepted).toBe(true);
    expect(solved.kind).toBe('cancelled');
    if (solved.kind === 'cancelled') expect(solved.solutions.length).toBeGreaterThan(0);
  });

  it('P4.2 reports a cancel for an unknown or settled id as not accepted', async () => {
    expect(session.requestCancel('never-ran')).toBe(false);
    await session.solve('between(1,2,X).', budget(), 'q-done');
    expect(session.requestCancel('q-done')).toBe(false);
  });

  it('P4.1 defers a cancel that outran its own query', async () => {
    // The worker awaits between receiving a query message and entering `solve`, so a
    // cancel can land while nothing is active. Dropping it runs the query to completion.
    expect(session.requestCancel('q-early')).toBe(false);
    const solved = await session.solve('between(1,1000000,X).', budget(), 'q-early');
    expect(solved).toEqual({ kind: 'cancelled', solutions: [] });
  });

  it('P4.1 leaves a query untouched by a cancel aimed at another id', async () => {
    expect(session.requestCancel('q-other')).toBe(false);
    const solved = await session.solve('between(1,3,X).', budget(), 'q-unrelated');
    expect(solved.kind).toBe('solutions');
    if (solved.kind === 'solutions') expect(solved.solutions).toHaveLength(3);
  });

  it('P4.3 leaves the engine usable after a cooperative cancel', async () => {
    await expectEngineSound();
  });
});

describe('P5 fail-closed inputs', () => {
  it('P5.1 fails a malformed goal without executing it', async () => {
    const response = await session.handle(
      { id: 'm1', kind: 'query', goal: 'guideline_document(', budget: budget() },
      new Uint8Array(0),
    );
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('prolog');
  });

  it('P5.2 keeps an honest zero-solution goal distinct from every limit', async () => {
    const solved = await session.solve('guideline_document(no_such_document,_,_).', budget());
    expect(solved.kind).toBe('failure');
  });

  it('P5.3 refuses to load at runtime without a diagnostic sink', async () => {
    const response = await session.handle(
      { id: 'c0', kind: 'consult', source: 'probe_sinkless.' },
      new Uint8Array(0),
    );
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('consult');
  });

  it('P5.4 discards the engine after a load that emitted a diagnostic', async () => {
    const captured: string[] = [];
    const sinked = new EngineSession({
      loadImage: loaderWith({
        print: () => undefined,
        printErr: (line: string) => captured.push(line),
        on_output: (line: string, stream: string) => {
          if (stream === 'stderr') captured.push(line);
        },
      }),
      drain: () => captured.splice(0, captured.length),
      expected: manifest.contract,
    });
    await sinked.boot(new Uint8Array(readGenerated('kb.pvm')));

    const clean = await sinked.handle(
      { id: 'c1', kind: 'consult', source: 'probe_clean.\n' },
      new Uint8Array(0),
    );
    expect(clean.kind).toBe('consulted');

    // A syntax error reports success and leaves its clauses resident, so only the
    // drained diagnostic can reveal it — and by then the engine is already dirty.
    const broken = await sinked.handle(
      { id: 'c2', kind: 'consult', source: 'probe_broken(.\n' },
      new Uint8Array(0),
    );
    expect(broken.kind).toBe('error');
    if (broken.kind === 'error') expect(broken.error.code).toBe('consult');

    const afterwards = await sinked.handle(
      { id: 'c3', kind: 'query', goal: 'true.', budget: budget() },
      new Uint8Array(0),
    );
    expect(afterwards.kind).toBe('error');
    if (afterwards.kind === 'error') expect(afterwards.error.code).toBe('consult');
  }, 120_000);

  it('P5.3 treats the qsave shlib text as fatal anywhere but image load', async () => {
    const captured: string[] = [];
    const scripted = new EngineSession({
      loadImage: loaderWith({
        print: () => undefined,
        printErr: (line: string) => captured.push(line),
        on_output: (line: string, stream: string) => {
          if (stream === 'stderr') captured.push(line);
        },
      }),
      drain: () => captured.splice(0, captured.length),
      expected: manifest.contract,
    });
    // Booting first proves the tolerance survives where qsave actually emits the pair.
    await scripted.boot(new Uint8Array(readGenerated('kb.pvm')));

    const response = await scripted.handle(
      {
        id: 'c4',
        kind: 'consult',
        source: ':- format(user_error,"Warning: library(shlib) probe~n",[]).\n',
      },
      new Uint8Array(0),
    );
    expect(response.kind).toBe('error');
    if (response.kind === 'error') expect(response.error.code).toBe('consult');
  }, 120_000);
});

/**
 * Client lifecycle against a scripted worker.
 *
 * The real Worker is not the subject here — correlation, deadlines, generations and
 * settlement are, and each needs a worker that misbehaves on demand.
 */
class FakeWorker {
  static live: FakeWorker[] = [];
  readonly seen: EngineRequest[] = [];
  terminated = false;
  #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor() {
    FakeWorker.live.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(response: EngineResponse): void {
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }

  raise(message: string): void {
    for (const listener of this.#listeners.get('error') ?? []) listener({ message });
  }

  get last(): EngineRequest {
    const request = this.seen.at(-1);
    if (request === undefined) throw new Error('worker received nothing');
    return request;
  }
}

const clientUnderTest = (): EngineClient => {
  FakeWorker.live = [];
  return new EngineClient({ spawn: () => new FakeWorker() as unknown as Worker });
};

/** Lets the client's own promise chain run before the test inspects its effects. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('P4 client lifecycle', () => {
  it('P4.6 settles every in-flight request once when the worker fails', async () => {
    const client = clientUnderTest();
    const first = client.query('true.', budget());
    const second = client.query('fail.', budget());
    await settle();
    FakeWorker.live[0]?.raise('worker exploded');
    for (const outcome of await Promise.all([first, second])) {
      expect(outcome.kind).toBe('error');
      if (outcome.kind === 'error') expect(outcome.error.code).toBe('worker');
    }
  });

  it('P4.8 keeps a dead generation from settling a live request', async () => {
    const client = clientUnderTest();
    const violations: string[] = [];
    client.onProtocolViolation = (error) => violations.push(error.message);
    const first = client.query('true.', budget());
    await settle();
    const dead = FakeWorker.live[0];
    const staleId = dead?.last.id ?? '';
    void client.reset('test');
    await settle();
    expect(await first).toMatchObject({ kind: 'error' });

    const second = client.query('true.', budget());
    await settle();
    dead?.reply({ id: staleId, kind: 'failure' });
    // The replacement is a different worker, so nothing the dead one says can land.
    dead?.reply({ id: FakeWorker.live[1]?.last.id ?? '', kind: 'failure' });
    expect(violations).toHaveLength(0);
    FakeWorker.live[1]?.reply({ id: FakeWorker.live[1]?.last.id ?? '', kind: 'failure' });
    expect(await second).toEqual({ kind: 'failure' });
  });

  it('P4.9 single-flights concurrent hard cancels into one termination', async () => {
    const client = clientUnderTest();
    void client.query('true.', budget());
    await settle();
    const resets = [client.reset('a'), client.reset('b'), client.reset('c')];
    await settle();
    expect(FakeWorker.live.filter((worker) => worker.terminated)).toHaveLength(1);
    expect(FakeWorker.live).toHaveLength(2);
    const replacement = FakeWorker.live[1];
    replacement?.reply({ id: replacement.last.id, kind: 'booted', contract: manifest.contract });
    for (const outcome of await Promise.all(resets)) expect(outcome.kind).toBe('booted');
  });

  it('P3.6 turns an overrun deadline into a wall-clock state and a fresh worker', async () => {
    const client = clientUnderTest();
    const outcome = client.query('repeat.', budget({ wallClockMs: 1 }));
    expect(await outcome).toEqual({ kind: 'limit', limit: 'wall-clock', solutions: [] });
    await settle();
    expect(FakeWorker.live[0]?.terminated).toBe(true);
  }, 10_000);

  it('P2.7 terminates and recreates the worker after a heap limit', async () => {
    const client = clientUnderTest();
    const pending = client.query('true.', budget());
    await settle();
    const saturated = FakeWorker.live[0] as FakeWorker;
    saturated.reply({ id: saturated.last.id, kind: 'limit', limit: 'heap', solutions: [] });
    await settle();

    // The caller is still suspended here: a saturated heap keeps its asserted residue,
    // so the replacement must have re-verified the contract before the outcome lands.
    const replacement = FakeWorker.live[1] as FakeWorker;
    expect(saturated.terminated).toBe(true);
    expect(replacement.last.kind).toBe('boot');
    replacement.reply({
      id: replacement.last.id,
      kind: 'booted',
      contract: manifest.contract,
    });

    const outcome = await pending;
    expect(outcome.kind).toBe('limit');
    if (outcome.kind === 'limit') expect(outcome.limit).toBe('heap');

    const posts = saturated.seen.length;
    void client.query(CATEGORY_A_GOAL, budget());
    await settle();
    expect(replacement.last.kind).toBe('query');
    expect(saturated.seen).toHaveLength(posts);
    client.dispose();
  });

  it('P4.10 leaves no timer armed once a request has settled', async () => {
    const armed = new Set<number>();
    let next = 0;
    const client = new EngineClient({
      spawn: () => new FakeWorker() as unknown as Worker,
      schedule: () => {
        const handle = ++next;
        armed.add(handle);
        return handle;
      },
      cancelSchedule: (handle) => armed.delete(handle as number),
    });
    FakeWorker.live = [];
    const outcome = client.query('true.', budget());
    await settle();
    const worker = FakeWorker.live[0];
    expect(armed.size).toBe(1);
    worker?.reply({ id: worker.last.id, kind: 'failure' });
    expect(await outcome).toEqual({ kind: 'failure' });
    expect(armed.size).toBe(0);
  });

  it('P4.11 keeps dispose terminal, with no respawn', async () => {
    const client = clientUnderTest();
    void client.query('true.', budget());
    await settle();
    client.dispose();
    const outcome = await client.query('true.', budget());
    expect(outcome.kind).toBe('error');
    expect(FakeWorker.live).toHaveLength(1);
    expect((await client.reset('after dispose')).kind).toBe('error');
  });

  it('P1.2 rejects a bad budget before it reaches the worker', async () => {
    const client = clientUnderTest();
    const outcome = await client.query('true.', budget({ depth: 0 }));
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') expect(outcome.error.code).toBe('budget');
    expect(FakeWorker.live).toHaveLength(0);
  });

  it('P4.2 reports an unaccepted cancel rather than claiming success', async () => {
    const client = clientUnderTest();
    const cancelling = client.cancel('nothing-running');
    await settle();
    const worker = FakeWorker.live[0];
    worker?.reply({ id: worker.last.id, kind: 'ack', accepted: false });
    expect(await cancelling).toBe(false);
  });
});

describe('P1 bounded runtime loading', () => {
  it('P1.1 arms one deadline for a consult and discards the engine when it expires', async () => {
    const armed = new Map<number, () => void>();
    let next = 0;
    const client = new EngineClient({
      spawn: () => new FakeWorker() as unknown as Worker,
      schedule: (fn) => {
        const handle = ++next;
        armed.set(handle, fn);
        return handle;
      },
      cancelSchedule: (handle) => armed.delete(handle as number),
    });
    FakeWorker.live = [];
    // A `:- Goal.` directive runs arbitrary Prolog, so an unbounded consult has no
    // soft check, no watchdog and no cancel.
    const loading = client.consult(':- repeat, fail.');
    await settle();
    expect(armed.size).toBe(1);
    const worker = FakeWorker.live[0];
    expect(worker?.last.kind).toBe('consult');
    for (const fire of [...armed.values()]) fire();

    expect(await loading).toMatchObject({ kind: 'error', error: { code: 'consult' } });
    await settle();
    expect(worker?.terminated).toBe(true);
    expect(armed.size).toBe(0);
    client.dispose();
  });
});
