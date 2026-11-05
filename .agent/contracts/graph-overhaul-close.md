# Graph overhaul PROTOTYPE — closing check set

Fixed before the closing diff is read. Scope = the PROTOTYPE's whole diff (`20aa4a2..HEAD`).

| id | lens | pass when |
|---|---|---|
| L1 | runs | every `Artifacts` prototype entry runs by its recorded command: `derive.mjs` rc 0, `pnpm dev` serves the contact page + every variant, `capture.mjs <dir>` rc 0 over every variant |
| L2 | stubs read as stubs | each offline derivation, text-heuristic split, hard-coded table and simulated behaviour reads as one on the page wherever a reader would take it for the engine's or the KB's own |
| L3 | data truth | every node, edge, count and statement a variant shows traces to `guideline.json` / `semantic-graph.json` fields; no invented clinical content |
| L4 | spec | `.agent/spec.md` `Artifacts`, `Decisions`, `Tasks` match what shipped; `.agent/spec-lint` rc 0; claims registry adjudicated |
| L5 | shipped gates | the diff leaves shipped code untouched; `pnpm gate` green |
| L6 | quality floor | per variant: no overflow at 375 px, both themes legible, keyboard focus visible (capture + screening) |

| id | verdict | evidence |
|---|---|---|
| L1 | pass | `derive.mjs` rc 0; `capture.mjs` 150/150 over 15 variants against `pnpm dev`; after the close edits c07, c10, u02 30/30 and c08 10/10; contact page 1280 light/dark + 375: no overflow, 0 page errors; clean-clone derive rc 1 without `pnpm kb:build` (janitor-3 J6) → run command now starts `pnpm kb:build &&` |
| L2 | pass after fixes | all 15 variants render `g.derivation` (offline derivation, never a live Prolog run); c07, c10, u02 drew the hard-coded `AREAS` with no note → each now says the areas are the PDF's BOX 3 headings, no KB record (`rg -c 'no area record'` = 1 each); u01's station names say they are wayfinding labels; c03/u04 text readings labelled |
| L3 | pass after fixes | c03 + c07 joined each modifier with no space ("preferredfor") → explicit join, c03 rule shot reads "an opioid therapy for the acute pain"; c08 connectors read as the condition's → actor-owned labels (navigator-3); every node/edge source named in each `design.txt` + `variants.ts` |
| L4 | pass | `Artifacts` names the prototype, run command, smoke, finalists and every shortcut; `Decisions` carries the user's four rulings; `Tasks` = ITERATE rows; `.agent/spec-lint` rc 0; `claims:check` ok, every row adjudicated |
| L5 | pass | diff touches `prototype/`, `.agent/`, `docs/claims.md`, `.claude/rules/waves.md` alone; full gate on the CI fan-out run 41864143546 at `8b1c6ad`: 20/20 jobs green (the `ci:gate` wrapper's red = job-record race, classified `gate`, queued); local `pnpm gate` red = load flake, classified, witness on its queue row |
| L6 | pass | capture: no overflow at 375 px in any state; dark overview + trace legible per variant; Tab ×3 on each overview lands on an element drawing a focus ring (15/15); 14 variants honour `prefers-reduced-motion`, c08 has no motion; c04's 12-community palette never graded — carried into the ITERATE network's acceptance, not shipped |
