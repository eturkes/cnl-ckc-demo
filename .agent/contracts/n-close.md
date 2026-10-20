# n Close — deferral-queue run, closing review check set

Fixed before dispatch. Target = the shipped surface `git diff 94117ee..69d4bea` touched, read at
`69d4bea` (`.agent/spec.md` Decisions: judgment review reads the shipped surface). Landed units:
n6 `6325451`, n7 `b8dbff8`, n14 `83cd690`, n15 `64d5e81`, find `77292ff` (vite), n1 `b0ee8d8`,
n2 `74282a4`, plus records (`25f1c9c`, `8076cb7`, `69d4bea`). Producer = `../cnl-ckc` at
`83569b1d`, read-only. One `reviewer` covers every lens (MAINTAIN); MAIN holds S1. Findings bind
to these rows; anything outside them is a register entry. The approval-pending `wip/n*` branches
are out of scope: nothing of theirs ships.

| id | lens | check |
|---|---|---|
| A1 | gate | `tools/palette-check.mjs` computes coloraide 8.13.1's method — Machado severity-1.0 matrices in linear sRGB, unclipped; OKLab via coloraide's matrices; Euclidean ΔE×100 — floors 15 plain and 8 protan + deutan, floored to 0.01; `FILLS` is exactly the five node-kind tokens `src/graph/canvas.ts` paints by kind; each of its three controls fires for its stated reason and no other; `tools/contrast.mjs`'s refactor grades exactly what it graded before. |
| A2 | product | The shipped fills pass `palette:check`, `contrast:check` and `graph:check`'s `palette` rule in both themes; each kind keeps one hue across themes; no surface outside the graph (canvas + legend) reads the five tokens, so no accepted surface changed. |
| B1 | lane | `tools/binding-replay.mjs`: each arm imports bag, paths, clinical and produce from its own tree and verifies that tree's own bag; both `CITED` patterns extract the FIRST cited clause line of their helper generation; the victim-uniqueness and verdict logic hold; `pnpm binding:replay` rc 0 (a944fca red 12 → 12, working green 12 → 11) and `pnpm binding:replay HEAD` rc 1 reproduce; gate.md's lane text says what the code does. |
| C1 | gate | The six lane cases n6 added (`tests/legacy-export-lane.test.ts`) assert observable behaviour, never a fixture value the m5u6 contract does not own; each kills the mutants `.agent/contracts/mnt5-stryker.md` credits it with; the record's survivor table equals the n6 Stryker run and carries reviewer-18's rulings verbatim; R439 + R441 read true. |
| D1 | gate | n14's `firstDifference` is exact byte equality (length and content) over the same five artifact pairs `toEqual` compared, so no check weakened; the planted one-byte flip fires; the timings in `83cd690`'s body are what the runs printed. |
| E1 | tooling | `tools/kb/regenerate-bag.sh` writes nothing into the checkout it is given, builds at `<rev>`, exits 0 only on the stated byte comparisons; a rerun at `8a51bf0c` rebuilds `kb/`'s bag byte for byte; kb-build.md describes the script. |
| F1 | records | `.agent/spec.md` (Decisions, Tasks), `.agent/deferred.md`, `.claude/rules/` (gate, firing, ui, graph, kb-build, waves), `.agent/contracts/mnt5-inventory.md` and every re-adjudicated `docs/claims.md` row state what the tree at `69d4bea` does; each queued row cites a branch that holds what it says. |
| F2 | records | The bodies of the landed commits above: each measurement, red witness and quoted firing reproduces by its recorded command, and no sentence claims beyond what it measured. |
| S1 | security | MAIN: no new path takes untrusted input — the vite upgrade, `regenerate-bag.sh`'s arguments, `binding-replay.mjs`'s ref, `palette-check.mjs`'s CSS read. |
