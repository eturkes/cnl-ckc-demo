# polish register

Off-spine improvements. Each entry carries the acceptance check that closes it.

- **Phased boot telemetry** — replace the single boot spinner with ordered
  progress phases. Accept: each phase emits one accessible status event in
  order, and no percentage is reported that the runtime does not supply.
- **Question deep-links + history** — encode the selected catalog ID in the URL.
  Accept: reload and back/forward restore only a catalog ID, and never start a
  run without an explicit user action.
- **Offline asset caching** — service worker over the hashed runtime assets.
  Accept: a second visit boots with the network offline, and a changed KB input
  hash invalidates every stale PVM asset.
- **Four-query byte differential** — only category-A is byte-proven against its
  committed answer bundle. Accept: a committed script reproduces byte identity
  for all four exported queries, or records the exact canonical-form divergence
  for each of the other three.
- **Finish the u1 wave-1 reports** — `map-m1u1` (17/25 rows) and
  `spike-m1u1-det` (9/12) were stopped at the reserve. Accept: both reports pass
  `validate-report.py` with rc 0, or the open rows are re-derived and their
  findings folded into memory.
- **QLF fallback delivery path** — the fallback needs the 6.2 MB `swipl-bundle`,
  so a naive import would double the shipped engine. Accept: the fallback engine
  loads only when the saved state fails, and a production build that never takes
  the fallback ships no bytes of it.
- **u2 browser smokes** — the roadmap's u2 accept clause names dev server AND
  built output booting to 337 documents; the gate builds both but executes
  neither. Accept: a committed script boots the dev server and the built preview
  in a real browser and reads 337 documents from each.
- **u2 red suite** — `test-m1u2` delivered 4 committed batches on branch
  `wt/test-m1u2` (worktree at the pre-u2 commit, so it never ran). Accept: the
  suite runs in the primary tree, every case is red for a contract reason or
  green, and the cases MAIN's own suite does not already cover are merged.
- **Integral floats decode as integers** — SWI's `1.0` and `1` both arrive as JS
  `1`, so `decodeTerm` reports `integer`. The shipped corpus has no floats.
  Accept: a float binding decodes as `float`, proven on a goal returning `1.0`,
  without adding a per-binding engine call to the common path.
- **Report validator splits on escaped pipes** — `.scratch/validate-report.py`
  `cells()` raw-splits on `|`, so a `\|` inside a finding shifts the evidence
  column. Accept: a finding containing an escaped pipe grades identically to one
  without, and the fix ships with the validator's port into the repo.
- **u3 hard-cancel recovery has no committed test** — `P4.4`/`P4.5` are proven only by
  spike probes on branch `wt/spike-m1u3-js`. Accept: a committed test asserts 337 -> 338
  with a `dynamic/1` overlay, then 337 and absent after `EngineClient.reset()`.
- **u3 heap limit is unit-tested only** — `P2.7` is covered by `readOutcome` over a
  synthesized `resource_error(memory)`, not a live trip. Accept: a committed test drives
  real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate.
- **u3 red suite completion** — `test-m1u3` partially filled its 35-case skeleton,
  committed at `22c8b97` on `wt/test-m1u3`. Accept: the cases MAIN's 31 do not cover run
  in the primary tree, red for a contract reason or green.
- **Browser hard-kill proof** — every terminate/recreate number comes from Node
  `worker_threads`; the product ships browser `Worker.terminate()`. Accept: a browser run
  kills a hostile goal and reports the recreated engine at 337 documents.
- **Forbidden-surface checks are unmechanized** — `P6.2`/`P6.3` hold by construction with
  no gate step. Accept: the gate fails when a main-thread module imports `swipl-wasm` or
  an unbudgeted query entry point is exported.
- **Solution streaming** — u2 delivers one batch per query. Both spikes measured
  streaming as cheap (0.0414 vs 0.0345 ms/query) and useful for early answers.
  Accept: solutions render as they arrive, and a queued cancel still cannot
  interrupt an in-flight synchronous `next()`.
- **u4 red suite** — `test-m1u4` authored a diff-blind suite on branch `wt/test-m1u4`
  from `.agent/contracts/m1u4.md`; MAIN reached the reserve before harvest. Accept: the
  suite runs in the primary tree, every case is red for a contract reason or green, and
  the cases MAIN's 18 do not cover are merged.
- **Full answer-artifact reproduction** — u4 binds the byte claim to the `result/1`
  argument; both spikes also reproduced the whole 734-byte committed file. Accept: the
  service emits the complete `'$guideline_answers'` envelope, or the contract records why
  the bag's `query_sha256` stays out of the runtime.
- **Service query handles** — `EngineClient.query` hides its request id while `cancel`
  needs one, so u5 cannot build cooperative cancel on `AnswerService.ask` as shipped.
  Accept: a run started through the service is cancellable by id without exposing an
  unbudgeted surface.
- **Assembled-path evasion** — the answer-oracle scan matches a literal `queries/answers`;
  a path concatenated at runtime slips past. Accept: a production fixture that assembles
  the path from parts fails `kb:asset-check`.
