---
paths:
  - "kb/**"
  - "tools/kb/**"
  - "src/kb/**"
  - "tests/kb-*.ts"
  - "tests/legacy-export-lane.test.ts"
---

# Knowledge-base pipeline

## Vendored bag

- `kb/cnl-ckc-kb-g<sha>.tar.gz` + a `.sha256` sidecar. BagIt 1.0; verify = `pnpm kb:build`,
  in memory, never extracting. 1041 payload + 5 tag entries + the tagmanifest = 1047 members.
- **Archive dialect**: POSIX ustar magic (`ustar\0` + `00`) that ALSO carries five GNU
  `././@LongLink` (`L`) headers for names over 100 chars. A resolving parser (Python
  `tarfile.getmembers`) hides those pseudo-entries — a raw reader must handle `L` or it
  refuses the real bag. Single root dir, all members regular files, mode 0644, uid/gid 0, one
  mtime, gzip mtime field 0.
- The name tags the **last commit touching `guidelines/`** upstream, not repo HEAD. The bag's
  own provenance = the `meta head` row in its `release-manifest.tsv`.
- Payload = 337 docs × 3 representations — `ace/` (source ACE), `pl/` (compiled Prolog,
  schema v1), `align/` (source↔ACE alignment, backs the trace view) — plus `queries/`
  (4 `.ace` questions, `pl/` compiled goals, `answers/` expected solutions, `traces/`),
  `source/`, `audit/`.
- Rights profile = `redistributable` (public-domain MMWR) → source passages may ship whole in
  the UI. The bag records `swipl 9.2.9` as its compiler; the 10.1.13 WASM runtime loads it.
- Regenerate: `python3 -P tools/dist.py build <outdir>` run in `../cnl-ckc`, then copy the
  tarball + sidecar into `kb/`. Leave that repo clean. `tools/dist.py` is the release
  boundary and `goal.py` compiles ACE questions upstream — both are regeneration inputs,
  never runtime deps.
- Read the bag as an agent: `tar xzf kb/cnl-ckc-kb-*.tar.gz -C .scratch/ &&
  ln -sfn cnl-ckc-kb-* .scratch/kb`.

## Upstream port specifications

`../cnl-ckc/tools/ui.py` resolves coverage rows to source payloads and renders click/hover
-linked source↔ACE span groups; `parse_evidence`, `hl_parse_align` and its model joins are
the TypeScript-port specifications behind `src/provenance/`. Its `tests/ui/` fixture corpus
(15 green + 84 red case families) is the adversarial oracle for provenance joins and hostile
input. No graph command or graph artifact exists upstream.

## Generated payload

`pnpm kb:build` → `kb/generated/{kb.pvm,kb.qlf,kb-manifest.json}`, gitignored. Input = the
337 `pl/` payload files, sorted, joined with `% file:<path>` markers; the manifest records
that concatenation's sha256 as the build input.

- **Byte-reproducible.** `qsave_program` writes a ZIP whose entry timestamps and whose
  embedded `state.qlf` source mtime both come from wall-clock reads. Pinning `Date.now` for
  the build phase (`withPinnedClock`) makes two forced builds byte-identical. Without the pin
  only ~4 bytes differ, but deflate amplifies them to ~389K differing bytes. Proof =
  `pnpm kb:reproduce`, which also covers the catalog.
- **Engine split**: building needs `swipl-bundle` (6.2 MB, carries the library); loading a
  saved state needs `swipl-bundle-no-data` (2.6 MB). The QLF fallback cannot use the small
  engine, so choosing it costs 6.2 MB + a 2.2 MB artifact against 2.6 MB + ~0.45 MB — it is
  insurance against image-format rot, never a size win.
- **Do NOT use `generateImageBuffer`**: it saves without checking the consult result and
  without capturing stderr, so a broken payload still yields an image. `tools/kb/produce.mjs`
  re-implements its four steps, asserts the contract inside the building engine, and fails
  closed on any diagnostic. `qsave_program` legitimately emits two `library(shlib)` warnings
  under WASM; that pair is the only tolerated noise, tolerated **at image save alone** — the
  same text drained from a runtime consult is fatal and poisons its engine.
- `payloadSource` assembles payload → clinical helper → proof source, in that order. The
  `PAYLOAD` regex admits `data/guidelines/*/pl/*.pl` only, so the bag's `queries/` tree is
  **not** in the PVM.
- Corpus load, measured: 337-file consult 2806 ms · concatenated source 3299 ms ·
  `load_string` 3578 ms · QLF 213 ms + 724 ms boot · **saved PVM 335 ms boot+load**. PVM is
  the shipping form, QLF the fallback.

## Schema predicates

All 9 are multifile and **static** (`dynamic=false`): `schema_version`, `document`,
`guideline_entity/4`, `guideline_cardinality/5`, `guideline_event/3`, `guideline_arg/4`,
`guideline_pp/4`, `guideline_property/4`, `guideline_operator/3`. A direct `assertz` raises a
permission error → any overlay must call `dynamic/1` first; the overlay is visible to queries
and gone after a fresh image load.

Clause counts: version 337, document 337, entity 1834, cardinality 1834, event 1254, arg
2513, pp 1003, property 16, operator 1193.

**Counting vocabulary, kept distinct.** Static clause SITES ≠ derivable SOLUTIONS: 1,834
`guideline_entity/4` sites yield 316 derivable entity solutions, and 1,254 event sites yield
232. Runtime predicate calls expose only the derivable minority — the full graph needs static
`clause/2` extraction. Corpus via SWI-Prolog, authoritative: **800 noun atoms, 127 verbs,
337 docs**, 0.6 s co-load.

## Question catalog

- The catalog is **GENERATED, not transcribed**: `tools/kb/catalog.mjs` re-exports
  `clinicalArtifacts`, so `kb:build` emits `kb/generated/question-catalog.json` —
  `{catalogVersion: 3, entries}`, 7 entries of `id question goal projection provenance` —
  from the bag alone; `kb:asset-check` re-derives it and fails on any mismatch. The rejected
  alternative — repo-source goals policed by a bag-divergence gate step — measured
  1036.812 ms against a 0.631 ms median.
- The shipped catalog is the **clinical** one. `CLINICAL_QUESTIONS` owns the curated topics
  and every answer statement and source coordinate is re-read from the bag on each build; its
  goals run `clinical_advice/3`. Nothing on the catalog path reads the bag's `queries/` tree
  — that tree belongs to the legacy export lane below.
- Query goals reach the engine from the catalog, never from the image.
- `MANIFEST_VERSION` is 5. Bumping it is what stops a cached manifest from lacking a block a
  new build writes.

## Legacy export lane

`pnpm kb:export-check` (`tools/kb/export-check.mjs`) proves the compiled KB still answers the
upstream export exactly. It is a diagnostic lane, separate from the catalog above.

- `tools/kb/exports.mjs` declares the four exported query ids in `EXPORTED` and refuses any
  bag whose exported set differs, naming every offender. Goal TEXT stays derived from the
  bag; **which questions exist is declared**, because an extra or renamed query file
  otherwise enlarges the lane with a check that agrees with itself.
- `queries/` is **not in the PVM** — `payloadSource`'s payload pattern admits
  `data/guidelines/*/pl/*.pl` alone — so the lane reads goal text out of the verified bag at
  run time and runs it against the shipped image. A forced `kb:build` after the lane shipped
  returns byte-identical pvm, qlf and manifest.
- Goal grammar: `'$guideline_query_projection'(goal(G),answers(As))`, `G` in canonical prefix
  `','/2` form. `answer(Var,noun(N,countable)|wh(what))` names a projected column;
  `answers([])` = existence question → `yes`/`no`, not an empty row set.
- The comparison covers the WHOLE `'$guideline_answers'` envelope, not its solution list
  alone: `query_sha256` is the sha256 of the query file itself, so the identity the oracle
  records is recomputed from the bag rather than copied out of the oracle. The live term is
  rendered by `writeq` inside the image; all four match byte for byte.
- Live yield: category-A 7 solutions, dosage-reduction 2, evidence-type-1 1,
  recommendation-exists `yes`.
- Sort = SWI standard order over decoded terms, never a byte sort of rendered text. The two
  diverge on mixed shapes (`10` precedes `'2'` numerically, follows it lexically). Lists
  order as their `'[|]'/2` chain; `[]` orders as an atom. Live `findall` order already equals
  committed order on this corpus, so the sort buys order-independence, not this data.
- The byte comparison lives in `tests/legacy-export-lane.test.ts` because `kb:asset-check`
  bans `queries/answers` reach over `tools/`. `kb:export-check` runs that suite and requires
  case ids `D1 D2 D3 D5` to have PASSED, so deleting the file, renaming a case or skipping
  one fails the gate.
- The lane is GREEN at base and its whole credit is going RED when the payload stops
  supporting an export: erasing the single `category-A-recommendation` entity line drops that
  document from the category-A statement while the other three exports still match.

## Oracles and reach

- Committed `queries/answers/*.pl` and `queries/traces/*.pl` are **regression oracles only,
  never response data**. The export lane byte-matches all four committed answers on every
  gate run.
- Forbidden-reach check = a byte scan over `src`, `tools`, `vite.config.ts`, `index.html` in
  `kb:asset-check`. ESLint cannot do it: core `no-restricted-imports` visits import and
  export declarations only, so `import()` and `fs.readFile` escape it. `tests/` is out of
  scope on purpose — reading committed answers is what makes them oracles.
- `kb:asset-check`'s sibling-path scan matches `../cnl-ckc` only at a **name boundary** —
  this project's own `cnl-ckc-demo` shares that prefix and must not trip it.
