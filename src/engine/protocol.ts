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
  | 'worker';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export interface PlSolution {
  bindings: PlBindings;
  /** Canonical Prolog text per binding, produced by the engine, not by templating. */
  display: Record<string, string>;
}

/** A request before the client assigns its correlation id. */
export type EngineRequestBody = { kind: 'boot' } | { kind: 'query'; goal: string };

// Intersecting the union keeps `Omit<EngineRequest, 'id'>` from collapsing to the
// keys the two shapes share, which would drop `goal`.
export type EngineRequest = EngineRequestBody & { id: string };

export type EngineResponse =
  | { id: string; kind: 'booted'; contract: EngineContract }
  | { id: string; kind: 'solutions'; solutions: PlSolution[] }
  | { id: string; kind: 'failure' }
  | { id: string; kind: 'error'; error: EngineError };

/** Every request ends in exactly one of these; nothing else settles a caller. */
export const isTerminal = (response: EngineResponse): boolean =>
  response.kind === 'booted' ||
  response.kind === 'solutions' ||
  response.kind === 'failure' ||
  response.kind === 'error';
