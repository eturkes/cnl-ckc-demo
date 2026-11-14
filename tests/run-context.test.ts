// `.agent/contracts/n1.md` R1–R8: the evaluation date as run context, through the real saved
// image (node project, one worker). R3/R4/R7 are also graded blind by the merged acceptance suite.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';

import { ChatController } from '../src/chat/ChatController.svelte.js';
import { ReplayChatClient } from '../src/chat/client.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import type { QueryOutcome } from '../src/engine/client.js';
import {
  admitRunContext,
  RunContextError,
  UNDATED,
  type RunContext,
} from '../src/engine/context.js';
import type { BudgetSpec, EngineResponse, ProofOutcome } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import type { AnswerResult, MarksOutcome } from '../src/questions/service.js';

import { holds } from './support/property.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const manifest = JSON.parse(
  readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
) as { contract: { schemaVersion: number; documents: number } };

/** Every Prolog call the session makes goes through this counter. */
let calls = 0;
let raw: Engine['prolog'] | undefined;
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const engine = await (typeof factory === 'function' ? factory : factory.default)(bytes)({});
  const query = engine.prolog.query.bind(engine.prolog);
  engine.prolog.query = (...args: Parameters<typeof query>) => {
    calls += 1;
    return query(...args);
  };
  raw = { ...engine.prolog, query };
  return engine;
};

let session: EngineSession;
let serial = 0;
beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
}, 120_000);

const DATED: RunContext = { evaluationDate: '2022-12-01' };
const ask = (
  goal: string,
  context: unknown,
  budget: BudgetSpec = BUDGET_MAX,
): Promise<EngineResponse> =>
  session.handle(
    { id: `r${String(++serial)}`, kind: 'query', goal, budget, context } as never,
    image,
  );
const dates = (response: EngineResponse): string[] =>
  response.kind === 'solutions' ? response.solutions.map((s) => s.display.D ?? '') : [];
/** The raw run context, read below every wrapper. */
const rawContext = (): string => {
  const outcome = raw?.query("(nb_current('$clinical_run_context',V)->true;V=absent).").once() as
    { V?: unknown } | undefined;
  return JSON.stringify(outcome?.V ?? null);
};

describe('evaluation date as run context', () => {
  it('R1 admits exactly the real ISO days, refusing everything else before Prolog runs', async () => {
    const real = (y: number, m: number, d: number): boolean => {
      const date = new Date(Date.UTC(2000, 0, 1));
      date.setUTCFullYear(y, m - 1, d);
      return (
        y >= 1 &&
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
      );
    };
    const pad = (n: number, w: number): string => String(n).padStart(w, '0');
    holds(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 13 }),
        fc.integer({ min: 0, max: 32 }),
        (y, m, d) => {
          const text = `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
          if (y <= 9999 && real(y, m, d))
            expect(admitRunContext({ evaluationDate: text }).evaluationDate).toBe(text);
          else expect(() => admitRunContext({ evaluationDate: text })).toThrow(RunContextError);
        },
      ),
    );
    for (const bad of [
      '2023-02-29',
      '0000-01-01',
      '2022-1-01',
      ' 2022-12-01',
      '2022-12-01T00',
      20221201,
      undefined,
    ]) {
      expect(() => admitRunContext({ evaluationDate: bad })).toThrow(RunContextError);
    }
    expect(() => admitRunContext(null)).toThrow(RunContextError);
    expect(admitRunContext({ evaluationDate: '2024-02-29' }).evaluationDate).toBe('2024-02-29');
    const before = calls;
    const refused = await ask('guideline_document(D,_,_,_).', { evaluationDate: '2023-02-29' });
    expect(refused.kind === 'error' ? refused.error.code : refused.kind).toBe('context');
    expect(calls).toBe(before);
  });

  it('R2 an admitted context is a frozen copy', () => {
    const caller = { evaluationDate: '2022-12-01' as string | null };
    const admitted = admitRunContext(caller);
    caller.evaluationDate = '2023-01-01';
    expect(admitted.evaluationDate).toBe('2022-12-01');
    expect(Object.isFrozen(admitted)).toBe(true);
  });

  it('R3 the native date and the interpreter date agree under every context', async () => {
    for (const [context, expected] of [
      [UNDATED, []],
      [DATED, ['20221201']],
      [{ evaluationDate: '2022-12-29' }, ['20221229']],
    ] as const) {
      expect(dates(await ask('guideline_evaluation_date(D).', context))).toEqual(expected);
      expect(
        dates(await ask('derive(guideline_evaluation_date(D),4,[],_,proved).', context)),
      ).toEqual(expected);
    }
  });

  it('R4 the raw context is restored after success, failure and error', async () => {
    expect(rawContext()).toBe('"none"');
    for (const goal of ['true.', 'fail.', 'atom_length(_,_).', 'between(1,9,_).']) {
      await ask(goal, DATED);
      expect(rawContext(), goal).toBe('"none"');
    }
  });

  it('R4 the raw context is restored after a cap, every limit, a deadline and a cancel', async () => {
    const exits: [string, string, Partial<BudgetSpec>, string][] = [
      ['answer cap', 'between(1,9,_).', { answerCap: 1 }, 'answer-cap'],
      ['inference', 'between(1,inf,_), fail.', { inferences: 10_000 }, 'inference'],
      ['depth', `${QUESTION_CATALOG[QUESTION_IDS[0]].goal}`, { depth: 2 }, 'depth'],
      ['stack', 'length(L,10000000), L = [_|_].', { stackBytes: 8_388_608 }, 'stack'],
      ['deadline', 'between(1,inf,_).', { wallClockMs: 50 }, 'wall-clock'],
    ];
    for (const [label, goal, budget, limit] of exits) {
      const response = await ask(goal, DATED, { ...BUDGET_MAX, ...budget });
      expect(response.kind === 'limit' ? response.limit : response.kind, label).toBe(limit);
      expect(rawContext(), label).toBe('"none"');
    }
    let cancelled = false;
    const streamed = await session.handle(
      {
        id: 'cancel-a',
        kind: 'query',
        goal: 'between(1,inf,_).',
        budget: BUDGET_MAX,
        context: DATED,
      },
      image,
      (response) => {
        if (response.kind !== 'partial' || cancelled) return;
        cancelled = true;
        void session.handle({ id: 'cancel-b', kind: 'cancel', target: 'cancel-a' }, image);
      },
    );
    expect(streamed.kind).toBe('cancelled');
    expect(rawContext()).toBe('"none"');
  });

  it('R5 a query and a proof arriving while a query streams are refused busy and touch no Prolog', async () => {
    let sent = false;
    let refusals: Promise<EngineResponse[]> = Promise.resolve([]);
    let during = -1;
    const first = session.handle(
      {
        id: 'busy-a',
        kind: 'query',
        goal: 'guideline_evaluation_date(D), between(1,3,_).',
        budget: BUDGET_MAX,
        context: DATED,
      },
      image,
      (response) => {
        if (response.kind !== 'partial' || sent) return;
        sent = true;
        const before = calls;
        refusals = Promise.all([
          session.handle(
            { id: 'busy-b', kind: 'query', goal: 'true.', budget: BUDGET_MAX, context: UNDATED },
            image,
          ),
          session.handle(
            {
              id: 'busy-c',
              kind: 'proof',
              input: { goal: 'true.', selected: {} },
              budget: BUDGET_MAX,
              context: UNDATED,
            },
            image,
          ),
        ]).then((responses) => {
          during = calls - before;
          return responses;
        });
      },
    );
    const settled = await first;
    const codes = (await refusals).map((r) => (r.kind === 'error' ? r.error.code : r.kind));
    expect(codes).toEqual(['busy', 'busy']);
    expect(during).toBe(0);
    expect(dates(settled)).toEqual(['20221201', '20221201', '20221201']);
    expect((await ask('true.', UNDATED)).kind).toBe('solutions');
  });

  it('R7 a model goal may read the date but never set it', async () => {
    const model = (goal: string, context: RunContext): Promise<EngineResponse> =>
      session.handle(
        {
          id: `m${String(++serial)}`,
          kind: 'query',
          goal,
          budget: BUDGET_MAX,
          context,
          readonly: true,
        },
        image,
      );
    // Each write also rides beside a KB read: a goal reading no KB predicate is refused for that
    // alone, so only the joined form shows the write itself is what the guard refuses.
    const writes = [
      'clinical_run(date(20221201),guideline_evaluation_date(D))',
      "nb_setval('$clinical_run_context',date(20221201))",
      "b_setval('$clinical_run_context',date(20221201))",
      "nb_delete('$clinical_run_context')",
    ];
    for (const goal of writes.flatMap((write) => [
      `${write}.`,
      `once(guideline_schema_version(_)), ${write}.`,
    ])) {
      const refused = await model(goal, UNDATED);
      expect(refused.kind === 'error' ? refused.error.code : refused.kind, goal).toBe('guard');
    }
    expect(dates(await model('guideline_evaluation_date(D).', DATED))).toEqual(['20221201']);
    expect(rawContext()).toBe('"none"');
  });

  it('R6 a dated proof opens with one run record; an undated one has none; the cache keys on the date', async () => {
    const id = QUESTION_IDS[0];
    const entry = QUESTION_CATALOG[id];
    const answered = await ask(entry.goal, UNDATED);
    if (answered.kind !== 'solutions') throw new Error('catalog answer missing');
    const selected = answered.solutions[0]?.display ?? {};
    const prove = async (context: RunContext): Promise<ProofOutcome> => {
      const response = await session.handle(
        {
          id: `p${String(++serial)}`,
          kind: 'proof',
          input: { goal: entry.goal, selected },
          budget: BUDGET_MAX,
          context,
        },
        image,
      );
      if (response.kind !== 'proof') throw new Error(`no proof: ${response.kind}`);
      return response;
    };
    const undated = await prove(UNDATED);
    const dated = await prove(DATED);
    if (undated.kind !== 'proof' || dated.kind !== 'proof') throw new Error('unreachable');
    expect(undated.steps.some((step) => step.kind === 'context')).toBe(false);
    expect(dated.steps[0]).toEqual({ kind: 'context', goal: 'evaluation_date(20221201)' });
    expect(dated.steps.filter((step) => step.kind === 'context')).toHaveLength(1);
    expect(dated.steps.slice(1)).toEqual(undated.steps);
    const before = calls;
    await prove(DATED);
    expect(calls).toBe(before);
    await prove({ evaluationDate: '2023-01-01' });
    expect(calls).toBeGreaterThan(before);
  });

  it('R6 a proof that reads the date twice opens with one record of it; undated it fails', async () => {
    const twice = (context: RunContext): Promise<EngineResponse> =>
      session.handle(
        {
          id: `p${String(++serial)}`,
          kind: 'proof',
          input: {
            goal: 'guideline_evaluation_date(D), guideline_evaluation_date(E).',
            selected: { D: '20221201', E: '20221201' },
          },
          budget: BUDGET_MAX,
          context,
        },
        image,
      );
    const dated = await twice(DATED);
    expect(dated.kind === 'proof' ? dated.steps : dated).toEqual([
      { kind: 'context', goal: 'evaluation_date(20221201)' },
    ]);
    expect((await twice(UNDATED)).kind).toBe('failure');
  });
});

class RecordingEngine implements DemoEngine {
  readonly contexts: { call: string; context: RunContext }[] = [];
  #release: ((result: AnswerResult) => void) | undefined;
  boot() {
    return Promise.resolve({ kind: 'booted' as const, contract: manifest.contract });
  }
  ask(id: unknown, _budget: BudgetSpec, context: RunContext): Promise<AnswerResult> {
    this.contexts.push({ call: 'ask', context });
    return new Promise((resolve) => {
      this.#release = resolve;
    }).then(
      () =>
        ({
          kind: 'answer',
          id,
          serialized: 'x',
          solutions: [{ bindings: {}, display: {} }],
        }) as AnswerResult,
    );
  }
  settle(): void {
    this.#release?.({} as AnswerResult);
  }
  marks(_id: unknown, _budget: BudgetSpec, context: RunContext): Promise<MarksOutcome> {
    this.contexts.push({ call: 'marks', context });
    return Promise.resolve({ kind: 'failure' });
  }
  prove(_input: unknown, _budget: BudgetSpec, context: RunContext): Promise<ProofOutcome> {
    this.contexts.push({ call: 'prove', context });
    return Promise.resolve({ kind: 'failure' });
  }
  runGoal(_goal: string, _budget: BudgetSpec, context: RunContext): Promise<QueryOutcome> {
    this.contexts.push({ call: 'chat', context });
    return Promise.resolve({ kind: 'failure' });
  }
  dispose(): void {}
}

describe('one run, one date', () => {
  it('R8 a run keeps the date it was admitted with across its answer, marks and proof', async () => {
    const engine = new RecordingEngine();
    const controller = new DemoController(engine);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.evaluationDate = '2022-12-01';
    controller.select(QUESTION_IDS[0]);
    const running = controller.run();
    controller.evaluationDate = '2023-01-01';
    engine.settle();
    await running;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const seen = engine.contexts.map(
      ({ call, context }) => `${call}:${String(context.evaluationDate)}`,
    );
    expect(seen).toEqual(['ask:2022-12-01', 'marks:2022-12-01', 'prove:2022-12-01']);
    expect(controller.runDate).toBe('2022-12-01');
    controller.dispose();
  });
});

describe('one chat turn, one date', () => {
  it('R9 a turn runs every goal under the date captured at send and shows it on each card', async () => {
    const seen: string[] = [];
    const host = {
      evaluationDate: '2022-12-01' as string | null,
      runGoal(goal: string, context: RunContext): Promise<QueryOutcome> {
        seen.push(`${goal} ${String(context.evaluationDate)}`);
        host.evaluationDate = '2023-01-01';
        return Promise.resolve({ kind: 'failure' });
      },
    };
    const segments = [{ text: 'x', source: 'kb', queries: ['q1', 'q2'], urls: [] }];
    const client = new ReplayChatClient([
      {
        message: 'two goals',
        events: [
          { type: 'conversation', id: 'c1' },
          { type: 'query', call: 'q1', goal: 'g1.' },
          { type: 'query', call: 'q2', goal: 'g2.' },
          { type: 'answer', text: JSON.stringify({ segments }) },
          { type: 'done' },
        ],
      },
    ]);
    const controller = new ChatController({ client, host });
    try {
      await controller.submit('two goals');
      expect(seen).toEqual(['g1. 2022-12-01', 'g2. 2022-12-01']);
      const message = controller.messages.at(-1);
      if (message?.role !== 'assistant') throw new Error('no assistant message');
      expect(message.evaluationDate).toBe('2022-12-01');
      expect(
        message.cards.map(({ call, evaluationDate }) => `${call} ${String(evaluationDate)}`),
      ).toEqual(['q1 2022-12-01', 'q2 2022-12-01']);
    } finally {
      controller.dispose();
    }
  });
});
