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

Queue = `.agent/deferred.md` — 45 rows, acceptance check each, plus the accepted-open review
ids, whose checks stay in `.agent/archive/review-expedited.md`. The defects are user-ruled
into MAINTAIN and the gate's open firing-input row sits beside them; nothing there blocks the
spine below.

## Units — the remaining IMPLEMENT path

u11→u13 finish the graph; u14→u15 then close the phase over both spines. Full `Accept:` +
`Depends` → archive; u3–u10 closed, contract each in `.agent/contracts/`, close summaries in
`.agent/archive/units-m5.md`.

- **u11 scoped edge records** — `tools/kb/graph.mjs` emits versioned edge→scope records from
  the clause AST. Accept: 156 negation / 857 `should` contexts + 1,263 operators represented
  inside +182,583 B gzip.
- **u12 scope-aware projection** — `model.ts` grouping, bounded paths, highlights, dashes.
  Accept: every projected edge preserves the relation + its ordered scope;
  `graph-semantics.review.test.ts`'s six in-scope reds go GREEN.
- **u13 scoped views + probe rerun** — scope rendered in canvas AND fallback; u10's component
  sweep rerun on final output. Accept: every shown edge preserves relation + ordered scope in
  BOTH views, graded whole.
- **u14 claim alignment** — the nine false strings (`ProvenanceLadder.svelte:103,113,152`,
  `copy.ts` lede, `README.md:7,15,20,22`, `service.ts:1`). Accept: quotation, hypothetical
  premise + derived clause read as distinct; copy checks pass.
- **u15 claim→command registry** — fill the registry, record dispositions. Accept: every
  claim names a committed-state command that re-derives it.

# Phase

IMPLEMENT, at u11. Judgment review → `.agent/review.md`, adjudicated before the phase closes.
