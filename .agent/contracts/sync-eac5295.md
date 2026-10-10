# Template refresh agents@4d22203 → agents@eac5295 — review check set

Fixed before dispatch. Target = the refresh diff, `git diff HEAD` over `5a8435d` in the primary
tree, this file included. Upstream = `~/.local/app/agents`, range `4d22203..eac5295`, read-only.
One `reviewer` per lens (MAINTAIN, `CLAUDE.md` `Session flow` Teammates). Findings bind to these
rows; anything outside them is a register entry. Security lens: none — the diff touches
instruction text, state files and the claim registry, and no code.

| id | lens | check |
|---|---|---|
| O1 | obligations | Every clause `git -C ~/.local/app/agents diff 4d22203 eac5295 -- claude/CLAUDE.project.md` adds or changes, and every migration the bodies of `git -C ~/.local/app/agents log 4d22203..eac5295 -- claude/` name, is met by this repo's practice or carried by a named `.claude/rules/` ruling. Every live-law statement of a changed or retired form follows the change: `.claude/rules/`, `.agent/spec.md`, `.agent/deferred.md`, `docs/`, `tools/`, `tests/`, `README.md`. History stays unedited: `.agent/archive/`, the closed `.agent/contracts/`, `.agent/review.md`. |
| O2 | obligations | `.claude/rules/upstream-sync.md`: `last-sync = agents@eac5295` names the upstream HEAD; each Invariant holds under the current template and global `CLAUDE.md`; the Recipe's step numbers match `~/.local/app/agents/claude/prompts/{auto,steered}/refresh.md`; each Retired entry names its current replacement, and none restores a retired practice or turns a cut into its opposite; the Rulings index lists every ruling this repo makes on a template clause. |
| O3 | obligations | The `Probe set` line in `.agent/spec.md` `Decisions` and the last Retired entry carry the user's ruling and claim nothing beyond it. The ruling: "Role-neutral — keep the substance and drop the role name: An independent teammate, blind to the selector, authors … from the KB alone, frozen and committed before the first live run." |
| S1 | state | `.agent/spec.md`: `Intent`, `Artifacts`, `Tasks` and `Phase` are byte-identical to `HEAD`; `Decisions` differs by the `Probe set` line alone; every `Tasks` unit id at `HEAD` is present after. |
| S2 | state | `.agent/deferred.md`: every row at `HEAD` is unchanged; each added row follows `.claude/rules/state.md` (bold title + defect, an `Accept:` check that fails on today's tree and passes on the fix, `pri`); `## Index` stays current. |
| C1 | checks | `docs/claims.md`: in rows R261, R273 and R274, each `command` re-derives its claim from committed state and returns its stated value on the working tree; R273's command fails on the pre-refresh form, since its previous command returns 0 against the refreshed `CLAUDE.md`. Every other changed row moves its anchor alone, with its digest unchanged, and the row count stays 486. |
| C2 | checks | No gate step, test, validator, declared grader table or firing control changes: `git diff --stat HEAD -- tools tests src package.json eslint.config.js .github` is empty. `pnpm claims:check` and `pnpm spec:check` fire every control on the edited tree with the refusal each one fired at `HEAD`. |
