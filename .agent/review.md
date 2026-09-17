# Review ledger — IMPLEMENT

Adversarial-review rows for the IMPLEMENT phase. **Closed: all 32 rows adjudicated, none
open.** 20 `pass`, 6 `n/a: deferred`, 1 `fail` fixed in place (`A8`) and 5 `fail` deferred by
user ruling, each with a `.agent/deferred.md` row carrying its acceptance check and, where one
exists, its red witness cited by branch. The u3-u10 pass the phase owed is discharged here: the user ruled this review
reads the SHIPPED SURFACE at close, so those units are adjudicated through the surface they
left behind and there is no separate history pass.

Five `rev` teammates, one per lens, each diff-blind in its own worktree — `rev-arch` (A),
`rev-semantic` (S), `rev-graph` (G), `rev-assurance` (C1-C5) and `rev-assurance-2` (C6-C10).
MAIN held `tools/secret-check.mjs`, `audit:check` and the ESLint security layer itself, so no
`gpt-5.6-sol` context ingested scanner vocabulary. C6, C7 and C8 were graded twice
independently; every disagreement is recorded in the row that resolves it.

Method, termination rule and the two-tier report shape → `CLAUDE.md` `Engineering`.
Wave mechanics → `.claude/rules/waves.md`.

Rows carry `| id | verdict | source | finding | evidence |`; a verdict opens `pass:` or
`fail(low|med|high):`. A ruling holds until new evidence reverses it. Findings bind to the
unit's acceptance contract in `.agent/contracts/`; anything outside it reports as a register
entry and becomes a `.agent/deferred.md` row or expires with the report.

The expedited-surface ledger this one succeeds — 46 rows, 11 pass / 35 fail, and the four
user rulings that opened the current unit set — is `.agent/archive/review-expedited.md`. The
M1 judgment ledger is `.agent/archive/review-m1.md`; it carries its own per-unit tallies,
which disagree with its row table, and nothing live depends on the total.

## Rows

Seeded from the fixed 32-row check set in `.agent/contracts/review-implement.md` — A architecture 8, S semantic 8, G graph 6, C assurance 10. The set is fixed BEFORE the diff is read, which is what makes the review terminate; every row is adjudicated and the count of rows adjudicated is the deliverable, so an all-`pass` table is a complete review. A row whose verdict cell is still the seeded placeholder is unadjudicated and blocks
the phase close, so `command grep -c '^| [A-Z][0-9]* | unknown' .agent/review.md` is the
progress counter and reads 32 at seed.

| id | verdict | source | finding | evidence |
|---|---|---|---|---|
| A1 | pass | tools/kb/check.mjs:21 | 343 generated assets all derive from the verified bag; six declared scan roots bind their paths and refuse absence. | `pnpm kb:asset-check` rc 0, 343 assets / 6 roots, control fired · rev-arch |
| A2 | pass | tools/kb/check.mjs:43 | No shipped or build surface reaches `../cnl-ckc`; the vendored bag is the whole interface. | sibling scan rc 1 with package-name positive control rc 0 · rev-arch |
| A3 | n/a: deferred | .agent/deferred.md:350 | Components still select proof documents and join semantic lines. Subject of accepted-open `A4`, acceptance check retained. | `/usr/bin/rg -Fn 'const documentId =' src/provenance/ProvenanceLadder.svelte` → :44 · MAIN rematched |
| A4 | n/a: deferred | .agent/deferred.md:192 | Both worker consumers trust typed `event.data`; 1 of 12 protocol arms is clone-tested. Accepted-open `A6` plus its own queue row. | `/usr/bin/rg -Fn 'const response = event.data' src/engine/client.ts` → :122 · MAIN rematched |
| A5 | n/a: deferred | .agent/deferred.md:350 | Query and proof paths never drain diagnostics. Subject of accepted-open `A8` (`fail(high)`), acceptance check retained. | `#failClosed(` at src/engine/session.ts:264,:514,:652 only · MAIN rematched |
| A6 | n/a: deferred | .agent/deferred.md:350 | The 3,139,261 B worker boots during controller construction, before user activation. Subject of accepted-open `A5`. | `/usr/bin/rg -Fn 'void this.#boot();'` → src/demo/DemoController.svelte.ts:124 · MAIN rematched |
| A7 | pass | tools/kb/reproduce.mjs:34 | Two forced builds emit identical manifests and hashes across all 343 assets in seven kinds, from committed state. | `pnpm kb:reproduce` rc 0; firing control perturbed one second-manifest digest and fired · rev-arch |
| A8 | fail(med) → fixed | src/questions/catalog.ts:47 | `tools/kb/catalog.mjs:22` emits `catalogVersion: 3`; the sole reader consumed `entries` and accepted any version. Fail-open seam. | `tests/review-a8-schema-version.test.ts` 1/1 RED at `wt/rev-arch` `1e89286`; `catalogVersion` absent from the reader, MAIN-confirmed |
| S1 | pass | tests/clinical-binding.test.ts:130 | Erasure discriminates a live derivation from a replayed answer: the current arm loses exactly the cited document, the archived arm is unmoved. | `pnpm binding:replay` archived 12→12 RED, current 12→11, rc 0 · rev-semantic |
| S2 | pass | tests/clinical-binding.test.ts:190 | The displayed proof is derived, not replayed — a historical build-time producer cannot match the live clause derivation after a line shift. | `clinical-binding` E3 RED under the `1ee4117` producer; current 3/3 green · rev-semantic |
| S3 | pass | tests/clinical-records.test.ts:259 | Exact source antecedents compile to ground premises and are REQUIRED: withholding them yields 0 of 12 complete documents. | records + inference + gate-live suites 24/24, rc 0 each · rev-semantic |
| S4 | pass | tests/provenance-ladder.dom.test.ts:183 | Five leaves render as two assumed, lineless premises inside the existing rungs; the six ladder rungs stay clause-only. No new step type. | C1/C2/C3 RED with the Set dedup removed; ladder suite 6/6 green · rev-semantic |
| S5 | pass | src/provenance/ProvenanceLadder.svelte:177 | Live proof, compiled clause, source passage and assumed premise carry separate labels in both locales. | Japanese DOM probe green; ladder 6/6 + questions-live 20/20 · rev-semantic |
| S6 | pass | tests/clinical-proof-live.test.ts:96 | Displayed provenance resolves through the compiled clause to the bag's ACE sentence at the line named — 496/506/517 → S2/S3/S4. | `clinical-proof-live` 7/7 + `kb-derived-assets` 7/7; 337-document ACE-marker census, 0 failures · rev-semantic |
| S7 | pass | tests/demo-controller.dom.test.ts:597 | Cancelled and rejected runs reach an unbusy terminal state; a superseded rejection leaves the live run intact. | `demo-controller.dom` 30/30 + transition oracle 4/4, rc 0 · rev-semantic |
| S8 | pass | src/i18n/en.ts:71 | Shipped copy states quotation, derivation and heuristic at their delivered strength — source says guideline wording, proof says derived again, graph focus says ranked mechanically. | `/usr/bin/rg -Fn` anchors en:71/78/100 + ja:96; `copy:check` rc 0 · rev-semantic |
| G1 | pass | src/graph/model.ts:572 | Concept nodes exclude operator contexts; edge scope drives label and dash. Polarity is edge state, per the user ruling. | `graph-model` 28/28 + `graph-semantics.review` 9/9 · rev-graph |
| G2 | pass | src/graph/model.ts:581 | Projection groups on relation plus near and far scope in sequence order — order preserved, never re-derived from a set. | `tests/graph-model.test.ts:303`, 28/28 green · rev-graph |
| G3 | fail(med) → deferred | tools/graph-check.mjs:891 | `SPANNING_SCOPE_READINGS` declares `edge:512:12`, but the probe returned text only, so the grader took the first same-relation label and never bound the edge id; null reverse readings passed and still counted. | `tests/rev-graph-g3.test.ts:20` RED at `wt/rev-graph` `ace618a`, all 4 readings; clean `pnpm graph:check` rc 0 · rev-graph |
| G4 | n/a: deferred | .agent/deferred.md:280 | Closure is ONE-WAY by user ruling: 7 unreferenced scope records and 71 orphan operator contexts are legal and pinned. | `tests/graph-scope.test.ts:67`, 7/7 green · rev-graph |
| G5 | pass | .agent/contracts/m5u11.md:118 | Emitted scope asset 354,080 B against a 508,572 B budget; the budget names Node `zlib.gzipSync` at default level. | `node tools/kb/scope-census.mjs` remeasured 354,080 B · rev-graph |
| G6 | pass | src/graph/canvas.ts:304 | Fit raises zoom to a 1.1 floor and centers; node style sets `text-wrap: wrap`, so labels wrap rather than ellipsize. | `pnpm graph:check` rc 0, 692 labels, 11.00 px minimum · rev-graph |
| C1 | pass | .claude/rules/gate.md:86 | All 10 purpose-built steps carry firing rows and every control drives the step's OWN grader over its REAL input. | 9 reviewer-held commands rc 0; MAIN held `secret:check` — rc 0, 2 controls, one the emptied `TREE_TARGETS` through `requireFiring` · rev-assurance + MAIN |
| C2 | fail(med) → deferred | tools/kb/check.mjs:28 | `PRODUCTION_ROOTS`, `SERIALIZE_ROOTS` and `QUESTION_ROOTS` each grade nothing when emptied: rc 0 and the table is never named, while the step still prints a count. `SCAN_ROOTS` alone is guarded. | `tests/review-assurance-c2.red.test.ts` RED at `wt/rev-assurance` `5c97965`, mutating the real check · rev-assurance |
| C3 | n/a: deferred | .agent/deferred.md:270 | 11 of 12 shipped bounds still resolve no named owner; `CONSULT_DEADLINE_MS` now does, so the queue row's count is stale by one. | 11 × `/usr/bin/rg -l -F` rc 1 with `DEFAULT_NEIGHBOR_LIMIT` rc 0 as control · rev-assurance |
| C4 | pass | tools/binding-check.mjs:234 | Exact case name, single match and `passed` status bind the declared inventory to the gate's own run, so a rename, deletion or skip reddens it. | `pnpm binding:check` 396/396, 35 required + 11 lifecycle + 9 meaning, 5 controls · rev-assurance |
| C5 | fail(med) → deferred | docs/claims.md:72,89 | Two shipped claims name `none` and say `deferred` in the disposition, but neither cites a `.agent/deferred.md` row and no such row exists — u15 R2 requires the citation. The shortfall is honest in shape, untracked in substance. | `/usr/bin/rg -n -i 'proof-RPC\|traceFailure\|failure copy' .agent/deferred.md` rc 1; `.agent/contracts/m5u15.md:39-41` · rev-assurance + MAIN |
| C6 | fail(low) → deferred | .agent/contracts/m5u13.md:102 | u13's firing record names its perturbation, command and rc but no base revision, and `0d5f4c1` omits base `3c4c17c`. Two reviewers disagreed; the `fail(med)` graded pre-floor commits against a rule whose own floor is `2592828`, so the correctly-scoped `fail(low)` stands. | `git show -s --format=%B 0d5f4c1 \| rg -F 3c4c17c` rc 1, control `32c6a84` rc 0; trailers 23/23 post-floor (MAIN) · rev-assurance-2 |
| C7 | pass | .agent/contracts/m5u7.md:66 | Answer-path expectations are contract-owned: E9 owns the bag-derived bytes, D4 reassembles them independently and A2 term-compares the live Prolog result. The one self-asserting fixture is the humanizer label, queued with its check. | `clinical-differential` + `clinical-answer-live` 10/10 rc 0; exception at `.agent/deferred.md:134` · rev-assurance-2 + rev-assurance |
| C8 | pass | .claude/rules/gate.md:13 | Every report made under the roll-call rule discloses its skipped lanes; the three bodies a naive census flags predate it and each names the exact command it ran. | post-floor misses 3, all cleared on reading — `a0d43e2` "Not run: `pnpm gate`", `d44493f` "Gate not rerun", `b0b05f7` "still deferred" · rev-assurance-2 + MAIN |
| C9 | pass | .agent/contracts/review-implement.md:106 | No live skip, xfail or only marker and no post-`7e2f80` case deletion; all 7 tier changes ADD a declaration and none lowers one. | marker sweep rc 1 with a named-case control at 1; `git diff 7e2f80^..HEAD -- tests` removed-cases rc 1 · rev-assurance-2 |
| C10 | fail(low) → deferred | .agent/deferred.md:92,157 | All 51 rows carry a checkable `Accept:`, but two look already satisfied in the tree — the boot retry control ships and `BOOT_DEADLINE_MS` is armed — and neither was ever graded against its own acceptance text. The boot-deadline row expects `code: 'worker'` where `src/engine/client.ts:221` emits `code: 'boot'`, so row and implementation disagree. | parser 51/51 `Accept:`; boot suites rc 0, 42/42; `/usr/bin/rg -Fn "BOOT_DEADLINE_MS" src/engine/client.ts` → :40,:221,:231 · rev-assurance-2 + MAIN |
