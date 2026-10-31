/**
 * A goal whose proof passes through `guideline_satisfies/6`: upstream's `tablet-use-spacing`
 * export, in operator syntax. No catalog question's proof holds a comparison, so the review page
 * proves this one to reach the ladder's checked-comparisons list; `tests/proof-comparison.test.ts`
 * V1 holds that its proof keeps that list.
 */
export const COMPARISON_GOAL =
  'guideline_pp(actual,A,at,B), guideline_recurrence(actual,A,C,D), ' +
  'guideline_event(actual,A,use), guideline_arg(actual,A,1,E), guideline_arg(actual,A,2,F), ' +
  'guideline_cardinality(actual,C,na,G,H), guideline_unit(actual,C,D), ' +
  'guideline_satisfies(G,H,D,geq,4,hour), guideline_entity(actual,B,interval,countable), ' +
  'guideline_cardinality(actual,B,na,eq,1), guideline_entity(actual,F,tablet,countable), ' +
  'guideline_cardinality(actual,F,na,I,J), guideline_satisfies(I,J,exactly,1)';
