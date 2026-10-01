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
  whose identity binds at query time. u11 measured them and could close the gap with 71 added
  body edges; the ruling is to leave the shipped edge population untouched at 20,964 total /
  1,193 operator. u11's S3 is therefore ONE-WAY: every operator-bearing edge resolves to
  exactly one scope record, an unreferenced record is legal, and the unreferenced count is
  pinned so it cannot drift. Queued in `.agent/deferred.md`.
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

- [x] `24bbb5d` d0 find: 4 live advisories reddened `audit:check` → lockfile bump.
- [x] `b919283` d2 browser lanes steer by `data-action` handles, narrow sweep in both locales.
- [x] `6c77126` d4 `pnpm readme:check`: README setup path from a clean clone, in `release:check`.
- [x] `b6f2a54` d7 `claims:seed` keys on a full-claim digest; `claims:check` refuses a stale digest.
- [ ] d10 blocked: owes the user's reading of "ships no bytes"; work parked on `wip/d10-fallback`.
- [x] `5af7982` d13 `tools/validate-report.mjs`: committed port, escaped pipe = content.
- [ ] d14 blocked behind d29: real heap exhaustion aborts in Node too at swipl-wasm 8.0.7; live harness committed, `limit: 'heap'` read owed.
- [x] `060c0f7` d18 u4 suite ported: 4 merged green, 3 covered, 1 input retired (P1.10 held by T13).
- [x] `e78551f` d16 `browser:check` kills a hostile goal by the client deadline; one respawn reports 337 documents.
- [x] `07899e0` d19 closed on its own check: archived `m1u4.md` D6 records why `query_sha256` stays out of the runtime; the export lane re-derives the whole envelope.
- [ ] d21 fix parked on `wip/d21-boot-retry` (retire the worker after a failed boot): tester-d21 + review pending.
- [x] `34e791b` d23 V13 axe sweep: About panel + canonical answer, open and closed.
- [x] `3f76af8` d24 `copy:check` walks `src/` and grades every component's literal prose.
- [ ] d25 fix on `wip/d25-inference` (whole-request inference meter): review round 1 found the trailing-failure gap.
- [x] `9d1eecb` d26 smoke refuses a build stale against the bag's input digest.
- [x] d11 u2 suite ported: 16 merged green, 20 covered, 2 red → rows (d12 float, new find improper-list tail).
- [ ] d29 `high` WASM abort — waits: an ad-hoc goal path (`Decisions` MAIN).
- [ ] `med`: d27 d30 d31 d32 d36
  d37 d40 d44 d45 d46 d48 d49 d50 d51 d52 d53 d54
- [ ] `low`: d1 d3 d5 d6 d8 d9 d12 d15 d17 d20 d22 d28 d33 d34 d35 d38 d39 d41 d42 d43 d47
  d55 d56 d57 d58 d59 d60 d61 d62 d63
- [ ] Close: closing diff → every `reviewer` lens; `pnpm gate` on a clean tree.

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
