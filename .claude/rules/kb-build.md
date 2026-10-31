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

- **The KB enters as a `cnl-ckc` GitHub release alone** (user ruling): `kb/` holds release
  `kb-2026-10-29-rc.1`'s two assets byte for byte — the archive
  `cnl-ckc-kb-only-2026-10-29-rc.1.tar.gz` and its `.sha256` sidecar, whose one line names the
  archive in `sha256sum -c` form. BagIt 1.0; verify = `pnpm kb:build`, in memory, never
  extracting. 1518 payload + 6 tag entries + the tagmanifest = 1525 members.
- **Intake = `pnpm kb:fetch <tag>`** (`tools/kb/release.mjs`), nothing else: the tag's release
  must publish exactly one `.tar.gz` beside its `.sha256` sibling, each equal to GitHub's own
  asset digest, the sidecar naming the archive and digesting it, the archive a BagIt bag rooted
  `cnl-ckc-kb-g<12 hex>`. It writes both assets byte for byte, `kb/release.json` (repository, tag,
  tag commit, archive, sha256, bag root) and `vendor/cnl-ckc/` (below). `pnpm kb:build` refuses
  a `kb/` that is not the release `kb/release.json` names — archive, sidecar, digest, root;
  control: a record naming another root. `pnpm kb:fetch --verify` fetches the recorded tag again
  and requires every vendored byte equal (a lane: it needs the network).
- **The tag vouches for the archive** (`tools/kb/sshsig.mjs`, OpenSSH `PROTOCOL.sshsig` in pure
  Node, so no host `ssh-keygen`): the intake refuses a lightweight or unsigned tag, and a tag
  whose SSH signature, namespace `git`, does not verify against a key pinned in
  `kb/release-signers` (`allowed_signers` form; pinned: `eturkes@bu.edu`, RSA 4096,
  `SHA256:eJCtE9CPwkojMIH5YMT37SOZ9lSalScUwojKkmD5zuI`, the key that signed
  `kb-2026-10-29-rc.1`). The signed payload must name the recorded commit and tag, and its body
  must hold exactly one `sha256sum` line for the archive, equal to the recorded digest — the
  sidecar and GitHub's asset digest come from the same release as the archive, so that line is
  the one digest a signer vouches for. RSA signs SSHSIG with `rsa-sha2-512` alone, as OpenSSH
  does. `kb/release-tag.json` keeps the signed payload and signature, so `tests/kb-release.test.ts`
  R5–R8 re-verify them offline on every gate run, beside an OpenSSH-made Ed25519 fixture
  (`tests/support/sshsig/`). Control, before every intake's and every `--verify` tag grading: the
  tag with one signature byte flipped must be refused `the signature does not verify`. GitHub reads the key `unknown_key`:
  it is no signing key of the GitHub account, which this check does not need.
- **Archive dialect**: POSIX ustar magic (`ustar\0` + `00`) that ALSO carries five GNU
  `././@LongLink` (`L`) headers for names over 100 chars. A resolving parser (Python
  `tarfile.getmembers`) hides those pseudo-entries — a raw reader must handle `L` or it
  refuses the real bag. Single root dir, all members regular files, mode 0644, uid/gid 0, one
  mtime, gzip mtime field 0.
- The archive name names the release; the root dir (`cnl-ckc-kb-g<12 hex>`) names upstream's
  **input head** — the last commit changing `guidelines/`, the vendored compiler or the
  lexicon — not repo HEAD. The bag's `release-manifest.tsv` holds content digests alone (no
  `meta head` row), so the root dir is the bag's sole commit provenance.
- Payload = 492 docs × 3 representations — `ace/` (source ACE), `pl/` (compiled Prolog,
  schema `1`, 22 indicators), `align/` (source↔ACE alignment, backs the trace view) — plus
  `data/guidelines/schema.pl` (the comparison and arithmetic built-ins, below), `queries/` (6
  `.ace` questions, `pl/` compiled goals, `answers/` expected solutions, `traces/`), `source/`,
  `audit/`, `vocabulary.tsv`. The bag's own `README-dist.md` specifies the schema.
- Rights profile = `redistributable` (public-domain MMWR) → source passages may ship whole in
  the UI. The bag records `swipl 10.0.2` as its compiler; the 10.1.13 WASM runtime loads it.
- Read the bag as an agent: `tar xzf kb/cnl-ckc-kb-*.tar.gz -C .scratch/ &&
  (cd .scratch && ln -sfn cnl-ckc-kb-g* kb)`.

## Upstream port specifications

Upstream's reviewer surface (`ckc ui`) is specified in Verus, vendored from the release's tag
commit (user ruling) at `vendor/cnl-ckc/` — each file at its git blob hash in
`vendor/cnl-ckc/PROVENANCE.tsv`, under upstream's `vendor/cnl-ckc/LICENSE` and
`vendor/cnl-ckc/NOTICE`. Those specs are the TypeScript-port specifications behind
`tools/kb/provenance.mjs` + `src/provenance/`: `vendor/cnl-ckc/rust/ckc-spec/src/check.rs`
`status_of` + `uncovered_class_ok` (coverage grammar — `tests/kb-derived-assets.test.ts` grades
every declared class), `evidence_of` + `payload_of` (coverage row → source payload),
`vendor/cnl-ckc/rust/ckc-spec/src/align.rs` `align_outcome` (source↔ACE span groups),
`vendor/cnl-ckc/rust/ckc-spec/src/ui.rs` `alignment` + `aligned_text`. Its fixture corpus
`vendor/cnl-ckc/tests/ui/` (22 green + 85 red case families) is the adversarial input set for
provenance joins and hostile input; no suite here runs it yet (`.agent/deferred.md`). No graph
command or graph artifact exists upstream.

## Generated payload

`pnpm kb:build` → `kb/generated/{kb.pvm,kb.qlf,kb-manifest.json}`, gitignored. Input = the
492 `pl/` payload files, sorted, joined with `% file:<path>` markers, then `schema.pl` and the
two helpers; the manifest records the sha256 of that whole consulted source as the build
input.

- **Byte-reproducible.** `qsave_program` writes a ZIP whose entry timestamps and whose
  embedded `state.qlf` source mtime both come from wall-clock reads. Pinning `Date.now` for
  the build phase (`withPinnedClock`) makes two forced builds byte-identical. Without the pin
  only ~4 bytes differ, but deflate amplifies them to ~389K differing bytes. Proof =
  `pnpm kb:reproduce`, which also covers the catalog.
- **Engine split**: building needs `swipl-bundle`, which carries the library; loading a saved
  state needs the smaller `swipl-bundle-no-data`. The QLF fallback cannot use the small
  engine, so it costs the large engine plus a QLF several times the PVM — insurance against
  image-format rot, never a size win.
- **Do NOT use `generateImageBuffer`**: it saves without checking the consult result and
  without capturing stderr, so a broken payload still yields an image. `tools/kb/produce.mjs`
  re-implements its four steps, asserts the contract inside the building engine, and fails
  closed on any diagnostic. `qsave_program` legitimately emits two `library(shlib)` warnings
  under WASM; that pair is the only tolerated noise, tolerated **at image save alone** — the
  same text drained from a runtime consult is fatal and poisons its engine.
- `payloadSource` assembles payload → schema → clinical helper → proof source, in that
  order, so no later block can move a document line. The `PAYLOAD` regex admits
  `data/guidelines/*/pl/*.pl` only, so the bag's `queries/` tree is **not** in the PVM.
  `schema.pl` rides its own `% schema:` block: it is no document, and every `% file:` marker
  counts one (`requireEveryDocument`).
- The saved PVM is the shipping form, QLF the fallback: the PVM boots without consulting the
  corpus at all.

## Schema predicates

All 22 indicators are multifile and **static** (`dynamic=false`): `guideline_schema_version/1`,
`guideline_document/4`; the relations `guideline_entity/4`, `guideline_cardinality/5`,
`guideline_event/3`, `guideline_arg/4`, `guideline_pp/4`, `guideline_property/4`,
`guideline_operator/3`; the time annotations `guideline_interval/6`, `guideline_recurrence/4`,
`guideline_frequency/5`, `guideline_order/4`, `guideline_recurrence_window/7`,
`guideline_range/3`; the strength annotations `guideline_grade/5`, `guideline_preference/4`,
`guideline_qualifier/4`; `guideline_unit/3`; the scope-exclusion record
`guideline_exclusion/1`, the supersession record `guideline_supersession/4` and the evaluation
date `guideline_evaluation_date/1`, which no document states — a program does. A direct
`assertz` raises a permission error → any overlay must call `dynamic/1` first; the overlay is
visible to queries and gone after a fresh image load.

`schema.pl` defines the comparison built-ins `guideline_satisfies/4,6` (over
`guideline_within/4` + `guideline_scale/3`) and the arithmetic built-ins `guideline_product/6`,
`guideline_quotient/6` (over exact counts, a non-integer one `rational(P,Q)`), which rule bodies
and the `tablet-use-spacing` export call and no document defines. Upstream's traces record each
call as a `builtin(G)` leaf; the demo's meta-interpreter records it the same way
(`.claude/rules/proof.md`).

**Guards** (README-dist `Scope exclusions`, `Superseded statements`): every `should`, `must` and
`may` edge clause of a scoped document ends with `\+ guideline_exclusion('cdc-2022-opioid')`,
and the deontic clauses of the superseded `cdc2022-opioid-rec12-imp08` end with
`guideline_evaluation_date(V), guideline_satisfies(exactly,V,less,20221229)` before it. A
sentence's antecedent is therefore read without the scope guard (`tools/kb/clinical.mjs`
`antecedent`), and the graph projects neither guard.

Clause counts: version 492, document 492, entity 3126, cardinality 3126, event 2415, arg
4744, pp 1715, property 69, operator 1843, interval 56, recurrence 15, frequency 3, order 165,
recurrence_window 4, range 8, grade 24, preference 31, qualifier 414, unit 88, exclusion 12,
supersession 3.

**Counting vocabulary, kept distinct.** Static clause SITES ≠ derivable SOLUTIONS: 3,126
`guideline_entity/4` sites yield 604 derivable entity solutions, and 2,415 event sites yield
412. Runtime predicate calls expose only the derivable minority — the full graph needs static
`clause/2` extraction. Corpus via SWI-Prolog, authoritative: **1476 noun atoms, 194 verbs,
492 docs**.

## Question catalog

- The catalog is **GENERATED, not transcribed**: `tools/kb/catalog.mjs` re-exports
  `clinicalArtifacts`, so `kb:build` emits `kb/generated/question-catalog.json` —
  `{catalogVersion: 4, entries}`, 7 entries of `id question goal marksGoal projection provenance` —
  from the bag alone; `kb:asset-check` re-derives it and fails on any mismatch. The rejected
  alternative — repo-source goals policed by a bag-divergence gate step — measured
  1036.812 ms against a 0.631 ms median.
- The shipped catalog is the **clinical** one. `CLINICAL_QUESTIONS` owns the curated topics
  and every answer statement and source coordinate is re-read from the bag on each build; its
  goals run `clinical_advice/3`, and each entry's `marksGoal` runs `clinical_marks/3` over the
  same derivation (`.claude/rules/proof.md` `The marks goal`). Nothing on the catalog path reads
  the bag's `queries/` tree — that tree belongs to the legacy export lane below.
- Query goals reach the engine from the catalog, never from the image.
- **The build cache keys on inputs, never on producer code.** It compares the bag input, the
  payload source, the toolchain and the catalog, so an edit to a producer (`graph.mjs`,
  `provenance.mjs`) leaves the cached asset in place: `node tools/kb/build.mjs
  --force` rebuilds it. `kb:asset-check` re-derives the graph from the bag and refuses the stale
  asset (`manifest metadata differs from fresh derivation`), so the gate stays red until then.
- `MANIFEST_VERSION` is 8. Bumping it is what stops a cached manifest from lacking a block or an
  asset a new build writes.
- `provenance/corpus-index.json` (`tools/kb/corpus.mjs`) = each evidence chunk's id, review label
  and coverage region, sorted by id, derived from the chunks `provenance.mjs` emits; the corpus
  browser fetches it on activation alone. `kb:asset-check` re-derives it like every derived asset,
  and `tests/corpus-index.test.ts` re-reads each row from its own chunk.

## Legacy export lane

The legacy export lane — `tests/legacy-export-lane.test.ts`, required by `binding:check` — proves
the compiled KB still answers the upstream export exactly; `pnpm kb:export-check`
(`tools/kb/export-check.mjs`) is its early preflight, refusing a bag whose exported query set
drifted. It is a diagnostic lane, separate from the catalog above.

- `tools/kb/exports.mjs` declares the six exported query ids in `EXPORTED` and refuses any
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
  rendered by `writeq` inside the image; all six match byte for byte.
- Live yield: category-A 7 solutions, dosage-reduction 2, evidence-type-1 1,
  long-term-therapy-onset 1, recommendation-exists `yes`, tablet-use-spacing 4. The last two
  exercise the time annotations, `guideline_unit/3` and `guideline_satisfies/4,6`.
- Sort = SWI standard order over decoded terms, never a byte sort of rendered text. The two
  diverge on mixed shapes (`10` precedes `'2'` numerically, follows it lexically). Lists
  order as their `'[|]'/2` chain; `[]` orders as an atom. Live `findall` order already equals
  committed order on this corpus, so the sort buys order-independence, not this data.
- The byte comparison lives in `tests/legacy-export-lane.test.ts` because `kb:asset-check`
  bans `queries/answers` reach over `tools/` — a comment merely spelling the path reddens the
  scan. `pnpm binding:check` names its four oracle cases — D1, D2, D3/D4, D5 — in the required
  inventory, so deleting the file, renaming one of them or skipping it fails the gate; the
  `D2 guards` case is not required.
- The lane is GREEN at base. Its firing is going RED when the payload stops supporting an
  export: erasing one `category-A-recommendation` entity line drops that document from the
  category-A statement while the other five exports still match. Its credit is the
  default-operator mutants `pnpm stryker` shows it killing in `exports.mjs`, `paths.mjs` and
  `produce.mjs` (`.agent/contracts/mnt5-stryker.md`).

## Oracles and reach

- Committed `queries/answers/*.pl` and `queries/traces/*.pl` are **regression oracles only,
  never response data**. The export lane byte-matches all six committed answers on every
  gate run.
- Forbidden-reach check = a byte scan over `src`, `tools`, `server`, `vite.config.ts`, `index.html`
  and the runtime-loaded `kb/generated` assets in
  `kb:asset-check`. ESLint cannot do it: core `no-restricted-imports` visits import and
  export declarations only, so `import()` and `fs.readFile` escape it. `tests/` is out of
  scope on purpose — reading committed answers is what makes them oracles.
- `kb:asset-check`'s sibling-path scan matches `../cnl-ckc` only at a **name boundary** —
  this project's own `cnl-ckc-demo` shares that prefix and must not trip it.
