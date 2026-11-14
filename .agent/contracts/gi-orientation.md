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

## Spike checks — fixed before the spikes run, revised by scientist-1's appraisal before grading

Spikes prove mechanism feasibility; scientist-1's Z1 end-to-end predicates (date admission and
invalid dates, frozen copy vs caller mutation, the original date kept through queued answer →
marks → proof → chat and UI date changes, a reproducible goal + context card, stale proof-cache
refusal; layout re-graded on the final projection, all views, the actual phone canvas, an
independent rendered oracle) bind the n1, g4 and g6 contracts, not the spikes.

### S-G4 run-context session spike (builder-40; real `swipl-wasm`, the shipped `EngineSession`)

- K1 for context none / 20221201 / 20221229 / 20230101, native AND interpreter date solutions are
  exactly [] / [20221201] / [20221229] / [20230101]; every `rec12-imp08` S1–S3 deontic head,
  enumerated independently, under identical non-date premises in both arms, proves only before
  20221229 (a limit or an error never counts as false); negative controls: one necessary premise
  removed, a matching exclusion added.
- K2 inside an open goal the date is read; then each terminal reason is forced and asserted —
  failure, exhaustion, early close / answer cap, error, cancel, inference / depth / stack limits,
  soft deadline — and the raw run context, read by a bare probe BEFORE any new wrapper, is
  absent or restored; then an undated KB positive control + an empty date query. A hard deadline
  terminates the runtime: its row grades a real client/worker termination and the verified fresh
  engine's raw context (`none`) instead.
- K3 while A streams under date A, a query and a proof B under date B each settle a named busy
  refusal before touching Prolog, A's cache or A's context; A then yields all its remaining
  solutions and its terminal under date A alone; after A closes, B succeeds under date B.
- K4 a dated proof carries one line-free run-context record equal to the admitted date (repeated
  dependency leaves agree); its source-line set is unchanged except for derivations the date
  genuinely changes; a direct date goal and a compound goal reading the date twice both prove;
  every undated catalog proof is byte-identical to the pre-spike commit's; a before / on / after
  date change misses the proof cache, a repeated same-date proof hits.
- K5 the read-only guard refuses model goals naming the wrapper or any global-variable builtin,
  through the real model-goal entry, with an ordinary permitted KB goal as positive control.
- K6 descriptive: paired baseline / wrapped runs (same image, goal, budget, identical solution
  multiset, order balanced, proof cache off), absolute + relative inference and time deltas,
  repetitions + spread, host + load; cold first call apart from warm runs.

### S-G2 layout + label spike (builder-41; the probe network under R3)

- L1 an external supervisor requires layout end + a valid artifact + natural exit rc 0 within 2 s
  of layout end, inside a whole-run deadline fixed before the run; a planted held timer and a
  planted never-ending layout both fail.
- L2 two fresh processes, reuse disabled, write to distinct initially absent paths; each output
  validates (every input id present, finite positions, label + reveal records); canonical bytes
  equal; seed + input / font / toolchain hashes reported; same-host reproducibility only.
- L3 every node positioned; the three pain nodes share y, acute < subacute < chronic in x, every
  other node centre below that row; layout-only and cold-process wall time, census, host + load
  reported.
- L4 EVERY label's predicted box (decompressed shipped Atkinson Hyperlegible Next, shipped
  weight, explicit font load checked, identical wrap / line height / letter spacing) vs its
  rendered box in CSS px; 2 px / 99% reported as diagnostics; every underestimated box padded
  before L5 (outline and background included); on-screen size + wrapping unchanged across zooms.
- L5 on each canvas (1152×660, 343×440): zero rendered visible-label intersections at fit, at
  every reveal transition (just below / at / above), and at maximum zoom, zooming both ways;
  boundary failures captured and inspected.
- L6 the three pain anchors' labels forced at fit; the priority (pain anchors, then degree,
  stable tie-break) verified; every label reachable at a finite supported zoom; selection +
  neighbours of acute, subacute and chronic pain and of the maximum-degree node: every mandatory
  label rendered, zero label-label overlap, occlusion / clipping recorded apart; fit share
  descriptive, with screenshots judged.

## MeSH coverage sample (classifier-2, -3, independent; rubric `.scratch/orient/mesh-rubric.md`)

100 KB nouns, seeded sample of 1,680 (all entity nouns bar `clinician`, the bare three and
`-example` nouns; the network's ~1,000 concepts are a subset), coded against the live NLM MeSH
lookup (release not yet pinned — consultant-8 R3).

| measure | coder A | coder B |
|---|---|---|
| matched (exact / kind) | 54 (6 / 48) | 56 (6 / 50) |
| no match | 46 | 44 |
| primary top-level category, matched rows | E 21, N 9, F 6, G 5, C 4, D 3, I 2, L 2, J 1, M 1 | E 20, N 10, F 6, G 6, C 4, D 4, I 3, L 1, J 1, M 1 |

Agreement: same descriptor 44 of the 50 both-matched rows; overlapping top-level set 48 of 50;
primary category (no match included) 87 of 100, Cohen's κ 0.82. Typical no-match terms:
`decision guidepost`, `clinician taper support commitment`, `function improvement`, `naloxone
purchase`, `potential limitation`. Reading: coding is reliable, but about 45% of terms take no
category and the matched half concentrates in E (Techniques) and N (Health Care) → returned to
the user (Decisions: poor coverage returns to the user).

## Spike results (graded against the revised checks)

| check | verdict | measurement (report `.scratch/agents/builder-40.md` / `builder-41.md`) |
|---|---|---|
| K1 | pass | exact date lists, both arms; 3 heads × 4 dates × full / missing premise / matching exclusion = 36 correct |
| K2 | pass | 27 surviving-runtime cases restore the raw prior before any wrapper; real hard kill → fresh engine at `none` |
| K3 | pass | query + proof B refused by name, 0 Prolog calls, 0 cache operations; A finishes under its date; B succeeds after |
| K4 | fail(med) → ruled | 11 of 12 undated proofs byte-identical; rec05 renames 19 existential variables — and so does the pre-spike image against itself, so byte equality errs against the contract; n1 tests `=@=` variants + identical source-line sets. Dated: one run record, source lines unchanged, cache 1/1/1/0 |
| K5 | pass | 10 forbidden entries refused at the real model-goal entry; KB positive control |
| K6 | descriptive | +9 inferences (+0.019%); wall time inside noise |
| L1 | pass | natural exit 43–46 ms after layout once `cy.destroy()` runs; held-timer + endless-layout controls refused |
| L2 | pass | two fresh processes, canonical bytes equal (667,811 B), hashes recorded (nixbox) |
| L3 | fail(med) | pain row pinned exactly, but 638 of 1,219 nodes lie above it; layout 3.0–3.1 s on nixbox, 39–75 s on the loaded desktop |
| L4 | fail(med) | every label within 0.55 px (diagnostic); explicit font-load check, padding and zoom-invariance not yet graded |
| L5 | fail(med) | 0 ordinary overlaps at fit / 1.5× / 2× / 4× on both canvases; reveal boundaries ± ε and reverse zoom not yet run |
| L6 | fail(high) | subacute + chronic labels hidden at fit; acute neighbourhood 21 (desktop) / 27 (phone) overlaps at fit; 858 loop labels overlap heavily; fit shows 57 / 10 of 1,219 labels; thin lines and dots nearly vanish |

Mechanism (S-G4, `wt/builder-40` `cf3fd3e`): `clinical_run/2` via `setup_call_cleanup`,
`nb_setval`/`nb_delete`, boot sentinel `none`, `derive/5` date arm before the comparison arm, one
run record per dated proof, frozen `RunContext`, busy refusal before parsing.

## Pre-mortem (consultant-6 scale + performance, -7 maintainability + operability, -8 dependencies + data model)

Each risk → a `Tasks` change (3f5b707 → this commit) or the g2 contract:

| risk | change |
|---|---|
| phone interaction stutters (c6 R1) | g4: interaction budgets fixed + measured on the full asset, scientist-appraised |
| layout recomputed on every build / CI leg (c6 R2, c7 R2) | g4: layout cached by full input closure, bounded child process |
| forced labels collide in dense views (c6 R3) | g4: focus views framed collision-free; L6 owed |
| new assets precached at boot (c6 R4, c7 R3) | g6: lazy set + `browser:check` zero graph requests before activation |
| dated engine flows slow (c6 R5) | n2: whole flow timed at four dates |
| app switched before its rendered grader (c7 R1) | g5 builds the grader; g6 switches |
| a run's date splits across answer / marks / proof / cards (c7 R4) | n1: one logical run owns its date |
| live review not performable after prototype retirement (c7 R5) | d1: click paths first |
| sentence vs occurrence buckets (c8 R5) | g2 rev. 2: sentence coverage + occurrence buckets |
| fcose drops component packing under constraints (c8 R4) | g4: explicit packer |
| merged lines hide status (c8 R1) | g2 rev. 2: identity includes guard + supersession |
| asset compatibility (c8 R2) | g2 rev. 2: asset envelope |
| MeSH release (c8 R3) | moot: the user replaced MeSH with the codebook |
