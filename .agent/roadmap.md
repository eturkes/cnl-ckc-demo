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
- **M2 — provenance ladder** — IN-PROGRESS, seven units, section below.
- **M3 — semantic entity graph** — UNPLANNED. Static `clause/2` extraction over
  the seven explicit edge schemas plus Horn-clause implication edges; fCoSE
  layout; neighborhood-first navigation; accessible non-canvas subgraph view.
  Event and operator-context nodes stay; noun→noun collapse is forbidden.
- **M4 — integration + release** — UNPLANNED. Cross-pillar linking
  (answer↔trace↔graph), dark theme + full visual system, CSP/static-host
  decision + release proof, performance/responsive/a11y hardening.
## M2 — IN-PROGRESS

Per SELECTED solution: live meta-interpreter proof → clause → ACE sentence → coverage
region → aligned source passage → guideline page; lazy PDF; projection-loss and
`unreviewed`-label disclosure. Committed `queries/traces/*.pl` = oracles only.
Sequence is serial; parallelism lives inside a unit's teammate wave.
Every planning ruling and measurement that binds a unit is inlined here or in
`.agent/memory.md`. The six wave reports
(`.scratch/agents/{map-m2,res-m2-1,res-m2-2,res-m2-3,plan-m2,planrev-m2}.md`) are
scratch-local browse context — absent, no unit loses an input.

MAIN's five design rulings, all evidence-backed by the planning wave and binding on the
units below:

- **MI** = schema-whitelisted, builtin-only, depth-capped SLD interpreter compiled INTO
  `kb.pvm` (+964 B), re-proving the SELECTED solution alone at cap 1. Runtime `consult` is
  rejected: it buys nothing and adds a fail-open contamination surface.
- **Clause join** = file-guarded `clause/3` → `clause_property(Ref, line_count(L))` against
  the deterministic concatenated payload. A runtime renderer reproduces the committed
  `clause_sha256` 0/10321 times, so no bespoke canonical renderer ships.
- **Assets** = per-document clause + provenance chunks behind a URL-only map. Rejected: one
  full bundle (5112584 B raw / 304101 B gzip) and eager hybrid metadata (45974 B gzip).
- **Guideline page** = native `<iframe>` at `#page=N` plus a permanent link. Rejected:
  PDF.js (+504727 B gzip, 34.78 MB unpacked, excludes Node 20) and prerendered pages
  (28.98 MB SVG / 36.75 MB PNG). The HTML passage stays primary and survives viewer failure.
- **Ladder UI** = in-answer semantic `<ol>` of six controlled disclosures over one
  always-readable summary. Rejected: an always-expanded panel (invites eager assets) and a
  separate route (router, history, focus restoration, cross-route stale state).

Sizing model, fixed for M2: `cal = raw × 1.77`, `raw` = whole-unit bottom-up estimate. The
1.77 multiplier IS the empirical correction for understated harvest, so no separate harvest
floor is added on top — stacking one double-counts. One-window aim 200K; a unit over it
splits at its named seam. u2 is the `data`-tier calibration probe: no M1 analog exists, so it
ships uncalibrated and re-sizes the tier from its own measurement.

- **u1 — provenance model and parsers** · kernel · `oracle` `prod` · est 90K → 159K · OPEN
  Pure validated model over verified bag bytes: coverage rows, region resolution (bracketed
  locator AND the Box-3 ordinal path), code-point alignment, projection notes, review label,
  clause line, page. Port target = `../cnl-ckc/tools/ui.py`; the four upstream safety layers
  (identifier grammar, text rejection incl. bidi controls, path rules, output escaping) carry
  over intact. Accept: a differential reference and the ported hostile fixture classes agree;
  malformed, duplicate, unsafe or ambiguous input fails before emission.
  Wave: `map` + `orc` (upstream `tests/ui` red classes as the corpus) + `test`.
  Seam if over: split the alignment/highlight model from the coverage/region model.
- **u2 — provenance asset producer** · data · `prod` · est 65K → uncalibrated · OPEN
  Deterministic clause index, 337 per-document provenance chunks, the PDF asset, manifest
  contract. Accept: fresh derivation byte-matches every asset; a structural consumer rejects
  drift; one live chunk and one page resolve. Depends u1.
  Wave: `prod` behind a MAIN-shipped validator, u1's analog = M1 u1/u4.
  Seam if over: split the clause index from the per-document chunks.
- **u3 — selected-solution proof engine** · kernel · `oracle` · est 95K → 168K · OPEN
  Builtin-only cap-1 meta-interpreter in the PVM plus the typed proof RPC. Accept: six goal
  multisets match plain execution; all four committed trace oracles match; every selected
  proof obeys the hard budget (cap 1, stack 16 MiB, outer depth 100, 100000 inferences);
  **and a live-overlay differential binds the non-negotiable** — inject a PID-unique dynamic
  clause, select the solution it produces, and require BOTH the projected answer and its
  line-keyed proof to change, reading no `queries/traces` fixture. Depends u2.
  Wave: `map` + `test` (diff-blind) + `diff` against the committed traces.
  Seam if over: split the interpreter from the RPC and budget plumbing.
- **u4 — proof-to-source resolver** · kernel · `oracle` · est 80K → 142K · OPEN
  Typed runtime join from proof line → clause → ACE sentence → region → passage → page →
  disclosure fields. Accept: every selected proof resolves uniquely; deletion, duplication,
  bad offset, wrong page and answer-oracle reach each return an explicit failure state, never
  neighbouring evidence. Depends u2, u3.
  Wave: `map` + `test` + `orc` reusing u1's reference.
  Seam if over: split the clause/sentence rungs from the region/passage/page rungs.
- **u5 — ladder state and structure** · kernel · est 80K → 142K · OPEN
  Selected-solution ladder controller plus the six-step disclosure view and its full state
  model. Accept: selection re-proves once; loading, unavailable, limit, error, stale-run and
  content states all pass DOM and axe checks. Depends u4.
  Wave: `map` + `test`; no `orc` — no independent reference exists.
  Seam if over: split the controller state machine from the disclosure view.
- **u6 — aligned passage and disclosures** · kernel · `oracle` · est 75K → 133K · OPEN
  Code-point-safe paired highlight renderer plus the projection-loss and `unreviewed`
  disclosure surfaces. Accept: source and ACE text stay byte-faithful and escaped; pointer and
  keyboard select identical groups; both disclosures render adjacent to the passage, and
  `unreviewed` reads as "no adjudication recorded", never as a failed check. Depends u1, u5.
  Wave: `map` + `test` + `orc` against `hl_parse_align`.
  Seam if over: split the highlight renderer from the disclosure surfaces.
- **u7 — lazy guideline page delivery** · kernel · est 65K → 115K · OPEN
  User-triggered native PDF iframe at the physical page plus a permanent open/download link.
  Accept, stated only in observable terms: no PDF or passage request is issued before
  activation and both are issued after it; the resolved iframe URL carries the coverage row's
  physical page as its fragment; the permanent link resolves under nested static hosting with
  no 404 and no page error. The viewer's internal rendering is NOT an acceptance predicate —
  a native viewer cannot be inspected. Depends u2, u6.
  Wave: `map` + `test`; proof runs in `pnpm browser:check`, outside `pnpm gate`.
  Seam if over: split asset delivery from the link/fragment surface.

MILESTONE-REVIEW projection: six `kernel` units × M1's ~30 rows/unit ≈ 183 unit rows, plus a
cross-cutting set (~24) and an `audit-m2` claim replay (~137 at M1's scale) ≈ 344 rows. M1
adjudicated 370 rows over 6 sessions, and its record names the inherited-fix backlog as what
doubled the session count — so **6 review sessions**, counted once, not doubled again. u2's
`data` consistency is adjudicated mechanically in-unit and does not enter the judgment ledger.

Planning cost: `main=` reached 92% 220K/240K before arbitration; `mate=78% 187K/240K`
(`res-m2-1`), six teammates across three waves. Wave lesson recorded in `.agent/memory.md`.

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

Judgment review: **370 rows adjudicated across 6 sessions** — u1 30, u2 28, u3 45,
u4 24, u5 28, u6 28, u7 26, cross-cutting 24, `audit-m1` 137. Six rows stay
accepted-open and carry acceptance checks in `.agent/polish.md`: X02, X03, X14, X19,
X20, X24. No `high` severity row is open.

Gauge band: unit `main=` ran 77–96% of 240K, `mate=` 37–76%. Review sessions ran
77–96%. Sizing calibration multiplier 1.77.

Full record → `.agent/archive/m1.md`. Judgment ledger → `.agent/archive/review-m1.md`.
Reviewer reports → `.agent/review-m1/`. Unit contracts and fixed check sets →
`.agent/contracts/m1u*.md` and `.agent/contracts/m1*-rev-checkset.md`.
