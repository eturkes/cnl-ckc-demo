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
- **Solution streaming** — u2 delivers one batch per query. Both spikes measured
  streaming as cheap (0.0414 vs 0.0345 ms/query) and useful for early answers.
  Accept: solutions render as they arrive, and a queued cancel still cannot
  interrupt an in-flight synchronous `next()`. `pri` low. **User ruling**: approved; visual unit: before/after captures at 320 and 1280 px in both locales plus `pnpm visual-qa`, reviewed by the user after the commit. **Background**: rendering each
  solution as it arrives changes the accepted answer panel during a run — a visible change the
  spec reserves. The cost on the engine side is a `solutions` progress response per answer
  (joining the d37 clone table), and each partial answer still renders only once its own
  display passes the request deadline.
- **Browser WASM abort leaves a dead session** — a runaway `assertz` aborts the WASM runtime
  — in Node too at swipl-wasm 8.0.7, pinned live by `tests/engine-heap.test.ts`, which is the
  fix's red witness — and surfaces as `{code:'prolog', message:'Aborted()...'}`, so `limit:'heap'`
  never fires and `EngineClient` keeps the dead worker: every later query fails — aborting again
  or, run to run, reporting a heap limit from a runtime left with no memory — breaching u3 P3.4
  (M1 review R45). Unreachable from M1's six bounded catalog goals;
  an ad-hoc goal path is what makes it reachable (`.agent/spec.md` `Decisions` MAIN). Accept: an aborted runtime reaches the client
  as its own terminal state that recreates the worker without a caller `reset()`, proven by a
  browser probe whose next query reports 337 documents. `pri` high, gated on an ad-hoc goal path.
- **Comments carry provenance and restate purpose** — ten file headers say what their module
  is rather than why it is peculiar, and eight comment sites cite review rows instead of
  stating a timeless constraint (M1 review X20); this session's own new headers are in
  scope. Accept: the ten what-only headers are gone, the eight provenance sites read as
  current constraints with no row or history reference, and the adjacent why comments
  survive byte-for-byte. `pri` low. **Eight of ten headers and all eight sites done. User ruling: unfreeze the last two in T9
  and delete their header lines. Background**: `src/questions/serialize.ts` and `humanize.ts` are byte-frozen
  against `22053ef` by `tests/clinical-records.test.ts` T9, an answer-path frozen surface, so
  deleting either header line is a grader change — unfreeze them, or let the headers stand.
- **Owned PDF viewer** — M2 u7 ships a native `<iframe>` at `#page=N`, so the viewer is a
  black box: no assertion can read the displayed page, and the passage cannot be
  highlighted inside the PDF. PDF.js was rejected on cost — +504727 B gzip, 34.78 MB
  unpacked, and an engine range that excluded the Node 20 then pinned. Accept: an owned viewer
  renders the coverage row's physical page, a browser check reads the rendered page number
  and the highlighted region from the DOM, `pnpm gate` still runs under the pinned runtime, and the
  viewer's bytes load only after the user activates the page. `pri` low. **User ruling**: approved — PDF.js, lazy, +504,727 B gzip; visual unit: before/after captures at 320 and 1280 px in both locales plus `pnpm visual-qa`, reviewed by the user after the commit. **Background**: an
  owned viewer replaces the accepted ladder's native `<iframe>`, a visible change the spec
  reserves, and PDF.js — the one measured renderer — costs +504,727 B gzip. Node 24 has lifted
  the engine-range objection; the size and the visual change remain the user's call.
- **Corpus-wide provenance browser** — the M2 ladder resolves the SELECTED solution alone,
  so the other 336 documents' coverage rows, regions and alignment are reachable only by
  asking a question that reaches them. Accept: a document-first view lists every document's
  coverage rows and opens each one's passage and page through the same resolver the ladder
  uses, adding no eager asset fetch to the answer path. `pri` low. **User ruling**: approved — a third view in the explore area beside the graph and its list fallback; visual unit: before/after captures at 320 and 1280 px in both locales plus `pnpm visual-qa`, reviewed by the user after the commit. **Background**: a
  document-first view is a new surface beside the accepted answer panel, ladder and graph, and
  its entry point changes the accepted page layout — where it lives and how it is reached is
  the user's call.
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
- **Inline-disable reasons have no grader** — `.claude/rules/gate.md`'s `lint` bullet says every
  remaining security exception is one inline disable carrying its reason; `pnpm lint` passes
  whether or not a reason is there, so the registry row reads it by hand. Three non-security
  disables carry none (`tools/clinical-reference.mjs:227,234`, `tools/kb/provenance.mjs:70`,
  the last byte-frozen by T9). Accept: a committed check (an ESLint directive-description rule
  or a scan in the gate) refuses an `eslint-disable` with no stated reason, with its firing
  input, and the frozen file's directive handled by ruling. `pri` low. **User ruling**: unfreeze `tools/kb/provenance.mjs` in T9 so line 70's directive gains its reason, then ship the grader. **Background**: the two
  `tools/clinical-reference.mjs` directives now carry their reason; the third,
  `tools/kb/provenance.mjs:70`, sits in a file T9 freezes against `22053ef`, so a gate check would
  either exempt it by name or need the file unfrozen.
- **A decoded dict re-encodes without its tag** — `createEncoder` turns `tag{a:0}` into a plain
  object whose `$tag` key the wrapper reads as an ordinary dict key, leaving the real tag
  unbound: `_{'$tag':tag,a:0}` is no variant of `tag{a:0}`, alone or as a list tail (reviewer-il-1
  register R1, `a9bf242` body). No shipped answer term carries a dict.
  Accept: a decoded dict re-encodes as a structural variant — standalone and as an improper-list
  tail — graded by Prolog `=@=` in `tests/engine-term-identity.test.ts`. `pri` low. **User ruling**: `createEncoder` refuses a dict and fails closed. **Background**: swipl-wasm 8.0.7 has no supported way to re-enter a TAGGED dict. `toProlog` sets a
  dict tag only when `data.constructor.name !== 'Object'`, but that check sits inside the
  `case "Object"` arm; an instance of a class named after the tag falls to the `default` arm and
  enters as a `<js>(N,tag)` blob (measured). Only a `constructor` getter answering `Object` on
  the first read and the tag on the second gets through (closing review D-2), which leans on the
  wrapper's read order. Choices: `createEncoder`
  refuses a dict, failing closed instead of re-entering it untagged, or an upstream patch.
- **A failed reset keeps its replacement worker** — a heap recreation boots its replacement
  under the boot deadline, but an explicit or wall-clock `EngineClient.reset()` boots it
  unbounded, and a replacement that answers its boot with an error (a contract mismatch, a
  rejected image fetch) stays live, unlike `boot()`, which retires a failed worker so the next
  request rebuilds (closing review A3). Two graded cases pin that: `tests/engine-recovery.test.ts`
  P4.4 asserts the failed replacement stays (`spawned[1]?.terminated === false`), and
  `tests/engine-budgets.test.ts` P1.1 asserts no timer stays armed after a consult deadline
  (`armed.size` 0), which a bounded replacement boot breaks. Accept: every reset boots under the
  boot deadline and retires a failed replacement, the next request spawns a fresh worker, and
  P4.4's and P1.1's last assertions change by the user's approval with their original firing
  recorded. `pri` low. **User ruling**: approved — change both assertions.
- **Condition-supports dedup is scope-blind** — `tools/kb/graph.mjs` keys the synthesized
  `condition supports` shortcut on document, sentence, source event and head alone. 17 body
  events inside a negation therefore merge their shortcut into a twin from another world. The
  body-relation dedup keys on scope since mnt-d49. Keying this one too emits the 17 (edges
  20,980 → 20,997), and every one has endpoint scopes that contradict: 38 → 55 contradicting
  shortcuts, none of the 17 justified by `tests/graph-shortcut-justification.test.ts`.
  Accept: either the dedup keys on scope and the justification suite justifies all 55 by their
  own clauses, with the moved counts recorded; or a committed check proves each merged negated
  support has an unnegated twin support in its own sentence. `pri` low.
- **Selected-row proof case trips `limit` under contention** — `tests/proof-live.test.ts`
  `binds the selected canonical row rather than returning the first proof` proves under the real
  clock. With the run and 24 busy loops pinned to one CPU (`taskset -c 0`) it fails
  `expected 'limit' to be 'proof'` while the cap-one cases beside it pass. It asserts
  `result.kind` alone, so the subtype is lost. Accept: the case asserts the whole result, so a
  trip names its `limit` subtype, and it passes under that same pinned contention. `pri` med.
- **B9 times cached proofs** — `tests/clinical-proof-live.test.ts` B9 claims every selected
  proof settles inside `PROOF_BUDGET_MAX` (`.agent/contracts/m5u4.md` B9, live timing over all
  12), but B2 proves the same 12 selections first in the same session, and the per-session proof
  cache (`src/engine/session.ts` `prove`, `a067cdc`) answers B9 before the meta-interpreter runs.
  B9 therefore times 12 cache hits. Accept: a whole-file run proves B9 reaches the
  meta-interpreter for every measured selection before it reads the elapsed time. `pri` med.

## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| u3 heap limit is unit-tested only | a committed test drives real heap exhaustion and reads `limit: 'heap'` without adding 19 s to the gate |
| **high** Browser WASM abort leaves a dead session | an aborted runtime reaches the client as its own terminal state that recreates the worker without a caller `reset()`, proven by a browser probe whose next query reports 337 documents |
| Selected-row proof case trips `limit` under contention | the case asserts the whole result, so a trip names its `limit` subtype, and it passes under that same pinned contention |
| B9 times cached proofs | a whole-file run proves B9 reaches the meta-interpreter for every measured selection before it reads the elapsed time |

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
