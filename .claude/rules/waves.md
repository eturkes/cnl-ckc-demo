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
  Seed it with `cp -a --reflink=auto kb/generated <wt>/kb/generated` — 345 files, 22 MB,
  no disk cost on btrfs. The copy is a snapshot: a worktree whose suite depends on freshly
  built KB bytes gets re-seeded after MAIN's `kb:build`, and `node_modules` stays a symlink
  because dependency ids resolve through pnpm rather than through the fs allow-list.
- Surviving teammate tips stay in **branch** form (`wt/<name>`): every committed citation —
  contracts, ledgers, reviewer reports, `.agent/deferred.md` rows — names the branch. A Close-order
  branch sweep covers its own wave's roster alone; renaming a cited branch invalidates the
  record it was preserving.
- Surviving evidence branches, cited by the ledger, contracts, commit bodies and queue rows —
  never rename one: `wt/rev-arch` `1e89286` (A8), `wt/rev-graph` `ace618a` (G3),
  `wt/rev-assurance` `5c97965` (C2); u16 red suites `wt/tester-1` `4da48b3`, `wt/tester-2`
  `b9278ac`, `wt/tester-3` `7ab6142`; u16 review witnesses `wt/reviewer-3` `40fd9d6`,
  `wt/reviewer-4` `897a0a6`, `wt/reviewer-5` `abf51f8`, `wt/reviewer-6` `24acbd0`,
  `wt/reviewer-8` `cbb14b0`, `wt/reviewer-9` `3e21deb`; `wip/u16-review`, the per-sub-unit
  review snapshots the u16 commit bodies cite. Chat request: red suites
  `worktree-agent-a890c938619fd3157` `8026d4e` (c1), `wt/chat-tester-2` `06483be` (c3),
  `wt/chat-tester-3` `fd876eb` (c2), `wt/chat-tester-4` `4bd88bc` (c4); gated snapshots
  `wip/chat-c1`…`wip/chat-c4`.
- Research probe branches held as evidence, worktrees removed: `wt/res-m1-1` `36cc56f`
  (swipl-wasm load/worker/terms/trace/perf/test/errors/deploy), `wt/res-m1-2` `5863141`
  (cytoscape layout/perf/test, axe, contrast, combobox), `wt/res-m2-2` `0a48b79` (every
  meta-interpreter, cap-completeness, oracle, clause-identity and budget probe),
  `wt/res-m2-3` `24d027e` (asset-shape, PDF-viewer, ladder-UI), `wt/res-nl-intake` `ae608ff`
  (free-text intake: vocabulary gap, BM25 recall, graph-vs-clause parity, ad-hoc goal
  fail-closed, concept grounding, topic routing — findings `.agent/archive/nl-intake.md`),
  `wt/res-u16-shape` `490dfcf` (u16 shape: skolem-normalized premise census, `clinical_rule/3`
  condition and modifier census — findings `.agent/archive/nl-intake.md` `O4 remeasured`).
- A probe branch also carries probe code `main` cannot hold. `wt/res-nl-intake`'s four `.mjs`
  probes fail `pnpm lint` under the typescript-eslint project service, which resolves every
  linted file through `tsconfig.json`; adding `.agent/` to the ESLint ignore list would be a
  grader change, and global `CLAUDE.md` `Engineering` reserves those for their own approved unit.

## Units + teammates

- **A check ships with its red witness in the unit's acceptance row, cited from the commit
  body.** The form is already in the tree: `19/20 RED at base `22053ef``, `5/9 RED at base
  `e71486e``, each beside the command that reproduces it — `git show <sha>:<producer> >
  <producer> && pnpm kb:build && npx vitest run <suite>`
  (`.agent/archive/contracts/m5u1.md:232`, `m5u2.md:216`). A base-GREEN case is declared in
  that same row with its reason, never manufactured, and stays uncredited until `pnpm stryker`
  (`tools/mutation/`, one suite per run) shows its suite killing default-operator mutants in the
  files it imports — the credit global `Engineering` names; `pnpm mutate`'s hand-written mutants
  are firing records, never that credit. Two shapes satisfy the revision half
  without a `git show`: a witness that stays inside the run, where the run IS the revision
  (`engine:check` under `ENGINE_CHECK_CONTROL`), and a differential that names its own arms
  (`pnpm binding:replay HEAD`). The residue this closes is a hand run written down with no
  revision and no command, which nobody can read back. The contract is the citable record;
  `.scratch/` is gitignored.
- **A path outside the teammate's own tree must be ABSOLUTE in the brief** — reports, roster
  and every other `.scratch/` target. Global names files repo-relative, which resolves inside
  the worktree, while `.scratch/` sits in the primary tree; MAIN's own cwd also persists
  across Bash calls, so the relative form resolves against whichever tree the shell last
  entered and the write silently fails.
- Lagging teammate → send a **cost** directive at the FIRST flat poll, never a bare flush
  directive, which moves nobody: each finding = its verdict + one anchor, ship no detail
  sections, run one measurement pass per row, flush after every row. The brief's batch size is
  what it corrects.
- **A seeded progress counter must not contain the token it counts**: a header line quoting the
  counter's own pattern keeps it from ever reaching 0. Seed a row-anchored pattern —
  `^| R[0-9]* |.*| unknown |$` — and keep the bare token out of prose.
- **An agent that reads for a whole window and writes nothing is replaced, not steered**: the
  stall is the agent's, not the task's. The successor's brief opens by naming the predecessor's
  failure and demanding an `Edit` as its FIRST tool call. A successor that goes flat holding a
  complete mapping in its transcript moves on a directive naming a batch size: flush ≤20 rows per
  `Edit`, never one final write.
- **`cat >>` on a file already in MAIN's context re-echoes the WHOLE file back into
  context.** Append with the `Edit` tool anchored on the file's last line instead; it echoes
  nothing.

## Report grading

`node tools/validate-report.mjs <report.md> [--units N] [--verdict]` grades wave reports. Rows
are `| id | finding | evidence |`, and `--verdict` folds the verdict into the finding cell. A
reviewer brief carries ONE vocabulary: the cell opens `pass:` or `fail(low|med|high):`. The
grader also admits the `reviewer` role's own form — `pass`, or `finding <ids> (blocker|major|minor)`
— read as blocker = high, major = med, minor = low, so a reviewer following its role grades
clean. The `evidence` cell is where the global
evidence bar lands — a red test, or the disputed bytes in `/usr/bin/rg -Fn` form plus
`file:line` — so harvest rematches a row without opening its detail section. Grading needs a
sibling `<stem>.ids`. A seeded all-`unknown` skeleton exits 1 — that is what makes it a
deliverable-first counter. The Units table admits `-` in the `flags` and `depends` columns
only; every other column rejects it. A `\|` inside a cell is content, never a delimiter. No cell
carries a length floor (user ruling, global `CLAUDE.md` `Authoring`): a placeholder, a missing
verdict or an evidence cell without a pointer is what fails.

`.agent/review.md` is hand-maintained after its first shape; the committed ledger is the
source, and a generator is re-derived only for a bulk reshape.
