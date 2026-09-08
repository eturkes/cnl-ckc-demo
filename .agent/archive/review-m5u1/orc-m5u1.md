# orc-m5u1 — independent reference producer + corpus for M5 u1

Gate: `python3 -P .scratch/validate-report.py .scratch/agents/orc-m5u1.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, dense/telegraphic, `→`/`=` notation, no prose padding, ≤400
chars. `evidence` = `path`, `path:line`, or `` `cmd` `` that reproduces it, ≥8
chars — a bare `` `cmd` `` placeholder fails the gate.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table are keyed by row id; write one only where MAIN
needs more than the row to rule. MAIN reads the table first — it is the budget.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| O1 | 686 sites; `cdc2022-opioid-recNN`→S2+ counts/Σ: 01 9,10,24/43; 02 18,7,12,12,9,9,6/73; 03 18,18,18/54; 04 6,6,6,6,6,12,12,9,9/72; 05 15,18,24,15/72; 06 9/9; 07 42,42,36,24/144; 08 12,12,12,18/54; 09 9,9,9,12,18/57; 10 12,12,20/44; 11 6,9/15; 12 14,11,24/49. | `node tools/m5u1-reference.mjs summary` |
| O2 | 48/48 selected sentences have one body; 28 distinct antecedent strings; multi-body violations=0. Producer fails before emission on any non-singleton body set. | tools/m5u1-reference.mjs |
| O3 | 346 grounded positive premises: entity/4=108, cardinality/5=108, operator/3=4, event/3=34, arg/4=68, pp/4=23, property/4=1. `rec05:S5` drops its 5 nested NAF literals; both positives share skolem ordinal 0. | `node tools/m5u1-reference.mjs summary` |
| O4 | 38 independently grouped/rendered fragments across 12 documents byte-match every live-image `clinical_answer` group list; divergences=0. The comparison treats the PVM as a black box. | `node tools/m5u1-reference.mjs compare-shipped` |
| O5 | Committed v1 corpus=48 `(Doc,S)` records: 686 raw+ground site heads, 48 antecedents, 346 premises, 48 sentence→38 group fragments, 7 question strings, and 12-document contribution order; 442275 B; SHA-256 `f7b0788a…de278`. | tests/fixtures/m5u1-reference.json |
| O6 | unknown | unknown |
| O7 | unknown | unknown |
| O8 | unknown | unknown |
| O9 | unknown | unknown |
| O10 | unknown | unknown |

## Row prompts

- **O1** — independent content-site enumeration over the real payload. Report the
  total, the per-document breakdown, and the per-sentence counts. Import NOTHING from
  `tools/kb/clinical.mjs` except the frozen `parseAdviceSentence`.
- **O2** — independent per-sentence antecedent derivation + the distinct-body
  singleton check. Report any sentence with more than one distinct body.
- **O3** — independent premise decomposition: positive literals of each antecedent,
  `\+` handling, repeated-variable sharing, skolem grounding. Report the total premise
  count and the distinct premise shapes.
- **O4** — independent fragment rendering: the `rule(...)` term per sentence group.
  Report whether your rendering byte-matches the shipped `clinical_answer` group terms
  and show any diff exactly.
- **O5** — the corpus artifact: one committed JSON fixture carrying every record
  (sites, antecedents, premises, fragments) keyed by `(document, sentence)`. This is
  the `prod` deliverable MAIN's validator grades.
- **O6** — differential harness: your corpus vs MAIN's emitted helper source, as a
  committed script MAIN reruns. Report the divergence count and classify each.
- **O7** — worked example `cdc2022-opioid-rec01` S2: reproduce **9** sites, the bare-KB
  0 / clinician-context 1 / per-site-deletion 0 pattern, and the same-head-new-line
  refutation. Independent re-derivation, not a citation.
- **O8** — negative controls: premises withheld, and schema erased. Report the outcome
  for all 12 documents under each.
- **O9** — determinism: two independent runs of your producer emit byte-identical
  output. Report the hash both times.
- **O10** — divergences vs `.agent/contracts/m5u1.md`. Every place the contract's
  predicates are unsatisfiable, ambiguous, or wrong as written. An empty finding here
  is a valid, meaningful result — say so explicitly if you find none.
