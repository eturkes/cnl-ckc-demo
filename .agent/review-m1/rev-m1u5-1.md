# rev-m1u5-1 — adversarial review of M1.u5, accessible question intake

Check set = `.agent/contracts/m1u5-rev-checkset.md` (fixed, 28 rows). Verdict table below;
detail sections keyed by row id. Fill every row IN PLACE; never renumber.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u5-1.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| I01 | pass: host preserves the implicit-listbox combobox relation and label-derived accessible name in closed and open frames | `pnpm exec vitest … rev-m1u5-structure-probe…` 1/1; `src/questions/QuestionCombobox.svelte:180-190` |
| I02 | pass: expanded state tracks hidden, open, commit, cancel and click-toggle transitions with exact string values | structure probe 1/1; `src/questions/QuestionCombobox.svelte:187,204` |
| I03 | fail(low): runtime options follow catalog order, but the suite embeds two generated question sentences as source literals | `tests/question-combobox.dom.test.ts:217,234`; `.agent/review-m1/red-m1u5-i03.test.mjs` rc=1 |
| I04 | pass: each of six controlled selections yields one true and five false attributes; null yields six false attributes | structure probe 1/1; `src/questions/QuestionCombobox.svelte:207-216` |
| I05 | pass: active descendant is valued only while open, disappears when closed, and DOM focus stays on the host | structure probe 1/1; `src/questions/QuestionCombobox.svelte:160-172,188` |
| I06 | pass: controlled text selects catalog copy or the prompt, and the combobox subtree contains no focusable descendant | structure probe 1/1; `src/questions/QuestionCombobox.svelte:191-194` |
| I07 | fail(med): closed ArrowUp preserves a nonfirst controlled selection instead of activating option 1; other arrow variants pass | `.agent/review-m1/i07-i09.red.dom.test.ts` rc=1; `src/questions/QuestionCombobox.svelte:54-57,98-104` |
| I08 | pass: closed Enter and Space open at the selection, while Home and End open at exact endpoints without emitting | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:100-109` |
| I09 | fail(med): a fresh `w` from selected option 1 activates option 2, not the first catalog match; cycle, case and expiry pass | `.agent/review-m1/i07-i09.red.dom.test.ts` rc=1; `src/questions/QuestionCombobox.svelte:73-91` |
| I10 | pass: regular arrows move one step and clamp at both endpoints; Home and End jump exactly, with zero selection emits | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:116-134` |
| I11 | pass: open Enter emits the active catalog id exactly once, closes the popup and retains combobox DOM focus | behavior probe 11/13 pass; `tests/question-combobox.dom.test.ts:264-273` |
| I12 | pass: Escape emits nothing, closes, clears typeahead and restores active state to the controlled selection on reopen | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:60-64,143-146` |
| I13 | pass: open Tab emits the active id once, closes and leaves the cancelable event unprevented for native focus traversal | behavior probe 11/13 pass; `tests/question-combobox.dom.test.ts:287-295` |
| I14 | pass: open Alt+ArrowUp commits the moved active option exactly once and closes, while its closed counterpart remains inert | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:119-125` |
| I15 | pass: host clicks toggle without selection, and focusout to an external node cancels the popup without selection | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:156-162` |
| I16 | pass: direct and nested option targets resolve to the owning option, emit its id once, close and restore host focus | nested-target probe pass; `src/questions/QuestionCombobox.svelte:165-175` |
| I17 | pass: open, keyboard and typeahead active changes each scroll only the new option once with nearest alignment; clamp is silent | receiver-count probe pass; `src/questions/QuestionCombobox.svelte:41-46` |
| I18 | pass: mixed printable, arrow, keyboard and pointer commits emit only catalog ids, while a frozen selected prop keeps displayed text unchanged | fuzz-sequence probe pass; `tests/question-combobox.dom.test.ts:350-361` |
| I19 | unknown | unknown |
| I20 | unknown | unknown |
| I21 | unknown | unknown |
| I22 | unknown | unknown |
| I23 | unknown | unknown |
| I24 | unknown | unknown |
| I25 | unknown | unknown |
| I26 | unknown | unknown |
| I27 | unknown | unknown |
| I28 | unknown | unknown |

## Details

### I03

**Ruling:** The rendered option labels come from `QUESTION_CATALOG`, but K5 comments copy the
full `recommendation-exists` and `dosage-reduction-content` questions. This breaches I03's
explicit component-and-suite literal census. Runtime behavior is unchanged, but generated copy
can drift while the suite keeps stale explanatory claims.

**Acceptance:** Replace both sentence literals with catalog-id descriptions. Then
`node --test .agent/review-m1/red-m1u5-i03.test.mjs` must return rc=0.

### I07

**Ruling:** `show()` always seeds `activeIndex` from the controlled selection. The closed-key
branch uses it unchanged for plain `ArrowUp`, so selection 4 opens at option 4. I07/K2 requires
option 1. Keyboard users receive the same anchor for opposing arrows and cannot rely on the
ruled directional entry behavior.

**Acceptance:** From every nonfirst selection, closed `ArrowUp` must open at option 1, emit zero
calls and preserve the closed `Alt+ArrowUp` no-op. Then run
`pnpm exec vitest run --config .agent/review-m1/red-m1u5.config.ts -t 'I07 opens'`; it must return rc=0.

### I09

**Ruling:** Fresh typeahead always searches after `activeIndex`. From selected option 1, `w`
skips that first matching label and activates option 2. This breaches I09's first-match predicate
and makes a new prefix behave like an already-started cycle. A keyboard user can miss the first
viable question until the search wraps.

**Acceptance:** A fresh prefix must search from catalog option 1; only repeated single-character
input may cycle after the active match. Preserve case-insensitive prefixes and 500 ms expiry. Then
run `pnpm exec vitest run --config .agent/review-m1/red-m1u5.config.ts -t 'I09 opens'`; it must return rc=0.

## Register

None.
