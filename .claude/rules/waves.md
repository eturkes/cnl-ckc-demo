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
- Surviving teammate tips stay in **branch** form (`wt/<name>`): every committed citation —
  contracts, ledgers, reviewer reports, `Deferred` rows — names the branch. A Close-order
  branch sweep covers its own wave's roster alone; renaming a cited branch invalidates the
  record it was preserving.
- Research probe branches held as evidence, worktrees removed: `wt/res-m1-1` `36cc56f`
  (swipl-wasm load/worker/terms/trace/perf/test/errors/deploy), `wt/res-m1-2` `5863141`
  (cytoscape layout/perf/test, axe, contrast, combobox), `wt/res-m2-2` `0a48b79` (every
  meta-interpreter, cap-completeness, oracle, clause-identity and budget probe),
  `wt/res-m2-3` `24d027e` (asset-shape, PDF-viewer, ladder-UI).

## Dispatch

- **Every commit carries a `dispatch:` trailer in its body**, not units alone — roles + scope
  (`dispatch: map-controls — firing-input census; MAIN authors the controls`), or
  `dispatch: solo — <licence>` naming one of the six closed licences. It is the only durable
  record of who did the work: `.scratch/agents/` is gitignored and a `wt/<name>` branch
  outlives the roster that named it, so `git log --grep='^dispatch:'` is the census surface.
  Trailers start at `2592828`; every commit from there on carries one.
- **A path outside the teammate's own tree must be ABSOLUTE in the brief** — reports, roster
  and every other `.scratch/` target. Global names files repo-relative, which resolves inside
  the worktree, while `.scratch/` sits in the primary tree; MAIN's own cwd also persists
  across Bash calls, so the relative form resolves against whichever tree the shell last
  entered and the write silently fails.
- Lagging teammate → send a **cost** directive at the FIRST flat poll, not a flush directive:
  cap each finding at ~250 chars, ship no detail sections, run one measurement pass per row,
  flush after every row. A bare "flush now" moved nobody; the cost directive carried every
  lagging teammate to complete inside one poll. The brief's batch size is what it corrects.
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
