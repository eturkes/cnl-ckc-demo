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

## Verdicts

`reviewer-19` (reviewer, GPT teammate, non-author), read at `f610bd3`: 8/8 rows, validator rc 0.
A1 A2 B1 D1 pass — its own coloraide differential 2,056 pairs × 3, max error 9.95e-14; the palette
suite 4/4; `binding:replay` rc 0 and its `HEAD` control rc 1; the five comparisons exact. Findings,
each fixed in the review commit after `f610bd3`:

- E1.1 (major) `tools/kb/regenerate-bag.sh` removed `.scratch/ckc/src` before cloning even when that
  clone was the checkout passed in (its `rm`-intercepting probe: `ASSERTION FAILED: regenerate-bag
  removes its input checkout`, rc 1) → physical paths, and a checkout inside the scratch tree or
  holding it is refused before any removal (the same probe: rc 2 for the clone, the scratch root and
  an ancestor; PASS for `../cnl-ckc`); the ordinary run at `8a51bf0c` still rebuilds `kb/`'s bag
  byte for byte. kb-build.md states the refusal (F1's read-only clause).
- C1.1 / F1.1 (minor) registry ids re-issue on every seed, so the Stryker record's `R439 + R441`, the
  n7 Tasks row's `R129` and the frontmatter queue row's `R073` named other claims → each cites its
  source unit instead (the registry rows for `m5u6.md` D1/D3, graph.md `Renderer seam`, the
  frontmatter glob). Row C1 above keeps its original wording: those were the pre-seed ids of m5u6 D1
  and D3.
- F1.2 (minor) R289's `git rev-parse --short=7 <nine refs>` exits 128 → `git for-each-ref` over
  `refs/heads/wip/n*`.
- F2.1 (minor) `83cd690`'s body calls vitest's `tests` figure "Suite CPU"; it is the summed elapsed
  duration of the test files (230.23 s → 182.67 s), not CPU time. The numbers stand.

Unconfirmed by the reviewer, recorded as such: the load readings and the toEqual / Buffer.compare
microbench in `83cd690`'s body (printed to MAIN's tool output, not saved).

S1 (MAIN): pass — the vite upgrade is a dev tool clearing three advisories; `regenerate-bag.sh` quotes
every argument and resolves `<rev>` to a SHA before checkout; `binding-replay.mjs` interpolates its
`ref` argument into `sh -c` as it did before n2 (a local CLI argument: register only); `palette-check.mjs`
reads `src/app.css` alone.
