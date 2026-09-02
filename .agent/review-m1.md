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
**12/12 RED**. R28 is the one `fixed` row with no mutant — it closes as a contract ruling.

## Coverage

| unit | tier | check set | rows | adjudicated | session |
| --- | --- | --- | --- | --- | --- |
| u1 | kernel | `.agent/contracts/m1u1-rev-checkset.md` | 30 | **30 complete** | 3 |
| u2 | kernel | not enumerated | ? | 0 | pending |
| u3 | kernel | `.agent/contracts/m1u3-rev-checkset.md` | 45 | **45 complete** | 1, 2, 3 |
| u4 | kernel | `.agent/contracts/m1u4-rev-checkset.md` | 24 | **24 complete** | 1, 2 |
| u5 | kernel | not enumerated | ? | 0 | pending |
| u6 | kernel | not enumerated | ? | 0 | pending |
| u7 | docs | not enumerated (spot-check grade) | ? | 0 | pending |
| cross-cutting | — | not enumerated | ? | 0 | pending |
| audit-m1 | — | `.agent/review-m1/audit-m1.ids`, self-enumerated | 137 | 137 | 1 |

Session 4 resume point = enumerate and adjudicate u2, u5, u6, u7 and cross-cutting; u1,
u3 and u4 are closed. Seed each check set before dispatch, one unit per reviewer.
Evidence branches: `wt/rev-m1u1-1` `939de23` (u1 probes) and `wt/rev-m1u3-4` `48008d3`
(`tools/probe-u3.mjs`, the browser harness the five D-claim rows ran on). Session 2's
claim that `wt/rev-m1u3-3` held a browser harness does not reproduce — that branch
carries Node vitest suites only, and it is also based on a pre-`61fdd78` commit, so it
reverts session-2 fixes and must never be merged.

Open accepted defects carried into session 4, each with its acceptance check below:
U03, U04, U08, U11, U12 (u1) and R34, R35, R36, R37, R40, R41, R44, R45 (u3) — 13 rows,
one of them `high`. Session 3 first closed the five it inherited (R01, R08, R28, R29,
c19+c24) under a green `pnpm gate` (rc 0, 356 files 0 errors 0 warnings, 187 tests,
3 assets). Sizing holds: a session closes roughly six, so 13 open needs two sessions of
fixes alongside the remaining enumeration.

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
| u1 | rev-m1u1-1 | U03 | accepted fail(low) | report U03; `probe/red-nul.mjs` rc 1 | a NUL inside a GNU `L` long name is refused with its own typed reason — `readBag` truncates at the first NUL before `safeName` runs, so the member is accepted today |
| u1 | rev-m1u1-1 | U04 | accepted fail(low) — same cause as U03 | report U04 | closes on U03: refusal must not repair, and truncating a NUL-bearing name into an accepted one is repair |
| u1 | rev-m1u1-1 | U05 | pass | report U05 | — |
| u1 | rev-m1u1-1 | U06 | pass | report U06 | — |
| u1 | rev-m1u1-1 | U07 | pass | report U07 | — |
| u1 | rev-m1u1-1 | U08 | accepted fail(low) | report U08; `probe/u08-gaps.log` | `tests/kb-bag.test.ts` census reaches 20/20 on the Q corpus — edited-manifest-digest, truncated-gzip, NUL-in-name and literal `a/../a/../a` have no case, and the NUL gap is what hid U03 |
| u1 | rev-m1u1-1 | U09 | pass | report U09 | — |
| u1 | rev-m1u1-1 | U10 | pass | report U10 | — |
| u1 | rev-m1u1-1 | U11 | accepted fail(med) | report U11; `probe/red-p22.mjs` rc 1 | `requireLoaded` compares the engine-read document count against the number of `pl/` files this build fed, not `>=1`; a 336-file corpus must abort before `qsave_program`. Comparing against the run's own input count satisfies P2.2 without the literal that I forbids |
| u1 | rev-m1u1-1 | U12 | accepted fail(low) | report U12 | `SAVE_NOISE` matches the two `library(shlib)` warnings by their text rather than by any `qsave.pl:<n>:` prefix; `ERROR: …qsave.pl:99: cannot write state` must abort the build |
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
| u3 | rev-m1u3-4 | R34 | accepted fail(med) | report R34 | a committed test asserts an overlay present, hard-cancels, and re-reads 337 from the replacement engine — the roadmap accept clause has no direct evidence today |
| u3 | rev-m1u3-4 | R35 | accepted fail(med) | report R35 | P4.4, P4.5 and P4.7 each get a committed test, P6.2-P6.5 move into `pnpm gate` as deterministic checks, and the 6 unexercised Q-corpus cases are covered or struck with a reason |
| u3 | rev-m1u3-4 | R36 | accepted fail(low) | report R36 | the dead field is removed, the double mutation carries its why, and the outcome union has one spelling |
| u3 | rev-m1u3-4 | R37 | accepted fail(low) | report R37 | the browser hard-stop probe is committed and gated, or D1 is restated as a Node-proven composition |
| u3 | rev-m1u3-4 | R38 | pass | report R38; `node tools/probe-u3.mjs R38` | — |
| u3 | rev-m1u3-4 | R39 | pass | report R39; main timer fired at 1004 ms while the worker soft check never did | — |
| u3 | rev-m1u3-4 | R40 | accepted fail(med) | report R40 | D4 cites its own source's number (50.11 ms, not 62.00 ms), browser cancel delivery between solutions is proven, and any latency claim is scoped to the benchmarked corpus |
| u3 | rev-m1u3-4 | R41 | accepted fail(low) | report R41; 5/5 browser cycles, restart 526.4-1732.5 ms median 641.6 | D5 and memory record the browser restart distribution rather than the Node figures 181.75-261.58 ms; post-termination CPU stays declared unmeasured |
| u3 | rev-m1u3-4 | R42 | pass | report R42; `node tools/probe-u3.mjs R42` | — |
| u3 | rev-m1u3-4 | R43 | pass | report R43; `terms.ts` byte-unchanged, bait text classifies three ways | — |
| u3 | rev-m1u3-4 | R44 | accepted fail(low) — re-scoped by MAIN | report R44 | the undeclared-API half is already ruled at R26 (contract defect, closed by the exact pin plus the memory record of all three calls), so this row carries the granularity claim alone: the 62 ms bound is benchmarked beyond 80 Node steps or restated as covering that sample |
| u3 | rev-m1u3-4 | R45 | accepted fail(high) | report R45; `node tools/probe-u3.mjs R45`, `Aborted()` at 12088 ms | in a browser, a runaway `assertz` loop must reach the client as a state that triggers engine recreation. Today it aborts the WASM runtime and surfaces as `code:'prolog'` with `Aborted(). Build with -sASSERTIONS for more info.`, so D9's heap path never runs. Either classify the abort as its own terminal state that recreates, or D9 and memory stop claiming heap recreation in the browser |
