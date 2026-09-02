# review-m1 — judgment-review ledger

M1 MILESTONE-REVIEW state. One row per fixed check-set row; check text stays in
the unit's check set, this ledger carries the ruling alone. Reviewer verdicts and
their evidence live in the committed reports under `.agent/review-m1/`.

Verdict vocabulary: `pass` (reviewer observed it, MAIN observed it too), `accepted
fail(sev)` (defect confirmed, acceptance check names what closes it), `fixed(sev)`
(MAIN shipped the fix and reran the acceptance check), `rejected — <reason>` (MAIN
overrules the reviewer), `unknown` (not yet adjudicated; carries forward).

Every `fixed` row with a code fix is red under a mutant that removes it:
`.scratch/verify-fixes.py` restores each pre-fix behaviour and reruns the closing test,
**26/26 RED**. Contract-ruling closures carry no mutant: R28, R37, R41, R44, R45, and U04/U08
which close on U03's and U11/U12's mutants. Session 5 adds two more: E11 is a
compile-time guard proven by variant injection, and E27 is test-only.

## Coverage

| unit | tier | check set | rows | adjudicated | session |
| --- | --- | --- | --- | --- | --- |
| u1 | kernel | `.agent/contracts/m1u1-rev-checkset.md` | 30 | **30 complete** | 3 |
| u2 | kernel | `.agent/contracts/m1u2-rev-checkset.md` | 28 | **28 complete** | 4 |
| u3 | kernel | `.agent/contracts/m1u3-rev-checkset.md` | 45 | **45 complete** | 1, 2, 3 |
| u4 | kernel | `.agent/contracts/m1u4-rev-checkset.md` | 24 | **24 complete** | 1, 2 |
| u5 | kernel | `.agent/contracts/m1u5-rev-checkset.md` | 28 | 0 seeded | 5 |
| u6 | kernel | `.agent/contracts/m1u6-rev-checkset.md` | 28 | **28 complete** | 4 |
| u7 | docs | not enumerated (spot-check grade) | ? | 0 | pending |
| cross-cutting | — | not enumerated | ? | 0 | pending |
| audit-m1 | — | `.agent/review-m1/audit-m1.ids`, self-enumerated | 137 | 137 | 1 |

Session 5 resume point = enumerate and adjudicate **u5, u7 and cross-cutting**, and close the
13 open fixes below; u1, u2, u3, u4 and u6 are complete. Seed each check set before dispatch,
one unit per reviewer. Evidence branches: `wt/rev-m1u1-1` `939de23` (u1 probes),
`wt/rev-m1u3-4` `48008d3` (`tools/probe-u3.mjs`, the browser harness the five D-claim rows ran
on), `wt/rev-m1u2-1` `085eb57` (eleven u2 probes) and `wt/rev-m1u6-1` `ca41697` (three u6
probes). Session 2's claim that `wt/rev-m1u3-3` held a browser harness does not reproduce —
that branch carries Node vitest suites only, and it is also based on a pre-`61fdd78` commit, so
it reverts session-2 fixes and must never be merged.

Session 4 adjudicated **56 rows** (u2 28, u6 28) and closed **12 defects** — the 10 it
inherited (U03, U04, U08, U11, U12 from u1; R36, R37, R41, R44, R45 from u3) plus u6's own
L25 and L28 — under a clean-`kb/generated` `pnpm gate` rc 0 (198 tests / 13 files, 3 assets,
0 errors 0 warnings) and `.scratch/verify-fixes.py` **26/26 RED**. Fix sizing was wrong in the
useful direction: the estimate was six, the actual was twelve, because six closed as contract
rulings costing a paragraph each rather than a test.

Open into session 5 — **13 accepted defects**, none `high`:
- u3, carried since session 3: **R34, R35, R40**. R40 is narrowed to one unmet part, browser
  cancel delivery between solutions. R34 and R35 are u3's recreation half — P4.4/P4.5/P4.7
  need committed tests and P6.2-P6.5 need to become deterministic gate steps, a window each.
- u2, new: **E03, E05, E10, E11, E16, E18, E19, E22, E26, E27, E28**. E11 and E19 are single
  mechanical barriers that E28 rides on; E03, E05, E16 and E18 are each a small localized
  change; E22, E26 and E27 buy committed coverage that does not exist today.

What worked in session 3, and should be repeated: MAIN seeded both skeletons and both
`.ids` files BEFORE dispatch and graded them nonzero, capped each reviewer at one unit,
and gave the expensive unit an explicit cheap-first ordering. Both reviewers finished
100% of their rows (30/30 and 14/14) inside one window — the first wave in this project
to do so. One flush directive went to `rev-m1u3-4` at 67% with 5 of 14 filled; it landed
and the remaining nine rows followed, browser probes included.

## Rows — u3, u4

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u3 | rev-m1u3-3 | R01 | fixed(low) | `tests/engine-budgets.test.ts` "P1.1 arms one deadline for a consult and discards the engine when it expires" | `EngineClient.consult` arms one `CONSULT_DEADLINE_MS` watchdog; expiry terminates the worker and returns a typed `consult` error — green, red under mutant `R01` |
| u3 | rev-m1u3-2 | R02 | pass | `.agent/review-m1/rev-m1u3-2.md` R02 | — |
| u3 | rev-m1u3-2 | R03 | fixed(low) | `tests/engine-budgets.test.ts` "P2.5 reads an exact-fit cap as honest exhaustion" | a cap equal to the solution count returns `solutions`, not `answer-cap` — green, and red under mutant `R03` |
| u3 | rev-m1u3-2 | R04 | pass | `.agent/review-m1/rev-m1u3-2.md` R04 | — |
| u3 | rev-m1u3-2 | R05 | pass | `.agent/review-m1/rev-m1u3-2.md` R05 | — |
| u3 | rev-m1u3-2 | R06 | pass | `.agent/review-m1/rev-m1u3-2.md` R06 | — |
| u3 | rev-m1u3-3 | R07 | pass | `.agent/review-m1/rev-m1u3-3.md` R07 | — |
| u3 | rev-m1u3-3 | R08 | fixed(med) | `tests/engine-budgets.test.ts` "P4.1 defers a cancel that outran its own query" + "P4.1 leaves a query untouched by a cancel aimed at another id" | a cancel for an id that is not active yet is held in a bounded `#deferred` set and consumed by the matching `solve`, which settles `cancelled` with no solutions; an unrelated id is unaffected — green, red under mutant `R08` |
| u3 | rev-m1u3-2 | R09 | fixed(med) | `tests/engine-budgets.test.ts` "P2.7 terminates and recreates the worker after a heap limit" | `limit:'heap'` terminates and recreates the worker before the outcome lands; the replacement re-verifies `manifest.contract` and serves the next query — green, red under mutant `R09` |
| u3 | rev-m1u3-2 | R10 | pass | `.agent/review-m1/rev-m1u3-2.md` R10 | — |
| u3 | rev-m1u3-2 | R11 | fixed(low) | injected `kind:'probe'` variant → `pnpm check` rc 1, `protocol.ts:111` + `client.ts:231` both `not assignable to type 'never'` | a new `EngineResponse` variant fails `pnpm check` at `isTerminal` AND `EngineClient.query` |
| u3 | rev-m1u3-2 | R12 | pass | `.agent/review-m1/rev-m1u3-2.md` R12 | — |
| u3 | rev-m1u3-2 | R13 | pass | `.agent/review-m1/rev-m1u3-2.md` R13 | — |
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
| u3 | rev-m1u3-3 | R28 | fixed(low) | `.agent/contracts/m1u3.md` P2.7 | the contract records heap as unit-tested by design and names both committed legs — `readOutcome` classification (P2.8) and fake-worker recreation (P2.7) — against a live trip costing 19.26 s and ~2222464 KiB peak RSS. Documentation ruling: no mutant applies |
| u3 | rev-m1u3-3 | R29 | fixed(low) | `tests/engine-cancel.test.ts` C8 `messageerror`, C9 `postMessage` throw, C10 retired-generation watchdog | all three run on the injected clock seam and assert timer cleanup — green, each red under its own mutant (`R29` × 3) |
| u3 | rev-m1u3-3 | R30 | pass | `.agent/review-m1/rev-m1u3-3.md` R30 | — |
| u3 | rev-m1u3-2 | R31 | pass | `.agent/review-m1/rev-m1u3-2.md` R31 | — |
| u3 | rev-m1u3-2 | R32 | pass | `.agent/review-m1/rev-m1u3-2.md` R32 | — |
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
| u4 | rev-m1u4-3 | c19 | fixed(med) | `tests/kb-reach.test.ts`, 4 cases | the scan is now negative-controlled over static import, dynamic import and `fs` read; green at base, red under mutant `c19` (`PRODUCTION_ROOTS=['public']`) |
| u4 | rev-m1u4-3 | c20 | pass (after `61fdd78`) | `.agent/review-m1/rev-m1u4-3.md` c20 + `.scratch/verify-fixes.py` | the byte-sort mutant leg is the c12 defect and now turns `pnpm test` red under MAIN's own rerun; provenance audit and both spike replays were already clean |
| u4 | rev-m1u4-3 | c21 | pass | `.agent/review-m1/rev-m1u4-3.md` c21 | — |
| u4 | rev-m1u4-3 | c22 | pass | `.agent/review-m1/rev-m1u4-3.md` c22 | — |
| u4 | rev-m1u4-3 | c23 | pass | `.agent/review-m1/rev-m1u4-3.md` c23 | — |
| u4 | rev-m1u4-3 | c24 | fixed(low) — closed with c19 | `tests/kb-reach.test.ts` | closed on c19's acceptance check; the authoring ledger over all 14 touched files was already clean and the c12 half was fixed at `61fdd78` |

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

## Rows — u1

Check set `.agent/contracts/m1u1-rev-checkset.md`, 30 rows, all adjudicated in session 3.
Reviewer evidence = `.agent/review-m1/rev-m1u1-1.md`, probe logs on `wt/rev-m1u1-1` `939de23`.

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u1 | rev-m1u1-1 | U01 | pass | report U01 | — |
| u1 | rev-m1u1-1 | U02 | pass | report U02 | — |
| u1 | rev-m1u1-1 | U03 | fixed(low) | `tests/kb-bag.test.ts` "refuses a NUL inside a GNU long name" | the `L` branch strips one trailing NUL terminator and lets `safeName` refuse the rest, so an interior NUL is `control-char`, never truncated into an accepted name — green, red under mutant `U03` |
| u1 | rev-m1u1-1 | U04 | fixed(low) — closed with U03 | `tests/kb-bag.test.ts` refuse-not-repair loop, now including `a/../a/../a.pl` | no rejected name is rewritten into an accepted one; the NUL repair path is gone and the verbatim-detail loop covers a repeated-traversal name |
| u1 | rev-m1u1-1 | U05 | pass | report U05 | — |
| u1 | rev-m1u1-1 | U06 | pass | report U06 | — |
| u1 | rev-m1u1-1 | U07 | pass | report U07 | — |
| u1 | rev-m1u1-1 | U08 | fixed(low) | `tests/kb-bag.test.ts`, 36 cases (was 32) | the four named Q-corpus gaps have cases — edited-manifest-digest, truncated-gzip, NUL-in-long-name and literal `a/../a/../a` — taking the census to 20/20; two of them are red under mutants `U03` and `U08` |
| u1 | rev-m1u1-1 | U09 | pass | report U09 | — |
| u1 | rev-m1u1-1 | U10 | pass | report U10 | — |
| u1 | rev-m1u1-1 | U11 | fixed(med) | `tests/kb-produce.test.ts` "refuses a corpus that loads fewer documents than it fed" | `requireEveryDocument` compares the engine-read count against this run's own `% file:` marker count BEFORE `qsave_program`; a 2-marker source reporting 1 document aborts — green, red under mutant `U11` |
| u1 | rev-m1u1-1 | U12 | fixed(low) | `tests/kb-produce.test.ts` "tolerates the two qsave shlib warnings and nothing else" | `SAVE_NOISE` requires a `Warning:` prefix and `saveDiagnostics` splits chunks per line, so `ERROR: …qsave.pl:99: cannot write state` is fatal — green, red under mutant `U12` |
| u1 | rev-m1u1-1 | U13 | pass | report U13 | — |
| u1 | rev-m1u1-1 | U14 | pass | report U14; `probe/u14-interrupt.log` rc 137 | — |
| u1 | rev-m1u1-1 | U15 | pass | report U15 | — |
| u1 | rev-m1u1-1 | U16 | pass | report U16 | — (caveat: the exclusion surface P3.1 describes does not exist because two forced builds are byte-identical, so nothing needs excluding — a contract-wording observation, not a defect) |
| u1 | rev-m1u1-1 | U17 | pass | report U17 | — |
| u1 | rev-m1u1-1 | U18 | pass | report U18 | — |
| u1 | rev-m1u1-1 | U19 | pass | report U19 | — |
| u1 | rev-m1u1-1 | U20 | pass | report U20 | — |
| u1 | rev-m1u1-1 | U21 | pass | report U21 | — (caveat: `MANIFEST_VERSION` and `bagitVersion: "1.0"` are the only writer literals, and the latter is reachable only after `verifyBag` refused every other version) |
| u1 | rev-m1u1-1 | U22 | pass | report U22 | — |
| u1 | rev-m1u1-1 | U23 | pass | report U23 | — (caveat: G3 names a runtime switch that has no referent — the QLF path is the exported `verifyQlf` plus an always-on test. Contract wording, not a defect) |
| u1 | rev-m1u1-1 | U24 | pass | report U24 | — |
| u1 | rev-m1u1-1 | U25 | pass | report U25 | — |
| u1 | rev-m1u1-1 | U26 | pass | report U26; `/tmp/g1-rev-m1u1-1/gate.log` rc 0 | — |
| u1 | rev-m1u1-1 | U27 | pass | report U27 | — |
| u1 | rev-m1u1-1 | U28 | pass | report U28 | — |
| u1 | rev-m1u1-1 | U29 | rejected — superseded by project rule | report U29; `CLAUDE.md` Claude Code read-exclusion bullet | `kb/generated` is gitignored, and the synced-pair rule sends regenerable gitignored caches to `permissions.deny` alone because `git_ignore=true` already hides them from Serena. P5.5's both-halves wording predates that rule; the contract is what is stale |
| u1 | rev-m1u1-1 | U30 | pass | report U30 | — |

## Rows — u3, final 14

Check set `.agent/contracts/m1u3-rev-checkset.md` rows R14, R33-R45 — **u3 complete at 45/45**.
Reviewer evidence = `.agent/review-m1/rev-m1u3-4.md`, probes + browser harness
`tools/probe-u3.mjs` on `wt/rev-m1u3-4` `48008d3`.

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u3 | rev-m1u3-4 | R14 | pass | report R14; `tests/rev-m1u3-4-r14.test.ts` 2/2 | — |
| u3 | rev-m1u3-4 | R33 | pass | report R33; main chunk 0 engine hits vs 5 in the worker chunk | — |
| u3 | rev-m1u3-4 | R34 | fixed(med) | `tests/engine-client-live.test.ts` "R34 drops an asserted overlay and re-reads the corpus from the replacement engine" | a consulted overlay is proven present, `reset()` terminates its worker and boots a second real engine that re-verifies 337 documents, and the overlay goal then FAILS — green, red under mutant `R34` |
| u3 | rev-m1u3-4 | R35 | accepted fail(med) | report R35 | P4.4, P4.5 and P4.7 each get a committed test, P6.2-P6.5 move into `pnpm gate` as deterministic checks, and the 6 unexercised Q-corpus cases are covered or struck with a reason |
| u3 | rev-m1u3-4 | R36 | fixed(low) | `src/engine/{protocol,client,session}.ts`; `pnpm check` 357 files 0 errors 0 warnings | dead `Pending.generation` removed, the double `#generation` advance carries its why, and `SolveResult`/`QueryOutcome` derive from `EngineResponse` in `protocol.ts` — one declaration site, per P2.4/P6.1 |
| u3 | rev-m1u3-4 | R37 | fixed(low) | `.agent/contracts/m1u3.md` D1 scope note | D1 is restated as a Node-proven composition whose browser leg was measured later at R39/R41; the gate stays browser-free on the `pnpm smoke` precedent. Documentation ruling: no mutant applies |
| u3 | rev-m1u3-4 | R38 | pass | report R38; `node tools/probe-u3.mjs R38` | — |
| u3 | rev-m1u3-4 | R39 | pass | report R39; main timer fired at 1004 ms while the worker soft check never did | — |
| u3 | rev-m1u3-4 | R40 | accepted fail(med) — NARROWED | report R40; `.agent/contracts/m1u3.md` D4 | two of three parts are closed at this session's fix commit — D4 now cites 50.11 ms and scopes it to 80 sampled Node steps on that corpus. REMAINING: browser cancel delivery between solutions is still unproven, in Node evidence only |
| u3 | rev-m1u3-4 | R41 | fixed(low) | `.agent/contracts/m1u3.md` D5 | D5 now records browser restart 526.4-1732.5 ms median 641.6 as the UI-facing figure and marks 181.75-223.96 ms as Node; post-termination CPU is declared unmeasured in a browser. Memory already carried both. Documentation ruling |
| u3 | rev-m1u3-4 | R42 | pass | report R42; `node tools/probe-u3.mjs R42` | — |
| u3 | rev-m1u3-4 | R43 | pass | report R43; `terms.ts` byte-unchanged, bait text classifies three ways | — |
| u3 | rev-m1u3-4 | R44 | fixed(low) | `.agent/contracts/m1u3.md` D8; `src/engine/{client,session}.ts` comments; `.agent/memory.md` | the unsourced 62.00 ms is replaced everywhere by its source's 50.11 ms across 80 sampled Node steps, scoped as a sample maximum; D8's false "no undeclared-API dependency" now names the three calls and cites R26 |
| u3 | rev-m1u3-4 | R45 | fixed(high) | `.agent/contracts/m1u3.md` D9 scope note; `.agent/polish.md` "Browser WASM abort leaves a dead session" | closed on the acceptance check's SECOND branch: D9 and memory stop claiming browser heap recreation and record the abort, the dead-session P3.4 breach and the explicit-`reset()` recovery. Reachability bounds it — M1's six bounded catalog goals with no free-text intake reach no abort. Automatic recovery is a `pri high` polish entry gated on free-text intake |
## Rows — u6

Check set `.agent/contracts/m1u6-rev-checkset.md`, 28 rows — **u6 complete at 28/28**.
Reviewer evidence = `.agent/review-m1/rev-m1u6-1.md`, probes on `wt/rev-m1u6-1` `ca41697`
(`probe/m1u6-l23-l24.dom.test.js`, `probe/m1u6-l25.dom.test.js`, `probe/m1u6-l28-public-api.js`).
The four `pass after fix` predicates the check set flagged for independent re-derivation —
R3 (L07), R4 (L08), V6 (L19), V10 (L23) — each re-derived `pass`; V10 on the reviewer's
own ten-state probe rather than on the committed suite.

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u6 | rev-m1u6-1 | L01 | pass | report L01; `src/engine/client.ts:200`, `src/questions/service.ts:43`, `tests/engine-cancel.test.ts:172` | — |
| u6 | rev-m1u6-1 | L02 | pass | report L02; `tests/engine-cancel.test.ts:199,215` | — |
| u6 | rev-m1u6-1 | L03 | pass | report L03; `tests/engine-cancel.test.ts:235,253` | — |
| u6 | rev-m1u6-1 | L04 | pass | report L04; `tests/engine-cancel.test.ts:277`, `src/engine/client.ts:98` | — |
| u6 | rev-m1u6-1 | L05 | pass | report L05; `src/demo/DemoController.svelte.ts:40` | — |
| u6 | rev-m1u6-1 | L06 | pass | report L06; `tests/demo-lifecycle.test.ts:197` | — |
| u6 | rev-m1u6-1 | L07 | pass | report L07; ordering re-read at `DemoController.svelte.ts:159,169` | — (R3 `pass after fix` re-derived independently: `running` is assigned before dispatch and no unconditional `await previous?.done` precedes it) |
| u6 | rev-m1u6-1 | L08 | pass | report L08; `DemoController.svelte.ts:157,169`; max concurrency 1 | — (R4 `pass after fix` re-derived: the chain is on `ActiveRun.query`, not on the settle promise) |
| u6 | rev-m1u6-1 | L09 | pass | report L09; `DemoController.svelte.ts:175` | — |
| u6 | rev-m1u6-1 | L10 | pass | report L10; `DemoController.svelte.ts:121` | — |
| u6 | rev-m1u6-1 | L11 | pass | report L11; `DemoController.svelte.ts:117,155` | — |
| u6 | rev-m1u6-1 | L12 | pass | report L12; `DemoController.svelte.ts:135` | — |
| u6 | rev-m1u6-1 | L13 | pass | report L13; `DemoController.svelte.ts:25` frozen, `wallClockMs` 5000 | — |
| u6 | rev-m1u6-1 | L14 | pass | report L14; real generated PVM, six ids at 7/5/2/1/3/12 | — |
| u6 | rev-m1u6-1 | L15 | pass | report L15; `RunControls.svelte:51`; one status + one alert from first render | — |
| u6 | rev-m1u6-1 | L16 | pass | report L16; ten distinct visible text labels, none colour- or icon-only | — |
| u6 | rev-m1u6-1 | L17 | pass | report L17; `describe.ts:71`, all six `LimitKind` values | — |
| u6 | rev-m1u6-1 | L18 | pass | report L18; `describe.ts:76` | — |
| u6 | rev-m1u6-1 | L19 | pass | report L19; `describe.ts:53` | — (V6 `pass after fix` re-derived: an existential question projects no columns, so 12 proofs create no radios) |
| u6 | rev-m1u6-1 | L20 | pass | report L20; `AnswerPanel.svelte:39`; one tab stop per group | — |
| u6 | rev-m1u6-1 | L21 | pass | report L21; `RunControls.svelte:43`; native `disabled`, no `aria-disabled` substitute | — |
| u6 | rev-m1u6-1 | L22 | pass | report L22; `RunControls.svelte:30` `$effect.pre` | — |
| u6 | rev-m1u6-1 | L23 | pass | report L23; `probe/m1u6-l23-l24.dom.test.js` on `wt/rev-m1u6-1` | — (V10 `pass after fix` re-derived on an independent ten-state probe: region always mounted, `aria-busy` true only for `running`/`cancelling`, false during `booting`) |
| u6 | rev-m1u6-1 | L24 | pass | report L24; same probe | — (sweep covers u7's About panel and the canonical-answer `<details>` closed, each open, and both open; only `color-contrast` incomplete) |
| u6 | rev-m1u6-1 | L25 | fixed(low) | `src/demo/describe.ts:155`; `.agent/contracts/m1u6.md` V12; `tests/demo-controller.dom.test.ts` "V12 formats a recognized guideline id" | reviewer found `answerRows` renders `humanizeGuidelineId`'s structural label for a recognized `'$guideline_id'/5` binding, which V12 as first written outlawed, and that the committed V12 fixture binds an ATOM so the recognized branch never rendered. USER RULING: keep the formatter, amend the predicate — without it the four id-projecting questions render `write_canonical` bytes in every answer cell. Severity med → low: no shipped behaviour changed; the defects were the predicate text and the fixture. V12 now admits a structural formatter over engine-authored tokens with a `display` fallback and forbids `JSON.stringify`, glossed corpus vocabulary and JS-assembled Prolog syntax; a second DOM case asserts the label carries only the term's own tokens — green, red under mutant `L25` |
| u6 | rev-m1u6-1 | L26 | pass | report L26; `pnpm gate` rc 0 at target `6ff2d9c` — 337 KB files, 3 assets, 187 tests in 11 files; `pnpm check` 356 files 0 errors 0 warnings | — |
| u6 | rev-m1u6-1 | L27 | pass | report L27; `pnpm smoke` rc 0, five asset classes 200 | — (caveat, already `.agent/polish.md` "Smoke negative control is weak": removing the PVM alone still returns 0, so the recorded control proves the build path runs, not that the served output is fresh. Only removing `dist` with it returns 1) |
| u6 | rev-m1u6-1 | L28 | fixed(low) | `src/demo/DemoController.svelte.ts`; `.agent/contracts/m1u6.md` fixed public API; `tests/demo-api.test.ts` | shipped surface exceeded the declared API by export `solutionsOf` and members `booted`, `solutions`, `solution`; nothing declared was missing. `solutionsOf` has a live consumer (`App.svelte:34`) so it joins the declared API; the other three had NO consumer in `src`, `tests`, `tools` or `probe` and are deleted, with the boot promise now `void this.#boot()`. The reviewer's AST probe is ported to `tests/demo-api.test.ts` so the claim reruns from committed state — green, red under mutant `L28` |

## Rows — u2

Check set `.agent/contracts/m1u2-rev-checkset.md`, 28 rows — **u2 complete at 28/28**.
Reviewer evidence = `.agent/review-m1/rev-m1u2-1.md`, probes on `wt/rev-m1u2-1` `085eb57`
(`probe/e03_contract_literals.py`, `e05_single_boot.py`, `e10_worker_rejection.py`,
`e11_exhaustiveness.py`, `e16_shared_roundtrip.py`, `e18_unknown_dict.py`,
`e19_json_stringify.py`, `e22_shipped_client_live.py`, `e23_overlay_mutant.py`,
`e26_browser_evidence.py`, `e27_corpus_census.py`).
**11 accepted defects carry to session 5**; none is fixed at this commit.

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u2 | rev-m1u2-1 | E01 | pass | report E01; 63609-byte main chunk holds zero engine markers against the worker positive control | — |
| u2 | rev-m1u2-1 | E02 | pass | report E02; one hashed 437132-byte PVM, inlining disabled | — |
| u2 | rev-m1u2-1 | E03 | fixed(med) | `tests/about-copy.dom.test.ts`, 3 cases; `src/demo/AboutPanel.svelte:8` | copy states no corpus number (no 3+ digit run in `INSTRUCTIONS`/`DESCRIPTIONS`) and the panel renders `{documents}` substituted from `DemoController.contract`, which `#boot` sets from `BootOutcome.contract` — green, red under mutant `E03` |
| u2 | rev-m1u2-1 | E04 | pass | report E04; three injected loader failures each settle typed `code: boot` | — |
| u2 | rev-m1u2-1 | E05 | fixed(med) | `tests/engine-session.test.ts` "E05 loads the image once when two boots race" | `boot()` caches the in-flight promise, so two concurrent boots invoke `loadImage` once and both receive the same contract; the promise clears on settle, leaving a failed boot retryable — green, red under mutant `E05` |
| u2 | rev-m1u2-1 | E06 | pass | report E06; every request/response variant, all ten `PlTerm` shapes and bigint clone deeply equal | — |
| u2 | rev-m1u2-1 | E07 | pass | report E07; unknown and duplicate ids each raise `code: protocol`, the claimed request settles once | — |
| u2 | rev-m1u2-1 | E08 | pass | report E08; every declared response kind terminal, solutions one correlated array | — |
| u2 | rev-m1u2-1 | E09 | pass | report E09; `protocol.ts` alone declares the correlated unions | — |
| u2 | rev-m1u2-1 | E10 | fixed(med) | `src/engine/worker.ts:96`, `src/engine/client.ts:113`; `tests/engine-cancel.test.ts` "E10 settles every in-flight caller when the worker reports a failure of its own" | the worker routes `unhandledrejection` AND `messageerror` to the reserved `WORKER_FAILURE_ID`, and the client settles every pending caller typed `code:worker` on it, releasing each deadline timer (`clock.armed.size === 0`) — green, red under mutant `E10`. The boot-deadline half is out of this row and sits in `.agent/polish.md` |
| u2 | rev-m1u2-1 | E11 | fixed(med) | injected `kind:'probe'` variant → `pnpm check` rc 1, `terms.ts:182` "not assignable to type 'never'" | `createEncoder` gained the `default` never arm, so a new `PlTerm` variant fails `pnpm check` instead of encoding as `undefined`. Compile-time guard: no vitest mutant applies, the injection is the control |
| u2 | rev-m1u2-1 | E12 | pass | report E12; `foo(bar,7)` and `foo([bar,7])` keep the one-element envelope distinction | — |
| u2 | rev-m1u2-1 | E13 | pass | report E13; `1 rdiv 3` → `1r3`, normalized `3 rdiv 1` → integer 3 | — |
| u2 | rev-m1u2-1 | E14 | pass | report E14; atom and string of identical text keep distinct tags; direct decode of `f(V,V)` shares one id | — |
| u2 | rev-m1u2-1 | E15 | pass | report E15; 30-digit integer exact as bigint; the `1.0 → integer 1` wrapper deviation is declared at the decode site | — |
| u2 | rev-m1u2-1 | E16 | fixed(med) | `tests/engine-session.test.ts` "E16 re-enters a shared variable as one variable, not two" | the encoder names every variable (`new Var(name)`, dense from 1) because the wrapper shares by NAME within one conversion and treats a falsy name as unnamed; `f(A,A)` is now `=@= f(A,A)` and `f(A,B)` is not — green, red under mutant `E16` |
| u2 | rev-m1u2-1 | E17 | pass | report E17; the worker-owned session decodes before constructing `PlSolution`; no native value is retained | — |
| u2 | rev-m1u2-1 | E18 | fixed(low) | `src/engine/terms.ts:96`; `tests/engine-session.test.ts` P3.11 case `{ $t: 'unheard-of', $tag: 'point' }` | the dict guard requires `$t` absent, so an unrecognized wrapper carrying `$tag` fails closed instead of decoding as a dict — green, red under mutant `E18`. The dict half of the check text stays rejected per session 4 |
| u2 | rev-m1u2-1 | E19 | fixed(med) | `tools/kb/check.mjs` SERIALIZE scan; `tests/kb-reach.test.ts` "fails kb:asset-check on a serializing call" | `kb:asset-check` bans JSON serialization over `src/` and reports it as a fourth scan class; a planted call in `src/` returns rc 1 — green, red under mutant `E19`. `tools/` keeps the call because it writes real JSON artifacts |
| u2 | rev-m1u2-1 | E20 | pass | report E20; `term_string/3` with all three options; 20/20 adversarial terms re-read as variants | — |
| u2 | rev-m1u2-1 | E21 | pass | report E21; counts read from the engine and compared to the manifest, no engine-output fixture | — |
| u2 | rev-m1u2-1 | E22 | fixed(med) | `tests/engine-client-live.test.ts` "E22 proves the seven category-A solutions through EngineClient.query" | a worker-shaped adapter over a REAL per-spawn `EngineSession` joins the shipped `EngineClient.query` to the real PVM; the seven ids are read out of the run's bindings, not a fixture — green, red under mutant `E22` |
| u2 | rev-m1u2-1 | E23 | pass | report E23; replacing runtime consult with a no-op turns the overlay test red | — |
| u2 | rev-m1u2-1 | E24 | pass | report E24; planted controls fail per forbidden class, own `../cnl-ckc-demo` prefix accepted | — |
| u2 | rev-m1u2-1 | E25 | pass | report E25; `kb/generated` absent → `pnpm test` rc 1, 9 failed files, no skipped live case | — |
| u2 | rev-m1u2-1 | E26 | accepted fail(med) | `probe/e26_browser_evidence.py` rc 1; `pnpm smoke` covers built static output only | commit one browser script that boots BOTH the Vite dev server and the built output and reads 337 from each. P6.2's two deployment modes are assertion-only today (P6.2, G3). No browser or port was launched in this wave, per the shared-resource assignment |
| u2 | rev-m1u2-1 | E27 | fixed(med) | `tests/engine-session.test.ts` "Q corpus census" (8 cases) + `tests/engine-cancel.test.ts` "protocol correlation and worker-level failure" (3 cases) | all 13 named cases are committed — negative/zero integers, float, shared-variable identity, hyphenated/empty/quoted atoms, operator term, deep nesting; unmatched id, duplicate id, boot failure before a request, request before boot completes, two-request correlation. Test-only fix: no mutant applies, and E16/E18 bind two of the shapes |
| u2 | rev-m1u2-1 | E28 | fixed(low) | `pnpm gate` rc 0 — 361 files 0 errors 0 warnings, 218 tests in 15 files, 3 assets, build 644 ms; mutants `E11` (injection) and `E19` both red | closed on its own terms: E11 and E19 are now gate-owned rather than convention, and the build still resolves `swipl-bundle-no-data` alone |

## Rows — u5

Check set `.agent/contracts/m1u5-rev-checkset.md`, 28 rows, seeded session 5.
Reviewer evidence = `.agent/review-m1/rev-m1u5-1.md`, probes on `wt/rev-m1u5-1`.

| unit | reviewer | row | verdict | evidence | acceptance check |
| --- | --- | --- | --- | --- | --- |
| u5 | rev-m1u5-1 | I01 | unknown | — | — |
| u5 | rev-m1u5-1 | I02 | unknown | — | — |
| u5 | rev-m1u5-1 | I03 | unknown | — | — |
| u5 | rev-m1u5-1 | I04 | unknown | — | — |
| u5 | rev-m1u5-1 | I05 | unknown | — | — |
| u5 | rev-m1u5-1 | I06 | unknown | — | — |
| u5 | rev-m1u5-1 | I07 | unknown | — | — |
| u5 | rev-m1u5-1 | I08 | unknown | — | — |
| u5 | rev-m1u5-1 | I09 | unknown | — | — |
| u5 | rev-m1u5-1 | I10 | unknown | — | — |
| u5 | rev-m1u5-1 | I11 | unknown | — | — |
| u5 | rev-m1u5-1 | I12 | unknown | — | — |
| u5 | rev-m1u5-1 | I13 | unknown | — | — |
| u5 | rev-m1u5-1 | I14 | unknown | — | — |
| u5 | rev-m1u5-1 | I15 | unknown | — | — |
| u5 | rev-m1u5-1 | I16 | unknown | — | — |
| u5 | rev-m1u5-1 | I17 | unknown | — | — |
| u5 | rev-m1u5-1 | I18 | unknown | — | — |
| u5 | rev-m1u5-1 | I19 | unknown | — | — |
| u5 | rev-m1u5-1 | I20 | unknown | — | — |
| u5 | rev-m1u5-1 | I21 | unknown | — | — |
| u5 | rev-m1u5-1 | I22 | unknown | — | — |
| u5 | rev-m1u5-1 | I23 | unknown | — | — |
| u5 | rev-m1u5-1 | I24 | unknown | — | — |
| u5 | rev-m1u5-1 | I25 | unknown | — | — |
| u5 | rev-m1u5-1 | I26 | unknown | — | — |
| u5 | rev-m1u5-1 | I27 | unknown | — | — |
| u5 | rev-m1u5-1 | I28 | unknown | — | — |
