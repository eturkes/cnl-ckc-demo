# diff-m5u1 — differential: MAIN's producer vs the independent reference

Gate: `python3 -P .scratch/validate-report.py .scratch/agents/diff-m5u1.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, dense/telegraphic, `→`/`=` notation, no prose padding, ≤400
chars. `evidence` = `path`, `path:line`, or `` `cmd` `` that reproduces it, ≥8
chars — a bare `` `cmd` `` placeholder fails the gate.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table are keyed by row id; write one only where MAIN
needs more than the row to rule. MAIN reads the table first — it is the budget.

Each row's `finding` = the divergence COUNT plus a classification of every
divergence. Zero divergences is a valid, meaningful result — say so explicitly.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| D1 | 0 divergences → 48 keyed gates cover 686/686 unique sites both ways; ordered `{line,head,body}` vectors and independently normalized ground heads match for every `(Doc,S)`. | `pnpm exec vitest run tests/clinical-differential.test.ts --project node` |
| D2 | 0 divergences → 346/346 premises match per `(Doc,S)` in antecedent order; head→premise skolem sharing is structurally identical after opaque-ordinal renaming. | `pnpm exec vitest run tests/clinical-differential.test.ts --project node` |
| D3 | 0 divergences → 48 per-sentence `clinical_rule` and 48 `clinical_gate` records match independent fragments in QUESTION/SOURCE order; every gate closes through its own `(Doc,S,Rule)`. | `pnpm exec vitest run tests/clinical-differential.test.ts --project node` |
| D4 | 0 divergences → consequent-key reassembly of MAIN's 48 sentence rules yields 38 groups across 12 documents; every list byte-matches independent ACE grouping and shipped `clinical_answer`. | `pnpm exec vitest run tests/clinical-differential.test.ts --project node` |
| D5 | 0 determinism divergences → reference SHA-256 `340043d9…757ec2e` ×2; `kb:reproduce` rc0 with PVM `9d78042f71e6` and QLF `01b539757980` byte-identical across two forced builds. | `node tools/clinical-reference.mjs determinism && pnpm kb:reproduce` |
| D6 | 0 ship-gate divergences → format/lint/check rc0; test=26/26 files, 298/298 cases rc0. An earlier unchanged run hit two unrelated 5 s timeouts; no differential failed. | `pnpm format:check && pnpm lint && pnpm check && pnpm test` |
| D7 | 2 contract divergences → arithmetic: P2 says 46/48 native while four named gates are non-native, so max=44; diagnostic: D3/T14 pin `multiple antecedents`, but production emits `N distinct antecedents, expected one`. | .agent/contracts/m5u1.md:211 |
| D8 | 0 supersession divergences → 686 sites with ordered document totals `43,73,54,72,9,144,54,57,44,15,72,49`; 346 premises in 7 typed shapes; 28 antecedents; 38 groups. | `node tools/clinical-reference.mjs summary` |

## Row prompts

- **D1** — content sites: MAIN's emitted `clinical_gate/4` line lists vs the reference
  producer's independent enumeration. Keyed `(Doc,S)` equality BOTH ways, plus the full
  `{line,head,body}` source vector (T14 ruling 2), not a line multiset.
- **D2** — premises: all 346, per `(Doc,S)` in antecedent literal order. Compare the
  ground literals structurally; skolem ordinals are opaque (T14 ruling 5), so compare
  the SHARING pattern, never a specific ordinal for a specific variable name.
- **D3** — fragments + gates: 48 `clinical_rule/3` and 48 `clinical_gate/4`, per-sentence
  granularity, `Rule` unifying with the gate's `(Doc,S)`.
- **D4** — reassembly: MAIN's 48 per-sentence rules merged by consequent reproduce the 38
  shipped `clinical_answer` group terms byte for byte. Re-derive independently.
- **D5** — determinism: two derivations byte-identical, and `pnpm kb:reproduce` still
  byte-identical with the new records present. Report both hashes.
- **D6** — the harness ships gate-clean: `pnpm format:check`, `pnpm lint`, `pnpm check`
  and `pnpm test` all rc 0 in your worktree with your files present.
- **D7** — contract divergences: every place `.agent/contracts/m5u1.md` is unsatisfiable,
  ambiguous or wrong as written. Carries orc row O10 forward. None is a valid finding.
- **D8** — supersession: does the reference producer reproduce `orc-m5u1`'s committed
  numbers — 686 sites with its per-document breakdown, 346 premises typed, 28 distinct
  antecedents, 38 groups? Any figure that does not reproduce is a finding.

## Details

### D7

- **Arithmetic:** contract verdict P2 says 46/48 gates execute (`m5u1.md:211`), while
  the same contract names four gates that cannot resolve natively (`m5u1.md:225-230`).
  One 48-gate domain cannot contain 46 native successes plus four non-native cases.
  Ruling needed: correct the native count to 44, or name a different execution mode.
- **Diagnostic:** D3 says the guard matches `multiple antecedents` (`m5u1.md:38-39`),
  and T14 says that P5's message is exact (`m5u1.md:284`). Production instead emits
  `N distinct antecedents, expected one` (`tools/kb/clinical.mjs:658`). Ruling needed:
  select one exact category before the red suite can become satisfiable.
