// Budget validation, the Prolog wrapper that carries the engine-side limits, and
// the classification of what that wrapper reports back.
//
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
const RESERVED = ['BudgetDepth_', 'BudgetInference_', 'BudgetResource_'] as const;

// Word-boundary match over the raw goal text. It can only over-reject — a reserved
// name inside a quoted atom trips it too — and over-rejection is the safe direction.
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

export type Outcome =
  | { kind: 'solution'; bindings: PlBindings }
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
  return { kind: 'solution', bindings: user };
}
