# Deferral queue

The queue `.agent/spec.md` `Tasks` points at: off-spine improvements, held out of the
attached state because the queue has no size bound. Each entry carries the acceptance check that
closes it and a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up. A row closes on its own
acceptance check and leaves in that commit; the index at the foot collapses the `high` +
`med` set to one line each.

- **Two coverage passages do not locate on their recorded page** — the owned page viewer
  marks a passage where its page's text holds it (`tests/passage-locate.test.ts`: 366 whole, 17
  continuing, 2 not found). `cdc2022-opioid-rec06` and `rec07` record page 14 (producer
  `coverage.tsv` B3-09, B3-10 `p14`), yet each passage sits whole on page 13, where BOX 3
  begins; the producer's own census places both there (`audit/census-map.tsv` `p013.C13`–`C15`).
  The producer (`cnl-ckc`) owns the fix. Accept: each of the two either locates after a
  re-vendored bag corrects its region page, or carries a recorded producer reason, and the
  census in `tests/passage-locate.test.ts` moves with it. `pri` low. **User ruling**: keep it
  owed to the producer — no demo-side declared limit.
- **C6 left `tests/m1u7-port.test.ts` with the sentence caps** — the archived m1u7 contract's C6
  (a 30-word sentence planted in `INSTRUCTIONS` or `DESCRIPTIONS` fails `copy:check`) lost its
  subject when the caps retired; both cases and their mutant
  `inv m1u7-port: instruction word ceiling raised to thirty` were deleted, and the suite's
  firing record became `inv m1u7-port: a non-role root token planted`. Re-open trigger: a user
  ruling that restores a sentence-length check. Accept: C6 returns with that check and is seen
  red on a planted over-long sentence. `pri` low. **User ruling**: retire the caps and delete C6.
- **`binding:check` still dominates the gate, and its wall drifts with the host** — after n14
  (`83cd690`: 35.7–36.9 s at comparable load) the closing gates on `0acbd24` printed 51.1 s and
  42.7 s from a 1-min load near 2, while the same tree's summed test-file durations rose from
  178–182 s to 219–226 s: the host ran about 20% slower, and an alternating A/B still showed n14's
  cut (36.3 / 41.4 s against 47.9 / 48.7 s). The makespan is now bound by total work (201 s summed
  over 106 files on 8 cores, longest file `clinical-records` 26.1 s). Re-open trigger: three
  consecutive `pnpm gate` runs on one host, each starting at a 1-min load below 2, print
  `binding:check` above that host's bound — 45 s on the Core Ultra 7 268V these figures come
  from, 110 s on the i7-8650U, which printed 89.7–98.9 s (user ruling: per-host baselines).
  Accept: a speedup at equal strength — every check still runs and fires on its planted
  input — that an alternating A/B, two runs per arm against the tree it replaces, shows cutting
  `binding:check`'s wall by at least 15%. `pri` low.
- **`Verify` is red on `main` at T9, whose `git show 22053ef` the CI checkout cannot resolve** —
  `actions/checkout@v6` fetches one commit by default, so `tests/clinical-records.test.ts` T9
  throws `Command failed: git show 22053ef:tools/kb/clinical.mjs` and `binding:check` exits 1 on a
  sound tree. The 15 latest `main` runs of `ci.yml`, `010655c` to `f9a890c`, concluded `failure`
  (`gh run list --branch main --workflow Verify`); those on `010655c`, `5a22cf6` and `f9a890c`
  read at that line. A full clone resolves the commit, so the local `pnpm gate` stays green.
  Accept: a `Verify` run on a sound `main` push concludes `success` with T9 still comparing
  against `22053ef`'s bytes, and the same workflow on a tree with one T9-frozen byte changed
  concludes `failure` at T9. `pri` med.
- **The CI gate's fan-out is not built** — `CLAUDE.md` `Execution` `CI gate` runs the full gate as
  a parallel CI fan-out on a `ci/<unit>` push once `main` CI is green (`.claude/rules/gate.md`
  `## CI`); `ci.yml` runs one `pnpm gate` job, on `main` and pull requests alone. Re-open trigger:
  the `Verify` and `Security scan` rows above closed. Accept: `git push -f origin HEAD:ci/<unit>`
  starts a workflow running every `gate:chain` step as its own parallel job; `gh run watch` exits
  0 on a sound tree and nonzero, naming the step, on a tree with one planted red step; and
  `.claude/rules/gate.md` `## CI` records the workflow and its commands. `pri` low.
- **KB intake reads a sibling cnl-ckc checkout, not a release** — `tools/kb/regenerate-bag.sh`
  rebuilds the bag from a producer checkout that `CLAUDE.local.md` locates, and
  `.claude/rules/kb-build.md` `Upstream port specifications` makes upstream's Verus specs
  (`check.rs`, `align.rs`, `ui.rs`) and its `tests/ui/` fixture corpus the provenance port's live
  specification and oracle, though no release asset carries them: release `kb-2026-10-29-rc.1`
  ships the bag `cnl-ckc-kb-g673b3c1f3bfd.tar.gz`, the `ckc-x86_64-linux` binary and a `.sha256`
  for each. **User ruling**: the KB alone comes from a `cnl-ckc` GitHub release tag; everything
  else is self-contained in this repo. Until this row closes, `.claude/rules/toolchain.md` keeps
  the upstream citation as an interim ruling. Accept: `kb/` vendors the bag a named release tag
  publishes, checked against that release's `.sha256` asset before use, and `pnpm kb:build` is
  green on it; no tool, check or live law reads a `cnl-ckc` checkout or names `../cnl-ckc` beyond
  `kb-build.md`'s forbidden-reach scan literal; each upstream source `.claude/rules/` cites as
  live law is held in this repo or retired from that law; `toolchain.md`'s interim ruling is gone.
  `pri` med. Blocker: the user opens the migration as its own session. Release
  `kb-2026-10-29-rc.1`, re-cut at producer `737f1d87`, publishes one file,
  `cnl-ckc-kb-only-2026-10-29-rc.1.tar.gz` — the bag `cnl-ckc-kb-g673b3c1f3bfd`, 492 documents
  against the vendored 385 — and no `.sha256` asset: its sha256 rides the SSH-signed tag body
  (`git verify-tag` against upstream `docs/allowed_signers`) and GitHub's asset `digest`
  (`c8cc65d6…`), so the Accept clause's `.sha256` asset awaits the user's re-ruling.
- **Node 24 is in maintenance; Node 26 is LTS** — Node 24 entered maintenance 2026-10-20 (EOL
  2028-04-30) and Node 26 LTS 2026-10-28 (`nodejs/Release` `schedule.json`), while
  `devEngines.runtime`, `engines` and CI pin 24 by user ruling. Accept: `devEngines.runtime`,
  `engines` and CI name Node 26, and `pnpm release:check` is green on it. `pri` low. Re-open
  trigger: the user's re-ruling of `Node 24, project-wide`.
## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| `Verify` is red on `main` at T9, whose `git show 22053ef` the CI checkout cannot resolve | a `Verify` run on a sound `main` push concludes `success` with T9 still comparing against `22053ef`'s bytes, and the same workflow on a tree with one T9-frozen byte changed concludes `failure` at T9 |
| KB intake reads a sibling cnl-ckc checkout, not a release | `kb/` vendors the bag a named release tag publishes, checked against that release's `.sha256` asset before use, and `pnpm kb:build` is green on it; no tool, check or live law reads a `cnl-ckc` checkout or names `../cnl-ckc` beyond `kb-build.md`'s forbidden-reach scan literal; each upstream source `.claude/rules/` cites as live law is held in this repo or retired from that law; `toolchain.md`'s interim ruling is gone |

## Accepted-open

Review rows ruled open rather than fixed. Each carries its acceptance check in
`.agent/archive/review-expedited.md`; none is current scope. Re-ruled against the
verification-integrity clause the retired waiver excused: all fifteen stay open (user ruling;
facts per id → `.agent/contracts/mnt5-inventory.md` `## Accepted-open re-ruling`).

A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 · C1 C4u1 C4u4 C4u5 C6.

**S9 and S13+ left this set in u12** by user ruling: `binding:check` fails the gate on any red
case in its run, so a tree holding them red can never be gate-green, and xfail, a split suite
or branch-only storage each stop executing the defect. S9's headline now counts entity and
event nodes alone and both locales name what the hidden totals contain; S13+ is refused at
`parseEdge`, where `guideline_arg/4` and `guideline_pp/4` constrain their source to an event —
5,018 constrained edges, 0 violations across the shipped 20,980.
