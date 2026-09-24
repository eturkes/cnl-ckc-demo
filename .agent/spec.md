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

- **Free-text patient intake is BUILT, and it SELECTS rules rather than composing goals.**
  Reverses the hold. The user describes a clinical situation; the demo returns the subset of
  the 48 shipped `clinical_rule/3` recommendations whose guideline conditions that description
  meets, each derived through the existing clinical path unchanged.
  - The 346 `clinical_premise` facts are **not** patient facts: 346 raw-distinct but **42
    shapes** once the per-sentence skolem is normalized, and the two commonest are pure
    universal-instantiation scaffolding present in 46 and 45 of 46 sentences
    (`guideline_cardinality(actual,_H,na,eq,1)`, `guideline_entity(actual,_H,clinician,countable)`).
    Selecting premises therefore cannot select recommendations, and **`derive/5` is not
    touched**. The archive's O4 framing — compile patient facts into `derive/5`, new engine
    surface — is measured WRONG and superseded.
  - The discriminating vocabulary is `clinical_rule/3`: **24 distinct conditions** over 48
    rules, 22 of them unconditional, 27 action modifiers, 12 document scopes. Conditions read
    as situations (`a clinician prescribes an opioid-pain-medication with a benzodiazepine`).
  - Intake is ONE judgment request — 24 condition Nouls + a scope Choice (pain type, therapy
    phase) + an `other` hatch. **No goal is composed and no new executable surface is added**:
    every derivation is an existing predicate over existing shipped records, and the answer
    set is a subset of the 48 shipped recommendations, so it cannot fabricate.
  - Refusal = hatch fired or empty match set, **never a probability threshold** — `covered`
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

- **u16 delivery bindings.** Four rulings, taken at the u16 orientation wave:
  - **Key handover = pasted in chat**, then straight to a gitignored `.dev.vars` and a
    Cloudflare secret, never a commit. **The key has not arrived yet** — the live arm is
    unfunded and every live measurement stays unrun until it does.
  - **MAIN deploys the Worker**, not commit-only. Needs `CLOUDFLARE_API_TOKEN` (Workers
    Scripts:Edit) + `CLOUDFLARE_ACCOUNT_ID`, so the committed `README.md:113` `connect-src`
    names the real origin instead of a placeholder.
  - **Layout = free text FIRST, drop-down below.** The textarea is the primary intake at the
    top of the ask flow; `QuestionCombobox` keeps its exact look and sits under it as the "or
    pick a built-in question" path. Both stay visible. This refines map-ui-1's U8, which had
    proposed a separate sibling section.
  - **Japanese = copy parity only.** `en.ts`/`ja.ts` parity as `copy:check` already enforces;
    Japanese free-text intake is NOT graded, the probe set and its gold are English, and no
    bilingual-intake claim is made either way.

- **The third outcome has no primitive that can produce it — ASK BEFORE BUILDING.** A Noul
  returns a probability alone and a Choice returns one of the options the caller supplied, so
  the ruled 24 Nouls + scope Choice cannot NAME what a description asserts that the KB has no
  vocabulary for. Inventing `unsupportedTerms` in the response parser would be the exact
  fabrication the non-negotiable forbids. Four ways out, recommendation first — deterministic
  candidate discovery from the user's OWN words then one Noul per candidate; a fixed authored
  out-of-KB vocabulary; a Choice naming the nearest COVERED concept instead; or dropping the
  naming entirely. Options + evidence → `.agent/archive/u16-wave1/index.md`.

**MAIN:** premise display = deduplicated steps inside the EXISTING ladder rungs, never a new
step type (3,930 leaves / 346 premises), carrying hypothetical origin and no source line.
u6's oracle is GREEN at base, credited RED-under-dependency-removal alone — it guards the
compiled KB, which the answer-path defect never broke. u11 graded the scope records, u12 the
projection model and u13 the shown edge; **rendered output is graded by `pnpm graph:check`
alone**, because a model-side assertion and a mocked DOM suite both survive a renderer that
shows the wrong label.

# Deferred

Queue = `.agent/deferred.md` — 58 rows, acceptance check each, plus the accepted-open review
ids, whose checks stay in `.agent/archive/review-expedited.md`. Every defect there stays
user-ruled into MAINTAIN and is **out of u16's scope**; the free-text intake row left the
queue for the u16 spine below.

The IMPLEMENT close review added the last six, each with its red witness cited by branch where
one exists: `G3` the edge-blind spanning-scope grader, `C2` three `kb:asset-check` root tables
that grade nothing when emptied, `C5` two registry rows saying `deferred` and citing no row,
`C6` u13's firing record with no base revision, `C10` two rows that may already be satisfied,
and the `gate.md` static-analysis bullet that overstates its own completeness.

u3–u15 closed, contract each in `.agent/contracts/`, close summaries in
`.agent/archive/units-m5.md`; the IMPLEMENT-close judgment review is discharged in
`.agent/review.md` with no open row.

**u16 — free-text patient intake** is the whole spine. Tier `kernel`: it decides which shipped
recommendation answers a user, so it carries the full battery. Contract →
`.agent/contracts/m5u16.md`, testable predicates written before code. Scope, bound by
`Decisions` above:

- Extract the 24 conditions, 27 action modifiers and 12 document scopes out of
  `clinical_rule/3` into a typed artifact that intake and the UI both read. Producer lives in
  `tools/kb/` and is graded like its neighbours, firing input included.
- One `JudgmentClient` seam with Jev behind it, so the whole path runs end to end under a
  deterministic stub before the key lands. **The key is not in the environment — ask for it.**
  Proxy = Cloudflare Worker; `README.md:112` `connect-src` gains the Worker origin; `wrangler`
  needs Node 22, which `engines` already permits and which belongs in its own deploy job so
  the secretlint-capped gate job stays on 20.19.0.
- Three outcomes distinct on screen, the third naming what the description asserts that the KB
  has no vocabulary for.
- A held-out probe set with its gold committed, plus the forced-arm control — hatch removed —
  which must fire. The existing n=19/n=12 numbers are feasibility signals on MAIN-authored
  phrasing, never accuracy estimates, and do not transfer to this larger answer space.
- `.claude/rules/proof.md` gains the premise-scaffolding / condition-discriminator law this
  unit proves. It is deliberately NOT written ahead of the build.

**u16 progress: orientation only, nothing built.** The wave ran and was harvested; the session
wound down before the contract. Resume from `.agent/archive/u16-wave1/index.md`, which carries
the roster, the four rulings, the blocking gap, the still-owed inputs and the resume order;
its two `res` reports hold the Worker and Jev code sketches verbatim. The three `map` reports
stay uncommitted at `.scratch/agents/map-{ui,kb,close}-1.md` because they re-derive from the
tree. Measured there, independently of the figures above and agreeing with them:
`clinical_rule/3` is **not a bag member** — `tools/kb/clinical.mjs:631-638` derives all 48
facts — and the vocabulary is 24 distinct conditions / 26 occurrences / 22 unconditional, 27
distinct modifiers / 74 occurrences, 12 document scopes.

Resume order: settle the third-outcome gap with the user and collect the key plus the
Cloudflare inputs → write `.agent/contracts/m5u16.md` → producer, `JudgmentClient` under the
stub, Worker, UI, probe set with its forced-arm control → `rev` per lens → `Phase: MAINTAIN`.

The `pri` high **Browser WASM abort** row stays gated and does **not** unblock here: it needs a
runaway `assertz` to abort the runtime, and this design composes no goal, so the abort stays
unreachable. Reaching it still requires the ad-hoc goal path that `Decisions` declines.

# Phase

IMPLEMENT.

Reopened from MAINTAIN by user ruling. Free-text patient intake is product work under full
Engineering law — new executable UI surface, a third-party judgment dependency and a deploy
target — not a maintenance request, so it runs as an IMPLEMENT phase with u16 as its only
unit. Everything the prior close established stands as the baseline and is not re-derived:
the gate, the contracts, CI, the scanners and the shipped surfaces are done, so the IMPLEMENT
arc resumes at its unit step.

The prior close, which remains the baseline: the `rev` judgment review closed the first
IMPLEMENT pass — 32 of 32 rows adjudicated in `.agent/review.md`
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
