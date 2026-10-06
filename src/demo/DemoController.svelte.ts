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
  BootProgress,
  BudgetSpec,
  EngineContract,
  EngineError,
  PlSolution,
  ProofInput,
  ProofOutcome,
} from '../engine/protocol.js';
import { messages } from '../i18n/locale.svelte.js';
import type { ProvenanceState } from '../provenance/model.js';
import { QUESTION_CATALOG, type QuestionId } from '../questions/catalog.js';
import { serializeAnswer } from '../questions/serialize.js';
import { AnswerService, type AnswerResult } from '../questions/service.js';
import { IntakeService, type IntakeDerivation } from '../intake/service.js';

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

/**
 * The controller's whole view of the engine: one boot, one budgeted ask, the selected
 * proof, the intake derivation by rule id, one dispose. No arbitrary goal crosses it.
 */
export interface DemoEngine {
  boot(onProgress?: (progress: BootProgress) => void): Promise<BootOutcome>;
  ask(
    id: unknown,
    budget: BudgetSpec,
    signal?: AbortSignal,
    onSolution?: (solution: PlSolution) => void,
  ): Promise<AnswerResult>;
  prove?(input: ProofInput, budget: BudgetSpec, signal?: AbortSignal): Promise<ProofOutcome>;
  derive?(ruleIds: readonly unknown[], signal?: AbortSignal): Promise<IntakeDerivation>;
  dispose(): void;
}

export const createDemoEngine = (): DemoEngine => {
  const client = new EngineClient();
  const service = new AnswerService(client);
  const intake = new IntakeService(client);
  return {
    boot: (onProgress) => client.boot(onProgress),
    ask: (id, budget, signal, onSolution) => service.ask(id, budget, signal, onSolution),
    prove: (input, budget, signal) => client.prove(input, budget, signal),
    derive: (ruleIds, signal) => intake.derive(ruleIds, signal),
    dispose: () => {
      client.dispose();
    },
  };
};

export type DemoState =
  /** `phase` absent = the worker has reported nothing yet. */
  | ({ kind: 'booting' } & Partial<BootProgress>)
  | { kind: 'boot-error'; error: EngineError }
  | { kind: 'idle'; contract: EngineContract }
  /** `solutions` = the answers streamed so far, absent until the first. */
  | { kind: 'running'; id: QuestionId; solutions?: readonly PlSolution[] }
  | { kind: 'cancelling'; id: QuestionId; solutions?: readonly PlSolution[] }
  | { kind: 'settled'; id: QuestionId; result: AnswerResult };

interface ActiveRun {
  id: QuestionId;
  controller: AbortController;
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
  /** The run whose state write landed last, so a caller awaiting a run can tell it was ITS run. */
  #settledBy: AbortController | undefined;
  /**
   * One engine queue. The session holds a single active request, so a call must not go out
   * while another — an aborted proof included — is still in flight; with nothing in flight it
   * goes out in the caller's own tick.
   */
  #engineCalls = 0;
  #engineTail: Promise<void> = Promise.resolve();
  #proofController: AbortController | undefined;
  #proofToken = 0;
  #disposed = false;

  constructor(engine: DemoEngine = createDemoEngine()) {
    this.#engine = engine;
    // `#boot` resolves the outcome into a state and never rejects, so the boot is
    // fire-and-forget: exposing its promise would widen the public API for no reader.
    void this.#boot();
  }

  select(id: QuestionId | null): void {
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
    const { state } = this;
    this.state =
      (state.kind === 'running' || state.kind === 'cancelling') && state.solutions !== undefined
        ? { kind: 'cancelling', id: active.id, solutions: state.solutions }
        : { kind: 'cancelling', id: active.id };
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

  /**
   * Derive intake rules by id through the same engine queue as every other call. `undefined`
   * = no derivation ran: the engine carries no intake path, has not booted, or is disposed.
   * Boot stays outside the queue, so readiness is checked here, as `#start` checks it.
   */
  derive(ruleIds: readonly unknown[], signal?: AbortSignal): Promise<IntakeDerivation> | undefined {
    const derive = this.#engine.derive?.bind(this.#engine);
    const booted = this.state.kind !== 'booting' && this.state.kind !== 'boot-error';
    if (derive === undefined || !booted || this.#disposed) return undefined;
    return this.#exclusive(() => derive(ruleIds, signal));
  }

  /**
   * Run `question` and select the solution derived from `document` (`m5u16.md` U3).
   *
   * Three built-in questions span several documents and a run settles on solution 0, so
   * opening "the question" alone would show another document's derivation. This waits for
   * ITS run — a newer one supersedes it — then selects by the derived document, and reports
   * a missing document instead of standing on the wrong one.
   */
  async reveal(
    question: QuestionId,
    document: string,
  ): Promise<'shown' | 'missing' | 'superseded' | 'unavailable'> {
    this.select(question);
    const pending = this.run();
    const mine = this.#active?.controller;
    await pending;
    if (mine === undefined || this.#settledBy !== mine || this.#active !== undefined) {
      return mine === undefined ? 'unavailable' : 'superseded';
    }
    if (this.state.kind !== 'settled' || this.state.result.kind !== 'answer') return 'missing';
    const index = this.state.result.solutions.findIndex((solution) => {
      const answer = solution.bindings.Answer;
      const cited = answer?.kind === 'compound' ? answer.args[0] : undefined;
      return (
        answer?.kind === 'compound' &&
        answer.functor === 'clinical_answer' &&
        cited?.kind === 'atom' &&
        cited.value === document
      );
    });
    if (index < 0) return 'missing';
    this.selectSolution(index);
    return 'shown';
  }

  dispose(): void {
    this.#disposed = true;
    this.#active?.controller.abort();
    this.#proofController?.abort();
    this.#active = undefined;
    this.#engine.dispose();
  }

  #exclusive<T>(call: () => Promise<T>): Promise<T> {
    const invoke = (): Promise<T> => {
      try {
        return call();
      } catch (cause) {
        return Promise.reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    };
    const pending = this.#engineCalls === 0 ? invoke() : this.#engineTail.then(invoke, invoke);
    this.#engineCalls += 1;
    const settled = pending.then(
      () => undefined,
      () => undefined,
    );
    this.#engineTail = settled;
    void settled.then(() => {
      this.#engineCalls -= 1;
    });
    return pending;
  }

  async #boot(): Promise<void> {
    let outcome: BootOutcome;
    try {
      outcome = await this.#engine.boot((progress) => {
        if (!this.#disposed && this.state.kind === 'booting') {
          this.state = { kind: 'booting', ...progress };
        }
      });
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

    // Only this run's answers, while it is still the live run, reach the view.
    const stream = (solution: PlSolution): void => {
      const { state } = this;
      if (this.#active?.controller !== controller) return;
      if (state.kind !== 'running' && state.kind !== 'cancelling') return;
      this.state = { ...state, solutions: [...(state.solutions ?? []), solution] };
    };
    const dispatch = (): Promise<AnswerResult> =>
      controller.signal.aborted
        ? Promise.resolve(cancelledResult(id))
        : this.#engine.ask(id, DEMO_BUDGET, controller.signal, stream);

    // Nothing in flight means the engine call goes out in this same tick; any call still
    // open — a predecessor's iterator or an aborted proof — defers it through the queue,
    // and the replacement is already visible either way. The queue runs this call after a
    // predecessor's rejection too, so this run never reports a failure it did not have.
    const query = this.#exclusive(dispatch);
    const retire = (): void => {
      if (this.#active?.controller === controller) this.#active = undefined;
    };
    const settle = (result: AnswerResult): void => {
      if (this.#active?.controller !== controller) return;
      retire();
      this.#settledBy = controller;
      this.state = { kind: 'settled', id, result };
      this.solutionIndex = solutionsOf(result).length > 0 ? 0 : -1;
      const first = solutionsOf(result)[0];
      if (first !== undefined) void this.#trace(id, 0, first);
    };
    // A rejected `ask()` is an outcome, not an escape. Rethrowing it left `running`
    // set while `run()`'s only caller discards the promise, so the view stayed busy
    // forever and Cancel read an already-retired run. `worker` is the code `#boot`
    // and `#trace` already give an unexpected rejection from an engine call.
    const done = query.then(settle, (cause: unknown) => {
      settle({
        kind: 'error',
        id,
        error: { code: 'worker', message: cause instanceof Error ? cause.message : String(cause) },
      });
    });

    this.#active = { id, controller, done };
    return done;
  }

  async #trace(id: QuestionId, solution: number, selected: PlSolution): Promise<void> {
    const prove = this.#engine.prove?.bind(this.#engine);
    if (prove === undefined) {
      const { TEXT } = messages.current;
      this.provenance = { kind: 'unavailable', message: TEXT.traceUnavailable() };
      return;
    }
    this.#proofController?.abort();
    const controller = new AbortController();
    this.#proofController = controller;
    const token = ++this.#proofToken;
    this.provenance = { kind: 'loading', solution };
    let outcome: ProofOutcome;
    try {
      outcome = await this.#exclusive(() =>
        prove(
          { goal: QUESTION_CATALOG[id].goal, selected: selected.display },
          PROOF_BUDGET,
          controller.signal,
        ),
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
