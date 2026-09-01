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

- **M1 — live question→answer spine** — IN-PROGRESS, units below.
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

## M1 — IN-PROGRESS

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
- **u5 — accessible question→answer workflow** · kernel · est 145K · OPEN (u4 contract shipped)
  `DemoController` plus leaf components: readonly APG combobox, run/cancel/retry,
  answer selection, boot/loading/empty/error/ready states.
  Accept: pointer and keyboard paths reach all six questions; arbitrary text never
  executes; stale completions cannot replace the active run; statuses are
  announced; axe and `svelte-check --fail-on-warnings` are clean; the nested-path
  static build passes a browser smoke run.
- **u6 — demo presentation + honest framing** · docs · est 60K · BLOCKED (u5)
  Self-hosted Atkinson Hyperlegible Next + Literata with licences, light role
  tokens, responsive answer composition, and limitation copy: fixed catalog,
  non-clinical prepared demo, `unreviewed` projections, CDC attribution and
  nonendorsement.
  Accept: no scaffold copy survives; a copy sentence-length validator passes
  (20 words instructions / 25 descriptions); font licences ship; token contrast
  ≥4.5:1 normal and ≥3:1 large; visual QA covers every u5 state at mobile and
  desktop widths.

MILESTONE-REVIEW dispatch inputs — contract | fixed check set | evidence branches:

- u1 `.agent/contracts/m1u1.md` | — | `wt/spike-m1u1-det`; partial reports `map-m1u1` 17/25, `spike-m1u1-det` 9/12
- u2 `.agent/contracts/m1u2.md` | — | `wt/test-m1u2` `b0fb200`, `wt/spike-m1u2-{js,pl}`
- u3 `.agent/contracts/m1u3.md` | `.agent/contracts/m1u3-rev-checkset.md`, 47 rows | `wt/test-m1u3` `22c8b97`, `wt/spike-m1u3-{js,pl}`
- u4 `.agent/contracts/m1u4.md` | `.agent/contracts/m1u4-rev-checkset.md`, 24 rows | `wt/test-m1u4` `0240aae`, `wt/spike-m1u4-{gen,src}`

u1–u4 shipped their mechanical assurance and carry no judgment adjudication; those rows
seed `.agent/review-m1.md`. Projection: 5 `kernel` units × ~35 rows ≈ 175 rows plus u6
spot-check, cross-cutting and `audit-m1` ⇒ size MILESTONE-REVIEW at ~3 sessions.

Sizing correction from u3: wave 1 (one map + two spikes, 40 rows) cost MAIN 130K before
a line was written; implementation fit in the rest only because MAIN never re-read the
engine files already in context. Harvest, not implementation, is the cost driver.

Watch item: u5 carries the largest estimate under a ±30K band. If its wave
crosses ~175K, split the combobox/intake surface from the run-lifecycle surface.

Sizing correction from u1: MAIN alone burned 226K implementing a 130K-estimated
kernel unit, because discovery (tar dialect, determinism root cause) and the
full implementation both landed in MAIN's window. Later units must push
discovery into teammates and reach implementation with the contract already
fixed, or split at the discovery/implementation seam.

Planning actuals: `main=76% 183K/240K`, `mate=80% 191K/240K` (map-m1), five
teammates across three waves. Size future planning waves against this.
