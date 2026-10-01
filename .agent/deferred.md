# Deferral queue

The queue `.agent/spec.md` `Tasks` points at: off-spine improvements, held out of the
attached state because a queue only grows. Each entry carries the acceptance check that
closes it and a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up. A row closes on its own
acceptance check and leaves in that commit; the index at the foot collapses the `high` +
`med` set to one line each.

- **The Japanese face ships whole** — 2,654,740 B across two static weights, because a
  monolithic subset is the only delivery with zero tofu risk and no new build step. A
  build-time subset over the glyphs `ja.ts` actually uses measures ≈25 KB. Accept: the
  shipped woff2 carries exactly the code points reachable from `src/i18n/ja.ts` plus a
  declared safety set; `presentation:check` regrades it from the catalog, so a glyph added
  to `ja.ts` without a rebuild fails the gate; `browser:check`'s Japanese pass still finds
  every face `loaded`. `pri` low.
- **Japanese copy has no register grader** — `copy:check` decides parity alone; the ≤20/≤25
  word limits cannot port to a language without word spaces, so nothing mechanical holds
  `ja.ts` to です・ます or to a length. Accept: a Japanese-side rule set the gate can decide
  — a per-sentence character ceiling, a fixed-terminology table drawn from
  `.claude/rules/i18n.md`, and one sentence-final-form check — with a positive control per
  rule. `pri` low.
- **Phased boot telemetry** — replace the single boot spinner with ordered
  progress phases. Accept: each phase emits one accessible status event in
  order, and no percentage is reported that the runtime does not supply. `pri` low.
- **Question deep-links + history** — encode the selected catalog ID in the URL.
  Accept: reload and back/forward restore only a catalog ID, and never start a
  run without an explicit user action. `pri` low.
- **Offline asset caching** — service worker over the hashed runtime assets.
  Accept: a second visit boots with the network offline, and a changed KB input
  hash invalidates every stale PVM asset. `pri` low.
- **Finish the u1 wave-1 reports** — `map-m1u1` (17/25 rows) and
  `spike-m1u1-det` (9/12) were stopped at the reserve. Their sources
  `.scratch/agents/{map-m1u1,spike-m1u1-det}.md` must survive until this closes. Accept: both
  reports pass `node tools/validate-report.mjs` with rc 0, or the open rows are re-derived and their
  findings folded into `.claude/rules/`. `pri` low.
- **QLF fallback delivery path** — the fallback needs the 6.2 MB `swipl-bundle`,
  so a naive import would double the shipped engine. Accept: the fallback engine
  loads only when the saved state fails, and a production build that never takes
  the fallback ships no bytes of it. `pri` med.
- **Integral floats decode as integers** — SWI's `1.0` and `1` both arrive as JS
  `1`, so `decodeTerm` reports `integer`. The shipped corpus has no floats.
  Accept: a float binding decodes as `float`, proven on a goal returning `1.0`,
  without adding a per-binding engine call to the common path. `pri` low. Red witness:
  `tests/zz-u2-red.test.ts:107` on `wt/tester-d11` `6529dea` — `1.0`, `0.0` and `-1.0` decode
  as `integer` while live `float(X)` succeeds.
- **u3 heap limit is unit-tested only** — `P2.7` is covered by `readOutcome` over a
  synthesized `resource_error(memory)`, not a live trip. Accept: a committed test drives
  real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate. `pri` med.
  **Blocked on the `high` abort row below**: at swipl-wasm 8.0.7 real exhaustion aborts the
  runtime in Node too and never raises `resource_error(memory)`, so `limit: 'heap'` is
  unreachable live until that row classifies the abort. The fast live half is committed —
  `tests/engine-heap.test.ts` drives the trip in ~1 s behind a 1900 MB `_malloc` reserve and
  pins today's abort; it owes only the `limit: 'heap'` read.
- **u3 red suite completion** — `test-m1u3` partially filled its 35-case skeleton,
  committed at `22c8b97` on `wt/test-m1u3`. Accept: the cases MAIN's 31 do not cover run
  in the primary tree, red for a contract reason or green. `pri` low.
- **Solution streaming** — u2 delivers one batch per query. Both spikes measured
  streaming as cheap (0.0414 vs 0.0345 ms/query) and useful for early answers.
  Accept: solutions render as they arrive, and a queued cancel still cannot
  interrupt an in-flight synchronous `next()`. `pri` low.
- **Assembled-path evasion** — the answer-oracle scan matches a literal `queries/answers`;
  a path concatenated at runtime slips past. Accept: a production fixture that assembles
  the path from parts fails `kb:asset-check`. `pri` low.
- **Boot-error recovery** — u6 ruled `boot-error` terminal (contract m1u6 Q7): the state
  renders in the alert with no Retry, so a transient PVM fetch failure needs a page
  reload. Accept: a failed boot offers a retry control that rebuilds the engine, and a
  second failure still reports one alert rather than accumulating them. `pri` med.
- **Typed port of the visual-QA walker** — the state walker lives only on
  `wt/map-m1u7` `124e34d` and fails `svelte-check` with 64 implicit-any errors,
  so u7's 11-state evidence comes from an out-of-tree script. `pnpm browser:check`
  now measures five states at 320 px, which covers the narrow-viewport risk the
  walker was filed for; what stays unported is 375/1280 px and the other six states.
  Regeneration until then: copy the 548-line script into `tools/` and run it; it drives a
  real browser at 320/375/1280 px, writes PNGs to `.probe/` and JSON to stdout.
  Accept: `tools/visual-qa.mjs` passes `pnpm check` and `pnpm lint`, `pnpm visual-qa`
  exits 0, and its JSON reports `overflow=false` for every state at 320, 375 and
  1280 px. `pri` low.
- **Inference budget re-arms per solution** — `call_with_inference_limit/3` is
  applied per solution, so the inference budget bounds one step and not the whole
  request: 50 solutions of ~800 inferences each pass a 3000 limit, while one
  5000-deep step trips at 1000 (M1 review R06). Accept: a multi-solution goal
  whose total inferences exceed the budget reaches `limit: 'inference'`, or the
  contract records that the bound is per-step by design. `pri` med.
- **Humanizer label test asserts its own artifact** — `tests/questions-live.test.ts:294`
  matches `/^\S+ — sentence \d+, \w+ \d+$/u`, a grammar that exists only in
  `src/questions/humanize.ts`, so the expectation comes from the artifact under test.
  D8 constrains only what the humanizer may not know, so no external oracle exists
  (M1 review c20 register). Accept: the contract states the label grammar and the test
  cites it, or the test drops the shape assertion and keeps the `not.toContain` gloss
  checks that carry the real force. `pri` low.

- **Browser WASM abort leaves a dead session** — a runaway `assertz` aborts the WASM runtime
  — in Node too at swipl-wasm 8.0.7, pinned live by `tests/engine-heap.test.ts`, which is the
  fix's red witness — and surfaces as `{code:'prolog', message:'Aborted()...'}`, so `limit:'heap'`
  never fires and `EngineClient` keeps the dead worker: every later query returns the same
  abort, breaching u3 P3.4 (M1 review R45). Unreachable from M1's six bounded catalog goals;
  free-text intake is what makes it reachable. Accept: an aborted runtime reaches the client
  as its own terminal state that recreates the worker without a caller `reset()`, proven by a
  browser probe whose next query reports 337 documents. `pri` high, gated on free-text intake.
- **Combobox predicates are jsdom-only** — 9 of u5's 26 predicates rest on behavior jsdom
  stubs: S1/S7 (accessible name, activedescendant announcement), K5 (real timer scheduling
  and key repeat), K8/K10/P2/P3 (native focus traversal, `focusout.relatedTarget` ordering,
  mousedown prevention), B1 (`scrollIntoView` visibility), B3 (axe without layout or canvas)
  (M1 review I26). Accept: one `tests/question-combobox.browser.test.ts` drives real keyboard,
  Tab and pointer input in Chromium, reads focus after each, reads the AX tree for S1/S7,
  wraps native `scrollIntoView` to record receiver and arguments while preserving it,
  exercises K5 on both sides of 500 ms, and runs axe closed and open. `pri` med.
- **Boot carries no deadline** — `EngineClient.boot()` arms no timer, so a worker that never
  answers `boot` leaves the caller pending forever; `query` and `consult` are the only
  bounded requests (M1 review E10, excluded from that fix on purpose). A naive deadline
  loops, because the boot failure path calls `reset()`, which boots again. Accept: a hung
  boot settles as `{ kind: 'error', code: 'worker' }` inside a bounded wall clock, the
  recovery attempts one recreate at most, and a worker stub that never replies proves
  both. `pri` med.
- **Font stack fallbacks and copy reach are unowned** — `presentation:check` grades faces,
  licences and containment, but D7's h1 wordmark, the framing copy's forbidden claims, the
  descriptor humanizer's rendered output and the three role tokens' system fallback stacks
  still rest on one reviewer reading them (M1 review U7-26, partly closed). Accept: each of
  the four is decided by a committed check — wordmark and forbidden-claim literals in
  `copy:check`, descriptor rendering in a dom test, fallback stacks in
  `presentation:check`. `pri` med.
- **`copy:check` double-grades a keyed literal** — a mutated string fails twice, once
  under its record key and once as an identical `<literal>` row, so a one-string mutant
  reports two failures and a reader cannot count real defects (M1 review U7 register
  REG-01, `tools/copy-check.mjs:23-126`). Accept: one mutated string produces exactly one
  failure line naming its record key. `pri` low.
- **u5 red suite never existed** — u5 shipped with no `test-m1u5` diff-blind suite, and the
  roadmap's `NOT verified` clause had no register entry (M1 review X16). Accept: a suite
  authored from `.agent/contracts/m1u5.md` alone runs in the primary tree, every case red
  for a contract reason or green, and the cases MAIN's 26 predicates do not cover are
  merged. `pri` low — u5's own 28-row review found and closed two behaviour defects, so the
  gap this would close is narrower than for a unit reviewed only by its author.
- **u7 red suite never existed** — same shape as u5's, from `.agent/contracts/m1u7.md`
  (M1 review X16). Accept: as above against u7's 34 predicates. `pri` low — u7 is a `docs`
  tier unit whose claims are now carried by `copy:check`, `contrast:check` and
  `presentation:check`, so a red suite buys less here than on a kernel unit.
- **Answer-oracle scan skips generated assets** — `tools/kb/check.mjs:21` scans sources for
  the answer-oracle literal but not the runtime-loaded `kb/generated` production assets, so
  a generated file could acquire the forbidden byte without the gate naming it (M1 review
  X02). Current generated bytes are clean and `kb:reproduce` bounds the blast radius.
  Accept: `kb/generated` joins the answer-oracle coverage; planting the literal in a
  generated file gives `pnpm kb:asset-check` rc 1, and restoring gives rc 0. `pri` med.
- **One protocol arm of twelve is clone-tested** — every `EngineRequest`/`EngineResponse`
  member is structured-clone-safe today, but `tests/engine-session.test.ts:279` clones a
  single query response, so a non-cloneable field on an untested arm stays green until it
  crosses a real worker boundary (M1 review X03). Accept: a table-driven case holds all 12
  discriminants, clones and deep-compares each, and a non-cloneable-field mutant in any row
  turns it red. `pri` med.
- **Built-site browser prologue is duplicated** — `tools/smoke.mjs` and
  `tools/browser-check.mjs` each repeat the temp-root, `cp dist`, launch, `pageerror` and
  teardown sequence although `tools/browser.mjs` already owns `serve`, `launch` and
  `failWith` (M1 review X19). Accept: one `withBuiltSite` helper in `tools/browser.mjs`
  leaves each script its scenario alone, and both success paths plus both negative controls
  still hold. `pri` low.
- **Comments carry provenance and restate purpose** — ten file headers say what their module
  is rather than why it is peculiar, and eight comment sites cite review rows instead of
  stating a timeless constraint (M1 review X20); this session's own new headers are in
  scope. Accept: the ten what-only headers are gone, the eight provenance sites read as
  current constraints with no row or history reference, and the adjacent why comments
  survive byte-for-byte. `pri` low.
- **Browser and research evidence is branch-only** — five browser claims (R38, R39, R41,
  R42, R45) rest on `tools/probe-u3.mjs` at `wt/rev-m1u3-4` `48008d3` (derived from
  `tools/smoke.mjs`; `node tools/probe-u3.mjs <ROW>` drives built output in a real browser
  after copying it into `tools/`), and two probes on `res-m1-*` branches
  (`.claude/rules/waves.md`); deleting a branch makes seven claim families non-rerunnable
  from committed state (M1 review X24). Accept: one typed browser harness in `tools/` covers
  all five rows, and the `res-m1-*` probes are either ported with their commands or every
  durable claim resting on them is pruned. `pri` med.

- **Owned PDF viewer** — M2 u7 ships a native `<iframe>` at `#page=N`, so the viewer is a
  black box: no assertion can read the displayed page, and the passage cannot be
  highlighted inside the PDF. PDF.js was rejected on cost — +504727 B gzip, 34.78 MB
  unpacked, and an engine range that excluded the Node 20 then pinned. Accept: an owned viewer
  renders the coverage row's physical page, a browser check reads the rendered page number
  and the highlighted region from the DOM, `pnpm gate` still runs under the pinned runtime, and the
  viewer's bytes load only after the user activates the page. `pri` low.
- **Generation-scoped proof cache** — every selection re-proves, and the worst measured
  synchronous proof step is 291.419 ms, which no cooperative cancel can interrupt.
  Re-selecting a solution already proved in the same session pays that cost again.
  Accept: re-selecting a proved solution issues no meta-interpreter call and returns the
  byte-identical proof; a changed KB input hash empties the cache, proven by a test that
  rebuilds the image and reads a miss. `pri` low.
- **Corpus-wide provenance browser** — the M2 ladder resolves the SELECTED solution alone,
  so the other 336 documents' coverage rows, regions and alignment are reachable only by
  asking a question that reaches them. Accept: a document-first view lists every document's
  coverage rows and opens each one's passage and page through the same resolver the ladder
  uses, adding no eager asset fetch to the answer path. `pri` low.
- **Recorded measurements have no mechanical owner** — `.claude/rules/` carries exact
  censuses (bag members, schema clause counts, derivable-solution counts, graph node/edge and
  implication splits, modal-context counts, clause-line total, content sites/premises/
  assumption leaves, manifest asset count) behind a prose rule that says to re-derive them
  whenever a unit ships a new class. Every one of the pre-M5 figures drifted silently through
  M2-M4 (expedited review C5), because prose does not run. Volatile totals were dropped in
  the memory retirement and now carry their own command instead (`du -sb dist`,
  `stat -c %s`, `jq '.assets|length'`), so this entry owns the stable censuses alone.
  Accept: one script re-derives each recorded figure from a built `kb/generated` plus `dist`,
  compares it to the value parsed out of the `.claude/rules/` file that states it, and exits
  nonzero on any mismatch; it names the rules file and line for each mismatch, and it runs in
  `pnpm gate` only if a build is already present, otherwise beside `kb:reproduce`. `pri` med.
- **Two tests time out under parallel execution** — `pnpm test` passed 291/293
  with two 5-second timeouts (`V11 has zero axe`, `fails kb:asset-check on a
  static import`); both pass when rerun in isolation, so the suite is
  order/parallelism sensitive rather than broken. A flaky gate step erodes every
  claim the gate carries. Accept: the two tests pass 20 consecutive full-suite
  runs at the committed worker count, with the shared resource they contend on
  named in the fix. `pri` med. **Fix landed, proof owed.** The shared resource is CPU, spent
  by the tests' own work: each `kb-reach` case spawned a full `kb:asset-check` (5.64 s wall
  loaded) to grade a source scan, now `--scan-only` (0.92 s); V11 ran 11 axe scans in one 5000 ms
  case, now one case per state, scans serialized (axe-core runs one at a time, so an overrun
  cascaded as `Axe is already running` into every later case) and axe warmed in a hook. Owes the
  20-run proof: at external load avg 27–33 on 8 cores, 5 runs before the serialization lost all
  11 V11 states twice to that cascade, and every run timed out other suites (next row).
- **`smoke` + `browser:check` ship no firing input** — both are browser lanes outside
  `pnpm gate`, and `.claude/rules/gate.md` `Firing inputs` carries them as its two open rows,
  so each reports a count it has never proved it can refuse. Accept: each reddens on a
  mutation its own lane runs — a pvm-stripped `dist` copy, a renamed woff2 — and joins that
  table with the control that fired. `pri` med.
- **The `## Index` under-counts the queue** — it promises one line per `high` + `med` row,
  and 25 such rows reduce to 22 index lines, so some queue items share a line or have none.
  Accept: one command derives the index from the queue rows, and a `high`/`med` row added
  without its line fails; the regenerated index round-trips to the same row set. `pri` low.
- **Twelve shipped bounds have no owner** — a legitimate change updates the constant instead
  of being refused. Worst first: `src/graph/SemanticGraph.svelte:106`
  `relationPool.slice(0, 60)`, which truncates a node's relation list with no indication, then
  `model.ts:3,4,6,465,496`, `SemanticGraph.svelte:111,153`, `canvas.ts:267`,
  `QuestionCombobox.svelte:25`, `client.ts:40,50`, `session.ts:108`,
  `DemoController.svelte.ts:34`. Owner search rc=1 each; `DEFAULT_NEIGHBOR_LIMIT` control
  rc=0. The graph subset is u11→u13 scope and lands there. Accept: each names an owner in
  `.claude/rules/` or `.agent/contracts/` whose search returns rc 0, and the 60-relation cap
  either surfaces its truncation or is contract-owned. `pri` med.

- **71 operator contexts have no edge in the shipped graph** — 64 negation (`-`) and 7 `can`,
  i.e. 41% of the corpus's 156 negation contexts, sit as operator-context nodes nothing
  connects. They are the body-level scopes like `guideline_operator(actual, C, -)` whose
  identity binds at query time, with entities asserted inside `C`. u11 measured them and
  emitted 71 covering body edges; **the user ruled leave them orphaned**, so the edge
  population stays at 20,964 total / 1,193 operator and u11's S3 relaxed to one-way linkage
  with the unreferenced-record count pinned. The cost is that a projection can draw a direct
  edge past a negation the KB asserts, which is what `wt/rev-sem-2`'s hidden-negation reds
  describe. Accept: either the 71 contexts carry an edge and `tests/kb-derived-assets.test.ts`
  records the moved counts with the original firing, or a committed check proves no shown path
  can skip a negation context that has no edge. `pri` med.

- **The independent projection oracle lives on a branch alone** — u12's differential ran
  `tests/graph-projection.oracle.test.ts` (branch `wt/orc-proj` `1a893b1`) against the shipped
  model: 19 passed / 5 failed, every failure adjudicated for the shipped side. Three of the
  five are one stale lookup — the oracle finds an edge by `label === 'argument 1'`, while
  `label` is now relation + ordered scope per `.agent/contracts/m5u8.md:90-97`. It does not
  ship in u12 because editing a teammate's oracle until it passes and then grading the
  projection with it grades a check MAIN bent. Accept: the three lookups match on `relation`,
  the suite runs 24/24 green against the shipped model from the primary tree, and it joins a
  declared `binding:check` register. `pri` med.

- **38 shortcut edges join scopes that contradict rather than nest** — of the 736 spanning
  occurrences, 698 have a target scope that EXTENDS the source's and 38 have neither as a prefix
  of the other, e.g. source `[should]` against target `[-, may]`. Those 38 are a producer
  question, not a rendering one: `tools/kb/graph.mjs:398` synthesizes a `condition supports`
  shortcut between two scopes the KB never joins, which is the S12+ site under a new name. u13
  SHOWS both ends so nothing is silently dropped, and the shipped edge population stays at
  20,964 — the user ruled the investigation queued rather than widening u13. Accept: each of the
  38 either carries a source-derived justification for joining its two scopes, or the synthesis
  declines to emit it and `tests/kb-derived-assets.test.ts` records the moved counts with the
  original firing. `pri` med.

- **`graph:check`'s spanning-scope grader is edge-blind** — review row `G3`.
  `SPANNING_SCOPE_READINGS` declares `edge:512:12`, but the probe returns label TEXT only, so
  `tools/graph-check.mjs:891` takes the first label carrying the same relation and never binds
  the declared edge. At `44406bd` both forward readings graded
  `condition supports · negated → should` while the declared edge reads
  `condition supports · negated → negated · should`, and both reverse readings were `null`,
  which `gradeSpanningScope` accepts and still counts — so the summary says four readings
  passed when none of the four was the declared one. `.claude/rules/gate.md` claims each
  refusal NAMES the case and the edge; that claim is what fails here. Accept: the probe returns
  `data-edge-id`; the grader requires a non-null row in BOTH directions and compares each exact
  asset-derived reader-relative label; a wrong edge and a missing reverse row each redden BY
  ID. Red witness `tests/rev-graph-g3.test.ts:20` at `wt/rev-graph` `ace618a`, all 4 readings.
  `pri` med.
- **Three `kb:asset-check` root tables grade nothing when emptied** — review row `C2`.
  `SCAN_ROOTS` is guarded, but `PRODUCTION_ROOTS`, `SERIALIZE_ROOTS` and `QUESTION_ROOTS`
  (`tools/kb/check.mjs:28`) each exit 0 with the table never named, while the step still prints
  its count — the exact shape `.claude/rules/gate.md` `Firing inputs` forbids, and the shape the
  `SCAN_ROOTS` row was added to close. Accept: each of the three refuses an emptied table by its
  OWN name through `requireFiring`, and the step's success line names every control that fired.
  Red witness `tests/review-assurance-c2.red.test.ts` at `wt/rev-assurance` `5c97965`, which
  mutates the real checker rather than a copy. `pri` med.
- **Two registry rows say `deferred` and cite no queue row** — review row `C5`.
  `docs/claims.md:72` (R003) and `:89` (R020) name `none` as the command and `deferred — …` as
  the disposition, but neither cites a `.agent/deferred.md` row and no row covers either
  subject. `.agent/contracts/m5u15.md:39-41` R2 requires the citation, so the pair is honest in
  shape and untracked in substance: nothing will ever re-derive the catalog-fragment claim or
  the proof-RPC failure copy. Accept: both subjects carry a queue row with its own acceptance
  check, both dispositions cite it by name, and `claims:check` refuses a `deferred` disposition
  that names no row. `pri` med.
- **u13's firing record names no base revision** — review row `C6`.
  `.agent/contracts/m5u13.md:102` records the perturbation, the reproducing command, rc 1 and
  the assertion text, but no revision to apply them to, and `0d5f4c1` omits base `3c4c17c` from
  its body. `.claude/rules/waves.md` wants both halves. The other four contracts from u11 on
  carry a substantive witness, `m5u15.md:62-68` in different WORDS than the declared form —
  which is the second half of this row: the census in the old `.agent/spec.md` measured the
  PHRASING `at base <sha>`, so it under-reported substance and re-staled itself on every
  commit. Accept: `m5u13.md`'s record names its base revision; the coverage claim is re-derived
  by a command rather than written down as a total, or it is dropped. `pri` low.
- **Two queue rows may already be satisfied** — review row `C10`.
  `Boot-error recovery` (`:92`) and `Boot carries no deadline` (`:157`) both look closed in the
  tree: `src/demo/RunControls.svelte:53` ships the retry control and `src/engine/client.ts:40`
  arms `BOOT_DEADLINE_MS`. Neither row was ever graded against its OWN acceptance text, and the
  second's text expects a hung boot to settle as `code: 'worker'` while `client.ts:221` emits
  `code: 'boot'` — so the row and the implementation disagree on the settled value and one of
  them is wrong. Accept: each row's acceptance check is run as written and the row closes on
  its own result, or its text is corrected to the value the contract actually owns and then
  run. `pri` low.
- **`gate.md`'s static-analysis bullet overstates its own completeness** — MAIN finding,
  security-vocabulary lane. The `lint` bullet ends `Every remaining exception is one inline
  disable carrying its reason`, which is false: `eslint.config.js:54` turns
  `security/detect-unsafe-regex` off for `src/questions/advice.ts` through per-file CONFIG,
  over a `src/**` path the same bullet says keeps its rules on. The config's own comment gives
  the sound reason — `advice.ts` is byte-frozen against `22053ef` by `clinical-records` T9 — and
  that reason is exactly what the law file omits. All 11 genuine inline disables DO carry
  theirs. `docs/claims.md:135` R066 rules the whole bullet `true` on receipt `pnpm lint`, which
  passes either way and cannot reach the sentence. Accept: the bullet names the `advice.ts`
  config exception and why it cannot be inline, and `pnpm claims:seed` re-derives R066 so the
  re-worded claim is adjudicated afresh. `pri` low.
- **A registry command cell cannot hold a pipe** — `tools/claims-sweep.mjs` parses the
  `command` and `disposition` cells as `([^|]*)`, so a command carrying an escaped `\|` grades
  clean under `claims:check` but loses its verdict on the next `claims:seed`: the claim key
  swallows half the command and the row drops to `unknown`. Measured on R209 with
  `git show HEAD:CLAUDE.md \| cmp - CLAUDE.md`: check rc 0, seed → `unknown | unknown`, check
  rc 1. Accept: a row whose command holds `\|` survives `claims:seed` byte-identical, or
  `claims:check` refuses the pipe by row id. `pri` low.
- **`spec.md` `Tasks` has no mechanical owner** — nothing refuses a spec whose open unit is not
  a `- [ ]` row, whose ticked row carries no SHA, or whose last line stops pointing at
  `.agent/deferred.md`. The template refresh proved `Deferred` → `Tasks` preservation with a
  scratch-local script, `.scratch/refresh/unit-ids.py` (old ids vs `Tasks` ∪ `Phase`, backticked
  spans + numbers, two planted-loss controls rc 1). Accept: one committed command grades that
  layout inside `pnpm gate`, and each of the three planted defects reddens it by name. `pri`
  low.
- **`waves.md` `Report grading` and the `reviewer` role disagree on verdicts** — the law's
  `--verdict` form wants the finding cell to open `pass:` or `fail(low|med|high):`, while
  `~/.claude/agents/reviewer.md` writes `pass` | `finding` with severity `blocker` | `major` |
  `minor`. A reviewer following its role fails the repo's grader. Accept: `waves.md` names the
  one vocabulary a reviewer brief carries, and a role-format verdict table grades clean under
  `node tools/validate-report.mjs --verdict`. `pri` low.
- **The judgment Worker runs locally alone** — user ruling deferred the Cloudflare deploy and
  stopped Pages publishing, so free-text intake exists only under `pnpm intake:dev` + Vite's
  proxy. `worker/index.ts` spends one global limiter bucket (`key: 'intake'`), correct for one
  local caller and wrong for a public one. Accept: a deployed Worker answers every W1–W6 case of
  `tests/intake-worker.test.ts` from its own origin, the limiter keys per client
  (`CF-Connecting-IP`), `ALLOWED_ORIGINS` names the published page alone, and the published
  page reaches it under its `connect-src`. `pri` low.
- **The selector's trigger-id mutant has no gate-resident control** — review INT-F1 showed the
  ORACLE-S differential passed a selector that read one fixed trigger id; the fixture now varies
  ids and the mutant dies, but the only proof is `wt/reviewer-3` `40fd9d6`
  `tests/zz-review-intake-mutation.test.ts`, which spawns nested vitest runs. Accept: a gate
  step or `binding:check` control plants that mutant and requires the selector suites to fail,
  naming the case. `pri` low.
- **A section "yes" selects every pain-compatible unconditional rule of that section** — 95 of
  the 97 derived
  rules the held-out gold does not list are section-triggered (`.claude/rules/proof.md`), so
  derived-rule precision on the 30 held-out cases is 143/240. Accept: an intake change lifts
  precision on `pnpm intake:probe` without lowering recall below 143/163, re-derived through
  `tests/intake-replay.test.ts`. `pri` low.
- **Improper-list encode drops a falsy tail** — swipl-wasm 8.0.7's `toList` tests `if(tail)`,
  so a tail that is the atom `''` or the integer `0` becomes `[]`: `createEncoder` turns `[a|'']`
  and `[a|0]` into `[a]`, breaking u2 P3.7 decode→encode→re-query identity on 4 of 115 literal
  variants. No shipped answer term carries such a tail. Red witness `tests/zz-u2-red.test.ts:125`
  on `wt/tester-d11` `6529dea`. Accept: `createEncoder` builds improper-list cells without
  `toList` (e.g. as `'[|]'/2` compounds), so `[a|'']`, `[a|0]` and the two generated nested terms
  re-query as structural variants, with that witness green in a merged suite. `pri` low.
- **Live suites time out under heavy external CPU load** — at load avg 27–33 on 8 cores (other
  sessions' builds), each full-suite run failed 1–20 tests beyond the two the row above names:
  `graph-live` "produces a concept-first answer map" (7784 ms against 5000), live clinical proofs
  exceeding the shipped 1000 ms proof budget, `engine-u2-port` round trips, and the axe sweeps of
  `question-combobox.dom` B3, `provenance-ladder.dom` C9, `semantic-graph.dom` and `intake-panel`
  U6. A gate run is green again once the load falls (906/906 at avg 7–15). Accept: the full suite
  passes 20 consecutive runs at load avg ≥ 3× cores with no timeout raised, or a user-approved
  gate timeout policy is recorded with its original firing. `pri` med.

## Index — one line per `high` + `med` row

Defect and acceptance check. Full text is above in this file; the `low` rows are prose only.

| defect | accept |
| --- | --- |
| **high** A WASM abort strands the worker, in Node too | abort = own terminal state, worker recreated, next query reports 337 docs |
| A QLF fallback import doubles the engine | it loads only on saved-state failure; an untaken fallback ships no bytes |
| Heap limit is proven by a synthesized outcome alone | a live trip reads `limit: 'heap'` (blocked behind the abort row) |
| Boot is terminal on failure, unbounded on silence | a failed or hung boot settles bounded as one alert with a retry |
| Wordmark, forbidden claims, descriptor + fallback stacks rest on one reading | each decided by a committed check |
| The inference budget re-arms per solution | a goal whose total exceeds budget reaches `limit:'inference'`, or the bound is contracted |
| The answer-oracle scan skips `kb/generated` | the literal planted in a generated file gives `kb:asset-check` rc 1; restoring rc 0 |
| One of twelve protocol arms is clone-tested | all 12 discriminants clone + deep-compare; a mutant reddens it |
| Five browser claims + two probes live only on `wt/` branches | one typed `tools/` harness covers all five; probes port or claims prune |
| The `.claude/rules/` censuses have no mechanical owner | one script re-derives each from `kb/generated` + `dist`, naming mismatches |
| Two tests time out under parallel execution | both pass 20 consecutive full-suite runs at the committed worker count |
| 9 of u5's 26 combobox predicates rest on jsdom stubs | a Chromium test drives real input, reads the AX tree, runs axe |
| `smoke` + `browser:check` ship no firing input | each reddens on a mutation its own lane runs, and joins gate.md `Firing inputs` |
| Ten shipped bounds have no owner | each names an owner whose search returns rc 0; the 60-relation cap surfaces truncation or is contract-owned |
| 71 operator contexts have no edge, 64 of them negation | the 71 carry edges with the moved counts recorded, or a check proves no shown path skips an edgeless negation context |
| The projection oracle lives on a branch alone | its label lookups match on `relation`, 24/24 green in-tree, joined to a declared register |
| 38 shortcut edges join scopes that contradict rather than nest | each carries a source-derived justification, or the synthesis declines to emit it and the moved counts are recorded with the original firing |
| `graph:check`'s spanning-scope grader is edge-blind | probe returns `data-edge-id`; both directions non-null; a wrong edge and a missing reverse row redden by id |
| Three `kb:asset-check` root tables grade nothing when emptied | each refuses an emptied table by its own name; the success line names every control that fired |
| Two registry rows say `deferred` and cite no queue row | both subjects carry a queue row, both dispositions cite it, `claims:check` refuses an uncited `deferred` |

## Accepted-open

Review rows ruled open rather than fixed. Each carries its acceptance check in
`.agent/archive/review-expedited.md`; none is current scope.

A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 · C1 C4u1 C4u4 C4u5 C6.

**S9 and S13+ left this set in u12** by user ruling: `binding:check` fails the gate on any red
case in its run, so a tree holding them red can never be gate-green, and xfail, a split suite
or branch-only storage each stop executing the defect. S9's headline now counts entity and
event nodes alone and both locales name what the hidden totals contain; S13+ is refused at
`parseEdge`, where `guideline_arg/4` and `guideline_pp/4` constrain their source to an event —
5,002 constrained edges, 0 violations across the shipped 20,964.
