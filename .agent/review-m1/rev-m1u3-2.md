# rev-m1u3-2 — adversarial review of M1.u3

Check set = `.agent/contracts/m1u3-rev-checkset.md` (fixed, 45 rows). Verdict table below; detail sections keyed by row id.
Grade: `python3 -P .scratch/validate-report.py .scratch/agents/rev-m1u3-2.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| R01 | unknown | unknown |
| R02 | pass: 18 invalid specs (missing, null, empty, zero, negative, fractional, NaN, ±Infinity, 2^53, MAX_SAFE_INTEGER, string, undefined field, each field at max+1) are rejected by the pure validator, by the worker with zero engine goals recorded, and by the client with zero worker spawns; every maximum is accepted alone and together. | `tests/rev-m1u3-2-live.test.ts` describe "R02 budget validation on both sides" — 21 cases green; spy engine goal count unchanged after boot |
| R03 | fail(low): cap 1 yields exactly one answer plus `answer-cap`, cap 8 yields honest `solutions`, and `repeat` under a full cap is bounded by the deadline — but a cap exactly equal to the solution count reports `answer-cap` for a run that was never truncated. | red test `tests/rev-m1u3-2-live.test.ts:"RED: a cap exactly equal to the solution count"` → got `limit`, want `solutions`; cause `src/engine/session.ts:198-201` |
| R04 | pass: the prior `stack_limit` is read from the engine and restored to that exact value after success, failure, stack trip, other limit, exception and cancel; the stack state is distinct from depth, inference, failure and the parse-guard Prolog error. | `tests/rev-m1u3-2-live.test.ts` describe "R04/R32 stack exhaustion" — 6 exit paths compared against the pre-trip read; `src/engine/session.ts:296-312` |
| R05 | pass: a branchy real-engine goal yields its shallow answers in order before `depth` terminates the run; the terminal kind is exactly `depth` and differs from inference, stack, failure and Prolog error. | `tests/rev-m1u3-2-live.test.ts:"yields early solutions before the depth limit"` — `between(1,50,X),probe_deep(X).` at depth 12, first binding X=1, count < 50 |
| R06 | pass: three cheap solutions arrive in order before `inference` terminates the run, with the exact `inference` kind. Measured caveat: `call_with_inference_limit/3` re-arms per solution, so the inference budget bounds one step and not the request (register entry). | `tests/rev-m1u3-2-live.test.ts:"yields early solutions before the inference limit"` and `"measured: re-arms per solution"` — 50×~800 inferences pass a 3000 limit; one 5000-deep step trips at 1000 |
| R07 | unknown | unknown |
| R08 | unknown | unknown |
| R09 | fail(med): the typed `heap` state exists and is unit-tested from decoded structure, but nothing recreates the engine — the client returns `limit: 'heap'` and keeps the same worker, so a saturated heap and its asserted residue are reused, contradicting D9. Live trip is absent and covered by the `.agent/polish.md` entry `u3 heap limit is unit-tested only`. | red test `tests/rev-m1u3-2-live.test.ts:"RED: a heap limit must force recreation"` → worker not terminated; `src/engine/client.ts:180-186` resets on wall-clock only; `src/engine/budget.ts:38` |
| R10 | pass: `terms.ts` byte-unchanged; classifier reads atom/functor structure only; identical text with different structure classifies differently. | `git diff --exit-code 2f78353 9020e62 -- src/engine/terms.ts` rc 0; `src/engine/budget.ts:38,104-124`; `tests/engine-budgets.test.ts:186-203` |
| R11 | fail(low): a new `EngineResponse` variant fails compilation at `isTerminal` alone; once handled there `pnpm check` is 0 errors — `EngineClient.query`'s switch has a catch-all `default` and never a `never`. | injected variant → `svelte-check` 1 ERROR at `src/engine/protocol.ts:111` only; after handling it, `COMPLETED 355 FILES 0 ERRORS`; `src/engine/client.ts:196-216` |
| R12 | pass: stack, depth, inference, answer-cap and soft wall-clock each trip in isolation, and after every one the same session still reports 337 documents from engine output and answers category A with 7 solutions; all-limits-low still terminates in a limit. | `tests/rev-m1u3-2-live.test.ts` describe "R07/R12" — `expectSound()` after each trip reads `manifest.contract.documents`, never a literal |
| R13 | pass: an aborted signal cancels only its own in-flight id, unknown and duplicate cancels answer `accepted:false`, the worker is neither terminated nor rebooted (1 construction, 1 image load), and the following category-A query returns 7 solutions. | `tests/rev-m1u3-2-live.test.ts` describe "R13 cooperative cancel" — `GenerationWorker.built` length 1, `GenerationWorker.loads` 1, `terminated` false |
| R14 | unknown | unknown |
| R15 | pass: a PID-unique `dynamic/1` overlay is observably present before the reset, absent after it, and the replacement reports 337 documents from a live `findall/3` rather than a literal; the worker and its image load are both fresh. | `tests/rev-m1u3-2-live.test.ts` describe "R14/R15 hard cancel" — overlay `present` → `failure`; `loads` 2, `built` 2, first worker terminated |
| R16 | pass: both `error` and `messageerror` settle every in-flight caller exactly once with a typed `worker` cause, empty the pending map, cancel every armed timer, and raise no unhandled rejection. No committed test drives `messageerror`; that gap is ruled at R29. | `tests/rev-m1u3-2-client.test.ts` describe "R16/R29 worker failure" — settlement counts [1,1], armed timers 0, `unhandledRejection` trap empty |
| R17 | pass: a query issued while the replacement boot is unanswered posts nothing to the terminated worker, reaches the replacement, and settles typed; the reset itself resolves `booted` and normal operation follows. | `tests/rev-m1u3-2-client.test.ts` describe "R17 a request issued during the respawn window" — dead worker post count unchanged, replacement answers `failure` |
| R18 | pass: ids never restart, so the live id is strictly greater than the retired one; a stale response and a stale watchdog from the dead generation settle nothing, terminate nothing, and raise no protocol violation. | `tests/rev-m1u3-2-client.test.ts` describe "R18 monotonic ids" — generation guard at `src/engine/client.ts:103-106` |
| R19 | pass: concurrent user resets, a fired watchdog and a worker `error` on one generation produce exactly one `terminate`, one replacement construction and one boot request, and all awaiters share the one lifecycle result. | `tests/rev-m1u3-2-client.test.ts` describe "R19 hard cancel is single-flight" — terminated 1, workers 2, boot requests 1; `src/engine/client.ts:257-262` |
| R20 | pass: 13 terminal branches — solutions, failure, all six limits, cancelled, error, post failure, hard reset and dispose — each leave zero armed query watchdogs; advancing the clock afterwards causes no late termination and no second settlement. | `tests/rev-m1u3-2-client.test.ts` describe "R20 every terminal outcome disarms its watchdog" — injected `schedule`/`cancelSchedule` counts; `src/engine/client.ts:88-96` |
| R21 | pass: `dispose()` sets a terminal flag, terminates once and makes `#ensure` throw, so no factory call follows; `reset()` after dispose returns a typed worker error; `_PL_halt` appears nowhere. | `/usr/bin/rg -n '_PL_halt' src tests tools` rc 1 (no match); `src/engine/client.ts:262-289`; `tests/engine-budgets.test.ts:466-475` |
| R22 | pass: an unparsable goal carrying an `assertz` prefix settles as a typed `prolog` error and the prefix clause is provably absent afterwards; an honest zero-solution goal stays `failure`, distinct from every limit and from malformed input. | `tests/rev-m1u3-2-live.test.ts` describe "R22" — `probe_prefix_ran` probe returns `failure`; parse guard at `src/engine/session.ts:169-176` |
| R23 | fail(low): clean, syntax-error and failing-directive consults behave correctly through `printErr` only, `on_output` only and both together, and an extra load-time warning is rejected — but the `library(shlib)` tolerance is applied at every phase, so a runtime consult emitting that text is silently accepted. | red test `tests/rev-m1u3-2-live.test.ts:"RED: the qsave shlib tolerance must apply at image load only"` → got `consulted`; cause `src/engine/session.ts:319-325` filters before checking phase |
| R24 | pass: after a consult that emitted `ERROR`, `probe_before` remains resident in the engine the harness still holds, while every client route — query and further consult — is refused as `consult`, and the replacement session boots clean with both probe clauses absent. | `tests/rev-m1u3-2-live.test.ts` describe "R24 a contaminated engine" — poisoned flag at `src/engine/session.ts:291-294`; replacement contract equals the manifest |
| R25 | pass: every request/response/budget shape is a plain object literal declared once in `protocol.ts`; both sides import it; `structuredClone` round-trips all 8 response kinds deep-equal. | `src/engine/protocol.ts:32-100`; `/usr/bin/rg -c 'interface BudgetSpec' src` = protocol.ts:1; probe `tests/rev-m1u3-2-client.test.ts` "R25 structured-clone" |
| R26 | fail(med): main chunk is engine-free and the worker is the sole owner, but production calls three undeclared `swipl-wasm` APIs — `query[Symbol.iterator]()`, `query.close?()` and the `prolog.Compound/List/Rational/String/Var` constructors. | `common.d.ts` `Query` declares `next`/`once` only, `Prolog` declares `call`/`forEach`/`query` only; `src/engine/session.ts:185,213`; `src/engine/terms.ts:31-37,150-166`; `dist/assets/index-CzoEE96V.js` 0 engine signatures |
| R27 | pass: `rm -rf kb/generated && pnpm gate` is rc 0 from the committed review target, regenerating the payload and passing all nine chain steps. | `9020e62`; `.probe/gate-clean-9020e62.log`: `Test Files 10 passed (10)`, `Tests 171 passed (171)`, `built in 561ms`, `GATE_RC=0` |
| R28 | unknown | unknown |
| R29 | unknown | unknown |
| R30 | unknown | unknown |
| R31 | pass: each limit case has a passing control budget and a lower budget that reaches the exact trip state against the real image; substituting a returning stub engine turns every one of those four limit assertions into a non-limit outcome. | `tests/rev-m1u3-2-live.test.ts` describe "R31 budget assertions are engine-sensitive" — stubbed session yields no `limit` for stack, depth, inference or answer cap |
| R32 | pass: the stack flag is read from the engine before the trip and read back through the same engine afterwards, and the wrapper itself re-reads and throws on mismatch; no test hard-codes a 1 GiB restoration target. | `src/engine/session.ts:303-311` reads back and compares; `tests/engine-budgets.test.ts:216-221`; `tests/rev-m1u3-2-live.test.ts` 6-path restore check |
| R33 | unknown | unknown |
| R34 | unknown | unknown |
| R35 | unknown | unknown |
| R36 | unknown | unknown |
| R37 | unknown | unknown |
| R38 | unknown | unknown |
| R39 | unknown | unknown |
| R40 | unknown | unknown |
| R41 | unknown | unknown |
| R42 | unknown | unknown |
| R43 | unknown | unknown |
| R44 | unknown | unknown |
| R45 | unknown | unknown |

## Details

One `### <row id>` section per row needing a ruling. Omit sections for clean `pass` rows.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.
