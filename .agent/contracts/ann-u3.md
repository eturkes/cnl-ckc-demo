# ann-u3 — the answer panel's facts rows

Request: IMPLEMENT — answer panel annotations (`.agent/spec.md` `Decisions`: one facts row per
statement, `Qualifier` first, grade once per document run, time bounds and orderings, labels
translated and values English). Tier `kernel`: each row is a claim the panel makes in the
knowledge base's name, and a wrong row reaches the reader unseen. Depends on ann-u1 (marks state,
readings, join). The approved look is the ITERATE prototype's (`prototype/answer-annotations/`,
captured at `.scratch/probe-ui/`): a muted bold label, its value, no colon, pairs spaced on one
wrapping line, 0.78rem; a link-coloured disclosure after the statements.

## Design

- `AnswerPanel.svelte` takes the controller's `marks` state and renders, under each settled
  statement, one `<dl class="facts">`: Qualifier, Grade (shown), Preferred, Time — each pair
  present only when it has a value; no `<dl>` when none has. Values are ann-u1's readings joined
  `, ` (qualifiers, grade labels) or `; ` (preferences, times), computed in the script, never in
  markup, by the one join ann-u1 ships — the component derives nothing of its own.
- A one-statement answer renders its statement in a `<div class="answer-point">`: a `<dl>` cannot
  sit in a `<p>`.
- Notice: a settled answer whose marks are `failed` or `unavailable`, or `ready` with a missing
  document, shows one `TEXT.marksMissing(missing, total)` line after the statements. `loading`
  and a complete set show none.
- Disclosure `<details class="mark-goals">` after the statements once the marks settle: the
  catalog's marks goal and each solution's verbatim `display.Marks`, or the outcome when no
  solution returned.
- Busy (`running`/`cancelling`): unchanged — no rows, no notice, no disclosure.
- Copy: new `LABELS` and `TEXT` keys in `en.ts` + `ja.ts`; Japanese labels `グレード`, `修飾語`,
  `優先`, `時期` (user ruling); values stay English in both locales; `pnpm font:subset` re-cuts the
  Japanese faces for any new code point.
- Style: the approved look on existing role tokens (`--text-muted` labels), `overflow-wrap:
  anywhere` on values, the shipped `:focus-visible` ring on the summary.

## Interface (binding names; tests and implementation both hold to them)

- `AnswerPanel.svelte` props gain `solutions: readonly PlSolution[]` (the answer's solutions, in
  `rows` order) and `marks: MarksState` (default `{ kind: 'idle' }`); `App.svelte` passes the
  settled result's solutions and `demo.marks`. The panel calls `marksView(marks, points, rows,
  solutions)` once and renders its `statements`, `notice`, `missing` and `total`.
- DOM, per statement `.answer-point`: `dl.facts` holding one `div` per pair, `dt` = the label,
  `dd` = the value. After the statements: `p.marks-missing` (the notice), then
  `details.mark-goals` (summary, `p.mark-goals-note`, `code.mark-goal`, one `li > code` per
  returned solution, `p.mark-goals-status` when the outcome is not `solutions`).
- Catalog keys, both locales: `LABELS.marksQualifier` `Qualifier`/`修飾語`, `LABELS.marksGrade`
  `Grade`/`グレード`, `LABELS.marksPreferred` `Preferred`/`優先`, `LABELS.marksTime`
  `Time`/`時期`, `LABELS.marksGoals` (the disclosure summary), `TEXT.marksMissing(missing,
  total)`. The disclosure note and outcome lines reuse the chat card's own keys
  (`DESCRIPTIONS.chatCardNote`, `TEXT.chatCardSolutions`/`chatCardFailure`/`chatCardLimit`/
  `chatCardError`/`chatCardCancelled`): both show one Prolog goal's outcome.
- Values join `, ` (qualifier, grade) and `; ` (preferences, times), as `marksView` returns them.

## Acceptance

- U1 with the real engine, every prepared question's `marksView` over its live answer and marks
  solutions yields, per statement, the readings an independent reading of the bag's compiled
  heads predicts (label + value per pair, in order); the grade sits on the first statement of
  each document run alone.
- U2 the panel renders exactly what the join returns: PID-unique values planted in a marks
  solution reach the DOM verbatim, in their pairs; a statement with no marks renders no `<dl>`.
- U3 each of `failure`, `limit`, `error`, `cancelled`, a missing document, an undecodable solution
  and an engine without the path renders the notice with its counts; `loading` renders none.
- U4 the disclosure lists the goal and each solution's display byte-equal to the engine's.
- U5 Japanese: the labels render the ruled terms; every value is byte-equal to the English one.
- U6 the busy state is unchanged: the shipped streaming cases hold.
- U7 `pnpm visual-qa` fits every state with the rows present; `operator` visual QA at 320, 375
  and 1280 px, both themes, both locales, against `Decisions`; the user's live review is owed
  (`.claude/rules/ui.md` `User review`).
- Red witness: U1–U5 RED at base (no rows, no keys), command in the commit body.

## Red witness (`tester-6`, diff-blind, `wt/tester-6` `c7c0943`)

- `tests/marks-panel.dom.test.ts` 28/36 RED at base `289209f`, no stubs: `pnpm exec vitest run
  tests/marks-panel.dom.test.ts` — no facts rows, no notice, no disclosure, no keys. The 8
  base-GREEN cases assert absence (`idle`, `loading`, busy, complete outcomes) and stay
  uncredited: `pnpm stryker` cannot mount a component.
- `tests/marks-readings-live.test.ts` 7/7 base-GREEN by design: `marksView` shipped in ann-u1;
  its credit is `pnpm stryker` over `src/questions/marks.ts` with this suite alone.
- Against MAIN's implementation: 43/43 green on the first run.

## U1 credit (`pnpm stryker`, default operators, MAIN's run)

`STRYKER_SUITE=tests/marks-readings-live.test.ts STRYKER_MUTATE=src/questions/marks.ts pnpm exec
stryker run tools/mutation/stryker.config.mjs --timeoutMS 60000 && node
tools/mutation/survivors.mjs`: 497 mutants, **272 killed** by U1's live readings, 168 survived,
57 uncovered. Every survivor ruled by MAIN, who did not author U1, against U1's contract — live,
well-formed answers and marks — by class, `marks.ts` lines: the decoder's malformed-term branches
89–233; `sameTerm`'s term kinds no `Source` holds 256–300; the join's fail-closed branches and the
non-`settled` states 314–409 — behaviour U1 leaves open, recorded. Each class is graded where it is
the contract: `tests/marks-view.test.ts` M9 (375 malformed variants), M11 (wrong `Source`,
duplicate, missing, undecodable, misaligned), `tests/marks-panel.dom.test.ts` U3 (every state).
