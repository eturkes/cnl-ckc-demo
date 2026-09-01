// The demo's run lifecycle: one selection becomes one budgeted Prolog run whose
// every typed outcome is a state the view can render and announce.
//
// Two rules shape the whole file. `EngineSession` holds a single active query and
// an abandoned iterator poisons every later one, so runs are serialized rather
// than overlapped. And a retired run's late result must never overwrite the live
// one, so every state write is gated on the run's own `AbortController` still
// being the active one — `AbortSignal` is multicast and cannot express ownership
// by itself.

import { EngineClient, type BootOutcome } from '../engine/client.js';
import type { BudgetSpec, EngineContract, EngineError, PlSolution } from '../engine/protocol.js';
import { QUESTION_CATALOG, type QuestionId } from '../questions/catalog.js';
import { serializeAnswer } from '../questions/serialize.js';
import { AnswerService, type AnswerResult } from '../questions/service.js';

/**
 * Bounds every demo run. These are working values, not the `BUDGET_MAX` ceilings:
 * ten trials per catalog id against the real image peaked at 119.972 ms.
 *
 * `wallClockMs` is deliberately loose. A deadline that is too tight is the one
 * budget error that produces a dishonest answer — a `limit` where a proof exists
 * — while a loose one only delays a run the user can already cancel.
 */
export const DEMO_BUDGET: Readonly<BudgetSpec> = Object.freeze({
  stackBytes: 67_108_864,
  depth: 100_000,
  inferences: 5_000_000,
  wallClockMs: 5_000,
  answerCap: 32,
});

/** The controller's whole view of the engine: one boot, one budgeted ask, one dispose. */
export interface DemoEngine {
  boot(): Promise<BootOutcome>;
  ask(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult>;
  dispose(): void;
}

export const createDemoEngine = (): DemoEngine => {
  const client = new EngineClient();
  const service = new AnswerService(client);
  return {
    boot: () => client.boot(),
    ask: (id, budget, signal) => service.ask(id, budget, signal),
    dispose: () => {
      client.dispose();
    },
  };
};

export type DemoState =
  | { kind: 'booting' }
  | { kind: 'boot-error'; error: EngineError }
  | { kind: 'idle'; contract: EngineContract }
  | { kind: 'running'; id: QuestionId }
  | { kind: 'cancelling'; id: QuestionId }
  | { kind: 'settled'; id: QuestionId; result: AnswerResult };

interface ActiveRun {
  id: QuestionId;
  controller: AbortController;
  /** Engine call alone. A successor waits on this, never on the state write. */
  query: Promise<unknown>;
  /** Resolves once this run's state write has happened; `cancel()` awaits it. */
  done: Promise<void>;
}

/** `answer`, `limit` and `cancelled` carry rows; `failure`, `error` and `rejected` do not. */
export const solutionsOf = (result: AnswerResult): readonly PlSolution[] =>
  'solutions' in result ? result.solutions : [];

const cancelledResult = (id: QuestionId): AnswerResult => ({
  kind: 'cancelled',
  id,
  serialized: serializeAnswer(QUESTION_CATALOG[id], []),
  solutions: [],
});

export class DemoController {
  // Raw, not deep: every transition assigns a whole new union member and nothing
  // mutates one in place, so deep proxying would only wrap engine-owned results.
  state = $state.raw<DemoState>({ kind: 'booting' });
  selected = $state<QuestionId | null>(null);
  solutionIndex = $state(-1);

  /** Settles when the initial boot has resolved into `idle` or `boot-error`. */
  readonly booted: Promise<void>;

  readonly #engine: DemoEngine;
  #active: ActiveRun | undefined;
  #disposed = false;

  constructor(engine: DemoEngine = createDemoEngine()) {
    this.#engine = engine;
    this.booted = this.#boot();
  }

  get solutions(): readonly PlSolution[] {
    return this.state.kind === 'settled' ? solutionsOf(this.state.result) : [];
  }

  /** The chosen row, or `undefined` while no row is chosen. */
  get solution(): PlSolution | undefined {
    return this.solutions[this.solutionIndex];
  }

  select(id: QuestionId): void {
    this.selected = id;
  }

  run(): Promise<void> {
    return this.#start(this.selected);
  }

  /** Reruns the settled run, never the current selection: changing that is Run's job. */
  retry(): Promise<void> {
    return this.state.kind === 'settled' ? this.#start(this.state.id) : Promise.resolve();
  }

  async cancel(): Promise<void> {
    const active = this.#active;
    if (active === undefined) return;
    active.controller.abort();
    this.state = { kind: 'cancelling', id: active.id };
    await active.done;
  }

  selectSolution(index: number): void {
    if (Number.isInteger(index) && index >= 0 && index < this.solutions.length) {
      this.solutionIndex = index;
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#active?.controller.abort();
    this.#active = undefined;
    this.#engine.dispose();
  }

  async #boot(): Promise<void> {
    const outcome = await this.#engine.boot();
    if (this.#disposed) return;
    this.state =
      outcome.kind === 'booted'
        ? { kind: 'idle', contract: outcome.contract }
        : { kind: 'boot-error', error: outcome.error };
  }

  #start(id: QuestionId | null): Promise<void> {
    const live = this.state.kind !== 'booting' && this.state.kind !== 'boot-error';
    if (id === null || this.#disposed || !live) return Promise.resolve();

    const controller = new AbortController();
    const previous = this.#active;
    previous?.controller.abort();
    this.solutionIndex = -1;
    this.state = { kind: 'running', id };

    const dispatch = (): Promise<AnswerResult> =>
      controller.signal.aborted
        ? Promise.resolve(cancelledResult(id))
        : this.#engine.ask(id, DEMO_BUDGET, controller.signal);

    // Nothing live means the engine call goes out in this same tick; only a
    // predecessor's open iterator defers it, and the replacement is already
    // visible either way.
    const query = previous === undefined ? dispatch() : previous.query.then(dispatch);
    const retire = (): void => {
      if (this.#active?.controller === controller) this.#active = undefined;
    };
    const done = query.then(
      (result) => {
        if (this.#active?.controller !== controller) return;
        retire();
        this.state = { kind: 'settled', id, result };
        this.solutionIndex = solutionsOf(result).length > 0 ? 0 : -1;
      },
      (cause: unknown) => {
        retire();
        throw cause;
      },
    );

    this.#active = { id, controller, query, done };
    return done;
  }
}
