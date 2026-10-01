# Deferral queue

The queue `.agent/spec.md` `Tasks` points at: off-spine improvements, held out of the
attached state because a queue only grows. Each entry carries the acceptance check that
closes it and a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up. A row closes on its own
acceptance check and leaves in that commit; the index at the foot collapses the `high` +
`med` set to one line each.

- **Japanese copy has no register grader** — `copy:check` decides parity alone; the ≤20/≤25
  word limits cannot port to a language without word spaces, so nothing mechanical holds
  `ja.ts` to です・ます or to a length. Accept: a Japanese-side rule set the gate can decide
  — a per-sentence character ceiling, a fixed-terminology table drawn from
  `.claude/rules/i18n.md`, and one sentence-final-form check — with a positive control per
  rule. `pri` low. **Owes approval of the contract** `.agent/contracts/mnt-d3.md`: its J1
  ceilings (40 / 60 units), J2 term table and the three Japanese copy edits J2 forces are
  MAIN's numbers and a visible text change, so no production edit precedes the ruling.
- **Phased boot telemetry** — replace the single boot spinner with ordered
  progress phases. Accept: each phase emits one accessible status event in
  order, and no percentage is reported that the runtime does not supply. `pri` low. **Owes a
  ruling**: the phases replace the accepted status line's boot text, a visible change. The
  phases the runtime supplies: image fetch (bytes only where the response streams them),
  `loadImageDefault`, contract verification; the worker protocol gains a `progress` response,
  which joins the d37 clone table.
- **QLF fallback delivery path** — the fallback needs the 6.2 MB `swipl-bundle`,
  so a naive import would double the shipped engine. Accept: the fallback engine
  loads only when the saved state fails, and a production build that never takes
  the fallback ships no bytes of it. `pri` med.
- **Integral floats decode as integers** — SWI's `1.0` and `1` both arrive as JS
  `1`, so `decodeTerm` reports `integer`. The shipped corpus has no floats.
  Accept: a float binding decodes as `float`, proven on a goal returning `1.0`,
  without adding a per-binding engine call to the common path. `pri` low. Red witness:
  `tests/zz-u2-red.test.ts:107` on `wt/tester-d11` `6529dea` — `1.0`, `0.0` and `-1.0` decode
  as `integer` while live `float(X)` succeeds. **Owes a ruling on the means**: swipl-wasm's
  `toJSON` has no float option, so the zero-call fix overrides `prolog.get_float` on the
  instance (its one caller is `toJSON`'s `PL_FLOAT` arm) to return `{$t:'f',v}` — measured:
  `X is 1.0, Y = f(2.0,[3.0])` decodes every float, nested ones included, with no added call.
  That is a FOURTH undeclared surface beside the three `.claude/rules/engine.md` rules
  acceptable, so `engine:check`'s allowlist widens. The declared-API alternative computes float
  paths in Prolog inside `meteredGoal` and must subtract that scan from the inference meter.
- **u3 heap limit is unit-tested only** — `P2.7` is covered by `readOutcome` over a
  synthesized `resource_error(memory)`, not a live trip. Accept: a committed test drives
  real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate. `pri` med.
  **Blocked on the `high` abort row below**: at swipl-wasm 8.0.7 real exhaustion aborts the
  runtime in Node too and never raises `resource_error(memory)`, so `limit: 'heap'` is
  unreachable live until that row classifies the abort. The fast live half is committed —
  `tests/engine-heap.test.ts` drives the trip in ~1 s behind a 1900 MB `_malloc` reserve and
  pins today's abort; it owes only the `limit: 'heap'` read.
- **Solution streaming** — u2 delivers one batch per query. Both spikes measured
  streaming as cheap (0.0414 vs 0.0345 ms/query) and useful for early answers.
  Accept: solutions render as they arrive, and a queued cancel still cannot
  interrupt an in-flight synchronous `next()`. `pri` low. **Owes a ruling**: rendering each
  solution as it arrives changes the accepted answer panel during a run — a visible change the
  spec reserves. The cost on the engine side is a `solutions` progress response per answer
  (joining the d37 clone table), and each partial answer still renders only once its own
  display passes the request deadline.
- **Browser WASM abort leaves a dead session** — a runaway `assertz` aborts the WASM runtime
  — in Node too at swipl-wasm 8.0.7, pinned live by `tests/engine-heap.test.ts`, which is the
  fix's red witness — and surfaces as `{code:'prolog', message:'Aborted()...'}`, so `limit:'heap'`
  never fires and `EngineClient` keeps the dead worker: every later query fails — aborting again
  or, run to run, reporting a heap limit from a runtime left with no memory — breaching u3 P3.4
  (M1 review R45). Unreachable from M1's six bounded catalog goals;
  free-text intake is what makes it reachable. Accept: an aborted runtime reaches the client
  as its own terminal state that recreates the worker without a caller `reset()`, proven by a
  browser probe whose next query reports 337 documents. `pri` high, gated on free-text intake.
- **Font stack fallbacks and copy reach are unowned** — `presentation:check` grades faces,
  licences and containment, but D7's h1 wordmark, the framing copy's forbidden claims, the
  descriptor humanizer's rendered output and the three role tokens' system fallback stacks
  still rest on one reviewer reading them (M1 review U7-26, partly closed). Accept: each of
  the four is decided by a committed check — wordmark and forbidden-claim literals in
  `copy:check`, descriptor rendering in a dom test, fallback stacks in
  `presentation:check`. `pri` med. **Two of four decided**: the role tokens' stacks
  (`presentation:check` `STACKS`) and the accepted wordmark (`copy:check` `WORDMARK` — D7's
  verbatim was superseded by the accepted workbench redesign `3ed0c31`). **Owes the user two
  rulings**: (a) the forbidden-claim set — M1's were the trace and graph claims, both shipped
  features now; proposal: no shipped string names a milestone, unit or review id (`M1`–`M5`,
  `u12`, `R045`, `U7-26`); (b) descriptor rendering — no component renders `describeDescriptor`'s
  output any more, so retire the item, or remove the dead `descriptor` field it feeds.
- **Comments carry provenance and restate purpose** — ten file headers say what their module
  is rather than why it is peculiar, and eight comment sites cite review rows instead of
  stating a timeless constraint (M1 review X20); this session's own new headers are in
  scope. Accept: the ten what-only headers are gone, the eight provenance sites read as
  current constraints with no row or history reference, and the adjacent why comments
  survive byte-for-byte. `pri` low. **Eight of ten headers and all eight sites done; owes a
  ruling on the last two**: `src/questions/serialize.ts` and `humanize.ts` are byte-frozen
  against `22053ef` by `tests/clinical-records.test.ts` T9, an answer-path frozen surface, so
  deleting either header line is a grader change — unfreeze them, or let the headers stand.
- **Owned PDF viewer** — M2 u7 ships a native `<iframe>` at `#page=N`, so the viewer is a
  black box: no assertion can read the displayed page, and the passage cannot be
  highlighted inside the PDF. PDF.js was rejected on cost — +504727 B gzip, 34.78 MB
  unpacked, and an engine range that excluded the Node 20 then pinned. Accept: an owned viewer
  renders the coverage row's physical page, a browser check reads the rendered page number
  and the highlighted region from the DOM, `pnpm gate` still runs under the pinned runtime, and the
  viewer's bytes load only after the user activates the page. `pri` low. **Owes a ruling**: an
  owned viewer replaces the accepted ladder's native `<iframe>`, a visible change the spec
  reserves, and PDF.js — the one measured renderer — costs +504,727 B gzip. Node 24 has lifted
  the engine-range objection; the size and the visual change remain the user's call.
- **Corpus-wide provenance browser** — the M2 ladder resolves the SELECTED solution alone,
  so the other 336 documents' coverage rows, regions and alignment are reachable only by
  asking a question that reaches them. Accept: a document-first view lists every document's
  coverage rows and opens each one's passage and page through the same resolver the ladder
  uses, adding no eager asset fetch to the answer path. `pri` low. **Owes a ruling**: a
  document-first view is a new surface beside the accepted answer panel, ladder and graph, and
  its entry point changes the accepted page layout — where it lives and how it is reached is
  the user's call.
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
  can skip a negation context that has no edge. `pri` med. **Owes a ruling** (the check's predicate is unwritten
  acceptance): the 71 orphans sit in 60 sentences holding 268 shown edges, 116 of them without a
  negation, mostly legitimately positive — so a sentence-level predicate cannot decide "skips".
  A sound check needs the body literals each orphan scopes, which the shipped asset does not
  record: either the producer emits that literal set (asset change, edge population untouched)
  or the 71 covering edges return, which the standing ruling declines. The two concrete reds
  (`graph-semantics.review.test.ts:78`, `:103`) already ship green in the `MEANING` register.

- **The independent projection oracle lives on a branch alone** — u12's differential ran
  `tests/graph-projection.oracle.test.ts` (branch `wt/orc-proj` `1a893b1`) against the shipped
  model: 19 passed / 5 failed, every failure adjudicated for the shipped side. Three of the
  five are one stale lookup — the oracle finds an edge by `label === 'argument 1'`, while
  `label` is now relation + ordered scope per `.agent/contracts/m5u8.md:90-97`. It does not
  ship in u12 because editing a teammate's oracle until it passes and then grading the
  projection with it grades a check MAIN bent. Accept: the three lookups match on `relation`,
  the suite runs 24/24 green against the shipped model from the primary tree, and it joins a
  declared `binding:check` register. `pri` med. **Owes a ruling**: with exactly the three lookups moved to
  `relation` (8 lines) the oracle runs 19/24 at `6b1a5cf`; the 5 still red are P2 counts (stale
  `2630/1584` against today's `2668/1912`), P2 order (its fixture trips the scopes sortedness
  invariant), P3 modal force, P3 shortcut omission (wants `edge:512:12` absent, which P6
  forbids) and "names a directed support relation from its target perspective" (predates u13's
  reader-relative labels). m5u12 ruled the first, second and fourth for the shipped side, so
  24/24 needs edits to the teammate's oracle beyond the lookups — the user rules which.

- **The judgment Worker runs locally alone** — user ruling deferred the Cloudflare deploy and
  stopped Pages publishing, so free-text intake exists only under `pnpm intake:dev` + Vite's
  proxy. `worker/index.ts` spends one global limiter bucket (`key: 'intake'`), correct for one
  local caller and wrong for a public one. Accept: a deployed Worker answers every W1–W6 case of
  `tests/intake-worker.test.ts` from its own origin, the limiter keys per client
  (`CF-Connecting-IP`), `ALLOWED_ORIGINS` names the published page alone, and the published
  page reaches it under its `connect-src`. `pri` low. **Owes the user**: the deploy itself
  (account, route, the key as a Worker secret) and a limiter ruling — a per-client key alone
  lets many clients jointly spend the API key, so a public Worker likely needs a per-client
  bucket AND a global spend bucket. Already in place: `ALLOWED_ORIGINS` is a `wrangler.jsonc`
  var, so naming the published page is configuration, not code.
- **A section "yes" selects every pain-compatible unconditional rule of that section** — 95 of
  the 97 derived
  rules the held-out gold does not list are section-triggered (`.claude/rules/proof.md`), so
  derived-rule precision on the 30 held-out cases is 143/240. Accept: an intake change lifts
  precision on `pnpm intake:probe` without lowering recall below 143/163, re-derived through
  `tests/intake-replay.test.ts`. `pri` low. **Owes the user**: measured offline over the recorded
  judgments, no filter of the shipped selection can meet the check — holding recall at 143/163
  means dropping zero true positives, and 106 of them are section-triggered beside the 95 false
  positives. Section rules only where no condition of that section fired: 67/144 precision, 67/163
  recall; only where no condition fired at all: 51/109, 51/163; condition rules alone: 37/39,
  37/163. A lift therefore needs new per-rule judgment signal — a request change, which the
  user's selection-model ruling governs — and a live billed `pnpm intake:probe` to score it.
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
  U6; later also `engine-heap` "aborts the runtime … in under 5 s" (13 488 ms in a full run at avg
  ~13 against 590–812 ms alone) and the `intake-chunker` 750-description property (5070 ms). A
  gate run is green again once the load falls (906/906 at avg 7–15). Accept: the full suite
  passes 20 consecutive runs at load avg ≥ 3× cores with no timeout raised, or a user-approved
  gate timeout policy is recorded with its original firing. `pri` med.
- **Hand-run mutants and probes have no committed harness** — six registry rows rest on a
  mutation or probe run once and restored: the TypeScript 7 lint break, the rejected listbox
  click handler, the worktree `kb/generated` symlink failure, the u6 pre-lane byte comparison,
  the u7 gate mutants and the u9 canvas source controls. Accept: each joins `tools/mutants.mjs`
  (or a committed probe) and its registry row re-adjudicates to `true` on that command. `pri` low.
- **Upstream and design claims have no in-repo grader** — the registry's rows for the upstream
  export recipe, the sibling `ui.py` port source, the ≈1K-node analysis-tier priority, the
  "every human-facing string lives in `src/i18n/`" rule and the u6 catalog-consistency pass
  rest on judgment alone. Accept: each re-adjudicates to `true` on a committed command, to
  `historical`, or the rule is reworded to what a committed check proves. `pri` low.
- **A halting payload fails the producer as `[object Object]`** — a payload carrying
  `:- initialization(halt).` is refused by both `buildImage` and `buildQlf` (fail-closed holds),
  but Emscripten throws an `ExitStatus` object rather than an `Error`, so the build reports
  `[object Object]` (`.scratch/agents/researcher-d9/s11-results.json`, `tools/kb/produce.mjs`).
  Accept: a test over a halting payload copy requires `kb:build`'s refusal to name the halt
  and its exit status. `pri` low.
- **Inline-disable reasons have no grader** — `.claude/rules/gate.md`'s `lint` bullet says every
  remaining security exception is one inline disable carrying its reason; `pnpm lint` passes
  whether or not a reason is there, so the registry row reads it by hand. Three non-security
  disables carry none (`tools/clinical-reference.mjs:227,234`, `tools/kb/provenance.mjs:70`,
  the last byte-frozen by T9). Accept: a committed check (an ESLint directive-description rule
  or a scan in the gate) refuses an `eslint-disable` with no stated reason, with its firing
  input, and the frozen file's directive handled by ruling. `pri` low.

## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| QLF fallback delivery path | the fallback engine loads only when the saved state fails, and a production build that never takes the fallback ships no bytes of it |
| u3 heap limit is unit-tested only | a committed test drives real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate |
| **high** Browser WASM abort leaves a dead session | an aborted runtime reaches the client as its own terminal state that recreates the worker without a caller `reset()`, proven by a browser probe whose next query reports 337 documents |
| Font stack fallbacks and copy reach are unowned | each of the four is decided by a committed check — wordmark and forbidden-claim literals in `copy:check`, descriptor rendering in a dom test, fallback stacks in `presentation:check` |
| Two tests time out under parallel execution | the two tests pass 20 consecutive full-suite runs at the committed worker count, with the shared resource they contend on named in the fix |
| 71 operator contexts have no edge in the shipped graph | either the 71 contexts carry an edge and `tests/kb-derived-assets.test.ts` records the moved counts with the original firing, or a committed check proves no shown path can skip a negation context that has no edge |
| The independent projection oracle lives on a branch alone | the three lookups match on `relation`, the suite runs 24/24 green against the shipped model from the primary tree, and it joins a declared `binding:check` register |
| Live suites time out under heavy external CPU load | the full suite passes 20 consecutive runs at load avg ≥ 3× cores with no timeout raised, or a user-approved gate timeout policy is recorded with its original firing |

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
