# n20–n28 close — queue run, closing review check set

Fixed before dispatch. Target = the shipped surface `git diff 7b68934..<tip>` touched, read at the
tip the dispatch names (`.agent/spec.md` Decisions: judgment review reads the shipped surface).
Units: n20 `59c73d6` (draft `wip/n20-queued-cancel` `adaee3b`, approved), n21 `bcd7322` + close
`7bdf8eb`, n22 `054659a` + close `601c367`, n23 `1911f18`, n24 `29cf85c`, n25 `a81ddbd`, n26
`ba2aebf` + close `ca9c009`, n27 `e0171c6` + close `4ceb650`, n28 `3fe19ce`; records `463e882`,
`7f6576e`.
One `reviewer` covers every lens (MAINTAIN); MAIN holds S1. Findings bind to these rows; anything
outside them is a register entry.

| id | lens | check |
|---|---|---|
| T1 | test | n20 `tests/solution-streaming.test.ts` queued-cancel case: the cancel is queued as the goal's step 2 begins (only the metered goal's iterator is wrapped, only its second `next()`), no wall-clock timer orders it, the spy is restored after the case, every original assertion stays; the case is red on a session that yields and honours a cancel between a step and streaming its answer, and on one that never yields between steps; the `Decisions` bullet states the edit. |
| C1 | ci | n21 + n22: `ci.yml` checks out full history and `security.yml` runs `kb:build` before `lint`; the run ids the commit bodies cite show what the bodies claim (`gh run view`); `gate.md` `## CI` states both workflows as they are. |
| C2 | ci | n26: `.github/workflows/fanout.yml`, `tools/gate.mjs --plan`, `tools/ci-gate.mjs`: every `gate:chain` step is one job and no step is dropped or duplicated; the `kb:build` prerequisite follows from chain order; `matrix.step` reaches the shell through `env` alone; `ci:gate` watches the run of THIS push (branch, full SHA, `push` event, workflow name), refuses a bad unit name and a dirty tree, fails closed when no run appears, when `gh` errors and when a run is cancelled or skipped, names every non-success job on red and keeps the branch, deletes it on green; `gate.md` `## CI`'s in-force statement matches the code. |
| G1 | gate | n24 `tools/shell-check.mjs`: the archive digest is checked before anything is cached; an interrupted fetch leaves no cached binary; the ustar walk extracts the `*/shellcheck` member byte-exact; discovery (`git ls-files`, `.sh` or a POSIX-family shebang) neither misses a tracked shell script nor admits a non-shell file; both controls fire and their refusals name what they claim; the inventory, `firing.md`, `gate.md` and `toolchain.md` rows state what the code does. |
| P1 | perf | n25 `src/graph/model.ts`: `answerSubgraph` and `#primaryAnswerConcept` return what they returned at `7b68934` for every input — the scorer arithmetic, the per-node label cache, the precomputed ranks and scores, a duplicated adjacency entry; the commit body's A/B and its 3,080-view differential reproduce. |
| D1 | deps | n27: the Node 26 pin is consistent across `package.json` `devEngines.runtime` + `engines`, the lockfile, `renovate.json`, CI's `node-version-file`, README, `toolchain.md` and `Decisions`; the `dom` project's `--no-experimental-webstorage` reason is true (reproduce it) and the flag reaches no other project; the recorded `release:check` result holds. |
| R1 | records | `.agent/spec.md` (Tasks, the n20 and Node 26 `Decisions` bullets), `.agent/deferred.md` (pruned rows, the KB-release row, the index), `.claude/rules/` (gate, firing, toolchain, waves), `.agent/contracts/mnt5-inventory.md`, README and every `docs/claims.md` row re-adjudicated since `7b68934` state what the tree at the tip does. |
| R2 | records | The commit bodies of the units above: each red witness, firing and measurement reproduces by its recorded command on its recorded revision, and no sentence claims beyond what it measured. |
| S1 | security | MAIN: what each new path admits — `shell-check.mjs`'s fetched binary, `ci-gate.mjs`'s unit argument in a git ref and `gh` arguments, `fanout.yml`'s matrix values in a shell step. |
