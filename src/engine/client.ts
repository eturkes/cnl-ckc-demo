// Typed main-thread client. Holds no engine state: it owns the Worker, correlates
// requests, bounds them in wall-clock time, and settles every caller exactly once.
//
// The hard deadline lives here rather than in the worker because a worker timer
// cannot fire while the engine is inside a synchronous step: measured, an in-worker
// 25 ms timer never fired across 249.80 ms of `repeat,fail` while the identical
// main-thread timer fired at 25.97 ms.

import { validateBudget } from './budget.js';
import { notify, PROOF_BUDGET_MAX, WORKER_FAILURE_ID } from './protocol.js';
import type {
  BootProgress,
  BudgetSpec,
  EngineContract,
  EngineError,
  EngineRequestBody,
  EngineResponse,
  PlSolution,
  ProofInput,
  ProofOutcome,
  SolveResult,
} from './protocol.js';

export type { BootProgress, ProofInput, ProofOutcome, ProofStep } from './protocol.js';

/** The session's arms plus the one outcome only the client can produce. */
export type QueryOutcome = SolveResult | { kind: 'error'; error: EngineError };

export type BootOutcome =
  { kind: 'booted'; contract: EngineContract } | { kind: 'error'; error: EngineError };

/**
 * Slack between the worker's own soft deadline and the client's hard one.
 *
 * The worker checks elapsed time between solutions, so it can overshoot by at most
 * one step — 50.11 ms worst case over 80 sampled Node steps. The grace lets that soft trip report
 * itself, with its engine intact, before termination becomes the answer.
 */
const HARD_GRACE_MS = 500;

/** One initial attempt and one automatic replacement attempt are allowed. */
const BOOT_DEADLINE_MS = 30_000;

/**
 * Hard bound on a runtime load.
 *
 * A `:- Goal.` directive runs arbitrary Prolog inside the live engine, so `consult`
 * needs a watchdog for exactly the reason a query does — it has no soft check between
 * solutions and no cancel. Set far above the 2806 ms a full 337-file corpus consult
 * measures, because only a runaway directive should ever reach it.
 */
const CONSULT_DEADLINE_MS = 10_000;

type Listener =
  | { kind: 'progress'; hear: ((progress: BootProgress) => void) | undefined }
  | {
      kind: 'partial';
      hear: ((solution: PlSolution) => void) | undefined;
      /** Every answer already streamed, so a watchdog settlement still carries them. */
      streamed: PlSolution[];
    };

interface Pending {
  resolve: (response: EngineResponse) => void;
  timer: unknown;
  abort: { signal: AbortSignal; listener: () => void } | undefined;
  /** What this request reports before it settles: a boot its phases, a query its answers. */
  listener: Listener | undefined;
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
      schedule:
        options.schedule ??
        ((fn, ms) => {
          const handle = setTimeout(fn, ms);
          // A caller that abandons the client must not keep a Node test process
          // alive solely for its watchdog. Browser timer handles are numbers.
          if (typeof handle === 'object' && 'unref' in handle) handle.unref();
          return handle;
        }),
      cancelSchedule: options.cancelSchedule ?? ((handle) => clearTimeout(handle as never)),
    };
  }

  /** Reported when a response arrives that no pending request claimed. */
  onProtocolViolation: ((error: EngineError) => void) | undefined;

  #settle(id: string, response: EngineResponse): void {
    const pending = this.#pending.get(id);
    if (pending === undefined) return;
    if (pending.timer !== undefined) this.#options.cancelSchedule(pending.timer);
    if (pending.abort !== undefined) {
      pending.abort.signal.removeEventListener('abort', pending.abort.listener);
    }
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
      // A worker-level failure names no request, so it settles all of them: the
      // worker that reported it will never answer what it is already holding.
      if (response.id === WORKER_FAILURE_ID) {
        this.#abort(
          response.kind === 'error' ? response.error.message : `worker reported ${response.kind}`,
        );
        return;
      }
      // An unclaimed id means the two sides disagree about what is in flight;
      // surfacing it beats dropping a response that some caller is awaiting.
      const pending = this.#pending.get(response.id);
      if (pending === undefined) {
        this.onProtocolViolation?.({
          code: 'protocol',
          message: `response ${response.id} matched no pending request`,
        });
        return;
      }
      if (response.kind === 'progress' || response.kind === 'partial') {
        const { listener } = pending;
        if (response.kind === 'progress' && listener?.kind === 'progress') {
          const { phase, bytes } = response;
          notify(listener.hear, bytes === undefined ? { phase } : { phase, bytes });
        } else if (response.kind === 'partial' && listener?.kind === 'partial') {
          listener.streamed.push(response.solution);
          notify(listener.hear, response.solution);
        } else {
          this.onProtocolViolation?.({
            code: 'protocol',
            message: `${response.kind} for ${response.id}, which reports none`,
          });
        }
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

  // Cancellation arrives as a signal rather than as a returned run handle because
  // the correlation id is exactly what must not escape: a caller holding `rN` could
  // cancel a request it never issued. The signal carries the authority instead, and
  // `cancel` stays internal.
  #send(
    request: EngineRequestBody,
    deadlineMs?: number,
    signal?: AbortSignal,
    deadline?: (id: string) => void,
    listener?: Listener,
  ): Promise<EngineResponse> {
    const id = `r${++this.#nextId}`;
    // An aborted signal is aborted forever, so a reused one must not boot a worker
    // just to cancel it. Retry mints a fresh controller.
    if (signal?.aborted) {
      return Promise.resolve({ id, kind: 'cancelled', solutions: [] });
    }
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
              (deadline ?? ((target) => this.#onDeadline(target)))(id);
            }, deadlineMs);
      let cancelSent = false;
      const abort =
        signal === undefined
          ? undefined
          : {
              signal,
              listener: (): void => {
                if (cancelSent || !this.#pending.has(id)) return;
                cancelSent = true;
                void this.cancel(id);
              },
            };
      this.#pending.set(id, { resolve, timer, abort, listener });
      try {
        worker.postMessage({ ...request, id });
      } catch (cause) {
        this.#settle(id, protocolError(id, cause));
        return;
      }
      // Posting first preserves query→cancel FIFO if setup code aborts reentrantly.
      if (abort !== undefined && this.#pending.has(id)) {
        abort.signal.addEventListener('abort', abort.listener, { once: true });
        if (abort.signal.aborted) abort.listener();
      }
    });
  }

  /** The engine outlived its budget inside an uninterruptible step; only termination ends it. */
  #onDeadline(id: string): void {
    if (!this.#pending.has(id)) return;
    // Answers that streamed before the stuck step were rendered whole and stay real.
    const listener = this.#pending.get(id)?.listener;
    const solutions = listener?.kind === 'partial' ? listener.streamed : [];
    this.#settle(id, { id, kind: 'limit', limit: 'wall-clock', solutions });
    void this.reset(`wall-clock deadline exceeded for ${id}`);
  }

  /** A hung image load is retired without recursively starting another boot. */
  #onBootDeadline(id: string): void {
    if (!this.#pending.has(id)) return;
    this.#settle(id, {
      id,
      kind: 'error',
      error: { code: 'boot', message: `boot exceeded ${BOOT_DEADLINE_MS} ms` },
    });
    this.#retire(`worker retired after boot deadline for ${id}`);
  }

  /** Drop the current worker so the next request spawns a fresh one. */
  #retire(reason: string): void {
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#generation += 1;
    this.#abort(reason);
  }

  async #bootAttempt(
    onProgress?: (progress: BootProgress) => void,
  ): Promise<{ outcome: BootOutcome; timedOut: boolean; generation: number }> {
    let timedOut = false;
    const sent = this.#send(
      { kind: 'boot' },
      BOOT_DEADLINE_MS,
      undefined,
      (id) => {
        timedOut = true;
        this.#onBootDeadline(id);
      },
      { kind: 'progress', hear: onProgress },
    );
    // `#send` spawns synchronously, so this is the worker the boot was posted to.
    const generation = this.#generation;
    return { outcome: asBoot(await sent), timedOut, generation };
  }

  /** `onProgress` hears each phase the worker reports, a recreated attempt's after `restart`. */
  async boot(onProgress?: (progress: BootProgress) => void): Promise<BootOutcome> {
    const first = await this.#bootAttempt(onProgress);
    // Exactly one automatic recreation, on a hung boot only. A second timeout retires that
    // worker and returns its typed boot error; it never enters an unbounded respawn loop.
    const retried = first.timedOut && !this.#disposed;
    // The retry repeats phases the first attempt already showed, so it opens with its own.
    if (retried) notify(onProgress, { phase: 'restart' });
    const { outcome, generation } = retried ? await this.#bootAttempt(onProgress) : first;
    // A worker that failed its boot keeps what failed it — the worker caches the image fetch,
    // so a rejected one stays rejected — and a retry on it can only fail again. Retiring it is
    // what makes a retry rebuild the engine. Only that worker: a reset or retry may already
    // have replaced it, and its fresh worker is not this boot's to retire.
    if (outcome.kind === 'error' && !this.#disposed && generation === this.#generation)
      this.#retire('worker retired after a failed boot');
    return outcome;
  }

  /** `onSolution` hears each answer as the worker renders it, before the outcome settles. */
  async query(
    goal: string,
    budget: BudgetSpec,
    signal?: AbortSignal,
    onSolution?: (solution: PlSolution) => void,
  ): Promise<QueryOutcome> {
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
      signal,
      undefined,
      { kind: 'partial', hear: onSolution, streamed: [] },
    );
    switch (response.kind) {
      case 'solutions':
        return { kind: 'solutions', solutions: response.solutions };
      case 'failure':
        return { kind: 'failure' };
      case 'limit':
        // A heap trip leaves the engine saturated and its asserted residue live, so
        // reuse is unsound (D9). Awaited rather than fired off like the wall-clock
        // deadline, because here the caller is still on the stack and must not see a
        // heap outcome before its replacement engine has re-verified the contract.
        if (response.limit === 'heap') await this.#recreate();
        return { kind: 'limit', limit: response.limit, solutions: response.solutions };
      case 'cancelled':
        return { kind: 'cancelled', solutions: response.solutions };
      case 'error':
        return { kind: 'error', error: response.error };
      case 'booted':
      case 'proof':
      case 'ack':
      case 'consulted':
      case 'progress':
      case 'partial':
        return {
          kind: 'error',
          error: { code: 'protocol', message: `query answered with ${response.kind}` },
        };
      default: {
        // A new response kind must be classified here rather than fall into a
        // catch-all that reports it as a protocol violation forever.
        const exhaustive: never = response;
        return exhaustive;
      }
    }
  }

  /** Re-prove one selected catalog solution through the compiled meta-interpreter. */
  async prove(input: ProofInput, budget: BudgetSpec, signal?: AbortSignal): Promise<ProofOutcome> {
    let requested: BudgetSpec;
    try {
      requested = validateBudget(budget);
    } catch (cause) {
      return {
        kind: 'error',
        error: { code: 'budget', message: cause instanceof Error ? cause.message : String(cause) },
      };
    }
    const spec: BudgetSpec = {
      stackBytes: Math.min(requested.stackBytes, PROOF_BUDGET_MAX.stackBytes),
      depth: Math.min(requested.depth, PROOF_BUDGET_MAX.depth),
      inferences: Math.min(requested.inferences, PROOF_BUDGET_MAX.inferences),
      wallClockMs: Math.min(requested.wallClockMs, PROOF_BUDGET_MAX.wallClockMs),
      answerCap: 1,
    };
    const response = await this.#send(
      { kind: 'proof', input, budget: spec },
      spec.wallClockMs + HARD_GRACE_MS,
      signal,
    );
    switch (response.kind) {
      case 'proof':
        return { kind: 'proof', steps: response.steps };
      case 'failure':
        return { kind: 'failure' };
      case 'limit':
        if (response.limit === 'heap') await this.#recreate();
        return { kind: 'limit', limit: response.limit };
      case 'cancelled':
        return { kind: 'cancelled' };
      case 'error':
        return { kind: 'error', error: response.error };
      case 'booted':
      case 'solutions':
      case 'ack':
      case 'consulted':
      case 'progress':
      case 'partial':
        return {
          kind: 'error',
          error: { code: 'protocol', message: `proof answered with ${response.kind}` },
        };
      default: {
        const exhaustive: never = response;
        return exhaustive;
      }
    }
  }

  /** Load Prolog text into the running engine. Any diagnostic discards that engine. */
  async consult(
    source: string,
  ): Promise<{ kind: 'consulted' } | { kind: 'error'; error: EngineError }> {
    const response = await this.#send({ kind: 'consult', source }, CONSULT_DEADLINE_MS);
    if (response.kind === 'consulted') return { kind: 'consulted' };
    // The watchdog already terminated the worker, so the load neither completed nor
    // left a usable engine — the same discard a diagnostic earns.
    if (response.kind === 'limit') {
      return {
        kind: 'error',
        error: { code: 'consult', message: `runtime load exceeded ${CONSULT_DEADLINE_MS} ms` },
      };
    }
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
    return this.#reset(reason, false);
  }

  /** A heap recreation's caller awaits the replacement, so its boot runs under the boot deadline. */
  #recreate(): Promise<BootOutcome> {
    const joined = this.#resetting;
    if (joined === undefined) return this.#reset('heap exhausted; engine discarded', true);
    // A reset already in flight may boot unbounded; joining it must not strand this caller.
    const timer = this.#options.schedule(() => {
      this.#retire('worker retired after boot deadline for a heap recreation');
    }, BOOT_DEADLINE_MS);
    return joined.finally(() => {
      this.#options.cancelSchedule(timer);
    });
  }

  #reset(reason: string, bounded: boolean): Promise<BootOutcome> {
    this.#resetting ??= this.#hardReset(reason, bounded).finally(() => {
      this.#resetting = undefined;
    });
    return this.#resetting;
  }

  async #hardReset(reason: string, bounded: boolean): Promise<BootOutcome> {
    if (this.#disposed) {
      return { kind: 'error', error: { code: 'worker', message: 'client is disposed' } };
    }
    this.#worker?.terminate();
    this.#worker = undefined;
    // Retiring the generation before settling keeps a late response from the dead
    // worker out of the requests the respawn is about to serve. `#ensure()` advances
    // it a second time when it respawns; only monotonicity is load-bearing.
    this.#generation += 1;
    this.#abort(reason);
    // One replacement, no automatic retry, unlike `boot()`. Bounded = the boot deadline retires a
    // hung replacement. An explicit or wall-clock reset keeps the unbounded boot and a replacement
    // that answers with an error, which m1u3 P1.1 and P4.4 pin (queue row `A failed reset…`).
    return bounded
      ? (await this.#bootAttempt()).outcome
      : asBoot(await this.#send({ kind: 'boot' }));
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
