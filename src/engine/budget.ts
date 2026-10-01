// Limits are read out of decoded term structure, never out of message text: the
// native exception path collapses a Prolog error to a message string, so anything
// classified from text is classified from the one representation that loses shape.

import type { BudgetSpec, LimitKind } from './protocol.js';
import type { PlBindings } from './terms.js';

export class BudgetError extends Error {
  override name = 'BudgetError';
}

/**
 * Ceilings, not defaults. `stackBytes` matches the engine's own 1 GiB unified stack
 * limit; the rest bound a demo query far below the point where the 2 GiB Emscripten
 * heap becomes reachable.
 */
export const BUDGET_MAX: BudgetSpec = {
  stackBytes: 1073741824,
  depth: 10000000,
  inferences: 1000000000,
  wallClockMs: 600000,
  answerCap: 100000,
};

const FIELDS = Object.keys(BUDGET_MAX) as (keyof BudgetSpec)[];

/** Variables the wrapper owns. A goal naming one is rejected, never silently shadowed. */
const RESERVED = [
  'BudgetDepth_',
  'BudgetInference_',
  'BudgetResource_',
  'BudgetStart_',
  'BudgetNow_',
  'BudgetSpent_',
  'BudgetFinal_',
] as const;

// Word-boundary match over the raw goal text. It can only over-reject — a reserved
// name inside a quoted atom trips it too — and over-rejection is the safe direction.
// The pattern interpolates `RESERVED` alone, which is a module-level `as const`.
// eslint-disable-next-line security/detect-non-literal-regexp
const RESERVED_PATTERN = new RegExp(`\\b(?:${RESERVED.join('|')})`);

/** `resource_error(What)` terms this build produces, mapped to their own limit states. */
const RESOURCE_LIMIT: Record<string, LimitKind> = { stack: 'stack', memory: 'heap' };

/**
 * Validate a budget from an untrusted sender.
 *
 * Both sides call this. The worker cannot assume the client validated, because the
 * client is not the only thing that can post to it.
 */
export function validateBudget(budget: unknown): BudgetSpec {
  if (typeof budget !== 'object' || budget === null)
    throw new BudgetError('budget spec is missing');
  const source = budget as Record<string, unknown>;
  const validated = {} as BudgetSpec;
  for (const field of FIELDS) {
    const value = source[field];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      throw new BudgetError(
        `budget ${field} must be a positive safe integer, got ${String(value)}`,
      );
    }
    if (value > BUDGET_MAX[field]) {
      throw new BudgetError(`budget ${field} exceeds its maximum ${BUDGET_MAX[field]}`);
    }
    validated[field] = value;
  }
  return validated;
}

export function assertGoalAvoidsReserved(goal: string): void {
  if (RESERVED_PATTERN.test(goal)) {
    throw new BudgetError(`goal may not name a reserved wrapper variable (${RESERVED.join(', ')})`);
  }
}

/** Callers write goals as whole clauses; the wrapper needs the bare term. */
const bareTerm = (goal: string): string => goal.trim().replace(/\.$/, '');

/**
 * Wrap a goal in the engine-side limits.
 *
 * `catch/3` unifies `BudgetResource_` straight out of the caught ball, so a stack or
 * memory exhaustion arrives as a binding with its structure intact instead of as a
 * native exception whose only survivor is text. A non-resource error does not unify
 * and rethrows unchanged.
 */
export const wrapGoal = (goal: string, budget: BudgetSpec): string =>
  `catch(call_with_inference_limit(call_with_depth_limit((${bareTerm(goal)}),${budget.depth},` +
  `BudgetDepth_),${budget.inferences},BudgetInference_),` +
  `error(resource_error(BudgetResource_),_),true).`;

/**
 * `wrapGoal` plus a meter on the whole request's inferences.
 *
 * `call_with_inference_limit/3` re-arms on backtracking, so alone it bounds one solution step:
 * 20 solutions of ~200 inferences each pass a 500 limit. `BudgetSpent_` carries the request's
 * running total to every solution, and one terminal record (`BudgetFinal_ = true`) carries it
 * once the goal is exhausted, so search that fails after the last answer is metered too. The
 * total counts the goal plus the wrapper's own few inferences; the driver renders nothing into
 * the engine until the query closes, so no other call can enter it. The per-step limit still
 * stops a single runaway step inside the engine.
 */
export const meteredGoal = (goal: string, budget: BudgetSpec): string =>
  `statistics(inferences,BudgetStart_),` +
  `(${wrapGoal(goal, budget).slice(0, -1)},BudgetFinal_=false;BudgetFinal_=true),` +
  `statistics(inferences,BudgetNow_),BudgetSpent_ is BudgetNow_-BudgetStart_.`;

export type Outcome =
  /**
   * `spent` = the request's inferences so far, and `final` marks the record that follows
   * exhaustion; both exist only under `meteredGoal`.
   */
  | { kind: 'solution'; bindings: PlBindings; spent: number | undefined; final: boolean }
  | { kind: 'limit'; limit: LimitKind }
  /** A resource error the wrapper caught but this build has no limit state for. */
  | { kind: 'resource'; resource: string };

/**
 * Read one wrapper result.
 *
 * Precedence is measured, not assumed: with depth and inference both low the outer
 * inference limit is what reports, so it is tested before the inner depth limit.
 */
export function readOutcome(bindings: PlBindings): Outcome {
  const resource = bindings.BudgetResource_;
  if (resource?.kind === 'atom') {
    const limit = RESOURCE_LIMIT[resource.value];
    return limit === undefined
      ? { kind: 'resource', resource: resource.value }
      : { kind: 'limit', limit };
  }
  const inference = bindings.BudgetInference_;
  if (inference?.kind === 'atom' && inference.value === 'inference_limit_exceeded') {
    return { kind: 'limit', limit: 'inference' };
  }
  const depth = bindings.BudgetDepth_;
  if (depth?.kind === 'atom' && depth.value === 'depth_limit_exceeded') {
    return { kind: 'limit', limit: 'depth' };
  }
  const user: PlBindings = {};
  for (const [name, term] of Object.entries(bindings)) {
    if (!(RESERVED as readonly string[]).includes(name)) user[name] = term;
  }
  const spent = bindings.BudgetSpent_;
  const final = bindings.BudgetFinal_;
  return {
    kind: 'solution',
    bindings: user,
    spent: spent?.kind === 'integer' ? Number(spent.value) : undefined,
    final: final?.kind === 'atom' && final.value === 'true',
  };
}
