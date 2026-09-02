# rev-m1u2-1 — adversarial review of M1.u2, Prolog engine worker

Check set = `.agent/contracts/m1u2-rev-checkset.md`, 28 rows, fixed before the diff is read. Review target = `6ff2d9c`.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u2-1.md --verdict`

Fill each finding in place. `pass: <what was checked and observed>` or
`fail(low|med|high): <file:line> <divergence> — breached <predicate> — impact — acceptance: <check that closes it>`.
Evidence = a path, a `file:line`, or a backticked command that reruns.

## Verdict table

| id | finding | evidence |
| --- | --- | --- |
| E01 | pass: only `worker.ts` imports `swipl-wasm`; the main import graph reaches client DTO and budget code only, and the emitted 63609-byte main chunk contains zero engine markers against the worker positive control | `src/main.ts`; `src/engine/worker.ts`; `dist/assets/index-8N2BVi8K.js` |
| E02 | pass: worker imports `kb.pvm?url`, checks `fetch` status, and reads an `ArrayBuffer`; no runtime source-consult path exists, and build emitted one hashed 437132-byte PVM with inlining disabled | `src/engine/worker.ts:8`; `vite.config.ts:23`; `dist/assets/kb-mjdzunFE.pvm` |
| E03 | fail(med): `src/demo/copy.ts:43` hard-codes `337` into shipped UI copy even though boot reads and compares both contract values correctly — breached P1.3, D0.5, and invariant I — a regenerated valid engine with a changed document count would boot while the UI states stale evidence — acceptance: derive the displayed count from `BootOutcome.contract` and make the literal probe exit 0 | `python3 -P probe/e03_contract_literals.py` → rc 1; typed mismatch test passed |
| E04 | pass: three injected loader failures labeled fetch, malformed image, and init throw each settled `EngineClient.boot` as typed `code: boot`; no pending promise or unhandled rejection remained | `src/engine/worker.ts:62-85`; runtime probe 3/3 passed |
| E05 | fail(med): `src/engine/session.ts:124` caches only a completed engine, so two concurrent boot requests invoked the image loader twice — breached P1.5 — duplicate WASM engines race to become session state and double startup cost — acceptance: single-flight the in-progress boot and make the E05 probe pass with one loader call | `python3 -P probe/e05_single_boot.py` → expected 1, received 2 |
| E06 | pass: every declared request and response variant, all ten `PlTerm` shapes, bigint, and scalar error DTOs cloned deeply equal with only plain-object or array prototypes | `src/engine/protocol.ts`; `src/engine/terms.ts`; runtime probe 4/4 passed |
| E07 | pass: client-generated ids are posted and echoed; an unknown id and a duplicate settled id each invoked `onProtocolViolation` with `code: protocol`, while the claimed request settled once | `src/engine/client.ts:108-122`; runtime probe 4/4 passed |
| E08 | pass: all declared response kinds are terminal, solution delivery is one correlated array, malformed syntax returns typed `prolog`, and an honest zero-solution goal returns `failure`; targeted tests settled each once | `tests/engine-session.test.ts:164-175`; `tests/engine-budgets.test.ts:215` |
| E09 | pass: `protocol.ts` alone declares the correlated request and response unions; client, session, and worker import them without a structural duplicate | `src/engine/protocol.ts`; `src/engine/{client,session,worker}.ts` |
| E10 | fail(med): `src/engine/worker.ts` has no `unhandledrejection` channel, although parent `error` and `messageerror` abort all pending requests — breached P2.5 — a worker-local rejected promise can leave boot pending without a deadline — acceptance: route worker unhandled rejection to a parent failure and prove two in-flight calls settle typed with timers and listeners released | `python3 -P probe/e10_worker_rejection.py` → rc 1 |
| E11 | fail(med): `src/engine/terms.ts:144` `createEncoder` has no `never` exhaustiveness guard; after adding a variant and satisfying the unrelated rank table, `pnpm check` stays green — breached P3.1 — a future decoded term can encode as `undefined` without compiler refusal — acceptance: add a `never` guard and make the E11 probe exit 0 on a named exhaustiveness error | `python3 -P probe/e11_exhaustiveness.py` → rc 1 |
| E12 | pass: live decoding produced arities 2 and 1 for `foo(bar,7)` and `foo([bar,7])`; canonical displays were `foo(bar,7)` and `foo([bar,7])`, preserving the one-element envelope distinction | `tests/engine-session.test.ts:188`; `src/engine/terms.ts:86` |
| E13 | pass: live `1 rdiv 3` decoded as numerator 1 and denominator 3 with display `1r3`; normalized `3 rdiv 1` decoded and displayed as integer `3`, never as `1r3` | `tests/engine-session.test.ts:216`; `src/engine/terms.ts:72` |
| E14 | pass: live atom and string bindings with identical text retained distinct tags; an unbound variable stayed explicit, and both arguments of `f(V,V)` decoded with the same variable id | `src/engine/terms.ts:61-102`; runtime probe 3/3 passed |
| E15 | pass: the live integer `123456789012345678901234567890` remained exact as bigint; live `1.0` arrived as integer 1, and the decode-site contract explicitly declares that wrapper deviation | `src/engine/terms.ts:54-69`; `.agent/polish.md` Integral floats |
| E16 | fail(med): `src/engine/terms.ts:141` round-trips 20/20 ground shapes and the exact five-argument guideline id, but live `f(A,A)` re-query returns two different variable ids — breached P3.7 and invariant I — shared-variable semantics change across the term boundary — acceptance: preserve alias identity through encode and make the E16 live probe pass | `python3 -P probe/e16_shared_roundtrip.py` → ids 2009 and 2011 |
| E17 | pass: worker-owned `EngineSession` decodes each native result before constructing `PlSolution`; no native value is retained or re-entered, and fresh class-backed terms use the ruled constructors | `src/engine/session.ts`; `src/engine/terms.ts`; `.agent/memory.md` Engine runtime |
| E18 | fail(low): `src/engine/terms.ts:97` rejects unknown `$t` but accepts every non-bindings `$tag` object as a dict, contrary to this row's required fail-closed probe — breached P3.11 under the check-set reading — an unsupported wrapper object can enter the DTO union — acceptance: reject the synthetic unsupported dict and make the E18 probe pass | `python3 -P probe/e18_unknown_dict.py` → second assertion did not throw |
| E19 | fail(med): `src/engine/session.ts:335` the gate accepts `JSON.stringify` over a native query result — breached P3.12 — the measured arity and rational corruption path can be reintroduced without deterministic detection — acceptance: add a production static barrier whose mutant makes `pnpm gate` nonzero | `python3 -P probe/e19_json_stringify.py` → rc 1 after green gate |
| E20 | pass: production display uses only `term_string/3` with all three required options; 20/20 adversarial live terms re-read as variants, with exact quoting for dollar, hyphenated, mixed-case, empty, quoted, and operator cases | `src/engine/session.ts:48,354`; live display corpus 20/20 passed |
| E21 | pass: committed tests load the generated PVM, read schema and document counts from the engine, compare them to the manifest, and independently bind that manifest to schema 1 and 337 without an engine-output fixture | `tests/engine-session.test.ts:23-117`; targeted live tests 5/5 passed |
| E22 | fail(med): `tests/engine-session.test.ts:122` proves seven category-A solutions through internal `EngineSession.solve`, not the shipped `EngineClient` surface; no committed test combines the real PVM, client query, and seven-result assertion — breached P5.2 and G2 — client correlation or worker plumbing can regress while the claimed end-to-end proof stays green — acceptance: commit a real-image `EngineClient.query` test asserting seven solutions and make the E22 census pass | `python3 -P probe/e22_shipped_client_live.py` → rc 1 |
| E23 | pass: the committed overlay declares all four static predicates dynamic, injects a complete proof, and asserts changed serialized output; replacing runtime consult with a no-op makes that exact test red | `python3 -P probe/e23_overlay_mutant.py` → rc 0 after test failure |
| E24 | pass: asset check found no answer-oracle or sibling reach; planted controls failed for each forbidden class, while this repository's `../cnl-ckc-demo` prefix remained accepted | `pnpm kb:asset-check`; `tools/kb/check.mjs` |
| E25 | pass: with `kb/generated` absent, `pnpm test` returned rc 1 with 9 failed files, 6 failed and 36 passed tests, and no skipped live case; failures named the missing manifest, PVM, and QLF | `pnpm test` with `kb/generated` moved aside → rc 1 |
| E26 | fail(med): clean-generation `pnpm gate` is green and emitted paths are correctly excluded, but P6.2 still has no committed real-browser proof that reads 337 from both dev server and built output — breached P6.2 and G3 — the milestone's two deployment modes remain assertion-only — acceptance: commit one browser script that boots both modes, reads 337 from each, and make the E26 evidence probe pass | `python3 -P probe/e26_browser_evidence.py` → rc 1; clean gate 187/187 |
| E27 | fail(med): `tests/engine-session.test.ts:187` the committed engine suites omit 8 of 19 term cases and 5 of 8 protocol cases, although `EngineSession.handle` is directly driveable — breached Q and invariant I — regressions in the omitted traps can pass the suite — acceptance: add all 13 named cases and make the census probe exit 0 | `python3 -P probe/e27_corpus_census.py` → rc 1, 13/27 absent |
| E28 | fail(low): `src/engine/terms.ts:144` and the production scan ledger lack deterministic checks for the E11 and E19 mechanical rules; the C1 concern set and no-data engine split otherwise hold — breached `CLAUDE.md` Engineering — per-file assurance overstates what the gate owns — acceptance: close E11 and E19, then rerun both mutants plus `pnpm build` | `probe/e11_exhaustiveness.py`; `probe/e19_json_stringify.py`; built worker 3074438 B |

## Details

### E03

`python3 -P probe/e03_contract_literals.py` exits 1 on the executable string in `src/demo/copy.ts:43`. Engine boot itself is sound: the targeted committed mismatch test returned typed `code: contract`. The defect is the second, UI-visible source of truth, not the boot comparison.

### E05

`python3 -P probe/e05_single_boot.py` starts two `boot()` calls before the injected loader resolves. Both calls enter `loadImage`; the red test measured 2 invocations against the required 1. The completed-engine cache handles sequential calls but does not single-flight initialization.

### E10

The client registers parent-side `error` and `messageerror` listeners and their existing tests release timers. `python3 -P probe/e10_worker_rejection.py` exits 1 only because the worker shell has no `unhandledrejection` listener. A boot request has no client deadline, so this missing channel is an unbounded pending path.

### E11

`python3 -P probe/e11_exhaustiveness.py` adds a sentinel `PlTerm` variant, updates the unrelated exhaustive `TYPE_RANK`, runs `pnpm check`, and restores both files. The command exits 1 because the checker reports zero errors. `createEncoder` can therefore fall through its switch and return `undefined` for a newly decoded variant.

### E16

A live battery re-queried 20 ground shapes, including the full `'$guideline_id'/5`; all were byte-structure equal after decode and encode. The variable case failed separately: direct decode preserved both occurrences of `A`, but re-query returned ids 2009 and 2011. `python3 -P probe/e16_shared_roundtrip.py` reproduces the alias split.

### E18

`python3 -P probe/e18_unknown_dict.py` proves the unknown `$t` branch throws but `{ $tag: 'unsupported', field: 1 }` decodes as a `dict`. The fixed row requires both to throw. The Register records the conflict with the memory's broader `$tag`-dict ABI statement.

### E19

`python3 -P probe/e19_json_stringify.py` inserts `JSON.stringify(raw)` between a native `query(...).once()` and `decodeOnce`, runs the complete gate, and restores `session.ts`. All 195 tests and the full gate pass, so comments alone protect the measured corruption path.

### E22

The seven-result test calls the internal session helper directly. Client lifecycle tests use scripted workers, and live tests use `EngineSession`; no committed case joins the two. The later browser smoke uses the shipped client for a different question and does not assert seven category-A solutions.

### E26

`rm -rf kb/generated && pnpm gate` returned rc 0: 356 files, zero diagnostics, 187 tests, and 3 assets. `pnpm kb:reproduce` also returned rc 0. `kb/generated`, `.vite`, and `dist` are gitignored and denied from reads; Serena correctly omits those gitignored caches from `ignored_paths`. Current browser evidence is the built-static-output `pnpm smoke` from u6. It neither drives the Vite dev server nor reads the 337 count in both modes; the open polish entry states the same limit. No browser or port was launched in this review wave, as required by the shared-resource assignment.

### E27

The census found these absent term cases: negative and zero integers; float; shared-variable identity; hyphenated atom; operator term; empty atom; quoted atom; deep nesting. It found these absent protocol cases: unmatched id; duplicate id; boot failure before a request; two-request correlation; request before boot completes. Worker death, malformed goal, and honest zero solutions are covered. `EngineSession.handle` is exercised directly in committed tests, so the pure-handler half passes.

### E28

Concern census: shared protocol, worker shell, client correlation, session dispatcher, term codec, live tests, manifest wiring, and Vite worker split all ship. `pnpm build` resolved only `swipl-bundle-no-data`; the 63609-byte main chunk held zero `PL_initialise` and `loadImageDefault` markers, while the 3074438-byte worker held 5 and 8 respectively. The ledger fails only where E11 and E19 prove that two mechanical contract rules remain convention rather than gate-owned checks.

## Register

- **E18 check-set conflict** — `.agent/memory.md` Engine runtime declares `$tag` dicts part of the wrapper ABI, and `PlTerm` deliberately carries `kind: 'dict'`; E18 instead requires a `$tag` dict to fail. Acceptance: MAIN rules whether supported SWI dicts belong to P3.1, then either amends E18 or restricts the decoder with an explicit supported-tag test.
