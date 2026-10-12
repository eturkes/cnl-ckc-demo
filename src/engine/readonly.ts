// The read-only allowlist for model-written goals (`.agent/contracts/chat-c1.md`).
//
// Default deny over the PARSED goal, never over its text. Goal positions are walked through the
// control constructs; every other argument is data and is never called. What may run is the KB's
// own entry points plus builtins that stop on the request's budget. Atoms sit outside
// `stack_limit`, so any builder of an atom from text aborts the WASM runtime instead of tripping a
// limit: a 32-step `atom_concat/3` doubling chain killed the engine under a 64 MiB stack.

import type { PlTerm } from './terms.js';

/**
 * Longest goal text the read-only path parses, in UTF-16 code units. The parse itself creates
 * every atom the text spells, so the cap is checked before it; 2048 ≈ 30× the longest catalog
 * goal (65).
 */
export const READONLY_GOAL_MAX = 2048;

export type GuardVerdict = { ok: true } | { ok: false; reason: string };

/** Which arguments of a control construct are goals; the rest are data. */
const CONTROL: ReadonlyMap<string, readonly number[]> = new Map([
  [',/2', [0, 1]],
  [';/2', [0, 1]],
  ['->/2', [0, 1]],
  ['*->/2', [0, 1]],
  ['\\+/1', [0]],
  ['not/1', [0]],
  ['once/1', [0]],
  ['ignore/1', [0]],
  ['forall/2', [0, 1]],
  ['findall/3', [1]],
  ['findall/4', [1]],
  ['bagof/3', [1]],
  ['setof/3', [1]],
  ['^/2', [1]],
]);

const ATOMS = new Set(['true', 'fail', 'false', '!']);

/** The KB's own entry points; `clause/2` may read these alone. */
const KB = new Set([
  'guideline_arg/4',
  'guideline_cardinality/5',
  'guideline_document/3',
  'guideline_entity/4',
  'guideline_event/3',
  'guideline_operator/3',
  'guideline_pp/4',
  'guideline_property/4',
  'guideline_schema_version/1',
  'clinical_advice/3',
  'clinical_advice/4',
  'clinical_rule/3',
  'clinical_premise/4',
  'clinical_gate/4',
  'clinical_source/3',
  'clinical_passage/2',
  'clinical_context/3',
  'clinical_derive/4',
]);

/**
 * Builtins that build no atom and stop on the budget. Each was driven with hostile data under the
 * demo budget and settled a limit, a failure or an error with the engine still answering. Absent
 * on purpose: `number_string/2`, whose 10M-digit parse ran one uninterruptible step past 60 s.
 */
const BUILTINS = new Set([
  '=/2',
  '\\=/2',
  '==/2',
  '\\==/2',
  '@</2',
  '@>/2',
  '@=</2',
  '@>=/2',
  'compare/3',
  'is/2',
  '=:=/2',
  '=\\=/2',
  '</2',
  '>/2',
  '=</2',
  '>=/2',
  'succ/2',
  'plus/3',
  'between/3',
  'var/1',
  'nonvar/1',
  'atom/1',
  'number/1',
  'integer/1',
  'float/1',
  'atomic/1',
  'compound/1',
  'callable/1',
  'is_list/1',
  'string/1',
  'ground/1',
  'memberchk/2',
  'length/2',
  'msort/2',
  'sort/2',
  'sort/4',
  'keysort/2',
  'max_list/2',
  'min_list/2',
  '$member/2',
  '$append/3',
  'sub_string/5',
  'string_concat/3',
  'split_string/4',
  'string_lower/2',
  'string_upper/2',
  'string_code/3',
  'string_codes/2',
  'string_length/2',
  'sub_atom_icasechk/3',
  'atom_length/2',
  'text_to_string/2',
  'copy_term/2',
  'term_variables/2',
  'arg/3',
  '=../2',
]);

/** The renderer's own names for unnamed variables; a goal naming one would merge two variables. */
const RENDERER_NAME = /^_G?\d+$/u;

const refuse = (reason: string): GuardVerdict => ({ ok: false, reason });

const ALLOWED: GuardVerdict = { ok: true };

/** `name/arity` of a callable term; `undefined` for anything that cannot be a goal. */
const indicator = (term: PlTerm): string | undefined => {
  if (term.kind === 'atom') return `${term.value}/0`;
  if (term.kind === 'compound') return `${term.functor}/${String(term.args.length)}`;
  return undefined;
};

/** `reach.kb` turns true once a goal position names a KB entry point or `clause/2` over one. */
const walk = (goal: PlTerm, reach: { kb: boolean }): GuardVerdict => {
  if (goal.kind === 'variable') return refuse('a variable in goal position');
  if (goal.kind === 'atom') {
    return ATOMS.has(goal.value)
      ? ALLOWED
      : refuse(`${goal.value}/0 is not on the read-only allowlist`);
  }
  if (goal.kind !== 'compound') return refuse(`a ${goal.kind} in goal position`);
  const name = `${goal.functor}/${String(goal.args.length)}`;
  if (name === ':/2') return refuse('a module-qualified goal (:/2)');
  const goals = CONTROL.get(name);
  if (goals !== undefined) {
    for (const index of goals) {
      const sub = goal.args[index];
      if (sub === undefined) return refuse(`${name} lacks argument ${String(index + 1)}`);
      const verdict = walk(sub, reach);
      if (!verdict.ok) return verdict;
    }
    return ALLOWED;
  }
  if (name === 'clause/2') {
    const head = goal.args[0];
    const read = head === undefined ? undefined : indicator(head);
    if (read === undefined || !KB.has(read)) {
      return refuse('clause/2 reads a KB entry point alone, named by a non-variable head');
    }
    reach.kb = true;
    return ALLOWED;
  }
  if (KB.has(name)) {
    reach.kb = true;
    return ALLOWED;
  }
  if (BUILTINS.has(name)) return ALLOWED;
  return refuse(`${name} is not on the read-only allowlist`);
};

/** `fail`/`false`: a branch with no way to succeed, so it never needs a KB read of its own. */
const NEVER = new Set(['fail', 'false']);

/**
 * Whether every way `goal` can succeed passes a KB read (`chat-c1.md` `KB read on every path`,
 * user ruling). Structural and conservative: a conjunction needs one conjunct that does, a
 * disjunction or an else branch needs each branch that can succeed to; a collector reads when
 * its goal does; `\+`, `not`, `ignore` and `forall` count as no read, because they succeed on a
 * path that hands back nothing from the KB. `fail` is no read, so it cannot satisfy a collector
 * vacuously. Called on a goal `walk` admitted.
 */
const readsOnEveryPath = (goal: PlTerm): boolean => {
  if (goal.kind !== 'compound') return false;
  const [first, second] = goal.args;
  const reads = (term: PlTerm | undefined): boolean => term !== undefined && readsOnEveryPath(term);
  const branch = (term: PlTerm | undefined): boolean =>
    (term?.kind === 'atom' && NEVER.has(term.value)) || reads(term);
  switch (`${goal.functor}/${String(goal.args.length)}`) {
    case ',/2':
    case '->/2':
    case '*->/2':
      return reads(first) || reads(second);
    case ';/2': {
      // `(C -> T ; E)` and `(C *-> T ; E)`: the then-path reads through C or T, the else-path alone.
      const guarded =
        first?.kind === 'compound' &&
        (first.functor === '->' || first.functor === '*->') &&
        first.args.length === 2;
      return (guarded ? reads(first) : branch(first)) && branch(second);
    }
    case 'once/1':
      return reads(first);
    case '^/2':
    case 'findall/3':
    case 'findall/4':
    case 'bagof/3':
    case 'setof/3':
      return reads(second);
    case 'clause/2':
      return true;
    default:
      return KB.has(`${goal.functor}/${String(goal.args.length)}`);
  }
};

/**
 * Admit a parsed goal only when every goal position it holds is on the allowlist and every way it
 * can succeed reads the KB.
 */
export function guardGoal(goal: PlTerm, variableNames: readonly string[]): GuardVerdict {
  const merged = variableNames.find((name) => RENDERER_NAME.test(name));
  if (merged !== undefined) return refuse(`variable name ${merged} is reserved for the renderer`);
  const reach = { kb: false };
  const verdict = walk(goal, reach);
  if (!verdict.ok) return verdict;
  // A goal that reads no KB predicate could only hand back constants the model wrote itself,
  // which would then show as a KB result; so could a goal with one branch that skips the KB.
  if (!reach.kb) return refuse('the goal reads no KB predicate');
  if (!readsOnEveryPath(goal)) {
    return refuse('the goal can succeed without reading a KB predicate');
  }
  return verdict;
}
