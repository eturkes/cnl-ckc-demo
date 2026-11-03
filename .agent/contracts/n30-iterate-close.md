# n30 ITERATE close — fixed check set

Diff under review: `git diff 8c6acd7..HEAD` (the commit that set `Phase: ITERATE` → the close),
read as the shipped surface at HEAD. Tier: `docs` + prototype (PROTOTYPE law: shortcuts allowed
where they read as shortcuts). One `reviewer`; MAIN adjudicates every row.

| id | lens | pass when |
|---|---|---|
| L1 | Artifacts run | every `Artifacts` prototype entry runs by its recorded command on a fresh clone: `node prototype/scope-guards/derive.mjs && pnpm dev`, `/prototype/scope-guards/app/` and `/prototype/scope-guards/app/graph/` serve and boot; `capture.mjs` passes against it |
| L2 | rulings held | each user ruling of this session sits in `Decisions` (struck group + unstruck-when-derived, three surfaces, exclusions on every answer as 8 conditions with sources, page-wide date incl. chat, hub + edge-state graph, selected-only guard, graph overhaul everything open) and matches the user's answer |
| L3 | readable alone | each n30 `Decisions` entry reads without opening the prototype: a fresh IMPLEMENT agent could build from it |
| L4 | stubs read as stubs | every stub, shortcut and hard-coded value in `prototype/scope-guards/` that a reader would take for real either reads as one on screen or in `Artifacts`, or is derived from the KB (snapshot date adapter, buffered answers, recorded chat, English-only copy, hand-built condition grammar) |
| L5 | KB claims live | every KB statement the prototype shows (superseded statement, exclusion condition, derived historical statement, chat KB part) comes from a live Prolog goal, never records.json or a literal |
| L6 | spec current | `.agent/spec.md` matches what shipped (Artifacts, Tasks, Phase) and passes `pnpm spec:lint` + `pnpm spec:check` |
| L7 | shipped untouched | no file outside `prototype/`, `.agent/`, `.gitignore`, `.prettierignore`, `eslint.config.js` changed; the two ignore-config edits exclude `prototype/` alone and no existing check loses coverage |

## Adjudication (reviewer-31 at f32998e; MAIN rules every row)

| id | reviewer | MAIN ruling | evidence |
|---|---|---|---|
| L1 | pass | pass | fresh clone: install, `kb:build`, `derive.mjs`, Vite, `capture.mjs` rc 0 (3 viewports × 5 date states, 7 questions); the standalone graph page booted on an isolated retry after one 30 s load-event timeout at a 1-min load of 56.9 from other projects — load, not the page; MAIN's own `webcap` of `/prototype/scope-guards/app/graph/` rc 0 |
| L2 | pass | pass | every ruling of the session sits in `Decisions` |
| L3 | pass | pass | n30 entries read without the prototype |
| L4 | fail(low): snapshot adapter, buffered answers and hand-built condition grammar disclosed in source alone | fixed at 9d270a2 → pass | `git show 9d270a2:.agent/spec.md` line 39 `Prototype shortcuts, each owed a real` + the list (one re-review round, MAIN) |
| L5 | pass | pass | every shown KB statement reads a live goal; the graph's static projection from the bag is a producer-style projection, not an answer claim |
| L6 | pass | pass | `spec:lint` + `spec:check` rc 0 |
| L7 | pass | pass | `git diff --name-only 8c6acd7..f32998e` inside the allowlist; eslint + prettier exclude `prototype/` alone |
