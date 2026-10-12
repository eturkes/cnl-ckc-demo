# Deferral queue

The queue `.agent/spec.md` `Tasks` points at: off-spine improvements, held out of the
attached state because the queue has no size bound. Each entry carries the acceptance check that
closes it and a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up. A row closes on its own
acceptance check and leaves in that commit; the index at the foot collapses the `high` +
`med` set to one line each.

- **Two coverage passages do not locate on their recorded page** — the owned page viewer
  marks a passage where its page's text holds it (`tests/passage-locate.test.ts`: 321 whole, 14
  continuing, 2 not found). `cdc2022-opioid-rec06` and `rec07` record page 14 (producer
  `coverage.tsv` B3-09, B3-10 `p14`), yet each passage sits whole on page 13, where BOX 3
  begins; the producer's own census places both there (`audit/census-map.tsv` `p013.C13`–`C15`).
  The producer (`../cnl-ckc`) owns the fix. Accept: each of the two either locates after a
  re-vendored bag corrects its region page, or carries a recorded producer reason, and the
  census in `tests/passage-locate.test.ts` moves with it. `pri` low. **User ruling**: keep it
  owed to the producer — no demo-side declared limit.
- **Off-path checks the retired demo-tier waiver excused** — the waiver let a check off the
  answer path stay thin or unable to refuse a wrong input, and the `## Accepted-open` ids were
  ruled under it. `CLAUDE.md` `Engineering` verification integrity now binds the whole repo
  (`.claude/rules/stack.md` `Demo tier`). Accept: a committed inventory under
  `.agent/contracts/` lists every check off the answer path — gate step, out-of-chain lane and
  suite — and each one either refuses a planted wrong input with its firing recorded, or
  carries its own queue row with an acceptance check; every `## Accepted-open` id is re-ruled
  against the same clause. `pri` med. **User ruling**: demo tier = no formal verification, so
  formal methods stay out of the inventory.
  **Inventory landed**: `.agent/contracts/mnt5-inventory.md`, graded in the gate by
  `tests/inventory.test.ts` (one row per gate step, lane and suite; every record resolves).
  **Owed (user)**: the accepted-open re-ruling — the original set was a user scope ruling;
  facts at `d3c4bc5` and a proposed ruling per id sit in the inventory's
  `## Accepted-open re-ruling`.
- **Two `Decisions` bullets state the reader-relative label ruling** — `.agent/spec.md`
  `Decisions` **User** holds `The reading is READER-RELATIVE` and `An edge label is
  READER-RELATIVE` back to back: the same ruling twice, each carrying clauses the other lacks
  (the approved change of `tests/graph-semantics.review.test.ts:118` + its firing citation; the
  shared `scopeReading` helper + the pointer to `.claude/rules/graph.md`). Accept:
  `command grep -c 'READER-RELATIVE' .agent/spec.md` → 1, and that bullet carries every clause
  both state. `pri` low. The ruling text is the user's, so the merge needs the user's approval.
- **A compound named `functor` fails to decode** — swipl-wasm's `PrologCompound` sets
  `this.functor = name` and then `this[name] = args`, so for the name `functor` the arguments
  overwrite the name, and `decodeTerm` (`src/engine/terms.ts`) throws `unsupported native tag:
  t` on `X = functor(a)` or any goal that parses to one. Fail-closed, and no shipped answer holds
  such a compound; the chat's read-only allowlist refuses `functor/3` because of it
  (`.agent/contracts/chat-c1.md`). Accept: `X = functor(a,b)` solves with `X` decoded as a
  compound `functor/2`, and the encoder re-enters it unchanged (`=@=`). `pri` low.
- **axe-contrast pins a jsdom fact no planted input reaches** — `tests/axe-contrast.dom.test.ts`
  pins that `axe-core` under jsdom reports every `color-contrast` result `incomplete`, the fact
  `contrast:check` exists for; it can go red only when the environment changes, and nothing
  plants that change. Accept: the same probe, run in an environment that can decide contrast
  (`pnpm test:browser`'s Chromium), reports the planted pair a violation, recorded beside the
  pin. `pri` low.
- **A compound named `$t` fails to decode and cannot re-enter** — swipl-wasm's `PrologCompound`
  sets `this.$t = "t"` and then `this[name] = args`, so for `'$t'(a)` the arguments overwrite the
  type tag: `decodeTerm` throws `unsupported native tag: a`, and the wrapper's `toProlog` raises
  `get_dict/3: Arguments are not sufficiently instantiated` on a re-encoded one. Fail-closed; no
  shipped answer holds one. Accept: `X = '$t'(a)` solves with `X` decoded as compound `$t/1`,
  and `createEncoder` refuses it by name with `DecodeError` before any query runs, as it refuses
  a dict. `pri` low.
- **`pnpm mutate` credits a timeout-only kill** — a vitest check that fails only by `Test timed
  out` exits 1, and `tools/mutate.mjs` reads exit 1 as killed, so a mutant that merely stalls its
  check, or a check starved by load, counts as bound (`mnt5-reviewer-2` F4: the first
  chat-server-fake mutant waited 5000 ms on a child that never exited). The scratch sweep
  `.scratch/review/mutant.mjs` refuses it per mutant, outside any gate. Accept: a mutant whose
  vitest check fails only by timeout reads `INCONCLUSIVE` and fails the run, shown by a planted
  stalling mutant. `pri` med. A grader change: it needs the user's approval.
## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| Off-path checks the retired demo-tier waiver excused | a committed inventory under `.agent/contracts/` lists every check off the answer path — gate step, out-of-chain lane and suite — and each one either refuses a planted wrong input with its firing recorded, or carries its own queue row with an acceptance check; every `## Accepted-open` id is re-ruled against the same clause |
| `pnpm mutate` credits a timeout-only kill | a mutant whose vitest check fails only by timeout reads `INCONCLUSIVE` and fails the run, shown by a planted stalling mutant |

## Accepted-open

Review rows ruled open rather than fixed. Each carries its acceptance check in
`.agent/archive/review-expedited.md`; none is current scope.

A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 · C1 C4u1 C4u4 C4u5 C6.

**S9 and S13+ left this set in u12** by user ruling: `binding:check` fails the gate on any red
case in its run, so a tree holding them red can never be gate-green, and xfail, a split suite
or branch-only storage each stop executing the defect. S9's headline now counts entity and
event nodes alone and both locales name what the hidden totals contain; S13+ is refused at
`parseEdge`, where `guideline_arg/4` and `guideline_pp/4` constrain their source to an event —
5,018 constrained edges, 0 violations across the shipped 20,980.
