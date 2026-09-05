# Ledger — expedited-surface evaluation

Adjudication of `.agent/contracts/expedited.md` (25 fixed rows, `+` rows added
inside a lens) against `5ed81a3..a944fca`. Evaluated at base `61028f5`.

Method: MAIN probed independently while four reviewers adjudicated the same
contract in isolated worktrees, diff-blind to MAIN's findings and to each other.
Agreement between MAIN and a reviewer = **independent confirmation** (council
rule). Where verdicts differ in severity, the higher stands — each is
evidence-backed and the lower one saw less.

Reviewer reports → `.agent/review-expedited/`. Every reviewer's probes are
committed on its own branch, retained as citable evidence, each tip clean at
harvest: `wt/rev-arch-1` `d0584cb`, `wt/rev-sem-1` `f2644a3`, `wt/rev-sem-2`
`379072e`, `wt/rev-claim-1` `b9d8d77`. The probes are intentionally RED against
`main` — they encode the acceptance checks that close their rows, so each one
turns green exactly when its defect is fixed.

## Verdict summary

| lens | rows | pass | fail | high | med | low |
| --- | --- | --- | --- | --- | --- | --- |
| A — architecture | 11 | 2 | 9 | 2 | 6 | 1 |
| S — semantic behavior | 22 | 6 | 16 | 8 | 8 | 0 |
| C — assurance claims | 13 | 3 | 10 | 6 | 3 | 1 |
| **total** | **46** | **11** | **35** | **16** | **17** | **2** |

The contract's authority-1 line — *"the answers must reflect real Prolog
execution, never hard-coding"* — is **breached**. S1 and S3 are the load-bearing
rows: the shipped answer is computed at build time and stored as a fact, and the
displayed proof is a build-time record replayed, not a derivation. **Three
independent probes agree** — MAIN's `probe-kb-independence`, `rev-sem-1`'s
`tests/review-answer-proof-binding.test.ts`, and `rev-arch-1`'s
`tests/review-register-schema-binding.test.ts`, the last raised unprompted from an
architecture lens against a contract row it was not assigned. All three retract
every `guideline_*` clause and observe the answer *and* the proof unchanged.

## A — architecture (`rev-arch-1`)

| row | verdict | finding | evidence |
| --- | --- | --- | --- |
| A1 | fail(med) | Cached builds trust manifest-authorized bytes instead of re-deriving from the verified bag. | `tools/kb/build.mjs:69`; `tools/review-probes/a1-cache.test.mjs` |
| A2 | pass | Seven declared topic/source sets re-derive from the verified bag; a missing selected ACE source aborts the build. | `tools/kb/clinical.mjs:18`; `tests/questions-live.test.ts` |
| A3 | fail(high) | The byte-equivalence guard runs **before** grouping and term emission, so changed answer modality still builds. A3 requires the guard to bind what the answer *says*. | `tools/kb/clinical.mjs:261,325`; `tools/review-probes/a3-answer-equivalence.test.mjs` |
| A4 | fail(med) | Import graph is acyclic, but `.svelte` components still select proof documents and join semantic lines — semantics in the component layer. | `src/provenance/ProvenanceLadder.svelte:25`; `tools/review-probes/a4-component-semantics.test.mjs` |
| A5 | fail(med) | A 3,138,829 B worker boots before user activation (A5 caps pre-activation load at 1 MB); memory retained the pre-range 14-file inventory. | `src/demo/DemoController.svelte.ts:119`; `pnpm browser:check` |
| A6 | fail(med) | Engine-native terms are decoded, but both worker consumers trust TypeScript-cast messages with no runtime validation at the consumer. | `src/engine/client.ts:118`; `tests/review-a6-worker-validation.test.ts` |
| A7 | pass | Two forced builds produced identical hashes for all 343 recorded assets across every generated class. | `pnpm kb:reproduce` |
| A8 | fail(high) | Not fail-closed: malformed alignment survives asset parsing, and a query emitting stderr still returns a successful solution. | `src/provenance/model.ts:85`; `src/engine/session.ts:307`; `tests/review-a8-fail-closed.test.ts` |
| A9+ | fail(med) | The QLF fallback and the clause index add 4.08 MB of generated work with no runtime or shipped consumer — the worker references only the PVM and neither asset enters `dist`. | `src/engine/worker.ts:7`; `tools/review-probes/a9-dead-assets.test.mjs` |
| A10+ | fail(low) | Overlapping build APIs derive the full provenance model three times instead of sharing one immutable result. | `tools/kb/build.mjs:61`; `tools/review-probes/a10-duplicate-derivation.test.mjs` |
| A11+ | fail(med) | Pages deploys after the deterministic gate but bypasses `kb:reproduce` and the real-browser release checks — the two checks that back the byte-identity and browser claims. | `.github/workflows/pages.yml:27`; `tools/review-probes/a11-release-workflow.test.mjs` |

## S — semantic behavior (MAIN, `rev-sem-1`, `rev-sem-2`)

| row | verdict | source | finding | evidence |
| --- | --- | --- | --- | --- |
| S1 | fail(high) | MAIN + `rev-sem-1` + `rev-arch-1` | **The answer never consults the KB.** `tools/kb/clinical.mjs` parses `ace/*.ace` at BUILD time, emits finished `clinical_advice/3` facts, and `paths.mjs:payloadSource` appends them to the image; the runtime goal is a fact lookup. Retracting every clause of all seven `guideline_*` predicates (`guideline_entity/4` → 0 clauses) leaves the rendered answer **byte-identical**. | `probe-kb-independence`; `tests/review-answer-proof-binding.test.ts:67`; `tests/review-register-schema-binding.test.ts`; `tools/kb/clinical.mjs:481`; `tools/kb/paths.mjs:28-38` |
| S2 | fail(high) | MAIN + `rev-sem-1` + `rev-sem-2` | **Polarity and modality are dropped, producing the clinical inverse.** `cdc2022-opioid-rec01` s3 reads *"If an opioid-benefit does **not** outweigh an opioid-risk then every clinician should **not** consider an opioid-therapy for an acute-pain"*; the shipped `answerSubgraph` highlight is `outweigh→opioid benefit`, `outweigh→opioid risk`, `outweigh —condition supports→ consider`, `consider→clinician`, `consider→opioid therapy`, `consider —for→ acute pain`. Both negations gone. Answer TEXT preserves them, so the two surfaces contradict each other. `rev-sem-1` independently found the same loss on the proof and compiled-clause surfaces. | `probe-answer-graph`; `tests/graph-semantics.review.test.ts:18`; `tests/review-answer-proof-binding.test.ts:96`; `src/graph/model.ts:isConceptRelationship` |
| S2b+ | fail(med) | MAIN | Census, not a one-off: 156 negation contexts and 857 `should` contexts exist as `operator-context` nodes; the concept predicate excludes every one — `operator` edges and non-`condition supports` `implies` edges are filtered, and `operator-context` is absent from `CONCEPT_NODE_KINDS`. | `probe-negation.mjs`; `src/graph/model.ts:CONCEPT_NODE_KINDS` |
| S3 | fail(high) | MAIN + `rev-sem-1` | **The proof is a build-time record, not a derivation.** `derive(clinical_advice(Q,S,A),_,P,proved) :- !, ... advice_nodes(Sites,P)` cuts before any resolution and emits `node(line(L),H,[])` from `site/2` entries computed at build time. Shipped question 1 yields 3 steps, all `guideline_operator/3`, all 0 children. `resolve/3` is never reached by any shipped question. Every displayed proof survives removal of the clauses it claims participated. | `tools/kb/proof.mjs:31-39`; `probe-proof-steps`; `tests/review-answer-proof-binding.test.ts:80` |
| S3b+ | fail(med) | MAIN | Proof step heads are not the compiled clauses. `groundHead` rewrites variables to `'clinical_variable_N'` atoms, so the displayed head reads `...box(1),[clinical_variable_0])` where the payload clause at that line reads `...box(1),[A])`. S3 requires head equality. | `tools/kb/clinical.mjs:groundHead`; `probe-proof-steps` |
| S3c+ | fail(med) | MAIN + `rev-sem-1` | Recorded site is the wrong clause. `sourceClauses` keeps the FIRST `guideline_` line per controlled sentence, which for a conditional sentence is the modal operator clause. The proof for "clinicians should maximize nonopioid therapy" cites three operator clauses, none of which mentions maximizing or nonopioid therapy. This is also the mechanism behind S2 on the proof surface: for `cdc2022-opioid-rec01` s3 the retained first clause encodes the *negative antecedent context*, so the clauses carrying `should` and `consider` never reach either evidence surface. | `tools/kb/clinical.mjs:393-417`; `probe-proof-steps` |
| S4 | pass | `rev-sem-1` | Every statement maps only to live rows whose Source and Answer document identifiers agree. | `tests/review-answer-proof-binding.test.ts` (`S4 maps`); `tests/demo-controller.dom.test.ts:313-327` |
| S5 | fail(high) | `rev-sem-2` | Displayed action edges discard modal, negative, conditional and numeric scope, so they are not the assertions the source makes. | `tests/graph-semantics.review.test.ts:27`; `src/graph/model.ts:350` |
| S6 | pass | `rev-sem-1` | All evidence chunks re-derive from bag text; code-point slices and paired input groups validate. | `pnpm kb:asset-check`; `tests/kb-derived-assets.test.ts`, `provenance-model.test.ts`, `provenance-ladder.dom.test.ts` |
| S7 | fail(med) | `rev-sem-1` | A missing proof-line clause renders zero clauses and **continues into unbound evidence** rather than reaching an explicit failure state. | `tests/provenance-ladder.dom.test.ts:134`; `src/provenance/ProvenanceLadder.svelte:43` |
| S8 | pass | `rev-sem-1` | The UI states the catalog is fixed, and each prepared topic selects source-aligned clauses — S8's disclosure branch is satisfied. | `tests/about-copy.dom.test.ts`; `src/demo/copy.ts:35-36`; `src/demo/AboutPanel.svelte:35` |
| S9 | fail(med) | MAIN + `rev-sem-2` | Labels miscount. `hiddenTechnicalNodes`/`hiddenTechnicalEdges` are rendered as "parser or provenance nodes … lower-level relationships" but count `evidence.nodes - reachable concept component`, lumping dropped negation operators in with scaffolding — shipped copy calls a sentence's polarity a parser node. Separately, the headline count calls 1,288 nodes "concepts/actions" while 53 are value/attribute nodes the same view labels as attributes. | `src/graph/SemanticGraph.svelte:299,346-347`; `tests/graph-semantics.review.test.ts:35` |
| S10 | pass | `rev-sem-1` | No-proof, limit, cancellation and error retain distinct protocol variants and visible terminal labels. | `tests/demo-controller.dom.test.ts:218-286`; `tests/proof-live.test.ts:178-183,229-258` |
| S11+ | fail(med) | `rev-sem-2` | Nested `guideline_operator` edges replace their asserted outer context with the document node, breaking endpoint and scope fidelity. | `tools/kb/graph.mjs:262`; `tests/graph-semantics.review.test.ts:45` |
| S12+ | fail(high) | `rev-sem-2` | A Horn rule with a negated premise **and** a negated recommendation is synthesized as a positive `outweigh → consider` support edge. | `tools/kb/graph.mjs:398`; `tests/graph-semantics.review.test.ts:57` |
| S13+ | fail(med) | `rev-sem-2` | The runtime parser accepts predicate-role-invalid edges, then the concept projection silently drops them instead of failing closed. | `src/graph/model.ts:220`; `tests/graph-semantics.review.test.ts:76` |
| S14+ | fail(high) | `rev-sem-2` | The primary projection deletes operator/cardinality scope but **retains dependent action edges**, turning qualified relations into unconditional ones. | `src/graph/model.ts:350`; `tests/graph-semantics.review.test.ts:31` |
| S15+ | fail(high) | `rev-sem-2` | The answer highlight uses a direct positive event edge that bypasses both hidden negation contexts, so its displayed path is not source-faithful. | `src/graph/model.ts:714`; `tests/graph-semantics.review.test.ts:87` |
| S16+ | pass | `rev-sem-2` | All 12 prepared contribution roots stay inside cited evidence entities; lexical and semantic-role ranking never promotes an external central node. | `src/graph/model.ts:627`; `tests/graph-live.test.ts:87` |
| S17+ | fail(high) | `rev-sem-2` | Bounded ontology neighborhoods systematically omit scope-bearing modality/cardinality context and disclose only size caps, never changed meaning. | `src/graph/model.ts:844`; `src/graph/SemanticGraph.svelte:444` |
| S18+ | fail(med) | `rev-sem-2` | Canvas arrows retain edge direction, but HTML navigation reuses forward labels at target nodes and reverses the asserted relation. | `src/graph/model.ts:1063`; `tests/graph-semantics.review.test.ts:98` |
| S19+ | pass | `rev-sem-2` | All 12 prepared answer highlights select representatives from the cited document and controlled-sentence set; broader context stays unhighlighted. | `src/graph/model.ts:680`; `tests/graph-semantics.review.test.ts:120` |
| — | pass | MAIN | **Answer RENDERING is faithful.** `clinical.mjs:parseAdviceSentence` rebuilds every accepted sentence byte-for-byte and fails the build otherwise; `advice.ts` preserves condition, modality, negation and every action component, with the exact passage as fail-closed fallback. The defect is the absent derivation, not the wording. | `tools/kb/clinical.mjs:parseAdviceSentence`; `src/questions/advice.ts:renderAction` |
| — | context | MAIN | **Real inference is feasible.** Bare KB: `guideline_operator(actual,C,should)` and `guideline_event(C,E,maximize)` both fail. Assert one hypothetical clinician entity + cardinality, and `should` operators, `maximize` events (7), `nonopioid-therapy` entities (3) and the full operator→event→arg→entity join all derive from the compiled clauses. | `probe-inference-feasibility` |

## C — assurance claims (MAIN + `rev-claim-1`)

| row | verdict | source | finding | evidence |
| --- | --- | --- | --- | --- |
| C1 | fail(high) | `rev-claim-1` | Build totals, reproduction, gate, smoke and browser runs replay; "live re-proof / exact proof path", the independent answer oracle, visual inspection and several current memory claims do not. | `pnpm gate`; `pnpm kb:reproduce`; `pnpm smoke`; `pnpm browser:check`; `tools/kb/proof.mjs:31-37`; `.agent/memory.md:120,237,243,386-420,524` |
| C2 | fail(high) | MAIN + `rev-claim-1` | **Checks retired without record.** All 11 gate steps and 16 baseline test files remain, but the byte-exact `queries/answers/*.pl` oracle (`toBe(committedResult(id))`, all four exported ids), `catalog.mjs`'s `EXPORTED` declared-question guard, the schema overlay, the existence/count contracts and the independent browser answer oracle were silently dropped. Nothing now reads the bag's `queries/` tree — the strongest real-execution evidence the project had is unreferenced. | `git show 5ed81a3~1:tests/questions-live.test.ts:185-204`; `git show 5ed81a3~1:tools/kb/catalog.mjs`; `git diff -U0 5ed81a3~1..a944fca -- tests/ tools/ package.json` |
| C3 | fail(high) | MAIN + `rev-claim-1` | **The non-negotiable lost its mechanical binding.** The only overlay mutates derived `clinical_advice/3` — the very predicate queried — asserts only that the serialized answer changed, perturbs no `guideline_*` predicate and never requires the line-keyed proof to change. It stays green under the S1 defect. M1's recorded recipe required a whole new proof through four schema predicates. | `tests/questions-live.test.ts:257-277`; `.agent/memory.md` overlay-probe entry |
| C4u1 | fail(med) | `rev-claim-1` | u1 `Accept:` unmet — no differential reference and no ported 15-green/84-red hostile fixture corpus exists; only narrow local parser mutations run. | `tests/provenance-model.test.ts:5-48` |
| C4u2 | pass | `rev-claim-1` | u2 `Accept:` holds — all 343 generated assets reproduced byte-identically, the runtime validator rejected drift, and browser checks fetched one chunk plus its PDF page. | `pnpm kb:reproduce`; `pnpm gate`; `pnpm browser:check` |
| C4u3 | fail(high) | `rev-claim-1` | u3 `Accept:` unmet — cap-one parity and budgets pass for 7 topics, but **0/4 committed trace oracles run** and the required `guideline_*` answer-plus-proof overlay is absent. | `tests/proof-live.test.ts:1-3`; `tests/questions-live.test.ts:257-277`; `pnpm test` |
| C4u4 | fail(high) | `rev-claim-1` | u4 `Accept:` unmet — deletion alone has an explicit load error; duplicate lines, wrong pages, unresolved proof lines, bad offsets and answer-oracle reach lack the required fail-closed mutation checks. | `tests/review-claim-replay.dom.test.ts`; `src/provenance/model.ts:78-163` |
| C4u5 | fail(med) | `rev-claim-1` | u5 `Accept:` partly unmet — selection re-proves once and stale completion is suppressed, but only 1/6 required state classes receives a DOM-plus-axe check. | `tests/demo-proof-controller.test.ts:104-168`; `tests/provenance-ladder.dom.test.ts:64-145` |
| C4u6 | pass | `rev-claim-1` | u6 `Accept:` holds — code-point text round-trips exactly, pointer and keyboard activate the same paired group, and both projection and `unreviewed` disclosures render adjacent to the passage. | `tests/review-claim-replay.dom.test.ts`; `src/provenance/ProvenanceLadder.svelte:218-243` |
| C4u7 | pass | `rev-claim-1` | u7 `Accept:` holds — the real nested-host browser run observed no PDF or passage request before activation, both after, the physical-page fragment, and zero nested 404 / page errors. | `pnpm browser:check` (rc=0; eight 320px states) |
| C5 | fail(med) → **fixed** `93cda83` | MAIN + `rev-claim-1` | Recorded measurements drifted. Roadmap 343 assets, 2,901/20,964 graph and 293/25 tests matched; `.agent/memory.md` was stale at PVM 437,132→444,283 B, QLF 2,168,708→2,199,577 B, Horn 9,053→9,804, catalog 6→7, and `dist` 14 files / ~3.77 MB → 355 files / 21,874,052 B (343 manifest assets). Every replacement figure was re-derived by MAIN, not copied from a report. Two memory claims that the same range had falsified were corrected with them: the `queries/answers/*.pl` oracle entry (retired, C2) and the anti-hard-coding recipe entry (weakened, C3). The root cause — no mechanical owner for these figures — stays open in `.agent/polish.md`. | `jq '.assets\|length' kb/generated/kb-manifest.json`; `du -sb dist`; `stat -c %s kb/generated/kb.pvm` |
| C6 | fail(low) | MAIN + `rev-claim-1` | Commit subjects miss `<scope>: <cause> → <fix>`. MAIN counts 4/10 (`refine answer presentation`, `fix: make answer graph concept-first`, `fix: focus graph on cited answer evidence`, `feat: derive concise clinical answers from Prolog clauses` — the last also asserts a derivation that does not happen); `rev-claim-1` counts 5/10 evaluated. Both agree the convention is breached; the count differs by one borderline subject. | `git log --format='%h %s' 5ed81a3^..a944fca` |
| C7 | fail(high) | MAIN + `rev-claim-1` | **Claim scope exceeds evidence scope in shipped copy.** `ProvenanceLadder.svelte:152` — "The engine re-ran the selected source contribution through its bounded proof"; `:113` — "N source clauses re-proved this part of the answer live"; `copy.ts` lede — "Every answer is proved live in the browser"; `README.md:7` — "The shipped answers are produced at run time." All four are false under S1/S3. Byte-identity and browser claims do rest on matching runs; smoke reuses the producer as its own oracle; visual inspection has no rerunnable evidence. | `src/provenance/ProvenanceLadder.svelte:109,113,152-153`; `src/demo/copy.ts:25-27`; `src/demo/AnswerPanel.svelte:70`; `README.md:7`; `tools/kb/proof.mjs:31-37`; `tools/smoke.mjs:29-52` |

## Register — outside the contract

- **Two tests time out under parallel execution.** `pnpm test` passed 291/293 with
  two 5-second timeouts (`V11 has zero axe`, `fails kb:asset-check on a static
  import`); both pass rerun in isolation. Order/parallelism sensitivity, not a
  broken suite — but a flaky gate erodes every claim the gate carries. Deferred to
  `.agent/polish.md` with its acceptance check.
- **Recorded measurements have no mechanical owner** (C5's root cause). The prose
  rule to re-derive them existed and was not followed. Deferred to
  `.agent/polish.md`; all three answer-path options need it either way.
- **`rev-arch-1` raised S1 unprompted** as its own register item `R-S1`, from an
  architecture lens, against a row it was not assigned and without sight of MAIN's
  or `rev-sem-1`'s findings. Its acceptance check is the same one all three
  probes encode: deleting support must change both the projected answer and the
  line-keyed proof. Recorded here because the convergence is itself evidence —
  three lenses reached S1 by three different routes.
- **No finding was raised against the accepted surface.** Visual design, layout,
  colour, type, spacing, motion, component composition, affordance placement,
  disclosure/interaction structure and the chat-style answer presentation were
  out of scope by user instruction and were not adjudicated. No option below
  requires changing any of them.

## Probe regeneration

MAIN's probes live scratch-local as `.txt` so the gate never collects them. Rerun:
copy into `tests/`, drop the `.txt`, `npx vitest run --project node tests/<f>.test.ts`,
then move it back out. Each needs `kb/generated` built (`pnpm kb:build`).

| probe | proves |
| --- | --- |
| `.scratch/probe-kb-independence.test.ts.txt` | answer is byte-identical after every `guideline_*` clause is retracted |
| `.scratch/probe-proof-steps.test.ts.txt` | shipped proof steps: 3 nodes, 0 children, mangled heads, operator-only sites |
| `.scratch/probe-answer-graph.test.ts.txt` | `answerSubgraph` output for the negated recommendation |
| `.scratch/probe-inference-feasibility.test.ts.txt` | bare KB proves no recommendation; one asserted clinician makes the full join derive |
| `.scratch/probe-negation.mjs` | census: 156 negation contexts, 857 `should` contexts, all dropped by the concept predicate |

Reviewer probes are committed on their own branches: `wt/rev-arch-1`
(`tools/review-probes/a*.test.mjs`, `tests/review-a6-*`, `tests/review-a8-*`,
`tests/review-register-schema-binding.test.ts`), `wt/rev-sem-1`
(`tests/review-answer-proof-binding.test.ts`), `wt/rev-sem-2`
(`tests/graph-semantics.review.test.ts`), `wt/rev-claim-1`
(`tests/review-claim-replay.dom.test.ts`). Recover any of them with
`git show wt/<name>:<path>`; the worktrees themselves are removed.

Port target: `probe-kb-independence` is the anti-hard-coding gate C3 says is
missing. It is red today, so it stays out of `pnpm gate` until M5 u1/u2 fix the
answer path, then **M5 u3 lands it as the binding regression test**.
`rev-sem-2`'s `tests/graph-semantics.review.test.ts` is the same shape for M5 u4.

## Rulings — closed

Four direction choices, all ruled by the user. The ledger's verdicts are final;
these decide what happens about them.

1. **Answer path = derive by real inference.** Each question compiles its clinical
   context into explicit premises; the answer derives through the `guideline_*`
   clauses. Rationale on the record: a guideline is universally quantified over
   clinicians and the `actual` world holds no clinician instance, so
   `guideline_operator(actual,C,should)` failing on the bare KB is **correct**
   — supplying the instance is how a universal gets applied, not a workaround.
   Feasibility measured by `probe-inference-feasibility`. → M5 u1, u2.
2. **Graph polarity = edge state.** Keep the concept-first projection the user
   accepted; carry negation and modality on the edges. No `operator-context` node
   returns to the concept view. This **amends** M3's original line *"Event and
   operator-context nodes stay; noun→noun collapse is forbidden"*, which predates
   the concept-first design and assumed nodes were the only way to carry scope.
   The roadmap contradiction — that line versus the expedited block's *"hides
   parser/modality scaffolding"* — resolves in favour of hiding the scaffolding
   AND keeping the meaning. → M5 u4.
3. **Milestone status = M2/M3/M4 keep their COMPLETE markers**; one new milestone
   owns the remediation. They are marked built-and-shipped, not adjudicated-sound,
   and the roadmap header says so. → M5 opened, PLANNING.
4. **Scope = the non-negotiable plus the graph.** Nine rows carry as named M5
   scope: S1, S3, S3b+, S3c+, S2, S5, C2, C3, C7.

   Seven more close as a **consequence**, because they are the same defect
   decomposed and u4's acceptance check ("every edge shown asserts a relation the
   KB asserts, with the same scope; no sentence renders as a claim the source
   denies") cannot pass while they stand: S2b+, S11+, S12+, S14+, S15+, S17+,
   S18+. They are not separate work; they are how the fix gets graded.

   **Accepted-open**, each keeping its acceptance check here: A1, A3, A4, A5, A6,
   A8, A9+, A10+, A11+, S7, S13+, C1, C4u1, C4u3, C4u4, C4u5, C6. **S9 partially
   closes** — its "hidden technical nodes" miscount resolves once u4 stops
   dropping polarity, but the headline "1,288 concepts/actions" including 53
   value/attribute nodes is untouched and stays open. **C4u3 partially closes** —
   u3 restores the `queries/answers/` byte oracle, but the four `queries/traces/`
   oracles are a different artifact and stay open. C5 is fixed at `93cda83`; the
   register's two entries live in `.agent/polish.md`.

Standing constraint on all of it: visual design, layout, colour, type, spacing,
motion, component composition, affordance placement, disclosure/interaction
structure and the chat-style answer presentation are **accepted and out of
scope**. M5 changes what the surfaces mean, never how they look. A remediation
that forces a visual difference stops and asks.
