---
paths:
  - "CLAUDE.md"
  - ".claude/rules/**"
  - ".agent/spec.md"
  - ".agent/deferred.md"
---

# Upstream sync

`CLAUDE.md` is a template copied in from `~/agents/claude/CLAUDE.project.md`. A refresh
overwrites the whole file, so anything the repo needs it to say must survive that overwrite
explicitly. `cmp ~/agents/claude/CLAUDE.project.md CLAUDE.md` proves the copy landed whole,
and `git -C ~/agents log -- claude/CLAUDE.project.md` says what each refresh moved and why.

- **The `@.agent/spec.md` import on line 1 is repo-owned.** The template does carry it, but a
  refresh from an older copy drops it and the attached state disappears silently — no error,
  no empty file, just a session that starts without `Intent`, `Decisions` or `Deferred`.
  Restore it before any other work.
- **`.claude/rules/` is the refresh-safe carrier.** Nothing durable belongs in `CLAUDE.md`
  itself. Bare files (`gate`, `stack`, `waves`) load at session start; `paths:` files —
  this one included — load on first touch of a matching file.
- After a refresh, read `git diff HEAD -- CLAUDE.md` before committing. **Both directions
  obligate a `.claude/rules/` pass**, and the added-line direction obligates a census too.
  A REMOVED line is repo law that needs a rule file, or template law that moved to the global
  `CLAUDE.md`: a project file that restated the moved text now duplicates it, and one that
  carried an exception to it now reads as a contradiction. An ADDED line is an obligation the
  tree has never been measured against — a rule file that permits what it now forbids
  contradicts it, the practice it names needs a binding here, and the corpus needs a sweep for
  where it already breaks. Project docs cite the bullet and add bindings only.

## State files

- **`.agent/spec.md` = live law only.** Every line binds current or future work, so a closed
  unit's summary leaves in the commit that closes it — `.agent/archive/` takes it, the unit's
  own contract in `.agent/contracts/` stays the citable record. Size is emergent.
- **`.agent/deferred.md` = the queue.** It grows monotonically, which is why it is unattached:
  a row reaches an agent when `spec.md` `Deferred` points at it or a rule cites it by row.
  Every `Deferred`-row citation in `.claude/rules/`, `.agent/contracts/` and `.agent/review.md`
  names that file, never `spec.md`.

## Retired

Named so a later diff reads cleanly and nobody restores them:

- `.agent/roadmap.md`, `.agent/memory.md` and `.claude/commands/session-*` → `.agent/spec.md`
  plus this rules tree. Historical copies are under `.agent/archive/`.
- `.agent/polish.md` = the deferral queue all along, misfiled under `.agent/archive/` by the
  migration → `.agent/deferred.md`, its canonical home. Archived text still says `polish.md`.
- The `≤ 8 KB` cap on `.agent/spec.md` → the liveness rule above. Byte pressure rewarded
  compressing prose over deleting dead rows, which is the entropy the cap was groping at.
- The milestone vocabulary (M1-M5, MODE, WORK-UNIT, PLANNING, MILESTONE-REVIEW) → the four
  phases in `CLAUDE.md` `Session flow`. Archived text still uses it.
- The sizing model (`M = 45 + 2·I`, the 1.77 multiplier, the 223K one-window aim) →
  retired by user ruling. A `/goal` phase runs across compactions, so per-unit window fitting
  no longer binds MAIN; teammates size by the global `CLAUDE.md` ≤~190K rule and a wave
  re-measures if it overruns. Derivation stays in `.agent/archive/roadmap.md`.
- `.serena/` → deleted. Code intelligence is the built-in `LSP` tool.
