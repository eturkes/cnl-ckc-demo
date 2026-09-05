# rev-arch-1 — verdict table

| id | finding | evidence |
| --- | --- | --- |
| A1 | fail(med): cached builds trust manifest-authorized bytes instead of the fresh bag derivation | `tools/kb/build.mjs:69`; `node tools/review-probes/a1-cache.test.mjs` |
| A2 | pass: seven declared topic/source sets re-derive from the verified bag and a missing selected ACE source aborts | `tools/kb/clinical.mjs:18`; `pnpm test` (`questions-live.test.ts`) |
| A3 | fail(high): the byte-equivalence guard precedes grouping and term emission, so changed answer modality still builds | `tools/kb/clinical.mjs:261`; `tools/kb/clinical.mjs:325`; `node tools/review-probes/a3-answer-equivalence.test.mjs` |
| A4 | fail(med): import graph is acyclic, but Svelte components still select proof documents and join semantic lines | `src/provenance/ProvenanceLadder.svelte:25`; `node tools/review-probes/a4-component-semantics.test.mjs` |
| A5 | fail(med): a 3,138,829-byte worker boots before user activation, and memory retains the pre-range 14-file inventory | `src/demo/DemoController.svelte.ts:119`; `.agent/memory.md:243`; `pnpm browser:check` |
| A6 | fail(med): engine-native terms are decoded, but both worker consumers trust TypeScript-cast messages without runtime validation | `src/engine/client.ts:118`; `pnpm exec vitest run tests/review-a6-worker-validation.test.ts --project node` |
| A7 | pass: two forced builds produced identical hashes for all 343 recorded assets across every generated class | `pnpm kb:reproduce` |
| A8 | fail(high): malformed alignment survives asset parsing, and query stderr still returns a successful solution | `src/provenance/model.ts:85`; `src/engine/session.ts:307`; `pnpm exec vitest run tests/review-a8-fail-closed.test.ts --project node` |
| A9+ | fail(med): QLF fallback and clause index add 4.08 MB of generated work but have no runtime or shipped consumer | `src/engine/worker.ts:7`; `node tools/review-probes/a9-dead-assets.test.mjs` |
| A10+ | fail(low): overlapping build APIs derive the full provenance model three times instead of sharing one immutable result | `tools/kb/build.mjs:61`; `node tools/review-probes/a10-duplicate-derivation.test.mjs` |
| A11+ | fail(med): Pages deploys after the deterministic gate but bypasses the repository's reproduction and real-browser release checks | `.github/workflows/pages.yml:27`; `node tools/review-probes/a11-release-workflow.test.mjs` |

## Register

- **R-S1 · semantic/high:** Generated `clinical_advice/3` facts are the answer authority, while `derive/4` special-cases them into stored line nodes without executing those `guideline_*` clauses. Retracting every schema clause leaves both answer and proof byte-identical. Evidence: `tools/kb/clinical.mjs:481`, `tools/kb/proof.mjs:37`, `pnpm exec vitest run tests/review-register-schema-binding.test.ts --project node`. Acceptance: the same probe passes because deleting support changes both projected answer and line-keyed proof.

## Detail

### A1

`main()` derives provenance and graph before its cache check, but the predicate compares only the manifest version, bag/input/toolchain/catalog digests, and each asset against the same manifest. The red probe appends one byte to the graph, updates its manifest digest, then runs normal `kb:build`: rc=0, `cached`, and the non-derived byte remains. `kb:asset-check` subsequently rejects it, so the full gate limits severity; `kb:build` itself does not satisfy A1. Acceptance: `node tools/review-probes/a1-cache.test.mjs` exits 0 because normal `kb:build` replaces or refuses manifest-authorized bytes that differ from its fresh derivation.

### A3

`parseAdviceSentence()` round-trips each source sentence before `groupClauses()` and `groupTerm()` compute the answer payload. Nothing reconstructs the emitted payload and compares it with the source. The red probe changes only the post-check emitted mode to `can`; forced `kb:build` still exits 0 and writes the semantically divergent answer into the PVM. Acceptance: `node tools/review-probes/a3-answer-equivalence.test.mjs` exits 0 because the forced build rejects any final answer payload that cannot byte-round-trip to its selected ACE sentences.

### A4

A static import walk found 31 source files, 62 relative edges, and zero cycles; engine direction and build/runtime separation otherwise hold. However, `ProvenanceLadder.svelte` flattens proof trees, chooses the first proof document, selects that document's sentences/lines, and performs the line→clause join. `App.svelte` independently aggregates proof documents and constructs the answer graph focus. Those are domain decisions, not view rendering. Acceptance: `node tools/review-probes/a4-component-semantics.test.mjs` exits 0 after a provenance/graph model owns those transformations and components receive validated view models.

### A5

`pnpm browser:check` rebuilt a 21,874,052-byte `dist`: graph = 8,184,964 bytes and PDF = 1,418,584 bytes, both request-lazy; worker = 3,138,829 bytes and `DemoController` boots it in its constructor before any gesture. The second predicate also fails: memory still records the M1-era 14-file/≈3.77 MB build and omits the 337 provenance chunks, source PDF, semantic graph, and current total. Acceptance: `pnpm build && node tools/review-probes/a5-lazy-payload.test.mjs` exits 0 after user activation gates every >1 MB file; `.agent/memory.md` records the fresh class inventory and measurements.

### A6

`EngineSession` decodes every native SWI value into the plain `PlTerm` union, and the existing structured-clone test passes. The transport consumers do not validate their side of the union: worker input and client output rely on `MessageEvent<...>` annotations. The red fake worker returns `kind:'solutions'` with `solutions:'not-an-array'`; `EngineClient.query()` forwards it as successful structured data. Acceptance: `pnpm exec vitest run tests/review-a6-worker-validation.test.ts --project node` passes after runtime request/response decoders reject every malformed field as a typed protocol error.

### A8

Missing/HTTP-failed chunks already reach the ladder's explicit error copy, and boot/runtime-consult diagnostics fail closed. Two uncovered paths do not. `parseEvidenceDocument()` accepts a span ending at code point 10,000; the later `$derived` call to `alignedSegments()` throws outside the loader's error state. Separately, a real saved-state query that emits captured stderr returns `kind:'solutions'` because `solve()` and `prove()` never drain the sink. Acceptance: `pnpm exec vitest run tests/review-a8-fail-closed.test.ts --project node` passes 2/2: complete artifact validation occurs inside the caught load boundary, and any query/proof diagnostic returns a typed error and poisons the engine before content escapes.

### A9+

The manifest calls `kb.qlf` (2,199,577 bytes) and `provenance/clause-index.json` (1,877,776 bytes) generated asset classes. Runtime source references neither, and neither appears in `dist`. The worker fetches only `kb.pvm`, so the recorded QLF “fallback” cannot recover image-format failure; document chunks already carry the clauses used by the ladder, so the serialized index is also dead. Acceptance: `pnpm build && node tools/review-probes/a9-dead-assets.test.mjs` exits 0 after each asset gains a tested consumer or leaves the build, manifest, reproduction output, and claims.

### A10+

`build.mjs` calls `payloadSource()`, `catalogRecords()`, and `deriveProvenance()`; the first two both call `clinicalArtifacts()`, which itself calls `deriveProvenance()`. One build therefore parses coverage, projection, source, alignment, clauses, and all 337 chunks three times. Five-run medians were 343.9 ms, 250.3 ms, and 133.9 ms for those three paths. Acceptance: `node tools/review-probes/a10-duplicate-derivation.test.mjs` exits 0 after the orchestrator derives one immutable model and passes its projections to payload, catalog, graph, and writers.

### A11+

`package.json` defines `release:check = gate + kb:reproduce + smoke + browser:check`; the Pages build job runs only `pnpm gate` before uploading `dist`. Thus the sole production workflow can publish without the byte-reproduction, nested-host, lazy-load, live-answer, responsive, and cancellation checks that define a release. Acceptance: provision the browser dependency in CI and make `node tools/review-probes/a11-release-workflow.test.mjs` exit 0 because the publishing job runs `pnpm release:check` before upload.
