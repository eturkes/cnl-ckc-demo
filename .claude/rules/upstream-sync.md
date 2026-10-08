---
paths:
  - "CLAUDE.md"
---

# Upstream sync

`CLAUDE.md` = the template `~/.local/app/agents/claude/CLAUDE.project.md`, copied whole;
last-sync = agents@2cedb4f. A refresh overwrites the whole file, so anything the repo needs it
to say must survive that overwrite in `.claude/rules/`. Refresh prompt =
`~/.local/app/agents/claude/prompts/auto/refresh.md`, or `steered/refresh.md` with a request
slot; the bodies are otherwise equal.

## Recipe

- Run the refresh prompt whole: its header copies the template, its step 1 derives last-sync
  and the upstream delta, and its step 5 writes the value back. Step 1's `differs` case, the
  `last-sync` read and step 7's hidden-path sweep live in the prompt alone.
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
  The repo's `Tasks` and queue shapes → `.claude/rules/state.md`.
- **`.claude/rules/` is the refresh-safe carrier.** Nothing durable belongs in `CLAUDE.md`
  itself. Bare files (`gate`, `stack`, `waves`) load at session start; `paths:` files — this
  one included — load on first touch of a matching file.
- **Teammates = the roles in `~/.claude/agents/`**, triggered by the global `CLAUDE.md`
  `Subagents` law. A commit body names each teammate the unit used (name, role, verdict). No
  project file pins a model, effort level or agent definition: `.claude/settings.local.json`
  carries the headroom hook + proxy URL alone, and no `.claude/agents/` exists.

## Rulings index

This repo's rulings on template clauses (`CLAUDE.md` `Session flow`: this file = defaults,
`.claude/rules/` = the rulings). A new ruling adds its row here.

| template clause | ruling | carrier |
|---|---|---|
| `Engineering` verification integrity | binds whole on the answer path; off it a thin check is a demo-tier choice; report honesty unwaived (user) | `stack.md` |
| `Session flow` PROTOTYPE location + IMPLEMENT retire-at-close | inapplicable: no prototype tree; the expedited surfaces were redeveloped in place (user) | `stack.md` |
| `Session flow` IMPLEMENT CI | CI runs `pnpm gate` + the scanners and publishes nothing (user: local delivery) | `gate.md` `CI` |
| `Session flow` IMPLEMENT security scanning + `Engineering` remotely-exploitable code | live `pnpm audit`, no allowlist; static analysis = ESLint security rules alone (user) | `gate.md` `audit:check`, `lint` |
| `Session flow` IMPLEMENT review ledger | `.agent/review.md` hand-maintained after its first shape | `waves.md` `Report grading` |
| `Session flow` Teammates, closing diff | judgment review reads the shipped surface, not a commit range (user) | `.agent/spec.md` `Decisions` |
| `Session flow` spec layout, `Tasks` | open rows carry acceptance + binding notes as sub-bullets; `spec:check` grades the format | `state.md` |
| `Session flow` deferral queue, one line + acceptance check each | one bullet per row; `## Index` derived for `high` + `med`; `## Accepted-open` | `state.md` |
| `Engineering` a grading check changes only in an approved unit, recording the original firing | the edited row of the firing-input table = that record | `gate.md` `Firing inputs` |
| `Engineering` a test counts once seen red on the unfixed revision | red witness in the unit's acceptance row; a run-internal witness or a named-arm differential satisfies the revision half | `waves.md` `Units + teammates` |
| `Authoring` human-facing register | word limits do not port to Japanese → J1–J4 register | `i18n.md` |
| `Session flow` read cost control, `.gitignore` | `node_modules` + `kb/generated` spelled without a trailing slash | `waves.md` `Worktrees` |

## Retired

Named so a later diff reads cleanly and nobody restores them. Archived text, closed contracts,
`.agent/review.md` rows and commit history keep the old names.

- `.agent/roadmap.md`, `.agent/memory.md` and `.claude/commands/session-*` → `.agent/spec.md`
  plus this rules tree. Historical copies are under `.agent/archive/`.
- `.agent/polish.md` = the deferral queue all along, misfiled under `.agent/archive/` by the
  migration → `.agent/deferred.md`, its canonical home. Archived text still says `polish.md`.
- The `≤ 8 KB` cap on `.agent/spec.md` → the template's liveness rule (`CLAUDE.md`
  `Session flow`). Byte pressure rewarded compressing prose over deleting dead rows, which is
  the entropy the cap was groping at.
- The milestone vocabulary (M1-M5, MODE, WORK-UNIT, PLANNING, MILESTONE-REVIEW) → the four
  phases in `CLAUDE.md` `Session flow`.
- The sizing model (`M = 45 + 2·I`, the 1.77 multiplier, the 223K one-window aim) →
  retired by user ruling. A phase session runs across compactions, so per-unit window fitting
  no longer binds MAIN; teammates size by the global `CLAUDE.md` `Teammate size` rule.
  Derivation stays in `.agent/archive/roadmap.md`.
- `/goal` as the phase-session vehicle → a plain session per pasted phase body, run until the
  body's `Met when` holds (`CLAUDE.md` `Session flow`); the global `agent-flow` mod's
  compaction note carries that condition across compaction.
- The spec's `Deferred` section → `Tasks`.
- Dispatch-role abbreviations, solo licences, the per-unit dispatch line and the `dispatch:`
  commit trailer → the global `Subagents` roles and the template's commit-body teammate line.
- `.serena/` → deleted. Code intelligence is the built-in `LSP` tool.
- `WebFetch` as a research source → verbatim page text (`webtext`, `CLAUDE.md` `Execution`).
  Archived u16 briefs still say `WebFetch`.
- Per-lens closing reviewers outside IMPLEMENT + two blind teammates per verdict → one
  `reviewer` over every lens outside IMPLEMENT, one per lens inside it (`CLAUDE.md`
  `Session flow`), one teammate per question with no blind second (global `Offload
  economics`). `28c37bc`'s `4 lenses × 2 reviewers` is history.
- `claude/prompts/<phase>.md` → `claude/prompts/auto/` + `steered/`.
- The `prototype/` verification carve-out → `a prototype runs under PROTOTYPE law`; no
  prototype exists here (`stack.md`).
