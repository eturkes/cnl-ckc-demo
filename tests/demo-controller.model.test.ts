// u10b oracle — an independent model of `DemoController`'s state transitions, written
// from `.agent/contracts/m5u10b.md` alone, driven differentially against the real
// controller. The model is the second opinion: it must never import the controller's
// own transition code.

import { describe, expect, it } from 'vitest';

import type { BootOutcome } from '../src/engine/client.js';
import type { BudgetSpec, EngineContract } from '../src/engine/protocol.js';
import { QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';
import {
  DemoController,
  type DemoEngine,
  type DemoState,
} from '../src/demo/DemoController.svelte.js';

const CONTRACT: EngineContract = { schemaVersion: 1, documents: 337 };

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};

interface AskPlan {
  token: number;
  id: QuestionId;
  outcome: Deferred<AnswerResult>;
  claimed: boolean;
}

class ScriptedEngine implements DemoEngine {
  readonly bootOutcome = deferred<BootOutcome>();
  readonly plans: AskPlan[] = [];
  readonly asks: Array<{
    token: number;
    id: unknown;
    budget: BudgetSpec;
    signal: AbortSignal | undefined;
  }> = [];
  disposeCalls = 0;

  boot(): Promise<BootOutcome> {
    return this.bootOutcome.promise;
  }

  ask(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult> {
    const plan = this.plans.find(({ claimed }) => !claimed);
    if (plan === undefined) throw new Error(`unplanned ask for ${String(id)}`);
    if (plan.id !== id) throw new Error(`ask ${String(id)} did not match plan ${plan.id}`);
    plan.claimed = true;
    this.asks.push({ token: plan.token, id, budget, signal });
    return plan.outcome.promise;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  plan(token: number, id: QuestionId): AskPlan {
    const plan = { token, id, outcome: deferred<AnswerResult>(), claimed: false };
    this.plans.push(plan);
    return plan;
  }

  planFor(token: number): AskPlan {
    const plan = this.plans.find((candidate) => candidate.token === token);
    if (plan === undefined) throw new Error(`missing ask plan ${String(token)}`);
    return plan;
  }
}

interface ModelRun {
  token: number;
  id: QuestionId;
}

interface Model {
  state: DemoState;
  selected: QuestionId | null;
  contract: EngineContract | null;
  active: ModelRun | null;
  disposed: boolean;
}

type ModelEvent =
  | { kind: 'boot-settled'; outcome: BootOutcome }
  | { kind: 'select'; id: QuestionId }
  | { kind: 'run'; token: number }
  | { kind: 'retry'; token: number }
  | { kind: 'cancel' }
  | { kind: 'select-solution'; index: number }
  | { kind: 'ask-fulfilled'; token: number; result: AnswerResult }
  | { kind: 'ask-rejected'; token: number; cause: unknown }
  | { kind: 'dispose' };

const initialModel = (): Model => ({
  state: { kind: 'booting' },
  selected: null,
  contract: null,
  active: null,
  disposed: false,
});

const start = (model: Model, token: number, id: QuestionId): Model => {
  if (model.disposed || model.contract === null) return model;
  return { ...model, state: { kind: 'running', id }, active: { token, id } };
};

const transition = (model: Model, event: ModelEvent): Model => {
  switch (event.kind) {
    case 'boot-settled':
      if (model.disposed) return model;
      return event.outcome.kind === 'booted'
        ? {
            ...model,
            state: { kind: 'idle', contract: event.outcome.contract },
            contract: event.outcome.contract,
          }
        : { ...model, state: { kind: 'boot-error', error: event.outcome.error } };
    case 'select':
      return { ...model, selected: event.id };
    case 'run':
      return model.selected === null ? model : start(model, event.token, model.selected);
    case 'retry':
      return model.state.kind === 'settled' ? start(model, event.token, model.state.id) : model;
    case 'cancel':
      return model.active === null
        ? model
        : { ...model, state: { kind: 'cancelling', id: model.active.id } };
    case 'select-solution':
      return model;
    case 'ask-fulfilled':
      return model.disposed || model.active?.token !== event.token
        ? model
        : {
            ...model,
            state: { kind: 'settled', id: model.active.id, result: event.result },
            active: null,
          };
    case 'ask-rejected':
      return model.disposed || model.active?.token !== event.token
        ? model
        : {
            ...model,
            state: {
              kind: 'settled',
              id: model.active.id,
              result: {
                kind: 'error',
                id: model.active.id,
                error: {
                  code: 'worker',
                  message: event.cause instanceof Error ? event.cause.message : String(event.cause),
                },
              },
            },
            active: null,
          };
    case 'dispose':
      return { ...model, active: null, disposed: true };
  }
};

type Completion = { kind: 'fulfilled' } | { kind: 'rejected'; reason: unknown };

const observe = (promise: Promise<void>): Promise<Completion> =>
  promise.then<Completion, Completion>(
    () => ({ kind: 'fulfilled' }),
    (reason: unknown) => ({ kind: 'rejected', reason }),
  );

const drain = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

const answer = (id: QuestionId, label: string): AnswerResult => ({
  kind: 'answer',
  id,
  serialized: `${label}-serialized`,
  solutions: [{ bindings: {}, display: { A: `${label}-value` } }],
});

const cancelled = (id: QuestionId): AnswerResult => ({
  kind: 'cancelled',
  id,
  serialized: 'cancelled-serialized',
  solutions: [],
});

class Differential {
  readonly engine = new ScriptedEngine();
  readonly controller = new DemoController(this.engine);
  readonly completions = new Map<number, Promise<Completion>>();
  model = initialModel();
  nextToken = 1;

  expectState(): void {
    expect(this.controller.state).toEqual(this.model.state);
  }

  async boot(outcome: BootOutcome): Promise<void> {
    this.engine.bootOutcome.resolve(outcome);
    this.model = transition(this.model, { kind: 'boot-settled', outcome });
    await drain();
    this.expectState();
  }

  select(id: QuestionId, compare = true): void {
    this.controller.select(id);
    this.model = transition(this.model, { kind: 'select', id });
    if (compare) this.expectState();
  }

  run(): number {
    return this.startRun('run');
  }

  retry(): number {
    return this.startRun('retry');
  }

  cancel(): Promise<Completion> {
    const completion = observe(this.controller.cancel());
    this.model = transition(this.model, { kind: 'cancel' });
    this.expectState();
    return completion;
  }

  selectSolution(index: number): void {
    this.controller.selectSolution(index);
    this.model = transition(this.model, { kind: 'select-solution', index });
    this.expectState();
  }

  async fulfill(token: number, result: AnswerResult): Promise<void> {
    this.engine.planFor(token).outcome.resolve(result);
    this.model = transition(this.model, { kind: 'ask-fulfilled', token, result });
    await drain();
    this.expectState();
  }

  rejectNow(token: number, cause: unknown): void {
    this.engine.planFor(token).outcome.reject(cause);
    this.model = transition(this.model, { kind: 'ask-rejected', token, cause });
  }

  async reject(token: number, cause: unknown, compare = true): Promise<void> {
    this.rejectNow(token, cause);
    await drain();
    if (compare) this.expectState();
  }

  completion(token: number): Promise<Completion> {
    const completion = this.completions.get(token);
    if (completion === undefined) throw new Error(`missing run completion ${String(token)}`);
    return completion;
  }

  dispose(): void {
    this.controller.dispose();
    this.model = transition(this.model, { kind: 'dispose' });
    this.expectState();
  }

  private startRun(kind: 'run' | 'retry'): number {
    const token = this.nextToken;
    this.nextToken += 1;
    const next = transition(
      this.model,
      kind === 'run' ? { kind: 'run', token } : { kind: 'retry', token },
    );
    // `token` here is a monotonic run counter, not a credential — the rule matches on the
    // identifier's name alone and cannot see that.
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (next.active?.token === token) this.engine.plan(token, next.active.id);
    const completion = observe(kind === 'run' ? this.controller.run() : this.controller.retry());
    this.model = next;
    this.completions.set(token, completion);
    this.expectState();
    return token;
  }
}

describe('demo controller transition oracle', () => {
  it('O1 model and controller agree on every driven transition sequence', async () => {
    const driven = new Differential();
    driven.expectState();
    await driven.boot({ kind: 'booted', contract: CONTRACT });
    driven.select(QUESTION_IDS[0]);

    const first = driven.run();
    await driven.fulfill(first, answer(QUESTION_IDS[0], 'first'));
    expect(await driven.completion(first)).toEqual({ kind: 'fulfilled' });
    driven.selectSolution(0);

    const retry = driven.retry();
    const cancel = driven.cancel();
    await driven.fulfill(retry, cancelled(QUESTION_IDS[0]));
    expect(await driven.completion(retry)).toEqual({ kind: 'fulfilled' });
    expect(await cancel).toEqual({ kind: 'fulfilled' });
    driven.dispose();

    const hanging = new Differential();
    hanging.expectState();
    await hanging.boot({ kind: 'booted', contract: CONTRACT });
    hanging.select(QUESTION_IDS[1]);
    hanging.run();
    void hanging.cancel();
    hanging.selectSolution(0);
    hanging.dispose();
  });

  it('O2 model and controller agree on the state a rejected ask leaves behind', async () => {
    const driven = new Differential();
    driven.expectState();
    await driven.boot({ kind: 'booted', contract: CONTRACT });
    driven.select(QUESTION_IDS[0]);
    const run = driven.run();

    await driven.reject(run, new Error('ask rejection sentinel'));
    expect(await driven.completion(run)).toEqual({ kind: 'fulfilled' });
  });

  it('O3 model and controller agree on a run started after a rejected run', async () => {
    const driven = new Differential();
    await driven.boot({ kind: 'booted', contract: CONTRACT });
    driven.select(QUESTION_IDS[0]);
    const predecessor = driven.run();
    driven.rejectNow(predecessor, 'predecessor rejection');
    driven.select(QUESTION_IDS[1], false);
    const successor = driven.run();

    await drain();
    driven.expectState();
    await driven.fulfill(successor, answer(QUESTION_IDS[1], 'successor'));
  });

  it('O4 model and controller agree on a superseded rejection writing nothing', async () => {
    const driven = new Differential();
    await driven.boot({ kind: 'booted', contract: CONTRACT });
    driven.select(QUESTION_IDS[0]);
    const retired = driven.run();
    driven.select(QUESTION_IDS[1]);
    driven.run();

    driven.rejectNow(retired, new Error('retired rejection'));
    await drain();
    driven.expectState();
    void driven.cancel();
  });
});
