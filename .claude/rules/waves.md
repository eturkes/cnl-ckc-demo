# Wave bindings

Project bindings on the global `CLAUDE.md` `Subagents` protocol. Mechanics live there; these
are this repo's deltas.

## Artifacts

- `.agent/contracts/` = committed. Anything a later unit dispatches from lands there —
  acceptance contracts, fixed check sets, verdict tables. The M1 + M5u1/u2 contracts and every
  historical review live under `.agent/archive/`.
- `.scratch/` = gitignored, working state alone. The Close order captures worktree content,
  not `.scratch/`, so a durable artifact must be committed to survive.
- Reports go to `.scratch/agents/<name>.md`; the roster is `.scratch/agents/roster.md`.

## Worktrees

- A wave that writes code takes one worktree per teammate at `.scratch/worktrees/<name>`. An
  analysis-only wave takes none and reports into `.scratch/agents/`.
- Toolchain env = symlink the primary `node_modules` into the worktree. `.gitignore`
  therefore spells `node_modules` and `kb/generated` **without a trailing slash** — the slash
  form matches directories only and leaves the symlink untracked.
- **`kb/generated` must be a real directory in the worktree, never a symlink.** Vite resolves
  a symlinked id to its real path and then refuses it for sitting outside the worktree root:
  every suite pulling a generated asset into the import graph fails to COLLECT with
  `Denied ID …/kb/generated/…json?url&no-inline`, which reads like a broken test rather than a
  broken harness. `NODE_OPTIONS=--preserve-symlinks` trades it for a pnpm resolution failure.
  Seed it with `cp -a --reflink=auto kb/generated <wt>/kb/generated` — 344 files, 22 MB,
  no disk cost on btrfs. The copy is a snapshot: a worktree whose suite depends on freshly
  built KB bytes gets re-seeded after MAIN's `kb:build`, and `node_modules` stays a symlink
  because dependency ids resolve through pnpm rather than through the fs allow-list.
- Surviving teammate tips stay in **branch** form (`wt/<name>`): every committed citation —
  contracts, ledgers, reviewer reports, `Deferred` rows — names the branch. A Close-order
  branch sweep covers its own wave's roster alone; renaming a cited branch invalidates the
  record it was preserving.
- Research probe branches held as evidence, worktrees removed: `wt/res-m1-1` `36cc56f`
  (swipl-wasm load/worker/terms/trace/perf/test/errors/deploy), `wt/res-m1-2` `5863141`
  (cytoscape layout/perf/test, axe, contrast, combobox), `wt/res-m2-2` `0a48b79` (every
  meta-interpreter, cap-completeness, oracle, clause-identity and budget probe),
  `wt/res-m2-3` `24d027e` (asset-shape, PDF-viewer, ladder-UI), `wt/res-nl-intake` `ae608ff`
  (free-text intake: vocabulary gap, BM25 recall, graph-vs-clause parity, ad-hoc goal
  fail-closed, concept grounding, topic routing — findings `.agent/archive/nl-intake.md`).
- A probe branch also carries probe code `main` cannot hold. `wt/res-nl-intake`'s four `.mjs`
  probes fail `pnpm lint` under the typescript-eslint project service, which resolves every
  linted file through `tsconfig.json`; adding `.agent/` to the ESLint ignore list would be a
  grader change, and `CLAUDE.md` `Engineering` reserves those for their own approved unit.

## Dispatch

- **Every commit carries a `dispatch:` trailer in its body**, not units alone — roles + scope
  (`dispatch: map-controls — firing-input census; MAIN authors the controls`), or
  `dispatch: solo — <licence>` naming one of the six closed licences. It is the only durable
  record of who did the work: `.scratch/agents/` is gitignored and a `wt/<name>` branch
  outlives the roster that named it, so `git log --grep='^dispatch:'` is the census surface.
  Trailers start at `2592828`; every commit from there on carries one.
- **A check ships with its red witness in the unit's acceptance row, cited from the commit
  body.** The form is already in the tree: `19/20 RED at base `22053ef``, `5/9 RED at base
  `e71486e``, each beside the command that reproduces it — `git show <sha>:<producer> >
  <producer> && pnpm kb:build && npx vitest run <suite>`
  (`.agent/archive/contracts/m5u1.md:232`, `m5u2.md:216`). A base-GREEN case is declared in
  that same row with its reason, never manufactured. Two shapes satisfy the revision half
  without a `git show`: a witness that stays inside the run, where the run IS the revision
  (`engine:check` under `ENGINE_CHECK_CONTROL`), and a differential that names its own arms
  (`pnpm binding:replay HEAD`). The residue this closes is the hand run written down —
  `8280034`'s `C7 8 times by hand, reverted` names no revision and no command, so nobody can
  read it back. The contract is the citable record; `.scratch/` is gitignored.
- **A path outside the teammate's own tree must be ABSOLUTE in the brief** — reports, roster
  and every other `.scratch/` target. Global names files repo-relative, which resolves inside
  the worktree, while `.scratch/` sits in the primary tree; MAIN's own cwd also persists
  across Bash calls, so the relative form resolves against whichever tree the shell last
  entered and the write silently fails.
- Lagging teammate → send a **cost** directive at the FIRST flat poll, not a flush directive:
  cap each finding at ~250 chars, ship no detail sections, run one measurement pass per row,
  flush after every row. A bare "flush now" moved nobody; the cost directive carried every
  lagging teammate to complete inside one poll. The brief's batch size is what it corrects.
- **A seeded progress counter must not contain the token it counts.** u15 seeded each
  partition with a header line quoting its own `grep -c 'unknown'` command, so the counter
  could never reach 0 and every poll under-reported the wave. Seed a row-anchored pattern
  instead — `^| R[0-9]* |.*| unknown |$` — and keep the bare token out of prose.
- **An agent that reads for a whole window and writes nothing is replaced, not steered.** u15's
  first `map-rules` burned 153K across five flat polls with zero rows written, its last message
  still its opening statement of intent; a same-shape peer finished 158 rows in that window, so
  the task was never the problem. The successor's brief opens by naming the predecessor's
  failure and demanding an `Edit` as its FIRST tool call — it filled all 171 rows. When a
  successor then goes flat holding a complete mapping in its transcript, the directive that
  moves it names a batch size: flush ≤20 rows per `Edit`, never one final write.
- **`cat >>` on a file already in MAIN's context re-echoes the WHOLE file back into
  context.** Append with the `Edit` tool anchored on the file's last line instead; it echoes
  nothing.

## Report grading

`.scratch/validate-report.py` grades wave reports: `--units N`, `--verdict`. Rows are
`| id | finding | evidence |`, and `--verdict` folds the verdict into the finding cell, which
must open `pass:` or `fail(low|med|high):`. The `evidence` cell is where the global evidence
bar lands — a red test, or the disputed bytes in `/usr/bin/rg -Fn` form plus `file:line` — so
harvest rematches a row without opening its detail section. Grading needs a sibling
`<stem>.ids`. A seeded
all-`unknown` skeleton exits 1 — that is what makes it a deliverable-first counter. The Units
table admits `-` in the `flags` and `depends` columns only; every other column rejects it.
Scratch-local encoding → port scheduled as a `.agent/deferred.md` row.

`.agent/review.md` is hand-maintained after its first shape; the committed ledger is the
source, and a generator is re-derived only for a bulk reshape.
