# IMPLEMENT orientation — graph overhaul + n30 (gi)

Record of the orientation `.agent/spec.md` `Decisions` cites: readings, user answers, consultant
amendments, probe facts, and the checks fixed before each spike. Rulings live in `Decisions`;
this file holds their evidence.

## Interpretation (navigator-8, -9, -10, independent; reports `.scratch/agents/navigator-{8,9,10}.md`)

69 rows each (7 Intent clauses, 2 requests, 26 Decisions entries, 9 owed designs, 17 m1 aspects,
8 scope-guards aspects). Class divergence on 15 rows, all terminological (keep vs replace of the
same reading); substantive readings agree:

| id | settled reading |
|---|---|
| R1 | Pre-overhaul graph rulings (polarity mechanism, renderer lock, zoom floor, spanning scopes, reader-relative labels, orphan contexts, kind fills, hub) are reopened by "everything open"; their semantic duty — no line reads as a claim the source denies; modality + negation ride the relationship — binds the new network. |
| R2 | Several starts per rule = views of ONE rule: same rule id, full joint condition, never independent sufficiency. |
| R3 | Starts = the user's words: patient situations, then treatment in course (`start`, `continue`, `prescribe`, `give`; `receive`); a negated condition never anchors. |
| R4 | `patient` start = a logical fallback folded into the concept's advice, never a visible `patient` node (D19 removes the bare hubs). |
| R5 | Whole-KB scope = every sentence reachable; only faithful relations draw; nothing fabricated to reach a count; nothing silently dropped. |
| R6 | Trace binds the live run's proof and date; offline answer lists were a prototype shortcut. |
| R7 | Prototype forms classed `intent`/`incidental` (headings, button sets, hover-only verbs, top-8 lists, URL spellings, declutter, regex anchors, offline data) are free to redesign. |
| R8 | An unmapped concept takes an explicit no-category state, never a meaning-bearing default (the prototype's silent `weighing` fallback is retired). |
| R9 | A realizer that cannot express a condition shows the whole source sentence, labelled. |

## User answers (two dialogs + one clarification + one routing)

| q | answer |
|---|---|
| first view | all document kinds draw from the start, each line + panel naming its kind, chips hide a kind |
| one-concept advice | keep loops (asked after the clarification "I thought the loop issue would be solved naturally by including the whole corpus?" — answered: reading every KB-stated second concept cuts ~860 to ~590 on a first probe; the rest stay single-concept) |
| categories | MeSH top-level groups |
| labels | fit + reveal on zoom |
| scope + law | marks + boundaries view |
| chat scope | exclusion line under a reply with a KB part |
| prepared questions | redesign around the full guideline → routed: next phase, PROTOTYPE |
| grader changes | all three approved: A1 → new network; two old-graph reviews → one; date-related re-pins |

## Consultant panel (consultant-2, -3, -4, independent; `.scratch/agents/consultant-{2,3,4}.md`)

| ruling | verdict ×3 | amendment adopted |
|---|---|---|
| G1 build-time DRS projection, live-proof trace | pass ×3 | asset descriptive only, never an answer source |
| G1P projection rules | fail(high) ×3 | sentence-level coverage independent of events (6 eventless sentences); residual consequent payload per line (all arguments incl. 65 third-argument sites, phrases, properties, quantities); occurrence key = sentence + variant + event; guard and supersession metadata orthogonal to the presentation bucket; explicit target-role policy (direct object, prepositional object, property, none) |
| G2 Cytoscape + build-time layout + reveal zoom | fail(med/high) ×3 | Cytoscape scales label text with positions, so an overlap is zoom-invariant → labels screen-fixed (inverse zoom); forced labels + edge labels collision-graded separately; woff2 decompressed before harfbuzz (raw woff2 reads cmap 0); exit + determinism are spike gates |
| G4 date as run context | fail(high) ×3 | a static `guideline_evaluation_date/1` clause reading a global is visible natively but NOT to `derive/5` → dedicated interpreter arm with a line-free context leaf; a backtrackable global survives `once`/close → `setup_call_cleanup` restore (consultant-2 probe: restored on early close, exhaustion, exception, failure); validated frozen API context, cache key and stream ownership kept |
| G5 ACE condition text | fail(med) ×3 | noun/lemma equality cannot see polarity, bounds, roles or connectives → verbatim sentence by default; a shorter span only with a structural correspondence proof |
| G6 retire the linguistic graph | pass ×3 | the old → new check mapping is an acceptance contract; replacement graders land before deletion |
| X1 | — | date-change lifecycle: context snapshotted at run admission; earlier results keep their own date |

## Probe facts (scratch probes `.scratch/orient/probe/`, consultant re-derivations; figures enter `Decisions`/rules only through the g1/g2 census)

1,813 sentences / 18,845 clause sites / 2,415 consequent events; 6 eventless sentences; 17
multi-frame sentences = 2 genuine disjunctions (`rec02-imp08` S4, `s37-14` S7) + 12 exclusion and
3 supersession record splits. Antecedent negation has two forms: `\+ (…)` and a body box
`guideline_operator(actual,E,-)` with its payload in context `E`. First-cut projection under R3:
~1,300 lines, ~930 line concepts, ~860 single-concept advice items (~590 once modifier concepts
and patient-actor conditions are read; rule unreviewed — o2), 316 example-list items, 24 grade
copulas (annotations). `parseAdviceSentence` parses 1,477 of 1,813 sentences (parse only).

## Spike checks — fixed before the spikes run

### S-G4 run-context session spike (builder; real `swipl-wasm`, the shipped `EngineSession`)

- K1 native ≡ interpreter: for context ∈ {none, 20221201, 20221229, 20230101}, native
  `guideline_evaluation_date(D)` and `derive(guideline_evaluation_date(D),…)` return the same
  solutions; `rec12-imp08` S1–S3 deontic heads derive natively and by interpreter alike, iff the
  date precedes 20221229 (interpreter under the sentence's premises).
- K2 no leak: after each terminal mode — exhausted, closed early, error inside the goal, cancel,
  inference limit, deadline kill — the raw run context, read by a bare unwrapped probe before any
  later wrapper can reset it, holds its prior value, and the next undated query reads no date
  (scientist-1: a reset by the next wrapper would mask a cleanup leak).
- K3 concurrency: a second request while a streamed dated query holds its frame open is refused
  by name (`Decisions`: a second concurrent request is refused by name); the first then completes
  under its own context alone. Today's shipped behaviour is measured first and reported.
- K4 a dated proof carries exactly one line-free context leaf; an undated proof is byte-identical
  to today's.
- K5 the read-only guard refuses model goals naming the wrapper or any global-variable builtin.
- K6 added cost per call reported (inferences, ms) against a catalog answer's.

### S-G2 layout + label spike (builder; the probe network under R3)

- L1 the process exits within 2 s of the layout's end.
- L2 two runs write byte-identical output (`cmp`).
- L3 full-network layout wall time reported; the pain row pinned exactly (one y, acute < subacute
  < chronic in x).
- L4 harfbuzz label box (decompressed shipped Atkinson Hyperlegible Next, the shipped weight +
  wrap width) vs Cytoscape's rendered box in Chromium at screen-fixed size: |Δw| and |Δh| ≤ 2 px
  for ≥ 99% of labels, the maximum reported.
- L5 with reveal zooms from a greedy priority pass, the rendered shown labels overlap 0 times at
  fit, 1.5×, 2× and 4× fit on 1152×660 and 343×440 canvases.
- L6 share of labels shown at fit, per canvas; forced labels (acute pain's neighbourhood) and loop
  edges: overlap counts reported.
