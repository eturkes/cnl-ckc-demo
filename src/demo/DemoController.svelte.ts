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
import type {
  BudgetSpec,
  EngineContract,
  EngineError,
  PlSolution,
  ProofInput,
  ProofOutcome,
} from '../engine/protocol.js';
import type { ProvenanceState } from '../provenance/model.js';
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

const PROOF_BUDGET: Readonly<BudgetSpec> = Object.freeze({
  stackBytes: 16_777_216,
  depth: 100,
  inferences: 100_000,
  wallClockMs: 3_000,
  answerCap: 1,
});

/** The controller's whole view of the engine: one boot, one budgeted ask, one dispose. */
export interface DemoEngine {
  boot(): Promise<BootOutcome>;
  ask(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult>;
  prove?(input: ProofInput, budget: BudgetSpec, signal?: AbortSignal): Promise<ProofOutcome>;
  dispose(): void;
}

export const createDemoEngine = (): DemoEngine => {
  const client = new EngineClient();
  const service = new AnswerService(client);
  return {
    boot: () => client.boot(),
    ask: (id, budget, signal) => service.ask(id, budget, signal),
    prove: (input, budget, signal) => client.prove(input, budget, signal),
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
  provenance = $state.raw<ProvenanceState>({ kind: 'idle' });
  /**
   * What the booted engine reported, kept past `idle`.
   *
   * The view states a corpus size, and the only honest source for it is the engine
   * that answers the questions; `idle.contract` disappears the moment a run starts.
   */
  contract = $state.raw<EngineContract | null>(null);

  readonly #engine: DemoEngine;
  #active: ActiveRun | undefined;
  #proofController: AbortController | undefined;
  #proofToken = 0;
  #disposed = false;

  constructor(engine: DemoEngine = createDemoEngine()) {
    this.#engine = engine;
    // `#boot` resolves the outcome into a state and never rejects, so the boot is
    // fire-and-forget: exposing its promise would widen the public API for no reader.
    void this.#boot();
  }

  select(id: QuestionId): void {
    this.selected = id;
  }

  run(): Promise<void> {
    return this.#start(this.selected);
  }

  /** Restarts a failed boot, or reruns the settled question rather than the current selection. */
  retry(): Promise<void> {
    if (this.state.kind === 'boot-error') {
      this.state = { kind: 'booting' };
      return this.#boot();
    }
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
    const rows = this.state.kind === 'settled' ? solutionsOf(this.state.result).length : 0;
    if (Number.isInteger(index) && index >= 0 && index < rows) {
      this.solutionIndex = index;
      if (this.state.kind === 'settled') {
        const solution = solutionsOf(this.state.result)[index];
        if (solution !== undefined) void this.#trace(this.state.id, index, solution);
      }
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#active?.controller.abort();
    this.#proofController?.abort();
    this.#active = undefined;
    this.#engine.dispose();
  }

  async #boot(): Promise<void> {
    let outcome: BootOutcome;
    try {
      outcome = await this.#engine.boot();
    } catch (cause) {
      outcome = {
        kind: 'error',
        error: { code: 'worker', message: cause instanceof Error ? cause.message : String(cause) },
      };
    }
    if (this.#disposed) return;
    if (outcome.kind === 'booted') this.contract = outcome.contract;
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
    this.#proofController?.abort();
    this.#proofController = undefined;
    this.#proofToken += 1;
    this.provenance = { kind: 'idle' };
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
        const first = solutionsOf(result)[0];
        if (first !== undefined) void this.#trace(id, 0, first);
      },
      (cause: unknown) => {
        retire();
        throw cause;
      },
    );

    this.#active = { id, controller, query, done };
    return done;
  }

  async #trace(id: QuestionId, solution: number, selected: PlSolution): Promise<void> {
    if (this.#engine.prove === undefined) {
      this.provenance = { kind: 'unavailable', message: 'Proof tracing is unavailable.' };
      return;
    }
    this.#proofController?.abort();
    const controller = new AbortController();
    this.#proofController = controller;
    const token = ++this.#proofToken;
    this.provenance = { kind: 'loading', solution };
    let outcome: ProofOutcome;
    try {
      outcome = await this.#engine.prove(
        { goal: QUESTION_CATALOG[id].goal, selected: selected.display },
        PROOF_BUDGET,
        controller.signal,
      );
    } catch (cause) {
      outcome = {
        kind: 'error',
        error: { code: 'worker', message: cause instanceof Error ? cause.message : String(cause) },
      };
    }
    if (this.#disposed || controller.signal.aborted || token !== this.#proofToken) return;
    this.#proofController = undefined;
    switch (outcome.kind) {
      case 'proof':
        this.provenance = { kind: 'ready', solution, steps: outcome.steps };
        break;
      case 'failure':
        this.provenance = { kind: 'failure', solution };
        break;
      case 'limit':
        this.provenance = { kind: 'limit', solution, limit: outcome.limit };
        break;
      case 'cancelled':
        this.provenance = { kind: 'cancelled', solution };
        break;
      case 'error':
        this.provenance = { kind: 'error', solution, error: outcome.error };
        break;
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }
}
