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

## Acceptance

- U1 with the real engine and the real controller, every prepared question's rendered rows equal
  ann-u1's join over the live marks, label + value per pair, in order; the grade sits on the
  first statement of each document run alone.
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
