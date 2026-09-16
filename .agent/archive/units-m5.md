# Closed IMPLEMENT units — u3-u13

Retired record. Live successors: the acceptance contract per unit in `.agent/contracts/`,
the law each unit wrote in `.claude/rules/`, and the open path in `.agent/spec.md`
`Deferred`. Nothing here binds current work; it exists so a close summary is readable
without walking `git log`.

u3→u7 = the answer/proof spine; u8→u10 = the graph renderer ruling and its two probe pages;
u11→u12 = scope, from the asset record to the projection model. Contract + suite each.

- **u3** `m5u3.md` · `clinical-answer-live` 5 cases. `clinical_advice/3` = 1 static derivation
  rule over `clinical_derive/4`, 0 answer facts; 12/12 terms + source ids `==` u1's oracle.
  `findall/3` alone shipped a truncated answer → the rule counts gates and demands an equal
  derivation count, so answers are all-or-nothing (A10).
- **u4** `m5u4.md` · `clinical-proof-live` 7 cases through the production RPC.
  `clinical_advice/3` projects `/4`, whose 4th arg is the proof ⇒ answer and proof are ONE
  derivation; `clinical_advice_source/4` + `advice_nodes/2` gone. `ProofStep` =
  clause|assumption|negation.
- **u5** `m5u5.md` · 3 cases in `provenance-ladder.dom`. Dedup is per PROOF: 3,930 leaves →
  the document's own 4–131 premises, inside the existing `Live Prolog proof` rung with a
  hypothetical badge and no line; the one NAF goal gets its own. Six rungs unchanged.
- **u6** `m5u6.md` · `tools/kb/exports.mjs` + `kb:export-check` + 4 cases in
  `legacy-export-lane`. `EXPORTED` declares the 4 ids and refuses a divergent bag by name; the
  live `writeq` of the WHOLE `'$guideline_answers'` envelope matches all four committed
  oracles byte for byte; erasing one `category-A-recommendation` entity line reddens
  category-A alone.
- **u7** `m5u7.md`, 12 predicates + the C2 disposition (five classes restored, none by
  rationale). `clinical-binding` perturbs `guideline_*` three compiled ways: an additive
  overlay, one erased cited clause (drops exactly its document + proof), a one-line shift
  (+1 on every proof line, 12 answers identical). `tools/binding-check.mjs` requires 35 named
  cases across 11 suites and REPLACES `pnpm test` in the gate. `tools/answer-oracle.mjs` gives
  `smoke` + `browser:check` one bag-derived expectation, graded byte for byte in BOTH locales.
  `pnpm binding:replay` shows the erasure invisible at `a944fca`, dropping one document now.
- **u8** `m5u8.md`, 11 predicates. Four arms × 14 fixtures × 2 viewports at the measured
  CANVAS box (1152×558 / 296×384 — device-size numbers overstate by ~1.4×). vis-network
  rejected; edge-view contract R1–R7 is what u9–u13 decide against.
- **u9** `m5u9.md`, 10 predicates · `pnpm graph:check` mounts the SHIPPED `mountGraphCanvas`
  in a real browser over 14 fixtures × 2 viewports; four controls redden it. Bezier, wrapped
  labels outlined in the node's own colour, `autounselectify`, an 11 px fit floor, and ONE
  fcose layout with the subject pinned — the `concentric` branch every answer view took cost
  156 crossings against fcose's 56, so u8's spike never measured the shipped surface.
- **u10** `m5u10.md`, 3 shipped + 12 predicates · `graph:check` gained a SECOND page.
  `tools/graph-probe/app.html` + `app.svelte.ts` mount the whole `SemanticGraph.svelte` over
  the real asset and grade every interaction on BOTH sides of the adapter seam — search, path,
  expand, recenter, canvas tap, node index, in the concept and the answer branch, at
  1280×900 and 320×720, plus a refused `graphUrl` and a `--graph-*` palette set to `initial`.
  The device size is the input here and the canvas box an output, the reverse of `index.html`.
  Runes because C9 changes `graphUrl` between the failure and the retry. A synthetic tap needs
  a DESCENDANT target inside the layout viewport — `eventInContainer` discards the rest, and
  pointer events reach nothing. Firing inputs: a detached selection callback refused by C2 +
  C6 in the run itself; `subgraph.nodes.slice(1)` in the node index reddened C7 8×, reverted.
- **u11** `m5u11.md`, tier `data`, 7 predicates · `prod-scope` + `test-scope`.
  `tools/kb/graph.mjs` emits a versioned top-level `scopes` table — schemaVersion **2**, 1,263
  records sorted by `id`, `chain` ordered OUTERMOST FIRST at depth ≤ 2 — and every
  operator-bearing edge carries `edge.scope` as an INDEX into it rather than inlining the
  string: 1,263 contexts across 1,936 occurrences dedupe hard. 17,667 edges carry a scope, all
  1,193 operator edges do, 0 indexes are unresolvable. **7 records are unreferenced and that is
  legal** (user ruling) — S3 is ONE-WAY, every operator-bearing edge resolves to exactly one
  record, and the unreferenced count is pinned so it cannot drift. The cases stay out of
  `binding:check` by TIER; what makes the guard durable is the validator inside `kb:asset-check`
  with a `requireFiring` control over the REAL table emptied.
- **u12** `m5u12.md`, tier `kernel`, 8 predicates · `prod-model` + `orc-proj`, each replaced
  once by a `-2` successor after a session death. `src/graph/model.ts` reads u11's table and
  carries ordered scope through the concept projection as `SemanticGraphEdge.scopeOperators`
  (`edge.scope` is already the asset's numeric index, so the two cannot share a field).
  Scope-keyed dedup split 2,381 → 2,615 groups, 2,630 with the 15 non-unit cardinality edges
  review case 2 exposes, 1,584 scope-bearing; order-distinctness is structural because
  `conceptEdgeKey` spreads `scopeOperators` in order. All nine of `wt/rev-sem-2`'s
  `tests/graph-semantics.review.test.ts` cases are green, S9 and S13+ included — **user ruling**,
  because `binding:check` fails the gate on ANY red case in its run, so xfail, a split suite and
  branch-only storage each stop executing the defect. S9's headline derives 1,235 entity/event
  nodes with 65 attributes still visible; S13+ is refused at `parseEdge`, where `guideline_arg/4`
  and `guideline_pp/4` constrain their source to an event — 5,002 constrained, 0 violations
  across 20,964. `binding:check` gains a THIRD declared table, `MEANING`, holding all nine cases
  with its own `gradeTable`, its own emptied-table control and its own count. Two integrity
  events, both caught rather than claimed: `prod-model` encoded two reds as expected failures at
  `fe1ce39`, then restored the suite byte-identically at `5eaeec2` and reported its earlier green
  as disqualified; `prod-model-2` implemented the role rule for `argument` alone, and the
  independent oracle's derivation of the identical `guideline_pp/4` constraint is what closed it
  at `89d8b6b`. The oracle itself does not ship — `.agent/deferred.md` carries the port.
- **u13** `m5u13.md`, tier `kernel`, 7 predicates · `prod-view` + `test-view` + `orc-view` +
  `triage-hang`, one wave of four. `EdgeView` (`src/graph/view.ts`) is the seam both renderers
  read, carrying `scope`, `farScope` and the composed `label`; `pnpm graph:check` grades the
  rendered output over 28 views + 4 component + 2 fallback sweeps and is the ONLY grader of it.
  Two user rulings shaped the result. **A spanning edge shows BOTH ends** — the model reads the
  target end off the `event` edge declaring that event on the same line and stores
  `farScopeOperators`, refusing by name a `condition supports` edge whose target has no witness.
  **Labels are reader-relative** — data direction-fixed, presentation flipped, composed by ONE
  shared `scopeReading` helper so a second derivation per surface cannot let the renderers
  disagree; `→` means the end away from the reader everywhere.
  The contract's blanket "every V2/V3/V6 case is RED at base" premise was **DISPROVED and
  withdrawn**, independently by `test-view` off the live renderer and `orc-view` off the asset:
  u12 composed scope into the label string both surfaces already consumed, so scope rendering
  arrived a unit early. Genuinely absent at base were the seam, the negation dash, the spanning
  far end and cap disclosure. `orc-view`'s O6 raised five predicate gaps and **all five were
  upheld**, the sharpest being that a cap must report its SPLIT COUNT separately from its row
  count — `search24` silently dropped 1,276 of 1,300 nodes while grading green.
  `triage-hang` root-caused the u10c non-termination: `spawn('pnpm exec vite')` built
  wrapper→pnpm→Vite while `stop()` signalled the wrapper alone, so the surviving Vite held the
  pipes open past both summaries. In-process Vite plus awaited teardown; the campaign now exits
  on its own with no outer `timeout`, and a planted non-terminating page still refuses by name.
  Three defects surfaced only when the close RAN the graders against the post-ruling tree — a
  banned `JSON.stringify` under `src/`, a probe recovering the relation by stripping a suffix
  that is no longer a suffix, and `model.ts` still nulling the far scope when the two ends agree
  (the withdrawn rule, invisible from the source end, stranding the target-side reader). All
  three are in `m5u13.md` `Close` with the third's red witness.
