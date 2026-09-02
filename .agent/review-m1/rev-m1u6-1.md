# rev-m1u6-1 — adversarial review of M1.u6, run lifecycle + answer states

Check set = `.agent/contracts/m1u6-rev-checkset.md`, 28 rows, fixed before the diff is read. Review target = `6ff2d9c`.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u6-1.md --verdict`

Fill each finding in place. `pass: <what was checked and observed>` or
`fail(low|med|high): <file:line> <divergence> — breached <predicate> — impact — acceptance: <check that closes it>`.
Evidence = a path, a `file:line`, or a backticked command that reruns.

## Verdict table

| id | finding | evidence |
| --- | --- | --- |
| L01 | unknown | unknown |
| L02 | unknown | unknown |
| L03 | unknown | unknown |
| L04 | unknown | unknown |
| L05 | pass: Source census found one `EngineClient` and one `AnswerService`; typed boot failure reached `boot-error`, and the R1 lifecycle test passed. | `src/demo/DemoController.svelte.ts:40`; `pnpm exec vitest run tests/demo-lifecycle.test.ts --reporter=dot` |
| L06 | pass: Booting Run, inactive Cancel and Retry, and out-of-range solution calls preserved state; the R2 and ADV1 lifecycle checks passed. | `src/demo/DemoController.svelte.ts:108`; `tests/demo-lifecycle.test.ts:197` |
| L07 | unknown | unknown |
| L08 | unknown | unknown |
| L09 | pass: The only asynchronous result write follows the active-controller identity guard; the R5 test kept the successor after a retired result. | `src/demo/DemoController.svelte.ts:175`; `tests/demo-lifecycle.test.ts:256` |
| L10 | pass: `cancel()` aborted, entered `cancelling`, and stayed pending until `active.done`; the R6 test then observed `settled` as terminal. | `src/demo/DemoController.svelte.ts:121`; `tests/demo-lifecycle.test.ts:289` |
| L11 | unknown | unknown |
| L12 | pass: `dispose()` marks ownership retired, aborts the active signal, clears it, and disposes once; R8 observed no later state write. | `src/demo/DemoController.svelte.ts:135`; `tests/demo-lifecycle.test.ts:336` |
| L13 | pass: `DEMO_BUDGET` is frozen at the measured values including 5000 ms, and R9 passed the same object with no goal or consult surface. | `src/demo/DemoController.svelte.ts:25`; `tests/demo-lifecycle.test.ts:355` |
| L14 | unknown | unknown |
| L15 | unknown | unknown |
| L16 | unknown | unknown |
| L17 | unknown | unknown |
| L18 | unknown | unknown |
| L19 | unknown | unknown |
| L20 | unknown | unknown |
| L21 | unknown | unknown |
| L22 | unknown | unknown |
| L23 | unknown | unknown |
| L24 | unknown | unknown |
| L25 | unknown | unknown |
| L26 | unknown | unknown |
| L27 | unknown | unknown |
| L28 | fail(low): `src/demo/DemoController.svelte.ts:70` exports `solutionsOf`, while lines 88, 99 and 104 expose `booted`, `solutions` and `solution` beyond the declared surface — breached D10 and the fixed public API — callers can bind to an API that the contract does not protect — acceptance: the exact export/member probe exits 0. | `pnpm exec node probe/m1u6-l28-public-api.mjs`; `probe/m1u6-l28-public-api.mjs` |

## Details

### L28

`pnpm exec node probe/m1u6-l28-public-api.mjs` exits 1 at the target. It reports the extra module export `solutionsOf` and extra public members `booted`, `solution` and `solutions`; nothing declared is missing. The D10 file split, `App` injection seam, and controller-free child props otherwise match. Severity is low because the divergence expands the compile-time surface without changing the shipped interaction.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.
