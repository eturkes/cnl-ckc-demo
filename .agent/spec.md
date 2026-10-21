# cnl-ckc-demo spec

## Intent

A browser demo complementing `cnl-ckc`: it shows the knowledge base answering clinical
questions by deterministic Prolog execution.

- Question intake takes free text through a chat. A model writes Prolog goals, and the page's
  engine runs them read-only. Each part of a reply is labelled KB, Web or Model, else
  Unverified. A click also opens a drop-down of built-in questions authored in development.
- **Answers reflect real Prolog execution over the exported KB, never hard-coding.**
  Non-negotiable.
- A visualization traces each answer back to its guideline source.
- An interactive, navigable network graph shows the semantic relationships between KB
  entities.
- The KB enters by export only. `cnl-ckc` is never linked and never a runtime dependency.
- Demo tier: no formal verification of the kind `cnl-ckc` carries; every other engineering
  standard applies in full. The demo is never embedded in any clinical capacity — it
  demonstrates `cnl-ckc`'s utility, and `cnl-ckc` is the clinical-grade system.

## Artifacts

- `src/` + `index.html` — the demo. `pnpm dev`; production `pnpm build && pnpm preview`.
- `server/chat.mjs` + `server/chat-guide.md` — local chat bridge to `codex app-server`.
  `pnpm chat:dev` beside `pnpm dev`, after `CODEX_HOME=~/.config/cnl-ckc-demo/codex codex login`.

## Decisions

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
- **Demo tier = no formal verification.** The demo serves no clinical purpose and `cnl-ckc`
  carries the clinical-grade rigor, so `cnl-ckc`'s formal-verification tier stays out. Every
  other `CLAUDE.md` `Engineering` and `Session flow` clause binds the whole
  repo — verification integrity off the answer path too, the assurance tiers, and the IMPLEMENT +
  MAINTAIN teammate dispatch. This retires the integrity waiver; every check it excused sits beside
  its firing record in `.agent/contracts/mnt5-inventory.md`. Binding → `.claude/rules/stack.md`.
- **Orphan operator contexts stay orphaned.** 83 operator-context nodes carry no edge — 76
  negation, 7 `can`, i.e. 39% of the corpus's 197 negation contexts — the body-level scopes
  whose identity binds at query time. They gain no covering edges; each records its body
  literals instead, and the body-relation dedup keys on scope (mnt-d49 ruling), so the shipped
  population is 25,490 total / 1,431 operator. u11's S3 is ONE-WAY: every operator-bearing edge
  resolves to exactly one scope record, an unreferenced record is legal, and the unreferenced
  count is pinned so it cannot drift.
- **Security lane.** Live `pnpm audit` in the gate, no allowlist; static analysis = ESLint
  security rules only, no CodeQL/Semgrep; the `.agent/deferred.md` defects stay deferred into
  MAINTAIN. Wiring → `.claude/rules/gate.md`.
- **Node 24, project-wide.** Pinned locally through `devEngines.runtime` and in CI. It lifts
  the Node-20 caps (secretlint `^12`, jsdom `^29`) that held the runtime back.
- **`binding:check` holds declared tables that stay APART.** `REQUIRED` = the answer-path
  register, every row naming the part of the non-negotiable it holds up; `LIFECYCLE` = claims
  the view makes on its own; a lifecycle row never dilutes the non-negotiable roll call. One
  inventory loop grades all of them. MAIN added a third, `MEANING`, for the graph projection
  cases that hold up the polarity ruling rather than the non-negotiable; each table carries its
  own `gradeTable`, its own emptied-table control and its own count in the success line.
  Wiring → `.claude/rules/gate.md`.
- **A spanning edge shows BOTH endpoint scopes.** 939 of 973 synthesized `condition supports`
  occurrences — 445 of 465 projected groups — join endpoints under DIFFERENT scopes, commonest
  `[] → [should]` 624. `EdgeView` therefore gains `farScope` and R2 carries near end then far
  end; `scope` stays byte-for-byte what the producer recorded, because composing the two would
  manufacture a chain no `scopes` record holds. Amendment recorded at `.agent/contracts/m5u8.md`
  with the original text; approving unit `.agent/contracts/m5u13.md` V6. The 67 cases whose ends
  CONTRADICT rather than nest are each justified by their own clause
  (`tests/graph-shortcut-justification.test.ts`); the shipped edge population does not move.
- **An edge label is READER-RELATIVE; the data stays direction-fixed.** `scope` is always the
  source end and `farScope` always the target end, `null` IFF that end is genuinely unscoped —
  nulling `farScope` when the two ends AGREE is wrong, because the source reading hides the
  defect while a target-side reader loses their own near scope. The LABEL resolves them against
  the node the reader selected: the reader's own end leads and `→` always points away from them,
  so one edge yields two strings and the arrow carries one meaning everywhere. The far end is
  omitted when empty or deep-equal to the near end — the label's decision, never the data's.
  Nothing else is trimmed across ends: a nested pair writes both sides in full, because eliding
  the repeat would render it identically to a divergent one. ONE shared `scopeReading` helper
  composes both surfaces; a second derivation per surface is what R1 forbids. Approved change
  of the graded case `tests/graph-semantics.review.test.ts:118` →
  `'supported by condition · should'`, the original's firing recorded in
  `.agent/contracts/m5u13.md`. Forms + the four-case table → `.claude/rules/graph.md`.
- **Judgment review reads the SHIPPED SURFACE, not a commit range.** The `reviewer` lenses read the
  working tree at close — `src/`, `tools/`, the gate, the contracts — so a defect is caught
  wherever it ships and superseded code is never re-read. The u3–u10 pass the ledger called
  outstanding is discharged by that reading, not by a separate history pass.
- **The IMPLEMENT close fixes the product-side defect alone.** The review's six fails split by
  where they bite. `A8` was a shipped fail-open — `tools/kb/catalog.mjs` emitted
  `catalogVersion` and its sole reader consumed `entries` without looking — and it is fixed in
  place. `G3`, `C2`, `C5`, `C6` and `C10` are grader and record-keeping defects off the answer
  path; each carried a `.agent/deferred.md` row into MAINTAIN. The four architecture rows
  `A3`–`A6` stay accepted-open on their retained checks: semantics in `.svelte` components, no
  runtime validation at the worker boundary, query and proof paths that never drain
  diagnostics, and a 3,139,261 B worker booting before user activation.
- **Accepted-open stays open.** Re-ruled against the verification-integrity clause the retired
  waiver excused, all fifteen ids — A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 · C1 C4u1 C4u4 C4u5
  C6 — stay accepted-open, the closes proposed for C1, A11+ and C6 included; none becomes a queue
  row. Facts per id → `.agent/contracts/mnt5-inventory.md` `## Accepted-open re-ruling`.

- **A re-vendored bag moves its figures, never its rulings.** Every corpus-derived figure in the
  rules, `Decisions` and the pinned checks is re-derived from the new bag and re-pinned, each
  check's red on the new bag recorded in the commit body; check logic stays as it is unless the
  user approves an edit. The upstream sync to `83569b1d` (bag `g8a51bf0c8722`: 385 documents, 19
  schema indicators, comparison built-ins in `schema.pl`) is the first such re-pin; its approved
  edits are E27's comment-blind float scan, the read-only guard's allowlist widened to the new
  schema, and the nested-operator MEANING case following the inverted nesting.
- **A recommendation to refrain reads `should not`.** The corpus spells SHOULD over a negation
  `it is recommended that X does not V`; the answer renders `X should not V`, the parser
  keeping the surface form only to rebuild the sentence. T9 carries it, and the positive copula
  `X is preferred for Y`, as declared edits of `22053ef`.
- **The chat is the free-text intake.** It replaced the TypeSafe rule-selection intake, whose
  code, suites, gate rows, census rows and binding entries are gone. `gpt-6.1-sol`, effort
  `medium`, over one persistent `codex app-server` under a dedicated `CODEX_HOME`
  (`~/.config/cnl-ckc-demo/codex`, its own login). The model writes Prolog goals; each runs
  read-only in the page's engine; every answer segment is labelled KB / Web / Model, else
  Unverified.
  - **Provenance = inline labels**: KB tags open query cards holding the goal and the engine's
    verbatim solutions; Web tags open the URLs the turn's own search returned.
  - Contracts `.agent/contracts/chat-c1.md`…`chat-c5.md`; plan + measured probe facts
    `chat-plan.md`.

- **Each answer statement carries its annotations in one facts row beneath it.** The row
  names what the knowledge base marks on that statement: its grade, its qualifiers, its
  preferences and its time bounds. The grade reads in the source's own labels alone
  (`Category A recommendation, Evidence type 4 recommendation`, strength first), never in the
  KB's common values. A preference reads `Preferred: X`, or `X over Y` where the source names
  the alternative. Thresholds in this scope are the time bounds AND the orderings the 12
  recommendation documents carry — `at least 1 week after therapy start`, and `before opioid
  prescription` beside them in the Time row; the comparison thresholds of the
  implementation-consideration documents stay in the chat and the graph. Every mark comes from
  a live read-only goal over the KB's annotation predicates. The two rival displays — marks
  inside the sentence, statements grouped under a grade heading — are retired.
- **The facts-row labels translate; their values stay English**, like the statements they
  annotate. Japanese labels: `グレード`, `修飾語`, `優先`, `時期`.
- **A qualifier before the verb leaves the verb slot.** `clinical_rule/3` and the answer term
  carry it apart, so the verb names the event's own lemma; every rendered answer stays
  byte-identical, and the T9 frozen spans move as declared edits. The answer-term digests
  outside T9 that this moves — T1 `terms`, T12/T14 `baselineHelper`, `clinical-inference` P1's
  seven goal-and-proof digests — re-pin as approved figure edits.
- **An answer derives each of its sentences exactly once.** The all-or-nothing check counted
  derivations, so a duplicated clause could stand in for a missing sentence; one per-sentence
  document derivation now serves the answer and its marks alike. `clinical-answer-live` A4's
  pinned clause text moves with it, an approved edit, as do T1's `advice` digest of that clause
  and its `records` digest of the catalog that gains `marksGoal`.
- **The catalog-version case derives the refused version from the emitted one**
  (`tests/questions-catalog-version.test.ts`), an approved edit that the catalog's v4 bump forces.
- **The controller API pin admits `marks`** (`tests/demo-api.test.ts` `DECLARED_MEMBERS`), an
  approved edit: the facts rows' state is the one member ann-u1 declares.
- **The missing-annotations notice says the annotations could not be shown** — never that the
  knowledge base returned none — and that no statement shows annotations from the documents
  concerned, because `missing` also counts marks that returned unusable, and a statement shared
  with another document keeps that document's annotations.
- **A qualifier reads `Qualifier: <words>`, first in the row.** One label serves every class;
  upstream's class names (`manner`, `usuality`, `focus`) and function glosses never show.
- **The graph's node fills pass palette safety in the gate.** `pnpm palette:check` holds every pair
  of the five node fills apart in both themes — OKLab ΔE×100 ≥ 15 plain, ≥ 8 under Machado protan +
  deutan — and the redesigned fills keep each kind's hue: green concepts, ochre actions, neutral
  attributes, darker in the light theme because its white labels cap each fill's luminance. A gate
  change approved with the new look, whose live review is owed. Law → `.claude/rules/ui.md`.
- **A grade shows once per run of statements from one source document.** The first statement
  of each document's run carries the grade; the statements after it that draw on the same
  documents leave it out. Qualifiers, preferences and time bounds stay on every statement.

**MAIN:** the marks are ONE compiled goal per question, `clinical_marks/3` at the end of
`PROOF_SOURCE`: it reads the grade, qualifier, preference, interval and order heads out of
`clinical_derived/2`, the one per-sentence derivation `clinical_advice/4` also calls,
all-or-nothing per document. The generated catalog carries it as `marksGoal`; the controller
runs it on the engine queue once the answer settles and before the trace, because every `solve`
clears the proof cache. A marks failure leaves the answer, its proof and the ladder as they
are: it costs a notice, never an answer. The
answer lists the marks goal with its verbatim engine solutions and says so when a document's
marks are missing, so a missing mark never reads as an absent one. An adverb after an object or a
modifier (rec04 S5–S6, rec11 S2) stays in that text: its verb already names the event. premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (4,491 leaves / 451 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base — it guards the compiled KB, which the answer-path defect never
broke; its RED-under-dependency-removal witness is a firing record, and its credit is the
default-operator mutants `pnpm stryker` shows it killing in its three imports — every survivor,
and every collection failure, which earns none, in `.agent/contracts/mnt5-stryker.md`. u11 graded the scope records, u12 the
projection model and u13 the shown edge; **rendered output is graded by `pnpm graph:check`
alone**, because a model-side assertion and a mocked DOM suite both survive a renderer that
shows the wrong label. A model-written goal can trap the WASM runtime: a 32-step `atom_concat`
chain aborts it under a 64 MB stack, because atoms sit outside `stack_limit` — so the read-only
guard excludes every atom builder (`chat-c1.md`), and a trap that gets through retires the
worker before its caller resumes (`chat-c2.md`).

## Tasks

- [ ] owed (user): live review of the answer panel's facts rows (ann-u3 `35d2c9c`,
  `.claude/rules/ui.md` `User review`) — `pnpm dev`; run "When and how should clinicians
  reassess opioid therapy?" (time bounds), "When should clinicians continue, taper, or
  discontinue opioids?" (qualifiers) and "How should clinicians start opioid therapy?" (a
  preference); read each statement's facts row; open "Prolog goal behind these annotations";
  switch to Japanese and to the dark theme.
- [ ] owed (user): live review of the graph annotations (sync-u2 `e73ed6c`, `.claude/rules/ui.md`
  `User review`) — `pnpm dev`, open the graph, select an answer's Find in graph (rec07 for time
  limits, rec05 for qualifiers, rec03 for a preference) and read the new relationships.
- [ ] owed (user): live reviews of four approved visual units (`.claude/rules/ui.md` `User review`)
  — d5 `d6714d7` phased boot status, d17 `04ada8c` solutions rendered as they arrive, d41
  `9056d3d` the owned PDF.js page viewer, d43 `db0736f` the document-first provenance browser.
- [ ] owed (user): live review of the chat panel (c5 V8) — `pnpm chat:dev` + `pnpm dev`, ask a
  question, open a KB tag and a Web source, try Stop and New conversation.
- [ ] owed (user): live review of the graph's new node colours (n1, `.claude/rules/ui.md` `User
  review`) — `pnpm dev`, open the graph, read concepts, actions and attributes in both themes, and
  select an answer's Find in graph to see the proof path and the selected node beside them.
- [x] 6507d44 n3 `med` `pnpm mutate` refuses a timeout-only kill — approved (user).
- [x] 2e9e67c n4 `med` `claims:check` grades each `Artifacts` bullet whole — approved (user).
- [ ] n5 `med` the inventory refuses a bare-path `text` record and a `none` gate step — approved
  (user); lands from `wip/n5-inventory` `ee0f5b2`.
- [ ] n8 `low` coverage passages — waits on the producer: `../cnl-ckc` `83569b1d` still records
  B3-09/B3-10 `p14`.
- [ ] n9 `low` the meta-interpreter derives through a comparison built-in — owed (user): approval of
  P1's pin flip and the ladder's checked-comparisons list, left queued; `wip/n9-comparison`
  `3cf1d13`.
- [ ] n10 `low` C6 — waits on a user ruling that restores a sentence-length check.
- [ ] n11 `low` `copy:check` grades component prose once — owed (user): approval of the grader
  change, left queued again; `wip/n11-copy-sweep` `ca26be9`.
- [ ] n12 `low` `claims:check` skips rules frontmatter — owed (user): approval of the grader change,
  left queued again; `wip/n12-frontmatter` `b52e01f`.
- [ ] n13 `low` the decoder's first compound arm refuses a dict — owed (user): approval of the two
  u2-port fixture edits, left queued; `wip/n13-decoder` `eca6aca`.
- [ ] n16 `low` find: `binding:check`'s wall drifts with the host (51.1 / 42.7 s at the close) — waits on
  its re-open trigger: three consecutive gates above 45 s, each from a 1-min load below 2.
- [ ] n17 `med` find: `claims:check`'s repeated-index control cannot fire on an empty index — owed
  (user): approval of the grader change.
- Queue → `.agent/deferred.md`: each row carries its acceptance check, plus the accepted-open review ids, whose checks stay in `.agent/archive/review-expedited.md`.

## Phase

MAINTAIN — the whole product, free-text intake and answer-panel annotations folded in
