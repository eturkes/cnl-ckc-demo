# Template refresh agents@eac5295 → agents@8bc2c15 — review check set

Fixed before dispatch. Target = the refresh diff, `git diff e9ffcb7` in the primary tree plus the
untracked `.agent/archive/maintain.md`, `.agent/spec-lint`, `.claude/rules/firing.md`,
`tools/spec-lint.mjs` and this file. Upstream = `~/.local/app/agents`, range `eac5295..8bc2c15`,
read-only: `git -C ~/.local/app/agents diff eac5295 8bc2c15 -- claude/CLAUDE.project.md` + the
bodies of `git -C ~/.local/app/agents log eac5295..8bc2c15 -- claude/`. User rulings this
refresh: `copy:check`'s sentence caps retire and C6 is deleted with them; `No prototype tree`
covers the M2–M4 surfaces alone. One `reviewer` covering every lens (`CLAUDE.md` `Session flow`
Teammates). Findings bind to these rows; anything outside them is a register entry. Security
lens: none — the diff touches gate tooling, tests, rules, state files and the claim registry,
and no shipped or remotely reachable code.

| id | lens | check |
|---|---|---|
| R1 | obligations | every clause the delta adds or changes, and every migration its bodies name, is met by the tree or carried by a row of `.claude/rules/upstream-sync.md` `Rulings index` |
| R2 | spec preservation | every pre-refresh `.agent/spec.md` `Tasks` row, unit id and SHA, and every `Intent`, `Artifacts`, `Decisions` and `Phase` line, is present in the new spec, `.agent/archive/maintain.md` or `.claude/rules/waves.md`, changed only by the layout and the edits the refresh names |
| R3 | check strength | `spec:check`, `claims:check`, `copy:check`, `tests/inventory.test.ts`, the edited mutants and the new `spec:lint` each refuse every input they refused at `e9ffcb7`, except the ruled caps, whose original firing is recorded |
| R4 | records | `.claude/rules/firing.md` rows, `.agent/contracts/mnt5-inventory.md` anchors, `upstream-sync.md` `Retired` + index and the 27 re-adjudicated `docs/claims.md` rows state what the tree does |
| R5 | queue rows | each `.agent/deferred.md` row the refresh adds names a real gap and carries an acceptance check, a `pri` and, where it needs the user, that need |
| R6 | old forms | no live law (`.claude/rules/`, `.agent/spec.md`, `.agent/deferred.md`, docs, tools, tests) states a form the delta retired, outside a retirement record |
| R7 | scope | no shipped product behaviour or human-facing string changes; every off-scope finding is a queue row |

Amendment for the re-review round: the user ruled after this set was fixed that
`tools/validate-report.mjs`'s length floors (finding 40, evidence 8, unit acceptance 20
characters) retire, so R3 covers that grader too, the floors a ruled exception like the caps.
