// Adversarial review probes for M1.u3 — real-PVM half (`rev-m1u3-2`).
//
// Review artifact, not shipped coverage. Each block names the check-set row it
// decides. Blocks expected RED against 9020e62 are marked `RED:` in their title.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX, readOutcome, validateBudget } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineRequest,
  EngineResponse,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: EngineContract;
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

const DEEP_SETUP =
  'assertz((probe_deep(0):-!)),assertz((probe_deep(N):-N>0,M is N-1,probe_deep(M))).';

const STACK_FLAG = 'current_prolog_flag(stack_limit,V).';
const DOCUMENT_COUNT = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).';

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const delay = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let image: Uint8Array;
let session: EngineSession;

const integerOf = async (goal: string, name: string): Promise<unknown> => {
  const solved = await session.solve(goal, budget());
  if (solved.kind !== 'solutions') throw new Error(`expected solutions, got ${solved.kind}`);
  const term = solved.solutions[0]?.bindings[name];
  return term?.kind === 'integer' ? term.value : undefined;
};

/** The soundness invariant every trip must leave behind, read from the engine. */
const expectSound = async (): Promise<void> => {
  expect(await integerOf(DOCUMENT_COUNT, 'N')).toBe(manifest.contract.documents);
  const solved = await session.solve(CATEGORY_A_GOAL, budget());
  expect(solved.kind).toBe('solutions');
  if (solved.kind === 'solutions') expect(solved.solutions).toHaveLength(7);
};

beforeAll(async () => {
  image = new Uint8Array(readGenerated('kb.pvm'));
  session = new EngineSession({ loadImage: loaderWith({}), expected: manifest.contract });
  await session.boot(image);
  expect((await session.solve(DEEP_SETUP, budget())).kind).toBe('solutions');
}, 180_000);

// ---------------------------------------------------------------- R02

/** Records every goal the engine is asked to run, so "zero calls" is provable. */
const spyEngine = (): { engine: Engine; goals: string[] } => {
  const goals: string[] = [];
  const answers: Record<string, unknown> = {
    'findall(V,guideline_schema_version(V),Vs),sort(Vs,Us),length(Us,N),Us=[S].': {
      $tag: 'bindings',
      success: true,
      S: manifest.contract.schemaVersion,
      N: 1,
    },
    [DOCUMENT_COUNT]: { $tag: 'bindings', success: true, N: manifest.contract.documents },
    [STACK_FLAG]: { $tag: 'bindings', success: true, V: 1073741824 },
  };
  const engine = {
    prolog: {
      query: (goal: string) => {
        goals.push(goal);
        return {
          once: () => answers[goal] ?? { $tag: 'bindings', success: true },
          [Symbol.iterator]: () => ({ next: () => ({ done: true, value: undefined }) }),
        };
      },
    },
  } as unknown as Engine;
  return { engine, goals };
};

describe('R02 budget validation on both sides, before any Prolog runs', () => {
  const invalid: [string, unknown][] = [
    ['missing', undefined],
    ['null', null],
    ['empty object', {}],
    ['zero', budget({ depth: 0 })],
    ['negative', budget({ inferences: -1 })],
    ['fractional', budget({ wallClockMs: 1.5 })],
    ['NaN', budget({ stackBytes: Number.NaN })],
    ['Infinity', budget({ answerCap: Number.POSITIVE_INFINITY })],
    ['-Infinity', budget({ depth: Number.NEGATIVE_INFINITY })],
    ['2^53', budget({ inferences: 2 ** 53 })],
    ['MAX_SAFE_INTEGER', budget({ depth: Number.MAX_SAFE_INTEGER })],
    ['string', budget({ depth: '10' as unknown as number })],
    ['undefined field', { ...budget(), answerCap: undefined }],
    ['stack max+1', budget({ stackBytes: BUDGET_MAX.stackBytes + 1 })],
    ['depth max+1', budget({ depth: BUDGET_MAX.depth + 1 })],
    ['inferences max+1', budget({ inferences: BUDGET_MAX.inferences + 1 })],
    ['wallClockMs max+1', budget({ wallClockMs: BUDGET_MAX.wallClockMs + 1 })],
    ['answerCap max+1', budget({ answerCap: BUDGET_MAX.answerCap + 1 })],
  ];

  it.each(invalid)('rejects %s through the pure validator', (_name, spec) => {
    expect(() => validateBudget(spec)).toThrow();
  });

  it('accepts every maximum, together and one field at a time', () => {
    expect(validateBudget(BUDGET_MAX)).toEqual(BUDGET_MAX);
    for (const field of Object.keys(BUDGET_MAX) as (keyof BudgetSpec)[]) {
      expect(validateBudget({ ...budget(), [field]: BUDGET_MAX[field] })).toMatchObject({
        [field]: BUDGET_MAX[field],
      });
    }
    expect(validateBudget({ ...BUDGET_MAX, stackBytes: 1 })).toMatchObject({ stackBytes: 1 });
  });

  it('runs zero goals in the worker for every invalid spec', async () => {
    const { engine, goals } = spyEngine();
    const spied = new EngineSession({
      loadImage: async () => engine,
      expected: manifest.contract,
    });
    await spied.boot(new Uint8Array(0));
    const afterBoot = goals.length;
    for (const [name, spec] of invalid) {
      const response = await spied.handle(
        { id: name, kind: 'query', goal: 'true.', budget: spec } as unknown as EngineRequest,
        new Uint8Array(0),
      );
      expect(response.kind).toBe('error');
      if (response.kind === 'error') expect(response.error.code).toBe('budget');
    }
    expect(goals.length).toBe(afterBoot);
  });

  it('rejects every invalid spec at the client without spawning a worker', async () => {
    let spawns = 0;
    const client = new EngineClient({
      spawn: () => {
        spawns += 1;
        return { addEventListener: () => undefined, postMessage: () => undefined, terminate: () => undefined } as unknown as Worker;
      },
    });
    for (const [, spec] of invalid) {
      const outcome = await client.query('true.', spec as BudgetSpec);
      expect(outcome).toMatchObject({ kind: 'error', error: { code: 'budget' } });
    }
    expect(spawns).toBe(0);
  });
});

// ---------------------------------------------------------------- R03

describe('R03 the JS answer cap is terminal and distinct from honest exhaustion', () => {
  it('stops the real seven-solution goal after one answer at cap 1', async () => {
    const solved = await session.solve(CATEGORY_A_GOAL, budget({ answerCap: 1 }));
    expect(solved).toMatchObject({ kind: 'limit', limit: 'answer-cap' });
    if (solved.kind === 'limit') expect(solved.solutions).toHaveLength(1);
  });

  it('reports honest exhaustion when the cap sits above the solution count', async () => {
    const solved = await session.solve(CATEGORY_A_GOAL, budget({ answerCap: 8 }));
    expect(solved.kind).toBe('solutions');
    if (solved.kind === 'solutions') expect(solved.solutions).toHaveLength(7);
  });

  it('RED: a cap exactly equal to the solution count is honest exhaustion, not a cap trip', async () => {
    const solved = await session.solve(CATEGORY_A_GOAL, budget({ answerCap: 7 }));
    expect(solved.kind).toBe('solutions');
    if (solved.kind === 'solutions') expect(solved.solutions).toHaveLength(7);
  });

  it('bounds `repeat` under a full answer cap through the deadline', async () => {
    const solved = await session.solve(
      'repeat,X=1.',
      budget({ answerCap: BUDGET_MAX.answerCap, wallClockMs: 250 }),
    );
    expect(solved).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
    if (solved.kind === 'limit') expect(solved.solutions.length).toBeLessThan(BUDGET_MAX.answerCap);
    await expectSound();
  }, 60_000);
});

// ---------------------------------------------------------------- R04 / R32

describe('R04/R32 stack exhaustion is its own state and the flag is restored everywhere', () => {
  it('restores the prior stack limit read back from the engine on every exit path', async () => {
    const before = await integerOf(STACK_FLAG, 'V');
    expect(typeof before).toBe('number');

    const paths: [string, () => Promise<unknown>][] = [
      ['success', () => session.solve('between(1,2,X).', budget({ stackBytes: 33554432 }))],
      ['failure', () => session.solve('fail.', budget({ stackBytes: 33554432 }))],
      ['stack trip', () => session.solve('length(L,20000000).', budget({ stackBytes: 8388608 }))],
      ['other limit', () => session.solve('probe_deep(5000).', budget({ depth: 50 }))],
      [
        'exception',
        async () => {
          try {
            return await session.solve('throw(probe_exception).', budget({ stackBytes: 33554432 }));
          } catch (cause) {
            return cause;
          }
        },
      ],
      [
        'cancel',
        async () => {
          const running = session.solve(
            'between(1,1000000,X).',
            budget({ answerCap: BUDGET_MAX.answerCap }),
            'q-stack-cancel',
          );
          await delay(25);
          session.requestCancel('q-stack-cancel');
          return running;
        },
      ],
    ];

    for (const [name, run] of paths) {
      await run();
      expect(await integerOf(STACK_FLAG, 'V'), `after ${name}`).toBe(before);
    }
  }, 180_000);

  it('keeps the stack state distinct from a Prolog error and from every other limit', async () => {
    const stack = await session.solve('length(L,20000000).', budget({ stackBytes: 8388608 }));
    expect(stack).toMatchObject({ kind: 'limit', limit: 'stack' });
    const depth = await session.solve('probe_deep(5000).', budget({ depth: 50 }));
    expect(depth).toMatchObject({ kind: 'limit', limit: 'depth' });
    const inference = await session.solve('probe_deep(5000).', budget({ inferences: 1000 }));
    expect(inference).toMatchObject({ kind: 'limit', limit: 'inference' });
    // A malformed goal is the reachable "generic Prolog error"; the parse guard,
    // not the wrapper, is what produces it.
    const error = await session.handle(
      { id: 'e1', kind: 'query', goal: 'guideline_document(', budget: budget() },
      image,
    );
    expect(error).toMatchObject({ kind: 'error', error: { code: 'prolog' } });
    const failure = await session.solve('fail.', budget());
    expect(failure.kind).toBe('failure');
    await expectSound();
  }, 120_000);
});

// ---------------------------------------------------------------- R05 / R06

describe('R05/R06 depth and inference compose with backtracking', () => {
  it('yields early solutions before the depth limit terminates the run', async () => {
    const solved = await session.solve('between(1,50,X),probe_deep(X).', budget({ depth: 12 }));
    expect(solved).toMatchObject({ kind: 'limit', limit: 'depth' });
    if (solved.kind !== 'limit') return;
    expect(solved.solutions.length).toBeGreaterThan(0);
    expect(solved.solutions.length).toBeLessThan(50);
    const first = solved.solutions[0]?.bindings.X;
    expect(first).toEqual({ kind: 'integer', value: 1 });
  });

  it('yields early solutions before the inference limit terminates the run', async () => {
    // Three cheap solutions, then a 5001-deep one that exceeds the per-step budget.
    const solved = await session.solve(
      'between(1,10,X),N is (X//4)*5000+1,probe_deep(N).',
      budget({ inferences: 1000 }),
    );
    expect(solved).toMatchObject({ kind: 'limit', limit: 'inference' });
    if (solved.kind !== 'limit') return;
    expect(solved.solutions.map((s) => s.bindings.X)).toEqual([
      { kind: 'integer', value: 1 },
      { kind: 'integer', value: 2 },
      { kind: 'integer', value: 3 },
    ]);
  });

  it('measured: `call_with_inference_limit/3` re-arms per solution, so it bounds one step', async () => {
    // 50 solutions of ~800 inferences each run to completion under a 3000 limit,
    // while one 5000-deep solution of ~20000 inferences trips at 1000. The
    // inference budget is therefore a per-solution ceiling, not a request bound.
    const many = await session.solve(
      'between(1,50,X),probe_deep(200).',
      budget({ inferences: 3000 }),
    );
    expect(many.kind).toBe('solutions');
    if (many.kind === 'solutions') expect(many.solutions).toHaveLength(50);
    const one = await session.solve('probe_deep(5000).', budget({ inferences: 1000 }));
    expect(one).toMatchObject({ kind: 'limit', limit: 'inference' });
  }, 120_000);
});

// ---------------------------------------------------------------- R07 / R12

describe('R07/R12 soft wall-clock preserves the engine; every trip leaves it sound', () => {
  it('trips soft wall-clock and keeps the same engine answering', async () => {
    const solved = await session.solve(
      'between(1,1000000,X).',
      budget({ wallClockMs: 40, answerCap: BUDGET_MAX.answerCap }),
    );
    expect(solved).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
    await expectSound();
  }, 60_000);

  it('leaves the session sound after each limit taken in turn', async () => {
    const trips: [string, BudgetSpec, string][] = [
      ['stack', budget({ stackBytes: 8388608 }), 'stack'],
      ['depth', budget({ depth: 50 }), 'depth'],
      ['inference', budget({ inferences: 1000 }), 'inference'],
    ];
    for (const [name, spec, expected] of trips) {
      const goal = name === 'stack' ? 'length(L,20000000).' : 'probe_deep(5000).';
      const solved = await session.solve(goal, spec);
      expect(solved, name).toMatchObject({ kind: 'limit', limit: expected });
      await expectSound();
    }
    const capped = await session.solve(CATEGORY_A_GOAL, budget({ answerCap: 2 }));
    expect(capped).toMatchObject({ kind: 'limit', limit: 'answer-cap' });
    await expectSound();
  }, 180_000);

  it('reports whichever of depth and inference is reached first, not a fixed outer precedence', async () => {
    // `budget.ts:100-102` records "with depth and inference both low the outer
    // inference limit is what reports". Both-low is not sufficient: which one
    // reports tracks which ceiling the goal reaches first.
    const depthFirst = await session.solve(
      'probe_deep(5000).',
      budget({ depth: 50, inferences: 1000 }),
    );
    expect(depthFirst).toMatchObject({ kind: 'limit', limit: 'depth' });
    const inferenceFirst = await session.solve(
      'probe_deep(5000).',
      budget({ depth: 4000, inferences: 1000 }),
    );
    expect(inferenceFirst).toMatchObject({ kind: 'limit', limit: 'inference' });
    const all = await session.solve(
      'probe_deep(5000).',
      budget({ stackBytes: 8388608, depth: 50, inferences: 1000, wallClockMs: 1, answerCap: 1 }),
    );
    expect(all.kind).toBe('limit');
    await expectSound();
  }, 120_000);
});

// ---------------------------------------------------------------- register: raised goals

describe('register: a goal that raises at runtime', () => {
  it('RED: an uncaught Prolog exception must not be reported as an honest failure', async () => {
    const honest = await session.solve('guideline_document(no_such_document,_,_).', budget());
    expect(honest.kind).toBe('failure');
    for (const goal of [
      'throw(probe_exception).',
      'X is foo + 1.',
      'probe_undefined_predicate(1).',
    ]) {
      const raised = await session.handle(
        { id: 'raise', kind: 'query', goal, budget: budget() },
        image,
      );
      // The iterator delivers `{done:false, value:undefined}` and routes the
      // message to stderr, so the shipped loop sees zero solutions and reports
      // `failure` — the same answer an honest zero-proof goal gets.
      expect(raised, goal).toMatchObject({ kind: 'error', error: { code: 'prolog' } });
    }
  }, 120_000);
});

// ---------------------------------------------------------------- R22

describe('R22 malformed goals execute no prefix; honest failure stays distinct', () => {
  it('rejects an unparsable goal whose prefix would have asserted a clause', async () => {
    const response = await session.handle(
      {
        id: 'm1',
        kind: 'query',
        goal: 'assertz(probe_prefix_ran), guideline_document(',
        budget: budget(),
      },
      image,
    );
    expect(response).toMatchObject({ kind: 'error', error: { code: 'prolog' } });
    const probe = await session.solve('catch(probe_prefix_ran,_,fail).', budget());
    expect(probe.kind).toBe('failure');
  });

  it('keeps an honest zero-solution goal distinct from every limit', async () => {
    const solved = await session.solve('guideline_document(no_such_document,_,_).', budget());
    expect(solved.kind).toBe('failure');
  });
});

// ---------------------------------------------------------------- R23 / R24

const sinkSession = (
  hooks: 'printErr' | 'on_output' | 'both',
): { session: EngineSession; captured: string[]; engines: Engine[] } => {
  const captured: string[] = [];
  const engines: Engine[] = [];
  const options: Record<string, unknown> = { print: () => undefined };
  if (hooks !== 'on_output') options.printErr = (line: string) => captured.push(line);
  if (hooks !== 'printErr') {
    options.on_output = (line: string, stream: string) => {
      if (stream === 'stderr') captured.push(line);
    };
  }
  const base = loaderWith(options);
  return {
    captured,
    engines,
    session: new EngineSession({
      loadImage: async (bytes) => {
        const engine = await base(bytes);
        engines.push(engine);
        return engine;
      },
      drain: () => captured.splice(0, captured.length),
      expected: manifest.contract,
    }),
  };
};

describe('R23 consult diagnostics are fatal through each hook in isolation', () => {
  it.each(['printErr', 'on_output', 'both'] as const)(
    'accepts a clean consult and kills the engine on a syntax error with %s only',
    async (hooks) => {
      const { session: sinked } = sinkSession(hooks);
      await sinked.boot(image);
      expect(
        (await sinked.handle({ id: 'ok', kind: 'consult', source: 'probe_clean.\n' }, image)).kind,
      ).toBe('consulted');
      const broken = await sinked.handle(
        { id: 'bad', kind: 'consult', source: 'probe_broken(.\n' },
        image,
      );
      expect(broken, hooks).toMatchObject({ kind: 'error', error: { code: 'consult' } });
      const after = await sinked.handle(
        { id: 'after', kind: 'query', goal: 'true.', budget: budget() },
        image,
      );
      expect(after).toMatchObject({ kind: 'error', error: { code: 'consult' } });
    },
    180_000,
  );

  it('treats a failing directive as fatal', async () => {
    const { session: sinked } = sinkSession('both');
    await sinked.boot(image);
    const response = await sinked.handle(
      { id: 'd1', kind: 'consult', source: 'probe_ok.\n:- fail.\n' },
      image,
    );
    expect(response).toMatchObject({ kind: 'error', error: { code: 'consult' } });
  }, 180_000);

  it('accepts an image load that emits only the tolerated qsave shlib warnings', async () => {
    const lines = ['Warning: ... library(shlib) ...', 'Warning: library(shlib) again'];
    const tolerant = new EngineSession({
      loadImage: loaderWith({}),
      drain: () => lines.splice(0, lines.length),
      expected: manifest.contract,
    });
    await expect(tolerant.boot(image)).resolves.toEqual(manifest.contract);
  }, 180_000);

  it('rejects an image load that emits any extra warning beside the tolerated ones', async () => {
    const lines = ['Warning: library(shlib) tolerated', 'ERROR: something else'];
    const strict = new EngineSession({
      loadImage: loaderWith({}),
      drain: () => lines.splice(0, lines.length),
      expected: manifest.contract,
    });
    await expect(strict.boot(image)).rejects.toThrow(/diagnostics/);
  }, 180_000);

  it('RED: the qsave shlib tolerance must apply at image load only, never to a runtime consult', async () => {
    let phase = 0;
    const tolerated = new EngineSession({
      loadImage: loaderWith({}),
      // Silent at boot; emits a shlib line only for the runtime load.
      drain: () => (++phase > 2 ? ['Warning: library(shlib) at runtime'] : []),
      expected: manifest.contract,
    });
    await tolerated.boot(image);
    const response = await tolerated.handle(
      { id: 'shlib', kind: 'consult', source: 'probe_shlib.\n' },
      image,
    );
    expect(response).toMatchObject({ kind: 'error', error: { code: 'consult' } });
  }, 180_000);
});

describe('R24 a contaminated engine never reaches the caller', () => {
  it('leaves clauses resident in the old engine and absent from the replacement', async () => {
    const { session: dirty, engines } = sinkSession('both');
    await dirty.boot(image);
    const source = 'probe_before.\nprobe_broken(.\nprobe_after.\n:- probe_after.\n';
    const response = await dirty.handle({ id: 'c1', kind: 'consult', source }, image);
    expect(response).toMatchObject({ kind: 'error', error: { code: 'consult' } });

    // Only the harness can still see the poisoned engine; that is the point.
    const raw = engines[0];
    if (raw === undefined) throw new Error('no engine captured');
    const resident = raw.prolog.query('catch(probe_before,_,fail).').once() as {
      success?: boolean;
    };
    expect(resident.success).not.toBe(false);

    // Every route the client has is refused.
    for (const request of [
      { id: 'q1', kind: 'query', goal: 'probe_before.', budget: budget() },
      { id: 'q2', kind: 'consult', source: 'probe_more.\n' },
    ] as EngineRequest[]) {
      expect(await dirty.handle(request, image)).toMatchObject({
        kind: 'error',
        error: { code: 'consult' },
      });
    }

    const replacement = new EngineSession({ loadImage: loaderWith({}), expected: manifest.contract });
    expect(await replacement.boot(image)).toEqual(manifest.contract);
    for (const probe of ['probe_before', 'probe_after']) {
      expect((await replacement.solve(`catch(${probe},_,fail).`, budget())).kind).toBe('failure');
    }
  }, 180_000);
});

// ---------------------------------------------------------------- R13 / R15

/** Worker-shaped adapter that owns its OWN session, so a respawn really rebuilds. */
class GenerationWorker {
  static built: GenerationWorker[] = [];
  static loads = 0;
  readonly seen: EngineRequest[] = [];
  terminated = false;
  readonly #session: EngineSession;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor() {
    GenerationWorker.built.push(this);
    this.#session = new EngineSession({
      loadImage: async (bytes) => {
        GenerationWorker.loads += 1;
        return loaderWith({})(bytes);
      },
      expected: manifest.contract,
    });
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    if (request.kind === 'cancel') {
      this.#deliver({
        id: request.id,
        kind: 'ack',
        accepted: this.#session.requestCancel(request.target),
      });
      return;
    }
    setTimeout(() => {
      if (this.terminated) return;
      void this.#session.handle(request, image).then((response) => {
        this.#deliver(response);
      });
    }, 0);
  }

  #deliver(response: EngineResponse): void {
    if (this.terminated) return;
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }

  terminate(): void {
    this.terminated = true;
  }
}

const generationClient = (): EngineClient => {
  GenerationWorker.built = [];
  GenerationWorker.loads = 0;
  return new EngineClient({ spawn: () => new GenerationWorker() as unknown as Worker });
};

describe('R13 cooperative cancel targets one request and keeps the engine', () => {
  it('cancels only the target, keeps the generation, and answers category A afterwards', async () => {
    const client = generationClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      expect(await client.cancel('r-unknown')).toBe(false);

      const controller = new AbortController();
      const running = client.query(
        'between(1,100000000,X).',
        budget({ answerCap: BUDGET_MAX.answerCap }),
        controller.signal,
      );
      await delay(40);
      controller.abort();
      controller.abort();
      const outcome = await running;
      expect(outcome.kind).toBe('cancelled');

      expect(await client.cancel('r-unknown')).toBe(false);
      const followUp = await client.query(CATEGORY_A_GOAL, budget());
      expect(followUp.kind).toBe('solutions');
      if (followUp.kind === 'solutions') expect(followUp.solutions).toHaveLength(7);
      // One worker, one image load: no reboot and no generation change.
      expect(GenerationWorker.built).toHaveLength(1);
      expect(GenerationWorker.loads).toBe(1);
      expect(GenerationWorker.built[0]?.terminated).toBe(false);
    } finally {
      client.dispose();
    }
  }, 180_000);
});

describe('R14/R15 hard cancel rebuilds the engine and drops asserted state', () => {
  it('drops a dynamic overlay and reports the document count from the replacement engine', async () => {
    const client = generationClient();
    try {
      const booted = await client.boot();
      expect(booted).toMatchObject({ kind: 'booted', contract: manifest.contract });

      const overlay = `overlay_${process.pid}`;
      const asserted = await client.query(
        `dynamic(${overlay}/1),assertz(${overlay}(present)).`,
        budget(),
      );
      expect(asserted.kind).toBe('solutions');
      const present = await client.query(`${overlay}(V).`, budget());
      expect(present.kind).toBe('solutions');
      if (present.kind === 'solutions') {
        expect(present.solutions[0]?.bindings.V).toEqual({ kind: 'atom', value: 'present' });
      }

      const after = await client.reset('probe hard cancel');
      expect(after).toMatchObject({ kind: 'booted', contract: manifest.contract });

      // A fresh worker, a fresh image load, no residue, contract from engine output.
      expect(GenerationWorker.built).toHaveLength(2);
      expect(GenerationWorker.built[0]?.terminated).toBe(true);
      expect(GenerationWorker.loads).toBe(2);
      const gone = await client.query(`catch(${overlay}(_),_,fail).`, budget());
      expect(gone.kind).toBe('failure');
      const documents = await client.query(DOCUMENT_COUNT, budget());
      expect(documents.kind).toBe('solutions');
      if (documents.kind === 'solutions') {
        expect(documents.solutions[0]?.bindings.N).toEqual({
          kind: 'integer',
          value: manifest.contract.documents,
        });
      }
    } finally {
      client.dispose();
    }
  }, 240_000);
});

// ---------------------------------------------------------------- R09

describe('R09 heap exhaustion', () => {
  it('RED: a heap limit must force recreation, as D9 claims; the client reuses the worker', async () => {
    const workers: { terminated: boolean; reply: (response: EngineResponse) => void }[] = [];
    const client = new EngineClient({
      spawn: () => {
        const listeners: ((event: unknown) => void)[] = [];
        let last = '';
        const worker = {
          terminated: false,
          addEventListener: (type: string, listener: (event: unknown) => void) => {
            if (type === 'message') listeners.push(listener);
          },
          postMessage: (request: EngineRequest) => {
            last = request.id;
          },
          terminate: () => {
            worker.terminated = true;
          },
          reply: (response: EngineResponse) => {
            for (const listener of listeners) listener({ data: { ...response, id: last } });
          },
        };
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });
    const running = client.query('probe.', budget());
    await delay(0);
    workers[0]?.reply({ id: '', kind: 'limit', limit: 'heap', solutions: [] });
    expect(await running).toMatchObject({ kind: 'limit', limit: 'heap' });
    await delay(0);
    expect(workers[0]?.terminated).toBe(true);
    client.dispose();
  });
});

// ---------------------------------------------------------------- R31

describe('R31 budget assertions are engine-sensitive', () => {
  it('a stubbed engine cannot satisfy any limit assertion', async () => {
    const { engine } = spyEngine();
    const stubbed = new EngineSession({ loadImage: async () => engine, expected: manifest.contract });
    await stubbed.boot(new Uint8Array(0));
    // The same calls that reach `limit` against the real image return `failure` here.
    for (const [goal, spec] of [
      ['length(L,20000000).', budget({ stackBytes: 8388608 })],
      ['probe_deep(5000).', budget({ depth: 50 })],
      ['probe_deep(5000).', budget({ inferences: 1000 })],
      [CATEGORY_A_GOAL, budget({ answerCap: 1 })],
    ] as [string, BudgetSpec][]) {
      const solved = await stubbed.solve(goal, spec);
      expect(solved.kind).not.toBe('limit');
    }
  });
});

// ---------------------------------------------------------------- R43

describe('R43 classification reads decoded structure alone', () => {
  it('ignores every message-shaped payload and selects on atom identity only', () => {
    // Identical text, different decoded structure: only the atom classifies.
    for (const kind of ['string', 'atom'] as const) {
      const outcome = readOutcome({ BudgetInference_: { kind, value: 'inference_limit_exceeded' } });
      expect(outcome.kind).toBe(kind === 'atom' ? 'limit' : 'solution');
    }
    // A compound or dict carrying the same functor text never selects a limit.
    expect(
      readOutcome({
        BudgetResource_: { kind: 'compound', functor: 'stack', args: [{ kind: 'atom', value: 'x' }] },
      }).kind,
    ).toBe('solution');
    expect(readOutcome({ BudgetResource_: { kind: 'dict', tag: 'stack', entries: {} } }).kind).toBe(
      'solution',
    );
    // Misleading user bindings cannot fabricate a limit.
    expect(
      readOutcome({
        Message: { kind: 'string', value: 'stack_overflow: resource_error(stack)' },
        Other: { kind: 'atom', value: 'depth_limit_exceeded' },
      }).kind,
    ).toBe('solution');
    // Exactly the three wrapper variables select, and each to its own state.
    expect(readOutcome({ BudgetResource_: { kind: 'atom', value: 'stack' } })).toEqual({
      kind: 'limit',
      limit: 'stack',
    });
    expect(readOutcome({ BudgetDepth_: { kind: 'atom', value: 'depth_limit_exceeded' } })).toEqual({
      kind: 'limit',
      limit: 'depth',
    });
    // An unbound wrapper variable is not a limit.
    expect(readOutcome({ BudgetResource_: { kind: 'variable', id: 1 } }).kind).toBe('solution');
  });

  it('catches stack structurally, so it never reaches the message-only native path', async () => {
    const solved = await session.solve('length(L,20000000).', budget({ stackBytes: 8388608 }));
    expect(solved).toMatchObject({ kind: 'limit', limit: 'stack' });
  }, 60_000);
});

// ---------------------------------------------------------------- R26 / R44

describe('R26/R44 production depends on undeclared swipl-wasm API', () => {
  it('uses iterator and close members the package `.d.ts` does not declare', async () => {
    const declarations = readFileSync(
      join(dirname(dirname(fileURLToPath(import.meta.url))), 'node_modules/swipl-wasm/dist/common.d.ts'),
      'utf8',
    );
    // The declared `Query` type is exactly `next` and `once`.
    expect(declarations).toMatch(/next\(\): unknown;/);
    expect(declarations).toMatch(/once\(\): unknown;/);
    expect(declarations).not.toMatch(/Symbol\.iterator/);
    expect(declarations).not.toMatch(/close\(/);
    // The declared `Prolog` type carries no term constructors.
    for (const member of ['Compound', 'List', 'Rational', 'String:', 'Var']) {
      expect(declarations).not.toContain(member);
    }
    // All three are present at runtime and load-bearing, which is the gap.
    const probe = new EngineSession({ loadImage: loaderWith({}), expected: manifest.contract });
    await probe.boot(image);
    const solved = await probe.solve('between(1,2,X).', budget());
    expect(solved.kind).toBe('solutions');
  }, 180_000);
});
