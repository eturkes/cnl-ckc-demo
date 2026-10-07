# Deferral queue

The queue `.agent/spec.md` `Tasks` points at: off-spine improvements, held out of the
attached state because the queue has no size bound. Each entry carries the acceptance check that
closes it and a `pri` — `high` = a defect reachable in the shipped product, `med` = a gate or
evidence gap under a durable claim, `low` = a feature or a tidy-up. A row closes on its own
acceptance check and leaves in that commit; the index at the foot collapses the `high` +
`med` set to one line each.

- **u3 heap limit is unit-tested only** — `P2.7` is covered by `readOutcome` over a
  synthesized `resource_error(memory)`, not a live trip. Accept: a committed test drives
  real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate. `pri` med.
  **Blocked on the `high` abort row below**: at swipl-wasm 8.0.7 real exhaustion aborts the
  runtime in Node too and never raises `resource_error(memory)`, so `limit: 'heap'` is
  unreachable live until that row classifies the abort. The fast live half is committed —
  `tests/engine-heap.test.ts` drives the trip in ~1 s behind a 1900 MB `_malloc` reserve and
  pins today's abort; it owes only the `limit: 'heap'` read.
- **Browser WASM abort leaves a dead session** — a runaway `assertz` aborts the WASM runtime
  — in Node too at swipl-wasm 8.0.7, pinned live by `tests/engine-heap.test.ts`, which is the
  fix's red witness — and surfaces as `{code:'prolog', message:'Aborted()...'}`, so `limit:'heap'`
  never fires and `EngineClient` keeps the dead worker: every later query fails — aborting again
  or, run to run, reporting a heap limit from a runtime left with no memory — breaching u3 P3.4
  (M1 review R45). Unreachable from M1's six bounded catalog goals;
  an ad-hoc goal path is what makes it reachable (`.agent/spec.md` `Decisions` MAIN). Accept: an aborted runtime reaches the client
  as its own terminal state that recreates the worker without a caller `reset()`, proven by a
  browser probe whose next query reports 337 documents. `pri` high, gated on an ad-hoc goal path.
- **The judgment Worker runs locally alone** — user ruling deferred the Cloudflare deploy and
  stopped Pages publishing, so free-text intake exists only under `pnpm intake:dev` + Vite's
  proxy. `worker/index.ts` spends one global limiter bucket (`key: 'intake'`), correct for one
  local caller and wrong for a public one. Accept: a deployed Worker answers every W1–W6 case of
  `tests/intake-worker.test.ts` from its own origin, the limiter keys per client
  (`CF-Connecting-IP`), `ALLOWED_ORIGINS` names the published page alone, and the published
  page reaches it under its `connect-src`. `pri` low. **User ruling**: stay local — the deploy stays deferred, and this row stays open and owed to the user. **Background**: the deploy itself
  (account, route, the key as a Worker secret) and a limiter ruling — a per-client key alone
  lets many clients jointly spend the API key, so a public Worker likely needs a per-client
  bucket AND a global spend bucket. Already in place: `ALLOWED_ORIGINS` is a `wrangler.jsonc`
  var, so naming the published page is configuration, not code.
- **A section "yes" selects every pain-compatible unconditional rule of that section** — 95 of
  the 97 derived
  rules the held-out gold does not list are section-triggered (`.claude/rules/proof.md`), so
  derived-rule precision on the 30 held-out cases is 143/240. Accept: an intake change lifts
  precision on `pnpm intake:probe` without lowering recall below 143/163, re-derived through
  `tests/intake-replay.test.ts`. `pri` low. **User ruling**: approved — contract `.agent/contracts/mnt-d63.md`: 22 per-rule Nouls, and ONE billed `pnpm intake:probe` scores policies A and B on the same responses. **Background**: measured offline over the recorded
  judgments, no filter of the shipped selection can meet the check — holding recall at 143/163
  means dropping zero true positives, and 106 of them are section-triggered beside the 95 false
  positives. Section rules only where no condition of that section fired: 67/144 precision, 67/163
  recall; only where no condition fired at all: 51/109, 51/163; condition rules alone: 37/39,
  37/163. A lift therefore needs new per-rule judgment signal — a request change, which the
  user's selection-model ruling governs — and a live billed `pnpm intake:probe` to score it.
  **Measured (the approved ONE billed run, `.agent/contracts/mnt-d63.md`)**: 22 per-rule Nouls
  quoting each unconditional rule's aligned source sentence(s); 36 calls; both policies scored on
  the same responses. A (section AND rule): precision 106/121, recall 106/163, outcomes 26/30.
  B (rule alone): 113/140, 113/163, 28/30. Baseline: 143/240, 143/163, 27/30. Neither holds recall
  ≥ 143/163, so the request change stays off `main` (contract: revert) and the row stays open,
  owed to the user — a second billed run needs the user's approval. Under A every lost true positive is
  section-triggered (37 lost, 0 gained, 82 false positives removed); `rec12:2`–`:4` account for 21
  and `rec05:5` for 6, so the rule question denies the opioid-use-disorder recommendations most.
  Code, replay and report: branch `wt/d63` `cfbe0ad` (never rename).
- **Five coverage passages do not locate on their recorded page** — the owned page viewer
  marks a passage where its page's text holds it (`tests/passage-locate.test.ts`: 319 whole, 13
  continuing, 5 not found). `cdc2022-opioid-rec06` and `rec07` record page 14, yet each passage
  sits whole on page 13, where BOX 3 begins. `rec10-imp10`, `s9-01` and `s9-05` differ from their page's text
  past their first 31–35 characters. Both kinds come from the vendored bag, so the producer
  (`../cnl-ckc`) owns the fix. Accept: each of the five either locates after a re-vendored bag
  corrects its region page or passage, or carries a recorded producer reason, and the census in
  `tests/passage-locate.test.ts` moves with it. `pri` low.

## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| u3 heap limit is unit-tested only | a committed test drives real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate |
| **high** Browser WASM abort leaves a dead session | an aborted runtime reaches the client as its own terminal state that recreates the worker without a caller `reset()`, proven by a browser probe whose next query reports 337 documents |

## Accepted-open

Review rows ruled open rather than fixed. Each carries its acceptance check in
`.agent/archive/review-expedited.md`; none is current scope.

A1 A3 A4 A5 A6 A8 A9+ A10+ A11+ · S7 · C1 C4u1 C4u4 C4u5 C6.

**S9 and S13+ left this set in u12** by user ruling: `binding:check` fails the gate on any red
case in its run, so a tree holding them red can never be gate-green, and xfail, a split suite
or branch-only storage each stop executing the defect. S9's headline now counts entity and
event nodes alone and both locales name what the hidden totals contain; S13+ is refused at
`parseEdge`, where `guideline_arg/4` and `guideline_pp/4` constrain their source to an event —
5,002 constrained edges, 0 violations across the shipped 20,964.
