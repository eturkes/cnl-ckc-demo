---
paths:
  - "CLAUDE.md"
  - ".agent/spec-lint"
---

# Upstream sync

`CLAUDE.md` = the template `~/.local/app/agents/claude/CLAUDE.project.md`, copied whole;
last-sync = agents@8bc2c15. A refresh overwrites the whole file, so anything the repo needs it
to say must survive that overwrite in `.claude/rules/`. Refresh prompt =
`~/.local/app/agents/claude/prompts/auto/refresh.md`, or `steered/refresh.md` with a request
slot; the bodies are otherwise equal.

## Recipe

- Run the refresh prompt whole: its header copies the template, its step 1 derives last-sync
  and the upstream delta, its step 4 refreshes `.agent/spec-lint`, and its step 5 writes the
  value back. Step 1's `differs` case, the `last-sync` read and step 7's hidden-path sweep live
  in the prompt alone.
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
- No `pnpm gate` step grades a commit range, so the refresh commit follows the gate's last
  run on the final working tree (`binding:replay`, which reads history, sits outside the gate).

## Invariants

- **Line 1 = the `@.agent/spec.md` import.** The template carries it; a refresh from an older
  copy drops it and the attached state disappears silently — no error, no empty file, just a
  session that starts without `Intent`, `Decisions` or `Tasks`. Restore it before any other
  work.
- **`.agent/spec.md` = one H1 over five `##` sections in order** — `Intent`, `Artifacts`,
  `Decisions`, `Tasks`, `Phase`. `Tasks` rows read `- [ ] …` or `- [x] <sha> …`, and its last
  line is a one-line `.agent/deferred.md` pointer; `Phase` = `<PHASE> — <scope>` plus routed
  state alone. `.agent/spec-lint` grades that shape in the gate (`spec:lint`): a byte copy of
  `~/.local/app/agents/claude/spec-lint`, refreshed at each refresh and never edited here. The
  repo's `Tasks` and queue shapes → `.claude/rules/state.md`.
- **`.claude/rules/` is the refresh-safe carrier.** Nothing durable belongs in `CLAUDE.md`
  itself. Bare files (`gate`, `stack`, `waves`) load at session start; `paths:` files — this
  one included — load on first touch of a matching file.
- **Teammates = the roles in `~/.claude/agents/`**, dispatched where a global `CLAUDE.md`
  `Subagents` fit pays, weighed per case; `CLAUDE.md` `Session flow` sets each phase's teammate
  cost, its dispatch bar — by unit depth in IMPLEMENT + MAINTAIN — and its phase fits. A commit
  body names each teammate the unit used (name, role, verdict). No project file pins a model,
  effort level or agent definition: `.claude/settings.local.json` holds no model, effort or
  agent key, and no `.claude/agents/` exists.

## Rulings index

This repo's rulings on template clauses (`CLAUDE.md` `Session flow`: this file = defaults,
`.claude/rules/` = the rulings), and on the global `CLAUDE.md` clauses the template moved there.
A new ruling adds its row here.

| template clause | ruling | carrier |
|---|---|---|
| global `Engineering` fuzzing/property/formal methods | formal verification stays out: the demo serves no clinical purpose, `cnl-ckc` carries that rigor (user) | `stack.md` |
| `Session flow` PROTOTYPE location, ITERATE's prototype + IMPLEMENT retire-at-close | inapplicable to the expedited M2–M4 surfaces: redeveloped in place, no prototype tree, no `prototype-<scope>` tag (user); a future PROTOTYPE or ITERATE scope follows the template (user) | `stack.md` |
| `Session flow` IMPLEMENT CI | CI runs `pnpm gate` + the scanners and publishes nothing (user: local delivery) | `gate.md` `CI` |
| `Session flow` IMPLEMENT security scanning + global `Engineering` remotely-exploitable code | live `pnpm audit`, no allowlist; static analysis = ESLint security rules alone (user) | `gate.md` `audit:check`, `lint` |
| `Session flow` IMPLEMENT review ledger | `.agent/review.md` hand-maintained after its first shape | `waves.md` `Report grading` |
| `Session flow` Teammates, closing diff | judgment review reads the shipped surface, not a commit range (user) | `.agent/spec.md` `Decisions` |
| `Session flow` spec layout, `Tasks` | open rows carry acceptance + binding notes as sub-bullets; a closed request's ticked rows → `.agent/archive/maintain.md`; `spec:check` + `spec:lint` grade the format | `state.md` |
| `Session flow` deferral queue, one entry + acceptance check each | one bullet per row; `## Index` derived for `high` + `med`; `## Accepted-open` | `state.md` |
| `Session flow` spec shape check | `spec:lint` runs the byte copy through `tools/spec-lint.mjs`, whose controls prove the wiring; `spec:check` stays for the repo's own row rules | `gate.md`, `firing.md` |
| global `Engineering` purpose-built check, firing recorded in a `paths:` rule on the check's files | every gate step's firing input sits in one table; `.agent/contracts/mnt5-inventory.md` holds each check's record | `firing.md` |
| global `Engineering` a grading check changes only in an approved unit, recording the original firing | the edited row of the firing-input table = that record | `firing.md` |
| global `Engineering` a test counts once seen red on the unfixed revision | red witness in the unit's acceptance row; a run-internal witness or a named-arm differential satisfies the revision half; a base-green case stays declared and uncredited until `pnpm stryker` shows its suite killing default-operator mutants in its imports | `waves.md` `Units + teammates` |
| global `Authoring` strict text limits + `Human-facing` register | `copy:check` grades no sentence length and `tools/validate-report.mjs` no cell length (user); Japanese register J2–J4, the filler sweep and the report placeholder, verdict + pointer checks stay | `i18n.md` `Gate`, `waves.md` `Report grading` |
| global `Reading` read cost control, `.gitignore` | `node_modules` + `kb/generated` spelled without a trailing slash | `waves.md` `Worktrees` |

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
  commit trailer → the global `Subagents` roles and the global `Delivery` commit-body teammate line.
- `.serena/` → deleted. Code intelligence is the built-in `LSP` tool.
- `WebFetch` as a research source → verbatim page text (`webtext`, global `CLAUDE.md`
  `Engineering`). Archived u16 briefs still say `WebFetch`.
- Two blind teammates per verdict → one teammate per question with no blind second (global
  `Offload economics`). `28c37bc`'s `4 lenses × 2 reviewers` is history.
- One `reviewer` over every lens at a MAINTAIN close → one per lens in IMPLEMENT + MAINTAIN →
  one per lens in IMPLEMENT, one covering every lens elsewhere, MAINTAIN's where needed
  (`CLAUDE.md` `Session flow` Teammates). The `mnt2`–`mnt4` close contracts keep their forms.
- The demo-tier integrity waiver (off the answer path, a thin check = a demo-tier choice) and
  MAIN-alone MAINTAIN units → global `Engineering` verification integrity + the template's
  IMPLEMENT + MAINTAIN teammate dispatch by unit depth; demo tier = no formal verification
  (user ruling, `stack.md`). The closed `review-implement.md` + `review-u16.md` contracts and
  `.agent/review.md` keep the old form.
- `claude/prompts/<phase>.md` → `claude/prompts/auto/` + `steered/`.
- The `prototype/` verification carve-out → `a prototype runs under PROTOTYPE law`; no
  prototype exists here (`stack.md`).
- The template's per-phase teammate + advisor mandates — `consultant` on every phase plan,
  `reviewer` + `tester` per kernel unit, `scientist` reproducing every result, `researcher` at
  any count, the advisor on through IMPLEMENT + MAINTAIN → fits weighed per case at the phase's
  bar (global `Subagents`; `CLAUDE.md` `Session flow` Teammates + Advisor: the phase's bar in
  PROTOTYPE + ITERATE, unit depth in IMPLEMENT + MAINTAIN); each situation they named stays a
  fit. `scientist` appraises rather than authors, so the `Probe set` gold author is an
  independent teammate (user ruling, `.agent/spec.md` `Decisions`). Closed contracts and commit
  bodies keep the old form.
- The template's `Collaboration`, `Authoring`, `Engineering`, `Execution` research, briefs +
  git and `Session flow` read cost control → the global `CLAUDE.md` (`Collaboration`,
  `Authoring`, `Engineering`, `Delivery`, `Reading`). Rulings keyed on them read `global`.
- `.agent/spec.md` `# Intent` … `# Phase` H1 sections, `` - [x] `<sha>` `` ticked rows and a
  wrapped queue pointer → one H1 over `##` sections, `- [x] <sha>`, a one-line pointer
  (`.agent/spec-lint`).
- Every closed MAINTAIN request's ticked rows in `Tasks`, and the `IMPLEMENT closed twice` +
  prototype history in `Phase` → `.agent/archive/maintain.md`; the surviving evidence-branch
  list → `.claude/rules/waves.md` `Worktrees`.
- Firing records + the scratch-validator regeneration path beside the bare gate invocation
  (`gate.md` `Firing inputs`) → `.claude/rules/firing.md`, a `paths:` rule on the check's
  files; a scratch-local validator's regeneration path joins a `paths:` rule on the files it
  validates (global `Engineering`).
- `copy:check`'s sentence caps — English 20/25 words, components 25, Japanese J1 40/60 units —
  and `tests/m1u7-port.test.ts` C6 → retired by user ruling (global `Authoring`); the deletion
  carries its `.agent/deferred.md` row.
- `tools/validate-report.mjs`'s length floors — finding 40, evidence 8, unit acceptance 20
  characters → retired by user ruling (global `Authoring`). At `e9ffcb7` an 11-character finding
  with 5-character evidence exited 1 `finding too thin (11<40 chars)`.
