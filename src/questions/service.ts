// The demo's one answer path: a catalog id in, a live Prolog result out.
//
// The service takes an id, never a goal. That is what keeps arbitrary text
// unexecutable and keeps every run budgeted — `EngineClient.query` is the only
// engine call reachable from here, and `consult` stays out because it is
// unbudgeted and fails open on its own diagnostics.

import type { EngineClient } from '../engine/client.js';
import type { BudgetSpec, EngineError, LimitKind, PlSolution } from '../engine/protocol.js';

import { QUESTION_CATALOG, type QuestionId, isQuestionId } from './catalog.js';
import { serializeAnswer } from './serialize.js';

/**
 * Every way `ask` can settle. The limit, cancellation, failure and error states
 * stay separate: a demo that showed one "no answer" for all four would be unable
 * to tell an exhausted budget from an honest empty result.
 */
export type AnswerResult =
  | { kind: 'answer'; id: QuestionId; serialized: string; solutions: PlSolution[] }
  | { kind: 'rejected'; reason: 'unknown-id' }
  /** The goal has no proof. `serialized` still renders it, as `no` or an empty row set. */
  | { kind: 'failure'; id: QuestionId; serialized: string }
  /** A budget stopped the run; `solutions` holds whatever was proven first. */
  | { kind: 'limit'; id: QuestionId; limit: LimitKind; serialized: string; solutions: PlSolution[] }
  | { kind: 'cancelled'; id: QuestionId; serialized: string; solutions: PlSolution[] }
  | { kind: 'error'; id: QuestionId; error: EngineError };

export class AnswerService {
  readonly #client: EngineClient;

  constructor(client: EngineClient) {
    this.#client = client;
  }

  /**
   * Run one catalog question.
   *
   * `id` is `unknown` on purpose: free text and unknown ids reach this method as
   * strings from the UI, and both leave through the same rejection without the
   * engine ever seeing them.
   */
  async ask(id: unknown, budget: BudgetSpec): Promise<AnswerResult> {
    if (!isQuestionId(id)) return { kind: 'rejected', reason: 'unknown-id' };
    const entry = QUESTION_CATALOG[id];
    const outcome = await this.#client.query(entry.goal, budget);
    switch (outcome.kind) {
      case 'solutions':
        return {
          kind: 'answer',
          id,
          serialized: serializeAnswer(entry, outcome.solutions),
          solutions: outcome.solutions,
        };
      case 'failure':
        return { kind: 'failure', id, serialized: serializeAnswer(entry, []) };
      case 'limit':
        return {
          kind: 'limit',
          id,
          limit: outcome.limit,
          serialized: serializeAnswer(entry, outcome.solutions),
          solutions: outcome.solutions,
        };
      case 'cancelled':
        return {
          kind: 'cancelled',
          id,
          serialized: serializeAnswer(entry, outcome.solutions),
          solutions: outcome.solutions,
        };
      case 'error':
        return { kind: 'error', id, error: outcome.error };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }
}
