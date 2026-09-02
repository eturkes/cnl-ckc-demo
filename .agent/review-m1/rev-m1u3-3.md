# rev-m1u3-3 — adversarial review of M1.u3, remaining rows

Check set = `.agent/contracts/m1u3-rev-checkset.md` (fixed, 45 rows). Session 1 adjudicated 25.
This report carries the 20 rows session 1 left `unknown`. Row text is in the check set; do not restate it.
Grade: `python3 -P .scratch/validate-report.py .scratch/agents/rev-m1u3-3.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| R01 | fail(low): `query` and `solve` both refuse a budget-less caller at compile time and no default, overload or alternate query export exists — but `EngineClient.consult(source)` is public, runs every `:- Goal.` directive inside the live engine, takes no budget and arms no deadline, so a non-terminating directive has no soft check, no watchdog and no cancel. | compile-negative: `pnpm check` = 2 ERRORS "Expected 2-3 arguments, but got 1" at `client.query`/`session.solve`; `tests/rev-m1u3-3-client.test.ts:"RED: arms no deadline for consult"` → armed timers 0, want 1; `tests/rev-m1u3-3-live.test.ts:"runs a :- Goal. directive"` green; `src/engine/client.ts:227` sends consult with no `deadlineMs` |
| R07 | pass: the client arms exactly one dispatch-to-terminal timer at `wallClockMs + 500`; display rendering is inside the accounted window (identical 60-solution iteration trips only when the rendered term is large); soft expiry reports `wall-clock` with the same worker and one image load, and the engine still answers category A with 7 solutions; hard expiry terminates and builds a replacement. | `tests/rev-m1u3-3-live.test.ts` describe "R07" — 3 cases green; `cheap`=`solutions` vs `costly`=`limit wall-clock` at the same 400 ms budget; `GenerationWorker.built` 1 / `loads` 1 after soft, `terminated` true + built>1 after hard; `src/engine/session.ts:180,222`, `src/engine/client.ts:33,203` |
| R08 | fail(med): a cancel between later solutions is received mid-run, settles typed `cancelled` in under 2 s carrying its proven solutions, and is neither a limit nor an error — but a cancel queued before the first solution is dropped rather than deferred: `requestCancel` sees `#active` unset, acks `accepted:false`, and the query then runs to natural completion and settles `solutions`. | `tests/rev-m1u3-3-live.test.ts` describe "R08" — 2 green, 1 RED: `"RED: a cancel queued before the first solution"` → got `solutions`, want `cancelled`; cause `src/engine/session.ts:158-162` + `src/engine/session.ts:179` (`#active` set only inside `solve`) |
| R14 | unknown | unknown |
| R28 | fail(low): `pnpm test` is green on the committed suite (10 files / 171 tests, rc 0) and fails rather than skips without generated assets (rc 1, 8 files failed on ENOENT, 0 skipped); stack, depth, inference, wall-clock, answer-cap, cancel and both consult predicates each have a real-PVM test — but P2.7 heap has no committed real-PVM test at all, only the `readOutcome` unit assertion. | `.probe/test-committed.log` `Test Files 10 passed (10)` / `Tests 171 passed (171)`; `.probe/test-nogen.log` `Test Files 8 failed / 2 passed (10)` with `ENOENT … kb-manifest.json`/`kb.pvm`/`kb.qlf`; heap hit is `tests/engine-budgets.test.ts:184-187` only |
| R29 | fail(low): the committed lifecycle tests do inject a worker factory and drive worker `error`, deadline overrun, respawn, stale responses, timer cleanup and dispose — but `messageerror` is never driven by any committed test, the injected clock seam is used in one case only (the deadline case runs on the real timer), and neither a `postMessage` failure nor a stale watchdog from a retired generation is exercised. | `git grep -n messageerror e3ef450 -- tests` = no match (production hits only, `src/engine/client.ts:117`, `src/engine/worker.ts:86`); committed seams at `tests/engine-budgets.test.ts:396-501` + `tests/engine-cancel.test.ts:127-260`; the three missing branches pass when driven: `tests/rev-m1u3-3-client.test.ts` describe "R29" 3/3 green |
| R30 | pass: every `337`/`schemaVersion: 1` hit is either an independent expected constant pinned against engine output and manifest input-file count, or a fixture fed to a fake engine — none is computed from the artifact under test; perturbing the manifest contract to 336 makes the engine-vs-manifest check fail. | `git grep -n '\b337\b' e3ef450 -- src tests` = 6 hits, traced; `tests/kb-live.test.ts:13-36` compares `verifyImage`/`verifyQlf` engine output and `manifest.input.files` against the literal; perturbation `.probe/r30-perturb.log`: `ContractMismatch: engine reports schema 1 with 337 documents, manifest records schema 1 with 336`, `Test Files 3 failed (3)`, rc 1 |
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
