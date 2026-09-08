---
paths:
  - "CLAUDE.md"
  - ".claude/rules/**"
  - ".agent/spec.md"
---

# Upstream sync

`CLAUDE.md` is a template copied in from outside the repo. A refresh overwrites the whole
file, so anything the repo needs it to say must survive that overwrite explicitly.

- **The `@.agent/spec.md` import on line 1 is repo-owned.** The template does carry it, but a
  refresh from an older copy drops it and the attached state disappears silently — no error,
  no empty file, just a session that starts without `Intent`, `Decisions` or `Deferred`.
  Restore it before any other work.
- **`.claude/rules/` is the refresh-safe carrier.** Nothing durable belongs in `CLAUDE.md`
  itself. Bare files (`gate`, `stack`, `waves`, `upstream-sync`) load at session start;
  `paths:` files load on first touch of a matching file.
- After a refresh, read `git diff HEAD -- CLAUDE.md` before committing. Removed lines are the
  question: template law that moved, or repo law that needs a rule file.

## Retired by the phase-flow migration

Named so a later diff reads cleanly and nobody restores them:

- `.agent/roadmap.md`, `.agent/polish.md`, `.agent/memory.md` and `.claude/commands/session-*`
  → `.agent/spec.md` plus this rules tree. Historical copies are under `.agent/archive/`.
- The milestone vocabulary (M1-M5, MODE, WORK-UNIT, PLANNING, MILESTONE-REVIEW) → the four
  phases in `CLAUDE.md` `Session flow`. Archived text still uses it.
- The sizing model (`M = 45 + 2·I`, the 1.77 multiplier, the 223K one-window aim) →
  retired by user ruling. A `/goal` phase runs across compactions, so per-unit window fitting
  no longer binds MAIN; teammates size by the global `CLAUDE.md` ≤~190K rule and a wave
  re-measures if it overruns. Derivation stays in `.agent/archive/roadmap.md`.
- `.serena/` → deleted. Code intelligence is the built-in `LSP` tool.
