# polish register

Off-spine improvements. Each entry carries the acceptance check that closes it and
a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up.

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
  `spike-m1u1-det` (9/12) were stopped at the reserve. Accept: both reports pass
  `validate-report.py` with rc 0, or the open rows are re-derived and their
  findings folded into memory. `pri` low.
- **QLF fallback delivery path** — the fallback needs the 6.2 MB `swipl-bundle`,
  so a naive import would double the shipped engine. Accept: the fallback engine
  loads only when the saved state fails, and a production build that never takes
  the fallback ships no bytes of it. `pri` med.
- **u2 red suite** — `test-m1u2` delivered 4 committed batches on branch
  `wt/test-m1u2` (worktree at the pre-u2 commit, so it never ran). Accept: the
  suite runs in the primary tree, every case is red for a contract reason or
  green, and the cases MAIN's own suite does not already cover are merged. `pri` med.
- **Integral floats decode as integers** — SWI's `1.0` and `1` both arrive as JS
  `1`, so `decodeTerm` reports `integer`. The shipped corpus has no floats.
  Accept: a float binding decodes as `float`, proven on a goal returning `1.0`,
  without adding a per-binding engine call to the common path. `pri` low.
- **Report validator splits on escaped pipes** — `.scratch/validate-report.py`
  `cells()` raw-splits on `|`, so a `\|` inside a finding shifts the evidence
  column. Accept: a finding containing an escaped pipe grades identically to one
  without, and the fix ships with the validator's port into the repo. `pri` med.
- **u3 heap limit is unit-tested only** — `P2.7` is covered by `readOutcome` over a
  synthesized `resource_error(memory)`, not a live trip. Accept: a committed test drives
  real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate. `pri` med.
- **u3 red suite completion** — `test-m1u3` partially filled its 35-case skeleton,
  committed at `22c8b97` on `wt/test-m1u3`. Accept: the cases MAIN's 31 do not cover run
  in the primary tree, red for a contract reason or green. `pri` low.
- **Browser hard-kill proof** — every terminate/recreate number comes from Node
  `worker_threads`; the product ships browser `Worker.terminate()`. Accept: a browser run
  kills a hostile goal and reports the recreated engine at 337 documents. `pri` med.
- **Solution streaming** — u2 delivers one batch per query. Both spikes measured
  streaming as cheap (0.0414 vs 0.0345 ms/query) and useful for early answers.
  Accept: solutions render as they arrive, and a queued cancel still cannot
  interrupt an in-flight synchronous `next()`. `pri` low.
- **u4 red suite** — `test-m1u4` authored a diff-blind suite on branch `wt/test-m1u4`
  from `.agent/contracts/m1u4.md`; MAIN reached the reserve before harvest. Accept: the
  suite runs in the primary tree, every case is red for a contract reason or green, and
  the cases MAIN's 18 do not cover are merged. `pri` med.
- **Full answer-artifact reproduction** — u4 binds the byte claim to the `result/1`
  argument; both spikes also reproduced the whole 734-byte committed file. Accept: the
  service emits the complete `'$guideline_answers'` envelope, or the contract records why
  the bag's `query_sha256` stays out of the runtime. `pri` med.
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
  Accept: `tools/visual-qa.mjs` passes `pnpm check` and `pnpm lint`, `pnpm visual-qa`
  exits 0, and its JSON reports `overflow=false` for every state at 320, 375 and
  1280 px. `pri` low.
- **Axe over the two new disclosures** — u6's `V11` axe sweep predates the About
  panel and the canonical-answer `<details>`. Accept: a dom test runs `axe.run`
  with each disclosure open and closed and reports zero violations. `pri` med.
- **Copy validator reaches only two files** — `tools/copy-check.mjs` grades
  `copy.ts` and `describe.ts` by path, so prose added to a new component escapes
  it. Accept: the validator derives its file set from the source tree, and a new
  component carrying a 30-word sentence fails the gate. `pri` med.

- **Inference budget re-arms per solution** — `call_with_inference_limit/3` is
  applied per solution, so the inference budget bounds one step and not the whole
  request: 50 solutions of ~800 inferences each pass a 3000 limit, while one
  5000-deep step trips at 1000 (M1 review R06). Accept: a multi-solution goal
  whose total inferences exceed the budget reaches `limit: 'inference'`, or the
  contract records that the bound is per-step by design. `pri` med.
- **Smoke negative control is weak** — removing `kb/generated/kb.pvm` alone
  leaves `pnpm smoke` at rc 0, because it rebuilds only when `dist/` is missing
  and otherwise serves the stale hashed asset (M1 review A100). Accept: the smoke
  fails when the served `dist/` is stale against the current KB input hash, and
  the control is exercised without deleting `dist/`. `pri` med.
- **Mutation harness is scratch-local** — `.scratch/verify-fixes.py` is what proves the
  M1-review fix tests bind to their fixes (45 mutants, 45/45 RED), but it is gitignored,
  so the claim does not rerun from committed state (M1 review session 2). Accept: a
  committed mutation runner takes a mutant table, restores every file it touches, and a
  documented command reproduces the full kill result from a clean checkout. `pri` med.
- **Humanizer label test asserts its own artifact** — `tests/questions-live.test.ts:294`
  matches `/^\S+ — sentence \d+, \w+ \d+$/u`, a grammar that exists only in
  `src/questions/humanize.ts`, so the expectation comes from the artifact under test.
  D8 constrains only what the humanizer may not know, so no external oracle exists
  (M1 review c20 register). Accept: the contract states the label grammar and the test
  cites it, or the test drops the shape assertion and keeps the `not.toContain` gloss
  checks that carry the real force. `pri` low.

- **Browser WASM abort leaves a dead session** — a runaway `assertz` aborts the WASM runtime
  in a browser and surfaces as `{code:'prolog', message:'Aborted()...'}`, so `limit:'heap'`
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
- **Memory carries history and duplication** — `.agent/memory.md` retains rejected-option and
  correction narrative, review-row origin stories, and restatements of package versions, the
  gate script and volatile totals, all of which ride every session's attached state (M1
  review X14). Accept: the file holds only constraints, non-obvious current facts and
  runnable evidence; every rejected-option story, correction story and package/script
  restatement is gone; closed-review narrative lives in `.agent/archive/`. `pri` med.
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
  R42, R45) rest on `tools/probe-u3.mjs` at `wt/rev-m1u3-4` `48008d3`, and two probes on
  `res-m1-*` branches; deleting a branch makes seven claim families non-rerunnable from
  committed state (M1 review X24). Accept: one typed browser harness in `tools/` covers all
  five rows, and the `res-m1-*` probes are either ported with their commands or every
  durable claim resting on them is pruned. `pri` med.
