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
- `worker/` + `wrangler.jsonc` — local judgment proxy for free-text intake, key in gitignored
  `.dev.vars`. `pnpm intake:dev` beside `pnpm dev`.
- `tools/intake-probe.mjs` — live held-out accuracy, keyed + billed. `pnpm intake:probe`.

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
  path, which the demo-tier waiver already calls scheduled work rather than defects, so each
  carries a `.agent/deferred.md` row and closes in MAINTAIN. The four architecture rows
  `A3`–`A6` stay accepted-open on their retained checks: semantics in `.svelte` components, no
  runtime validation at the worker boundary, query and proof paths that never drain
  diagnostics, and a 3,139,261 B worker booting before user activation.

- **Free-text patient intake is BUILT, and it SELECTS rules rather than composing goals.**
  The user describes a clinical situation; the demo returns the subset of
  the 48 shipped `clinical_rule/3` recommendations whose guideline conditions that description
  meets, each derived through the existing clinical path unchanged.
  - Premises are universal-instantiation scaffolding, so they cannot select a recommendation;
    the discriminator is the `clinical_rule/3` condition, and **`derive/5` is not touched**.
    Measurements + law → `.claude/rules/proof.md` `Free-text intake selects`.
  - Intake is ONE judgment request — condition Nouls + pain Choice with its `other` hatch +
    section Nouls + candidate-term Nouls (below). **No goal is composed and no new executable surface is added**:
    every derivation is an existing predicate over existing shipped records, and the answer
    set is a subset of the 48 shipped recommendations, so it cannot fabricate.
  - Refusal = the hatch alone; an empty match set is the distinct no-match outcome. **Never a
    probability threshold** — `covered`
    spans [0.50,0.97] in-scope against [0.01,0.65] out, which overlap, so no threshold
    separates them.
  - Three outcomes stay distinct on screen: refused at intake / matched nothing, naming what
    the description asserts that the KB has **no vocabulary for** / answered. That third list
    is the anti-hallucination story made visible rather than asserted, and it is honest about
    real gaps — the condition vocabulary carries no numeric dose threshold and nothing about
    sleep-disordered breathing.
  - Key stays server-side behind a **serverless proxy** — Cloudflare Workers, chosen on abuse
    containment — never `dangerouslyAllowBrowser`.

  Measurements, costs and limits → `.agent/archive/nl-intake.md`; probe code → branches
  `wt/res-nl-intake` `ae608ff` (routing, grounding, vocabulary) and `wt/res-u16-shape`
  `490dfcf` (premise shape, rule shape) — never rename either.

- **u16 delivery bindings.**
  - **Key = `~/.config/typesafe/key`** (supersedes paste-in-chat). It is read only into a
    gitignored `.dev.vars` and the live probe run; it is never echoed or committed.
  - **Local-only delivery.** The Cloudflare deploy is DEFERRED (`.agent/deferred.md`); the
    Worker ships as code and runs under `wrangler dev` behind a same-origin Vite proxy, so
    `connect-src 'self'` stands. **Pages publishing STOPS**: CI keeps the gate + scanners.
  - **Layout = free text FIRST, drop-down below.** `QuestionCombobox` keeps its exact look
    under the textarea as the "or pick a built-in question" path; both stay visible.
  - **Result view = its own panel under the intake.** Each derived recommendation offers "Show
    derivation", which runs its document's built-in question through the UNCHANGED
    `AnswerPanel` + ladder.
  - **Gap list on BOTH answered and no-match outcomes**; on no-match it is the headline.
  - **Japanese = copy parity only.** Free-text intake is graded in English alone; no
    bilingual-intake claim either way.

- **Third outcome = candidates from the user's OWN words.** A dependency-free stopword chunker
  cuts the description into verbatim substrings (bounded count + length); the same request
  asks one Noul per candidate — asserted by the description AND expressed by no KB vocabulary
  entry. The browser recomputes the candidates and refuses any returned term they do not
  contain, so nothing is generated. `compromise` was measured worse (split `opioid use
  disorder`, dropped `tramadol`) and is rejected.

- **Selection model.** Condition Nouls (24) select conditional rules; a pain Choice
  `{acute, subacute, chronic, unstated}` + `other` = the hatch; 4 section Nouls, headings
  read VERBATIM from the bag's CDC Box 3, select unconditional rules. A rule answers iff its
  trigger fires (its condition Noul, else its section Noul) AND it is pain-compatible.
  `painSet(rule)` = the pain types its own text names, else its document's union, else ∅ =
  agnostic; compatible iff ∅ or the chosen type is in it, so `unstated` admits agnostic rules
  alone. A Noul says yes at value ≥ 0.5.

- **Stack.** `@typesafe-ai/sdk` exact `0.6.0` inside the Worker ALONE — the browser never
  imports it, and ESLint enforces that. `wrangler` is a devDependency.

- **Probe set.** An independent `scientist` authors the held-out descriptions + gold from the
  KB alone, frozen and committed before the first live run. Live accuracy is REPORTED per
  case, never gated — Jev has no determinism control. The gate grades the committed replay +
  the forced-arm control.

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base, credited RED-under-dependency-removal alone — it guards the
compiled KB, which the answer-path defect never broke. u11 graded the scope records, u12 the
projection model and u13 the shown edge; **rendered output is graded by `pnpm graph:check`
alone**, because a model-side assertion and a mocked DOM suite both survive a renderer that
shows the wrong label. The `pri` high **Browser WASM abort** queue row stays gated: it needs
a runaway `assertz` to abort the runtime, and the intake composes no goal, so the abort stays
unreachable until an ad-hoc goal path exists — which the free-text ruling declines.

# Tasks

MAINTAIN request: work every `.agent/deferred.md` row in rank order (`high` → `med` → `low`,
queue order within a rank); one unit + commit per row, gate green at each, row pruned in its
closing commit. `dN` = the row's ordinal in the queue at `24bbb5d`.

- [ ] Resume note — resumed after `417f501` (gate rc 0 there, 1117/1117); the closing commit deletes this row.
  - Finish line in force: the original request's Met-when. Every row is closed by its own check in
    its own commit, recorded as blocked on the user, or waiting on its trigger. The full gate passes
    on a clean tree at the closing commit, and the final message lists SHAs, owed parts, rows added,
    gate + skipped/not-run checks, teammates, advisor calls, the unconfirmed, `git status` and the
    closing SHA.
  - Committed before the pause: cap-one `9ade964`, CI `64fb0cc`, d5 `d6714d7`, d12 `114ad49`, d17
    `04ada8c`, d39 `337aeba`, d41 `9056d3d`, d43 `db0736f`, d63 measured `d107a16`, inline-disable
    `f862574`, dict `8a8a21e`, failed reset `935b287`, condition-supports `ce75b11`, selected-row
    `5fd1588`, B9 `d2744cb`, probe-control `e8f7cab`, licences `995e333`, pause `417f501`.
  - Rulings (user, this session): `e8f7cab`'s claims:check change RATIFIED; d63 = declared limit;
    d61 stays local, owed; d5/d17/d41/d43 = the user reviews them in the live interface, owed — no
    capture review.
  - Teammates before the pause: `mnt2-reviewer-1`…`-8` (reviewer), every verdict pass after its fix
    round; reports `.scratch/agents/mnt2-reviewer-N.md`. Snapshots `wip/mnt2-*` + `wt/d63` stay.
  - This session: d63 `9d11b44`; rulings commit (gate.md ratification, ui.md live review). Next:
    Close-2: one `reviewer` over `70c8507..HEAD` every lens, `pnpm gate` clean, release lanes incl.
    `kb:reproduce` — unconfirmed: kb.pvm 457,932 B in an Oct 2 cached build vs 458,180 B in the
    forced builds since, which agree. Notes `.scratch/mnt3/`.
- [x] `9ade964` `med` Cap-one re-proof: a pinned-contention trip names `limit: 'wall-clock'`; the case proves under a frozen clock.
- [x] `64fb0cc` `med` CI registry receipt: the registry row lists every `run:` + `uses:` step of `ci.yml`.
- [x] `24bbb5d` d0 find: 4 live advisories reddened `audit:check` → lockfile bump.
- [x] `b919283` d2 browser lanes steer by `data-action` handles, narrow sweep in both locales.
- [x] `6c77126` d4 `pnpm readme:check`: README setup path from a clean clone, in `release:check`.
- [x] `b6f2a54` d7 `claims:seed` keys on a full-claim digest; `claims:check` refuses a stale digest.
- [x] `bbb4f24` d10 QLF fallback under the user's transfer reading: a failed saved state boots `swipl-bundle` + `kb.qlf`; a sound session fetches neither, precache included.
- [x] `5af7982` d13 `tools/validate-report.mjs`: committed port, escaped pipe = content.
- [ ] d14 blocked behind d29: real heap exhaustion aborts in Node too at swipl-wasm 8.0.7; live harness committed, `limit: 'heap'` read owed.
- [x] `060c0f7` d18 u4 suite ported: 4 merged green, 3 covered, 1 input retired (P1.10 held by T13).
- [x] `e78551f` d16 `browser:check` kills a hostile goal by the client deadline; one respawn reports 337 documents.
- [x] `07899e0` d19 closed on its own check: archived `m1u4.md` D6 records why `query_sha256` stays out of the runtime; the export lane re-derives the whole envelope.
- [x] `88af76b` d21 a failed boot retires its own worker, so Retry rebuilds the engine.
- [x] `34e791b` d23 V13 axe sweep: About panel + canonical answer, open and closed.
- [x] `3f76af8` d24 `copy:check` walks `src/` and grades every component's literal prose.
- [x] `0465faa` d25 the inference budget bounds the whole request (`meteredGoal`, terminal record, display after close).
- [x] `9d1eecb` d26 smoke refuses a build stale against the bag's input digest.
- [x] `8fc8173` d11 u2 suite ported: 16 merged green, 20 covered, 2 red → rows (d12 float, new find improper-list tail).
- [x] `4dc9179` d45 20 consecutive full-suite runs passed 1014/1014 each (load 4.6–23.5).
- [x] `0273a6a` d27 `pnpm mutate`: committed 45-mutant table + runner, 45/45 killed.
- [x] `34d9d7e` d36 `kb/generated` joins the answer-oracle scan, with its own firing input.
- [x] `da39355` d31 a hung boot settles one typed `boot` error after one recreate; row text corrected from `worker` (d56 clause).
- [x] `69e7110` d37 every protocol discriminant (5 request + 9 response = 14) clones; per-row non-cloneable mutant refused.
- [x] `ec37224` d30 `pnpm test:browser`: the nine jsdom-stubbed combobox predicates in real Chromium.
- [x] `f380d61` d32 `copy:check` `INTERNAL_ID` refuses a catalog string naming a milestone, unit or review id; the dead `descriptor` cell + `describeDescriptor` are gone.
- [x] `f40ce36` d40 `pnpm engine:probe` grades R38/R39/R41/R42/R45; the `res-m1-*` claims are ported (JSON corruption, stack flag, direct eval, axe contrast, engine split in smoke), covered, or pruned.
- [x] `524dad6` d44 `tests/census.test.ts` grades every stable census the rules state against its derivation.
- [x] `1193641` d46 smoke + browser:check each refuse a mutation their own lane runs (pvm-stripped copy, renamed woff2).
- [x] `3032246` d48 every shipped bound names an owner in the rules; the 60-relation cap surfaces its truncation.
- [x] `85e51fc` d49 the 71 orphan contexts record their body literals; the body-relation dedup keys on scope (+16 edges); `MEANING` O1–O4 prove none is shown through another world.
- [x] `fce2f9b` d50 retired by user ruling: the shipped graders cover the projection; `wt/orc-proj` `1a893b1` stays as evidence.
- [x] `0e1e5e0` d51 each of the 38 contradicting shortcuts is justified by its own clause (`tests/graph-shortcut-justification.test.ts`).
- [x] `ebf066e` d52 `graph:check` binds each spanning reading to its edge by id, both directions; the fallback list can expand to every incident relation.
- [x] `d07faac` d53 each `kb:asset-check` root table refuses an emptied table by its own name.
- [ ] d29 `high` WASM abort — waits: an ad-hoc goal path (`Decisions` MAIN).
- [x] `e9465b9` d54 every `deferred` registry row cites a live queue row; `claims:check` refuses an uncited or dangling one (7 rows added).
- [x] `9b793fd` d1 the Japanese face ships as a catalog-exact subset (2,654,740 B → 193,444 B), raster-identical to the original.
- [x] `906d069` d3 `copy:check` grades Japanese register J1–J4 (`mnt-d3.md`, approved); 3 copy edits.
- [x] `d6714d7` d5 approved (user): phased boot status replaces the status line's boot text — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `3f99fd1` d6 the URL carries the selected catalog id; reload and back/forward select it and never run.
- [x] `424b394` d8 a service worker precaches the boot set; a second visit boots offline; a renamed PVM evicts the stale cache.
- [x] `6e558cd` d9 both u1 wave-1 reports validate (25/25, 12/12), re-derived at today's tree; new row: halting payload reports `[object Object]`.
- [x] `114ad49` d12 ruled (user): leave as is — close as a declared limit, records only.
- [x] `91d22b7` d15 u3 port merged (8 green); its P3.3 case caught `0465faa`'s unbounded display → the deadline bounds every answer and proof display.
- [x] `768742e` d20 `kb:asset-check` refuses an oracle path assembled from its two bare segments.
- [x] `1dc006f` d22 `pnpm visual-qa`: 39 states at 320/375/1280 px, none overflows, planted-overflow control.
- [x] `2b4a2b6` d28 the source-label grammar is stated in `.claude/rules/ui.md` `Copy`; the humanizer test cites it.
- [x] `04ada8c` d17 approved (user): solutions render as they arrive — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `03a0184` d33 `copy:check` grades a keyed literal once, under its key (378 → 251 graded strings).
- [x] `0cdaa0f` d38 `withBuiltSite` (`tools/browser.mjs`) owns build, serve, launch and teardown for smoke, browser:check and visual-qa.
- [x] `337aeba` d39 ruled (user): unfreeze the `serialize.ts` + `humanize.ts` header lines in T9 and delete them (the other 8 headers + 8 sites done).
- [x] `7f7a2aa` d34 m1u5 matrix 26/26: 19 covered, 6 ported green (`tests/m1u5-port.dom.test.ts`), 1 superseded, 0 red.
- [x] `9056d3d` d41 approved (user): an owned lazy PDF.js viewer replaces the ladder's iframe (+504,727 B gzip) — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `a067cdc` d42 session proof cache: re-selection runs no meta-interpreter call; solve/consult/poison invalidate.
- [x] `db0736f` d43 approved (user): the document-first provenance browser = a third view beside the graph and its list fallback — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `bdd2ae4` d47 `pnpm queue:index` derives the queue index; `claims:check` refuses a stale one by line.
- [x] `2089c73` d35 m1u7 matrix 34/34: 16 covered, 13 ported green (`tests/m1u7-port{,.dom}.test.ts`), 5 superseded, 0 red.
- [x] `737c6d6` d55 u13's firing record names base `3c4c17c` (reproduced there: rc 1, same assertion); the phrasing census is gone from the tree.
- [x] `e0c4f1b` d56 both rows graded on their own checks: `Boot-error recovery` by `88af76b` (d21), `Boot carries no deadline` by `da39355` (d31, text corrected to `boot`).
- [x] `50b580f` d57 the `lint` bullet names `advice.ts`'s config exception and why it cannot be inline; R073 adjudicated afresh (deferred to a new grader row).
- [x] `05df8e9` d58 a registry cell may hold `\|`; claims:check re-seeds a piped copy and requires it back byte-identical.
- [x] `da89fd6` d59 `spec:check` in the gate: open rows `- [ ]`, ticked rows carry SHAs, pointer last.
- [x] `c73a1f2` d60 `--verdict` admits the reviewer role's vocabulary; waves.md names the brief's one vocabulary.
- [ ] d61 ruled (user): stay local — stays open, owed to the user (deploy + limiter).
- [x] `75e6073` d62 the selector suite plants the fixed-trigger mutant in memory and requires ORACLE-S to catch it.
- [x] `9d11b44` d63 ruled (user): declared limit — `proof.md` `Free-text intake selects` states it and `tests/census.test.ts` grades its figures; the one billed run scored A 106/121 · 106/163 and B 113/140 · 113/163 against 143/240 · 143/163 (evidence `wt/d63` `cfbe0ad`).
- [x] `4c37c0a` find: engine timing figures reworded to the bounds they guarantee, browser figures cited to `engine:probe`.
- [x] `65d9afb` find: `copy:check` refuses a component joining catalog fragments outside the declared pairs.
- [x] `bb27a1a` find: a dom test fails the proof request and reads `TEXT.traceFailure` in both locales.
- [x] `ee8c3c0` find: the wall-clock absence and `Query.close()` facts re-derived by tests.
- [x] `84a55cd` find: clause identity and the three probe traps pinned by `tests/proof-identity.test.ts`.
- [x] `5143f3e` find: the remaining package byte figures (literata spread, latin faces) pinned by the census; "eight" faces corrected to six.
- [x] `a9bf242` find: improper lists re-encode with falsy tails intact and long lists iteratively.
- [x] `5da1e02` find: hand-run mutants and probes — two committed (listbox mutant, skipped-case control), one test (TS peer cap), three historical.
- [x] `a4795fe` find: upstream and design claims disposed; `copy:check` refuses a component literal beyond the brand mark.
- [x] `d533775` find: a halting payload's build refusal names the halt and its exit.
- [x] `8a8a21e` find (dict re-encoding) ruled (user): `createEncoder` refuses a dict and fails closed.
- [x] `f862574` find (inline-disable reasons) ruled (user): unfreeze `tools/kb/provenance.mjs` in T9, give line 70 its reason, ship the grader.
- [x] `5bc686e` find (heavy-load timeouts) closed by user ruling: the measured 2.9× envelope (20/20 runs at load ≤23.5) is the bar.
- [x] `935b287` find (failed reset) approved (user): change P4.4 (`engine-recovery`) + P1.1 (`engine-budgets`); every reset boots under the deadline and retires a failed replacement.
- [x] `ce75b11` find (condition-supports dedup is scope-blind): arm 2 — every fold hiding a negation keeps a twin its own clause states unnegated.
- [x] `5fd1588` find (selected-row proof case trips `limit` under contention): frozen clock + whole-result assertion.
- [x] `d2744cb` find (B9 times cached proofs): B9 empties the cache and requires a meta-interpreter run per timed proof.
- [ ] find (five coverage passages do not locate on their recorded page): `low`, producer-owned.
- [x] `995e333` find (bundled JavaScript ships without its licence notices): `dist/licenses/third-party.txt` + the build refuses a bundled package missing from it.
- [x] `e8f7cab` find (engine:probe R41 control): a run ends at its final record; the control fires again.
- [ ] Close-2: the closing diff since `70c8507` → one `reviewer` covering every lens; `pnpm gate` on a clean tree; final report per the request's Met-when.
- [x] `aefae8c` find: a refactor staled mutant R09's anchor with the gate green → `tests/mutant-anchors.test.ts` grades every anchor in the gate.
- [x] `8c186d2` find: a heap recreation that joined an in-flight reset waited on its unbounded boot → it arms its own boot deadline.
- [x] `28c37bc` Close: 4 lenses × 2 reviewers, round-2 re-review all pass; 46/46 mutants killed under the exit-1 rule.

- Queue → `.agent/deferred.md`: each row carries its acceptance check, plus the accepted-open
  review ids, whose checks stay in `.agent/archive/review-expedited.md`.

# Phase

MAINTAIN — the whole product, free-text intake folded in.

IMPLEMENT closed twice, both ledgered in `.agent/review.md` with no open row: u3–u15 on 32/32
rows against `.agent/contracts/review-implement.md`, and u16 free-text intake (u16a–u16h) on
14/14 rows against `.agent/contracts/review-u16.md`. Unit summaries →
`.agent/archive/units-m5.md`.

Surviving evidence branches, cited by the ledger, contracts, commit bodies and queue rows —
never rename one: `wt/rev-arch` `1e89286` (A8), `wt/rev-graph` `ace618a` (G3),
`wt/rev-assurance` `5c97965` (C2); u16 red suites `wt/tester-1` `4da48b3`, `wt/tester-2`
`b9278ac`, `wt/tester-3` `7ab6142`; u16 review witnesses `wt/reviewer-3` `40fd9d6`,
`wt/reviewer-4` `897a0a6`, `wt/reviewer-5` `abf51f8`, `wt/reviewer-6` `24acbd0`,
`wt/reviewer-8` `cbb14b0`, `wt/reviewer-9` `3e21deb`; `wip/u16-review`, the per-sub-unit review
snapshots the u16 commit bodies cite.

`prototype/` never existed here. The PROTOTYPE-phase role was played by the expedited M2–M4
surfaces, shipped in place and redeveloped under M5 by user ruling, so there is no tree to
retire and no `prototype` tag to cut; `.claude/rules/stack.md` already records the carve-out.
