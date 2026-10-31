# Closed MAINTAIN requests — retired `Tasks` rows

Retired record: the rows each closed MAINTAIN request left in `.agent/spec.md` `Tasks`, and the
`Phase` history. Live successors: `.agent/spec.md`, `.agent/deferred.md`, the contracts each row
names.

## Tasks

Closed MAINTAIN request: work every `.agent/deferred.md` row in rank order (6 rows at
`d3c4bc5`), paused at `e9ffcb7`, resumed at `bd320a6`. Met when: every row closed by its
own acceptance check in its own commit, recorded blocked on the user with what it owes, or
waiting on its re-open trigger, and `pnpm gate` green on a clean tree at the closing commit.

- [x] `0727bd2` m1 `med` copy:check reads both quote forms.
  - Accept: a double-quoted `en.ts` value over the word limit and a double-quoted `ja.ts` value
    ending in plain form are each refused by key.
- [x] `a98b2c9` m2 `med` check inventory: every gate step, lane and suite with its firing record.
  - Accept: `.agent/contracts/mnt5-inventory.md` graded by `tests/inventory.test.ts`; owed
    (user): the accepted-open re-ruling.
- [x] `7e31bc2` m3 `low` `tests/spec-check.test.ts` holds on any real spec.
- [x] `a5419e3` m4 `low` a compound named `functor` decodes; the three G1 refusal cases change (user-approved).
- [x] `5f8e3dd` m5 `low` one reader-relative `Decisions` bullet, in the text the user approved.
- [x] `b36a568` m7 `med` `chat:live` gains a firing input that calls no model (new row).
- [x] `84b0478` m9 `low` the axe-contrast pin fires in an environment that decides contrast (new row).
- [x] `f2f1bb5` m10 `low` a compound named `$t` decodes and is refused re-entry by name (new row).
- [x] `6d45194` m11 `low` `Intent` states the shipped chat beside the built-in drop-down (refresh row).
- [x] `2c76c7b` m12 `low` a default-operator mutation tool runs over a base-green suite's imports (refresh row).
- [x] `d4f6a1e` m16 `low` the exporter's five shape guards each refuse a planted malformed query (new row,
  found by m12).
- [x] `b44d709` m17 `med` the accepted-open re-ruling lands — all fifteen ids stay open (user ruling) — and
  the m2 queue row closes.
- [x] `53105de` m18 `med` `bridge.close()` awaits every child it spawned, a retired one included (new row, found by
  m17's gate); its test race `e373681`.
- [x] `ac8c4a8` m21 `low` a zero-arity compound is refused re-entry by name (review register J1).
- [x] `8a56ec3` Close: `mnt5-reviewer-3` (reviewer) 12/12 rows over `b6b455a` — 7 pass; F1 (major) fixed over two
  rounds (`8c1f3e1`, `8a56ec3`), F2 (major), F3 and F5 (minor) fixed in `8c1f3e1`, re-review pass; F4
  (major) queued as m19, a change to m2's grading check owed to the user; register: the first
  compound arm (m20, owed), J1 → m21 `ac8c4a8`. At `ac8c4a8`: `pnpm release:check` rc 0, `pnpm
  mutate` 125/125; rules upkeep `b6b455a`.

Closed MAINTAIN request: chat intake replaces the TypeSafe intake (`Decisions` User, plan
`.agent/contracts/chat-plan.md`). Met when: delivered end to end + `pnpm gate` green on a clean
tree at the closing commit.

- [x] `95c3495` c1 `kernel` guarded read-only query: `query(…, {readonly:true})`, JS allowlist over the
  decoded parse, canonical re-render, `EngineErrorCode` `'guard'`.
  - Accept: refuses the atom-doubling chain, `assertz`, a module-qualified goal, a variable goal
    and `call/2`; admits every `clinical_*` entry point; contract + diff-blind `tester` suite RED
    before code.
- [x] `ecca9dd` c2 `kernel` q1 + q2: an aborted runtime recreates the worker; R45 moves (approved).
  - Accept: the q1 row's own check (browser probe, next query reports 337 documents) + q2's
    `limit: 'heap'` read; R45's original firing recorded in the contract.
- [x] `0c3174d` c3 `kernel` `server/chat.mjs`: persistent `codex app-server` bridge, NDJSON turns, tool
  relay, Origin/Host allowlist, graded against a fake app-server.
- [x] `f30b351` c4 `kernel` browser chat: client, controller on the engine queue, provenance resolver
  (kb/web/unverified), capped tool-result text, binding row for the KB card.
- [x] `d31f758` c5 visual: ChatPanel replaces IntakePanel above the drop-down, both locales, dom tests,
  visual-qa states; user live review owed.
- [x] `d31f758` c6 retire the TypeSafe intake (approved deletion set, `chat-plan.md` `User rulings`).
- [x] `2f781a2` c7 live `pnpm chat:probe` + `pnpm chat:live`: reported, never gated.
- [x] `e88a9db` c8 README, rules, `Artifacts`, claims registry, census.
- [x] `8f5faf2` Close: check set `.agent/contracts/chat-close.md`; `chat-close-product`,
  `chat-close-gate`, `chat-close-records` (reviewer) 9/9 rows + security (MAIN) — P3 fail(med),
  R1 fail(low) → fixed, KB read on every path (user ruling); release:check + mutate 48/48 green.

MAINTAIN request: work every `.agent/deferred.md` row in rank order (5 rows at `f855bb5`). A row
needing the user records its part owed; new finds become rows funded after those five.

- [x] `ecca9dd` q1 `high` Browser WASM abort — closed by c2: R45's next query answers on a recreated worker.
- [x] `ecca9dd` q2 `med` u3 heap limit — closed by c2: `tests/engine-heap.test.ts` reads `limit: 'heap'`
  on the real trip.
- [x] `d31f758` q3 `low` judgment Worker — retired with the TypeSafe intake (approved deletion set): no Worker is left to deploy.
- [x] `005903a` q4 `low` coverage passages: a lone bullet item leaves the locate fold → 3 of 5
  locate; ruled (user): a behavioral fix, no live review owed; `rec06` + `rec07` stay queued,
  owed to the producer (page 14 recorded, page 13 holds them).
- [x] `d052941` q5 `low` approved (user): on a `Tasks` block holding no ticked row,
  spec:check's SHA control plants one before the pointer and strips it.
- [x] `74fc9d9` q6 find `low` approved (user): on a `Tasks` block holding no open row,
  spec:check's open-unit controls plant one before the pointer and break it.
- [x] `d7f7e1b` Close: check set `.agent/contracts/mnt4-close.md`; `mnt4-reviewer-1` (reviewer)
  7/7 pass; release:check + mutate 47/47 + binding:replay green.

Closed MAINTAIN request: run the demo on the Rust/Verus `../cnl-ckc` (upstream `2acd0d70`) — re-vendor
the bag `ckc dist build` writes, and move every parser, rule and record that named the retired
Python toolchain.

- [x] `9cf5680` u1 `data` re-vendored bag `cnl-ckc-kb-gde2a9b061325`; the coverage parser admits
  `uncovered(inexpressible: …)`; `kb-build.md` regeneration recipe + port specs name `ckc`.
  - Accept: `pnpm gate` green on the new bag; `tests/kb-derived-assets.test.ts` grades all seven
    declared uncovered classes + one refused class, RED at base on `inexpressible`; T9 takes
    the regex as one declared edit of `22053ef` (user ruling).
- [x] `5539905` Close: check set `.agent/contracts/mnt3-close.md`; `mnt3-reviewer-1` (reviewer) 6/6 — A2 fail(low) → delta restated, r2 residue folded in + line-classified; release:check + mutate 47/47 + binding:replay green.

Closed queue run (`dN` = the row's ordinal in the queue at `24bbb5d`):

- [x] `9ade964` `med` Cap-one re-proof: a pinned-contention trip names `limit: 'wall-clock'`; the case proves under a frozen clock.
- [x] `64fb0cc` `med` CI registry receipt: the registry row lists every `run:` + `uses:` step of `ci.yml`.
- [x] `24bbb5d` d0 find: 4 live advisories reddened `audit:check` → lockfile bump.
- [x] `b919283` d2 browser lanes steer by `data-action` handles, narrow sweep in both locales.
- [x] `6c77126` d4 `pnpm readme:check`: README setup path from a clean clone, in `release:check`.
- [x] `b6f2a54` d7 `claims:seed` keys on a full-claim digest; `claims:check` refuses a stale digest.
- [x] `bbb4f24` d10 QLF fallback under the user's transfer reading: a failed saved state boots `swipl-bundle` + `kb.qlf`; a sound session fetches neither, precache included.
- [x] `5af7982` d13 `tools/validate-report.mjs`: committed port, escaped pipe = content.
- [x] `060c0f7` d18 u4 suite ported: 4 merged green, 3 covered, 1 input retired (P1.10 held by T13).
- [x] `e78551f` d16 `browser:check` kills a hostile goal by the client deadline; one respawn reports 337 documents.
- [x] `07899e0` d19 closed on its own check: archived `m1u4.md` D6 records why `query_sha256` stays out of the runtime; the export lane re-derives the whole envelope.
- [x] `88af76b` d21 a failed boot retires its own worker, so Retry rebuilds the engine.
- [x] `34e791b` d23 V13 axe sweep: About panel + canonical answer, open and closed.
- [x] `3f76af8` d24 `copy:check` walks `src/` and grades every component's literal prose.
- [x] `0465faa` d25 the inference budget bounds the whole request (`meteredGoal`, terminal record, display after close).
- [x] `9d1eecb` d26 smoke refuses a build stale against the bag's input digest.
- [x] `8fc8173` d11 u2 suite ported: 16 merged green, 20 covered, 2 red → rows (d12 float, new find improper-list tail).
- [x] `4dc9179` d45 20 consecutive full-suite runs passed 1014/1014 each (load 4.6–23.5).
- [x] `0273a6a` d27 `pnpm mutate`: committed 45-mutant table + runner, 45/45 killed.
- [x] `34d9d7e` d36 `kb/generated` joins the answer-oracle scan, with its own firing input.
- [x] `da39355` d31 a hung boot settles one typed `boot` error after one recreate; row text corrected from `worker` (d56 clause).
- [x] `69e7110` d37 every protocol discriminant (5 request + 9 response = 14) clones; per-row non-cloneable mutant refused.
- [x] `ec37224` d30 `pnpm test:browser`: the nine jsdom-stubbed combobox predicates in real Chromium.
- [x] `f380d61` d32 `copy:check` `INTERNAL_ID` refuses a catalog string naming a milestone, unit or review id; the dead `descriptor` cell + `describeDescriptor` are gone.
- [x] `f40ce36` d40 `pnpm engine:probe` grades R38/R39/R41/R42/R45; the `res-m1-*` claims are ported (JSON corruption, stack flag, direct eval, axe contrast, engine split in smoke), covered, or pruned.
- [x] `524dad6` d44 `tests/census.test.ts` grades every stable census the rules state against its derivation.
- [x] `1193641` d46 smoke + browser:check each refuse a mutation their own lane runs (pvm-stripped copy, renamed woff2).
- [x] `3032246` d48 every shipped bound names an owner in the rules; the 60-relation cap surfaces its truncation.
- [x] `85e51fc` d49 the 71 orphan contexts record their body literals; the body-relation dedup keys on scope (+16 edges); `MEANING` O1–O4 prove none is shown through another world.
- [x] `fce2f9b` d50 retired by user ruling: the shipped graders cover the projection; `wt/orc-proj` `1a893b1` stays as evidence.
- [x] `0e1e5e0` d51 each of the 38 contradicting shortcuts is justified by its own clause (`tests/graph-shortcut-justification.test.ts`).
- [x] `ebf066e` d52 `graph:check` binds each spanning reading to its edge by id, both directions; the fallback list can expand to every incident relation.
- [x] `d07faac` d53 each `kb:asset-check` root table refuses an emptied table by its own name.
- [x] `e9465b9` d54 every `deferred` registry row cites a live queue row; `claims:check` refuses an uncited or dangling one (7 rows added).
- [x] `9b793fd` d1 the Japanese face ships as a catalog-exact subset (2,654,740 B → 193,444 B), raster-identical to the original.
- [x] `906d069` d3 `copy:check` grades Japanese register J1–J4 (`mnt-d3.md`, approved); 3 copy edits.
- [x] `d6714d7` d5 approved (user): phased boot status replaces the status line's boot text — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `3f99fd1` d6 the URL carries the selected catalog id; reload and back/forward select it and never run.
- [x] `424b394` d8 a service worker precaches the boot set; a second visit boots offline; a renamed PVM evicts the stale cache.
- [x] `6e558cd` d9 both u1 wave-1 reports validate (25/25, 12/12), re-derived at today's tree; new row: halting payload reports `[object Object]`.
- [x] `114ad49` d12 ruled (user): leave as is — close as a declared limit, records only.
- [x] `91d22b7` d15 u3 port merged (8 green); its P3.3 case caught `0465faa`'s unbounded display → the deadline bounds every answer and proof display.
- [x] `768742e` d20 `kb:asset-check` refuses an oracle path assembled from its two bare segments.
- [x] `1dc006f` d22 `pnpm visual-qa`: 39 states at 320/375/1280 px, none overflows, planted-overflow control.
- [x] `2b4a2b6` d28 the source-label grammar is stated in `.claude/rules/ui.md` `Copy`; the humanizer test cites it.
- [x] `04ada8c` d17 approved (user): solutions render as they arrive — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `03a0184` d33 `copy:check` grades a keyed literal once, under its key (378 → 251 graded strings).
- [x] `0cdaa0f` d38 `withBuiltSite` (`tools/browser.mjs`) owns build, serve, launch and teardown for smoke, browser:check and visual-qa.
- [x] `337aeba` d39 ruled (user): unfreeze the `serialize.ts` + `humanize.ts` header lines in T9 and delete them (the other 8 headers + 8 sites done).
- [x] `7f7a2aa` d34 m1u5 matrix 26/26: 19 covered, 6 ported green (`tests/m1u5-port.dom.test.ts`), 1 superseded, 0 red.
- [x] `9056d3d` d41 approved (user): an owned lazy PDF.js viewer replaces the ladder's iframe (+504,727 B gzip) — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `a067cdc` d42 session proof cache: re-selection runs no meta-interpreter call; solve/consult/poison invalidate.
- [x] `db0736f` d43 approved (user): the document-first provenance browser = a third view beside the graph and its list fallback — visual unit, captures + `visual-qa`; the user's live review is owed (`.claude/rules/ui.md` `User review`).
- [x] `bdd2ae4` d47 `pnpm queue:index` derives the queue index; `claims:check` refuses a stale one by line.
- [x] `2089c73` d35 m1u7 matrix 34/34: 16 covered, 13 ported green (`tests/m1u7-port{,.dom}.test.ts`), 5 superseded, 0 red.
- [x] `737c6d6` d55 u13's firing record names base `3c4c17c` (reproduced there: rc 1, same assertion); the phrasing census is gone from the tree.
- [x] `e0c4f1b` d56 both rows graded on their own checks: `Boot-error recovery` by `88af76b` (d21), `Boot carries no deadline` by `da39355` (d31, text corrected to `boot`).
- [x] `50b580f` d57 the `lint` bullet names `advice.ts`'s config exception and why it cannot be inline; R073 adjudicated afresh (deferred to a new grader row).
- [x] `05df8e9` d58 a registry cell may hold `\|`; claims:check re-seeds a piped copy and requires it back byte-identical.
- [x] `da89fd6` d59 `spec:check` in the gate: open rows `- [ ]`, ticked rows carry SHAs, pointer last.
- [x] `c73a1f2` d60 `--verdict` admits the reviewer role's vocabulary; waves.md names the brief's one vocabulary.
- [x] `75e6073` d62 the selector suite plants the fixed-trigger mutant in memory and requires ORACLE-S to catch it.
- [x] `9d11b44` d63 ruled (user): declared limit — `proof.md` `Free-text intake selects` states it and `tests/census.test.ts` grades its figures; the one billed run scored A 106/121 · 106/163 and B 113/140 · 113/163 against 143/240 · 143/163 (evidence `wt/d63` `cfbe0ad`).
- [x] `4c37c0a` find: engine timing figures reworded to the bounds they guarantee, browser figures cited to `engine:probe`.
- [x] `65d9afb` find: `copy:check` refuses a component joining catalog fragments outside the declared pairs.
- [x] `bb27a1a` find: a dom test fails the proof request and reads `TEXT.traceFailure` in both locales.
- [x] `ee8c3c0` find: the wall-clock absence and `Query.close()` facts re-derived by tests.
- [x] `84a55cd` find: clause identity and the three probe traps pinned by `tests/proof-identity.test.ts`.
- [x] `5143f3e` find: the remaining package byte figures (literata spread, latin faces) pinned by the census; "eight" faces corrected to six.
- [x] `a9bf242` find: improper lists re-encode with falsy tails intact and long lists iteratively.
- [x] `5da1e02` find: hand-run mutants and probes — two committed (listbox mutant, skipped-case control), one test (TS peer cap), three historical.
- [x] `a4795fe` find: upstream and design claims disposed; `copy:check` refuses a component literal beyond the brand mark.
- [x] `d533775` find: a halting payload's build refusal names the halt and its exit.
- [x] `8a8a21e` find (dict re-encoding) ruled (user): `createEncoder` refuses a dict and fails closed.
- [x] `f862574` find (inline-disable reasons) ruled (user): unfreeze `tools/kb/provenance.mjs` in T9, give line 70 its reason, ship the grader.
- [x] `5bc686e` find (heavy-load timeouts) closed by user ruling: the measured 2.9× envelope (20/20 runs at load ≤23.5) is the bar.
- [x] `935b287` find (failed reset) approved (user): change P4.4 (`engine-recovery`) + P1.1 (`engine-budgets`); every reset boots under the deadline and retires a failed replacement.
- [x] `ce75b11` find (condition-supports dedup is scope-blind): arm 2 — every fold hiding a negation keeps a twin its own clause states unnegated.
- [x] `5fd1588` find (selected-row proof case trips `limit` under contention): frozen clock + whole-result assertion.
- [x] `d2744cb` find (B9 times cached proofs): B9 empties the cache and requires a meta-interpreter run per timed proof.
- [x] `995e333` find (bundled JavaScript ships without its licence notices): `dist/licenses/third-party.txt` + the build refuses a bundled package missing from it.
- [x] `e8f7cab` find (engine:probe R41 control): a run ends at its final record; the control fires again.
- [x] `06e1d24` Close-2: check set `.agent/contracts/mnt2-close.md`; `mnt2-reviewer-9`–`-11` (reviewer) 11/11 rows — 7 pass, C3 D1 D2 fail(low) → fixed, `mnt2-reviewer-12` r2 3/3 pass; release:check + mutate 46/46 (+ C3 1/1) + binding:replay green.
- [x] `aefae8c` find: a refactor staled mutant R09's anchor with the gate green → `tests/mutant-anchors.test.ts` grades every anchor in the gate.
- [x] `8c186d2` find: a heap recreation that joined an in-flight reset waited on its unbounded boot → it arms its own boot deadline.
- [x] `28c37bc` Close: 4 lenses × 2 reviewers, round-2 re-review all pass; 46/46 mutants killed under the exit-1 rule.

## Sync to upstream `83569b1d` (request: "Pull the latest ../cnl-ckc and update cnl-ckc-demo accordingly")

- [x] `c511755` sync-u1 `kernel`: bag `g8a51bf0c8722` vendored, the 19-indicator schema and
  `schema.pl` loaded, the clinical grammar's two new forms, six exports, the guard + chat guide on
  the new schema, every corpus figure re-pinned (user rulings: scope, T9 edits, re-pins, E27 scan,
  guard widening, nested-operator MEANING case).
- [x] `e73ed6c` sync-u2 `kernel`: the graph projects grades, preferences, qualifiers, time limits
  and comparison thresholds; contract `.agent/contracts/sync-u2.md`, reviewed before code by
  consultant-1 (direction right, ten rows changed, all adopted).
- [x] `38ce061` sync-close: reviewer-10 over `.agent/contracts/sync-close.md` C1–C8 — 5 pass,
  F1 (major, range-pairing guard) + F2–F5 fixed or recorded; release lanes green on `e73ed6c`.

## ITERATE — answer panel: grades, qualifiers and thresholds

- [x] `18e62f4` r0: `prototype/answer-annotations/`, a copy of the shipped page whose answer panel
  reads grade, qualifier and interval heads through live read-only goals; three variants.
- [x] `7513577` r1 + r2 (user rulings): variant A, source grade labels, preferences, thresholds =
  time bounds; `Qualifier:` first, grade once per document run.
- [x] r3 = the user's go; closing review L1–L4 + `Phase: IMPLEMENT` in the commit after
  `7513577`.

## IMPLEMENT — answer panel: grades, qualifiers and thresholds

- [x] `69f2dae` ann-u1 `kernel`: the marks goal — `clinical_marks/3` over one per-sentence
  derivation shared with the answer, catalog v4 `marksGoal`, `AnswerService.marks`,
  `src/questions/marks.ts`, the controller's marks state; contract `.agent/contracts/ann-u1.md`,
  reviewed before code by consultant-2.
- [x] `f806b80` ann-u2 `kernel`: a qualifier leaves the verb slot — `action/5`, the parser lift,
  three build refusals, every rendered answer byte-identical; contract
  `.agent/contracts/ann-u2.md`, reviewed before code by consultant-3.
- [x] `35d2c9c` ann-u3 `kernel`: the facts rows, the notice, the goal disclosure, en + ja
  copy; contract `.agent/contracts/ann-u3.md`, reviewed late by consultant-4; `ee2a52b` fixed
  the narrow-width label wrap operator-1 found.
- [x] `f858a15` ann-u4 `docs`: README, prototype retired under tag
  `prototype-answer-annotations`.
- [x] `99aef83` ann-review: 16/16 rows against `.agent/contracts/ann-review.md`, none open
  (`.agent/review.md` `## ann close`).
- [x] ann-close = the commit after `99aef83`: release lanes green, `Phase` back to MAINTAIN.

## Queue run n1–n15 (MAINTAIN request opened at `94117ee`)

Request: work every `.agent/deferred.md` row in rank order (n1–n15 = the 15 rows at `94117ee`; new
finds fund after them). Met when: each row closed by its own acceptance check in its own commit,
recorded blocked on the user with what it owes, waiting on its re-open trigger, or routed; `pnpm
gate` green on a clean tree at the closing commit. Left open in `Tasks`: n3 n4 n5 n9 n11 n12 n13
(approval left queued, each on a `wip/n*` branch), n8 (the producer), n10 (its trigger), and the
live reviews owed.

- [x] `b0ee8d8` n1 `high` `pnpm palette:check` in the gate (coloraide's method ported, a 54-row
  differential) and a searched palette that passes it — approved (user); its live review is owed.
- [x] `74282a4` n2 `med` `binding:replay`: each arm runs its own tree's bag, producer and build —
  per-tree arms approved (user).
- [x] `6325451` n6 `med` reviewer-18 ruled the 138 Stryker survivors against m5u6 (14 specified →
  six lane cases kill them, 120 open, 4 equivalent); the record carries every ruling.
- [x] `b8dbff8` n7 `med` graph.md's renderer-seam claim keeps what a command decides.
- [x] `83cd690` n14 `low` binding:check 49.2 s → 35.7–36.9 s at comparable load (exact byte
  comparison in clinical-records T11/T12); a later same-moment A/B held, 36.3 / 41.4 s against
  47.9 / 48.7 s.
- [x] `64d5e81` n15 `low` `tools/kb/regenerate-bag.sh` rebuilds the vendored bag byte for byte at
  `8a51bf0c`.
- [x] `77292ff` find `high`: three vite 8.2.0–8.2.3 advisories reddened `audit:check` → vite 8.3.4.
- [x] `61982a9` Close: check set `.agent/contracts/n-close.md`; reviewer-19 (reviewer) 8/8 — A1 A2
  B1 D1 pass; E1.1 (major) the regeneration script could delete its own clone → refused; C1.1 F1.1
  F1.2 F2.1 (minor) records → fixed; re-review 5/5 pass; `pnpm release:check` rc 0, `pnpm mutate`
  127/127 killed, `pnpm binding:replay` rc 0 with its `HEAD` control rc 1.

## Queue run, third ask (MAINTAIN request opened at `5a22cf6`)

Request: work every `.agent/deferred.md` row in rank order (10 rows at `5a22cf6`: n3 n4 n5 n8 n9
n10 n11 n12 n13 n16; new finds fund after them). Met when: each row closed by its own acceptance
check in its own commit, recorded blocked on the user with what it owes, waiting on its re-open
trigger, or routed; `pnpm gate` green on a clean tree at the closing commit. The one question asked
single-select per group (approve / leave queued / retire as a declared limit): all seven approval
rows approved. Left open in `Tasks`: n8 (the producer), n10 + n16 (their triggers), n17 + n18
(finds after the question, owed on their `wip/` branches), and the live reviews owed.

- [x] `6507d44` n3 `med` `pnpm mutate` reads a timeout-only vitest failure as `INCONCLUSIVE` —
  approved (user); the close's full run under it found n18.
- [x] `2e9e67c` n4 `med` `claims:check` grades each `Artifacts` bullet whole — approved (user).
- [x] `3209ee4` n5 `med` the inventory refuses a bare-path `text` record and a `none` gate step —
  approved (user); pruning the last `med` row emptied the index and found n17.
- [x] `c7b9b7d` n9 `low` the meta-interpreter derives through `guideline_satisfies/4,6`; the
  ladder lists checked comparisons — approved (user).
- [x] `93c41eb` n11 `low` `copy:check`'s component filler sweep retired — approved (user).
- [x] `66aa4b7` n12 `low` `claims:check` skips rules frontmatter — approved (user).
- [x] `2e7e8be` n13 `low` every compound arm of the decoder admits a wrapper instance alone —
  approved (user).
- [x] `7d72c77` n17 `med` find: `claims:check`'s repeated-index control on an empty index → owed,
  `wip/n17-index-control` `f312d8a`.
- [x] `f0db5c0` find (reviewer-20 register G1): two comments quoted a stale premise census.
- [x] `a26a517` n18 `med` find: the R29 + E10 closing cases hang rather than refuse → owed,
  `wip/n18-bounded-settle` `0d3ab54`.
- [x] `a780bf5` Close review: check set `.agent/contracts/n-landing-close.md` (`1330e65`);
  reviewer-20 (reviewer) 10/10 — 9 pass, R1.1 (minor) R108's command → fixed, re-review pass.

### Second question round

The user asked for the open questions after the close and approved all four: land n17 + n18 (n17
revised first — on its branch its mutant lived while the queue held a `high` or `med` row), build a
development page for n9's live review (n19), serve the app for the owed live reviews, and give the
MAINTAIN body one closing question for finds made after the first (agents `ebc881d`). Left open in
`Tasks`: n8, n10, n16, n20 (a find after the round, owed) and the live reviews owed.

- [x] `da0333b` audit find: two advisories against `@vitest/mocker` <4.1.12 → vitest +
  `@vitest/browser-playwright` 4.1.12.
- [x] `6961634` n17 `med` `claims:check`'s repeated-index control repeats a planted row's line on
  every queue — approved (user), revised before landing.
- [x] `a4e4ff4` n18 `med` the R29 + E10 closing cases bound their waits — approved (user); the full
  `pnpm mutate` 132/132.
- [x] `af65e26` n20 `med` find: `tests/solution-streaming.test.ts`'s queued-cancel case races a 5 ms
  timer → owed (user), no change drafted.
- [x] `342f333` n19 `low` `review.html`, a development page for n9's live review — user ruling.

## Machine move (MAINTAIN request opened at `5352dd9`)

Request: development resumes on a second machine from a fresh GitHub clone; everything local-only
it needs reaches the repo, else it is named to the user with a transfer method. Met when: the
full `pnpm gate` green on a clean tree at the closing commit, here and on the new machine
(`t25-480`, i7-8650U, Node 26.12.1, native pnpm 12.16.1). Paused at `5e1600b`, resumed in a fresh
session after the machine left the LAN (`ssh -p 9995 eturkes@59.169.212.33`, same ED25519 host
key). User rulings: the 130 evidence branches + 6 tags pushed; `.scratch/` stays behind; exact
pnpm 12, Corepack retired; Renovate replaces Dependabot; MAIN sets the new machine up over ssh
and fast-forwards `origin/main`; the chat's own Codex login by a relayed device code; MAIN closes
the Dependabot PRs, the user installs the Renovate app (owed in `Tasks`); the answer-map case's
30 s timeout; n16's trigger per host. Named to the user, never committed: `CLAUDE.local.md`
(copied by scp), the chat's codex login (done), Claude Code transcripts, `.dev.vars` (retired
TypeSafe key), the `known_hosts` entry, the pnpm v11 store.

- [x] `778208d` mv1 `med` audit: live advisories (undici, fast-uri, qs) → in-range lockfile bumps;
  it closed the `audit:check` and `qs` queue rows, pruned in `bfeea7d`.
- [x] `8a0a842` mv3 `med` pnpm 10.34.5 via Corepack → exact `pnpm@12.16.1`, settings in
  `pnpm-workspace.yaml`, Corepack out of README, CI and `readme:check` — user ruling.
- [x] `053854b` mv5 `med` `resolveChromiumfish` reads pnpm ≥ 11's `global/v11/<set>` layout; red at
  base 2/4, mutant `mv5 chromiumfish resolver scans one level` killed.
- [x] `f28bf9b` mv4 `low` Renovate replaces Dependabot — user ruling; validator rc 0.
- [x] `0466833` Close review: reviewer-23 (reviewer) R1–R10 10/10 pass; README names `pnpm setup`
  for a fresh global install.
- [x] `bfeea7d` mv6 `med` find: the new machine's gate red at the answer-map case (5480 / 5962 ms,
  CPU speed) → 30 s timeout — approved (user); n16 per-host trigger; `answerSubgraph` queue row.
- [x] `bfeea7d` mv2 machine move: the new machine cloned `0466833`, restored 130 refs + 6 tags,
  took `CLAUDE.local.md`, installed chromiumfish, logged the chat in; `pnpm test:browser` 11/11,
  `pnpm smoke` ok; `pnpm gate` green at `bfeea7d`, 130.1 s.

## Queue run, fourth ask (MAINTAIN request opened at `7b68934`)

Request: work every `.agent/deferred.md` row in rank order (12 rows at `7b68934`; new finds fund
after them). Met when: each row closed by its own acceptance check in its own commit, recorded
blocked on the user with what it owes, waiting on its re-open trigger, or routed; the full gate
green on a clean tree at the closing commit. One question round: n20 approved; MAIN fast-forwards
`origin/main` now and at close; the KB-release migration keeps its own session, and the user had
the producer publish the release's `.sha256` sidecar; Node 26 re-ruled. Left open in `Tasks`: n8
(the producer), n10 + n16 (their triggers), the KB-release session and the live reviews owed. Each
commit gated on the pool (nixbox) until the fan-out landed, then by `pnpm ci:gate`.

- [x] `59c73d6` n20 `med` the queued-cancel case queues its cancel as step 2 begins — approved
  (user); draft `wip/n20-queued-cancel` `adaee3b`, landed unchanged.
- [x] `7bdf8eb` n21 `med` `Verify` checks out full history (`bcd7322`); green on the `main` push
  `463e882` (run 41002763774), red at T9 on a planted byte (run 40993668331).
- [x] `601c367` n22 `med` `Security scan` runs `kb:build` before `lint` (`054659a`); green with all
  three scanners (run 40993664773), red at `lint` on a planted sink (run 40993671437).
- [x] `1911f18` n23 `low` README: the missing-annotations note appears when annotations cannot be
  shown.
- [x] `29cf85c` n24 `low` `pnpm shell:check`: a pinned ShellCheck v0.11.0 over every tracked shell
  script, fetched by digest.
- [x] `a81ddbd` n25 `low` `answerSubgraph` tokenizes each text once: the twelve-map case 2.35 s →
  0.50 s on the i7-8650U, 3,080 views byte-identical.
- [x] `ca9c009` n26 `low` the CI gate's fan-out (`fanout.yml`, `pnpm ci:gate`, `gate.mjs --plan`):
  20 jobs green (run 41026506211), a planted `lint` red named (run 41026516113); the CI gate is in
  force.
- [x] `4ceb650` n27 `low` Node 26 project-wide (user re-ruling): `26.13.0`, `engines` `>=26.0.0 <27`;
  the `dom` project runs with `--no-experimental-webstorage`; `pnpm release:check` rc 0 at
  `e0171c6`.
- [x] `3fe19ce` n28 `low` find: the rules' `npx` recipes → `pnpm exec` / `pnpm dlx`.
- [x] `3fbf661` Close review: check set `.agent/contracts/n20-close.md` (`2624230`); reviewer-24
  (reviewer) 8/8 — T1 C1 P1 D1 R2 pass; C2-1 (major) → `290d46b`, G1-1 (minor) → `c43d83b`, R1-1
  (minor) → `3fbf661`; re-review 3/3 pass; S1 (MAIN) pass.

## Phase

IMPLEMENT closed three times, each ledgered in `.agent/review.md` with no open row: u3–u15 on
32/32 rows against `.agent/contracts/review-implement.md`, u16 free-text intake (u16a–u16h) on
14/14 rows against `.agent/contracts/review-u16.md`, and the answer-panel annotations
(ann-u1–u4) on 16/16 rows against `.agent/contracts/ann-review.md`. Unit summaries →
`.agent/archive/units-m5.md`.

The expedited M2–M4 surfaces had no prototype tree: they played the PROTOTYPE role in place and
were redeveloped under M5 by user ruling (`.claude/rules/stack.md`). The answer panel's ITERATE
prototype, `prototype/answer-annotations/`, retired at its IMPLEMENT close under tag
`prototype-answer-annotations`.

## KB release intake (request: queue row `KB intake reads a sibling cnl-ckc checkout, not a release`)

- [x] b5d3d8b rel-u1 `kernel` re-vendor release `kb-2026-10-29-rc.1` (bag `g673b3c1f3bfd`) —
  contract, rulings and witnesses `.agent/contracts/rel-u1.md`.
- [x] 6acb906 find: GHSA-g3hv-75wg-m249 reddened `audit:check` → minimatch overridden to ^11.0.3.
- [x] 9502c6d rel-u2 `data` intake from the release: `pnpm kb:fetch <tag>` + `--verify`, `kb/release.json`,
  `vendor/cnl-ckc/`; the queue row `KB intake reads a sibling cnl-ckc checkout, not a release` closed.
- [x] rel-close: reviewer-25 over every lens (`.agent/contracts/rel-close.md`): K3-1 major, R1-1 + R2-1 minor, all fixed in the close commit.
