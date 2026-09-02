// The only shape crossing the worker boundary. Both sides import these types;
// neither restates them.
//
// Every payload here is plain data: no class instance, no function, no `Error`.
// Structured clone drops prototypes and accessors and raises `DataCloneError` on
// anything else, so errors travel as scalar fields rather than as objects.

import type { PlBindings } from './terms.js';

/** Values read out of a booted engine, never written as literals. */
export interface EngineContract {
  schemaVersion: number;
  documents: number;
}

/**
 * Every way a bounded query can stop short. Each is its own terminal state so a
 * caller never has to tell two limits apart by reading a message.
 */
export type LimitKind = 'stack' | 'depth' | 'inference' | 'wall-clock' | 'answer-cap' | 'heap';

/**
 * Bounds one query. Prolog enforces `stackBytes`, `depth` and `inferences`; the JS
 * driver enforces `wallClockMs` and `answerCap`.
 *
 * The split is not stylistic. This build reports `threads=false` and has no
 * `library(time)`, `call_with_time_limit/2` or `alarm/4`, so no in-engine clock
 * exists; and Prolog's own limits do not bound a query at all — under a full
 * stack+depth+inference wrapper `repeat` still emitted 100000 solutions in 452 ms
 * with both limit results reporting success.
 */
export interface BudgetSpec {
  stackBytes: number;
  depth: number;
  inferences: number;
  wallClockMs: number;
  answerCap: number;
}

export type EngineErrorCode =
  /** The image failed to fetch, load, or initialize. */
  | 'boot'
  /** The booted engine disagreed with the build manifest. */
  | 'contract'
  /** The goal raised a Prolog exception or was malformed. */
  | 'prolog'
  /** A binding carried a shape the decoder refuses. */
  | 'decode'
  /** A response arrived that no pending request claimed. */
  | 'protocol'
  /** The worker itself failed or was replaced. */
  | 'worker'
  /** A budget spec was absent, malformed, or out of range. */
  | 'budget'
  /** A runtime load emitted a diagnostic, so its engine is discarded. */
  | 'consult';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export interface PlSolution {
  bindings: PlBindings;
  /** Canonical Prolog text per binding, produced by the engine, not by templating. */
  display: Record<string, string>;
}

/**
 * Reserved id for a worker-level failure that belongs to no single request.
 *
 * The client mints ids as `r<n>`, so this collides with nothing, and a response
 * carrying it settles EVERY in-flight caller: a worker that cannot deserialize a
 * request, or that rejects a promise nobody awaits, will never answer them.
 */
export const WORKER_FAILURE_ID = 'worker-failure';

/** A request before the client assigns its correlation id. */
export type EngineRequestBody =
  | { kind: 'boot' }
  | { kind: 'query'; goal: string; budget: BudgetSpec }
  | { kind: 'consult'; source: string }
  | { kind: 'cancel'; target: string };

// Intersecting the union keeps `Omit<EngineRequest, 'id'>` from collapsing to the
// keys the two shapes share, which would drop `goal`.
export type EngineRequest = EngineRequestBody & { id: string };

export type EngineResponse =
  | { id: string; kind: 'booted'; contract: EngineContract }
  | { id: string; kind: 'solutions'; solutions: PlSolution[] }
  | { id: string; kind: 'failure' }
  /** A limit stopped the run; `solutions` holds whatever was already proven. */
  | { id: string; kind: 'limit'; limit: LimitKind; solutions: PlSolution[] }
  | { id: string; kind: 'cancelled'; solutions: PlSolution[] }
  /** Settles a `cancel` request itself; `accepted` is false for an unknown or already-settled target. */
  | { id: string; kind: 'ack'; accepted: boolean }
  | { id: string; kind: 'consulted' }
  | { id: string; kind: 'error'; error: EngineError };

/**
 * Every request ends in exactly one of these; nothing else settles a caller.
 *
 * The `never` default is the point of the switch: adding a response kind without
 * classifying it here fails to compile rather than silently leaving callers pending.
 */
export const isTerminal = (response: EngineResponse): boolean => {
  switch (response.kind) {
    case 'booted':
    case 'solutions':
    case 'failure':
    case 'limit':
    case 'cancelled':
    case 'ack':
    case 'consulted':
    case 'error':
      return true;
    default: {
      const exhaustive: never = response;
      return exhaustive;
    }
  }
};

/** Distributes so each arm keeps its own discriminant; a bare `Omit` over a union
 * collapses to the shared keys and loses it. */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/** The solve-side arms of `EngineResponse`, declared there once (u3 P6.1). */
export type SolveResult = WithoutId<
  Extract<EngineResponse, { kind: 'solutions' | 'failure' | 'limit' | 'cancelled' }>
>;
