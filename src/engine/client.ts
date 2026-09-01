// Typed main-thread client. Holds no engine state: it owns the Worker, correlates
// requests, and settles every caller exactly once.

import type {
  EngineContract,
  EngineError,
  EngineRequestBody,
  EngineResponse,
  PlSolution,
} from './protocol.js';

export type QueryOutcome =
  | { kind: 'solutions'; solutions: PlSolution[] }
  | { kind: 'failure' }
  | { kind: 'error'; error: EngineError };

interface Pending {
  resolve: (response: EngineResponse) => void;
}

/** Vite needs the literal `new URL` form to emit the worker as its own bundle. */
const spawn = (): Worker => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export class EngineClient {
  readonly #pending = new Map<string, Pending>();
  #worker: Worker | undefined;
  #nextId = 0;

  /** Reject every in-flight caller, so a dead worker never leaves a promise hanging. */
  #abort(message: string): void {
    const error: EngineError = { code: 'worker', message };
    for (const [id, pending] of this.#pending) pending.resolve({ id, kind: 'error', error });
    this.#pending.clear();
  }

  #ensure(): Worker {
    if (this.#worker !== undefined) return this.#worker;
    const worker = spawn();
    worker.addEventListener('message', (event: MessageEvent<EngineResponse>) => {
      const response = event.data;
      const pending = this.#pending.get(response.id);
      // An unclaimed id means the two sides disagree about what is in flight;
      // surfacing it beats dropping a response that some caller is awaiting.
      if (pending === undefined) {
        this.onProtocolViolation?.({
          code: 'protocol',
          message: `response ${response.id} matched no pending request`,
        });
        return;
      }
      this.#pending.delete(response.id);
      pending.resolve(response);
    });
    worker.addEventListener('error', (event) => this.#abort(event.message || 'worker failed'));
    worker.addEventListener('messageerror', () =>
      this.#abort('client could not deserialize a response'),
    );
    this.#worker = worker;
    return worker;
  }

  /** Reported when a response arrives that no pending request claimed. */
  onProtocolViolation: ((error: EngineError) => void) | undefined;

  #send(request: EngineRequestBody): Promise<EngineResponse> {
    const id = `r${++this.#nextId}`;
    const worker = this.#ensure();
    return new Promise<EngineResponse>((resolve) => {
      this.#pending.set(id, { resolve });
      try {
        worker.postMessage({ ...request, id });
      } catch (cause) {
        this.#pending.delete(id);
        resolve({
          id,
          kind: 'error',
          error: {
            code: 'protocol',
            message: cause instanceof Error ? cause.message : String(cause),
          },
        });
      }
    });
  }

  async boot(): Promise<
    { kind: 'booted'; contract: EngineContract } | { kind: 'error'; error: EngineError }
  > {
    const response = await this.#send({ kind: 'boot' });
    return response.kind === 'booted'
      ? { kind: 'booted', contract: response.contract }
      : {
          kind: 'error',
          error:
            response.kind === 'error'
              ? response.error
              : { code: 'protocol', message: `boot answered with ${response.kind}` },
        };
  }

  async query(goal: string): Promise<QueryOutcome> {
    const response = await this.#send({ kind: 'query', goal });
    switch (response.kind) {
      case 'solutions':
        return { kind: 'solutions', solutions: response.solutions };
      case 'failure':
        return { kind: 'failure' };
      case 'error':
        return { kind: 'error', error: response.error };
      default:
        return {
          kind: 'error',
          error: { code: 'protocol', message: `query answered with ${response.kind}` },
        };
    }
  }

  /** Drop the worker and every promise it still owes. u3 builds cancellation on this. */
  dispose(): void {
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#abort('client disposed the worker');
  }
}
