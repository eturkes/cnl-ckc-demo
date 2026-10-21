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
- **The meta-interpreter fails closed on a comparison built-in** — `derive/5`
  (`tools/kb/proof.mjs`) resolves the 19 schema indicators alone, so a derivation through a rule
  body that calls `guideline_satisfies/4,6` (30 documents, the `tablet-use-spacing` export)
  fails while the plain query succeeds; upstream's traces record each call as a `builtin(G)`
  leaf. No shipped proof reaches one: every catalog goal derives through the 12 recommendation
  documents, none of which compares a quantity. Accept: a proof through a comparison-bearing
  rule settles `proof`, the comparison a line-free leaf the decoder and the ladder both show,
  seen red on the unfixed tree. `pri` low. Changing P1's declared `Derived: 'no'` pin and adding a
  list to the ladder (an accepted surface) need the user's approval. **User ruling**: left queued
  (the question after `8076cb7`); `wip/n9-comparison` `3cf1d13` holds the unit — contract `n9-comparison.md`
  reviewed before code by consultant-5, red witnesses shown, gate green.
- **C6 left `tests/m1u7-port.test.ts` with the sentence caps** — the archived m1u7 contract's C6
  (a 30-word sentence planted in `INSTRUCTIONS` or `DESCRIPTIONS` fails `copy:check`) lost its
  subject when the caps retired; both cases and their mutant
  `inv m1u7-port: instruction word ceiling raised to thirty` were deleted, and the suite's
  firing record became `inv m1u7-port: a non-role root token planted`. Re-open trigger: a user
  ruling that restores a sentence-length check. Accept: C6 returns with that check and is seen
  red on a planted over-long sentence. `pri` low. **User ruling**: retire the caps and delete C6.
- **`copy:check` grades component prose twice** — `gradeLiterals` refuses every literal a
  component renders bar the brand mark, so `gradeComponents`' filler sweep over the same
  `componentText` can never be the sole refusal; the cap retirement left it holding that sweep
  and the empty-set guard alone. Accept: the sweep leaves with its control and its
  `.claude/rules/firing.md` row records the original firing, the derived-set guard kept, or a
  recorded reason keeps it. `pri` low. A grader change: it needs the user's approval.
  **User ruling**: left queued twice, at `f25bb35` and in the question after `8076cb7`;
  `wip/n11-copy-sweep` `ca26be9` holds `3a438c3` re-applied with its firing re-shown and its
  records landed.
- **`claims:check` reads rules frontmatter as a claim** — `units()` (`tools/claims-sweep.mjs`)
  parses a rules file's YAML frontmatter as prose, so a `paths:` glob holding a digit becomes a
  registry row: `.claude/rules/firing.md`'s `".agent/contracts/mnt5-inventory.md"` glob, joined
  with the closing `---`, is a registry row of its own. Accept: the sweep skips a leading frontmatter block, the
  registry re-seeds without that row, and a planted frontmatter glob holding a digit stays out
  of the claim set. `pri` low. A grader change: it needs the user's approval.
  **User ruling**: left queued twice, at `f25bb35` and in the question after `8076cb7`;
  `wip/n12-frontmatter` `b52e01f` holds `e13a620` re-applied with its firing re-shown and its
  records landed.
- **The decoder's first compound arm reads a dict whose keys spell a compound** — `decodeTerm`
  admits a plain object where `$t` is `t` and `functor` is a string, so the dict
  `_{'$t': t, functor: foo, foo: [[a]]}` decodes as `foo(a)` instead of failing closed; the
  `functor` and `$t` arms admit a wrapper instance alone since the mnt5 review (F1). Accept: that
  dict fails closed with `DecodeError`, and the `nativeCompound` fixtures in
  `tests/engine-u2-port.test.ts` build wrapper instances so every case keeps its assertion.
  `pri` low. Changing a graded suite's fixtures needs the user's approval. **User ruling**: left
  queued (the question after `8076cb7`); `wip/n13-decoder` `eca6aca` holds the change with both fixture edits
  (`nativeCompound` wrapper instances, P3.10 building its value before spying).
- **`binding:check` still dominates the gate, and its wall drifts with the host** — after n14
  (`83cd690`: 35.7–36.9 s at comparable load) the closing gates on `0acbd24` printed 51.1 s and
  42.7 s from a 1-min load near 2, while the same tree's summed test-file durations rose from
  178–182 s to 219–226 s: the host ran about 20% slower, and an alternating A/B still showed n14's
  cut (36.3 / 41.4 s against 47.9 / 48.7 s). The makespan is now bound by total work (201 s summed
  over 106 files on 8 cores, longest file `clinical-records` 26.1 s). Re-open trigger: three
  consecutive `pnpm gate` runs, each starting at a 1-min load below 2, print `binding:check` above
  45 s. Accept: a speedup at equal strength — every check still runs and fires on its planted
  input — that an alternating A/B, two runs per arm against the tree it replaces, shows cutting
  `binding:check`'s wall by at least 15%. `pri` low.
- **`claims:check`'s repeated-index control cannot fire on an empty index** — the control repeats
  the index's first data line (`tools/claims-sweep.mjs` `firstIndexLine`); a queue holding no
  `high` or `med` row has none, so the planted copy grades unchanged and `claims:check` exits 1
  `control did not fire — the first index line repeated reported nothing, missing "repeats or
  reorders its lines"` on a sound queue, seen when n5's landing pruned the last `med` row. This
  row's own index line keeps the control firing meanwhile. Accept: on a queue whose index holds no
  line, the control repeats the line of a `med` row planted in a copy whose index is rewritten,
  and `claims:check` passes on the real queue with this row pruned; firing.md's claims:check row
  records the original control's firing. `pri` med. A grader change: it needs the user's approval.
## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| `claims:check`'s repeated-index control cannot fire on an empty index | on a queue whose index holds no line, the control repeats the line of a `med` row planted in a copy whose index is rewritten, and `claims:check` passes on the real queue with this row pruned; firing.md's claims:check row records the original control's firing |

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
