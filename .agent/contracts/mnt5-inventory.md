# Check inventory — firing records (mnt5)

Every check this repo runs, each beside the record of it refusing a planted wrong input:
global `CLAUDE.md` `Engineering` verification integrity binds the whole repo
(`.claude/rules/stack.md` `Demo tier`), and a check that cannot fail and a clean tree emit the same
green. `tests/inventory.test.ts` grades this file in the gate: one row per `pnpm gate` step, per
out-of-chain lane in `.claude/rules/gate.md`, and per `tests/*.test.ts`, each record resolving.

Path: a suite is `answer` IFF `tools/binding-check.mjs` `REQUIRED` names it (the answer-path roll
call), else `off`. Gate steps and lanes carry no path.

Record kinds — `anchor` holds what the kind resolves:

| kind | anchor | resolves when |
|---|---|---|
| `mutate` | a `tools/mutants.mjs` label | the label exists and, for a suite, its vitest check runs that suite; `pnpm mutate '<label>'` reruns the firing |
| `commit` | `<sha> <verbatim text of its body>` | the body records this check red on a present-but-wrong implementation or input; form graded, text rematched at harvest |
| `text` | `<path> <verbatim text>` | the file holds the text, which must not be empty: a firing-input row the check runs on every run, or a recorded firing |
| `queue` | a `.agent/deferred.md` row title | the row is live and carries the acceptance check that gives this check a firing |
| `none` | the reason | a lane that grades nothing — it reports; never a suite or a gate step |

A `commit` record never counts a collection failure, an import error or a missing fixture: the
red must come from a case of the named check failing on behaviour. The full bar for a suite's
record is `.claude/rules/firing.md`.

## Gate steps

| check | firing | record | anchor |
|---|---|---|---|
| `audit:check` | a live advisory against the locked tree | commit | `24bbb5d `pnpm gate` rc 1 at audit:check` |
| `secret:check` | a token-shaped literal; `TREE_TARGETS` emptied | text | `.claude/rules/firing.md a token-shaped literal planted in a temp dir; the `TREE_TARGETS` list emptied` |
| `kb:build` | one digit changed in the bag sidecar | text | `.claude/rules/firing.md one digit changed in the bag `.sha256` sidecar` |
| `kb:asset-check` | seven planted forbidden-reach inputs | text | `.claude/rules/firing.md seven planted `src/zz-forbidden-reach-control.ts` inputs` |
| `kb:export-check` | one declared query dropped from the bag | text | `.claude/rules/firing.md one declared query dropped from the verified bag` |
| `engine:check` | one perturbed pinned surface per predicate | text | `.claude/rules/firing.md one perturbed pinned surface per predicate` |
| `copy:check` | a banned word in a double-quoted value, and fourteen more | text | `.claude/rules/firing.md the same value rewritten as a double-quoted sentence holding a banned word` |
| `contrast:check` | `--text` collapsed onto `--surface` | text | `.claude/rules/firing.md `--text` collapsed onto `--surface`` |
| `palette:check` | a fill collapsed onto another; a pair only colour-blind readers confuse; `FILLS` emptied | text | `.claude/rules/firing.md a pink/cyan pair only colour-blind readers confuse` |
| `presentation:check` | one `@font-face` renamed out of `app.css`, and five more | text | `.claude/rules/firing.md one `@font-face` renamed out of `app.css`` |
| `claims:check` | the claim set re-derived from one rules file, and five more | text | `.claude/rules/firing.md the claim set re-derived from ONE rules file, contracts dropped` |
| `spec:check` | an open unit as a plain bullet, a ticked row without its SHA | text | `.claude/rules/firing.md the first open unit written as a plain bullet, then with a star bullet` |
| `spec:lint` | a backticked-SHA row planted before the pointer; `## Tasks` as H1 | text | `.claude/rules/firing.md a ticked row planted before the pointer with its SHA in backticks` |
| `shell:check` | `.agent/spec-lint` without its SC2016 directive; the script set emptied | text | `.claude/rules/firing.md a copy of `.agent/spec-lint` with its `# shellcheck disable=SC2016` line removed` |
| `format:check` | a source line the formatter rewrites | mutate | `inv format:check: a source line the formatter would rewrite` |
| `lint` | catalog text through an `{@html}` sink | mutate | `inv lint: a component renders catalog text through an {@html} sink` |
| `check` | the app mounted on a number | mutate | `inv check: the app mounts on a number instead of its target element` |
| `binding:check` | a required case no suite defines, and five more | text | `.claude/rules/firing.md a required case no suite defines; a required suite the run never loaded` |
| `build` | the licence notice with its first section cut | text | `.claude/rules/firing.md the written `dist/licenses/third-party.txt` with its first package's section cut` |

## Lanes

| check | firing | record | anchor |
|---|---|---|---|
| `kb:reproduce` | one asset digest changed in the second manifest | text | `.claude/rules/firing.md one asset digest changed in the second manifest` |
| `kb:fetch` | `--verify`: a flipped byte in a copy of the vendored archive | text | `.claude/rules/firing.md a copy of the vendored archive with its last byte flipped` |
| `engine:probe` | a reset cycle without its reset | text | `.claude/rules/gate.md Control: a cycle without its reset must be refused` |
| `test:browser` | the typeahead window shortened to 100 ms | mutate | `inv test:browser: the typeahead window shortened to 100 ms` |
| `smoke` | the build served without its hashed PVM, and four more | text | `.claude/rules/firing.md the same build served with its hashed `kb-*.pvm` removed` |
| `readme:check` | `## Run locally` renamed; the module count off by one | text | `.claude/rules/firing.md the real README with `## Run locally` renamed` |
| `browser:check` | the Japanese faces renamed, and six more | text | `.claude/rules/firing.md the same build served with its Japanese `woff2` files renamed` |
| `visual-qa` | a box planted wider than the viewport | text | `.claude/rules/gate.md Control: a box planted wider than the viewport must read as overflow at each width` |
| `graph:check` | one edge drawn dashed; `SEPARATION_PX` set to 0 | text | `.claude/rules/firing.md one edge's `line-style` set to `dashed` in the mounted graph` |
| `mutate` | a mutant its check did not bind | commit | `0273a6a E03 came back GREEN` |
| `stryker` | — | none | `reports every mutant left alive; the credit it grants is recorded per unit, never graded` |
| `chat:live` | the bridge relaying a fake whose answer cites a query it never ran | text | `.claude/rules/firing.md `CHAT_LIVE_CONTROL=no-kb pnpm chat:live` runs Vite and the bridge in process and calls no model` |
| `chat:probe` | — | none | `reports and never grades: the model has no determinism control` |
| `binding:replay` | `pnpm binding:replay HEAD` | text | `.claude/rules/firing.md both differential arms go green, so the command exits 1` |
## Suites

| suite | path | firing | record | anchor |
|---|---|---|---|---|
| `tests/about-copy.dom.test.ts` | off | corpus count written into copy | mutate | `E03 corpus count written back into copy` |
| `tests/axe-contrast.browser.test.ts` | off | the probe's pair made readable | mutate | `inv axe-contrast.browser: the probe's pair made readable` |
| `tests/axe-contrast.dom.test.ts` | off | the pin's own probe run in Chromium, which decides contrast | text | `tests/axe-contrast.browser.test.ts decides the unreadable pair a violation, where the jsdom pin no longer holds` |
| `tests/boot-phases.dom.test.ts` | off | first progress wrongly settles boot | commit | `d6714d7 all 5 dom cases RED` |
| `tests/boot-phases.test.ts` | off | unexpected progress ignored silently | mutate | `inv boot-phases: unexpected progress ignored silently` |
| `tests/boot-recovery.dom.test.ts` | off | retry reuses worker retaining failed image fetch | commit | `88af76b B4 retry red: cached-rejection retention` |
| `tests/census.test.ts` | off | latin-ext face duplicates latin font file | mutate | `inv census: latin-ext face duplicates latin file` |
| `tests/chat-binding.test.ts` | answer | query card drops engine outcome | mutate | `inv chat-binding: query card drops engine outcome` |
| `tests/chat-client.test.ts` | off | malformed event line skipped instead of refusing turn | mutate | `inv chat-client: malformed event line skipped` |
| `tests/chat-controller.test.ts` | off | malformed answer earns model label | mutate | `inv chat-controller: malformed answer earns model label` |
| `tests/chat-engine.test.ts` | off | model goal drops readonly option | mutate | `inv chat-engine: model goal drops readonly option` |
| `tests/chat-events.test.ts` | off | answer missing text admitted | mutate | `inv chat-events: answer missing text admitted` |
| `tests/chat-panel.dom.test.ts` | off | source links accept every scheme | mutate | `inv chat-panel.dom: source links accept every scheme` |
| `tests/chat-provenance.test.ts` | off | extra segment fields admitted | mutate | `inv chat-provenance: extra segment fields admitted` |
| `tests/chat-queue.dom.test.ts` | off | model goal runs before boot | mutate | `inv chat-queue.dom: model goal runs before boot` |
| `tests/chat-result.test.ts` | off | refused goal reported as executed | mutate | `inv chat-result: refused goal reported as executed` |
| `tests/chat-server-fake.test.ts` | off | the fake refusing a missing outputSchema without naming the contract | mutate | `inv chat-server-fake: the fake refuses a missing outputSchema without naming the contract` |
| `tests/chat-server.test.ts` | off | concurrent first turns use child before initialization | text | `.agent/contracts/chat-close.md (slow-initialize fake) red without the fix (`expected true to be false`` |
| `tests/chromiumfish-resolve.test.ts` | off | resolver scans one level below each global store version | mutate | `mv5 chromiumfish resolver scans one level` |
| `tests/ci-gate.test.ts` | off | `ci:gate` trusts the run record over a failed watch | mutate | `n20-close C2-1 ci:gate trusts the run record over a failed watch` |
| `tests/clinical-answer-live.test.ts` | answer | partial document answer admitted | mutate | `inv clinical-answer-live: partial document answer admitted` |
| `tests/clinical-binding.test.ts` | answer | erased clause leaves partial document answer | mutate | `inv clinical-binding: erased clause leaves partial answer` |
| `tests/clinical-differential.test.ts` | off | premise ordinals start at one | mutate | `inv clinical-differential: premise ordinals start at one` |
| `tests/clinical-gate-live.test.ts` | answer | emitted gate lines offset by one | mutate | `inv clinical-gate-live: emitted gate lines offset by one` |
| `tests/clinical-inference.test.ts` | answer | old proof evaluator lacks query-local assumption derivation | text | `.agent/archive/contracts/m5u2.md 8 cases encoded in `tests/clinical-inference.test.ts`; **5/9 RED at base `e71486e`**` |
| `tests/clinical-proof-live.test.ts` | answer | erased clause retains partial proof | mutate | `inv clinical-proof-live: erased clause retains partial proof` |
| `tests/clinical-records.test.ts` | off | multiple antecedents admitted within one sentence | mutate | `inv clinical-records: multiple antecedents admitted` |
| `tests/corpus-browser.dom.test.ts` | off | section omitted from corpus filter | mutate | `inv corpus-browser.dom: section omitted from filter` |
| `tests/corpus-index.test.ts` | off | unsupported corpus schema admitted | mutate | `inv corpus-index: unsupported schema admitted` |
| `tests/demo-abort.dom.test.ts` | off | settled run cannot start again after heap limit | mutate | `inv demo-abort.dom: settled run cannot start again` |
| `tests/demo-api.test.ts` | off | unused public solutions getter revived | mutate | `L28 dead public member revived` |
| `tests/demo-controller.dom.test.ts` | off | recognized guideline binding falls back to raw display | mutate | `L25 recognized binding falls back to raw display` |
| `tests/demo-controller.model.test.ts` | off | rejected predecessor suppresses successor dispatch; rejected run never settles | commit | `8425f9f 3/4 RED on wt/orc-u10b 014af81` |
| `tests/demo-lifecycle.test.ts` | off | engine result leaves run in running state | mutate | `inv demo-lifecycle: settled result leaves run active` |
| `tests/demo-proof-controller.test.ts` | off | stale proof completion overwrites selected solution's provenance | mutate | `inv demo-proof-controller: stale proof completion overwrites selection` |
| `tests/engine-abort-client.test.ts` | off | aborted runtime keeps its worker | mutate | `chat-c2 an aborted runtime keeps its worker` |
| `tests/engine-abort-live.test.ts` | off | heap trap loses its typed heap outcome | mutate | `inv engine-abort-live: heap trap loses heap classification` |
| `tests/engine-abort-session.test.ts` | off | later requests reuse an aborted runtime | mutate | `inv engine-abort-session: later requests reuse aborted runtime` |
| `tests/engine-boot-recovery.test.ts` | off | failed boot retains worker whose cached image fetch stays rejected | commit | `88af76b Tests: tester-d21 suite (tests/engine-boot-recovery.test.ts, tests/boot-recovery.dom.test.ts) 4 red / 7 green at base 07899e0` |
| `tests/engine-boot-watchdog.test.ts` | off | heap recreation joins a reset with an unbounded boot | commit | `8c186d2 run tests/engine-boot-watchdog.test.ts` → rc 1, case "bounds a heap recreation that joins a` |
| `tests/engine-budgets.test.ts` | answer | cap checked before proving exhaustion reports truncation on exact fit | mutate | `R03 cap counted before the extra step` |
| `tests/engine-cancel.test.ts` | off | response deserialization failure leaves pending requests unsettled | mutate | `R29 messageerror unhandled` |
| `tests/engine-client-live.test.ts` | off | client discards the real worker's returned solutions | mutate | `E22 client drops the solutions it received` |
| `tests/engine-fallback.test.ts` | off | fallback engine's document count is never checked | mutate | `inv engine-fallback: fallback document count unchecked` |
| `tests/engine-heap.test.ts` | off | allocator exhaustion becomes a generic aborted error instead of heap limit | mutate | `inv engine-heap: allocator trap becomes generic abort` |
| `tests/engine-proof-cache.test.ts` | off | an already-proved solution runs another meta-interpreter derivation | commit | `a067cdc Red witnesses: at base `75e6073` (no cache) the hit case fails (2 derivations); at round 1` |
| `tests/engine-readonly-budget.test.ts` | off | atom builder is admitted; rejection loses the required atom_concat reason | mutate | `inv engine-readonly-budget: atom builder joins builtin allowlist` |
| `tests/engine-readonly-client.test.ts` | off | client drops an explicitly requested read-only flag | mutate | `inv engine-readonly-client: drops requested readonly flag` |
| `tests/engine-readonly-guard.test.ts` | off | disjunction is admitted when just one branch reads the KB | mutate | `inv engine-readonly-guard: disjunction needs only one KB branch` |
| `tests/engine-readonly-session.test.ts` | off | truthy non-boolean read-only flags are accepted | mutate | `inv engine-readonly-session: accepts truthy readonly flags` |
| `tests/engine-recovery.test.ts` | answer | depth limit wins over the outer inference limit | mutate | `R35 readOutcome tests depth before inference` |
| `tests/engine-render-deadline.test.ts` | off | answer and proof displays run past their request deadlines | commit | `91d22b7 within-deadline control. Red witnesses: at base `8717d11` 2/4 red (per-display, proof); at the` |
| `tests/engine-request-budget.test.ts` | off | per-step metering lets whole-request inferences exceed their budget | commit | `0465faa green here as tests/engine-request-budget.test.ts; review round-1 cases "meters search that fails after the last answer"` |
| `tests/engine-runtime-facts.test.ts` | off | encoder turns integer arguments into atoms | mutate | `inv engine-runtime-facts: integers reencode as atoms` |
| `tests/engine-session.test.ts` | answer | concurrent boot requests each load another engine image | mutate | `E05 boot no longer single-flighted` |
| `tests/engine-term-identity.test.ts` | off | falsy improper-list tails collapse and recursive encoding overflows on long lists | commit | `a9bf242 terms); round 1 `9715300` → the long-list case throws. Command: `git show <rev>:src/engine/terms.ts` |
| `tests/engine-u2-port.test.ts` | off | unmatched worker response no longer reports a protocol violation | mutate | `inv engine-u2-port: unmatched response is silently dropped` |
| `tests/engine-u3-port.test.ts` | off | maximum budget boundary is rejected instead of admitted | mutate | `inv engine-u3-port: maximum budget is excluded` |
| `tests/graph-condition-merges.test.ts` | off | merged relation records the folded world's scope as the kept world's scope | mutate | `inv graph-condition-merges: kept scope replaced by folded scope` |
| `tests/graph-live.test.ts` | off | neighborhood depth cutoff excludes all first-degree neighbors | mutate | `inv graph-live: neighborhood depth cutoff off by one` |
| `tests/graph-model.test.ts` | off | scope chain may terminate at another context's reference | mutate | `inv graph-model: scope terminal reference unchecked` |
| `tests/graph-annotations.test.ts` | off | threshold scope taken from the comparison goal | mutate | `inv graph-annotations: threshold scope taken from the comparison goal` |
| `tests/graph-orphan-scopes.test.ts` | off | scope-blind relation dedup merges negated relations into another world's edge | commit | `85e51fc the new producer with the world removed from the dedup key → O3 red, refusing exactly 157` |
| `tests/graph-scope.test.ts` | off | validator accepts the empty scopes table | mutate | `inv graph-scope: empty scope table accepted` |
| `tests/graph-semantics.review.test.ts` | off | argument edges no longer require event sources | mutate | `inv graph-semantics.review: argument source role unchecked` |
| `tests/graph-shortcut-justification.test.ts` | off | shortcut target scope is replaced by its source scope | mutate | `inv graph-shortcut-justification: far scope copied from near end` |
| `tests/i18n.dom.test.ts` | off | Japanese switch leaves document language English | mutate | `inv i18n.dom: document language stays English` |
| `tests/inventory.test.ts` | off | the inventory drops a suite row | mutate | `inv inventory: the inventory drops the validate-report suite's row` |
| `tests/kb-bag.test.ts` | off | truncated gzip escapes as an untyped zlib failure | mutate | `U08 gzip failure escapes untyped` |
| `tests/kb-derived-assets.test.ts` | off | coverage parser refuses the upstream inexpressible uncovered class | commit | `9cf5680 > tools/kb/provenance.mjs && pnpm exec vitest run tests/kb-derived-assets.test.ts -t 'admits` |
| `tests/kb-live.test.ts` | answer | live image verifier reports one extra document | mutate | `inv kb-live: reported document count off by one` |
| `tests/kb-produce.test.ts` | off | image build accepts fewer documents than payload declares | mutate | `U11 document count floored at >= 1` |
| `tests/kb-release.test.ts` | off | the vendored-tree grader passes a changed byte | mutate | `inv kb-release: the vendored-tree grader passes a changed byte` |
| `tests/kb-reach.test.ts` | answer | production reach scan omits src | mutate | `c19 reach scan narrowed off src` |
| `tests/legacy-export-lane.test.ts` | answer | exported query-set guard accepts undeclared queries | mutate | `c06 undeclared query set accepted` |
| `tests/licences.test.ts` | off | notice grader accepts package name without its licence text | mutate | `inv licences: package name substitutes for licence text` |
| `tests/lint-directives.test.ts` | off | base lint config admits bare disables without a reason | commit | `f862574 requires `require-description`; RED on the base config` |
| `tests/m1u5-port.dom.test.ts` | off | active option scrolls to start rather than nearest block | mutate | `inv m1u5-port.dom: active option scroll aligns at start` |
| `tests/m1u7-port.dom.test.ts` | off | About disclosure omits first contracted font licence link | mutate | `inv m1u7-port.dom: first font licence link omitted` |
| `tests/m1u7-port.test.ts` | off | a root token outside the role names | mutate | `inv m1u7-port: a non-role root token planted` |
| `tests/marks-admitted.test.ts` | answer | an alternative noun `none` read as no alternative; a body `fail` assumed as a premise | text | `.agent/contracts/ann-review.md case builds its own planted image, so no` |
| `tests/marks-controller.test.ts` | off | marks state never leaves idle; no marks call ahead of the trace | text | `.agent/contracts/ann-u1.md 17/23 RED at base` |
| `tests/marks-live.test.ts` | answer | no compiled marks goal; a duplicated clause stands in for a missing sentence | text | `.agent/contracts/ann-u1.md 12/13 RED at base` |
| `tests/marks-panel.dom.test.ts` | answer | panel ignores marks: no facts row, notice or goal disclosure | text | `.agent/contracts/ann-u3.md 28/36 RED at base` |
| `tests/marks-readings-live.test.ts` | answer | default-operator mutants of the readings and join | text | `.agent/contracts/ann-u3.md 497 mutants, **272 killed** by U1's live readings` |
| `tests/marks-run-boundary.dom.test.ts` | answer | a missing document's grade run merged into the next | text | `.agent/contracts/ann-review.md Written by reviewer-12 as` |
| `tests/marks-run-boundary.test.ts` | answer | a missing document's grade run merged into the next | text | `.agent/contracts/ann-review.md Written by reviewer-12 as` |
| `tests/marks-view.test.ts` | answer | decoder, readings and join return the stub's fixed values | text | `.agent/contracts/ann-u1.md 405/405 RED at base` |
| `tests/mutant-anchors.test.ts` | off | exported-query mutant names an anchor absent from its producer | mutate | `inv mutant-anchors: exported-query mutant retains a stale anchor` |
| `tests/page-viewer.dom.test.ts` | off | failed page draw leaves retry button disabled | mutate | `C3 a failed page draw keeps Load page viewer disabled` |
| `tests/palette-check.test.ts` | off | protan simulated with the identity matrix | mutate | `inv palette-check: protan simulated with the identity matrix` |
| `tests/upstream-ui-corpus.test.ts` | off | the port lets an orphan ACE or Prolog file ride along | mutate | `inv upstream-ui: the port lets an orphan ACE or Prolog file ride along` |
| `tests/readonly-arithmetic.test.ts` | off | a twin whose rewrite enters a `findall/3` template | text | `.agent/contracts/n34-readonly-arithmetic.md The rewrite entering a `findall/3` template` |
| `tests/passage-locate.test.ts` | off | locator keeps standalone bullet items that the extracted passage drops | commit | `005903a pnpm exec vitest run tests/passage-locate.test.ts` → rc 1, 2/8 red` |
| `tests/proof-comparison.test.ts` | off | the decoder reads a comparison as a negation | mutate | `inv proof-comparison: the decoder reads a comparison as a negation` |
| `tests/proof-guard.test.ts` | answer | an interpreter naming 19 of the 22 indicators passes every scope guard | text | `.agent/contracts/rel-u1.md 5/5 RED at base` |
| `tests/proof-identity.test.ts` | off | a provenance chunk keys a clause by the wrong line | mutate | `inv proof-identity: a provenance chunk keys a clause by the wrong line` |
| `tests/proof-live.test.ts` | off | inference exhaustion is misclassified as depth exhaustion | mutate | `inv proof-live: inference exhaustion reported as depth` |
| `tests/provenance-ladder.dom.test.ts` | off | graph focus omits the selected proof's source lines | mutate | `inv provenance-ladder.dom: graph focus drops proof lines` |
| `tests/provenance-model.test.ts` | off | alignment validator admits overlapping spans | mutate | `inv provenance-model: overlapping spans are accepted` |
| `tests/question-combobox.browser.test.ts` | off | open combobox never exposes its active descendant | mutate | `inv question-combobox.browser: active descendant never exposed` |
| `tests/question-combobox.dom.test.ts` | off | closed ArrowUp opens at selection instead of last option | mutate | `I07 closed ArrowUp opens at the selection` |
| `tests/question-link.dom.test.ts` | off | unknown URL id selects first catalog question instead of clearing selection | mutate | `inv question-link.dom: unknown id falls back to first question` |
| `tests/qualifier-slot.test.ts` | answer | a qualifier stays in the verb slot; no refusal on a planted mutant | text | `.agent/contracts/ann-u2.md 15/18 RED at base` |
| `tests/questions-catalog-version.test.ts` | off | unsupported catalog version resolves a full executable catalog | commit | `1ecad59 RED at base `44406bd`: `npx vitest run tests/questions-catalog-version.test.ts` → rc 1` |
| `tests/questions-live.test.ts` | off | answer rows sort rendered bytes rather than Prolog term order | mutate | `c12 row sort by rendered bytes` |
| `tests/questions-u4-port.test.ts` | off | id-only answer service accepts case-folded question ids | mutate | `inv questions-u4-port: service accepts case-folded ids` |
| `tests/semantic-graph.dom.test.ts` | off | graph loader checks server errors alone and loses client-error reporting | mutate | `inv semantic-graph.dom: client HTTP errors pass response guard` |
| `tests/smoke.test.ts` | off | package licence drops the LLVM exception | mutate | `inv smoke: package licence omits LLVM exception` |
| `tests/solution-streaming.dom.test.ts` | off | each streamed answer overwrites the preceding answers | mutate | `inv solution-streaming.dom: latest answer replaces earlier answers` |
| `tests/solution-streaming.test.ts` | off | final record leaves the query open and permits nested execution | commit | `e8f7cab pnpm exec vitest run tests/solution-streaming.test.ts` → rc 1,` |
| `tests/spec-check.test.ts` | off | spec:check admitting a ticked row without its SHA | mutate | `spec-check-suite a ticked row passes without its SHA` |
| `tests/toolchain-pins.test.ts` | off | the TypeScript pin reading another package's manifest | mutate | `inv toolchain-pins: the TypeScript pin reads another package's manifest` |
| `tests/trace-failure.dom.test.ts` | off | failed proof renders unavailable copy instead of failure copy | mutate | `inv trace-failure.dom: failed proof shown as unavailable` |
| `tests/validate-report.test.ts` | off | report grader counts unknown placeholders as filled findings | mutate | `inv validate-report: unknown no longer marks a placeholder` |

## Accepted-open re-ruling

The fifteen ids were ruled open under the retired waiver (`.agent/archive/review-expedited.md`
`Rulings — closed` 4–5, a user scope ruling). Facts at `d3c4bc5`, `mnt5-reviewer-1` (reviewer),
each retained check rerun in its own worktree. User ruling: all fifteen stay open, the closes
proposed for C1, A11+ and C6 included, and none becomes a queue row.

| id | fact at `d3c4bc5` | evidence | ruling |
|---|---|---|---|
| A1 | open: a manifest-authorized altered graph survives `kb:build` | `wt/rev-arch-1` `tools/review-probes/a1-cache.test.mjs` rc 1; `tools/kb/build.mjs:100` `assetsIntact(cached)` | stays open (user) |
| A3 | open: an emitted modality changed to `can` still builds | `wt/rev-arch-1` `tools/review-probes/a3-answer-equivalence.test.mjs` rc 1 | stays open (user) |
| A4 | open: `ProvenanceLadder.svelte` still selects proof documents | `wt/rev-arch-1` `a4-component-semantics.test.mjs` rc 1 | stays open (user) |
| A5 | open: App construction boots a 3,148,507 B worker before activation | `a5-lazy-payload.test.mjs` rc 1 on an isolated build | stays open (user) |
| A6 | open: a worker response with `solutions: 'not-an-array'` is accepted | `tests/review-a6-worker-validation.test.ts` rc 1 | stays open (user) |
| A8 | open: out-of-bounds alignment parses; a stderr-emitting query succeeds | `tests/review-a8-fail-closed.test.ts` 2/2 rc 1 | stays open (user) |
| A9+ | half closed: the QLF has a consumer since `bbb4f24`; `provenance/clause-index.json` (1,877,776 B) still has none | `a9-dead-assets.test.mjs` rc 1 naming that asset alone | stays open (user) |
| A10+ | open: one build reaches `deriveProvenance` three times | `a10-duplicate-derivation.test.mjs` rc 1 | stays open (user) |
| A11+ | closed: the publisher left at `049f5a1`; CI publishes nothing (user ruling) | `.github/workflows/ci.yml:3`; no `deploy-pages` step | stays open (user) |
| S7 | open: a missing proof-line join renders an empty clause list, then the evidence | `src/provenance/ProvenanceLadder.svelte:59`, `:208` | stays open (user) |
| C1 | closed: live proof `cc8886f`, oracle `e71486e`, censuses `524dad6`, captures `1dc006f` | `clinical-proof-live` 7/7, `clinical-differential` 5/5, `census` 2/2 | stays open (user) |
| C4u1 | open: four local provenance cases; no differential, no 15-green/84-red corpus port | `tests/provenance-model.test.ts` 4/4, corpus scan rc 1 | stays open (user) |
| C4u4 | open: duplicate clause lines and page 0 still parse | `src/provenance/model.ts:170`, `:196` | stays open (user) |
| C4u5 | open: 2 of 6 ladder states carry DOM + axe (content, limit) | `tests/provenance-ladder.dom.test.ts:284`, `:308` | stays open (user) |
| C6 | open, historical: 5 of 10 subjects in `5ed81a3^..a944fca` miss the convention | `git log --format='%h %s' 5ed81a3^..a944fca` | stays open (user) |
