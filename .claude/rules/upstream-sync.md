---
paths:
  - "CLAUDE.md"
  - ".claude/rules/**"
  - ".agent/spec.md"
  - ".agent/deferred.md"
---

# Upstream sync

`CLAUDE.md` = the template `~/.local/app/agents/claude/CLAUDE.project.md`, copied whole;
last-sync = agents@8fc2e19. A refresh overwrites the whole file, so anything the repo needs it
to say must survive that overwrite in `.claude/rules/`. Refresh prompt =
`~/.local/app/agents/claude/prompts/refresh.md`.

## Recipe

- `cp ~/.local/app/agents/claude/CLAUDE.project.md CLAUDE.md`; `cmp` of the two → equal.
- last-sync = the upstream commit whose template equals `git show HEAD:CLAUDE.md` — derive it,
  since a recorded value may be stale:
  `git -C ~/.local/app/agents log --format=%h -- claude/CLAUDE.project.md | while read -r c; do git -C ~/.local/app/agents show "$c:claude/CLAUDE.project.md" | cmp -s - <(git show HEAD:CLAUDE.md) && { echo "$c"; break; }; done`.
- Upstream delta = `git -C ~/.local/app/agents diff <last-sync> HEAD -- claude/CLAUDE.project.md`
  plus the commit bodies of `git -C ~/.local/app/agents log <last-sync>..HEAD -- claude/`.
- Read `git diff HEAD -- CLAUDE.md` before committing. **Both directions obligate a
  `.claude/rules/` pass**, and the added-line direction obligates a census too. A REMOVED line
  outside the upstream delta is repo law → fold it into its owning rule file. A removed line
  inside the delta is template law that moved to the global `CLAUDE.md` or `~/.claude/agents/`
  — a project file that restated it now duplicates it, and one that carried an exception to
  it now reads as a contradiction — or law cut as redundant with the current model. **A cut is
  not a reversal**: its practice stands with no rule line restoring it, and nothing here flips
  it to its opposite (the UI/UX + `Report every issue` lines). A practice retires only
  where its upstream commit names a real change (`Retired`). An ADDED line is an obligation the
  tree has never been measured against — a rule file that permits what it now forbids
  contradicts it, the practice it names needs a binding here, and the corpus needs a sweep for
  where it already breaks. Project docs cite the bullet and add bindings only.
- Rule edits move `pnpm claims:check` rows → `pnpm claims:seed`, then adjudicate every row the
  seed leaves `unknown` (`.claude/rules/gate.md`).

## Invariants

- **Line 1 = the `@.agent/spec.md` import.** The template carries it; a refresh from an older
  copy drops it and the attached state disappears silently — no error, no empty file, just a
  session that starts without `Intent`, `Decisions` or `Tasks`. Restore it before any other
  work.
- **`.agent/spec.md` = five sections** — `Intent`, `Artifacts`, `Decisions`, `Tasks`, `Phase`.
  `Tasks` = the phase checklist: `- [ ]` open units in spine order with their acceptance
  checks + binding notes as indented sub-bullets, `- [x] <sha>` once committed, ticked rows
  cleared at phase close; its last line points at `.agent/deferred.md`. A note that rules
  rather than tracks belongs in `Decisions`.
- **`.claude/rules/` is the refresh-safe carrier.** Nothing durable belongs in `CLAUDE.md`
  itself. Bare files (`gate`, `stack`, `waves`) load at session start; `paths:` files — this
  one included — load on first touch of a matching file.
- **Teammates = the roles in `~/.claude/agents/`**, triggered by the global `CLAUDE.md`
  `Subagents` law. A commit body names each teammate the unit used (name, role, verdict). No
  project file pins a model, effort level or agent definition: `.claude/settings.local.json`
  carries the headroom hook + proxy URL alone, and no `.claude/agents/` exists.

## State files

- **`.agent/spec.md` = live law only.** Every line binds current or future work, so a closed
  unit's summary leaves in the commit that closes it — `.agent/archive/` takes it, the unit's
  own contract in `.agent/contracts/` stays the citable record. Size is emergent.
- **`.agent/deferred.md` = the queue.** It grows monotonically, which is why it is unattached:
  a row reaches an agent when `spec.md` `Tasks` points at it or a rule cites it by row. Every
  queue-row citation in `.claude/rules/`, `.agent/contracts/` and `.agent/review.md` names that
  file, never `spec.md`.

## Retired

Named so a later diff reads cleanly and nobody restores them. Archived text, closed contracts,
`.agent/review.md` rows and commit history keep the old names.

- `.agent/roadmap.md`, `.agent/memory.md` and `.claude/commands/session-*` → `.agent/spec.md`
  plus this rules tree. Historical copies are under `.agent/archive/`.
- `.agent/polish.md` = the deferral queue all along, misfiled under `.agent/archive/` by the
  migration → `.agent/deferred.md`, its canonical home. Archived text still says `polish.md`.
- The `≤ 8 KB` cap on `.agent/spec.md` → the liveness rule above. Byte pressure rewarded
  compressing prose over deleting dead rows, which is the entropy the cap was groping at.
- The milestone vocabulary (M1-M5, MODE, WORK-UNIT, PLANNING, MILESTONE-REVIEW) → the four
  phases in `CLAUDE.md` `Session flow`.
- The sizing model (`M = 45 + 2·I`, the 1.77 multiplier, the 223K one-window aim) →
  retired by user ruling. A phase session runs across compactions, so per-unit window fitting
  no longer binds MAIN; teammates size by the global `CLAUDE.md` `Teammate size` rule.
  Derivation stays in `.agent/archive/roadmap.md`.
- `/goal` as the phase-session vehicle → a plain session per pasted phase body, run until the
  body's `Met when` holds (`CLAUDE.md` `Session flow`); the global `agent-flow` PreCompact hook
  carries that condition across compaction.
- The spec's `Deferred` section → `Tasks`.
- Dispatch-role abbreviations, solo licences, the per-unit dispatch line and the `dispatch:`
  commit trailer → the global `Subagents` roles and the template's commit-body teammate line.
- `.serena/` → deleted. Code intelligence is the built-in `LSP` tool.
