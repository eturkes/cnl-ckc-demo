---
paths:
  - "kb/**"
  - "tools/kb/**"
  - "src/kb/**"
  - "tests/kb-*.ts"
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

- The catalog is **GENERATED, not transcribed**: `tools/kb/catalog.mjs` parses the bag's
  `queries/pl/*.pl` in memory during `kb:build` and emits
  `kb/generated/question-catalog.json`; `kb:asset-check` re-derives it and fails on any
  mismatch. The rejected alternative — repo-source goals policed by a bag-divergence gate
  step — measured 1036.812 ms against a 0.631 ms median.
- `catalog.mjs` declares the four exported query ids in `EXPORTED` and refuses any bag whose
  exported set differs. Goal text stays derived; **which questions exist is declared**,
  because an extra or renamed query file otherwise enlarges the catalog with both catalog
  gate steps agreeing with themselves. A bag exporting a different question set must edit
  that list.
- Query goals reach the engine from the catalog, never from the image.
- Goal grammar: `'$guideline_query_projection'(goal(G),answers(As))`, `G` in canonical prefix
  `','/2` form. `answer(Var,noun(N,countable)|wh(what))` names a projected column;
  `answers([])` = existence question → `yes`/`no`, not an empty row set.
- Repo-authored goals derive from an exported analog by ONE **token-exact single-hit atom
  substitution**. Substring replace is unsafe: the corpus carries `'category-B-decision'`,
  `'evidence-type-2-recommendation'` and `'evidence-type-4-recommendation'`.
- Live solution counts, all six catalog questions: category-A 7, dosage-reduction 2,
  evidence-type-1 1, recommendation-exists 12 (renders `yes`), category-B 5,
  evidence-type-3 3.
- Sort = SWI standard order over decoded `PlTerm`, never a byte sort of rendered text. The
  two diverge on mixed shapes (`10` precedes `'2'` numerically, follows it lexically). Lists
  order as their `'[|]'/2` chain; `[]` orders as an atom. Live yield order already equals
  committed order on this corpus, so the sort buys order-independence, not this data.
- `MANIFEST_VERSION` 2 adds the `catalog` block; the bump is what stops a cached manifest
  from lacking it.

## Oracles and reach

- Committed `queries/answers/*.pl` and `queries/traces/*.pl` are **regression oracles only,
  never response data**. Live WASM byte-matches all four committed answers.
- Forbidden-reach check = a byte scan over `src`, `tools`, `vite.config.ts`, `index.html` in
  `kb:asset-check`. ESLint cannot do it: core `no-restricted-imports` visits import and
  export declarations only, so `import()` and `fs.readFile` escape it. `tests/` is out of
  scope on purpose — reading committed answers is what makes them oracles.
- `kb:asset-check`'s sibling-path scan matches `../cnl-ckc` only at a **name boundary** —
  this project's own `cnl-ckc-demo` shares that prefix and must not trip it.
