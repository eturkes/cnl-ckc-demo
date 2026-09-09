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
- **Renderer stays Cytoscape** — u8 measured vis-network at half the label size, labels
  suppressed on the densest view, 12 s of layout there; every legibility defect is a Cytoscape
  style property. Fit clamps to a zoom FLOOR (pan below it) and node labels WRAP, never
  ellipsis. Ruling + edge-view contract → `.claude/rules/graph.md`, `.agent/contracts/m5u8.md`.
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

**DONE** — contract + suite each; detail → `.agent/contracts/`, `.claude/rules/`.

- **u3** `m5u3.md` · `clinical-answer-live` 5 cases. `clinical_advice/3` = 1 static derivation
  rule over `clinical_derive/4`, 0 answer facts; 12/12 terms + source ids `==` u1's oracle.
  `findall/3` alone shipped a truncated answer → the rule counts gates and demands an equal
  derivation count, so answers are all-or-nothing (A10).
- **u4** `m5u4.md` · `clinical-proof-live` 7 cases through the production RPC.
  `clinical_advice/3` projects `/4`, whose 4th arg is the proof ⇒ answer and proof are ONE
  derivation; `clinical_advice_source/4` + `advice_nodes/2` gone. `ProofStep` =
  clause|assumption|negation.
- **u5** `m5u5.md` · 3 cases in `provenance-ladder.dom`. Dedup is per PROOF: 3,930 leaves →
  the document's own 4–131 premises, inside the existing `Live Prolog proof` rung with a
  hypothetical badge and no line; the one NAF goal gets its own. Six rungs unchanged.
- **u6** `m5u6.md` · `tools/kb/exports.mjs` + `kb:export-check` + 4 cases in
  `legacy-export-lane`. `EXPORTED` declares the 4 ids and refuses a divergent bag by name; the
  live `writeq` of the WHOLE `'$guideline_answers'` envelope matches all four committed
  oracles byte for byte; erasing one `category-A-recommendation` entity line reddens
  category-A alone.
- **u7** `m5u7.md`, 12 predicates + the C2 disposition (five classes restored, none by
  rationale). `clinical-binding` perturbs `guideline_*` three compiled ways: an additive
  overlay, one erased cited clause (drops exactly its document + proof), a one-line shift
  (+1 on every proof line, 12 answers identical). `tools/binding-check.mjs` requires 35 named
  cases across 11 suites and REPLACES `pnpm test` in the gate. `tools/answer-oracle.mjs` gives
  `smoke` + `browser:check` one bag-derived expectation, graded byte for byte in BOTH locales.
  `pnpm binding:replay` shows the erasure invisible at `a944fca`, dropping one document now.
- **u8** `m5u8.md`, 11 predicates. Four arms × 14 fixtures × 2 viewports at the measured
  CANVAS box (1152×558 / 296×384 — device-size numbers overstate by ~1.4×). vis-network
  rejected; edge-view contract R1–R7 is what u9–u13 decide against.
- **u9** `m5u9.md`, 10 predicates · `pnpm graph:check` mounts the SHIPPED `mountGraphCanvas`
  in a real browser over 14 fixtures × 2 viewports; four controls redden it. Bezier, wrapped
  labels outlined in the node's own colour, `autounselectify`, an 11 px fit floor, and ONE
  fcose layout with the subject pinned — the `concentric` branch every answer view took cost
  156 crossings against fcose's 56, so u8's spike never measured the shipped surface.

**Open:**
- **u10 graph integration** — theme half SHIPPED (canvas reads `--graph-*` tokens;
  `graph:check` gained `palette` + `theme`; law → `.claude/rules/graph.md`). REMAINING: mount
  `SemanticGraph.svelte` in the probe harness (`app.html` + `app.ts`, svelte plugin + `@kb`
  alias in the probe vite config) and grade search, path, expand, recenter, canvas tap and node
  index, plus both fallbacks — a bad `graphUrl` (load alert + retry) and a palette set to
  `initial` before mount (`canvasError`, HTML relations intact). Accept: every interaction and
  both fallbacks pass under `pnpm graph:check`.
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

20 rows, each with its acceptance check, indexed in `.agent/archive/polish.md` beside
20 further `low` rows. User-ruled: all carry into MAINTAIN. The **high** one — a WASM abort
strands the worker; accept when abort is its own terminal state, the worker is recreated,
and the next query reports 337 documents.

**Gate controls** — `smoke` + `browser:check` ship no firing input (gate.md `Firing
inputs`). Accept: each reddens on a mutation its own lane runs — a pvm-stripped `dist`
copy, a renamed woff2 — and joins that table.

## Accepted-open

Ruled open; checks in `.agent/archive/review-expedited.md`. Not current scope.
A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 S9 S13+ · C1 C4u1 C4u4 C4u5 C6.

# Phase

IMPLEMENT.
