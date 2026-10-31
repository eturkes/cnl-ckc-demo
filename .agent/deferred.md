# Deferral queue

The queue `.agent/spec.md` `Tasks` points at: off-spine improvements, held out of the
attached state because the queue has no size bound. Each entry carries the acceptance check that
closes it and a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up. A row closes on its own
acceptance check and leaves in that commit; the index at the foot collapses the `high` +
`med` set to one line each.

- **Two coverage passages do not locate on their recorded page** — the owned page viewer
  marks a passage where its page's text holds it (`tests/passage-locate.test.ts`: 467 whole, 21
  continuing, 4 not found). `cdc2022-opioid-rec06` and `rec07` record page 14 (producer
  `coverage.tsv` B3-09, B3-10 `p14`), yet each passage sits whole on page 13, where BOX 3
  begins; the producer's own census places both there (`audit/census-map.tsv` `p013.C13`–`C15`).
  The producer (`cnl-ckc`) owns the fix. Accept: each of the two either locates after a
  re-vendored bag corrects its region page, or carries a recorded producer reason, and the
  census in `tests/passage-locate.test.ts` moves with it. `pri` low. **User ruling**: keep it
  owed to the producer — no demo-side declared limit.
- **Two normalized passages do not locate on their own page** — `cdc2022-opioid-s33-01` (a
  table: the extraction joins its cells with `: ` and `; `) and `cdc2022-opioid-s57-05` (a list:
  the extraction drops its item numbers) sit on their recorded pages 33 and 57, in a form the page
  text layer does not hold, so the owned page viewer marks neither (`tests/passage-locate.test.ts`
  lists both beside rec06 and rec07). Accept: each locates, whole or continuing, on its recorded
  page — the locator reading a table row and a numbered item as the extraction joins them — and
  the census in `tests/passage-locate.test.ts` moves with it. `pri` low.
- **Scope exclusions and superseded statements do not surface** — the graph projects no
  `guideline_exclusion/1` or `guideline_supersession/4` record and no guard
  (`tools/kb/graph.mjs` `UNPROJECTED`, the evaluation-date comparison skipped), and the answer
  panel never says that a statement is guarded or superseded; the ladder shows the scope guard as
  a negation step alone. Accept: the graph projects each exclusion and supersession record under
  the meaning ruling, the guard conditions included, graded by `tests/graph-annotations.test.ts`
  A1 without its evaluation-date exemption, and the answer panel names a superseded statement
  and its source, its live review owed. `pri` low. **User ruling**: carry the semantics through,
  queue the surfacing.
- **An arithmetic built-in holds one engine step past the wall clock** — the read-only guard
  admits `guideline_product/6` and `guideline_quotient/6` (user ruling), whose Euclid loop over a
  25,000-digit operand — one `is/2` builds in milliseconds — holds a single step 38 s in Node; the
  client's hard deadline then recreates the worker, as it does for `is/2`'s own 12.5 s on
  `7**(10**7)`. Accept: the guard bounds the operands a chat goal can hand an arithmetic built-in,
  or the step ends on the budget, and a G9 row in `tests/engine-readonly-budget.test.ts` drives a
  25,000-digit quotient to a `limit` or `error` with the engine still answering. `pri` low.
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
- **The release tag's signature goes unchecked** — `pnpm kb:fetch` holds the archive to its
  `.sha256` sidecar and GitHub's asset digest, both published by the same release, and the release
  notes tie the archive's checksum to an SSH-signed tag; GitHub reads that tag's key
  `unknown_key`, and no tool here checks the signature against a pinned signer. Accept: the intake
  refuses a tag whose signature does not verify against a public key pinned in this repo, its
  body's checksum line equal to the archive's digest, with a planted bad signature refused by
  name. `pri` low.
- **The vendored `tests/ui/` corpus runs against no suite** — `vendor/cnl-ckc/tests/ui/` holds
  upstream's 22 green and 85 red case families for provenance joins and hostile input, vendored
  at the release commit (user ruling), and no test here feeds them to `tools/kb/provenance.mjs`
  or `src/provenance/`. Accept: a suite reads every applicable family and holds the port to its
  verdict — each green family joined, each red family refused by its recorded reason — with the
  families that exercise a surface the port lacks listed by name. `pri` low.
## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |

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
