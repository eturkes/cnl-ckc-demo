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
  `main=94% 226K/240K`, `mate=37% 88K/240K` (map-m1u1). Wave 1 only — the
  reserve was reached before the review wave, so `rev`/`rev2` never ran and u1
  carries no adversarial review. Two teammates stopped partway: reports at
  `.scratch/agents/map-m1u1.md` (17/25 rows) and `.scratch/agents/spike-m1u1-det.md`
  (9/12 rows); probe scripts on branch `wt/spike-m1u1-det`.
- **u2 — Prolog engine worker** · kernel · est 120K · OPEN (u1 contract shipped)
  Typed client + dedicated module Worker owning `swipl-wasm`, PVM load via Vite
  `?url`, plain-DTO protocol, term decode/encode, canonical display text.
  Accept: dev server and built output both boot to a 337-document engine; every
  query closes; the decoder round-trips the documented term shapes including the
  `foo(bar,7)`→`foo([bar,7])` and `1r3`/`3r1` traps.
- **u3 — budgets, failure modes, cancellation** · kernel · est 110K · BLOCKED (u2)
  Stack/depth/inference/wall-clock budgets, typed error states, consult-stderr
  fatality, cooperative abort plus terminate-and-recreate.
  Accept: each limit surfaces its own typed state; hard cancel drops asserted
  state and returns a 337-document engine; malformed goals and consult `ERROR`
  fail closed; no unbounded query reaches the UI.
- **u4 — question catalog + live answer service** · kernel · `oracle` · est 135K · BLOCKED (u3)
  Six ID-only catalog entries — the four exported projections plus repo-authored
  category-B and evidence-type-3 goals — compiled goals, canonical sorted result
  serializer, generic guideline-ID humanizer.
  Accept: all six IDs execute live through u2/u3; category-A reproduces its
  committed answer bytes and the other three are canonical value-equal to theirs;
  an injected overlay clause changes the displayed service result; a forbidden-import
  check fails on any production import of `queries/answers`; unsupported IDs and
  free text reject.
- **u5 — accessible question→answer workflow** · kernel · est 145K · BLOCKED (u4)
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

Watch item: u5 carries the largest estimate under a ±30K band. If its wave
crosses ~175K, split the combobox/intake surface from the run-lifecycle surface.

Sizing correction from u1: MAIN alone burned 226K implementing a 130K-estimated
kernel unit, because discovery (tar dialect, determinism root cause) and the
full implementation both landed in MAIN's window. Later units must push
discovery into teammates and reach implementation with the contract already
fixed, or split at the discovery/implementation seam.

Planning actuals: `main=76% 183K/240K`, `mate=80% 191K/240K` (map-m1), five
teammates across three waves. Size future planning waves against this.
