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
- **The binding replay lane cannot read the 19-indicator bag** — `pnpm binding:replay`: its archived arm loads the
  `a944fca` producer, whose provenance arity table refuses `guideline_document/4`, so since the
  `83569b1d` re-vendor the lane exits 1 before it erases anything (`ProvenanceError:
  prolog-arity: guideline_document/4`) instead of reading archived-red and working-green. The
  lane assumes both trees parse one bag, which a schema-changing re-vendor breaks; `pnpm
  binding:replay HEAD` still runs both arms on the working producer. Accept: the lane reads
  archived-red and working-green again — each arm on the bag its own tree vendored, erasing its
  own first cited line — or it retires with its firing kept in `.agent/contracts/m5u3.md`.
  `pri` med. A grader change: it needs the user's approval.
- **The meta-interpreter fails closed on a comparison built-in** — `derive/5`
  (`tools/kb/proof.mjs`) resolves the 19 schema indicators alone, so a derivation through a rule
  body that calls `guideline_satisfies/4,6` (30 documents, the `tablet-use-spacing` export)
  fails while the plain query succeeds; upstream's traces record each call as a `builtin(G)`
  leaf. No shipped proof reaches one: every catalog goal derives through the 12 recommendation
  documents, none of which compares a quantity. Accept: a proof through a comparison-bearing
  rule settles `proof`, the comparison a line-free leaf the decoder and the ladder both show,
  seen red on the unfixed tree. `pri` low.
- **`pnpm mutate` credits a timeout-only kill** — a vitest check that fails only by `Test timed
  out` exits 1, and `tools/mutate.mjs` reads exit 1 as killed, so a mutant that merely stalls its
  check, or a check starved by load, counts as bound (`mnt5-reviewer-2` F4: the first
  chat-server-fake mutant waited 5000 ms on a child that never exited). The scratch sweep
  `.scratch/review/mutant.mjs` refuses it per mutant, outside any gate. Accept: a mutant whose
  vitest check fails only by timeout reads `INCONCLUSIVE` and fails the run, shown by a planted
  stalling mutant. `pri` med. A grader change: it needs the user's approval.
  **User ruling**: left queued; `wip/m8-mutate-timeout` `7ea4369` holds the change with its firing shown.
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
  **User ruling**: left queued; `wip/m13-copy-sweep` `3a438c3` holds the change with its firing shown.
- **`claims:check` reads rules frontmatter as a claim** — `units()` (`tools/claims-sweep.mjs`)
  parses a rules file's YAML frontmatter as prose, so a `paths:` glob holding a digit becomes a
  registry row: `.claude/rules/firing.md`'s `".agent/contracts/mnt5-inventory.md"` glob, joined
  with the closing `---`, is R073. Accept: the sweep skips a leading frontmatter block, the
  registry re-seeds without that row, and a planted frontmatter glob holding a digit stays out
  of the claim set. `pri` low. A grader change: it needs the user's approval.
  **User ruling**: left queued; `wip/m14-frontmatter` `e13a620` holds the change with its firing shown.
- **`claims:check` covers one line of each `Artifacts` entry** — `claimSet`
  (`tools/claims-sweep.mjs`) keeps the first line of each `.agent/spec.md` `Artifacts` bullet,
  so a run command on a continuation line sits outside the registry: the chat bridge's
  `pnpm chat:dev` line can change, even to a command that does not exist, with the claim set and
  `claims:check` unchanged, while the same change on a first line moves it (`sync-reviewer-6`
  register G1, the same at `e9ffcb7`). Accept: each `Artifacts` bullet grades as one unit with
  its continuation lines, and a planted change on a continuation line is refused by
  `claims:check` as a stale row. `pri` med. A grader change: it needs the user's approval.
  **User ruling**: left queued; `wip/m15-artifacts` `e7e1844` holds the change with its firing shown.
- **The inventory resolves a bare-path `text` record and a `none` gate step** —
  `tests/inventory.test.ts` resolves a `text` record by `body.includes(anchor)`, which an empty
  anchor always satisfies, and admits `none` for a gate step as well as a lane, so the inventory
  can certify a gate with no firing record (`mnt5-reviewer-3` F4). Accept: the copy:check row
  planted as `text` + `tools/copy-check.mjs`, then as `none`, is refused by name — `names no
  verbatim text`, `a gate step needs a firing record` — and the real inventory still passes.
  `pri` med. A change to m2's grading check: it needs the user's approval. **Owed (user)**: the
  approval; `wip/f4-inventory` `ac40f9c` holds the change with its firing shown.
- **The decoder's first compound arm reads a dict whose keys spell a compound** — `decodeTerm`
  admits a plain object where `$t` is `t` and `functor` is a string, so the dict
  `_{'$t': t, functor: foo, foo: [[a]]}` decodes as `foo(a)` instead of failing closed; the
  `functor` and `$t` arms admit a wrapper instance alone since the mnt5 review (F1). Accept: that
  dict fails closed with `DecodeError`, and the `nativeCompound` fixtures in
  `tests/engine-u2-port.test.ts` build wrapper instances so every case keeps its assertion.
  `pri` low. Changing a graded suite's fixtures needs the user's approval.
- **`pnpm stryker`'s surviving mutants carry no ruling** — `.agent/contracts/mnt5-stryker.md` lists
  137 mutants left alive in the three modules `tests/legacy-export-lane.test.ts` imports (64
  `Survived`, 73 `NoCoverage`), characterised by the record's author alone. `CLAUDE.md`
  `Engineering` rules each survivor against the contract by someone other than the test's
  author, an unruled one queued here in MAINTAIN. Accept: every listed mutant carries a non-author
  ruling against the m5u6 contract in that record — specified behaviour → a test that kills it
  through observable behaviour, seen red on the mutant; behaviour the contract leaves open →
  recorded as open. `pri` med.
- **`binding:check` dominates the full gate** — 38.3 s of a 63.6 s `pnpm gate` on 8 cores at load
  3.7, the next step `lint` 10.2 s; `pnpm gate` prints each step's wall-clock. `CLAUDE.md`
  `Execution` queues a dominating step for a speedup at equal strength (parallel runner,
  content-keyed cache, incremental target, faster tool). Accept: `pnpm gate` prints
  `binding:check` below 38.3 s on the same host and load, and every check still fires on its
  planted bad input — its six controls, the `REQUIRED`, `LIFECYCLE` and `MEANING` rolls and
  `tests/inventory.test.ts`. `pri` low.
- **graph.md's renderer-surface figures are stale** — `.claude/rules/graph.md` `Renderer seam`
  states `Renderer surface = 12,282 B of 81,924 B graph surface = 15.0%` and `39 of 1,070 lines in
  SemanticGraph.svelte are canvas-coupled`; the tree measures `src/graph/canvas.ts` 12,504 B of
  100,993 B under `src/graph/` and 1,146 `SemanticGraph.svelte` lines, and no census row grades
  them (`docs/claims.md` R129 `false`). The isolation half holds. Accept: each figure re-derives
  from the tree — a `tests/census.test.ts` `CENSUS` row or a stated command — or leaves the claim,
  and R129 re-adjudicates `true`. `pri` med.
- **kb-build.md keeps the bag regeneration recipe inline** — `CLAUDE.md` `Authoring` routes a
  multi-step recipe to a committed script the rule names; `.claude/rules/kb-build.md`
  `Vendored bag` spells its `rustup` + `cargo build` + `ckc dist build` steps inline. Accept: a
  committed script takes the `cnl-ckc` checkout path and runs the recipe, `kb-build.md` names it
  in place of the inline block, and a run at the vendored bag's input head yields a
  `release-manifest.tsv` byte-equal to the vendored one. `pri` low.
## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| The binding replay lane cannot read the 19-indicator bag | the lane reads archived-red and working-green again — each arm on the bag its own tree vendored, erasing its own first cited line — or it retires with its firing kept in `.agent/contracts/m5u3.md` |
| `pnpm mutate` credits a timeout-only kill | a mutant whose vitest check fails only by timeout reads `INCONCLUSIVE` and fails the run, shown by a planted stalling mutant |
| `claims:check` covers one line of each `Artifacts` entry | each `Artifacts` bullet grades as one unit with its continuation lines, and a planted change on a continuation line is refused by `claims:check` as a stale row |
| The inventory resolves a bare-path `text` record and a `none` gate step | the copy:check row planted as `text` + `tools/copy-check.mjs`, then as `none`, is refused by name — `names no verbatim text`, `a gate step needs a firing record` — and the real inventory still passes |
| `pnpm stryker`'s surviving mutants carry no ruling | every listed mutant carries a non-author ruling against the m5u6 contract in that record — specified behaviour → a test that kills it through observable behaviour, seen red on the mutant; behaviour the contract leaves open → recorded as open |
| graph.md's renderer-surface figures are stale | each figure re-derives from the tree — a `tests/census.test.ts` `CENSUS` row or a stated command — or leaves the claim, and R129 re-adjudicates `true` |

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
