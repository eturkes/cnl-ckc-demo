# review-m1 — judgment-review ledger

M1 MILESTONE-REVIEW state. One row per fixed check-set row; check text stays in
the unit's check set, this ledger carries the ruling alone. Reviewer verdicts and
their evidence live in the committed reports under `.agent/review-m1/`.

Verdict vocabulary: `pass` (reviewer observed it, MAIN observed it too), `accepted
fail(sev)` (defect confirmed, acceptance check names what closes it), `fixed(sev)`
(MAIN shipped the fix and reran the acceptance check), `rejected — <reason>` (MAIN
overrules the reviewer), `unknown` (not yet adjudicated; carries forward).

Every `fixed` row is red under a mutant that removes its fix: `.scratch/verify-fixes.py`
restores each pre-fix behaviour and reruns the closing test, 6/6 RED.

## Coverage

| unit | tier | check set | rows | adjudicated | session |
| --- | --- | --- | --- | --- | --- |
| u1 | kernel | not enumerated | ? | 0 | pending |
| u2 | kernel | not enumerated | ? | 0 | pending |
| u3 | kernel | `.agent/contracts/m1u3-rev-checkset.md` | 45 | 25 | 1 |
| u4 | kernel | `.agent/contracts/m1u4-rev-checkset.md` | 24 | 18 | 1 |
| u5 | kernel | not enumerated | ? | 0 | pending |
| u6 | kernel | not enumerated | ? | 0 | pending |
| u7 | docs | not enumerated (spot-check grade) | ? | 0 | pending |
| cross-cutting | — | not enumerated | ? | 0 | pending |
| audit-m1 | — | `.agent/review-m1/audit-m1.ids`, self-enumerated | 137 | 137 | 1 |

Session 2 resume point = u3 rows still `unknown`, then u4, then enumerate u1, u2,
u5, u6, u7 and cross-cutting. Successors inherit branches `wt/rev-m1u3-2` and
`wt/rev-m1u4-2`, which hold every probe and red test the reports cite.

## Rows — u3, u4

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u3 | — | R01 | unknown | — | — |
| u3 | rev-m1u3-2 | R02 | pass | `.agent/review-m1/rev-m1u3-2.md` R02 | — |
| u3 | rev-m1u3-2 | R03 | fixed(low) | `tests/engine-budgets.test.ts` "P2.5 reads an exact-fit cap as honest exhaustion" | a cap equal to the solution count returns `solutions`, not `answer-cap` — green, and red under mutant `R03` |
| u3 | rev-m1u3-2 | R04 | pass | `.agent/review-m1/rev-m1u3-2.md` R04 | — |
| u3 | rev-m1u3-2 | R05 | pass | `.agent/review-m1/rev-m1u3-2.md` R05 | — |
| u3 | rev-m1u3-2 | R06 | pass | `.agent/review-m1/rev-m1u3-2.md` R06 | — |
| u3 | — | R07 | unknown | — | — |
| u3 | — | R08 | unknown | — | — |
| u3 | rev-m1u3-2 | R09 | fixed(med) | `tests/engine-budgets.test.ts` "P2.7 terminates and recreates the worker after a heap limit" | `limit:'heap'` terminates and recreates the worker before the outcome lands; the replacement re-verifies `manifest.contract` and serves the next query — green, red under mutant `R09` |
| u3 | rev-m1u3-2 | R10 | pass | `.agent/review-m1/rev-m1u3-2.md` R10 | — |
| u3 | rev-m1u3-2 | R11 | fixed(low) | injected `kind:'probe'` variant → `pnpm check` rc 1, `protocol.ts:111` + `client.ts:231` both `not assignable to type 'never'` | a new `EngineResponse` variant fails `pnpm check` at `isTerminal` AND `EngineClient.query` |
| u3 | rev-m1u3-2 | R12 | pass | `.agent/review-m1/rev-m1u3-2.md` R12 | — |
| u3 | rev-m1u3-2 | R13 | pass | `.agent/review-m1/rev-m1u3-2.md` R13 | — |
| u3 | — | R14 | unknown | — | — |
| u3 | rev-m1u3-2 | R15 | pass | `.agent/review-m1/rev-m1u3-2.md` R15 | — |
| u3 | rev-m1u3-2 | R16 | pass | `.agent/review-m1/rev-m1u3-2.md` R16 | — |
| u3 | rev-m1u3-2 | R17 | pass | `.agent/review-m1/rev-m1u3-2.md` R17 | — |
| u3 | rev-m1u3-2 | R18 | pass | `.agent/review-m1/rev-m1u3-2.md` R18 | — |
| u3 | rev-m1u3-2 | R19 | pass | `.agent/review-m1/rev-m1u3-2.md` R19 | — |
| u3 | rev-m1u3-2 | R20 | pass | `.agent/review-m1/rev-m1u3-2.md` R20 | — |
| u3 | rev-m1u3-2 | R21 | pass | `.agent/review-m1/rev-m1u3-2.md` R21 | — |
| u3 | rev-m1u3-2 | R22 | pass | `.agent/review-m1/rev-m1u3-2.md` R22 | — |
| u3 | rev-m1u3-2 | R23 | fixed(low) | `tests/engine-budgets.test.ts` "P5.3 treats the qsave shlib text as fatal anywhere but image load" | a runtime consult emitting `library(shlib)` is fatal; only image load tolerates it — green, red under mutant `R23` |
| u3 | rev-m1u3-2 | R24 | pass | `.agent/review-m1/rev-m1u3-2.md` R24 | — |
| u3 | rev-m1u3-2 | R25 | pass | `.agent/review-m1/rev-m1u3-2.md` R25 | — |
| u3 | rev-m1u3-2 | R26 | rejected — contract defect | `.agent/review-m1/rev-m1u3-2.md` R26 | memory records the 3 undeclared calls; `swipl-wasm` pinned exact; a version bump re-verifies them |
| u3 | rev-m1u3-2 | R27 | pass | `.agent/review-m1/rev-m1u3-2.md` R27 | — |
| u3 | — | R28 | unknown | — | — |
| u3 | — | R29 | unknown | — | — |
| u3 | — | R30 | unknown | — | — |
| u3 | rev-m1u3-2 | R31 | pass | `.agent/review-m1/rev-m1u3-2.md` R31 | — |
| u3 | rev-m1u3-2 | R32 | pass | `.agent/review-m1/rev-m1u3-2.md` R32 | — |
| u3 | — | R33 | unknown | — | — |
| u3 | — | R34 | unknown | — | — |
| u3 | — | R35 | unknown | — | — |
| u3 | — | R36 | unknown | — | — |
| u3 | — | R37 | unknown | — | — |
| u3 | — | R38 | unknown | — | — |
| u3 | — | R39 | unknown | — | — |
| u3 | — | R40 | unknown | — | — |
| u3 | — | R41 | unknown | — | — |
| u3 | — | R42 | unknown | — | — |
| u3 | — | R43 | unknown | — | — |
| u3 | — | R44 | unknown | — | — |
| u3 | — | R45 | unknown | — | — |
| u4 | rev-m1u4-2 | c01 | pass | `.agent/review-m1/rev-m1u4-2.md` c01 | — |
| u4 | rev-m1u4-2 | c02 | pass | `.agent/review-m1/rev-m1u4-2.md` c02 | — |
| u4 | rev-m1u4-2 | c03 | pass | `.agent/review-m1/rev-m1u4-2.md` c03 | — |
| u4 | rev-m1u4-2 | c04 | pass | `.agent/review-m1/rev-m1u4-2.md` c04 | — |
| u4 | rev-m1u4-2 | c05 | pass | `.agent/review-m1/rev-m1u4-2.md` c05 | — |
| u4 | rev-m1u4-2 | c06 | fixed(low) | `tests/questions-live.test.ts` "refuses a bag whose exported query set is not the declared one" | `catalogRecords` throws on the extra-file case, so `kb:build` exits nonzero — green, red under mutant `c06` |
| u4 | rev-m1u4-2 | c07 | pass | `.agent/review-m1/rev-m1u4-2.md` c07 | — |
| u4 | rev-m1u4-2 | c08 | pass | `.agent/review-m1/rev-m1u4-2.md` c08 | — |
| u4 | rev-m1u4-2 | c09 | pass | `.agent/review-m1/rev-m1u4-2.md` c09 | — |
| u4 | rev-m1u4-2 | c10 | pass | `.agent/review-m1/rev-m1u4-2.md` c10 | — |
| u4 | rev-m1u4-2 | c11 | pass | `.agent/review-m1/rev-m1u4-2.md` c11 | — |
| u4 | rev-m1u4-2 | c12 | fixed(med) | `tests/questions-live.test.ts` "sorts serialized rows by term order rather than by rendered bytes" + "collapses duplicate proofs of one fact into a single row" | a byte-sort row mutant and a dedup-removal mutant each turn `pnpm test` red |
| u4 | rev-m1u4-2 | c13 | pass | `.agent/review-m1/rev-m1u4-2.md` c13 | — |
| u4 | rev-m1u4-2 | c14 | pass | `.agent/review-m1/rev-m1u4-2.md` c14 | — |
| u4 | rev-m1u4-2 | c15 | pass | `.agent/review-m1/rev-m1u4-2.md` c15 | — |
| u4 | rev-m1u4-2 | c16 | pass | `.agent/review-m1/rev-m1u4-2.md` c16 | — |
| u4 | rev-m1u4-2 | c17 | pass | `.agent/review-m1/rev-m1u4-2.md` c17 | — |
| u4 | rev-m1u4-2 | c18 | pass | `.agent/review-m1/rev-m1u4-2.md` c18 | — |
| u4 | — | c19 | unknown | — | — |
| u4 | — | c20 | unknown | — | — |
| u4 | — | c21 | unknown | — | — |
| u4 | — | c22 | unknown | — | — |
| u4 | — | c23 | unknown | — | — |
| u4 | — | c24 | unknown | — | — |

## Rows — audit-m1

121 `pass` rows are adjudicated in bulk: each replays a recorded number against
`9020e62` and carries its own command pointer in the committed report. The 16
rows MAIN ruled individually follow.

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| M1 claims | audit-m1 | A001-A137 pass set | pass | `.agent/review-m1/audit-m1.md`, 121 rows | recorded value reproduced at `9020e62` |
| M1 claims | audit-m1 | A022 | accepted | `.agent/review-m1/audit-m1.md` A022 | roadmap u5 no longer claims intake holds selection in `App.svelte` local `$state` |
| M1 claims | audit-m1 | A036 | accepted | `.agent/review-m1/audit-m1.md` A036 | all three `@fontsource-variable` deps are exact-pinned, no caret range |
| M1 claims | audit-m1 | A045 | accepted | `.agent/review-m1/audit-m1.md` A045 | memory + polish record 64 `svelte-check` errors for the untyped walker, not 41 |
| M1 claims | audit-m1 | A051 | rejected — stale target | `.agent/review-m1/audit-m1.md` A051 | audit ran at `9020e62`; the ledger was created at `cd0de15`, one commit later |
| M1 claims | audit-m1 | A084 | rejected — instrument mismatch | `.agent/review-m1/audit-m1.md` A084 | memory names SWI co-load as the instrument; a static clause census measures a different population |
| M1 claims | audit-m1 | A087 | accepted | `.agent/review-m1/audit-m1.md` A087 | memory records pvm 437132 B and the measured two-build reproduce time |
| M1 claims | audit-m1 | A089 | accepted | `.agent/review-m1/audit-m1.md` A089 | memory records the post-u7 `dist/` totals, fonts and licences included |
| M1 claims | audit-m1 | A090 | accepted | `.agent/review-m1/audit-m1.md` A090 | memory's Oracle-fidelity bullet states all four exported queries are byte-proven |
| M1 claims | audit-m1 | A100 | accepted | `.agent/review-m1/audit-m1.md` A100 | memory records that the smoke negative control needs `dist/` removed too |
| M1 claims | audit-m1 | A107 | accepted | `.agent/review-m1/audit-m1.md` A107 | memory records the walker at 548 lines |
| M1 claims | audit-m1 | A111 | accepted | `.agent/review-m1/audit-m1.md` A111 | m1u1 C1 lists all six `tools/kb/*.mjs` |
| M1 claims | audit-m1 | A113 | accepted | `.agent/review-m1/audit-m1.md` A113 | m1u2 records `vite.config.ts:22` and pvm 437132 B |
| M1 claims | audit-m1 | A114 | rejected — hedged by contract | `.agent/review-m1/audit-m1.md` A114 | m1u2 C1's own preamble declares its paths provisional |
| M1 claims | audit-m1 | A119 | accepted | `.agent/review-m1/audit-m1.md` A119 | m1u4 D1 records the catalog artifact at 3337 B |
| M1 claims | audit-m1 | A121 | accepted | `.agent/review-m1/audit-m1.md` A121 | m1u4 records `tools/kb/check.mjs:47-49` as the fail accumulator |
| M1 claims | audit-m1 | A137 | accepted | `.agent/review-m1/audit-m1.md` A137 | roadmap u7 records map-m1u7 10/26 and both wave gauges at 76% |
