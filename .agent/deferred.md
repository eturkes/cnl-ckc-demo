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
- **The engine session interleaves concurrent requests** — `EngineSession.handle` admits a second
  query while the first's frame is open, and the second resolves outside the KB (`catch/3: Unknown
  procedure: system:guideline_document/4`); until n35 that read as an empty answer. Every caller
  serializes today — the demo controller's one engine queue carries the chat's goals too — so no
  shipped path sends two at once. Accept: two `handle` queries started together on one session
  each answer their own goal over the KB (E27 as first written: `Promise.all` of `true.` and
  `guideline_document(D,_,_,_).`, neither an error), or a request arriving while another is open
  is refused by name before it runs. `pri` low.
- **The chat guide names `guideline_document/4`'s digests as prose** — `server/chat-guide.md:79`
  lists `guideline_document(Doc, Ace, Ulex, Vocabulary)`, yet the bag's second, third and fourth
  arguments are digests (`ace_sha256('41f6…')`, `ulex(sha256(…))`; bag
  `cdc2022-opioid-rec12-imp08.pl:47`), so the model may query `Ace` for a statement's wording and
  quote a hash as a KB part. Found by builder-8 in n30; the prototype's draft
  `prototype/scope-guards/app/chat-guide.md` corrects it. Accept: the guide names the three
  arguments as the digests they are and points statement wording at the `% S<n>:` sentence the
  provenance asset carries, and a recorded-turn test (`tests/chat-server.test.ts` or the page's
  recorded-turn suite) holds a KB part about a statement's wording that shows sentence text, never
  a digest. `pri` high.
- **Most contract predicates still lack a shrinking property test** — `CLAUDE.md` `Engineering`
  gives each contract predicate over its input domain (invariant, round trip, reference oracle,
  metamorphic relation) a property-based test under a seed the gate fixes. fast-check and
  `tests/support/property.ts` (`holds`, the seed fixed) carry the step ledger's
  (`tests/gate-ledger.test.ts` P1–P4) alone. Two suites hand-roll generation that cannot shrink a
  counterexample — `tests/marks-view.test.ts` M9 over 128 fixed seeds, the exhaustive data
  replacement of `tests/engine-readonly-guard.test.ts` G10 — and the rest pin their predicates by
  examples: the term decoder (`src/engine/terms.ts`, `tests/engine-u2-port.test.ts`), the
  read-only guard's default deny (`src/engine/readonly.ts`), the claims seed's hash-keyed merge
  (`tools/claims-sweep.mjs`) and the reader-relative `scopeReading` (`src/graph/view.ts`).
  Accept: each predicate named here holds as a property test through `holds`, derived from its
  contract and seen red on a planted wrong implementation; M9 and G10 keep their cases beside
  it; every shrunk counterexample stays as an example case. `pri` med.
- **No reader of untrusted or byte-level input has a coverage-guided fuzz target** —
  `CLAUDE.md` `Engineering` gives such code a fuzz target beside its property test, the gate
  replaying the committed seed corpus and every crash input, the campaigns in the campaign tier
  (`.claude/rules/gate.md`). Five readers carry none: the read-only guard over model-written goals
  (`src/engine/readonly.ts`), the chat bridge's request bodies and `codex app-server` lines
  (`server/chat.mjs`), and the release intake's SSHSIG parser (`tools/kb/sshsig.mjs`), archive
  reader (`tools/kb/bag.mjs`) and sidecar and provenance parsers (`tools/kb/release.mjs`).
  Accept: each reader has a coverage-guided fuzz target, its tool chosen by research, that reuses
  the property harness of the row above and finds a planted crash; `binding:check` replays its
  committed seed corpus and every crash input as pinned examples; a time-boxed campaign over each
  runs in the campaign tier. `pri` med.
- **The live-engine suites time out inside the load envelope** — `pnpm gate:fast` on the refresh
  tree ran the whole suite (its `package.json` change reaches every test) beside another
  project's mutation campaign and went red: 12 cases in 5 files (`clinical-answer-live` A2/A3,
  `clinical-inference` P4 at its 120 s timeout and P6, `engine-u2-port` P3.8 timed out with six
  later cases of that file failing on assertions — inferred to follow its session —,
  `kb-derived-assets`, `legacy-export-lane` D3/D4), 1-min load 13.18 and 5-min 14.22 at its end.
  The same five files alone, tree unchanged, passed 50/50 at load 10.29. The refresh's first
  `pnpm gate` then went red the same way in `binding:check`: `engine-budgets` P2.2 timed out at
  6450 ms with 18 later cases of that file failing, and `clinical-answer-live` A2/A3, at 1-min
  load 4.26 → 10.23 across the run; both files alone, tree unchanged, passed 46/46 at load 8.04.
  Each a flake inside the ≤ 2.9× cores envelope (`.claude/rules/gate.md`), which was measured
  over 1014 tests where the suite now runs 1823. Accept: one cause found by a discriminating
  experiment — the envelope re-measured on the current bag by consecutive full runs at recorded
  load, or the cases made to pass at equal strength inside it — and the envelope paragraph's
  figures re-derived from that record. `pri` med.
## Index — one line per `high` + `med` row

Generated by `pnpm queue:index` from the rows above — each title beside its acceptance check's
first sentence; `claims:check` refuses a stale index. The `low` rows are prose only.

| defect | accept |
| --- | --- |
| **high** The chat guide names `guideline_document/4`'s digests as prose | the guide names the three arguments as the digests they are and points statement wording at the `% S<n>:` sentence the provenance asset carries, and a recorded-turn test (`tests/chat-server.test.ts` or the page's recorded-turn suite) holds a KB part about a statement's wording that shows sentence text, never a digest |
| Most contract predicates still lack a shrinking property test | each predicate named here holds as a property test through `holds`, derived from its contract and seen red on a planted wrong implementation; M9 and G10 keep their cases beside it; every shrunk counterexample stays as an example case |
| No reader of untrusted or byte-level input has a coverage-guided fuzz target | each reader has a coverage-guided fuzz target, its tool chosen by research, that reuses the property harness of the row above and finds a planted crash; `binding:check` replays its committed seed corpus and every crash input as pinned examples; a time-boxed campaign over each runs in the campaign tier |
| The live-engine suites time out inside the load envelope | one cause found by a discriminating experiment — the envelope re-measured on the current bag by consecutive full runs at recorded load, or the cases made to pass at equal strength inside it — and the envelope paragraph's figures re-derived from that record |

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
