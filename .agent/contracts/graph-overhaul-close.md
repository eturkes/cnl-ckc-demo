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
| L1 | unknown | |
| L2 | unknown | |
| L3 | unknown | |
| L4 | unknown | |
| L5 | unknown | |
| L6 | unknown | |
