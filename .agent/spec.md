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

- `src/` + `index.html` — the demo. `pnpm dev`; production `pnpm build && pnpm preview`. Smoke:
  `pnpm smoke`, the built bundle answering a question in a real browser; layout + mobile:
  `pnpm visual-qa`, every state at 320, 375 and 1280 px.
- `server/chat.mjs` + `server/chat-guide.md` — local chat bridge to `codex app-server`.
  `pnpm chat:dev` beside `pnpm dev`, after `CODEX_HOME=~/.config/cnl-ckc-demo/codex codex login`.
  Smoke: `pnpm exec vitest run tests/chat-server.test.ts`, the bridge against a scripted fake;
  keyed and billed to the user's plan: `pnpm chat:live`.
- `review.html` + `src/review/` — development page for the user's live review of the ladder's
  checked-comparisons list, which no catalog question reaches. `pnpm dev`, then `/review.html`; the
  build leaves it out. Smoke: `pnpm exec vitest run tests/proof-comparison.test.ts` (V1 proves the
  page's goal with both comparisons in its ladder).
- `kb/` + `vendor/cnl-ckc/` — release `kb-2026-10-29-rc.1`'s KB archive, its sidecar and
  `kb/release.json`, and the upstream sources the provenance port cites, at the tag's commit.
  `pnpm kb:fetch <tag>` vendors a release; `pnpm kb:fetch --verify` re-checks it.
- `prototype/scope-guards/` — n30's approved ITERATE prototype (disposable; outside the build,
  eslint and prettier; retires at n30's IMPLEMENT close). `pnpm kb:build && node prototype/scope-guards/derive.mjs
  && pnpm dev`, then `/prototype/scope-guards/app/`: the shipped demo with the struck group and
  exclusion line on every answer, the page-wide evaluation date, corpus marks, a recorded chat
  replay whose goals run live, and the hub + edge-state graph (`app/graph/`, alone at
  `/prototype/scope-guards/app/graph/`). `node prototype/scope-guards/app/capture.mjs <dir>`
  re-drives every state against the running dev server. It runs from `dbf0bbe` or earlier (a
  worktree there): n1 made `guideline_evaluation_date/1` a static run-context read in the image,
  which its `snapshot/1` date overlay cannot redefine. `app/chat-guide.md` is the proposed
  guide text; the bridge still reads `server/chat-guide.md`. Prototype shortcuts, each owed a real
  implementation: the date reaches a run through a trusted `snapshot/1` adapter (`app/engine.ts`)
  that turns `clinical_context/3` dynamic and buffers a run's answers before showing them; the chat
  is a recorded turn, not the live bridge; condition sentences come from a hand-built grammar over
  the record's terms (`app/guards.ts`); the graph projects from `generated/records.json`; every
  added string is English-only.
- `prototype/graph-overhaul/` — the graph overhaul's approved prototype (disposable; outside the
  build, eslint and prettier; retires at the overhaul's IMPLEMENT close): `m1-guided-anchors`, a
  clinical concept network that opens on one pain type's direct relationships and steps out to the
  full network, where acute, subacute and chronic pain hold one row across the top; concepts
  coloured by clinical category (`shared/colourings.ts`); every other variant retired (branches
  `.claude/rules/waves.md`). `pnpm kb:build && node prototype/graph-overhaul/derive.mjs && pnpm
  dev`, then `/prototype/graph-overhaul/variants/m1-guided-anchors/` (`?pain=<acute|subacute|
  chronic>-pain`, `?network=full`; the contact page `/prototype/graph-overhaul/` links it). Smoke:
  `node prototype/graph-overhaul/capture.mjs <dir> m1-guided-anchors` drives `#overview`,
  `#trace=<question>`, `#rule=<document>:<sentence>` and `#explore=<text>` — all four at 1280 px
  light and 375 px light, `#overview` + `#trace` at 1280 px dark — against the running dev server
  (`PROTO_ORIGIN`), exit 1 naming each state that never rendered, overflowed or logged an error.
  Prototype shortcuts, each owed a real implementation: it draws the 12 recommendations' 58 rules
  alone (IMPLEMENT: the whole KB); the page reads `generated/guideline.json`, derived offline from
  the bag (answer statements from the clinical layer's JavaScript assembly, never a live Prolog
  run); sentence condition/conclusion splits are a text heuristic over the ACE (`derive.mjs`
  `split`); which concepts start a rule's lines, and which condition clauses ride them, are regex
  readings of the clinical layer's condition string (`network.mjs` `ANCHORS`, `IN_COURSE`); the
  clinical categories are a hand-made list the page labels as such; the category fills were
  checked by hand, outside `pnpm palette:check`; the layout is fcose from a seeded start with the
  pain row fixed, plus a label-declutter pass sized for the full view that never converges; the
  10 advice items without a second clinical concept draw as self-loops; every string is
  English-only.

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
- **Orphan operator contexts stay orphaned.** 55 operator-context nodes carry no edge — 45
  negation, 10 `can`, i.e. 20% of the corpus's 220 negation contexts — the body-level scopes
  whose identity binds at query time. They gain no covering edges; each records its body
  literals instead, and the body-relation dedup keys on scope (mnt-d49 ruling), so the shipped
  population is 37,597 total / 1,843 operator. u11's S3 is ONE-WAY: every operator-bearing edge
  resolves to exactly one scope record, an unreferenced record is legal, and the unreferenced
  count is pinned so it cannot drift.
- **Security lane.** Live `pnpm audit` in the gate, no allowlist; static analysis = ESLint
  security rules only, no CodeQL/Semgrep; the `.agent/deferred.md` defects stay deferred into
  MAINTAIN. Wiring → `.claude/rules/gate.md`.
- **Node 26, project-wide.** Pinned locally through `devEngines.runtime` and in CI.
- **`binding:check` holds declared tables that stay APART.** `REQUIRED` = the answer-path
  register, every row naming the part of the non-negotiable it holds up; `LIFECYCLE` = claims
  the view makes on its own; a lifecycle row never dilutes the non-negotiable roll call. One
  inventory loop grades all of them. MAIN added a third, `MEANING`, for the graph projection
  cases that hold up the polarity ruling rather than the non-negotiable; each table carries its
  own `gradeTable`, its own emptied-table control and its own count in the success line.
  Wiring → `.claude/rules/gate.md`.
- **A spanning edge shows BOTH endpoint scopes.** 1,367 of 1,496 synthesized `condition
  supports` occurrences — 569 of 621 projected groups — join endpoints under DIFFERENT scopes,
  commonest `[] → [should]` 844. `EdgeView` therefore gains `farScope` and R2 carries near end then far
  end; `scope` stays byte-for-byte what the producer recorded, because composing the two would
  manufacture a chain no `scopes` record holds. Amendment recorded at `.agent/contracts/m5u8.md`
  with the original text; approving unit `.agent/contracts/m5u13.md` V6. The 54 cases whose ends
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
  of the graded case `tests/graph-semantics.review.test.ts:120` →
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
  schema, and the nested-operator MEANING case following the inverted nesting. Release
  `kb-2026-10-29-rc.1` (bag `g673b3c1f3bfd`: 492 documents, 22 indicators, the scope and
  supersession guards, arithmetic built-ins) is the second; its approved edits are T9's declared
  edits (provenance tables, fact verbs), the read-only allowlist widened again, the oracles'
  scope-guard reading, fact verbs and evaluation-date exemption, A4's planted negated comparison,
  the marks noun fallback (ann-u1 amended), the proof depth bound 256 and S5's cap re-derived by
  its own recipe (`.agent/contracts/rel-u1.md`).
- **The KB enters as a `cnl-ckc` GitHub release, everything else is held here.** `pnpm kb:fetch
  <tag>` is the one intake: the release's archive and `.sha256` sidecar, checked against GitHub's
  asset digests, the sidecar, BagIt and the tag's SSH signature by a key pinned in
  `kb/release-signers` before use, and recorded in `kb/release.json`, which
  `kb:build` holds `kb/` to. Upstream's Verus port specifications and its `tests/ui/` fixture
  corpus are vendored at the tag's commit in `vendor/cnl-ckc/`, each file at its git blob hash
  (user ruling). No tool reads a `cnl-ckc` checkout. Law → `.claude/rules/kb-build.md`.
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
- **A comparison built-in derives and shows in the ladder.** `guideline_satisfies/4,6` derives as a
  line-free `builtin(G)` leaf, and the ladder lists each distinct comparison after the goals proved
  absent; no current catalog proof holds one. Approved edits (n9): that ladder list, and
  `tests/clinical-inference.test.ts` P1's pin `Derived: 'no'` → `'yes'`. Its live review runs on
  `review.html`, which `pnpm dev` serves and the build leaves out (user ruling, n19).
- **pnpm 12, pinned exactly; Corepack retired.** `packageManager: pnpm@12.16.1`, the legacy
  field, because npm refuses every `npx` call in a project whose `devEngines.packageManager` names
  pnpm; any pnpm from 10 on downloads and runs the pin. Its settings live in
  `pnpm-workspace.yaml`. Corepack leaves the README, CI and `readme:check`, an approved grader
  edit: Node 25 and later ship without it. `minimumReleaseAge` keeps pnpm's 24-hour default
  beside the no-allowlist audit, so a fresh advisory's fix installs a day after its release.
  **Renovate replaces Dependabot** and keeps the pnpm pin, the Node pin, the dependencies and the
  Actions current, its alerts from osv.dev; the user installs its GitHub app. Law →
  `.claude/rules/toolchain.md` `Package manager`.
- **Evidence refs live on `origin`.** Every evidence branch and tag reached GitHub at the machine
  move; a later close pushes its own with the user's go. Restore recipe →
  `.claude/rules/waves.md` `Worktrees`.
- **Every compound arm of the decoder admits a wrapper instance alone**, so a dict whose keys
  spell a compound fails closed. Approved edit (n13): `tests/engine-u2-port.test.ts` builds
  `nativeCompound` values shaped like swipl-wasm's own, and P3.10 builds its value before spying;
  every assertion stays.
- **The answer-map case carries a 30 s timeout** (`tests/graph-live.test.ts`), an approved edit:
  the second machine's i7-8650U runs the suite 3.3× slower than the Core Ultra 7 268V, and the
  case timed out at 5480 / 5962 ms against vitest's 5000 ms default from a 1-min load below 2 —
  CPU speed, not load, so the load-envelope ruling stands (`.claude/rules/gate.md`). Host-bound
  figures read per host: n16's re-open bound is 45 s on the first machine, 110 s on the second.
- **The queued-cancel case queues its cancel as step 2 begins** (`tests/solution-streaming.test.ts`),
  an approved edit: its cancel rode a 5 ms timer armed after answer 1, and a stall of 4 ms or more
  before the session's own yield let it land before step 2 on a sound tree. Every assertion stays.
- **Superseded statements surface in three places**: the answer whose recommendation family holds
  them (rec12-imp08 S1–S3 → "How should clinicians treat opioid use disorder?"), the chat as
  KB-tagged parts, and the corpus browser. Each names the statement, its superseding source and
  the date, read by a live goal over `guideline_supersession/4`. In the answer they form a group
  after its statements, headed as no longer applying, each statement struck through and carrying a
  facts-row line `Superseded <date> · <citation>`; the statement text is the knowledge base's
  controlled-language sentence, labelled as such. When the run's evaluation date precedes the
  supersession, the statements derive and show unstruck under their own heading as derived for this
  evaluation, each keeping its `Superseded` line.
- **Every answer states the guideline's scope exclusions**: a compact line naming the first
  conditions under which its recommendations do not apply, expandable to one line per distinct
  condition, each naming every source sentence that states it (12 records → 8 conditions); read by a
  live goal over the exclusion records. The wording says the recommendations do not apply under
  those conditions and never that they apply otherwise: the absence of an exclusion is no proof that
  a patient belongs to the guideline's population (upstream `README-dist.md`).
- **One page-wide evaluation date.** The knowledge base defines the evaluation date as one fact
  of the whole composition, so the date the reader sets is a premise of every run the page makes —
  each prepared question's answer, annotations and proof, and each chat goal, which the page
  supplies and the model never asserts. A date before 29 December 2022 lets the superseded
  statements derive where their other conditions and the scope guard hold; a date on or after it
  derives none of them; empty stays the shipped default, no evaluation date. Superseded marks in the
  graph and the corpus browser state a fixed record and stay independent of the date.
- **The graph gets a complete overhaul, everything open.** The graph looks generic, leaves its
  purpose unclear and may draw the wrong model. The overhaul serves four jobs: trace an answer back
  to its source, explore the knowledge base, see the guideline's shape at a glance, and explain one
  rule's logic. Every graph ruling above — the concept-first projection, polarity as edge state,
  Cytoscape, the zoom floor, wrapped labels, n30's hub + edge state — may be replaced, chosen by
  variants the user compares; Intent alone binds. It runs as its own PROTOTYPE scope once n30's
  ITERATE closes, and n30's graph projection lands inside whichever graph it picks; n30's
  IMPLEMENT stays suspended until that pick (user ruling).
- **The overhauled graph is a clinical concept network.** The PROTOTYPE pick: the network form of
  the concept-network variant (`c04`), tailored to help a reader understand clinical relationships,
  never how `cnl-ckc` handles linguistics. The verbs leave the nodes and label the edges. Its
  rulings (user, at the PROTOTYPE close):
  - **Node = a clinical concept**: the patient's situation (`acute pain`) and the thing acted on
    (`opioid therapy`). The rest of a rule's condition rides on the edge, so nothing is dropped:
    `acute pain` —should not consider, when the benefit does not outweigh the risk→ `opioid
    therapy` (rec 1 S5). A compound condition is never flattened into one edge per concept.
  - **Scope: the prototype draws the 12 recommendations; IMPLEMENT covers the whole KB** (user,
    round-6 showing). The prototype stays on the 58 rules the clinical layer parses (condition,
    actor, modal, actions), implementation notes linked as sources. IMPLEMENT's network covers
    everything the KB holds — all 492 documents: recommendations, implementation notes and
    supporting text (about 1,200 advice sentences against today's 58 rules) — so a reader can
    explore the full CDC guideline; each line must show which kind of document it comes from, so
    an implementation detail never reads as a graded recommendation. The prepared questions get
    redesigned around the full guideline in the next phase (ruling below).
  - **Vocabulary = the KB's own terms, readable** (hyphens dropped); no grouping the KB does not
    state, the disclosed hand-made colour codebook aside (ruling below).
  - **Round 1 → content trial** (user, at the round-1 showing): the concept network goes forward,
    and versions differ in WHAT it shows, focused on clinical relationships rather than linguistic
    structure. Both readings of "between the guidelines" become versions — relationships between
    the 12 recommendations and between clinical concepts across them. Seven versions, each in the
    network form that suits it (user: builder's choice per version): recommendation map, care
    pathway, treatments + tests, do vs avoid, risks + safeguards, cleaned concept net, patient
    journeys (`.agent/contracts/graph-iterate-r2.md`).
  - **Round 2 pick = the cleaned concept network (`j6`)** (user, at the round-2 showing; the
    other six versions declined). A line means what it means there: one clinical relationship a
    rule states — situation —modal + verb→ what is acted on, the rest of the condition on the
    line, every rule stating it listed on selection. Bare `patient`, `benefit` and `risk` leave
    the nodes and ride their relationship as attached advice.
  - **Example lists sit beside their rule** (user): a sentence that only lists examples (rec 5
    S9–S10, the warning signs of overdose) draws no node and no line; its list shows beside that
    sentence — in the rule view, the trace and a search for one of its terms. Never attached to a
    concept the sentence does not name.
  - **Round 1's open questions, ruled for `j6`** (user): a rule whose condition names several
    clinical concepts draws a line from EACH, every line marked as that one rule and none implying
    a relationship of its own — the patient situations, then the treatment in course (what the
    condition starts, continues, prescribes or gives); a rule naming none keeps the `patient` start;
    one node per KB term across the guideline, the condition text telling contexts apart; the force
    layout stays, untangled — spacing and label collisions fixed.
  - **One fill fails; the reader needs a place to start** (user, round-3 showing): colour by the
    KB's declared kind left every node one colour (all 48 are `entity`), so that ruling is
    withdrawn. Round 4 compares three colour sources — role in the rules, a hand-made clinical
    category printed as the prototype's reading, the guideline's four areas — on three entry points:
    pain types as anchors, left-to-right flow, a guided first view
    (`.agent/contracts/graph-iterate-r4.md`).
  - **Round 4 pick = a guided first view over pain-type anchors, coloured by clinical category**
    (user, round-4 showing): the page opens on one pain type's direct relationships (k3) and steps
    out to the full network, where acute, subacute and chronic pain hold one row across the top and
    every other concept sits below it (k1). One colouring, no switch: the hand-made codebook
    (ruling below). Left-to-right flow (k2) is declined.

**User (IMPLEMENT orientation, graph overhaul + n30):** detail, counts and the readers' and
consultants' tables → `.agent/contracts/gi-orientation.md`.

- **Every document kind draws from the start.** The network draws every relationship the KB
  states — recommendations, implementation notes and supporting text alike. Each line's style and
  panel name its document kind, and chips hide a kind.
- **Advice that names one clinical concept keeps its loop.** The projection first reads every
  second concept the KB states — in the condition and in phrases such as `for a specific
  condition`. Advice that still names one concept besides `patient`, `benefit` or `risk` draws as
  a loop on that concept, and its panel reads it as advice about the concept, never as a relation
  of the concept to itself. Leaves stay withdrawn.
- **Concepts colour by a hand-made clinical codebook: the six round-4 categories plus as many
  more as make sense** (user, after a MeSH coverage sample left about 45% of terms unmatched and
  most matched ones in two groups — `.agent/contracts/gi-orientation.md`). Two independent coders
  assign every concept; a concept that fits no class says so; the legend says the KB states no
  categories. The colour-blind-safe palette (`pnpm palette:check`) bounds how many classes can
  carry their own fill.
- **The full network fits the screen and reveals labels on zoom**, replacing the zoom floor.
  Labels keep one size on screen; at fit, the labels that fit without overlap show, the most
  connected first; zooming in reveals more; a selected concept, its neighbours and a traced
  answer always show theirs. No label is cut short.
- **Scope exclusions and superseded statements: marks + a boundaries view**, replacing n30's hub.
  A superseded line shows struck through, with the superseding law and its date; each
  recommendation line's panel says the scope exclusions apply; a boundaries view draws the
  conditions, each joined to the KB's own `recommendation` concept by a `recommendations do not
  apply` line.
- **A chat reply with a KB part shows the exclusion line**, read by the same live query as the
  prepared answers; a reply with Web or Model parts alone shows none.
- **The prepared questions get redesigned around the full guideline, as the next phase**: a
  PROTOTYPE of the question list and answer form once this IMPLEMENT closes (request verbatim in
  `Tasks`).
- **Approved grader changes**: n30's Accept moves from `tests/graph-annotations.test.ts` A1 to the
  new network — every exclusion and supersession record projected, guards included, no
  evaluation-date exemption; the owed sync-u2 and n1 reviews of the old graph become one live
  review of the new network; the date-related pins (`engine:check` call shapes, a dated proof's
  context step) re-pin, each with the old check's red recorded.

**MAIN (IMPLEMENT orientation)**, the readings three independent navigators share, and the
consultant-amended method:

- **A rule's several starts are views of ONE rule**: each line carries the rule's id and its full
  joint condition, and no line reads as a sufficient condition alone. Starts = the patient
  situations, then the treatment in course (`start`, `continue`, `prescribe`, `give`, `receive`),
  from condition events that are neither negated nor under negation-as-failure; a rule naming
  none folds into its concept's loop — no `patient` node.
- **Nothing the KB holds disappears**: every sentence is drawn, looped, listed beside its rule as
  examples, marked as a record, or shown as a statement on its concept (the eventless `There is
  no …` sentences) — counted per sentence, never per event alone.
- **A canvas line merges only identical complete readings**; different readings between one pair
  draw as separate lines.
- **Trace = the live proof's clause lines**, never an offline answer list; the chat keeps its
  query cards as its trace.
- **Condition text = the KB's own controlled-language sentence**, readable; a shorter span only
  where a structural check proves it faithful; else the whole sentence, labelled as such.
- **The network derives at build time from the KB's own logic structure** (per-sentence frames
  over the compiled clauses), never from text patterns; projection contract
  `.agent/contracts/g2.md`.
- **Cytoscape stays; layout and label sizes compute at build time** (spike `wt/builder-41`): a
  seeded fcose layout exits cleanly once `cy.destroy()` stops its animation timer and writes
  byte-identical output twice; harfbuzz boxes over the decompressed shipped font sit within
  0.6 px of Cytoscape's rendered labels; screen-fixed labels with a per-label reveal zoom show no
  ordinary overlap. Owed by g4, measured red in the spike: every concept below the pain row, the
  pain labels forced at fit, focus views (a pain type, a selected concept, a trace, a rule)
  framed so their forced labels never collide, node and line sizes fixed on screen, loop labels
  in focus views alone, an explicit component packer, the layout cached by its full input
  closure.
- **The evaluation date is run context** (spike `wt/builder-40`, mechanism `cf3fd3e`): the engine
  API freezes a validated date per call; a trusted wrapper `clinical_run(Ctx, Goal)` sets a
  global with `setup_call_cleanup` and restores the prior value on every surviving exit; a fresh
  engine starts at `none`; one static `guideline_evaluation_date/1` clause reads it natively and a
  dedicated interpreter arm reads it for proofs, which carry one run record; the proof cache keys
  on it; a second request while one is open is refused by name before parsing (closing the queue
  row on interleaved requests). An undated proof stays the same proof up to variable renaming —
  the pre-spike image itself renames rec05's 19 existential variables between derivations, so
  byte equality cannot be its test.
- **The linguistic graph retires at g7**, after the new graders land; the user approves the
  old-check → new-check mapping before then. Until g7, the pre-overhaul graph rulings above
  (polarity as edge state, Cytoscape's zoom floor, spanning scopes, reader-relative labels, orphan
  contexts, kind fills) bind the shipped linguistic graph alone; polarity's duty — no line reads
  as a claim the source denies — carries to the new network.

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
step type (8,549 leaves / 703 premises), carrying hypothetical origin and no source line.
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

**MAIN (graph overhaul PROTOTYPE):** variants add no package — Svelte 5, Cytoscape + fcose,
PDF.js and hand-written SVG/canvas only, so the lockfile, `audit:check` and every gate stay
untouched by disposable code. Each variant reads one shared seam (`shared/data.ts`) and answers the
same four hash states, so the user compares premises on equal data and `capture.mjs` grades every
variant alike.

## Tasks

- [ ] owed (user): live review of the answer panel's facts rows (ann-u3 `35d2c9c`,
  `.claude/rules/ui.md` `User review`) — `pnpm dev`; run "When and how should clinicians
  reassess opioid therapy?" (time bounds), "When should clinicians continue, taper, or
  discontinue opioids?" (qualifiers) and "How should clinicians start opioid therapy?" (a
  preference); read each statement's facts row; open "Prolog goal behind these annotations";
  switch to Japanese and to the dark theme.
- [ ] owed (user): live reviews of four approved visual units (`.claude/rules/ui.md` `User review`)
  — d5 `d6714d7` phased boot status, d17 `04ada8c` solutions rendered as they arrive, d41
  `9056d3d` the owned PDF.js page viewer, d43 `db0736f` the document-first provenance browser.
- [ ] owed (user): live review of the chat panel (c5 V8) — `pnpm chat:dev` + `pnpm dev`, ask a
  question, open a KB tag and a Web source, try Stop and New conversation.
- [ ] owed (user): live review of n9's checked-comparisons list in the ladder (`c7b9b7d`,
  `.claude/rules/ui.md` `User review`) — `pnpm dev`, open `/review.html`, expand "Explore the six
  evidence steps" and "1 checked comparison"; switch to Japanese and to the dark theme, and narrow
  the window to phone width.
- [ ] owed (user): install the Mend Renovate GitHub app on `eturkes/cnl-ckc-demo` — `main` carries
  `renovate.json` (mv4) since `0466833`; Dependabot's five open PRs are closed, and Renovate
  reopens what still applies.
- [ ] n8 `low` coverage passages — waits on a `cnl-ckc` release whose bag moves B3-09/B3-10 off
  `p14`: release `kb-2026-10-29-rc.1` still records `p14`.
- [ ] n10 `low` C6 — waits on a user ruling that restores a sentence-length check.
- [ ] n16 `low` find: `binding:check`'s wall drifts with the host (51.1 / 42.7 s at the close) — waits on
  its re-open trigger: three consecutive gates on one host above its bound (45 s on the Core Ultra
  7 268V, 110 s on the i7-8650U), each from a 1-min load below 2. The 492-document bag counts one:
  141.9 s on the i7-8650U from a load near 1.3 (T11 86.9 s, P4 50.9 s).
- [ ] o2 acceptance suite `wt/tester-7` `cd5e569` (`Intent` + `Decisions` + `gi-interfaces.md`, 75
  cases, each seen red; red commands + counts in the `cd5e569` commit body): each unit merges the cases it turns green;
  unmerged after g2: 22 (A4–A6, A8, A9). Orientation evidence (spikes, MeSH sample, g2 review, loop count,
  pre-mortem) → `.agent/contracts/gi-orientation.md`; characterization `wt/tester-8` merged `35bbb06`.
- [x] daa7191 g1 `kernel` frames: `tools/kb/frames.mjs` — a body reader that keeps `\+ (…)` groups and
  negation boxes, one frame per sentence VARIANT (consequent `ref(N)`, antecedent referents by
  Skolem `Deps` position, boxes + operator chains, guard literals apart), sentence-level census
  in `tests/census.test.ts`.
- [x] 161bd5d n1 `kernel` run context (Decisions, spike `cf3fd3e`): one logical run owns its date across
  answer, marks, proof and query cards, and a retained result shows its own date; answers stream
  under it; chat goals wrapped by the page; the read-only guard refusing any context write; closes the queue row `The engine session
  interleaves concurrent requests` by refusing a second open request by name. Approved re-pins:
  `engine:check` call shapes, the dated proof's context step.
- [x] b54372d g2 `kernel` projection: `tools/kb/network.mjs` → `kb/generated/graph/clinical-network.json`,
  re-derived by `kb:asset-check`. New `MEANING` rows BESIDE the old ones (they leave at g7):
  verb phrase ≡ operator chain; no start from a negated condition; every sentence in exactly one
  bucket; a line keeps its whole consequent (arguments, phrases, quantities); several starts share
  rule id + full condition; annotations on their line; document kind per line; every exclusion
  and supersession record + guard projected, no date exemption (n30 Accept, moved from A1).
- [x] 26b8ed4 n2 `kernel` records + superseded derivation, generic over any document (then the whole
  answer → marks → records → proof and recorded chat flows timed at none / before / on / after the
  boundary, every catalog question): compiled goals for
  the exclusion records (12 → 8 conditions, deduplicated by clause body, never by English), the
  supersession records and a per-sentence derivation under the run context; condition text = the
  KB's controlled-language sentence (Decisions).
- [ ] RESUME: finish line in force = the IMPLEMENT body's `Met when`, body verbatim in
  `.scratch/body.md`. Committed: g2 `b54372d` (CI run 43611418684, 20 jobs green); the pause
  commit after it (g2 ticked, g3 contract draft `.agent/contracts/g3.md`, this note). Uncommitted:
  none in tracked paths; g3 inputs in `.scratch/g3/` (`concepts.tsv` = the 1,334 concepts with
  degree + sentences, `rubric.md` = the pilot rubric, `pilot-ids.tsv`, `kappa.mjs`,
  `capacity*.mjs`) and the pilot tables `.scratch/agents/classifier-8.md`, `-9.md`. No teammate
  runs (classifier-4…9, consultant-11 harvested + stopped; reports in `.scratch/agents/`, roster
  `.scratch/agents/roster.md`). Branches: `wt/tester-7` `cd5e569` (acceptance o2, worktree kept,
  A7 merged + green at `b54372d`), `wt/tester-8` `2a8fd33`, `wt/builder-40` `21eb2d0`,
  `wt/builder-41` `8ccee0f` (evidence worktrees, clean, not rerun this session), `wt/tester-9`
  `c985287` (squashed into g2, worktree removed). Next: apply `g3.md`'s pilot clarifications to its
  rubric and freeze it; seed the full coding (every concept in `.scratch/g3/concepts.tsv`) for two
  fresh classifiers + a third to adjudicate; pick the ≤ 6 own-fill classes from the coded sizes;
  then the codebook file, envelope amendment, palette table, tests, A9.1 merge, `pnpm ci:gate g3`.
  Open beside g3: review row GI-1 (a non-author consultant rules before r1 closes); the user has
  not answered whether the date-re-pin approval covers n1's re-pins (demo-api, proof-guard G5,
  proof-identity, chat D5/D7/M2).
- [ ] g3 `data` clinical codebook (Decisions): classes = the six + those the corpus needs, each
  concept coded by two independent `classifier`s under a frozen rubric, adjudicated, an explicit
  no-class state; the codebook graded total over the derived concept set; `palette:check` +
  `contrast:check` over the fills.
- [ ] g4 `kernel` layout + labels at build time (Decisions, Cytoscape ruling): the spike's
  mechanism plus every item it measured red; the layout in a bounded child process, cached by its
  input closure, `kb:reproduce` byte-equal; phone interaction budgets (cold open, pan/zoom,
  input-to-paint) fixed and measured on the full asset before g5, design appraised by a
  `scientist`.
- [ ] n3 answer panel: page-wide date control; the exclusion line on every answer; the
  superseded group struck, or unstruck under its own heading when the date precedes it; the
  `Superseded <date> · <citation>` facts line; every new string in `en.ts` + `ja.ts`.
  - n30 request (user, verbatim; its graph half lands in g2): **Scope exclusions and superseded statements do not surface** — the
    graph projects no `guideline_exclusion/1` or `guideline_supersession/4` record and no guard
    (`tools/kb/graph.mjs` `UNPROJECTED`, the evaluation-date comparison skipped), and the answer
    panel never says that a statement is guarded or superseded; the ladder shows the scope guard as
    a negation step alone. Accept: the graph projects each exclusion and supersession record under
    the meaning ruling, the guard conditions included, graded by `tests/graph-annotations.test.ts`
    A1 without its evaluation-date exemption, and the answer panel names a superseded statement
    and its source, its live review owed. `pri` low. **User ruling**: carry the semantics through,
    queue the surfacing.
- [ ] g5 network UI (`src/network/`, the one Cytoscape importer) + its rendered grader before any
  app switch: pain first view (acute default), full network, trace from the live proof, one rule,
  one concept, loops, examples beside their rule, document-kind chips + line styles, codebook
  legend, boundaries view, table view, both locales, the graph on a phone's first screen; a
  `graph:check` campaign over the new component (rendered label = asset label, shown labels never
  overlap, reveal zoom honoured, interactions on both sides of the seam, fill read-back, failure
  fallbacks).
- [ ] n4 chat: the guide lands the `high` queue row (`The chat guide names guideline_document/4's
  digests as prose`) and the prototype's draft; supersession facts as KB parts; each turn keeps its
  captured date; the exclusion line under a reply with a KB part.
- [ ] n5 corpus browser: superseded marks from the live records, independent of the date.
- [ ] g6 app switch: `App.svelte` + Find in graph onto the new network; the new asset classes in
  the offline cache's lazy set (`browser:check`: no graph request before activation); `smoke`,
  `browser:check` + `visual-qa` network states.
- [ ] g7 retire the linguistic graph (`semantic-graph.json`, `src/graph/`, `tools/kb/graph.mjs`,
  `tools/graph-probe/`, its suites, census rows and mutants) once the user approves the old-check →
  new-check mapping; `.claude/rules/graph.md` rewritten; the pre-overhaul graph rulings leave
  `Decisions`.
- [ ] r1 closing review → `.agent/review.md` rows, none open.
- [ ] d1 README; live-review click paths for n3 + g5 written before the prototypes leave;
  `git tag prototype-graph-overhaul` + `prototype-scope-guards` (at `dbf0bbe`, the last revision it
  runs on), `git rm -r` both;
  `Artifacts`, `Decisions` + `Tasks` current; `Phase` = the catalog PROTOTYPE routed state (row
  below) over the suspended MAINTAIN scope.
- [ ] owed (user): live review of the new concept network once g5 lands (replaces the sync-u2
  annotations and n1 colour reviews of the old graph, user ruling) and of the n30 answer surfaces
  once n3 lands.
- [ ] catalog — the next phase, PROTOTYPE (user ruling): the prepared questions redesigned around
  the full guideline.
  - Request (user, verbatim, selected answers): "Redesign around the full guideline — Rebuild the
    prepared-question list from the full knowledge base's topics, with its own review round." Then
    "Next, as its own prototype — This session finishes the graph overhaul and the scope and
    superseded-statement work. At its close, the redesign becomes the next phase: a prototype of
    the new question list and answer form that you review, then its build."
  - Known at routing: `parseAdviceSentence` parses 1,477 of 1,813 sentences on parse alone (no
    `checkActions`, premises or gates); an antecedent comparison refuses the build today; depth
    cap 4 and the proof budget are measured on 58 sentences only.
- Queue → `.agent/deferred.md`: each row carries its acceptance check, plus the accepted-open review ids, whose checks stay in `.agent/archive/review-expedited.md`.

## Phase

IMPLEMENT — the graph overhaul, with scope exclusions and superseded statements (n30) rejoined
> I actually would like to completely overhaul the graphs in general.
> What is wrong with the graph today: Looks generic, Unclear purpose, "Also potentially wrong
> model, I'm not sure."
> What the overhauled graph mainly lets a reader do: Trace an answer, Explore the KB, See
> guideline shape, Explain one rule
> How far the overhaul may go: Everything open
> Against n30: Close n30, then graph; at the n30 IMPLEMENT paste: Route to graph PROTOTYPE now
Suspended: MAINTAIN — the whole product, free-text intake and answer-panel annotations folded in
