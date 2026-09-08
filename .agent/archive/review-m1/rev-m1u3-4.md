# rev-m1u3-4 — adversarial review of M1.u3, final 14 rows

Check set = `.agent/contracts/m1u3-rev-checkset.md` (fixed, 45 rows). Sessions 1-2 adjudicated 31.
This report carries the 14 rows still `unknown`. Row text + "how to decide it" live in the check set;
do not restate them. Review target = `6132bc6`.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u3-4.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| R14 | pass: reset → 1 terminate, 1 respawn, fresh session+engine, refetch+reload, `booted` posted only after `load#2`; skewed replacement (336 docs) yields `contract` error, never ready | `tests/rev-m1u3-4-r14.test.ts` (2/2, rc 0); `/tmp/u34-r14.log` |
| R33 | pass: 10 committed test files / 177 tests rc 0; `kb:asset-check` rc 0 (incl. sibling scan); `build` rc 0; main chunk `index-BCXuUr5A.js` has 0 hits for swipl/SWIPL/_PL_/wasmMemory/Emscripten/loadImageDefault vs 5 in `worker-CcLwAgJw.js` | `npx vitest run $(git ls-tree --name-only HEAD tests/)`; `/tmp/u34-committed.log`, `/tmp/u34-asset.log`, `/tmp/u34-build.log`; `tools/kb/check.mjs:36` |
| R34 | fail(med): 3 of 4 accept clauses have direct committed real-PVM evidence; "hard cancel drops asserted state and returns a 337-document engine" has none — no committed test asserts an overlay, hard-cancels, and re-reads the count | see `### R34` |
| R35 | fail(med): battery covers 26 of 39 non-gate predicates by id; P4.4/P4.5/P4.7 have no committed test, P6.2-P6.5 are tool-decidable yet absent from `pnpm gate`, and 6 named Q-corpus cases are unexercised | see `### R35` |
| R36 | fail(low): comments, scope and spine are clean; one dead field, one under-described double mutation, and three parallel spellings of the same outcome union | see `### R36` |
| R37 | fail(low): the composition itself holds — distinct stack/depth/inference and engine-read stack restoration on the real PVM, and a working JS hard stop — but at `6132bc6` the hard-stop leg had Node evidence only; the browser leg exists solely as this session's uncommitted probe | `tests/rev-m1u3-4-r43.test.ts`; `tests/engine-budgets.test.ts:231`; `/tmp/u34-r39.log`; see `### R37` |
| R38 | pass: browser, built output — `repeat.` at cap 50 → `answer-cap` with exactly 50 solutions; at `wallClockMs` 1500 → `wall-clock` with 347 solutions in 2030 ms and a 10114-byte response | `node tools/probe-u3.mjs R38`; `/tmp/u34-r38.log` |
| R39 | pass: browser, built output — hostile single-step goal settled `wall-clock` at 1004 ms against the 1000 ms main-thread deadline while the worker soft check at 500 ms never fired; 21 main-thread ticks (26–1003 ms) ran during the block | `node tools/probe-u3.mjs R39`; `/tmp/u34-r39.log` |
| R40 | fail(med): the yield is a genuine macrotask and Node cancel-between-solutions holds, but browser cancel delivery between solutions is unproven, no goal in the reachable corpus is benchmarked, and D4's 62.00 ms cites a source that records 50.11 ms | `src/engine/session.ts:93`; `.scratch/agents/spike-m1u3-js.md:25`; see `### R40` |
| R41 | fail(low): 5/5 browser cycles terminate, respawn, drop the overlay and re-verify 337 from the replacement engine, but measured restart is 526.4-1732.5 ms (median 641.6) against D5's cited 181.75-261.58 ms, and post-termination CPU is unmeasured | `node tools/probe-u3.mjs R41`; `/tmp/u34-r41.log`; see `### R41` |
| R42 | pass: browser, built output — clean consult loads and answers; syntax-error and failing-directive consults both settle `consult` with the engine's own diagnostic text, poison the session, and a reset returns a 337-document engine with every probe clause absent | `node tools/probe-u3.mjs R42`; `/tmp/u34-r42.log` |
| R43 | pass: `terms.ts` byte-unchanged; identical bait text classifies three ways by structure alone (`failure`, solution binding, `limit:stack`), and the resource atom alone selects stack vs heap vs unclassified | `tests/rev-m1u3-4-r43.test.ts` (4/4, rc 0); `git diff --exit-code 2f78353 6132bc6 -- src/engine/terms.ts` rc 0 |
| R44 | fail(med): production calls `[Symbol.iterator]` and `close()`, both undeclared in `swipl-wasm` 8.0.7 and documented as load-bearing at `src/engine/session.ts:36-43`, so D8's "no undeclared-API dependency" is false as written; the granularity bound is also unbenchmarked outside 80 Node steps | `src/engine/session.ts:36-43`; `tests/rev-m1u3-2-live.test.ts:798`; see `### R44` |
| R45 | fail(high): in the browser a runaway `assertz` loop aborts the WASM runtime after 12088 ms and surfaces as `{code:'prolog', message:'Aborted(). Build with -sASSERTIONS for more info.'}` — no `limit:'heap'`, so the client's heap-triggered recreation never runs | `node tools/probe-u3.mjs R45`; `/tmp/u34-r45.log`; see `### R45` |

## Details

One `### <row id>` section per row needing a ruling. Omit sections for clean `pass` rows.

### R34

Clause-by-clause map over the committed suite at `6132bc6` (u3 impl commit = `6c2f716`):

| accept clause | direct committed evidence | verdict |
| --- | --- | --- |
| distinct typed limits | `tests/engine-budgets.test.ts:151` stack, `:137` depth, `:144` inference, `:158` wall-clock, `:126`+`:168`+`:179` answer-cap — all live against `kb.pvm`, each followed by `expectEngineSound()` | pass |
| overlay-dropping hard cancel with 337 readiness | none | **fail** |
| malformed goal + consult `ERROR` fail closed | `tests/engine-budgets.test.ts:300` (`guideline_document(` → `prolog`), `:323` (syntax-error consult → `consult`, then the next query on that session also errors `consult`) | pass |
| bounded `repeat` | `tests/engine-budgets.test.ts:253` `repeat,X=1.` at cap 3 → `answer-cap`, 3 solutions, engine sound | pass |

Clause 2 detail. `P4.5` and the `I` line "Hard-cancel recovery is proven by an overlay that
was observably present beforehand" have no committed test. The two committed hard-cancel
paths — `tests/engine-budgets.test.ts:476` (`P4.9`) and `:497` (`P2.7`) — drive `FakeWorker`,
which *replies* `{kind:'booted', contract: manifest.contract}`. The contract value is supplied
by the test, so nothing re-reads a rebooted engine and no asserted state is ever created or
observed missing. The only test that does this is `tests/rev-m1u3-2-live.test.ts:652`, a
predecessor reviewer probe that is uncommitted at the review target (branch `wt/rev-m1u3-3`).
Behaviour is not in doubt: that probe passes, and my `tests/rev-m1u3-4-r14.test.ts` R14a shows
the replacement genuinely refetches, reloads and re-verifies. The gap is that `pnpm gate`
proves neither.

R15 was ruled `pass` by `rev-m1u3-2` on that same uncommitted probe, so this finding does not
reverse it — R15 asked whether the behaviour holds, R34 asks whether committed evidence backs
the clause. Accepted defect R28 is adjacent but its acceptance check names the heap trip only;
MAIN may prefer to widen R28 rather than open a second row.

### R35

Predicate-to-test matrix, 43 predicates, 39 excluding the four `P7` gate commands.

Covered by an id-bearing committed test (26): P1.2, P1.3, P1.4, P2.1-P2.5, P2.8, P2.9, P3.1,
P3.2, P3.3, P3.5, P3.6, P4.1, P4.2, P4.3, P4.6, P4.8, P4.9, P4.10, P4.11, P5.1, P5.2, P5.3, P5.4.

Covered without an id (2): P2.6 by `tests/engine-budgets.test.ts:271` asserting
`kind === 'cancelled'`; P3.4 by `expectEngineSound()` at `:77`, called after most trips.

P6.1 covered by one payload at `tests/engine-session.test.ts:276` — a single `structuredClone`
round trip, not the per-union-member sweep the predicate states.

No committed test (11):
- **P4.4** hard cancel re-verifies the contract out of the rebooted engine. Both committed
  reset paths hand the client a hand-written `booted` reply, so the verification branch never
  runs. Covered uncommitted by `tests/rev-m1u3-4-r14.test.ts`.
- **P4.5** overlay drop — see R34.
- **P4.7** a request issued during the respawn window.
- **P1.1** every query request carries a budget (code side is accepted defect R01).
- **P6.2-P6.5** unbudgeted export surface, main-thread `swipl-wasm` exclusion, undeclared
  runtime API, `terms.ts` unchanged. All four are decidable by a script, and CLAUDE.md
  Engineering states deterministic checks own every rule a tool can decide with any uncovered
  invariant wired into the gate. `pnpm gate` runs prettier, eslint, svelte-check, copy-check,
  contrast-check and `kb:asset-check`; none of them decides any of these four. `tools/kb/check.mjs:36`
  covers only the `../cnl-ckc` sibling path. The `.d.ts` diff exists solely as an uncommitted
  reviewer probe at `tests/rev-m1u3-2-live.test.ts:798`.

Q-corpus, unexercised cases (6): all four budgets set low at once; a goal tripping depth and
inference simultaneously (precedence is encoded by the branch order in `readOutcome` and
asserted nowhere); a failing-directive consult (`P5.4` uses a syntax error only); an `ERROR`
arriving on `on_output` rather than `printErr` with the hooks isolated (both are always
installed together, so neither is shown to be load-bearing alone); cancel before boot; a
request issued during respawn. Budget maxima are partial — `budget()` starts from `BUDGET_MAX`
and maximum-plus-one is probed for `stackBytes` alone.

Verdict rationale: this is a strong live battery for the limit states, and the isolated-trip
and invalid-value corpora are thorough. It falls short of "full adversarial battery" on the
recreation half of the unit (P4.4, P4.5, P4.7 all unproven) and on delegating four decidable
invariants to a deterministic check.

### R36

Files in scope = the u3 implementation commit `6c2f716`: `src/engine/{budget,client,protocol,session,worker}.ts`,
`tests/engine-budgets.test.ts`, `tests/engine-session.test.ts`. The wider `2f78353..6132bc6`
range spans u2 and u4-u7 plus review infrastructure; those files belong to their own unit reviews.

Clean: comments carry the constraint or the measurement behind each peculiar decision
(`client.ts:4-7` the 25 ms vs 249.80 ms watchdog measurement, `session.ts:88-92` the macrotask
requirement, `session.ts:36-43` why `close()` is optional, `budget.ts:74-79` why `catch/3` wraps
the limits) rather than restating mechanics. No off-spine feature. No new cache or generated
path, so `.gitignore` and the read-exclusion controls need no sync. All added text is code
surface; no human-facing register applies.

Findings:
1. `src/engine/client.ts:41` declares `Pending.generation` and `:164` writes it, but nothing
   reads it — generation filtering runs off the closure variable at `:97`/`:101`. Dead field.
2. `src/engine/client.ts:283-285` comments a single generation retirement, but `#hardReset`
   increments `#generation` and the following `#ensure()` increments it again at `:97`, so a
   reset advances it twice. Monotonicity holds and nothing breaks; the comment under-describes
   the code, which is the sort of thing the comment rule exists to prevent.
3. Three parallel spellings of one outcome union: `EngineResponse` (`protocol.ts:76-85`),
   `SolveResult` (`session.ts:110-114`) and `QueryOutcome` (`client.ts:20-25`). The latter two
   are the former's arms minus `id`, plus an `error` arm for `QueryOutcome`; `session.ts:257`
   bridges them with `{ id, ...solved }`. P6.1 asks for one declaration site per shape, and a
   derived alias would remove the duplication.

None of the three changes behaviour, hence `low`.

### R37

D1's Prolog half is sound in the shipped composition. `wrapGoal` (`src/engine/budget.ts:83-86`)
nests `catch(call_with_inference_limit(call_with_depth_limit(...)))` in the same order as the
`s.compose` spike, and `tests/rev-m1u3-4-r43.test.ts` shows stack, depth and inference each
reaching their own state through that wrapper on the real PVM. Stack restoration is read back
from the engine at `tests/engine-budgets.test.ts:231`, not assumed, and `session.ts:#lowerStack`
re-reads the flag and throws if it disagrees.

D1's JS half — "JS owns wall-clock, the answer cap and every hard stop" — had only Node
evidence at the review target: `spike-m1u3-js.md` `s.watchdog` used `worker_threads`, and
`tests/engine-budgets.test.ts:489` drives a `FakeWorker`. `spike-m1u3-js.md:34` (`s.risk`) and
`:35` (`s.verdict`) both explicitly recommended a hostile-goal browser smoke and browser
hard-kill proof; neither was added. My R39 run supplies that proof and D1 holds under it
(1004 ms hard stop, worker terminated, replacement booted at 337 documents). The verdict is
`fail(low)` because the row asks whether *existing* evidence supported a browser guarantee; the
consequence is nil now that the browser leg is measured, and closing it is a matter of
committing a hostile-goal browser check.

### R40

Proven: `yieldToEvents` at `src/engine/session.ts:93` is `setTimeout(resolve, 0)`, a real
macrotask, and it sits on the only path between iterator steps, so the yield claim is
structurally sound. Node delivery between solutions is asserted at
`tests/engine-budgets.test.ts:271` with the cancel landing from a timer.

Unproven, three parts:
1. Browser cancel delivery between solutions. No committed test and no probe of mine covers it;
   my browser work drove budgets, recreation, consult and heap, not a mid-run cancel. D4 is
   stated as a property of the shipped worker's message queue, which is a browser object.
2. Reachable-goal granularity. D4 bounds cooperative latency at one solution step "on real
   goals" from 80 sampled steps. The reachable corpus is u4's six catalog goals; none is
   benchmarked per goal, in Node or in the browser, so the bound is a sample maximum presented
   as a corpus maximum.
3. The cited number does not match its source. `.agent/contracts/m1u3.md` D4 states 62.00 ms;
   `.scratch/agents/spike-m1u3-js.md:25` (`s.wallclock`) records "Real-KB max single `next()` =
   50.11 ms across 80 steps". The contract's headline granularity figure is unsupported by the
   evidence line it cites. `HARD_GRACE_MS` in `src/engine/client.ts:36` is commented with the
   same unsupported 62 ms.

### R41

Five cycles, browser, built output, each terminating a worker mid-hostile-loop:

| cycle | overlay before | in-flight query | reset | contract from engine | overlay after | restart ms |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `present` | `error` | `booted` | schema 1 / 337 | `failure` | 1732.5 |
| 1 | `present` | `error` | `booted` | schema 1 / 337 | `failure` | 935.5 |
| 2 | `present` | `error` | `booted` | schema 1 / 337 | `failure` | 526.4 |
| 3 | `present` | `error` | `booted` | schema 1 / 337 | `failure` | 641.6 |
| 4 | `present` | `error` | `booted` | schema 1 / 337 | `failure` | 556.5 |

Document count re-read from the replacement engine was 337 in all five. CDP reported 6 worker
target creations — one boot plus five replacements, matching exactly — and 3 closures inside the
capture window; the remaining closures arrived after the evaluate returned, so target removal is
observed but not counted 1:1.

Two gaps against the row's falsifier:
1. **Latency.** D5 cites recreation at 181.75-261.58 ms with a 335 ms browser boot floor.
   Measured browser restart is 526.4-1732.5 ms, median 641.6 ms — 2 to 7 times the cited range
   and above the cited floor. The behaviour is right; the number is a Node number presented
   without a browser qualifier, and a 0.6-1.7 s hard cancel is UI-relevant.
2. **Post-termination CPU is unmeasured.** D5 cites "post-stop CPU 0.34 ms per 200 ms" from
   Node. I did not sample CPU in the browser, so "browser termination leaves the worker/WASM
   consuming CPU" is neither confirmed nor refuted here.

### R44

Two separate findings.

1. D8 states the kernel "takes no undeclared-API dependency". Production takes two:
   `src/engine/session.ts:203` calls `query[Symbol.iterator]()` and `:230` calls `query.close?.()`,
   and `session.ts:36-43` documents `close` as "Missing from the package's `.d.ts`, which
   declares only `next` and `once`, but present at runtime and load-bearing". The reviewer probe
   `tests/rev-m1u3-2-live.test.ts:798` diffs this against the installed `common.d.ts`. This is
   the substance the ledger already ruled as R26 ("a contract defect, not a code defect; the
   package is now exact-pinned and memory records them"), but the D8 text at `6132bc6` still
   asserts the opposite, so the claim audit fails on its own terms. MAIN should dedupe against R26.
2. The granularity half is unbenchmarked, as in R40: "D4's solution-boundary granularity already
   meets the accept clause at a measured 62.00 ms worst step on real goals" rests on 80 sampled
   Node steps, cites a figure its source records as 50.11 ms, and covers no per-goal measurement
   of the reachable corpus. D8 uses that bound to justify declining `abort()`, so the scope of
   the bound is load-bearing for the decision.

### R45

The decisive observation of this review. Browser, built output, `EngineClient` from the shipped
source, a runaway `assertz` loop over a `dynamic/1` predicate:

```
{"outcome":{"kind":"error","code":"prolog",
            "message":"Aborted(). Build with -sASSERTIONS for more info."},
 "elapsedMs":12088,"resetAfterwards":"booted","residue":"failure","documents":"337"}
```

Against D9 and P2.7:
- **No typed heap state.** D9 rules heap exhaustion "a named typed state" on the strength of a
  Node measurement where `assertz/1` returned `Not enough resources: no_memory` with no throw,
  abort or kill. In the browser the WASM runtime aborts instead. The outcome carries
  `code: 'prolog'` and a message string; nothing decodes to `resource_error(memory)`, so
  `RESOURCE_LIMIT` in `src/engine/budget.ts:38` never runs and `limit: 'heap'` never appears.
- **Recreation does not fire.** `src/engine/client.ts:203-206` recreates only on
  `response.limit === 'heap'`. On this path the response is `error`, so the R09 fix — the one
  the ledger records as `fixed(med)` with a mutant-red acceptance test — is unreachable in the
  browser. My probe reset explicitly; the client did not.
- **The failure is message-only**, which is exactly the representation D7 and P2.8 exist to keep
  out of limit classification. Nothing can distinguish this abort from an ordinary Prolog error
  without reading its text.

What the run does show: after an explicit `reset()` the replacement booted, reported 337
documents from engine output, and the `r45_hog/1` residue was gone. So recovery is possible; it
is simply not automatic, and the caller is told `prolog` rather than the cause.

The no-reset path is worse. A second run that never calls `reset()` (`node tools/probe-u3.mjs R45b`,
`/tmp/u34-r45b.log`) shows the client keeps the aborted worker indefinitely:

```
{"outcome":{"kind":"error","code":"prolog"},
 "afterNoReset":{"kind":"error","code":"prolog",
                 "message":"Aborted(). Build with -sASSERTIONS for more info."},
 "residue":{"kind":"error","code":"prolog"}}
```

The following contract query returns the same abort message rather than 337 documents, and so
does the one after it. The worker target stays alive, the engine inside it is dead, nothing
recreates it, and every later query reports `prolog`. That is a direct P3.4 violation — "after
any budget trip the engine MUST remain sound" — on the shipping platform.

`fail(high)` reflects a kernel-tier predicate (P2.7) and a ruled decision (D9) that do not hold
in the browser, an accepted-and-fixed defect (R09) whose fix is unreachable there, and a
permanently unusable session with no automatic recovery.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.

- **`HARD_GRACE_MS` is nearly exhausted by ordinary soft trips.** R38 measured a soft
  `wall-clock` trip settling 2030 ms after dispatch for a request whose hard deadline was
  2000 ms (`wallClockMs` 1500 + `HARD_GRACE_MS` 500). The outcome carried 347 solutions, so it
  came from the worker and the soft path won — but by less than the timer resolution. A slower
  soft path converts an engine-preserving soft trip into a terminate-and-respawn.
  Evidence: `/tmp/u34-r38.log`. Acceptance check: dispatch a soft-tripping `repeat.` query and
  assert the settled outcome carries solutions with margin to spare against
  `wallClockMs + HARD_GRACE_MS`, or size the grace from a measured dispatch overhead.
- **The code is safer than D6's prose, and a later edit could "fix" that away.** D6 and P5.3 say
  every `ERROR` line is fatal. `src/engine/session.ts:347-352` treats every non-tolerated drained
  line as fatal. R42's failing-directive case emitted only `Warning:` lines and was still caught
  — correctly, but by the broader rule, not the stated one. Evidence: `/tmp/u34-r42.log`
  `failingDirective.consultMessage`. Acceptance check: state the rule as "any non-tolerated
  diagnostic is fatal" in D6/P5.3, and keep a failing-directive case in the committed suite.
- **Per-hook diagnostic isolation is unproven in the browser.** `printErr` and `on_output` are
  installed together at `src/engine/worker.ts:27-34`, so an external harness cannot show which
  hook carried a given diagnostic. R42 shows no `ERROR` escaped, which is the falsifier that
  matters, but the two-hook necessity claim rests on Node evidence alone. Acceptance check: a
  browser or worker-level probe that installs one hook at a time and requires each consult class
  to stay fatal.
- **An uncaught Prolog exception reports as honest `failure`.** `throw(error(type_error(...),_))`
  through the shipped wrapper returns `{kind:'failure'}`, indistinguishable from a zero-solution
  run (`tests/rev-m1u3-4-r43.test.ts`, case 1). `rev-m1u3-2` already filed this as a register
  row; repeated here only because R43's first case surfaced it independently and it interacts
  with P5.2's distinctness requirement.
