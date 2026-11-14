// The goal that id names is not a bare knowledge-base query. It carries the
// question's clinical context as explicit premises, because a guideline clause is
// universally quantified over clinicians and the `actual` world holds no clinician
// instance (`.claude/rules/proof.md`). A clause the run derives and a premise the
// question supplies are therefore different things in every result returned here.
//
// The service takes an id, never a goal. That is what keeps arbitrary text
// unexecutable — `EngineClient.query` is the only engine call reachable from here.
// `consult` stays out because a `:- Goal.` directive runs arbitrary Prolog, and the
// interpreter already compiles into the saved image, so a runtime load buys nothing.
// It carries a 10 s watchdog of its own; it is a `BudgetSpec` it never takes.

import type { EngineClient, QueryOutcome } from '../engine/client.js';
import { UNDATED, type RunContext } from '../engine/context.js';
import type { BudgetSpec, EngineError, LimitKind, PlSolution } from '../engine/protocol.js';

import { QUESTION_CATALOG, type QuestionId, isQuestionId } from './catalog.js';
import {
  decodeConditions,
  decodeRecords,
  decodeStatements,
  readOutcome,
  SCOPE_GOAL,
  supersededGoal,
  SUPERSESSIONS_GOAL,
  type ScopeOutcome,
  type SupersededOutcome,
  type SupersessionsOutcome,
} from './records.js';
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
  /**
   * A budget stopped the run. `solutions` holds the prefix the engine proved before
   * its own soft check. When the client's hard watchdog fires instead, it holds only the
   * answers that streamed before it: that path terminates a worker stuck in an
   * uninterruptible step, so nothing that step proved is recoverable
   * (`engine/client.ts` `#onDeadline`).
   */
  | { kind: 'limit'; id: QuestionId; limit: LimitKind; serialized: string; solutions: PlSolution[] }
  | { kind: 'cancelled'; id: QuestionId; serialized: string; solutions: PlSolution[] }
  | { kind: 'error'; id: QuestionId; error: EngineError };

/** The marks goal's outcome as the engine returned it, or the refusal of an unknown id. */
export type MarksOutcome = QueryOutcome | { kind: 'rejected'; reason: 'unknown-id' };

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
   * engine ever seeing them. `onSolution` hears each answer as the engine renders it.
   */
  async ask(
    id: unknown,
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
    onSolution?: (solution: PlSolution) => void,
  ): Promise<AnswerResult> {
    if (!isQuestionId(id)) return { kind: 'rejected', reason: 'unknown-id' };
    const entry = QUESTION_CATALOG[id];
    const outcome = await this.#client.query(entry.goal, budget, context, signal, onSolution);
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

  /**
   * Run one catalog question's marks goal: the grade, qualifiers, preferences and time marks the
   * knowledge base derives for each of its answer documents. An id in, never goal text.
   */
  async marks(
    id: unknown,
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
  ): Promise<MarksOutcome> {
    if (!isQuestionId(id)) return { kind: 'rejected', reason: 'unknown-id' };
    return this.#client.query(QUESTION_CATALOG[id].marksGoal, budget, context, signal);
  }

  /** The guideline's scope exclusions: each condition with every sentence stating it. */
  async scope(
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
  ): Promise<ScopeOutcome> {
    const outcome = await this.#client.query(SCOPE_GOAL, budget, context, signal);
    const read = readOutcome(outcome, SCOPE_GOAL, 'scope', 'Conditions', decodeConditions);
    return 'value' in read ? { kind: read.kind, goal: read.goal, conditions: read.value } : read;
  }

  /**
   * The superseded statements of a catalog question's recommendation family, each derived — or
   * not — under the run's evaluation date. An id in, never goal text; an unknown id is an error,
   * never an empty family.
   */
  async superseded(
    id: QuestionId,
    budget: BudgetSpec,
    context: RunContext,
    signal?: AbortSignal,
  ): Promise<SupersededOutcome> {
    if (!isQuestionId(id)) {
      return { kind: 'error', error: { code: 'protocol', message: 'not a catalog question id' } };
    }
    const goal = supersededGoal(id);
    const outcome = await this.#client.query(goal, budget, context, signal);
    const read = readOutcome(outcome, goal, 'superseded', 'Statements', decodeStatements);
    return 'value' in read ? { kind: read.kind, goal: read.goal, statements: read.value } : read;
  }

  /** Every supersession record the KB holds; a fixed record, so the run carries no date. */
  async supersessions(budget: BudgetSpec, signal?: AbortSignal): Promise<SupersessionsOutcome> {
    const outcome = await this.#client.query(SUPERSESSIONS_GOAL, budget, UNDATED, signal);
    const read = readOutcome(
      outcome,
      SUPERSESSIONS_GOAL,
      'supersessions',
      'Records',
      decodeRecords,
    );
    return 'value' in read ? { kind: read.kind, goal: read.goal, records: read.value } : read;
  }
}
