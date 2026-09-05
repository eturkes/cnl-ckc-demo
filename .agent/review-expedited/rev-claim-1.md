# rev-claim-1 — verdict table

| id | finding | evidence |
| --- | --- | --- |
| C1 | fail(high): build totals, reproduction, gate, smoke, and browser runs replay, but “live re-proof/exact proof path,” independent answer-oracle, visual-inspection, and multiple current memory claims do not | `pnpm gate`; `pnpm kb:reproduce`; `pnpm smoke`; `pnpm browser:check`; `tools/kb/proof.mjs:31-37`; `.agent/memory.md:120,237,243,386-420,524` |
| C2 | fail(high): all 11 gate steps and 16 baseline test files remain, but the four-answer bag oracle, declared-export guard, schema overlay, existence/count contracts, and independent browser answer oracle were silently retired | `git diff -U0 5ed81a3~1..a944fca -- tests/ tools/ package.json`; `.agent/memory.md:386-419` |
| C3 | fail(high): the only overlay mutates derived `clinical_advice/3`, not `guideline_*`, and never requires the line-keyed proof to change | `tests/questions-live.test.ts:257-277`; `/usr/bin/rg -n 'overlay|dynamic\\(guideline' tests` |
| C4u1 | fail(med): no differential reference or ported 15-green/84-red hostile fixture corpus exists; only narrow local parser mutations run | `/usr/bin/rg -n 'hl_parse_align|parse_evidence|tests/ui' tests tools src`; `tests/provenance-model.test.ts:5-48` |
| C4u2 | pass: all 343 generated assets reproduced byte-identically; the runtime validator rejected drift, and browser checks fetched one chunk plus its PDF page | `pnpm kb:reproduce`; `pnpm gate`; `pnpm browser:check` |
| C4u3 | fail(high): cap-one parity and budgets pass for 7 topics, but 0/4 committed trace oracles run and the required `guideline_*` answer-plus-proof overlay is absent | `tests/proof-live.test.ts:1-3`; `tests/questions-live.test.ts:257-277`; `pnpm test` |
| C4u4 | fail(high): deletion alone has an explicit load error; duplicate lines, wrong pages, unresolved proof lines, bad offsets, and answer-oracle reach lack the required fail-closed mutation checks | `pnpm exec vitest run tests/review-claim-replay.dom.test.ts --reporter=dot`; `src/provenance/model.ts:78-163`; `/usr/bin/rg -n 'delet|duplic|wrong page|answer.?oracle' tests/provenance* tests/demo-proof-controller.test.ts` |
| C4u5 | fail(med): selection re-proves once and stale completion is suppressed, but only 1/6 required state classes receives a DOM-plus-axe check | `tests/demo-proof-controller.test.ts:104-168`; `tests/provenance-ladder.dom.test.ts:64-145`; `/usr/bin/rg -n 'axe.run' tests/provenance-ladder.dom.test.ts` |
| C4u6 | pass: code-point text round-trips exactly, pointer and keyboard activate the same paired group, and both projection plus `unreviewed` disclosures are adjacent to the passage | `pnpm exec vitest run tests/review-claim-replay.dom.test.ts --reporter=dot`; `src/provenance/ProvenanceLadder.svelte:218-243` |
| C4u7 | pass: the real nested-host browser run observed no PDF or passage request before activation, both after activation, the physical-page fragment, and zero nested 404/page errors | `pnpm browser:check` (rc=0; eight 320px states) |
| C5 | fail(med): roadmap 343 assets, 2,901/20,964 graph, and 293/25 tests match; memory is stale at PVM 437,132→444,283 B, QLF 2,168,708→2,199,577 B, Horn 9,053→9,804, catalog 6→7, and dist 14/~3.77 MB→355/21,874,052 B | `jq '{catalog,provenance,graph,assets}' kb/generated/kb-manifest.json`; `du -sb dist`; `pnpm gate`; `.agent/memory.md:120,237,243,420,524` |
| C6 | fail(low): 5/10 evaluated commit subjects omit the required `<scope>: <cause> → <fix>` form | `git log --format='%h %s' 5ed81a3^..a944fca` |
| C7 | fail(high): browser and byte-identity claims use matching runs, but “live proof/exact proof path” rests on build-time site records, smoke reuses the producer as oracle, and visual inspection has no rerunnable evidence | `tools/kb/proof.mjs:31-37`; `tools/smoke.mjs:29-52`; `pnpm browser:check`; `pnpm kb:reproduce` |

## Register

## Detail

### C1

Claim-source inventory is complete across the required surfaces:

- **Roadmap expedited block:** 2,901 nodes, 20,964 edges, 9,804 implications, 343 assets, 293 tests/25 files, byte reproduction, nested-host/lazy/eight-state/cancel browser coverage, and the release commands replay. The direct desktop/mobile/dark visual-inspection statement has no committed capture or rerunnable command. The “live meta-interpreter proof” and “exact live proof lines” statements overreach `derive(clinical_advice/3)`, which converts build-time `clinical_advice_source/4` site records directly into childless nodes.
- **Memory:** stable bag/schema facts remain reproducible. Current-state PVM/QLF sizes, implication count, distribution shape, manifest/catalog version and count, browser state count, committed-answer oracle, anti-hard-coding probe, and six-question statements were invalidated without an update.
- **README:** seven prepared questions, static deployment, relative assets, the gate/release composition, GitHub Pages workflow, licences, cancellation, lazy loading, and source disclosures replay. “Live proof” inherits the roadmap gap. The CSP text is guidance with an explicit host-validation caveat, not a verified deployment claim.
- **Shipped UI:** engine-reported document/count labels, source/page fields, generated citations, and hidden-node counts derive from runtime data. “Every answer is proved live,” “source clauses re-proved,” “exact proof path,” and graph relationships “proved by this answer contribution” rely on the same precomputed-site special case and lack the required guideline-schema differential.
- **Commit messages:** implementation claims are represented by changed code, but subject conformance fails separately at C6; all ten bodies are empty.

Acceptance: replace precomputed-site proof claims with a genuine `guideline_*` derivation and differential, restore independent answer oracles, update memory from the live manifest/build, and attach a rerunnable visual-capture/inspection artifact or narrow that historical claim.

### C2

Mechanical inventory: the 11-step `gate` chain is unchanged, all 16 baseline test files remain, and three browser/release scripts were added. Internal protections did retire. `tests/questions-live.test.ts` no longer reads the four `queries/answers/*.pl` results, refuses exported-query-set drift, proves the two token-exact authored substitutions, exercises existence yes/no, or injects the joined `guideline_*` overlay. `tests/demo-lifecycle.test.ts` dropped the exact 7/5/2/1/3/12 live-count contract. `tools/smoke.mjs` replaced the vendored committed-answer oracle with `clinicalArtifacts()`, the same producer used to build the expected `clinical_advice/3` facts. The native-radio test was intentionally replaced by combined-answer behavior, but `.agent/memory.md` records no retirement rationale; instead it still states that `EXPORTED`, committed answer oracles, and existence handling are live. Acceptance: restore independent equivalents for every correctness protection, or record each retirement and its replacement rationale; the schema-overlay and independent answer oracle require restoration because they protected the non-negotiable.

### C5

Live manifest/gate values: 343 runtime assets (344 files including the manifest), 337 evidence chunks, 10,321 clauses, 8,556 alignment spans, 2,901 graph nodes, 20,964 graph edges, 9,804 implication edges, seven catalog entries from 12 controlled sources, 25 test files, 293 tests, 393 checked files, and 487 Vite modules. `dist/` contains 355 files and occupies 21,874,052 bytes. Roadmap’s current totals match. Memory still describes the pre-range PVM/QLF, graph implication count, six-entry catalog/manifest v2, browser state count, and 14-file ~3.77 MB distribution. Acceptance: regenerate every current-state measurement and label historical measurements explicitly; include all new asset classes and their lazy-loading boundary.

### C3

M1’s recorded probe dynamically opened four `guideline_*` predicates, injected a complete joined proof, and required the projected answer to change without reading an answer fixture (`.agent/memory.md`, “Anti-hard-coding recipe”). The replacement probe inserts one already-projected `clinical_advice/3` fact and checks only serialized answer bytes. It neither exercises the guideline schema nor calls the proof RPC. The check therefore remains green when the runtime answer depends only on precompiled `clinical_advice/3` records. Acceptance: add a fixture-free PID-unique `guideline_*` overlay whose selected solution changes both the projected answer and every expected line-keyed proof coordinate.

### C7

Evidence scope is sound for byte identity (`kb:reproduce`), generated-asset structure and gate totals (`gate`), nested production/dev loading, lazy assets, eight narrow states and cancellation (`browser:check`). It is not sound for the central proof wording: the RPC returns childless nodes assembled from `clinical_advice_source/4` records generated before the PVM runs. `smoke` computes its expected answer by calling `clinicalArtifacts()`, the same producer that emitted the runtime facts, so it proves transport/rendering agreement rather than an independent source or committed-answer oracle. No checked-in capture supports direct visual inspection. Acceptance: bind proof claims to the C3 overlay, compare smoke output to an independent bag oracle, and make visual evidence rerunnable or narrow the claims.

### C4u1

The implementation has local validation guards, including UTF-8/control/bidi rejection, identifiers, direct source paths, duplicate coverage keys, and alignment bounds. Its tests exercise only an ID mismatch, Unicode segmentation, overlap/bounds/text mismatch, one unsafe path, and one dishonest offset. No test imports or ports the upstream differential (`parse_evidence`, `hl_parse_align`) or its 15 green and 84 red families. Acceptance: port the declared fixture classes, run both implementations on them, and require identical values or refusal classes before emission.

### C4u3

`tests/proof-live.test.ts` proves cap-one multiset parity and selected re-proofs for all seven current topics under `PROOF_BUDGET_MAX`. The suite explicitly reads no committed trace, so the required four trace-oracle comparisons are absent. The only live mutation inserts a finished `clinical_advice/3` result and never obtains a proof. Acceptance: retain the passing parity/budget battery, compare all four vendored traces, then add the C3 `guideline_*` answer-plus-proof overlay differential.

### C4u4

The producer proves unique generated clause lines, and a missing or HTTP-failing evidence chunk becomes an alert. The runtime consumer does not require unique clause lines, a positive/cross-checked physical page, or total proof-line resolution. It silently filters unmatched lines, accepts page zero, and evaluates malformed alignment after loading instead of mapping it into a provenance failure state. The declared deletion, duplication, bad-offset, wrong-page, and answer-oracle-reach mutation matrix is absent. Acceptance: add all five mutants and require a typed explicit failure before any evidence rung renders; also assert that each selected live proof line resolves exactly once.

### C4u5

The controller test proves one proof call on initial selection, aborts the predecessor, suppresses stale completion, and maps unavailable, limit, and error results. The DOM suite renders content and one limit state, but it runs axe only for the limit case. Loading, unavailable, error, stale-run, and content lack the required paired DOM-and-axe adjudication. Acceptance: parameterize all six declared state classes through the mounted ladder and require both state-specific DOM semantics and zero axe violations.
