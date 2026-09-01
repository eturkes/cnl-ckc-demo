// Typed main-thread client. Holds no engine state: it owns the Worker, correlates
// requests, bounds them in wall-clock time, and settles every caller exactly once.
//
// The hard deadline lives here rather than in the worker because a worker timer
// cannot fire while the engine is inside a synchronous step: measured, an in-worker
// 25 ms timer never fired across 249.80 ms of `repeat,fail` while the identical
// main-thread timer fired at 25.97 ms.

import { validateBudget } from './budget.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineError,
  EngineRequestBody,
  EngineResponse,
  LimitKind,
  PlSolution,
} from './protocol.js';

export type QueryOutcome =
  | { kind: 'solutions'; solutions: PlSolution[] }
  | { kind: 'failure' }
  | { kind: 'limit'; limit: LimitKind; solutions: PlSolution[] }
  | { kind: 'cancelled'; solutions: PlSolution[] }
  | { kind: 'error'; error: EngineError };

export type BootOutcome =
  { kind: 'booted'; contract: EngineContract } | { kind: 'error'; error: EngineError };

/**
 * Slack between the worker's own soft deadline and the client's hard one.
 *
 * The worker checks elapsed time between solutions, so it can overshoot by at most
 * one step — 62 ms worst case on real goals. The grace lets that soft trip report
 * itself, with its engine intact, before termination becomes the answer.
 */
const HARD_GRACE_MS = 500;

interface Pending {
  resolve: (response: EngineResponse) => void;
  generation: number;
  timer: unknown;
}

export interface ClientOptions {
  /** Vite needs the literal `new URL` form to emit the worker as its own bundle. */
  spawn?: () => Worker;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
}

const defaultSpawn = (): Worker =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export class EngineClient {
  readonly #pending = new Map<string, Pending>();
  readonly #options: Required<ClientOptions>;
  #worker: Worker | undefined;
  #nextId = 0;
  #generation = 0;
  #disposed = false;
  #resetting: Promise<BootOutcome> | undefined;

  constructor(options: ClientOptions = {}) {
    this.#options = {
      spawn: options.spawn ?? defaultSpawn,
      schedule: options.schedule ?? ((fn, ms) => setTimeout(fn, ms)),
      cancelSchedule: options.cancelSchedule ?? ((handle) => clearTimeout(handle as never)),
    };
  }

  /** Reported when a response arrives that no pending request claimed. */
  onProtocolViolation: ((error: EngineError) => void) | undefined;

  #settle(id: string, response: EngineResponse): void {
    const pending = this.#pending.get(id);
    if (pending === undefined) return;
    if (pending.timer !== undefined) this.#options.cancelSchedule(pending.timer);
    this.#pending.delete(id);
    pending.resolve(response);
  }

  /** Reject every in-flight caller, so a dead worker never leaves a promise hanging. */
  #abort(message: string): void {
    const error: EngineError = { code: 'worker', message };
    for (const id of [...this.#pending.keys()]) this.#settle(id, { id, kind: 'error', error });
  }

  #ensure(): Worker {
    if (this.#disposed) throw new Error('client is disposed');
    if (this.#worker !== undefined) return this.#worker;
    const worker = this.#options.spawn();
    const generation = ++this.#generation;
    worker.addEventListener('message', (event: MessageEvent<EngineResponse>) => {
      // A message from a terminated generation must never claim a live request:
      // ids stay monotonic, but a queued response can still outlive its worker.
      if (generation !== this.#generation) return;
      const response = event.data;
      // An unclaimed id means the two sides disagree about what is in flight;
      // surfacing it beats dropping a response that some caller is awaiting.
      if (!this.#pending.has(response.id)) {
        this.onProtocolViolation?.({
          code: 'protocol',
          message: `response ${response.id} matched no pending request`,
        });
        return;
      }
      this.#settle(response.id, response);
    });
    worker.addEventListener('error', (event) => {
      if (generation === this.#generation) this.#abort(event.message || 'worker failed');
    });
    worker.addEventListener('messageerror', () => {
      if (generation === this.#generation) this.#abort('client could not deserialize a response');
    });
    this.#worker = worker;
    return worker;
  }

  #send(request: EngineRequestBody, deadlineMs?: number): Promise<EngineResponse> {
    const id = `r${++this.#nextId}`;
    let worker: Worker;
    try {
      worker = this.#ensure();
    } catch (cause) {
      return Promise.resolve(protocolError(id, cause));
    }
    return new Promise<EngineResponse>((resolve) => {
      const timer =
        deadlineMs === undefined
          ? undefined
          : this.#options.schedule(() => {
              this.#onDeadline(id);
            }, deadlineMs);
      this.#pending.set(id, { resolve, generation: this.#generation, timer });
      try {
        worker.postMessage({ ...request, id });
      } catch (cause) {
        this.#settle(id, protocolError(id, cause));
      }
    });
  }

  /** The engine outlived its budget inside an uninterruptible step; only termination ends it. */
  #onDeadline(id: string): void {
    if (!this.#pending.has(id)) return;
    this.#settle(id, { id, kind: 'limit', limit: 'wall-clock', solutions: [] });
    void this.reset(`wall-clock deadline exceeded for ${id}`);
  }

  async boot(): Promise<BootOutcome> {
    return asBoot(await this.#send({ kind: 'boot' }));
  }

  async query(goal: string, budget: BudgetSpec): Promise<QueryOutcome> {
    let spec: BudgetSpec;
    try {
      spec = validateBudget(budget);
    } catch (cause) {
      return {
        kind: 'error',
        error: { code: 'budget', message: cause instanceof Error ? cause.message : String(cause) },
      };
    }
    const response = await this.#send(
      { kind: 'query', goal, budget: spec },
      spec.wallClockMs + HARD_GRACE_MS,
    );
    switch (response.kind) {
      case 'solutions':
        return { kind: 'solutions', solutions: response.solutions };
      case 'failure':
        return { kind: 'failure' };
      case 'limit':
        return { kind: 'limit', limit: response.limit, solutions: response.solutions };
      case 'cancelled':
        return { kind: 'cancelled', solutions: response.solutions };
      case 'error':
        return { kind: 'error', error: response.error };
      default:
        return {
          kind: 'error',
          error: { code: 'protocol', message: `query answered with ${response.kind}` },
        };
    }
  }

  /** Load Prolog text into the running engine. Any diagnostic discards that engine. */
  async consult(
    source: string,
  ): Promise<{ kind: 'consulted' } | { kind: 'error'; error: EngineError }> {
    const response = await this.#send({ kind: 'consult', source });
    if (response.kind === 'consulted') return { kind: 'consulted' };
    return {
      kind: 'error',
      error:
        response.kind === 'error'
          ? response.error
          : { code: 'protocol', message: `consult answered with ${response.kind}` },
    };
  }

  /**
   * Ask the running query to stop at its next solution boundary, keeping the engine.
   *
   * `accepted` is false when the target is unknown or already settled — a cancel for
   * a finished request is reported, not treated as success.
   */
  async cancel(target: string): Promise<boolean> {
    const response = await this.#send({ kind: 'cancel', target });
    return response.kind === 'ack' && response.accepted;
  }

  /**
   * Hard cancel: terminate, respawn, reboot, re-verify the contract.
   *
   * Nothing survives but the browser's HTTP cache, which is the point — asserted
   * state and a saturated heap are exactly what a soft cancel cannot clear.
   * Single-flighted so concurrent triggers produce one termination.
   */
  async reset(reason = 'client reset the worker'): Promise<BootOutcome> {
    this.#resetting ??= this.#hardReset(reason).finally(() => {
      this.#resetting = undefined;
    });
    return this.#resetting;
  }

  async #hardReset(reason: string): Promise<BootOutcome> {
    if (this.#disposed) {
      return { kind: 'error', error: { code: 'worker', message: 'client is disposed' } };
    }
    this.#worker?.terminate();
    this.#worker = undefined;
    // Retiring the generation before settling keeps a late response from the dead
    // worker out of the requests the respawn is about to serve.
    this.#generation += 1;
    this.#abort(reason);
    return asBoot(await this.#send({ kind: 'boot' }));
  }

  /** Drop the worker and every promise it still owes. Terminal: there is no respawn. */
  dispose(): void {
    this.#disposed = true;
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#generation += 1;
    this.#abort('client disposed the worker');
  }
}

const protocolError = (id: string, cause: unknown): EngineResponse => ({
  id,
  kind: 'error',
  error: { code: 'protocol', message: cause instanceof Error ? cause.message : String(cause) },
});

const asBoot = (response: EngineResponse): BootOutcome =>
  response.kind === 'booted'
    ? { kind: 'booted', contract: response.contract }
    : {
        kind: 'error',
        error:
          response.kind === 'error'
            ? response.error
            : { code: 'protocol', message: `boot answered with ${response.kind}` },
      };
