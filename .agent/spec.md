# Intent

A browser demo complementing `../cnl-ckc`: it shows the knowledge base answering clinical
questions by deterministic Prolog execution.

- Question intake reads as future free-text input; for now a click opens a drop-down of
  built-in questions authored in development.
- **Answers reflect real Prolog execution over the exported KB, never hard-coding.**
  Non-negotiable.
- A visualization traces each answer back to its guideline source.
- An interactive, navigable network graph shows the semantic relationships between KB
  entities.
- The KB enters by export only. `../cnl-ckc` is never linked and never a runtime dependency.
- Demo tier: `cnl-ckc`-level rigor is waived everywhere except the non-negotiable. The target
  demonstrates `cnl-ckc`'s utility, not clinical production software.

# Artifacts

- `src/` + `index.html` — the demo. `pnpm dev`; production `pnpm build && pnpm preview`.

# Decisions

Stack, gate + area law → `.claude/rules/`; detail + history → `.agent/archive/`.

**User** (outranks MAIN):

- **Answer path = real inference.** Each question compiles its clinical context into explicit
  premises and derives through the `guideline_*` clauses. A guideline is universally
  quantified over clinicians and `actual` holds no clinician instance, so
  `guideline_operator(actual,C,should)` failing on the bare KB is CORRECT.
- **Graph polarity = edge state.** Concept-first projection stays; negation + modality ride
  the edges; no `operator-context` node returns to the concept view.
- **Renderer swap is in scope** — Cytoscape → vis-network on map legibility, spike first (u8).
  Seam = `src/graph/canvas.ts`, 6.8% of the graph surface, one import; `model.ts` has none.
- **The graph's look is open to change.** Every other accepted surface — answer panel, ladder,
  combobox, theme, type, copy layout — stays accepted; a change forcing a visual difference
  there stops and asks.
- **The expedited surfaces get redeveloped in place.** The reviewed spine + the shipped
  Japanese interface stay.

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's four-export oracle is GREEN at base, credited RED-under-dependency-removal alone: it
guards the compiled KB, which the answer-path defect never broke. u11 grades
records and u12 the projection model, but the shown-edge conjunction is graded whole by u13
against the FINAL renderer. Removing the `clinical_advice` cut spans u3+u4 — alone it yields
0/7 proofs.

# Deferred

## Units — the remaining IMPLEMENT path

u3→u7 (answer/proof) ∥ u8→u13 (graph) → u14→u15. Full `Accept:` + `Depends` → archive.

- **u3 runtime assembly** — answers derive through u2's evaluator, not the build-time fact.
  Accept: 48 cases / 12 answers derive over all 686 sites, bytes identical.
- **u4 typed proof** — replay u2's evaluator behind typed clause/assumption/NAF branches.
  Accept: every step participated and names its clause line; each cited-clause removal changes
  the proof.
- **u5 premise display** — deduplicated premise steps inside the existing rungs. Accept:
  assumptions show hypothetical origin without a source line; ladder layout unchanged.
- **u6 legacy export lane** — four-export lane, `EXPORTED` preflight, `queries/answers/` byte
  oracle. Accept: GREEN at base, RED under dependency removal, deleting the lane fails the gate.
- **u7 binding-check inventory** — `guideline_*` perturbation, the 686-site campaign, negative
  controls, a browser answer lane. Accept: RED before u1-u5, GREEN after, and skipping a
  required check fails `pnpm gate`.
- **u8 renderer spike + ruling** — parallel-edge separation, labels at the Cytoscape fit zoom
  (5.03 / 2.19 px), `selectNodes` isolation, dashes, bundle delta, three-arm layout. Accept: a
  measured verdict per capability; renderer + edge-view contract committed.
- **u9 renderer adapter** — replace `canvas.ts` behind u8's contract. Accept: distinct edges
  stay distinguishable and selection never fabricates proof highlight.
- **u10 graph integration** — `SemanticGraph.svelte`, keeping the lazy HTML fallback. Accept:
  every interaction and the failure fallback pass under a committed browser probe.
- **u11 scoped edge records** — `tools/kb/graph.mjs` emits versioned edge→scope records from
  the clause AST. Accept: 156 negation / 857 `should` contexts + 1,263 operators represented
  inside +182,583 B gzip.
- **u12 scope-aware projection** — `model.ts` grouping, bounded paths, highlights, dashes.
  Accept: every projected edge preserves the relation + its ordered scope;
  `graph-semantics.review.test.ts`'s six in-scope reds go GREEN.
- **u13 scoped views + probe rerun** — scope rendered in canvas AND fallback; u10's probe
  rerun on final output. Accept: every shown edge preserves relation + ordered scope in BOTH
  views, graded whole.
- **u14 claim alignment** — the nine false strings (`ProvenanceLadder.svelte:103,113,152`,
  `copy.ts` lede, `README.md:7,15,20,22`, `service.ts:1`). Accept: quotation, hypothetical
  premise + derived clause read as distinct; copy checks pass.
- **u15 claim→command registry** — fill the registry, record dispositions. Accept: every
  claim names a committed-state command that re-derives it.

## Defects

→ `.agent/archive/polish.md`, which also holds 20 `low` rows.

| defect | accept |
| --- | --- |
| **high** A WASM abort strands the worker | abort = own terminal state, worker recreated, next query reports 337 docs |
| Browser tools steer by English accessible names | locale-independent handles, count from an attribute, both locales |
| README install path is hand-verified | a script clones HEAD, runs only the README commands, asserts rc 0 + counts |
| A QLF fallback import doubles the engine | it loads only on saved-state failure; an untaken fallback ships no bytes |
| `wt/test-m1u2` + `wt/test-m1u4` suites never ran here | both run in-tree, each case red for a contract reason or green |
| Heap limit + hard kill are proven in Node alone | a browser run exhausts the heap + kills a hostile goal, reporting 337 docs |
| The byte claim binds the `solutions([...])` substring alone | the whole envelope ships, or the contract says why not |
| Boot is terminal on failure, unbounded on silence | a failed or hung boot settles bounded as one alert with a retry |
| The axe sweep predates the About panel + `<details>` | a dom test runs `axe.run` with each disclosure open + closed |
| `copy:check` grades two files by path | its file set derives from the source tree; a 30-word sentence anywhere fails |
| Wordmark, forbidden claims, descriptor + fallback stacks rest on one reading | each decided by a committed check |
| The inference budget re-arms per solution | a goal whose total exceeds budget reaches `limit:'inference'`, or the bound is contracted |
| `pnpm smoke` stays rc 0 on a stale `dist/` | it fails on a `dist/` stale against the KB input hash, `dist/` intact |
| `verify-fixes.py` (45/45 RED) + `validate-report.py` are gitignored | both port in; an escaped pipe grades the same; one command replays the kills |
| The answer-oracle scan skips `kb/generated` | the literal planted in a generated file gives `kb:asset-check` rc 1; restoring rc 0 |
| One of twelve protocol arms is clone-tested | all 12 discriminants clone + deep-compare; a mutant reddens it |
| Five browser claims + two probes live only on `wt/` branches | one typed `tools/` harness covers all five; probes port or claims prune |
| The `.claude/rules/` censuses have no mechanical owner | one script re-derives each from `kb/generated` + `dist`, naming mismatches |
| Two tests time out under parallel execution | both pass 20 consecutive full-suite runs at the committed worker count |
| 9 of u5's 26 combobox predicates rest on jsdom stubs | a Chromium test drives real input, reads the AX tree, runs axe |

## Accepted-open

Ruled open; checks in `.agent/archive/review-expedited.md`. Not current scope.
A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 S9 S13+ · C1 C4u1 C4u4 C4u5 C6.

# Phase

IMPLEMENT.
