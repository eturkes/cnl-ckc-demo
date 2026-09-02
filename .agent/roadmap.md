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

- **M1 — live question→answer spine** — REVIEWED, summary below, record in
  `.agent/archive/m1.md`.
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
## M1 — REVIEWED

Live question→answer spine, shipped and adjudicated. Seven units.
`git log --oneline 79233c3^..main` is the authoritative M1 log. Prefer it over
`git log --grep "(M1[. ]"`, which drops the seven early subjects that predate the
`(M<m>…)` trace convention (M1 review X18).

Shipped surface: a Svelte page that boots SWI-Prolog as a WASM saved state in a web
worker, offers six generated catalog questions, and answers each by real Prolog
execution over 337 compiled documents. Budgets, cooperative cancel and hard-cancel
recovery are enforced end to end. Presentation, framing copy and licence disclosure
ship with the answer.

Gate = eleven steps, rc 0 from a clean `kb/generated`: 366 files 0 errors 0 warnings,
228 tests in 16 files, 131 modules, 81 copy strings, 17 contrast pairs, 6 font faces,
3 licences, 7 contained text surfaces, 3 verified assets. `pnpm smoke` and
`pnpm browser:check` run outside it because they need a real browser.

Judgment review: **354 rows adjudicated across 6 sessions** — u1 30, u2 28, u3 45,
u4 24, u5 28, u6 28, u7 26, cross-cutting 24, `audit-m1` 137. Six rows stay
accepted-open and carry acceptance checks in `.agent/polish.md`: X02, X03, X14, X19,
X20, X24. No `high` severity row is open.

Gauge band: unit `main=` ran 77–96% of 240K, `mate=` 37–76%. Review sessions ran
77–96%. Sizing calibration multiplier 1.77.

Full record → `.agent/archive/m1.md`. Judgment ledger → `.agent/archive/review-m1.md`.
Reviewer reports → `.agent/review-m1/`. Unit contracts and fixed check sets →
`.agent/contracts/m1u*.md` and `.agent/contracts/m1*-rev-checkset.md`.
