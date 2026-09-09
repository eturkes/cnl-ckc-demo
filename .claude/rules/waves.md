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

- One worktree per teammate at `.scratch/worktrees/<name>`; MAIN alone writes the primary
  tree.
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

- **The unit's dispatch line rides its commit body as a `dispatch:` trailer** — roles + scope
  (`dispatch: map-controls — firing-input census; MAIN authors the controls`) or
  `dispatch: solo — <reason>`. It is the only durable record of who did the work:
  `.scratch/agents/` is gitignored and a `wt/<name>` branch outlives the roster that named it,
  so `git log --grep='^dispatch:'` is the census surface.
- **Brief paths must be ABSOLUTE.** A teammate's cwd is its worktree and MAIN's own cwd
  persists across Bash calls, so a relative `.scratch/agents/…` resolves inside whichever
  tree the shell last entered and the write silently fails.
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
must open `pass:` or `fail(low|med|high):`. Grading needs a sibling `<stem>.ids`. A seeded
all-`unknown` skeleton exits 1 — that is what makes it a deliverable-first counter. The Units
table admits `-` in the `flags` and `depends` columns only; every other column rejects it.
Scratch-local encoding → port scheduled as a `.agent/spec.md` `Deferred` row.

`.agent/review.md` is hand-maintained after its first shape; the committed ledger is the
source, and a generator is re-derived only for a bulk reshape.
