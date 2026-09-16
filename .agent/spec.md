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
- **The demo-tier waiver reaches verification integrity.** Off the answer path a thin check,
  or one that cannot refuse a wrong input, is a demo-tier choice rather than a defect;
  `CLAUDE.md` `Engineering` verification integrity binds where the answer path runs, and there
  it binds whole. Strengthening a check elsewhere is scheduled work — u10c is the first such
  unit. Report honesty is unwaived. Binding → `.claude/rules/stack.md`.
- **Orphan operator contexts stay orphaned.** 71 operator-context nodes carry no edge — 64
  negation, 7 `can`, i.e. 41% of the corpus's 156 negation contexts — the body-level scopes
  whose identity binds at query time. u11 measured them and could close the gap with 71 added
  body edges; the ruling is to leave the shipped edge population untouched at 20,964 total /
  1,193 operator. u11's S3 is therefore ONE-WAY: every operator-bearing edge resolves to
  exactly one scope record, an unreferenced record is legal, and the unreferenced count is
  pinned so it cannot drift. Queued in `.agent/deferred.md`.
- **Security lane.** Live `pnpm audit` in the gate, no allowlist; secretlint pinned `^12` so
  Node stays 20; static analysis = ESLint security rules only, no CodeQL/Semgrep; the
  `Deferred` defects stay deferred into MAINTAIN. Wiring → `.claude/rules/gate.md`.
- **`binding:check` holds declared tables that stay APART.** `REQUIRED` = the answer-path
  register, every row naming the part of the non-negotiable it holds up; `LIFECYCLE` = claims
  the view makes on its own; a lifecycle row never dilutes the non-negotiable roll call. One
  inventory loop grades all of them. MAIN added a third, `MEANING`, for the graph projection
  cases that hold up the polarity ruling rather than the non-negotiable; each table carries its
  own `gradeTable`, its own emptied-table control and its own count in the success line.
  Wiring → `.claude/rules/gate.md`.
- **A spanning edge shows BOTH endpoint scopes.** 736 of 751 synthesized `condition supports`
  occurrences — 333 of 344 projected groups — join endpoints under DIFFERENT scopes, commonest
  `[] → [should]` 527. `EdgeView` therefore gains `farScope` and R2 carries near end then far
  end; `scope` stays byte-for-byte what the producer recorded, because composing the two would
  manufacture a chain no `scopes` record holds. Amendment recorded at `.agent/contracts/m5u8.md`
  with the original text; approving unit `.agent/contracts/m5u13.md` V6. The 38 cases whose ends
  CONTRADICT rather than nest are a producer question queued to `.agent/deferred.md`; the
  shipped edge population does not move.
- **Judgment review reads the SHIPPED SURFACE, not a commit range.** The `rev` lenses read the
  working tree at close — `src/`, `tools/`, the gate, the contracts — so a defect is caught
  wherever it ships and superseded code is never re-read. The u3–u10 pass the ledger calls
  outstanding is discharged by that reading, not by a separate history pass.

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base, credited RED-under-dependency-removal alone — it guards the
compiled KB, which the answer-path defect never broke. u11 graded the scope records and u12 the
projection model; the shown-edge conjunction is graded whole by u13 against the FINAL renderer,
so no u13 case may rest on a model-side assertion.

# Deferred

Queue = `.agent/deferred.md` — 53 rows, acceptance check each, plus the accepted-open review
ids, whose checks stay in `.agent/archive/review-expedited.md`. The defects are user-ruled
into MAINTAIN and the gate's open firing-input row sits beside them; nothing there blocks the
spine below. The verification-integrity census raised four rows, three of which closed as u10b + u10c;
the fourth stays queued, now beside the `graph:check` hang u10c measured.

## Units — the remaining IMPLEMENT path

The verification-integrity census is cleared and u12 shipped the projection model; u13 finishes
the graph, and u14→u15 close the phase over both spines. Full `Accept:` + `Depends` → archive;
u3–u12 closed, contract each in `.agent/contracts/`, close summaries in
`.agent/archive/units-m5.md`.

**From u11 on, every unit contract carries its red witness** — `N/M RED at base <sha>` plus
the command that reproduces it, the form `.agent/archive/contracts/m5u1.md:232` and
`m5u2.md:216` already use. Coverage today, by `/usr/bin/rg -c 'at base `?[0-9a-f]{7}'`: 3 of 13
live contracts and 4 of 108 commit bodies. Form + the two shapes that satisfy it without a
`git show` → `.claude/rules/waves.md`.

- **u13 scoped views + probe rerun** — scope rendered in canvas AND fallback; u10's component
  sweep rerun on final output. u12 hands over `SemanticGraphEdge.scopeOperators`; no `EdgeView`
  type exists yet, so u13 creates it, maps `scopeOperators` → `scope` and composes `label` as
  exactly relation + ordered scope (`.agent/contracts/m5u8.md:90-97`). Accept: every shown edge
  preserves relation + ordered scope in BOTH views, graded whole.
- **u14 claim alignment** — the false strings, on the surfaces that hold them now: the
  `lede` + trace/proof `TEXT` entries in `src/i18n/en.ts` AND their `ja.ts` twins (i18n took
  the copy out of `ProvenanceLadder.svelte`, and `copy.ts` is licence data), plus
  `README.md:8,15,20,22` and `service.ts:1`. u14 re-derives the exact set from the live
  catalogs. Accept: quotation, hypothetical premise + derived clause read as distinct in both
  locales; copy checks pass.
- **u15 claim→command registry** — fill the registry, record dispositions. Accept: every
  claim names a committed-state command that re-derives it.

# Phase

IMPLEMENT, at u13. Judgment review → `.agent/review.md`, adjudicated before the phase closes
against the fixed 32-row check set in `.agent/contracts/review-implement.md`, which reads the
SHIPPED SURFACE at close rather than a commit range (user ruling).
