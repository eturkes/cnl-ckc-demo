# rev-m1u2-1 — adversarial review of M1.u2, Prolog engine worker

Check set = `.agent/contracts/m1u2-rev-checkset.md`, 28 rows, fixed before the diff is read. Review target = `6ff2d9c`.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u2-1.md --verdict`

Fill each finding in place. `pass: <what was checked and observed>` or
`fail(low|med|high): <file:line> <divergence> — breached <predicate> — impact — acceptance: <check that closes it>`.
Evidence = a path, a `file:line`, or a backticked command that reruns.

## Verdict table

| id | finding | evidence |
| --- | --- | --- |
| E01 | unknown | unknown |
| E02 | unknown | unknown |
| E03 | unknown | unknown |
| E04 | unknown | unknown |
| E05 | unknown | unknown |
| E06 | unknown | unknown |
| E07 | unknown | unknown |
| E08 | unknown | unknown |
| E09 | pass: `protocol.ts` alone declares the correlated request and response unions; client, session, and worker import them without a structural duplicate | `src/engine/protocol.ts`; `src/engine/{client,session,worker}.ts` |
| E10 | unknown | unknown |
| E11 | fail(med): `src/engine/terms.ts:144` `createEncoder` has no `never` exhaustiveness guard; after adding a variant and satisfying the unrelated rank table, `pnpm check` stays green — breached P3.1 — a future decoded term can encode as `undefined` without compiler refusal — acceptance: add a `never` guard and make the E11 probe exit 0 on a named exhaustiveness error | `python3 -P probe/e11_exhaustiveness.py` → rc 1 |
| E12 | unknown | unknown |
| E13 | unknown | unknown |
| E14 | unknown | unknown |
| E15 | unknown | unknown |
| E16 | unknown | unknown |
| E17 | pass: worker-owned `EngineSession` decodes each native result before constructing `PlSolution`; no native value is retained or re-entered, and fresh class-backed terms use the ruled constructors | `src/engine/session.ts`; `src/engine/terms.ts`; `.agent/memory.md` Engine runtime |
| E18 | unknown | unknown |
| E19 | fail(med): `src/engine/session.ts:335` the gate accepts `JSON.stringify` over a native query result — breached P3.12 — the measured arity and rational corruption path can be reintroduced without deterministic detection — acceptance: add a production static barrier whose mutant makes `pnpm gate` nonzero | `python3 -P probe/e19_json_stringify.py` → rc 1 after green gate |
| E20 | unknown | unknown |
| E21 | unknown | unknown |
| E22 | unknown | unknown |
| E23 | unknown | unknown |
| E24 | pass: asset check found no answer-oracle or sibling reach; planted controls failed for each forbidden class, while this repository's `../cnl-ckc-demo` prefix remained accepted | `pnpm kb:asset-check`; `tools/kb/check.mjs` |
| E25 | unknown | unknown |
| E26 | unknown | unknown |
| E27 | fail(med): `tests/engine-session.test.ts:187` the committed engine suites omit 8 of 19 term cases and 5 of 8 protocol cases, although `EngineSession.handle` is directly driveable — breached Q and invariant I — regressions in the omitted traps can pass the suite — acceptance: add all 13 named cases and make the census probe exit 0 | `python3 -P probe/e27_corpus_census.py` → rc 1, 13/27 absent |
| E28 | fail(low): `src/engine/terms.ts:144` and the production scan ledger lack deterministic checks for the E11 and E19 mechanical rules; the C1 concern set and no-data engine split otherwise hold — breached `CLAUDE.md` Engineering — per-file assurance overstates what the gate owns — acceptance: close E11 and E19, then rerun both mutants plus `pnpm build` | `probe/e11_exhaustiveness.py`; `probe/e19_json_stringify.py`; built worker 3074438 B |

## Details

### E11

`python3 -P probe/e11_exhaustiveness.py` adds a sentinel `PlTerm` variant, updates the unrelated exhaustive `TYPE_RANK`, runs `pnpm check`, and restores both files. The command exits 1 because the checker reports zero errors. `createEncoder` can therefore fall through its switch and return `undefined` for a newly decoded variant.

### E19

`python3 -P probe/e19_json_stringify.py` inserts `JSON.stringify(raw)` between a native `query(...).once()` and `decodeOnce`, runs the complete gate, and restores `session.ts`. All 195 tests and the full gate pass, so comments alone protect the measured corruption path.

### E27

The census found these absent term cases: negative and zero integers; float; shared-variable identity; hyphenated atom; operator term; empty atom; quoted atom; deep nesting. It found these absent protocol cases: unmatched id; duplicate id; boot failure before a request; two-request correlation; request before boot completes. Worker death, malformed goal, and honest zero solutions are covered. `EngineSession.handle` is exercised directly in committed tests, so the pure-handler half passes.

### E28

Concern census: shared protocol, worker shell, client correlation, session dispatcher, term codec, live tests, manifest wiring, and Vite worker split all ship. `pnpm build` resolved only `swipl-bundle-no-data`; the 63609-byte main chunk held zero `PL_initialise` and `loadImageDefault` markers, while the 3074438-byte worker held 5 and 8 respectively. The ledger fails only where E11 and E19 prove that two mechanical contract rules remain convention rather than gate-owned checks.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.
