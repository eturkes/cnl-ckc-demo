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
  premises and derives through the `guideline_*` clauses; `guideline_operator(actual,C,should)`
  failing on the bare KB is CORRECT. Domain law → `.claude/rules/proof.md`.
- **Graph polarity = edge state.** Concept-first projection stays; negation + modality ride
  the edges; no `operator-context` node returns to the concept view.
- **Renderer swap is in scope** — Cytoscape → vis-network on map legibility, spike first (u8).
  Seam = `src/graph/canvas.ts`, 6.8% of the graph surface, one import; `model.ts` has none.
- **The graph's look is open to change.** Every other accepted surface — answer panel, ladder,
  combobox, theme, type, copy layout — stays accepted; a change forcing a visual difference
  there stops and asks.
- **The expedited surfaces get redeveloped in place.** The reviewed spine + the shipped
  Japanese interface stay.
- **Security lane.** Live `pnpm audit` in the gate, no allowlist; secretlint pinned `^12` so
  Node stays 20; static analysis = ESLint security rules only, no CodeQL/Semgrep; the
  `Deferred` defects stay deferred into MAINTAIN. Wiring → `.claude/rules/gate.md`.

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base, credited RED-under-dependency-removal alone — it guards the
compiled KB, which the answer-path defect never broke. u11 grades records and u12 the
projection model, but the shown-edge conjunction is graded whole by u13 against the FINAL
renderer.

# Deferred

## Units — the remaining IMPLEMENT path

u3→u7 (answer/proof) ∥ u8→u13 (graph) → u14→u15. Full `Accept:` + `Depends` → archive.

- **u3 runtime assembly** — **DONE**. Contract + 10 predicates → `.agent/contracts/m5u3.md`;
  suite = `tests/clinical-answer-live.test.ts`, 5 cases. `clinical_advice/3` = 1 static
  derivation rule over `clinical_derive/4`; 0 answer facts ship. 12/12 answer terms + source
  ids `==` u1's oracle, 401 ms for all 12, `assertz` → `permission_error`. A6 found A10:
  `findall/3` alone shipped a truncated answer, so the rule now counts gates and demands an
  equal derivation count — answers are all-or-nothing.
- **u4 typed proof** — **DONE**. Contract + 10 predicates → `.agent/contracts/m5u4.md`; suite
  = `tests/clinical-proof-live.test.ts`, 7 cases through the production RPC.
  `clinical_advice/3` projects `/4`, whose 4th arg is the proof, so answer and proof are one
  derivation; `clinical_advice_source/4` + `advice_nodes/2` are gone. `ProofStep` = a
  clause/assumption/negation union. Census → `.claude/rules/proof.md`: 686 clause nodes =
  the cited-site set exactly, 3,930 assumptions carrying no line, 15 NAF, 430 ms for all 12.
- **u5 premise display** — **DONE**. Contract + 10 predicates + the 12-document census →
  `.agent/contracts/m5u5.md`; suite = 3 cases in `tests/provenance-ladder.dom.test.ts`. Dedup
  is per PROOF: 3,930 leaves → the document's own 4–131 premises, shown once inside the
  existing `Live Prolog proof` rung with a hypothetical badge and no line. The one NAF goal
  gets its own badge. Graph focus and the clause list stay clause-only; the `<ol>` still has
  six rungs. `presentation:check` now grades the ladder's two engine-text selectors.
- **u6 legacy export lane** — **DONE**. Contract + 9 predicates → `.agent/contracts/m5u6.md`;
  lane = `tools/kb/exports.mjs` + gate step `kb:export-check` + 4 cases in
  `tests/legacy-export-lane.test.ts`. `EXPORTED` declares the 4 ids and refuses a divergent
  bag by name. The live `writeq` of the WHOLE `'$guideline_answers'` envelope —
  `query_sha256` recomputed as the query file's own digest — matches all four committed
  oracles byte for byte. Erasing the one `category-A-recommendation` entity line drops that
  document from the category-A statement and leaves the other three matching; deleting the
  suite, renaming a case or skipping one fails the step. Forced `kb:build` → byte-identical
  pvm/qlf/manifest. Design → `.claude/rules/kb-build.md`, whose stale `## Question catalog`
  text this replaces.
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

21 rows, each with its acceptance check, indexed in `.agent/archive/polish.md` beside
20 further `low` rows. User-ruled: all of them carry into MAINTAIN as requests. The one
graded **high** — a WASM abort strands the worker; accept when abort is its own terminal
state, the worker is recreated, and the next query reports 337 documents.

## Accepted-open

Ruled open; checks in `.agent/archive/review-expedited.md`. Not current scope.
A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 S9 S13+ · C1 C4u1 C4u4 C4u5 C6.

# Phase

IMPLEMENT.
