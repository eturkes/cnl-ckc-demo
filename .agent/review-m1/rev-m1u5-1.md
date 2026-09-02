# rev-m1u5-1 — adversarial review of M1.u5, accessible question intake

Check set = `.agent/contracts/m1u5-rev-checkset.md` (fixed, 28 rows). Verdict table below;
detail sections keyed by row id. Fill every row IN PLACE; never renumber.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u5-1.md --verdict`
Every `tools/review-m1/red-m1u5-*.test.mjs` harness below lives on branch `wt/rev-m1u5-1`;
run one from the primary tree as `node --test <worktree-or-branch-checkout>/<path>`.

| id | finding | evidence |
| --- | --- | --- |
| I01 | pass: host preserves the implicit-listbox combobox relation and label-derived accessible name in closed and open frames | `pnpm exec vitest … rev-m1u5-structure-probe…` 1/1; `src/questions/QuestionCombobox.svelte:180-190` |
| I02 | pass: expanded state tracks hidden, open, commit, cancel and click-toggle transitions with exact string values | structure probe 1/1; `src/questions/QuestionCombobox.svelte:187,204` |
| I03 | fail(low): runtime options follow catalog order, but the suite embeds two generated question sentences as source literals | `tests/question-combobox.dom.test.ts:213,234`; `tools/review-m1/red-m1u5-i03.test.mjs` rc=1 |
| I04 | pass: each of six controlled selections yields one true and five false attributes; null yields six false attributes | structure probe 1/1; `src/questions/QuestionCombobox.svelte:207-216` |
| I05 | pass: active descendant is valued only while open, disappears when closed, and DOM focus stays on the host | structure probe 1/1; `src/questions/QuestionCombobox.svelte:160-172,188` |
| I06 | pass: controlled text selects catalog copy or the prompt, and the combobox subtree contains no focusable descendant | structure probe 1/1; `src/questions/QuestionCombobox.svelte:191-194` |
| I07 | fail(med): closed ArrowUp preserves a nonfirst controlled selection instead of activating option 1; other arrow variants pass | `tools/review-m1/red-m1u5-i07-i09.test.mjs` rc=1; `src/questions/QuestionCombobox.svelte:54-57,98-104` |
| I08 | pass: closed Enter and Space open at the selection, while Home and End open at exact endpoints without emitting | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:100-109` |
| I09 | fail(med): a fresh `w` from selected option 1 activates option 2, not the first catalog match; cycle, case and expiry pass | `tools/review-m1/red-m1u5-i07-i09.test.mjs` rc=1; `src/questions/QuestionCombobox.svelte:73-91` |
| I10 | pass: regular arrows move one step and clamp at both endpoints; Home and End jump exactly, with zero selection emits | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:116-134` |
| I11 | pass: open Enter emits the active catalog id exactly once, closes the popup and retains combobox DOM focus | behavior probe 11/13 pass; `tests/question-combobox.dom.test.ts:264-273` |
| I12 | pass: Escape emits nothing, closes, clears typeahead and restores active state to the controlled selection on reopen | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:60-64,143-146` |
| I13 | pass: open Tab emits the active id once, closes and leaves the cancelable event unprevented for native focus traversal | behavior probe 11/13 pass; `tests/question-combobox.dom.test.ts:287-295` |
| I14 | pass: open Alt+ArrowUp commits the moved active option exactly once and closes, while its closed counterpart remains inert | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:119-125` |
| I15 | pass: host clicks toggle without selection, and focusout to an external node cancels the popup without selection | behavior probe 11/13 pass; `src/questions/QuestionCombobox.svelte:156-162` |
| I16 | pass: direct and nested option targets resolve to the owning option, emit its id once, close and restore host focus | nested-target probe pass; `src/questions/QuestionCombobox.svelte:165-175` |
| I17 | pass: open, keyboard and typeahead active changes each scroll only the new option once with nearest alignment; clamp is silent | receiver-count probe pass; `src/questions/QuestionCombobox.svelte:41-46` |
| I18 | pass: mixed printable, arrow, keyboard and pointer commits emit only catalog ids, while a frozen selected prop keeps displayed text unchanged | fuzz-sequence probe pass; `tests/question-combobox.dom.test.ts:350-361` |
| I19 | pass: axe reports zero violations closed and open; each state enumerates only `color-contrast` as incomplete | axe probe 1/1; closed/open=`violations:[]`, `incomplete:[color-contrast]` |
| I20 | pass: warning-fatal Svelte check reports 359 files, zero errors and warnings; eslint-plugin-svelte has 86 rules and zero a11y rules | `pnpm check` rc=0; `package.json:10`; plugin census=86/0 |
| I21 | pass: the exact controlled prop pair imports only catalog data; its complete two-edge graph reaches JSON, never engine, service or worker code | `src/questions/QuestionCombobox.svelte:9-18`; forbidden graph scan rc=1, positive control rc=0 |
| I22 | pass: the focusable host is the ruled div, and border, surface, sizing and prompt styling provide the text-field affordance without button semantics | `src/questions/QuestionCombobox.svelte:177-194,243-260` |
| I23 | fail(low): code implements all three D3 rulings, but the suite does not bind the exact 500 ms boundary; 1 ms and 599 ms mutants stay green | `tools/review-m1/red-m1u5-i23.test.mjs` rc=1; both K5 mutants rc=0 |
| I24 | pass: node and DOM projects run independently with the required exclusion and browser condition; the lock resolves jsdom exactly 29.1.1 | `vite.config.ts:15-22`; node=11 files/151 tests, dom=2 files/47 tests, both rc=0; `pnpm-lock.yaml:2236` |
| I25 | pass: one listbox-scoped suppression names the emitted warning exactly, and removing pointer handlers leaves all keyboard commit cases green | `src/questions/QuestionCombobox.svelte:196-207`; no-ignore check=1 named warning; keyboard probe=3/3 |

| I26 | pass: 17 predicates are browser-safe by construction; 9 remain browser-suspect, with one real-Chromium probe specified to close the set | `src/questions/QuestionCombobox.svelte:42-175`; Details I26 |
| I27 | pass: all five prescribed mutations turn the full DOM project red and every source mutation restores byte-identically before the next run | mutation rc=1 each: S7, K6, K9, B1, S5/S6; `tests/question-combobox.dom.test.ts:91-360` |
| I28 | fail(low): component and Vitest config pass, but suite copy plus dead scratch and worktree provenance make three of five durable files fail the ledger | `tests/question-combobox.dom.test.ts:213,234`; `.agent/contracts/m1u5.md:10-12`; `.agent/memory.md:365-366` |

## Details

### I03

**Ruling:** The rendered option labels come from `QUESTION_CATALOG`, but K5 comments copy the
full `recommendation-exists` and `dosage-reduction-content` questions. This breaches I03's
explicit component-and-suite literal census. Runtime behavior is unchanged, but generated copy
can drift while the suite keeps stale explanatory claims.

**Acceptance:** Replace both sentence literals with catalog-id descriptions. Then
`node --test tools/review-m1/red-m1u5-i03.test.mjs` must return rc=0.

### I07

**Ruling:** `show()` always seeds `activeIndex` from the controlled selection. The closed-key
branch uses it unchanged for plain `ArrowUp`, so selection 4 opens at option 4. I07/K2 requires
option 1. Keyboard users receive the same anchor for opposing arrows and cannot rely on the
ruled directional entry behavior.

**Acceptance:** From every nonfirst selection, closed `ArrowUp` must open at option 1, emit zero
calls and preserve the closed `Alt+ArrowUp` no-op. Then run
`M1U5_ROW=I07 node --test tools/review-m1/red-m1u5-i07-i09.test.mjs`; it must return rc=0.

### I09

**Ruling:** Fresh typeahead always searches after `activeIndex`. From selected option 1, `w`
skips that first matching label and activates option 2. This breaches I09's first-match predicate
and makes a new prefix behave like an already-started cycle. A keyboard user can miss the first
viable question until the search wraps.

**Acceptance:** A fresh prefix must search from catalog option 1; only repeated single-character
input may cycle after the active match. Preserve case-insensitive prefixes and 500 ms expiry. Then
run `M1U5_ROW=I09 node --test tools/review-m1/red-m1u5-i07-i09.test.mjs`; it must return rc=0.

### I23

**Ruling:** The widget carries `TYPEAHEAD_MS = 500`, and the suite covers case-insensitive
prefixes, repeated-character cycling and expiry after 600 ms. It never proves that the buffer
persists before 500 ms or expires at 500 ms. Mutating the constant to 1 or 599 leaves both K5
cases green, so the exact D3 ruling is unbound. A timing regression can ship without a gate signal.

**Acceptance:** Add fake-timer observations immediately before and at the 500 ms boundary. Both
1 ms and 599 ms timeout mutants must make the DOM project red. Then
`node --test tools/review-m1/red-m1u5-i23.test.mjs` must return rc=0.

### I26

The jsdom boundary is explicit below. “Safe” means that the predicate is a synchronous
attribute, array or state transition with no browser-owned default. “Suspect” means that jsdom
stubs or omits a browser-owned observable.

| predicate | ruling | reason |
| --- | --- | --- |
| S1 | browser-suspect | Attribute wiring is fixed, but the computed name and accessibility-tree exposure need a browser AX tree. |
| S2 | browser-safe | One boolean drives both `aria-expanded` and `hidden` synchronously. |
| S3 | browser-safe | Stable generated strings bind `aria-controls` to the listbox id. |
| S4 | browser-safe | Attribute omission is direct template output. |
| S5 | browser-safe | Fixed catalog iteration determines roles, ownership, labels and order. |
| S6 | browser-safe | Direct id equality serializes every selected attribute. |
| S7 | browser-suspect | jsdom cannot prove browser focus behavior or `aria-activedescendant` AX announcement. |
| S8 | browser-safe | Fixed tags and text determine the descendant-focusability census. |
| K1 | browser-safe | Prevented keydown synchronously opens at the controlled anchor. |
| K2 | browser-safe | The closed branches are synchronous and have no native div default. |
| K3 | browser-safe | Prevented Enter and Space have no remaining browser-owned action on a div. |
| K4 | browser-safe | Home and End assign fixed indices synchronously. |
| K5 | browser-suspect | Fake timers omit real timer scheduling, key repeat and composition behavior. |
| K6 | browser-safe | Arithmetic clamping follows prevented keydown events. |
| K7 | browser-safe | Home and End assign fixed indices while open. |
| K8 | browser-suspect | The retained-focus claim needs an actual focused host and browser key dispatch. |
| K9 | browser-safe | Escape prevents default and resets local state synchronously. |
| K10 | browser-suspect | Synthetic Tab cannot execute native focus traversal or its focusout ordering. |
| K11 | browser-safe | Prevented Alt+ArrowUp calls the same bounded commit path. |
| P1 | browser-safe | Click toggling has no focus or layout predicate in the fixed check. |
| P2 | browser-suspect | Real mousedown prevention, delegated click and focus restoration have browser-owned ordering. |
| P3 | browser-suspect | `focusout.relatedTarget` and outside-click ordering differ from synthetic dispatch. |
| B1 | browser-suspect | A prototype spy proves invocation, not layout, scroll containment or final visibility. |
| B2 | browser-safe | Every commit indexes the closed `QUESTION_IDS` tuple, and the selected prop stays controlled. |
| B3 | browser-suspect | jsdom lacks canvas, layout and the browser accessibility tree used by axe. |
| B4 | browser-safe | The warning-fatal static gate is environment-independent at the locked toolchain. |

**Closing probe:** Add one real-Chromium component case, `question-combobox.browser.test.ts`.
Drive actual keyboard, Tab and pointer input. Read focus after K8/K10/P2/P3. Wrap the native
`scrollIntoView` to record receiver and arguments while preserving it, then verify visibility.
Read the Chromium AX tree for S1/S7, exercise K5 on both sides of 500 ms, and run browser axe
closed/open. This single case closes all nine suspect predicates. No browser was launched here.

### I28

This is a judgment-only finding; no mechanical RED test can decide the full authoring ledger.

| file | verdict | reason |
| --- | --- | --- |
| `src/questions/QuestionCombobox.svelte` | pass | One controlled state machine; comments carry host, APG, focus and compiler constraints; prompt and label are short ASD-STE100 copy. |
| `tests/question-combobox.dom.test.ts` | fail | Two full generated questions duplicate catalog copy in comments, breaching the single-source and token-pruning rules. |
| `vite.config.ts` | pass | Both comments explain deployment or worktree-cache constraints; the project split stays compact. |
| `.agent/contracts/m1u5.md` | fail | `Source` names absent `.scratch/agents/map-m1u5.md` plus transient worktree/SHA provenance, so a clean checkout cannot follow its evidence trail. |
| `.agent/memory.md` u5 bullets | fail | The bits-ui entry retains `wt/spike-m1u5-lib` and `dca4f87`; the durable dependency, DOM and timing facts do not need branch provenance. |

**Impact:** Future agents encounter a dead source pointer and spend context on historical branch
coordinates. Generated copy can also drift from the suite commentary. Runtime behavior is intact.

**Acceptance:** Close I03's literal-census test. Make every local path in the contract's Source
section exist in a clean checkout, or remove it when the contract is self-contained. Remove the
worktree/SHA coordinates from the contract and memory while retaining the decision facts. Rerun
this five-file judgment ledger.

## Register

None.
