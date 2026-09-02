// The worker's request dispatcher, factored out of the Worker shell.
//
// Vitest runs in Node, where the DOM `Worker` global is absent, so the engine
// logic lives here as a plain object a test can drive directly against the real
// saved image. `worker.ts` adds only message plumbing.
//
// The image loader is injected because the browser reaches it through Vite's
// CommonJS interop and Node reaches it through `createRequire`.

import {
  assertGoalAvoidsReserved,
  BudgetError,
  readOutcome,
  validateBudget,
  wrapGoal,
} from './budget.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineError,
  EngineRequest,
  EngineResponse,
  SolveResult,
  LimitKind,
  PlSolution,
} from './protocol.js';

export type { SolveResult };
import {
  createEncoder,
  decodeOnce,
  DecodeError,
  type PlTerm,
  type PrologConstructors,
} from './terms.js';

interface PrologQuery {
  once(): unknown;
  [Symbol.iterator](): Iterator<unknown>;
  /**
   * Cuts the query and discards its foreign frame.
   *
   * Missing from the package's `.d.ts`, which declares only `next` and `once`, but
   * present at runtime and load-bearing: the driver abandons the iterator on a cap,
   * a cancel or a deadline, and an abandoned query left open makes every later query
   * on that engine fail. Optional here so a build without it degrades to a throw
   * rather than a silent leak.
   */
  close?(): void;
}

interface Prolog extends PrologConstructors {
  query(goal: string, bindings?: Record<string, unknown>): PrologQuery;
}

export interface Engine {
  prolog: Prolog;
  /** Emscripten's filesystem. Absent means runtime loading is refused, not improvised. */
  FS?: { writeFile(path: string, data: string): void };
}

export type ImageLoader = (image: Uint8Array) => Promise<Engine>;

export interface SessionOptions {
  loadImage: ImageLoader;
  /** Values the build recorded; the booted engine must agree with them. */
  expected: EngineContract;
  /**
   * Returns and clears every diagnostic line the engine emitted since the last call.
   * Without one, runtime loading is refused: a failing consult reports success and
   * leaves its clauses resident, so drained stderr is the only honest signal.
   */
  drain?: () => string[];
}

/** Matches `write_canonical`, so display text re-reads as the same term. */
const DISPLAY_OPTIONS = '[quoted(true),numbervars(true),ignore_ops(true)]';

const SCHEMA_GOAL = 'findall(V,guideline_schema_version(V),Vs),sort(Vs,Us),length(Us,N),Us=[S].';
const DOCUMENTS_GOAL = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).';
const STACK_FLAG_GOAL = 'current_prolog_flag(stack_limit,V).';

const CONSULT_PATH = '/u3-runtime-load.pl';

/** Diagnostics `qsave_program` emits under WASM for reasons unrelated to the payload. */
const TOLERATED = /library\(shlib\)/;

/**
 * Hand the event loop a macrotask.
 *
 * A microtask yield does not admit posted messages, so it cannot deliver a cancel;
 * only returning to the task queue does. This is what makes cooperative abort real,
 * at a granularity of one solution step — 50.11 ms worst step over 80 sampled Node
 * steps on this corpus, a sample maximum rather than a per-goal or browser bound.
 */
const yieldToEvents = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Held cancels awaiting their query. Small: one session runs one query at a time. */
const DEFERRED_CANCELS = 8;

const message = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const fail = (code: EngineError['code'], cause: unknown): EngineError => ({
  code,
  message: message(cause),
});

const requireInteger = (term: PlTerm | undefined, what: string): number => {
  if (term?.kind !== 'integer' || typeof term.value !== 'number') {
    throw new Error(`engine did not report ${what} as an integer`);
  }
  return term.value;
};

export class EngineSession {
  #engine: Engine | undefined;
  #contract: EngineContract | undefined;
  /** In-flight boot, so concurrent callers share one image load. */
  #booting: Promise<EngineContract> | undefined;
  #active: string | undefined;
  #cancelling = false;
  /** Cancels that arrived before their query did; see `requestCancel`. */
  readonly #deferred = new Set<string>();
  /** A failed runtime load leaves clauses resident, so its engine is never reused. */
  #poisoned: string | undefined;
  readonly #options: SessionOptions;

  constructor(options: SessionOptions) {
    this.#options = options;
  }

  get booted(): boolean {
    return this.#engine !== undefined;
  }

  /**
   * Boot once; a later request reuses the same engine rather than reloading it.
   *
   * Caching the finished engine is not enough. Two boots issued before the first
   * resolves both miss that check and load the image twice, so the in-flight promise
   * is what single-flights them. It clears on settle, leaving a failed boot retryable.
   */
  async boot(image: Uint8Array): Promise<EngineContract> {
    if (this.#engine !== undefined && this.#contract !== undefined) return this.#contract;
    this.#booting ??= this.#bootOnce(image).finally(() => {
      this.#booting = undefined;
    });
    return this.#booting;
  }

  async #bootOnce(image: Uint8Array): Promise<EngineContract> {
    const engine = await this.#options.loadImage(image);
    this.#failClosed(engine, 'image load', TOLERATED);
    const contract = readContract(engine);
    const { expected } = this.#options;
    if (
      contract.schemaVersion !== expected.schemaVersion ||
      contract.documents !== expected.documents
    ) {
      throw new ContractMismatch(
        `engine reports schema ${contract.schemaVersion} with ${contract.documents} documents, ` +
          `manifest records schema ${expected.schemaVersion} with ${expected.documents}`,
      );
    }
    this.#engine = engine;
    this.#contract = contract;
    return contract;
  }

  /**
   * Ask the running query to stop at its next solution boundary.
   *
   * Returns whether the target was the request actually in flight; an unknown or
   * already-settled id is reported, not silently accepted.
   *
   * A cancel can still outrun its query, because the worker awaits between receiving
   * the query message and entering `solve`. Such a target is held rather than dropped,
   * so the matching `solve` starts already cancelling instead of running to completion.
   */
  requestCancel(target: string): boolean {
    if (this.#active === target) {
      this.#cancelling = true;
      return true;
    }
    this.#deferred.add(target);
    // A target that never arrives would accumulate forever, and only the newest can
    // still be in flight. Holding an already-settled id costs nothing either, because
    // the client mints ids monotonically and never reuses one.
    if (this.#deferred.size > DEFERRED_CANCELS) {
      this.#deferred.delete(this.#deferred.values().next().value as string);
    }
    return false;
  }

  /** Run one goal under its budget and return every solution decoded. */
  async solve(goal: string, budget: BudgetSpec, id = ''): Promise<SolveResult> {
    const engine = this.#require();
    assertGoalAvoidsReserved(goal);
    // An unparsable goal yields no solution instead of raising, so without this
    // guard a malformed goal is indistinguishable from an honest zero-answer run.
    const parsed = decodeOnce(engine.prolog.query('term_string(T,S).', { S: goal }).once());
    if (parsed.kind !== 'bindings') {
      throw new PrologFailure(
        parsed.kind === 'prolog-error' ? parsed.message : `goal does not parse: ${goal}`,
      );
    }

    const restore = this.#lowerStack(engine, budget.stackBytes);
    this.#active = id;
    this.#cancelling = this.#deferred.delete(id);
    const started = Date.now();
    const encode = createEncoder(engine.prolog);
    const solutions: PlSolution[] = [];
    const query = engine.prolog.query(wrapGoal(goal, budget));
    const iterator = query[Symbol.iterator]();
    // A cancel held from before dispatch settles the run without proving a solution:
    // the caller asked to stop before any answer existed.
    let stopped: LimitKind | 'cancelled' | undefined = this.#cancelling ? 'cancelled' : undefined;
    try {
      while (stopped === undefined) {
        const step = iterator.next();
        // A final solution can arrive together with `done: true`; reading `value`
        // before `done` is what keeps the last answer.
        if (step.value !== undefined) {
          const result = decodeOnce(step.value);
          if (result.kind === 'prolog-error') throw new PrologFailure(result.message);
          if (result.kind === 'bindings') {
            const outcome = readOutcome(result.bindings);
            if (outcome.kind === 'limit') {
              stopped = outcome.limit;
            } else if (outcome.kind === 'resource') {
              throw new PrologFailure(`unclassified resource error: ${outcome.resource}`);
            } else if (solutions.length >= budget.answerCap) {
              // Proving one solution past the cap and discarding it is the only thing
              // that separates a truncated run from a run holding exactly `answerCap`
              // answers, which owes the caller honest exhaustion instead.
              stopped = 'answer-cap';
            } else {
              const display: Record<string, string> = {};
              for (const [name, term] of Object.entries(outcome.bindings)) {
                display[name] = this.#display(engine, encode(term));
              }
              solutions.push({ bindings: outcome.bindings, display });
            }
          }
        }
        if (stopped !== undefined || step.done === true) break;
        // The only point where a posted cancel can land, and the only point where
        // elapsed time is observable: `next()` itself is synchronous and uninterruptible.
        await yieldToEvents();
        if (this.#cancelling) {
          stopped = 'cancelled';
          break;
        }
        if (Date.now() - started > budget.wallClockMs) {
          stopped = 'wall-clock';
          break;
        }
      }
    } finally {
      query.close?.();
      restore();
      this.#active = undefined;
      this.#cancelling = false;
    }

    if (stopped === 'cancelled') return { kind: 'cancelled', solutions };
    if (stopped !== undefined) return { kind: 'limit', limit: stopped, solutions };
    return solutions.length === 0 ? { kind: 'failure' } : { kind: 'solutions', solutions };
  }

  /**
   * Load Prolog text into the running engine, fail-closed on any diagnostic.
   *
   * The result value is worthless here: a syntax error and a failing directive both
   * return success, throw nothing, and leave their clauses loaded. Drained stderr is
   * the only signal, and because the load already mutated the engine, a diagnostic
   * poisons the session rather than merely failing the request.
   */
  consult(source: string): void {
    const engine = this.#require();
    const { drain } = this.#options;
    if (drain === undefined) throw new ConsultFailure('runtime loading needs a diagnostic sink');
    if (engine.FS === undefined) throw new ConsultFailure('engine exposes no filesystem');
    drain();
    engine.FS.writeFile(CONSULT_PATH, source);
    const result = decodeOnce(engine.prolog.query(`consult('${CONSULT_PATH}').`).once());
    this.#failClosed(engine, 'runtime load');
    if (result.kind === 'prolog-error') throw new ConsultFailure(result.message);
    if (result.kind === 'failure') throw new ConsultFailure('runtime load failed');
  }

  /** Turn one request into exactly one response; never throws. */
  async handle(request: EngineRequest, image: Uint8Array): Promise<EngineResponse> {
    const { id } = request;
    try {
      switch (request.kind) {
        case 'boot':
          return { id, kind: 'booted', contract: await this.boot(image) };
        case 'cancel':
          return { id, kind: 'ack', accepted: this.requestCancel(request.target) };
        case 'consult':
          this.consult(request.source);
          return { id, kind: 'consulted' };
        case 'query': {
          // Revalidated here because the client is not the only thing that can post.
          const budget = validateBudget(request.budget);
          const solved = await this.solve(request.goal, budget, id);
          return solved.kind === 'failure' ? { id, kind: 'failure' } : { id, ...solved };
        }
        default: {
          const exhaustive: never = request;
          return exhaustive;
        }
      }
    } catch (cause) {
      return { id, kind: 'error', error: classify(cause, request.kind) };
    }
  }

  #require(): Engine {
    if (this.#poisoned !== undefined) throw new ConsultFailure(this.#poisoned);
    const engine = this.#engine;
    if (engine === undefined) throw new Error('engine is not booted');
    return engine;
  }

  /**
   * Narrow the stack for one query and hand back its undo.
   *
   * The undo runs from a `finally`, not from `setup_call_cleanup/3`, because the
   * driver abandons the iterator on a cap, a cancel or a deadline — exactly the paths
   * where in-Prolog cleanup never runs. The restored value is read back, so a failed
   * restore is a thrown error rather than a quietly crippled engine.
   */
  #lowerStack(engine: Engine, bytes: number): () => void {
    const previous = requireInteger(this.#queryOne(engine, STACK_FLAG_GOAL).V, 'stack limit');
    engine.prolog.query(`set_prolog_flag(stack_limit,${bytes}).`).once();
    return () => {
      engine.prolog.query(`set_prolog_flag(stack_limit,${previous}).`).once();
      const now = requireInteger(this.#queryOne(engine, STACK_FLAG_GOAL).V, 'stack limit');
      if (now !== previous) throw new Error(`stack limit restored to ${now}, expected ${previous}`);
    };
  }

  #queryOne(engine: Engine, goal: string): Record<string, PlTerm | undefined> {
    const result = decodeOnce(engine.prolog.query(goal).once());
    if (result.kind !== 'bindings') throw new PrologFailure(`no binding from ${goal}`);
    return result.bindings;
  }

  /**
   * Any drained diagnostic is fatal, and it poisons the engine that produced it.
   *
   * `tolerated` is passed only where the noise is known to belong to that phase.
   * `qsave_program` emits the `library(shlib)` pair while writing the image, so the
   * same text out of a runtime consult is a real diagnostic, not build noise.
   */
  #failClosed(engine: Engine, phase: string, tolerated?: RegExp): void {
    const lines = (this.#options.drain?.() ?? []).filter((line) => tolerated?.test(line) !== true);
    if (lines.length === 0) return;
    if (engine === this.#engine) this.#poisoned = `engine discarded after ${phase} diagnostics`;
    throw new ConsultFailure(`${phase} emitted diagnostics: ${lines.join(' / ')}`);
  }

  /** Ask the engine to render a term; never assemble display text in JS. */
  #display(engine: Engine, encoded: unknown): string {
    const raw = engine.prolog.query(`term_string(T,S,${DISPLAY_OPTIONS}).`, { T: encoded }).once();
    const result = decodeOnce(raw);
    if (result.kind !== 'bindings') throw new PrologFailure('term_string/3 produced no binding');
    const text = result.bindings.S;
    if (text?.kind !== 'string' && text?.kind !== 'atom') {
      throw new DecodeError('term_string/3 did not return text');
    }
    return text.value;
  }
}

export class ContractMismatch extends Error {
  override name = 'ContractMismatch';
}

export class PrologFailure extends Error {
  override name = 'PrologFailure';
}

export class ConsultFailure extends Error {
  override name = 'ConsultFailure';
}

const classify = (cause: unknown, kind: EngineRequest['kind']): EngineError => {
  if (cause instanceof ContractMismatch) return fail('contract', cause);
  if (cause instanceof BudgetError) return fail('budget', cause);
  if (cause instanceof ConsultFailure) return fail('consult', cause);
  if (cause instanceof DecodeError) return fail('decode', cause);
  if (cause instanceof PrologFailure) return fail('prolog', cause);
  return fail(kind === 'boot' ? 'boot' : 'prolog', cause);
};

/** Read schema and document count out of the engine; neither is a literal here. */
const readContract = (engine: Engine): EngineContract => {
  const schema = decodeOnce(engine.prolog.query(SCHEMA_GOAL).once());
  if (schema.kind !== 'bindings') {
    throw new ContractMismatch('engine reports no single schema version');
  }
  const documents = decodeOnce(engine.prolog.query(DOCUMENTS_GOAL).once());
  if (documents.kind !== 'bindings') throw new ContractMismatch('engine reports no documents');
  return {
    schemaVersion: requireInteger(schema.bindings.S, 'schema version'),
    documents: requireInteger(documents.bindings.N, 'document count'),
  };
};
