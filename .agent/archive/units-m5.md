# Closed IMPLEMENT units — u3-u9

Retired record. Live successors: the acceptance contract per unit in `.agent/contracts/`,
the law each unit wrote in `.claude/rules/`, and the open path in `.agent/spec.md`
`Deferred`. Nothing here binds current work; it exists so a close summary is readable
without walking `git log`.

u3→u7 = the answer/proof spine; u8→u9 = the graph renderer ruling and its probe. Contract +
suite each.

- **u3** `m5u3.md` · `clinical-answer-live` 5 cases. `clinical_advice/3` = 1 static derivation
  rule over `clinical_derive/4`, 0 answer facts; 12/12 terms + source ids `==` u1's oracle.
  `findall/3` alone shipped a truncated answer → the rule counts gates and demands an equal
  derivation count, so answers are all-or-nothing (A10).
- **u4** `m5u4.md` · `clinical-proof-live` 7 cases through the production RPC.
  `clinical_advice/3` projects `/4`, whose 4th arg is the proof ⇒ answer and proof are ONE
  derivation; `clinical_advice_source/4` + `advice_nodes/2` gone. `ProofStep` =
  clause|assumption|negation.
- **u5** `m5u5.md` · 3 cases in `provenance-ladder.dom`. Dedup is per PROOF: 3,930 leaves →
  the document's own 4–131 premises, inside the existing `Live Prolog proof` rung with a
  hypothetical badge and no line; the one NAF goal gets its own. Six rungs unchanged.
- **u6** `m5u6.md` · `tools/kb/exports.mjs` + `kb:export-check` + 4 cases in
  `legacy-export-lane`. `EXPORTED` declares the 4 ids and refuses a divergent bag by name; the
  live `writeq` of the WHOLE `'$guideline_answers'` envelope matches all four committed
  oracles byte for byte; erasing one `category-A-recommendation` entity line reddens
  category-A alone.
- **u7** `m5u7.md`, 12 predicates + the C2 disposition (five classes restored, none by
  rationale). `clinical-binding` perturbs `guideline_*` three compiled ways: an additive
  overlay, one erased cited clause (drops exactly its document + proof), a one-line shift
  (+1 on every proof line, 12 answers identical). `tools/binding-check.mjs` requires 35 named
  cases across 11 suites and REPLACES `pnpm test` in the gate. `tools/answer-oracle.mjs` gives
  `smoke` + `browser:check` one bag-derived expectation, graded byte for byte in BOTH locales.
  `pnpm binding:replay` shows the erasure invisible at `a944fca`, dropping one document now.
- **u8** `m5u8.md`, 11 predicates. Four arms × 14 fixtures × 2 viewports at the measured
  CANVAS box (1152×558 / 296×384 — device-size numbers overstate by ~1.4×). vis-network
  rejected; edge-view contract R1–R7 is what u9–u13 decide against.
- **u9** `m5u9.md`, 10 predicates · `pnpm graph:check` mounts the SHIPPED `mountGraphCanvas`
  in a real browser over 14 fixtures × 2 viewports; four controls redden it. Bezier, wrapped
  labels outlined in the node's own colour, `autounselectify`, an 11 px fit floor, and ONE
  fcose layout with the subject pinned — the `concentric` branch every answer view took cost
  156 crossings against fcose's 56, so u8's spike never measured the shipped surface.
