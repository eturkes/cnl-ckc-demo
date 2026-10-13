---
paths:
  - ".agent/spec.md"
  - ".agent/deferred.md"
---

# State files

Repo bindings on the state layout `CLAUDE.md` `Session flow` names.

- **`Tasks` rows carry their contract.** `- [ ]` open units in spine order with their
  acceptance checks + binding notes as indented sub-bullets, `- [x] <sha>` once committed, the
  SHA bare; its last line is a one-line pointer at `.agent/deferred.md`. Each phase close and
  each MAINTAIN request's close moves its ticked rows under `.agent/archive/` — a MAINTAIN
  request's into `maintain.md` — while a part owed by the user stays an open
  `- [ ] owed (user)` row. A note that rules rather than tracks belongs in `Decisions`. A
  closed unit's own contract in `.agent/contracts/` stays the citable record.
  `pnpm spec:check` + `pnpm spec:lint` grade the format (`.claude/rules/gate.md`).
- **`Phase` = state alone**: `<PHASE> — <scope>`, then any routed state. Its history goes to
  `.agent/archive/maintain.md`, and the evidence branches it cited stay listed in
  `.claude/rules/waves.md` `Worktrees`.
- **`.agent/deferred.md` = the queue.** It has no size bound and most rows bear on no current
  unit, which is why it is unattached: a row reaches an agent when `spec.md` `Tasks` points at
  it or a rule cites it by row. Every
  queue-row citation in `.claude/rules/`, `.agent/contracts/` and `.agent/review.md` names that
  file, never `spec.md`.
- **A queue row = one bullet.** Bold title + the defect, the `Accept:` check,
  `pri` `high`|`med`|`low`, then any **User ruling**, red witness or blocker. `## Index` holds one
  line per `high` + `med` row, written by `pnpm queue:index` and graded by `claims:check`;
  `## Accepted-open` holds the review ids ruled open.
