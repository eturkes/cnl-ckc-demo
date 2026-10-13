# cnl-ckc-demo spec

## Intent

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
  other global `CLAUDE.md` `Engineering` and `CLAUDE.md` `Session flow` clause binds the whole
  repo — verification integrity off the answer path too, the assurance tiers, and the IMPLEMENT +
  MAINTAIN teammate dispatch. This retires the integrity waiver; the checks it excused are queued in
  `.agent/deferred.md`. Binding → `.claude/rules/stack.md`.
- **Orphan operator contexts stay orphaned.** 71 operator-context nodes carry no edge — 64
  negation, 7 `can`, i.e. 41% of the corpus's 156 negation contexts — the body-level scopes
  whose identity binds at query time. They gain no covering edges; each records its body
  literals instead, and the body-relation dedup keys on scope (mnt-d49 ruling), so the shipped
  population is 20,980 total / 1,193 operator. u11's S3 is ONE-WAY: every operator-bearing edge
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

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base — it guards the compiled KB, which the answer-path defect never
broke — and stays uncredited: its RED-under-dependency-removal witness is a firing record, and
global `CLAUDE.md` `Engineering` credits a base-green test through a default-operator mutation
tool alone (`.agent/deferred.md`). u11 graded the scope records, u12 the
projection model and u13 the shown edge; **rendered output is graded by `pnpm graph:check`
alone**, because a model-side assertion and a mocked DOM suite both survive a renderer that
shows the wrong label. A model-written goal can trap the WASM runtime: a 32-step `atom_concat`
chain aborts it under a 64 MB stack, because atoms sit outside `stack_limit` — so the read-only
guard excludes every atom builder (`chat-c1.md`), and a trap that gets through retires the
worker before its caller resumes (`chat-c2.md`).

## Tasks

- [ ] RESUME: MAINTAIN request — work every `.agent/deferred.md` row in rank order (6 rows at
  `d3c4bc5`); a row needing the user records its part owed; new finds become rows funded after
  those six. Finish line in force = this request's `Met when` — every `.agent/deferred.md` row
  closed by its own acceptance check in its own commit, recorded blocked on the user with what it
  owes, or waiting on its re-open trigger, and `pnpm gate` green on a clean tree at the closing
  commit.
  - Committed: m1 `0727bd2`, m2 `a98b2c9`, m3 `7e31bc2`, m7 `b36a568`, m9 `84b0478`, m10
    `f2f1bb5`, then the pause commit `e9ffcb7`, then the template refresh to agents@8bc2c15.
    Working tree: nothing uncommitted.
  - The refresh queued six new finds, funded after the six: the C6 row waits on its re-open
    trigger, the `Intent` and mutation-tool rows are agent-fundable, and the three grader-change
    rows (component prose graded twice, rules frontmatter read as claims, `Artifacts`
    continuation lines) join the user question.
  - Approval-pending work, one commit each on `f2f1bb5`, none gate-run: `wip/m4-functor`
    `045ece0` (decoder fix + accept test + the three G1 case changes; the term-identity and
    readonly suites 261/261 on it; owes the `chat-c1.md` amendment and a mutant), `wip/m8-mutate-timeout`
    `7ea4369` (firing shown: a planted stalling mutant reads `INCONCLUSIVE`, rc 1, where the
    current grader reads `RED — killed`, rc 0; owes the `gate.md` mutate rows and the inventory's
    mutate lane row), `wip/m5-decisions` `4900d24` (the merged bullet alone).
  - Teammates: none running, every worktree removed, no `wt/mnt5-*` branch left.
  - Next: one chained `AskUserQuestion` (the first draft went unanswered; the user paused).
    (1) Accepted-open re-ruling: premise C1 + A11+ close, C6 closes as immutable history, A4 A5
    A6 A8 stay open by the IMPLEMENT ruling; per id queue or keep: A1, A3, A9+ (clause index
    alone), A10+ (recommend keep), S7 (visual: the user's live review owed), C4u1, C4u4, C4u5.
    Facts → `.agent/contracts/mnt5-inventory.md` `## Accepted-open re-ruling`. (2) m4: a chat
    goal holding `functor(...)` that reads the KB now runs; the three G1 cases' reason moves to
    `the goal reads no KB predicate`. (3) m5: the merged bullet. (4) m8: the mutate grader change.
    Then land each approved branch as its own unit (rebase, records, gate), fund the selected
    ids as new rows, and close with `pnpm release:check`, `pnpm mutate` run alone, the rules
    upkeep and a closing review per `CLAUDE.md` `Session flow`. m6 waits: `../cnl-ckc`
    `2acd0d70` still records B3-09/B3-10 `p14`.
  - Scratch: `.scratch/review/mutant.mjs` = the per-mutant timeout sweep the m8 row cites.

- [x] 0727bd2 m1 `med` copy:check reads both quote forms.
  - Accept: a double-quoted `en.ts` value over the word limit and a double-quoted `ja.ts` value
    ending in plain form are each refused by key.
- [x] a98b2c9 m2 `med` check inventory: every gate step, lane and suite with its firing record.
  - Accept: `.agent/contracts/mnt5-inventory.md` graded by `tests/inventory.test.ts`; owed
    (user): the accepted-open re-ruling.
- [x] 7e31bc2 m3 `low` `tests/spec-check.test.ts` holds on any real spec.
- [ ] m4 `low` a compound named `functor` decodes — owed (user): three G1 refusal cases change.
- [ ] m5 `low` one reader-relative `Decisions` bullet — owed (user): the ruling text is theirs.
- [ ] m6 `low` coverage passages — waits on the producer correcting B3-09/B3-10 `p14`.
- [x] b36a568 m7 `med` `chat:live` gains a firing input that calls no model (new row).
- [ ] m8 `med` `pnpm mutate` refuses a timeout-only kill — owed (user): a grader change (new row).
- [x] 84b0478 m9 `low` the axe-contrast pin fires in an environment that decides contrast (new row).
- [x] f2f1bb5 m10 `low` a compound named `$t` decodes and is refused re-entry by name (new row).
- [ ] owed (user): live reviews of four approved visual units (`.claude/rules/ui.md` `User review`)
  — d5 `d6714d7` phased boot status, d17 `04ada8c` solutions rendered as they arrive, d41
  `9056d3d` the owned PDF.js page viewer, d43 `db0736f` the document-first provenance browser.
- [ ] owed (user): live review of the chat panel (c5 V8) — `pnpm chat:dev` + `pnpm dev`, ask a
  question, open a KB tag and a Web source, try Stop and New conversation.
- Queue → `.agent/deferred.md`: each row carries its acceptance check, plus the accepted-open review ids, whose checks stay in `.agent/archive/review-expedited.md`.

## Phase

MAINTAIN — the whole product, free-text intake folded in.
