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

M2/M3/M4 were adjudicated after the fact against `.agent/contracts/expedited.md`;
the ledger is `.agent/review-expedited.md` (46 rows, 11 pass / 35 fail). Their
COMPLETE markers mean **built and shipped, not adjudicated sound** — user ruling:
they stay as they are, and **M5 owns the remediation**. Read the ledger before
trusting any claim in the expedited block below.

- **M1 — live question→answer spine** — REVIEWED, summary below, record in
  `.agent/archive/m1.md`.
- **M2 — provenance ladder** — COMPLETE (expedited 2026-09-04; formal session
  workflow and milestone review intentionally skipped), summary below.
  Evaluated: 0/4 committed trace oracles run; the ladder's proof rungs replay a
  build-time record (S3); a missing proof-line clause continues into unbound
  evidence (S7).
- **M3 — semantic entity graph** — COMPLETE (expedited 2026-09-04). Static `clause/2` extraction over
  the seven explicit edge schemas plus Horn-clause implication edges; fCoSE
  layout; neighborhood-first navigation; accessible non-canvas subgraph view.
  ~~Event and operator-context nodes stay; noun→noun collapse is forbidden.~~
  **Amended by user ruling.** That line predates the concept-first view and
  assumed nodes were the only way to carry scope. `a944fca` collapsed the view to
  entity/event/value nodes and dropped 156 negation and 857 `should` contexts
  with them, so a negated recommendation renders as its clinical inverse (S2, S5,
  S12+, S14+, S15+). The ruling keeps the collapsed view and carries polarity and
  modality as **edge state** instead: no operator-context node returns, and no
  edge may read as a claim the source denies. M5 u4 owns it.
- **M4 — integration + release** — COMPLETE (expedited 2026-09-04). Cross-pillar linking
  (answer↔trace↔graph), dark theme + full visual system, CSP/static-host
  decision + release proof, performance/responsive/a11y hardening.
- **M5 — semantic integrity** — IN-PROGRESS · **RESIZE**, six units sized to the retired
  1M window. Owns the expedited remediation: the answer derives by real inference, the
  proof is a real derivation, the graph carries polarity, and a mechanical check binds
  each claim. Section below.

## M5 — semantic integrity — IN-PROGRESS · RESIZE

Goal: **every surface asserts what the source asserts, and a rerunnable check
binds it.** M5 exists because the expedited range shipped surfaces whose meaning
no check decides — `pnpm gate` is green while the answer bypasses the KB.

Scope = nine ruled ledger rows (S1, S3, S3b+, S3c+, S2, S5, C2, C3, C7) + seven
closing as a consequence (S2b+, S11+, S12+, S14+, S15+, S17+, S18+) + **user-added
renderer/graph-look scope**. Seventeen rows stay accepted-open in
`.agent/review-expedited.md`; S9 + C4u3 close only partly; the ledger's Rulings
section is the authority. A fix landing an open row for free may take it; no unit
carries one as scope.

### Rulings binding the units

**User:**
- **Answer path = real inference.** Each question compiles its clinical context
  into explicit premises and derives the recommendation through the `guideline_*`
  clauses. A guideline is universally quantified over clinicians and the `actual`
  world holds no clinician instance, so `guideline_operator(actual,C,should)`
  failing on the bare KB is CORRECT — supplying the instance applies the universal.
- **Graph = polarity as edge state.** Keep the concept-first projection; carry
  negation + modality on edges; no `operator-context` node returns.
- **M2/M3/M4 keep their COMPLETE markers.** M5 owns the remediation.
- **Renderer swap is M5 scope** (new). Cytoscape → vis-network, driven by map
  legibility + interactivity. Spike runs FIRST inside u4; `src/graph/canvas.ts` =
  split seam. Measured: Cytoscape appears nowhere outside `canvas.ts` (rc 1;
  positive control 24 hits in `canvas.ts`); `model.ts` has zero imports; seam =
  `mountGraphCanvas`/`GraphCanvas`; renderer surface 6,265 B of 91,893 B = 6.8%;
  39/1070 canvas-coupled lines in `SemanticGraph.svelte`.
- **The graph's look is in scope for change** (new). This **RETIRES u4's original
  fourth acceptance clause** — "the concept-first look is unchanged" — for the
  graph alone. Clauses 1-3 survive intact and u5 carries them. Every other
  accepted surface (answer panel, ladder, combobox, theme, type, copy layout)
  stays accepted; a change forcing a visual difference there stops and asks.

**MAIN:**
- **Premise display** = deduplicated labelled premise steps inside the EXISTING
  proof rungs, not a new ladder step type. 3,882 assumption leaves measured ⇒
  volume needs dedup. Assumptions carry explicit hypothetical origin, no source line.
- **u3 RED exception.** The four-export byte oracle is GREEN at base and is
  credited RED-under-dependency-removal alone. Measured twice: it passes at
  `cbe0ae2`, and `src`/`tools`/`tests` trees are SHA-identical at `a944fca`
  (`2c66f4c…`/`68ea119…`/`6e8e700…`). It guards the compiled KB, which S1 never
  broke. Manufacturing a false RED is the expedited range's own failure mode.
- **Ordering.** MAIN ruled semantics-before-renderer, `plan-m5` held the reverse,
  MAIN conceded, `planrev-m5` confirmed the concession independently. u5 keeps the
  acceptance conjunction undecomposed; renderer-first avoids a disposable Cytoscape
  adaptation and surfaces unmeasured renderer risk early; u4 is parallel to u1-u3,
  so the non-negotiable answer/proof track is unaffected either way.

### Units

Two tracks converging: `u1→u2→u3` (answer/proof) runs parallel to `u4→u5` (graph);
both feed u6, and each unit's `Depends` line is the precondition WORK-UNIT resolves
before dispatch. Each unit records the `Split seam` a split lands on: a split moves a
file or contract boundary, never coverage.

- **u1 — inference-bound answer assembly** · kernel · `oracle` `prod` · est 190K → 336K
  Source-fragment/antecedent compiler + query-local cap-2 assumption evaluator +
  runtime `clinical_answer` assembly. `parseAdviceSentence`, the renderer and the
  aligned-passage metadata are UNCHANGED — they passed review.
  Accept: all 48 cases / 12 source answers derive through the complete 686 content
  sites; removing any cited clause changes the answer; premises-withheld and
  schema-erased controls yield no full catalog recommendation; all 7 shipped
  strings, 12 canonical terms **and raw contribution order** stay byte-identical,
  or the exact diff is shown and ruled on. Closes S1.
  Split seam: `tools/kb/clinical.mjs` source fragments ↔ `tools/kb/proof.mjs` evaluator.
- **u2 — genuine typed proof + premise display** · kernel · `oracle` · est 155K → 274K
  Remove the fabricated `clinical_advice` proof dispatch; replay u1's evaluator;
  typed clause/assumption/NAF branches; raw source-head join; deduplicated premise
  steps in existing rungs. Removing the cut ALONE yields 0/7 proofs — `resolve/3`
  whitelists only the nine `guideline_*` predicates and `session.ts:441` hard-codes
  interpreter depth 1.
  Accept: every displayed step participated and names the content-bearing clause;
  its head matches that compiled line including variables; every cited-clause
  removal changes the proof; assumptions show hypothetical origin and no source
  line; limit/cancel/error stay distinct; clause-only focus binds all 12
  contributions. Closes S3, S3b+, S3c+, and S2 on proof + clause surfaces. Depends u1.
  Split seam: `src/engine/protocol.ts` typed proof ↔ `ProvenanceLadder.svelte`.
- **u3 — binding gates + retired-check dispositions** · kernel · `oracle` · est 125K → 221K
  Four-export diagnostic lane, `EXPORTED` preflight, `guideline_*` answer+proof
  perturbation, both negative controls, exhaustive site campaign, required-check
  execution inventory, C2 disposition record, independent browser answer lane.
  Accept: clinical binding checks RED at `a944fca` and GREEN after u1/u2; legacy
  bytes GREEN at base and RED under dependency removal; export-set mutants fail;
  deleting or skipping any required check fails `pnpm gate`; missing image, failed
  consult or nonterminal solve fails closed; every retired class is restored or
  carries a specific rationale; the browser oracle uses independent expected bytes.
  Closes C2, C3. Depends u1, u2.
  Split seam: `catalog.mjs` legacy lane ↔ binding-test inventory.
- **u4 — vis-network renderer + legibility contract** · kernel · est 170K → 301K
  Spike first, inside the unit; replace `canvas.ts` behind a renderer-neutral
  edge-view contract; retain lazy HTML fallback + graph interactions; commit a
  replayable browser probe. Closes no semantic ledger row — it spends the new
  user scope explicitly.
  Spike must settle, all UNVERIFIED: automatic parallel-edge separation (docs show
  only manual `curvedCW`/`curvedCCW`/`roundness`); label visibility under
  `drawThreshold`, measured at the SAME fit zoom as the Cytoscape baseline
  (5.03 px desktop / 2.19 px mobile) or it is not a comparison; `selectNodes`
  isolation from the proof highlight via `highlightEdges: false`; per-edge dashes;
  bundle delta with six peers resolved; and a three-arm layout comparison —
  vis physics, an alternate Cytoscape layout, tuned fcose — because
  `cytoscape-fcose` 2.2.0 (2023-01-17, untyped) is the stale dependency, not
  Cytoscape core (3.34.2, 2026-08-25, zero deps).
  Accept: spike measures all 12 contribution views, worst bounded view and an
  opposite-scope parallel fixture at 320/1280 px light/dark; displayed labels and
  dashes preserve input edge meaning; selected focus is legible; distinct edges
  stay distinguishable; selection never fabricates proof highlight; lazy loading,
  resize, drag/zoom, recenter, stale mount, teardown and failure fallback pass;
  unrelated UI is unchanged. **No independent legibility oracle exists — MAIN
  retains that judgment.** Independent of u1-u3.
  Split seam: `canvas.ts` adapter ↔ `SemanticGraph.svelte` browser integration.
- **u5 — source-scoped graph producer + projection** · kernel · `oracle` `prod` · est 235K → 416K
  Versioned edge→scope records from the clause AST; correct outer endpoints and
  conjunctive support; scope-aware grouping, bounded paths, highlights,
  direction-correct shared wording + dashes, truthful hidden-count partition.
  Storage seam = referenced scope records (+5,438,529 B raw / +182,583 B gzip over
  an 8,184,964 / 286,015 B baseline); inline fields cost +44.4 MB and are rejected.
  Accept: every shown edge preserves the source relation and its ordered
  modal/negative/conditional/quantitative scope in BOTH canvas and HTML; no
  sentence reads as its inverse; all 156 negation / 857 `should` contexts and all
  1,263 operators stay represented with no operator-context node in the concept
  view; the full 5,796 scoped occurrences reconcile; all 12 genuine-proof
  highlights stay cited; the six in-scope review reds go GREEN and S19+ stays
  GREEN. **Plus (planrev `lens.gate`): u5 reruns u4's real-renderer probe on final
  scoped outputs, with lost-label and merged-parallel negative controls** — the
  DOM suite mocks the canvas, so changed label data can otherwise stay invisible.
  Closes S2 on both graph views, S5, and the seven consequence rows. Depends u2, u4.
  Split seam: `graph.mjs` scoped records ↔ `model.ts` projection — a split carries the scope
  parser and its version with the producer contract, ahead of any projection work.
- **u6 — claim alignment + milestone closure** · docs · est 85K → 150K
  Align the nine known shipped claims plus changed README/roadmap/memory claims;
  fill the committed claim→command registry; record C2 dispositions and
  accepted-open boundaries without broad remediation. The sweep found 9 claim
  strings, not the ledger's 4 — add `README.md:15,20,22`,
  `ProvenanceLadder.svelte:103` and `service.ts:1` to the known list.
  Accept: every surviving M5 claim names a committed-state command that re-derives
  it; source quotation, hypothetical premise, derived clause and legacy ABI
  evidence stay distinct; browser and visual claims cite their own rerunnable
  checks; copy/consistency checks pass; accepted non-graph presentation and the
  M2-M4 COMPLETE markers are unchanged. Closes C7. Depends u3, u5.
  Split seam: shipped copy/README ↔ the `.agent` claim registry.

### Sizing

Model = `M = H + 1.77·I`, additive (M1's archive: the multiplier applies to
implementation, the harvest term adds). `I` = 190/155/125/170/235/85K summing to
960K; `H` = 90/85/65/80/100/70K = 490K; calibrated `C` = 1,699.20K; forecast
closes `M` = 426.30/359.35/286.25/380.90/515.95/220.45K, total 2,189.20K with `H`
counted once.

**This split is sized to a retired window — hence the RESIZE marker.** It was drawn
against a 900K all-in aim on the 1M window; the live aim is 223K (window note under
M1). u1-u5 all exceed it; u6 sits 2.55K inside it on the provisional `docs` multiplier
below, so its margin is nominal rather than measured. The next `/session-roadmap` run
is the PLANNING re-size pass: re-split u1-u5 at the seam recorded with each unit
above, scope, rulings, tiers and dependency order unchanged, no wave dispatch. `I`,
`H` and the 1.77 multiplier are K figures and survive the window change; only the
unit boundaries move.

M1 close analogs: u1 226K, u2 224K, u4 228K, u5 209K, u6 133K, u7 229K. The
`docs` multiplier is **provisional, not measured**: u7 cost 229K against a 60K
`docs` estimate, so u6's 220.45K all-in is credible only by that precedent.

MILESTONE-REVIEW projection: 5 kernel × M1's mean 30.5 rows ≈ 153, + 24
cross-cutting + ~60 M5-only claim replays ≈ **237 rows**, ~4 sessions at M1's
measured 61.7 rows/session. The re-size pass raises the kernel unit count and
re-projects this. The 60-claim allowance is a forecast, not a census; the session
count is a budget, not a termination condition.

### Evidence

Wave-1 probes are committed and citable: `wt/res-m5-1` `27eff5d` (inference
mechanism matrix, 686-site binding, budgets), `wt/res-m5-2` `1542794` (answer byte
identity, fragment site/body gating, restored oracles), `wt/res-m5-3` `cd52e8a`
(polarity representation, real-browser renders, suppression refutation). Reviewer
probes from the expedited evaluation remain the starting oracles: `wt/rev-sem-1`
`tests/review-answer-proof-binding.test.ts` (u1, u2), `wt/rev-arch-1`
`tests/review-register-schema-binding.test.ts` (u1), `wt/rev-sem-2`
`tests/graph-semantics.review.test.ts` (u5 — 8 red / 1 green, of which the S9
headline and S13+ reds are accepted-open and NOT u5 scope), `wt/rev-claim-1`
`tests/review-claim-replay.dom.test.ts` (u3). Recover with `git show wt/<name>:<path>`.

Planning wave: `map-m5-1` (+ successor `map-m5-1-2`), `map-m5-2`, `res-m5-1`,
`res-m5-2`, `res-m5-3`, `plan-m5`, `planrev-m5` — 75 report rows, all validating
rc 0. `planrev-m5` graded 10 pass / 3 fail; all three fixes are folded above
(`lens.polarity` clause-4 retirement, `lens.gate` u5 probe rerun, `lens.claude`
detail inlined rather than referenced). Cost: MAIN reached 41% 408K/1M at
arbitration; teammate high-water `mate=16% 160K` (`map-m5-2`), seven teammates
across three waves.

## Expedited completion — M2 through M4

The user requested a same-session deliverable and explicitly waived the normal
session and review workflow. These milestones are implemented and mechanically
verified, but they are not represented as formally adjudicated.

- **M2:** ~~selected answers are re-proved through a bounded interpreter compiled
  into the PVM~~ — **adjudicated false (S1/S3).** The interpreter is compiled in,
  but `proof.mjs` cuts every shipped `clinical_advice/3` goal before resolution
  and emits leaves from build-time `site/2` records, so `resolve/3` is never
  reached by any shipped question. The UI joins proof lines to exact clauses, ACE
  sentences, coverage, code-point-aligned passages, projection/review
  disclosures, and a lazy physical PDF page.
- **M3:** the deterministic full graph contains 2,901 typed nodes and 20,964
  typed edges, including 9,804 implication edges — 9,053 rule-context implications plus 751 synthesized event-support shortcuts, a split the single figure hid. Rule-body entity/action
  relationships preserve the clinical conditions behind recommendations. Cytoscape/fCoSE, graph data,
  and layout work begin only after explicit activation; native HTML navigation
  remains available if the canvas fails.
- **M4:** proof-to-graph focus linking, responsive light/dark presentation,
  bounded boot recovery, static nested-path deployment, GitHub Pages automation,
  CSP guidance, and a release check are present.
  The answer surface combines every matching Prolog solution into one chat-style response;
  numbered statement citations keep source and proof inspection secondary but reachable.
  `Find in graph` carries exact live proof lines, controlled-sentence coordinates,
  the question, and its deterministic answer contribution. It activates the lazy graph in one
  click, mechanically centers the primary clinical concept, ~~hides parser/modality scaffolding~~,
  and highlights only the source contribution's semantic paths over bounded cross-source context.
  The struck phrase describes dropping polarity and modality outright, which inverts
  negated recommendations (S2, S5). M5 u4 keeps the scaffolding hidden and carries
  polarity and modality as edge state instead.

The manifest records 343 runtime assets: the PVM, QLF, question catalog, clause
index, 337 provenance chunks, source PDF, and semantic graph. Fresh forced builds
are byte-identical.

Completion proof: `pnpm gate` passes with 293 tests in 25 files; the independent
reproduction check is byte-identical; the production smoke answer matches the
vendored bag. Real-browser checks pass for development and nested production
hosting, lazy evidence/graph/PDF loading, eight 320px interaction states, and
cooperative cancellation. Desktop, mobile, expanded-evidence, and dark-graph
screens received direct visual inspection.

**What that proof does not decide (C1/C2/C7).** Every command above replays and
its result stands. None of them binds meaning: the gate is green while the answer
bypasses the KB entirely, because the range retired the `queries/answers/*.pl`
byte oracle and `catalog.mjs`'s `EXPORTED` guard without record, and weakened the
anti-hard-coding overlay to assert a `clinical_advice/3` fact — the very predicate
the goal queries. `pnpm smoke` reuses the producer as its own oracle. The visual
inspection has no rerunnable artifact. Four shipped copy claims are false under
S1/S3: `ProvenanceLadder.svelte:113,152`, `copy.ts` lede, `README.md:7`.

Answer RENDERING passes independently: `parseAdviceSentence` rebuilds every
accepted sentence byte-for-byte or fails the build, and `advice.ts` preserves
condition, modality and negation. The defect is the absent derivation, not the
wording — which is why M5 u1 preserves the rendering and replaces only what
feeds it, and why the accepted visual design survives the whole milestone.

## M2 — COMPLETE (expedited)

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
floor is added on top — stacking one double-counts. One-window aim 200K, a 240K-window
figure — the live aim is 223K, window note under M1; a unit over it splits at its named seam. u2 is the `data`-tier calibration probe: no M1 analog exists, so it
ships uncalibrated and re-sizes the tier from its own measurement.

- **u1 — provenance model and parsers** · kernel · `oracle` `prod` · est 90K → 159K · COMPLETE (expedited)
  Pure validated model over verified bag bytes: coverage rows, region resolution (bracketed
  locator AND the Box-3 ordinal path), code-point alignment, projection notes, review label,
  clause line, page. Port target = `../cnl-ckc/tools/ui.py`; the four upstream safety layers
  (identifier grammar, text rejection incl. bidi controls, path rules, output escaping) carry
  over intact. Accept: a differential reference and the ported hostile fixture classes agree;
  malformed, duplicate, unsafe or ambiguous input fails before emission.
  Wave: `map` + `orc` (upstream `tests/ui` red classes as the corpus) + `test`.
  Seam if over: split the alignment/highlight model from the coverage/region model.
- **u2 — provenance asset producer** · data · `prod` · est 65K → uncalibrated · COMPLETE (expedited)
  Deterministic clause index, 337 per-document provenance chunks, the PDF asset, manifest
  contract. Accept: fresh derivation byte-matches every asset; a structural consumer rejects
  drift; one live chunk and one page resolve. Depends u1.
  Wave: `prod` behind a MAIN-shipped validator, u1's analog = M1 u1/u4.
  Seam if over: split the clause index from the per-document chunks.
- **u3 — selected-solution proof engine** · kernel · `oracle` · est 95K → 168K · COMPLETE (expedited)
  Builtin-only cap-1 meta-interpreter in the PVM plus the typed proof RPC. Accept: six goal
  multisets match plain execution; all four committed trace oracles match; every selected
  proof obeys the hard budget (cap 1, stack 16 MiB, outer depth 100, 100000 inferences);
  **and a live-overlay differential binds the non-negotiable** — inject a PID-unique dynamic
  clause, select the solution it produces, and require BOTH the projected answer and its
  line-keyed proof to change, reading no `queries/traces` fixture. Depends u2.
  Wave: `map` + `test` (diff-blind) + `diff` against the committed traces.
  Seam if over: split the interpreter from the RPC and budget plumbing.
- **u4 — proof-to-source resolver** · kernel · `oracle` · est 80K → 142K · COMPLETE (expedited)
  Typed runtime join from proof line → clause → ACE sentence → region → passage → page →
  disclosure fields. Accept: every selected proof resolves uniquely; deletion, duplication,
  bad offset, wrong page and answer-oracle reach each return an explicit failure state, never
  neighbouring evidence. Depends u2, u3.
  Wave: `map` + `test` + `orc` reusing u1's reference.
  Seam if over: split the clause/sentence rungs from the region/passage/page rungs.
- **u5 — ladder state and structure** · kernel · est 80K → 142K · COMPLETE (expedited)
  Selected-solution ladder controller plus the six-step disclosure view and its full state
  model. Accept: selection re-proves once; loading, unavailable, limit, error, stale-run and
  content states all pass DOM and axe checks. Depends u4.
  Wave: `map` + `test`; no `orc` — no independent reference exists.
  Seam if over: split the controller state machine from the disclosure view.
- **u6 — aligned passage and disclosures** · kernel · `oracle` · est 75K → 133K · COMPLETE (expedited)
  Code-point-safe paired highlight renderer plus the projection-loss and `unreviewed`
  disclosure surfaces. Accept: source and ACE text stay byte-faithful and escaped; pointer and
  keyboard select identical groups; both disclosures render adjacent to the passage, and
  `unreviewed` reads as "no adjudication recorded", never as a failed check. Depends u1, u5.
  Wave: `map` + `test` + `orc` against `hl_parse_align`.
  Seam if over: split the highlight renderer from the disclosure surfaces.
- **u7 — lazy guideline page delivery** · kernel · est 65K → 115K · COMPLETE (expedited)
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

Window note, binding on PLANNING: recorded gauges span three regimes — M1 here, in
`.agent/archive/` and in `.agent/contracts/` = 240K; M5 planning = 1M; live = **273K,
harness-managed with auto-compaction, one-window aim 223K, reserve 50K** (global
`CLAUDE.md`). Carry the absolute K figures forward as the sizing analogs — every recorded
percentage measures a window that no longer exists, and the 1.77 multiplier survives both
retirements because it is a ratio of two K figures.

Full record → `.agent/archive/m1.md`. Judgment ledger → `.agent/archive/review-m1.md`.
Reviewer reports → `.agent/review-m1/`. Unit contracts and fixed check sets →
`.agent/contracts/m1u*.md` and `.agent/contracts/m1*-rev-checkset.md`.
