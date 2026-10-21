# n landing close — approved queue rows, closing review check set

Fixed before dispatch. Target = the shipped surface `git diff 5a22cf6..7d72c77` touched, read at
`7d72c77` (`.agent/spec.md` Decisions: judgment review reads the shipped surface), plus the
approval-pending branch `wip/n17-index-control` `f312d8a`, which ships nothing yet but reaches the
user for approval. Landed units: n3 `6507d44`, n4 `2e9e67c`, n5 `3209ee4`, n9 `c7b9b7d`, n11
`93c41eb`, n12 `66aa4b7`, n13 `2e7e8be`, records `7d72c77`; each re-applies a `wip/n*` branch the
user approved. One `reviewer` covers every lens (MAINTAIN); MAIN holds S1. Findings bind to these
rows; anything outside them is a register entry.

| id | lens | check |
|---|---|---|
| M1 | lane | `tools/mutate.mjs` (n3): a vitest check that fails by timeout alone reads `INCONCLUSIVE` and fails the run; a failure other than a timeout, alone or beside a timeout, still kills; a missing or unreadable JUnit report never reads as timeout-only; a command check (`string[]`) grades on exit status as before; no report carries over from one mutant to the next; the `--testTimeout=1` control runs before any mutant and stops the run when it does not fire; gate.md's `pnpm mutate` row says what the code does. |
| C1 | gate | `tools/claims-sweep.mjs` (n4): each `.agent/spec.md` `Artifacts` bullet is one claim unit with its continuation lines; the continuation-line control plants into the REAL spec and is refused by that row; mutant `m15` restores the first-line loop exactly; R047 holds the whole bullet and its verdict is true. |
| C2 | gate | `tools/claims-sweep.mjs` (n12): `units()` skips a leading frontmatter block closed by `---` and nothing else (an unclosed block skips nothing; anchors stay file line numbers); the planted-glob check fails if frontmatter re-enters the claim set; the hand merge with n4 kept both in-run checks and both success-line names; mutant `m14`. |
| C3 | gate | `tools/copy-check.mjs` (n11): every input the retired component filler sweep refused, `gradeLiterals` still refuses, so no check weakened; the empty-component-set guard still fires through `gradeLiterals([])`; the success line's component count is the `.svelte` set the sweep counted; 15 controls. |
| C4 | gate | `tests/inventory.test.ts` (n5): a `text` record with no verbatim text and a gate step recorded `none` are refused by name; a lane may still be `none`; the real inventory passes; the new case is red on `2e9e67c`'s grader. |
| K1 | kernel | n9: the `derive/5` comparison arm (`tools/kb/proof.mjs`) — placement after the `clinical_advice/3` arm, cut, `call/1`, no depth spent, no premise standing in, a false comparison failing, `\+` over one; the decoder's `builtin/1` arm refuses a non-compound; every consumer of `ProofStep` handles `comparison`; the ladder list renders only for a proof holding one; no shipped proof, answer, marks goal or catalog figure moved (contract K8); P1 reads `Derived: 'yes'`; the en + ja copy; contract `.agent/contracts/n9-comparison.md` K1–K11 hold on this tree. |
| K2 | kernel | n13: every compound arm of `decodeTerm` (`src/engine/terms.ts`) admits a `wrapperCompound` alone; real swipl-wasm compounds still decode on every engine path; the three dict variants fail closed with `DecodeError`; the `tests/engine-u2-port.test.ts` fixtures mirror swipl-wasm's `PrologCompound` (its prototype owns `arity`) and keep every assertion, P3.10's reorder included. |
| N1 | gate | `wip/n17-index-control` `f312d8a`: on a queue whose index holds no line, the repeated-line control plants a `med` row in a copy whose index `rewriteIndex` derives as `pnpm queue:index` does, and requires the repetition refused; on a non-empty index the control is unchanged; `pnpm queue:index` writes the same bytes as before the refactor; mutant `n17`; the branch's queue, firing.md and registry records state what its tree does. |
| R1 | records | `.agent/spec.md` (the two new Decisions bullets, Tasks), `.agent/deferred.md` (pruned rows, n17's row, the index), `.claude/rules/` (gate, firing, i18n, ui, proof, kb-build, engine, waves), `.agent/contracts/` (mnt5-inventory, n9-comparison) and every `docs/claims.md` row re-adjudicated since `5a22cf6` state what the tree at `7d72c77` does. |
| R2 | records | The bodies of the eight commits above: each red witness, firing and measurement reproduces by its recorded command on its recorded revision, and no sentence claims beyond what it measured. |
| S1 | security | MAIN: no new path takes untrusted input — n9's `call/1` (which goals reach `derive/5`), n13's decoder on model-written goal results, `mutate.mjs`'s report read, `claims-sweep.mjs`'s and `queue.mjs`'s file reads. |

## Verdicts

`reviewer-20` (reviewer, GPT teammate, non-author), read at `1330e65` + `f312d8a`, each red and gate
replayed on its recorded revision in its own worktrees: 10/10 rows, validator rc 0. M1 C1 C2 C3 C4
K1 K2 N1 R2 pass — a runner-seam probe 11/11 (missing and unreadable reports, a failed control),
every recorded base-red reproduced, the eight landing gates and `f312d8a`'s rc 0, mutants
`inv census`, `m15`, `m14`, `inv proof-comparison`, `n13` and `n17` each 1/1 killed, `pnpm smoke`
rc 0 at `c7b9b7d` and `2e7e8be`. Unconfirmed, recorded as such: the commit bodies' historical gate
walls and 1-min loads. Finding, fixed in the review commit after `1330e65`:

- R1.1 (minor) R108's recorded command `rg -n 'const claimlike\|source: .contract.\|units(artifacts\|lines.indexOf(.---., 1)' tools/claims-sweep.mjs`
  exits 2, `regex parse error … unclosed group` → the literal form `rg -n -F -e 'const claimlike'
  -e "source: 'contract'" -e 'units(artifacts' -e "lines.indexOf('---', 1)"
  tools/claims-sweep.mjs`, rc 0, the four anchors at lines 81, 121, 178 and 223.

S1 (MAIN): pass — the proof RPC's one caller passes `QUESTION_CATALOG[id].goal`
(`src/demo/DemoController.svelte.ts` `#trace`) and the chat path never calls `prove`, so no
model-written goal reaches `derive/5`; `comparison_goal/1` limits `call/1` to
`guideline_satisfies/4|6`, which the read-only guard already admits; n13 narrows the decoder;
`mutate.mjs` reads a JUnit report in its own temp directory; `claims-sweep.mjs` and `queue.mjs` read
repo files.
