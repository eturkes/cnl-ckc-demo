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
