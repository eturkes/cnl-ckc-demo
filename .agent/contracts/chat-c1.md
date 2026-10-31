# chat-c1 — read-only query mode for model-written goals

Tier `kernel`: engine, on the chat's answer path — a KB segment shows whatever this mode
returns, and no downstream check re-grades it. Source = `.agent/spec.md` `Tasks` c1 +
`.agent/contracts/chat-plan.md` `Design` `Guard`, whose acceptance this restates without
widening: **refuses the atom-doubling chain, `assertz`, a module-qualified goal, a variable goal
and `call/2`; admits every `clinical_*` entry point.**

The chat model writes goal text. The closed saved state still holds builtins that write
(`assertz/1`, `nb_setval/2`, `set_prolog_flag/2`, `consult/1`) and builtins that abort the WASM
runtime: atoms sit outside `stack_limit`, so a 32-step `atom_concat/3` doubling chain aborts it
under a 64 MiB stack (108 ms, FATAL, every later query dead; `.scratch/probe/battery.src.ts`).
Hence default deny over the PARSED goal, never over its text.

## Seam

- `EngineRequestBody` `query` gains an optional `readonly: true`.
  `EngineClient.query(goal, budget, signal?, onSolution?, options?: { readonly?: boolean })`
  posts `readonly: true` when `options.readonly === true` and posts NO `readonly` key otherwise.
- `EngineSession.handle` decides on the posted request alone. `readonly` absent → today's path,
  byte-identical. `readonly === true` → the read-only path below. A `readonly` key holding any
  other value, `undefined` included → `guard` error, nothing run.
- Read-only path, in order: length cap → one parse query
  (`term_string(T,S,[variable_names(Vs)])` and the canonical render of `T` under
  `[quoted(true),ignore_ops(true),numbervars(false),variable_names(Vs)]`) → `guardGoal` over the
  decoded `T` → `meteredGoal(<rendered text>, budget)`. The request runs the RENDERED text,
  never the caller's.
- `src/engine/readonly.ts` (pure, no engine import) exports `READONLY_GOAL_MAX = 2048`,
  `type GuardVerdict = { ok: true } | { ok: false; reason: string }` and
  `guardGoal(goal: PlTerm, variableNames: readonly string[]): GuardVerdict`.
- Refusal = `EngineErrorCode` `'guard'` (new), message prefixed `read-only query refused: `
  and naming the first refused subgoal's `name/arity` in depth-first, left-to-right order, or
  the rule that refused it.

## Allowlist (default deny)

Goal positions are walked; every other argument is data and never walked.

- Control, walked: `,`/2, `;`/2, `->`/2, `*->`/2 (both args); `\+`/1, `not`/1, `once`/1,
  `ignore`/1 (the arg); `forall`/2 (both); `findall`/3, `findall`/4, `bagof`/3, `setof`/3
  (arg 2); `^`/2 (arg 2). Atoms `true`, `fail`, `false`, `!`.
- KB entry points, data args: the 22 schema indicators `guideline_arg/4`,
  `guideline_cardinality/5`, `guideline_document/4`, `guideline_entity/4`,
  `guideline_evaluation_date/1`, `guideline_event/3`, `guideline_exclusion/1`,
  `guideline_frequency/5`, `guideline_grade/5`, `guideline_interval/6`,
  `guideline_operator/3`, `guideline_order/4`, `guideline_pp/4`, `guideline_preference/4`,
  `guideline_property/4`, `guideline_qualifier/4`, `guideline_range/3`,
  `guideline_recurrence/4`, `guideline_recurrence_window/7`, `guideline_schema_version/1`,
  `guideline_supersession/4`, `guideline_unit/3`; and `clinical_advice/3`, `clinical_advice/4`,
  `clinical_rule/3`, `clinical_premise/4`, `clinical_gate/4`, `clinical_source/3`,
  `clinical_passage/2`, `clinical_context/3`, `clinical_derive/4` = "every `clinical_*` entry
  point". `clause/2` = arg 1 non-variable, its indicator one of those thirty-one.
  Amended for release `kb-2026-10-29-rc.1` (user-approved widening): the schema grew from 19
  indicators to 22. Original text: "the 19 schema indicators … `guideline_schema_version/1`,
  `guideline_unit/3` … one of those twenty-eight".
  Amended for the upstream sync to `83569b1d` (user-approved re-pins): the schema grew from
  nine indicators to 19 and `guideline_document` from arity 3 to 4. Original text: "the nine
  schema predicates `guideline_arg/4`, `guideline_cardinality/5`, `guideline_document/3`,
  `guideline_entity/4`, `guideline_event/3`, `guideline_operator/3`, `guideline_pp/4`,
  `guideline_property/4`, `guideline_schema_version/1` … one of those eighteen".
- Builtins, data args: `=/2 \=/2 ==/2 \==/2 @</2 @>/2 @=</2 @>=/2 compare/3`;
  `is/2 =:=/2 =\=/2 </2 >/2 =</2 >=/2 succ/2 plus/3 between/3`;
  `var/1 nonvar/1 atom/1 number/1 integer/1 float/1 atomic/1 compound/1 callable/1 is_list/1
  string/1 ground/1`; `memberchk/2 length/2 msort/2 sort/2 sort/4 keysort/2 max_list/2
  min_list/2 '$member'/2 '$append'/3`; `sub_string/5 string_concat/3 split_string/4
  string_lower/2 string_upper/2 string_code/3 string_codes/2 string_length/2
  sub_atom_icasechk/3 atom_length/2 text_to_string/2`; `copy_term/2 term_variables/2
  arg/3 =../2`; the schema's comparison built-ins `guideline_satisfies/4,6` (integer arithmetic
  over ground arguments; they read no KB clause, so they never count as a KB read — added by
  the same amendment); its arithmetic built-ins `guideline_product/6`, `guideline_quotient/6`
  (added for release `kb-2026-10-29-rc.1`, user-approved). Declared limit: their cost grows with
  the operands, as `is/2`'s does — `X is 7**(10**7)` holds one step 12.5 s, and a 25,000-digit
  operand holds `guideline_quotient/6`'s Euclid loop 38 s, in Node — past the wall clock, where
  the client's hard deadline recreates the worker (chat-c2). Absent from the image and so never admitted: `member/2`,
  `append/3`, `nth0/3`, `nth1/3`, `last/2`, `sum_list/2`, `aggregate_all/3`.
- Refused, among everything else: every builder of an atom from text or numbers
  (`atom_concat/3`, `atom_string/2`, `atom_codes/2`, `atom_chars/2`, `atom_number/2`,
  `sub_atom/5`, `upcase_atom/2`, `term_to_atom/2`, `char_code/2`, `number_codes/2`,
  `string_chars/2` — it creates a one-character atom per new code point, chat-consultant-1 K2);
  `number_string/2` (a 10M-digit parse ran one uninterruptible step past 60 s in Node);
  `call/N` for every N; `catch/3`; `freeze/2`; `functor/3` (below); any `M:G`; a variable,
  number, string, list or dict in goal position.
- A goal must READ THE KB: at least one goal position names a KB entry point or `clause/2`
  over one, else `guard` refusal `the goal reads no KB predicate`. A goal that only binds
  constants (`X = "an invented claim"`) would hand the model's own words back as a KB result
  (amended before code, `chat-consultant-3`).
- **KB read on every path** (close fix, user ruling): every way the goal can succeed must pass a
  KB read, else `guard` refusal `the goal can succeed without reading a KB predicate`. Read
  structurally: a conjunction needs one conjunct that does; a disjunction each branch that can
  succeed (`fail`/`false` branches need nothing); `(C -> T ; E)` reads through C or T, and E;
  `once`, `^` and the collectors read when their goal does; `\+`, `not`, `ignore` and `forall`
  read nothing. Witnesses: `chat-close-product` (its F2, registered) `once((X = "an invented claim" ;
  guideline_schema_version(_)))` earned a KB tag on the real image (its probe rc 1 at `c5c4b81`,
  rc 0 after); `tests/engine-readonly-guard.test.ts` `G10 requires a KB read on every way…` red
  under the old rule. Approved grader change: G10's slot expectation was `slots.includes(index)`
  and fired `;/2 arg 1: expected false to be true` at the change.
- A goal holding a term the decoder refuses is refused as `guard`, nothing run. A compound
  named `functor` decodes: swipl-wasm's `PrologCompound` keeps its name under the key `functor`
  and its arguments under the key of its name, so for that one name the arguments overwrite the
  name, and `decodeTerm` reads the arguments where the name was. `functor/3` stays refused
  (amended before code, `chat-tester-1`).
  - Amended at mnt5 m4 (user-approved). The original clause: `That includes every compound
    named functor: … so for that one name the arguments overwrite the name and decodeTerm fails
    closed. … the decoder defect is queued in .agent/deferred.md`. Three G1 cases in
    `tests/engine-readonly-session.test.ts` — `X = functor(a,b,c)`, `X = [functor(a)]`,
    `X = f(functor(a,b))` — expected `/functor|decode/iu`; they stay refused, now because the
    goal reads no KB predicate, and their original expectations fire against the fix:
    `expected 'read-only query refused: the goal rea…' to match /functor|decode/iu`.
- Empty goal text, text that does not parse, and text holding a second term are each refused as
  `guard`, nothing run. `term_string/3` reads the FIRST term and ignores the rest (`g.
  assertz(x)` parses as `g`), so the text after the term may hold layout, comments and one
  full stop alone — a second term would show on the KB card while never running.
- Goal text longer than `READONLY_GOAL_MAX` UTF-16 code units is refused BEFORE the parse: the
  parse creates every atom the text spells, outside `stack_limit`. 2048 ≈ 30× the longest
  catalog goal (65).
- A variable named `_<digits>` or `_G<digits>` is refused: those are the renderer's own names
  for unnamed variables, so the rendered text would merge two distinct variables.

## Acceptance

| id | predicate |
|---|---|
| G1 | Each refuses with `code: 'guard'`, its message naming the indicator or rule: the 32-step `atom_concat/3` doubling chain; `assertz(probe_c1(1))`; `retract(_)`; `nb_setval(k,1)`; `set_prolog_flag(double_quotes,codes)`; `consult(f)`; `halt`; `user:clinical_rule(D,S,R)`; `lists:append(X,Y,Z)`; `G`; `G = true, G`; `findall(X,G,L)`; `\+ G`; `call(clinical_rule(D,S,R))`; `call(clinical_rule(D),S,R)` (`call/3`); `call(G,X)` (`call/2`); `[f]`; `"text"`; `42`; `clause(H,B)`; `clause(assertz(_),B)`; `catch(true,_,true)`; `string_chars("ab",Cs)`; `functor(f(a),F,N)`; `X = "an invented claim"` and `msort([b,a],L)` (no KB predicate); and each refused builtin nested in control — `(true;assertz(x))`, `forall(true,assertz(x))`, `findall(X,(clinical_rule(X,_,_),assertz(y)),L)`, `once(atom_concat(a,b,C))`, `setof(D,S^R^(clinical_rule(D,S,R),atom_concat(D,x,_)),L)`; a goal of `READONLY_GOAL_MAX + 1` code units; a goal naming variable `_123`. |
| G2 | A refused goal runs nothing: after `assertz(probe_c1(1))` and `nb_setval(c1_probe,1)` are refused, an unflagged query finds `probe_c1/1` undefined and `nb_current(c1_probe,_)` false. The cap refusal creates no atom: `statistics(atoms,N)` read by unflagged queries before and after equals. |
| G3 | Each admits — settles `solutions` or `failure`, never `error` — one goal per KB entry point (all thirty-one since release `kb-2026-10-29-rc.1`; twenty-eight since the 83569b1d sync; eighteen before), plus `findall(D,clinical_rule(D,_,_),Ds),sort(Ds,U),length(U,N)` (N = 12), `setof(D,S^R^clinical_rule(D,S,R),Ds)`, `clause(guideline_entity(A,B,C,D),Body)`, `clinical_passage(D,T),sub_string(T,_,_,_,"nonopioid")`, and `guideline_operator(actual,C,should)` (`failure`: correct on the bare KB, `.claude/rules/proof.md`). Plus one small goal per allowlisted builtin, conjoined after `once(guideline_schema_version(_))` so it reads the KB, each settling `solutions` read-only — so a misspelt or image-absent allowlist entry fails here (amended before code, chat-consultant-1 K5). |
| G4 | Equivalence: every goal G3 admits, and every `QUESTION_CATALOG` goal, settles under `readonly` with the same `kind` and the same solutions as the same goal unflagged — `bindings` and `display` deep-equal once each solution's variables are renumbered by first occurrence (variable ids in `bindings`, `_<digits>` names in `display`). Amended before code from "`bindings` and `display` deep-equal": `clause(guideline_entity(A,B,C,D),Body)` answers hold unbound variables, whose ids differ between two unflagged runs of the same goal. |
| G5 | The rendered text is what runs: `clinical_rule(D,S,R) % trailing comment` and `clinical_rule(D,S,R) /* note */` answer like `clinical_rule(D,S,R)`. Rendering round-trips: for a corpus spanning quoted atoms (`'it''s'`), strings, `0'a`, `-1` vs `- 1`, `{q}`, `[]` vs `'[]'`, `3r4`, `1.5`, `'$VAR'(1)`, operator atoms as data (`X = (+)`) and nested lists, the rendered text re-reads to a variant (`=@=`) of the parsed term. |
| G6 | A refusal leaves the session usable: the next read-only query answers, `booted` stays true, nothing is poisoned. |
| G7 | `readonly: 'true'`, `readonly: 1` and `readonly: false` each settle a `guard` error and run nothing; an unflagged `assertz(probe_c1_open(1))` still succeeds, as today. |
| G8 | Client: `query(…, { readonly: true })` posts `readonly: true`; `query(goal, budget)` and `AnswerService.ask` post no `readonly` key; a `guard` error reaches the caller as `{ kind: 'error', error: { code: 'guard' } }`; the posted request survives `structuredClone`. |
| G9 | Every allowlisted builtin stops on the budget, not the runtime: on ONE session under `DEMO_BUDGET`, each case — `findall` of 200 lists of 4M cells; `length(L,N), N > 100000000`; `between(1,inf,N), fail`; a 32-step `string_concat/3` doubling chain; `X is 7**(10**9)`; `copy_term/2` of a 3M-cell list 100 times; `msort/2` of 3M integers; `sort/4` of 3M compounds; `string_codes/2`, `string_upper/2`, `split_string/4`, `text_to_string/2` and `sub_string/5` enumeration over doubled strings; `X = f(X)`; `'$append'(X,Y,Z), fail` — settles `limit`, `failure`, or an `error` whose code is NOT `guard`, read-only, and the engine then reports the manifest's document count. Amended before code from "settles `limit`, `failure` or `error`" (chat-consultant-1 K5): a guard refusing every case would have passed. Control: the same harness, on its own session, runs the `atom_concat/3` chain UNFLAGGED and must observe the runtime abort — the request settles an error whose message starts `Aborted()`, or (once c2 lands) `limit` `'heap'` or error `aborted`. Amended before code from "must report the engine dead afterwards" (`chat-tester-1`): after `Aborted()` the next query died in one Node run and answered 337 documents in another, so liveness after an abort is not a stable reading. |
| G10 | `guardGoal` alone (pure): agrees with an independent reference reading of this allowlist over generated terms — control nesting to depth ≥ 6 mixing admitted, refused and variable subgoals. |
| G11 | Unchanged: `pnpm engine:check` (P6.2's `query(goal, budget, signal?` prefix, P6.5's `terms.ts` export pin) and every existing suite stay green. |

## Declared limit

Read-only = no clause, global variable, flag, operator, stream or file outlives the query. The
pseudo-random generator is the one exception: `X is random(6)` advances its state, and a static
walk cannot close it, because a variable bound at run time can carry `random/1` into an
expression (`E = random(6), X is E`). Nothing in the demo reads that state (chat-consultant-1 K1).

Every success path reads the KB, but a path may still bind a constant beside that read:
`guideline_schema_version(_), X = "an invented claim"` is admitted, and its card shows the goal
whole, which is how a reader sees the literal. `chat-c4.md` `Declared limit` states what a `kb`
label certifies.

G9 samples the admitted builtins; it does not prove that no admitted goal can abort the runtime.
Measured: with the heap held to ~100 MB by a 1700 MB reservation, the shared battery's retained
stacks exhausted malloc and admitted `split_string/4` aborted the runtime; G9's shared engine
therefore boots without the reservation (the control keeps it).
The last bound on an abort that gets through is c2's recreation of the worker
(`.agent/contracts/chat-c2.md`).

## Out of scope

Chat wiring (c3, c4), abort recovery (c2), proofs for model goals (no read-only `prove`), the
tool-result text cap (c4).
