// The worker's request dispatcher, factored out of the Worker shell.
//
// Vitest runs in Node, where the DOM `Worker` global is absent, so the engine
// logic lives here as a plain object a test can drive directly against the real
// saved image. `worker.ts` adds only message plumbing.
//
// The image loader is injected because the browser reaches it through Vite's
// CommonJS interop and Node reaches it through `createRequire`.

import type {
  EngineContract,
  EngineError,
  EngineRequest,
  EngineResponse,
  PlSolution,
} from './protocol.js';
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
}

interface Prolog extends PrologConstructors {
  query(goal: string, bindings?: Record<string, unknown>): PrologQuery;
}

export interface Engine {
  prolog: Prolog;
}

export type ImageLoader = (image: Uint8Array) => Promise<Engine>;

export interface SessionOptions {
  loadImage: ImageLoader;
  /** Values the build recorded; the booted engine must agree with them. */
  expected: EngineContract;
}

/** Matches `write_canonical`, so display text re-reads as the same term. */
const DISPLAY_OPTIONS = '[quoted(true),numbervars(true),ignore_ops(true)]';

const SCHEMA_GOAL = 'findall(V,guideline_schema_version(V),Vs),sort(Vs,Us),length(Us,N),Us=[S].';
const DOCUMENTS_GOAL = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).';

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
  readonly #options: SessionOptions;

  constructor(options: SessionOptions) {
    this.#options = options;
  }

  get booted(): boolean {
    return this.#engine !== undefined;
  }

  /** Boot once; a later request reuses the same engine rather than reloading it. */
  async boot(image: Uint8Array): Promise<EngineContract> {
    if (this.#engine !== undefined && this.#contract !== undefined) return this.#contract;
    const engine = await this.#options.loadImage(image);
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

  /** Run one goal to exhaustion and return every solution decoded. */
  solve(goal: string): PlSolution[] | 'failure' {
    const engine = this.#engine;
    if (engine === undefined) throw new Error('engine is not booted');
    // An unparsable goal yields no solution instead of raising, so without this
    // guard a malformed goal is indistinguishable from an honest zero-answer run.
    const parsed = decodeOnce(engine.prolog.query('term_string(T,S).', { S: goal }).once());
    if (parsed.kind !== 'bindings') {
      throw new PrologFailure(
        parsed.kind === 'prolog-error' ? parsed.message : `goal does not parse: ${goal}`,
      );
    }
    const encode = createEncoder(engine.prolog);
    const solutions: PlSolution[] = [];
    const iterator = engine.prolog.query(goal)[Symbol.iterator]();
    for (;;) {
      const step = iterator.next();
      // A final solution can arrive together with `done: true`; reading `value`
      // before `done` is what keeps the last answer.
      if (step.value !== undefined) {
        const result = decodeOnce(step.value);
        if (result.kind === 'prolog-error') throw new PrologFailure(result.message);
        if (result.kind === 'bindings') {
          const display: Record<string, string> = {};
          for (const [name, term] of Object.entries(result.bindings)) {
            display[name] = this.#display(engine, encode(term));
          }
          solutions.push({ bindings: result.bindings, display });
        }
      }
      if (step.done === true) break;
    }
    return solutions.length === 0 ? 'failure' : solutions;
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

  /** Turn one request into exactly one response; never throws. */
  async handle(request: EngineRequest, image: Uint8Array): Promise<EngineResponse> {
    try {
      if (request.kind === 'boot') {
        return { id: request.id, kind: 'booted', contract: await this.boot(image) };
      }
      const solved = this.solve(request.goal);
      return solved === 'failure'
        ? { id: request.id, kind: 'failure' }
        : { id: request.id, kind: 'solutions', solutions: solved };
    } catch (cause) {
      return { id: request.id, kind: 'error', error: classify(cause, request.kind) };
    }
  }
}

export class ContractMismatch extends Error {
  override name = 'ContractMismatch';
}

export class PrologFailure extends Error {
  override name = 'PrologFailure';
}

const classify = (cause: unknown, kind: EngineRequest['kind']): EngineError => {
  if (cause instanceof ContractMismatch) return fail('contract', cause);
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
