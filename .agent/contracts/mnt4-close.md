# mnt4 Close — deferral-queue run, closing review check set

Fixed before dispatch. Target = the shipped surface that `git diff f855bb5..74fc9d9` touched, read
at `74fc9d9` (`.agent/spec.md` Decisions: judgment review reads the shipped surface). Producer =
`../cnl-ckc` at `2acd0d70`, read-only. One `reviewer` covers every lens (MAINTAIN). Findings bind
to these rows; anything outside them is a register entry. The security lens stays on MAIN: no
row touches an untrusted-input surface beyond PDF text items compared as strings.

| id | lens | check |
|---|---|---|
| A1 | product | `src/provenance/locate.ts` skips an item only when its trimmed text is exactly `•` or `ï`; in the shipped `guideline.pdf` every such item is a list marker, never content; an in-word `ï` (`naïve`) still folds as a letter; every coverage passage that located at `f855bb5` (whole or continuing) locates the same way at `74fc9d9`, plus `s9-01` + `s9-05` whole and `rec10-imp10` continuing, whose remainder genuinely starts the next page. |
| A2 | product | For the three newly located passages the returned `items` are exactly the passage's own text items on the recorded page, with no skipped bullet item marked; the shipped page viewer, built and driven in a real browser, marks at least one of the three. |
| B1 | gate | `tests/passage-locate.test.ts` is RED at base `f855bb5` by the command `005903a`'s body records and green at `74fc9d9`; its bullet case would go red under a fold that dropped `ï` per character rather than per item. |
| B2 | gate | `tools/spec-check.mjs`: `gradeTasks` is unchanged; on the real spec every control fires with its original refusal; on a `Tasks` block holding no ticked row, no open row, or neither, the planted controls fire and name `a planted …`; a planted row reaches only a graded copy, never the real verdict; `pnpm spec:check` still grades `.agent/spec.md` alone. |
| B3 | gate | `tests/spec-check.test.ts` grades copies of the REAL spec, and each case is RED at the base its commit body records (`d052941`, `74fc9d9`) by the recorded command. |
| C1 | records | `.agent/deferred.md`, `.agent/spec.md` `Tasks`, `.claude/rules/ui.md` (Page viewer) and `.claude/rules/gate.md` (`spec:check` firing row) state what the tree does; the coverage-passages row's producer citation matches `../cnl-ckc` (`coverage.tsv` B3-09/B3-10, `audit/census-map.tsv` `p013.C13`–`C15`); the heap row's swipl-wasm 8.2.1 sentence claims no more than a bare-runtime probe shows; `docs/claims.md` moved anchors alone, every digest unchanged. |
| C2 | records | The bodies of `05ee351`, `005903a`, `e4de686`, `d052941` and `74fc9d9`: every measurement, red witness and quoted firing reproduces by its recorded command, and no sentence claims beyond what it measured. |

## Verdicts

`mnt4-reviewer-1` (reviewer), read at `67ca2a5` (= `74fc9d9` + this check set): 7/7 pass, no
register entry. A1: 227 lone `•` + 54 lone `ï` items, all bullet fonts, each followed by a space
and text; every passage located at `f855bb5` locates the same way, plus exactly the three named.
A2: item sets = the passage span minus whitespace/bullet items; the built viewer marks all three.
B1: base 2/8 red; a per-character `ï` drop reddens the bullet case (`expected { coverage: 'whole',
items: [ 2 ] } … 'none'`, rematched by MAIN). B2: `gradeTasks` bytes unchanged; real, no-ticked,
no-open and empty blocks each fire their controls; planting never moves the verdict. B3 + C2:
every recorded red witness and quoted firing reproduces. C1: producer citations match `2acd0d70`.
Security lens = MAIN: pass — `locate.ts` compares PDF text items as strings; `spec-check.mjs`'s
optional path is a local CLI argument; no dependency moved.
