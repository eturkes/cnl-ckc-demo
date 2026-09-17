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
- **The reading is READER-RELATIVE; the data is direction-fixed.** `scope` is always the source
  end and `farScope` always the target end, `null` IFF that end is unscoped. The LABEL resolves
  them against the node the reader selected — your own end first, `→` always pointing away from
  you — so one edge yields two strings and the arrow carries one meaning everywhere. Far end is
  omitted when empty or deep-equal to near; nesting writes both sides in full rather than
  eliding a repeat, because eliding would render a nested pair identically to a divergent one.
  Approved change of the graded case `tests/graph-semantics.review.test.ts:118` →
  `'supported by condition · should'`, the original's firing recorded in
  `.agent/contracts/m5u13.md`.
- **An edge label is READER-RELATIVE; the data stays direction-fixed.** `scope` is the source
  end and `farScope` the target end, `null` IFF the target end is genuinely unscoped — nulling
  it when the two ends AGREE is wrong, because the source reading hides the defect while a
  target-side reader loses their own near scope. Whichever end the reader stands on leads, and
  `→` always points away from them. ONE shared `scopeReading` helper composes both surfaces; a
  second derivation per surface is what R1 forbids. Nothing is trimmed across ends — eliding a
  repeat would render a nested pair identically to a divergent one. Forms + the four-case table
  → `.claude/rules/graph.md`.
- **Judgment review reads the SHIPPED SURFACE, not a commit range.** The `rev` lenses read the
  working tree at close — `src/`, `tools/`, the gate, the contracts — so a defect is caught
  wherever it ships and superseded code is never re-read. The u3–u10 pass the ledger called
  outstanding is discharged by that reading, not by a separate history pass.
- **The IMPLEMENT close fixes the product-side defect alone.** The review's six fails split by
  where they bite. `A8` was a shipped fail-open — `tools/kb/catalog.mjs` emitted
  `catalogVersion` and its sole reader consumed `entries` without looking — and it is fixed in
  place. `G3`, `C2`, `C5`, `C6` and `C10` are grader and record-keeping defects off the answer
  path, which the demo-tier waiver already calls scheduled work rather than defects, so each
  carries a `.agent/deferred.md` row and closes in MAINTAIN. The four architecture rows
  `A3`–`A6` stay accepted-open on their retained checks: semantics in `.svelte` components, no
  runtime validation at the worker boundary, query and proof paths that never drain
  diagnostics, and a 3,139,261 B worker booting before user activation.

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base, credited RED-under-dependency-removal alone — it guards the
compiled KB, which the answer-path defect never broke. u11 graded the scope records, u12 the
projection model and u13 the shown edge; **rendered output is graded by `pnpm graph:check`
alone**, because a model-side assertion and a mocked DOM suite both survive a renderer that
shows the wrong label.

# Deferred

Queue = `.agent/deferred.md` — 57 rows, acceptance check each, plus the accepted-open review
ids, whose checks stay in `.agent/archive/review-expedited.md`. Every defect there is
user-ruled into MAINTAIN; a MAINTAIN request closes rows off this queue.

The IMPLEMENT close review added the last six, each with its red witness cited by branch where
one exists: `G3` the edge-blind spanning-scope grader, `C2` three `kb:asset-check` root tables
that grade nothing when emptied, `C5` two registry rows saying `deferred` and citing no row,
`C6` u13's firing record with no base revision, `C10` two rows that may already be satisfied,
and the `gate.md` static-analysis bullet that overstates its own completeness.

No unfinished unit remains. u3–u15 closed, contract each in `.agent/contracts/`, close
summaries in `.agent/archive/units-m5.md`; the judgment review is discharged in
`.agent/review.md`. MAINTAIN takes one `/goal` per request, so the spine is empty until you
open one.

# Phase

MAINTAIN.

The `rev` judgment review closed IMPLEMENT: 32 of 32 rows adjudicated in `.agent/review.md`
against the fixed check set in `.agent/contracts/review-implement.md`, **no open row** — 20
`pass`, 6 `n/a: deferred`, `A8` fixed in place and 5 fails deferred by user ruling. Five `rev`
teammates ran it, one per lens, each diff-blind in its own worktree, with MAIN holding the
security-vocabulary lane. The non-negotiable is held: all 8 `S` rows pass, `S1` and `S2` on a
differential that moves the answer and the proof when the cited clauses are erased.

Surviving evidence branches, cited by the ledger and by queue rows — never rename one:
`wt/rev-arch` `1e89286` (A8 red witness), `wt/rev-graph` `ace618a` (G3), `wt/rev-assurance`
`5c97965` (C2).

`prototype/` never existed here. The PROTOTYPE-phase role was played by the expedited M2–M4
surfaces, shipped in place and redeveloped under M5 by user ruling, so there is no tree to
retire and no `prototype` tag to cut; `.claude/rules/stack.md` already records the carve-out.
