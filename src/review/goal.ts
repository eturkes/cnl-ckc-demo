/**
 * A goal whose proof passes through `guideline_satisfies/6`: upstream's `tablet-use-spacing`
 * export, in operator syntax. No catalog question's proof holds a comparison, so the review page
 * proves this one to reach the ladder's checked-comparisons list; `tests/proof-comparison.test.ts`
 * V1 holds that its proof keeps that list.
 */
export const COMPARISON_GOAL =
  'guideline_entity(actual,A,tablet,countable), guideline_cardinality(actual,A,na,eq,1), ' +
  'guideline_entity(actual,B,interval,countable), guideline_cardinality(actual,B,na,eq,1), ' +
  'guideline_cardinality(actual,C,na,D,E), guideline_unit(actual,C,F), ' +
  'guideline_satisfies(D,E,F,geq,4,hour), guideline_event(actual,G,use), ' +
  'guideline_arg(actual,G,1,H), guideline_arg(actual,G,2,A), guideline_pp(actual,G,at,B), ' +
  'guideline_recurrence(actual,G,C,F)';
