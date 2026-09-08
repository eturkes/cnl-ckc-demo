# m1u5 probe matrix — seed

Shared row set for M1.5 wave 1. Every wave-1 teammate fills THIS id set in its own
report, so MAIN compares row `Kn` across reports on one line. Row ids also become
the acceptance contract's predicate ids and the red suite's case ids.

Fill rule: copy this table into your report, replace every `unknown`, keep row ids and
row order. Report shape = two-tier: this table first, then `## <id>` detail sections
(≤10 lines each) for rows whose finding needs backing. Report ≤8 KB.

Cell semantics by role:

- `map-m1u5` — finding = the normative obligation stated as ONE testable predicate
  (what the DOM/behaviour must be), evidence = spec anchor (URL + section or quoted
  clause) or `file:line` in this repo.
- `spike-m1u5-lib` — finding = what `bits-ui` ACTUALLY does for that row, measured by
  driving the built component, evidence = probe command + `file:line` of the probe.

Verdict prefix required on every finding (`--verdict`): `pass:` = obligation met /
behaviour conforms; `fail(low|med|high):` = absent, wrong, or unreachable.

| id | finding | evidence |
| --- | --- | --- |
| S1 | unknown | unknown |
| S2 | unknown | unknown |
| S3 | unknown | unknown |
| S4 | unknown | unknown |
| S5 | unknown | unknown |
| S6 | unknown | unknown |
| S7 | unknown | unknown |
| S8 | unknown | unknown |
| K1 | unknown | unknown |
| K2 | unknown | unknown |
| K3 | unknown | unknown |
| K4 | unknown | unknown |
| K5 | unknown | unknown |
| K6 | unknown | unknown |
| K7 | unknown | unknown |
| K8 | unknown | unknown |
| K9 | unknown | unknown |
| K10 | unknown | unknown |
| K11 | unknown | unknown |
| P1 | unknown | unknown |
| P2 | unknown | unknown |
| P3 | unknown | unknown |
| B1 | unknown | unknown |
| B2 | unknown | unknown |
| B3 | unknown | unknown |
| B4 | unknown | unknown |
| R1 | unknown | unknown |
| R2 | unknown | unknown |
| R3 | unknown | unknown |
| H1 | unknown | unknown |
| H2 | unknown | unknown |
| H3 | unknown | unknown |
| H4 | unknown | unknown |

Row subjects — the widget = a readonly select-only combobox over the six catalog ids,
DOM focus staying on the combobox element:

- `S1` combobox element + `role`, and where its accessible name comes from.
- `S2` `aria-expanded` on the combobox tracks popup state, both directions.
- `S3` `aria-controls` names the listbox element's `id`.
- `S4` `aria-haspopup="listbox"` — required, implicit, or optional.
- `S5` popup `role="listbox"` with an accessible name; every child `role="option"`.
- `S6` `aria-selected="true"` on the selected option only; what the other 5 carry.
- `S7` `aria-activedescendant` = focused option's `id` while open; its value when
  closed; DOM focus never leaves the combobox element.
- `S8` element choice for a NON-editable combobox: `<input readonly>` vs `<div
  role="combobox" tabindex="0">` vs `<button>` — what the spec permits, what each
  costs a screen reader, and how the selected question text is exposed.
- `K1` `ArrowDown` / `Alt+ArrowDown` while closed: opens, and which option takes
  visual focus.
- `K2` `ArrowUp` / `Alt+ArrowUp` while closed: same two questions.
- `K3` `Enter` and `Space` while closed.
- `K4` `Home` / `End` while closed.
- `K5` printable-character typeahead: closed and open, and its buffer/timeout rule.
- `K6` `ArrowDown` / `ArrowUp` while open: move visual focus; wrap or stop at the end.
- `K7` `Home` / `End` while open.
- `K8` `Enter` while open: select, close, focus destination.
- `K9` `Escape` while open: close, and whether the value can change.
- `K10` `Tab` while open: select-or-not, close, focus destination.
- `K11` `Alt+ArrowUp` while open.
- `P1` pointer on the combobox (and any toggle button): open, close, focus.
- `P2` pointer on an option: select, close, focus destination.
- `P3` pointer outside / blur: close, and whether the value can change.
- `B1` the option holding visual focus is scrolled into view inside the listbox.
- `B2` selection resolves to a `QuestionId` from `src/questions/catalog.ts` and to
  nothing else; no keystroke path produces free text or an unknown id.
- `B3` `axe-core` over the intake surface, listbox open AND closed: violation ids.
- `B4` `svelte-check --fail-on-warnings` plus the compiler's own a11y warnings over
  the intake surface.
- `R1` (`map`) placement + naming for the component file and its props/callback,
  argued from the existing tree's own conventions with `file:line`.
- `R2` (`map`) where a DOM component test runs in this repo: vitest projects, the
  `*.dom.test.ts` split, `resolve.conditions`, gate wiring, `file:line` anchors.
- `R3` (`map`) git archaeology: how `.agent/contracts/m1u2.md` and `m1u4.md` state
  predicates and decisions, and what a u5 contract must therefore carry.
- `H1` (`spike`) `bits-ui` under the fixed harness (Svelte 5 `mount` + jsdom 29 +
  `resolve.conditions: ['browser']`): does it mount, and what breaks.
- `H2` (`spike`) DOM the library actually emits: portal target, wrapper elements,
  styling hooks, `data-*` attributes, and what a caller cannot control.
- `H3` (`spike`) production gzip delta of `bits-ui` alone, measured as the same app
  built with and without it.
- `H4` (`spike`) dependency + integration cost: transitive tree, Svelte peer range,
  release cadence, `eval`/`new Function` presence (M4 ships under a possible strict
  CSP), and SSR/static-build behaviour.
