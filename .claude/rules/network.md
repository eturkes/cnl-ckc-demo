---
paths:
  - "tools/kb/network.mjs"
  - "tools/kb/network-tables.mjs"
  - "tools/kb/frames.mjs"
  - "tests/network-*.ts"
  - "tests/support/network-*.ts"
  - "tests/acceptance-gi-network*.ts"
---

# Clinical network

- `kb/generated/graph/clinical-network.json` = `tools/kb/network.mjs` over g1's per-sentence
  frames (`tools/kb/frames.mjs`) and the declared word tables (`tools/kb/network-tables.mjs`).
  Contract, fields and predicates N1–N12 and F1–F24 = `.agent/contracts/g2.md`; the inherited
  range low and earlier-sentence referents = `.agent/contracts/g2r.md`. `kb:asset-check`
  re-derives it from the bag; a producer or table edit needs `node tools/kb/build.mjs --force`,
  because the build cache keys on inputs alone.
- **A clause names its `% S` block** (README-dist `Proof traces`, user ruling): a head may cite an
  EARLIER sentence's product referent of its document, which `tools/kb/provenance.mjs`
  `parseClauseSites` admits after checking every head id. The frames read it as
  `ref(N)@S<s>[<Deps>]` — never this sentence's `ref(N)`, never without its `Deps` (a split's
  variants share one `ref(N)`) — and the network takes its noun from that sentence. A `Deps`
  variable the citing body leaves unbound refuses the build by name (queue row in
  `.agent/deferred.md`).
- The network reads the KB's logic structure — frames over the compiled clauses — never text
  patterns (`Decisions`). Every sentence holds one coverage record, and every occurrence sits in
  exactly one bucket (`line`, `loop`, `shared`, `statement`, `example`), counted per sentence.
- **The word tables are ruled data, not a derivation.** Each entry is a reading MAIN ruled and a
  consultant reviewed; the KB states none of them. N12 grades every table total over its corpus
  census, so a candidate a new bag adds fails N12 by name and enters its table or that table's
  exclusions by hand, with its reason.
- **Guards ride every occurrence.** An occurrence takes the scope guard and the date guard from
  its own heads and from every operator head on its context chain, so a modal under a guarded
  `should` keeps the guard (N9). Every exclusion and supersession record projects, with no
  evaluation-date exemption (n30 Accept, moved from `tests/graph-annotations.test.ts` A1).
- Polarity's duty carries over from the linguistic graph: no line reads as a claim its source
  denies. A negated or negation-as-failure condition starts no line (N4), and a negation or a
  modal rides the line's verb phrase as its operator chain reads (N3).
- **The concept codebook is hand-made data** (`tools/kb/network-codebook.mjs`, contract
  `.agent/contracts/g3.md`): `networkAsset` classifies every concept through `classify`, which
  refuses the build by name on an uncoded concept, a stale entry or an undeclared class. A concept
  a new bag adds enters the codebook and its record `.agent/contracts/g3-coding.tsv` coded under
  g3's rubric by two independent `classifier`s and adjudicated; K4 holds the codebook equal to the
  record. A codebook edit, like a producer or table edit, needs `node tools/kb/build.mjs --force`.
- The linguistic graph (`tools/kb/graph.mjs`, `.claude/rules/graph.md`) ships beside the network
  until g7 retires it.
