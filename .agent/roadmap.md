# roadmap

Goal: a browser demo complementing `../cnl-ckc`. User asks a clinical question
→ answer produced by **real Prolog execution** over the exported cnl-ckc
knowledge base, never hard-coded. Demo also ships (a) a visualization tracing
each answer back to its guideline source and (b) an interactive, navigable
network graph of semantic relationships between KB entities. Question intake =
an input that reads as future free-text, but for now opens a drop-down of
built-in questions authored during development. KB enters by export only —
never a path link to `../cnl-ckc`.

Intent = `.agent/initial-prompt.md` (authoritative; this restatement is a
convenience). Stack, gates + measured runtime facts = `.agent/memory.md`.

Demo-tier rigor: the intent explicitly waives `cnl-ckc`-level rigor. The one
non-negotiable = answers trace to genuine Prolog solutions.

## Milestones

- **M1 — live question→answer spine** — IMPLEMENTED, units below.
- **M2 — provenance ladder** — UNPLANNED. Per selected solution, a live
  meta-interpreter proof → clause → ACE sentence → coverage region → aligned
  source passage → guideline page; lazy PDF; projection-loss and
  `unreviewed`-label disclosure. Committed `queries/traces/*.pl` = oracles only.
- **M3 — semantic entity graph** — UNPLANNED. Static `clause/2` extraction over
  the seven explicit edge schemas plus Horn-clause implication edges; fCoSE
  layout; neighborhood-first navigation; accessible non-canvas subgraph view.
  Event and operator-context nodes stay; noun→noun collapse is forbidden.
- **M4 — integration + release** — UNPLANNED. Cross-pillar linking
  (answer↔trace↔graph), dark theme + full visual system, CSP/static-host
  decision + release proof, performance/responsive/a11y hardening.

## M1 — IMPLEMENTED

Spine: pick one of six built-in questions in an honest combobox → a worker-owned
saved PVM runs its compiled goal → live bindings render. No source ladder, no
graph, no free text until M2/M3.

Sequence is strictly serial — each unit consumes its predecessor's shipped
contract. Parallelism lives inside a unit's teammate wave, not across units.

- **u1 — export→PVM producer** · kernel · est 130K · DONE
  `tools/kb/{bag,paths,produce,build,check,reproduce}.mjs` + `src/kb/manifest.ts`
  + `tests/kb-{bag,live}.test.ts`. Gate = `kb:build && kb:asset-check && …`;
  `kb:reproduce` backs the idempotence claim out of band. Artifacts are
  byte-reproducible, not merely contract-equivalent: pinning the engine's
  `Date.now` removes the only nondeterminism.
  `main=94% 226K/240K`, `mate=37% 88K/240K` (map-m1u1). Wave 1 only; judgment review
  is M1's. Two teammates stopped partway: reports at `.scratch/agents/map-m1u1.md`
  (17/25 rows) and `.scratch/agents/spike-m1u1-det.md` (9/12 rows).
- **u2 — Prolog engine worker** · kernel · est 120K · DONE
  `src/engine/{protocol,terms,session,client,worker}.ts` + `tests/engine-session.test.ts`;
  Vite alias `@kb`, `base:'./'`, `worker.format:'es'`, root `cacheDir`. Term boundary
  ruled **JS-side decode inside the worker** (`.agent/contracts/m1u2.md` D1.1): both
  spikes cleared 11/11 traps, but the Prolog-serialization alternative needs a
  hand-written JS grammar that silently turned `1.0Inf` into an atom. Delivery = one
  correlated batch; display = `term_string/3` matching `write_canonical`.
  Gate rc=0, 58 tests, 330 files 0 errors. Built main chunk carries 0 engine bytes;
  worker + hashed PVM emit separately.
  `main=93% 224K/240K`, `mate=69% 167K/240K` (map-m1u2). NOT verified: the dev-server
  and built-output browser smokes (P6.2) and the `test-m1u2` red suite — both in
  `.agent/polish.md`. Judgment review is M1's.
- **u3 — budgets, failure modes, cancellation** · kernel · est 110K · DONE
  Stack/depth/inference/wall-clock budgets, typed error states, consult-stderr
  fatality, cooperative abort plus terminate-and-recreate.
  Accept: each limit surfaces its own typed state; hard cancel drops asserted
  state and returns a 337-document engine; malformed goals and consult `ERROR`
  fail closed; no unbounded query reaches the UI.
- **u4 — question catalog + live answer service** · kernel · `oracle` · est 135K · DONE
  `tools/kb/catalog.mjs` + `src/questions/{catalog,serialize,humanize,service}.ts`
  + `tests/questions-live.test.ts`. All six goals are bag-derived: the four exported
  ones verbatim from `goal/1` in canonical prefix form, the two authored ones under
  one token-exact single-hit atom substitution. Live counts 7/2/1/12/5/3; category-A
  and the other three all reproduce their committed `result/1` bytes. Sort = SWI
  standard order over decoded terms, not a byte sort. Forbidden-reach check is a byte
  scan in `kb:asset-check`, negative control rc=1.
  Gate rc=0 from clean cache: 339 files 0 errors, 107 tests, 3 assets; `kb:reproduce`
  now covers the catalog (`a38e74d9f518`).
  `main=95% 228K/240K`, `mate=62% 148K/240K` (spike-m1u4-gen). The `oracle` flag was
  discharged by the two wave-1 spikes as independent reference implementations
  (`.agent/contracts/m1u4.md` D9), not by a separate `orc`. NOT verified:
  `test-m1u4`'s red suite, in `.agent/polish.md`. Judgment review is M1's.
- **u5 — accessible question intake** · kernel · est 70K → 124K · DONE
  `src/questions/QuestionCombobox.svelte` + `tests/question-combobox.dom.test.ts`;
  vitest `dom` project (jsdom 29.1.1 + `resolve.conditions:['browser']`),
  `svelte-check --fail-on-warnings` in `pnpm check`, intake rendered in `App.svelte`
  against local `$state` — superseded at u6, where `App.svelte` takes a
  `controller?: DemoController` prop and selection moved into the controller.
  Select-only APG combobox hosted on a `<div role="combobox">`
  rather than a readonly input (`.agent/contracts/m1u5.md` D1); `bits-ui` rejected on
  surface, not correctness (D2) — its own 21-case probe is green on `wt/spike-m1u5-lib`
  `dca4f87`, and it drags 7 runtime packages, a portalled popup and +10.06 s of gate.
  Gate rc=0: 342 files 0 errors 0 warnings, 133 tests, 3 assets. 26 contract
  predicates all `pass` at close; the M1 review then found K2 and K5 breached in the
  widget (I07, I09), both fixed with the suite cases that bind them.
  `harvest=56% 135K/240K`, `main=87% 209K/240K`, `mate=47% 114K/240K` (spike-m1u5-lib).
  NOT verified: no separate `test-m1u5` red suite (D6) and no real-browser run —
  every predicate is jsdom-observed. Judgment review is M1's.
- **u6 — run lifecycle + answer states** · kernel · est 75K → 133K · DONE
  `src/demo/{DemoController.svelte.ts,describe.ts,RunControls.svelte,AnswerPanel.svelte}`
  + rewritten `src/App.svelte` + `tools/smoke.mjs` (`pnpm smoke`) + three suites
  (`engine-cancel`, `demo-lifecycle`, `demo-controller.dom`). Cancellation ruled a
  **trailing optional `AbortSignal`** over a run handle (`.agent/contracts/m1u6.md` D1):
  both spikes worked, but alt B changed 0 existing tests and left `QueryOutcome`,
  `AnswerResult` and the private correlation id untouched. Latency did not
  discriminate — 1.869 vs 0.355 ms, both under the 62 ms cooperative granularity.
  `DEMO_BUDGET` frozen with `wallClockMs` at 5000, not the probe's 2000: a tight
  deadline is the only budget error that yields a dishonest `limit` where a proof
  exists. The cancel ack is unreliable by design, so the query result alone owns the
  rendered terminal state (map S3/S4).
  Gate rc=0: 350 files 0 errors 0 warnings, 171 tests, 10 files; `pnpm smoke` rc=0 —
  a real browser answers `dosage-reduction-content` and the rendered canonical text
  equals the bag's committed bytes, derived at run time through `verifyBag`.
  32 contract predicates, all `pass`; four needed an implementation fix the diff-blind
  suite found (synchronous dispatch, engine-call chaining, existential answer copy and
  rows, always-mounted `aria-busy` region).
  `harvest=31% 75K/240K`, `main=56% 133K/240K`, `mate=68% 164K/240K` (test-m1u6).
  No `diff-m1u6`: no `oracle` flag, so nothing to differentiate against. NOT verified:
  boot-error recovery is out of scope by ruling Q7 and sits in `.agent/polish.md`.
  Judgment review is M1's.
- **u7 — demo presentation + honest framing** · docs · est 60K → actual 229K · DONE
  `src/app.css` (font faces + role tokens) + `src/demo/{copy,descriptor}.ts` +
  `src/demo/AboutPanel.svelte` + rewritten `App.svelte`/`AnswerPanel.svelte` +
  `tools/{copy-check,contrast}.mjs` + `public/licenses/*` .
  Fonts self-host from `@fontsource-variable` at 5.3.0 through hand-authored
  `@font-face` over latin + latin-ext alone: the packages' CSS entrypoints are
  axis-scoped, not subset-scoped, so importing one ships Cyrillic, Greek and
  Vietnamese to an English corpus. `dist/` carries 6 woff2 = 176732 B and three
  OFL texts byte-equal to each package's `LICENSE`.
  Two new gate steps, both fail-closed with a proven negative control:
  `copy:check` (79 strings, 20 words/sentence `INSTRUCTIONS`, 25
  `DESCRIPTIONS`) and `contrast:check` (17 declared pairs, WCAG luminance,
  floored not rounded). `--border` needed `#8f8270` to clear 3:1.
  Limitations sit in an About disclosure and the canonical Prolog answer in its
  own (user rulings); CDC attribution, the nonendorsement disclaimer and the
  free-availability statement stay in the always-visible footer, because CDC's
  terms require that disclaimer to be prominently displayed.
  Gate rc=0 from clean cache: 355 files 0 errors 0 warnings, 171 tests, 3 assets.
  `pnpm smoke` rc=0 after being taught to open the new disclosure — it caught the
  regression that the canonical answer is no longer visible by default.
  Real-browser visual QA over 11 states at 320/375/1280 px: `overflow=false`
  everywhere, and the three families resolve in the rendered `fontFamily`.
  `harvest=63% 152K/240K`, `main=96% 229K/240K`, `mate=72% 172K/240K` (res-m1u7).
  Wave 1 failed as a wave: both teammates saturated without flushing (map 10/26 at
  182K, res 4/16 at 183K, both 76%) across two flush directives each, so MAIN self-derived
  the WCAG thresholds, the CDC terms and the `unreviewed` semantics. Harvest was
  map's 545-line browser probe, which MAIN ran directly.
  NOT verified: the probe is committed only on `wt/map-m1u7` `124e34d`, not in the
  gate — it fails `svelte-check` with 64 type errors and porting it typed is in
  `.agent/polish.md`. No `test-m1u7` red suite and no axe pass over the two new
  disclosures. Judgment review is M1's.

MILESTONE-REVIEW dispatch inputs — contract | fixed check set | evidence branches:

- u1 `.agent/contracts/m1u1.md` | — | `wt/spike-m1u1-det`; partial reports `map-m1u1` 17/25, `spike-m1u1-det` 9/12
- u2 `.agent/contracts/m1u2.md` | `.agent/contracts/m1u2-rev-checkset.md`, 28 rows | `wt/test-m1u2` `b0fb200`, `wt/spike-m1u2-{js,pl}`
- u3 `.agent/contracts/m1u3.md` | `.agent/contracts/m1u3-rev-checkset.md`, 45 rows | `wt/test-m1u3` `22c8b97`, `wt/spike-m1u3-{js,pl}`
- u4 `.agent/contracts/m1u4.md` | `.agent/contracts/m1u4-rev-checkset.md`, 24 rows | `wt/test-m1u4` `0240aae`, `wt/spike-m1u4-{gen,src}`
- u5 `.agent/contracts/m1u5.md` (26 predicates + verdict table) | `.agent/contracts/m1u5-rev-checkset.md`, 28 rows | `wt/spike-m1u5-lib` `dca4f87`, `wt/rev-m1u5-1` (three acceptance harnesses)
- u7 `.agent/contracts/m1u7.md` (34 predicates + verdict table + D1–D9) | — | `wt/map-m1u7` `124e34d` (probe), `wt/res-m1u7` `d712fa9`
- u6 `.agent/contracts/m1u6.md` (32 predicates + verdict table + D1–D10 + Q1–Q8 rulings) | — | `wt/test-m1u6` `2f87e0b` 23/23, `wt/spike-m1u6-{handle,signal}` `b896d2e`/`3066404`

Projection was 6 `kernel` units × ~35 rows ≈ 210 rows plus u7, cross-cutting and
`audit-m1`, sized at 3–4 sessions. Actual after 5 sessions: **320 rows adjudicated**
(u1 30, u2 28, u3 45, u4 24, u5 28, u6 28, `audit-m1` 137), with u7 and cross-cutting still
unenumerated ⇒ **6 sessions**, because the projection counted rows but not the fix backlog
each session inherits. Yield with seeded skeletons: 44 rows + 5 fixes (session 3, two
reviewers), 56 rows + 12 fixes (session 4, two), 28 rows + 16 fixes (session 5, one). Session
6 inherits 3 fixes and 2 unenumerated surfaces — the lightest fix load of the run ⇒ size it at
two reviewers, u7 (`docs`, spot-check grade) and cross-cutting.

Judgment-review ledger = `.agent/review-m1.md` (committed, read first by every resumed
MILESTONE-REVIEW session); reviewer reports = `.agent/review-m1/`.

Session 5 adjudicated **28 rows** — u5 28/28 — so **u1 through u6 are complete**; only u7 and
cross-cutting remain unenumerated. It closed **16 defects**: eleven inherited at `b3ca42c`
(u2's E03, E05, E10, E11, E16, E18, E19, E22, E27, E28 and u3's R34) plus u5's own I03, I07,
I09, I23 and I28 at this commit, leaving 3 open — R35, R40, E26. `.scratch/verify-fixes.py`
grew to 31 mutants, 31/31 RED, and `pnpm gate` is rc 0 from a clean `kb/generated` — 361 files
0 errors 0 warnings, 221 tests in 15 files, 3 assets. u5's two `med` fails are the session's
finding: the widget opened closed-`ArrowUp` at the current selection and started a fresh
typeahead prefix after the active option, breaching K2 and K5, and u5's own suite asserted both
predicates from a starting state where the correct and the broken widget agree — the same shape
as u2's E16, whose round-trip case compared two equally-broken decodes with `=@=`. A green
suite is evidence about the cases it names, never about the predicate they were written for.
Cost: `main=77% 186K/240K`, `mate=37% 88K/240K` (rev-m1u5-1), which finished 28/28 in one window.

Session 4 adjudicated **56 rows** — u2 28/28 and u6 28/28. It closed **12 defects** at
`541b736` (the 10 inherited) and at `70c49b5` (u6's L25 and L28), leaving 14 open: u3's
R34/R35/R40 and u2's eleven. `.scratch/verify-fixes.py` grew to 18 mutants, 18/18 RED, and
`pnpm gate` is rc 0 from a clean `kb/generated` — 198 tests in 13 files, 3 assets, 0 errors
0 warnings. u6 came back nearly clean (26 pass, 2 fail, both low after ruling); u2 came back
with 11 fails in 28, which is where M1's remaining risk sits. Two rulings changed a scope
source rather than code: **L25** — V12 forbade JS-templating any binding, which outlawed the
`humanizeGuidelineId` formatter u4 shipped and live-tested, so on the user's ruling the
predicate now admits a structural formatter over engine-authored tokens and the untested
recognized branch gained a DOM case; **E18** — P3.11's "tag" is the `$t` wrapper discriminator,
not a dict's own `$tag`, so the reviewer's dict half is rejected and only a narrow real hole
survives. Cost: `main=80% 192K/240K`, `mate=69% 165K/240K` (rev-m1u2-1). Both reviewers again
finished 100% of their rows in one window under the seeded-skeleton recipe, but `rev-m1u2-1`
burned 104K with nothing on disk before its first flush — the same session-1/2 shape — and
recovered only after one flush directive. Seeding is necessary and not sufficient: the brief
must also make the FIRST batch land early, not merely define one.

Session 3 adjudicated **44 rows** — u1 30/30 and u3's last 14, so **u1, u3 and u4 are
complete** at 30/30, 45/45 and 24/24. It also closed all five defects carried in
(R01, R08, R28, R29, c19+c24) at `7005a40`; `.scratch/verify-fixes.py` grew to 12 mutants
and reports 12/12 RED, and `pnpm gate` is rc 0 from a clean cache — 356 files 0 errors
0 warnings, 187 tests, 3 assets. 13 new accepted defects carry into session 4, one of
them `high`: R45 proves that in a real browser a runaway `assertz` aborts the WASM runtime
as `code:'prolog'` after 12088 ms instead of yielding `limit:'heap'`, so D9's recreation
path never runs there. MAIN re-scoped R44 (its undeclared-API half was already ruled at
R26) and rejected U29 (the read-exclusion synced-pair rule exempts gitignored caches, so
the u1 contract is what is stale). Cost: `main=86% 207K/240K`, `mate=75% 180K/240K`
(rev-m1u3-4, tied by rev-m1u1-1 at 71%). Both reviewers finished 100% of their rows in one window — the first wave
here to do so. What produced that: MAIN seeded both report skeletons and both `.ids`
files before dispatch and graded them nonzero, capped each reviewer at one unit, and gave
the expensive unit an explicit cheap-first ordering. Session 4 takes u2, u5, u6, u7 and
cross-cutting, and the 13 open fixes.

Session 2 adjudicated **12 rows** (u3 R01/R07/R08/R28/R29/R30, u4 c19-c24 — **u4 is
complete at 24/24**) and closed all six session-1 defects with fixes at `61fdd78`, each
red under a mutant that removes it (`.scratch/verify-fixes.py`, 6/6). It also seeded u1's
30-row check set at `.agent/contracts/m1u1-rev-checkset.md`. Five new accepted defects
carry into session 3: R01, R08, R28, R29, c19 (c24 rides on c19). Cost:
`main=90% 216K/240K` at the close commit, `mate=87% 208K/240K` (rev-m1u3-3). `rev-m1u3-3` saturated at 6 of
20 rows; `rev-m1u4-3` finished its 6 and flushed the u1 census, and the difference was
census-first ordering. Size session 3 at two teammates, one unit each, every check set
seeded before dispatch.

Session 1 adjudicated **180 rows**: u3 25/45, u4 18/24, `audit-m1` 137/137. Six accepted
defects are QUEUED FOR SESSION 2 with acceptance checks in the ledger — R03 (a cap equal
to the solution count reports `answer-cap`), R09 (a heap limit does not recreate the
engine, against D9), R11 (`EngineClient.query` switches on a catch-all `default`, not
`never`), R23 (the `library(shlib)` tolerance applies at every phase, not image load
alone), c06 (an extra query file silently yields a 7-entry catalog at rc 0), c12 (a
byte-sort mutant of the serializer leaves `pnpm test` at 171/171, so the sort is unbound
to `compareTerms`). R26 was ruled a contract defect, not a code defect: three undeclared
`swipl-wasm` calls are load-bearing, so the package is now exact-pinned and memory
records them. `audit-m1` found 16 stale claims; 13 are corrected in this commit and 3
are rejected (A051 stale target, A084 instrument mismatch, A114 hedged by contract).

Session 2 takes the 26 open u3/u4 rows, then enumerates u1, u2, u5, u6, u7 and
cross-cutting. Successors inherit `wt/rev-m1u3-2` and `wt/rev-m1u4-2`, which hold every
probe and red test the reports cite.

Review-wave cost, session 1: `main=72% 173K/240K`, `mate=100% 240K/240K`
(audit-m1, tied by rev-m1u3-2). All three teammates saturated — two needed two flush directives each and
still closed short, repeating u7's wave-1 failure. What worked was `audit-m1`'s shape:
a self-enumerated census flushed BEFORE any replay, then rows filled in place. Size
session 2 at two teammates, not three, and seed every check set before dispatch.

Calibration: `main=`/`est` ran 1.74 (u1), 1.87 (u2), 1.69 (u4) ⇒ **M1 ratio 1.77**, applied
to every `kernel` estimate above. u6 is the first exact hit — raw 75K × 1.77 = 133K,
actual 133K — and the first unit whose `harvest=` (75K) came in under the 130K floor,
because wave 1 shipped a two-tier verdict table per teammate instead of prose. u5's original 145K calibrated to 257K, over the window,
which is what split it into intake and run-lifecycle. Harvest, not implementation, is the
cost driver: u3's wave 1 (one map + two spikes, 40 rows) cost MAIN 130K before a line was
written. u1 burned 226K on a 130K estimate because discovery and implementation both
landed in MAIN's window. u5's first measured `harvest=` says the model is ADDITIVE, not
multiplicative: wave 1 cost 135K on a unit whose implementation ran ~75K, against u3's
130K on a much larger one. Size a unit as `~130K harvest floor + implementation`, and
apply 1.77 to the implementation term alone — u5's calibrated 124K still missed by 1.69
because the floor does not shrink with the unit.

Planning actuals: `main=76% 183K/240K`, `mate=80% 191K/240K` (map-m1), five
teammates across three waves. Size future planning waves against this.
