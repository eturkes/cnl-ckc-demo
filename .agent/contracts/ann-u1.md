# ann-u1 — the marks goal: the KB's grade, qualifiers, preferences and time marks per statement

Request: IMPLEMENT — answer panel annotations (`.agent/spec.md` `Phase`, `Decisions`: one facts
row per statement, grade once per document run, `Qualifier` first, time bounds AND orderings).
Tier `kernel`: the panel presents each mark as the knowledge base's, so the non-negotiable binds
it (`.claude/rules/stack.md`), and no downstream check re-reads a wrong mark. Base: the plan
commit that lands this contract. The ITERATE prototype (`prototype/answer-annotations/`)
illustrates the display; its goals read STORED heads by `clause/2` through the chat's read-only
path, which this unit replaces. Reviewed before code by `consultant-2`
(`.scratch/agents/consultant-2.md`, 21 rows: direction right; M3 M6–M12 R4–R6 changed here).

## Measured at base (`5700e6c`, shipped PVM, `.scratch/probe-marks/`)

- Grades: 24 `guideline_grade/5` facts, 2 per recommendation document (`strength`, `evidence`),
  each on the S1 `recommendation` referent and labelled by an S1 entity
  (`category-A-recommendation`, `evidence-type-4-recommendation`).
- Annotation heads inside the 53 content sentences, every one a gate head the answer's
  derivation already proves under its premises: 22 `guideline_qualifier/4` (rec04 6, rec05 9,
  rec07 2, rec08 2, rec09 1, rec11 2), 5 `guideline_preference/4` (rec02 S4–S5 with
  `Alternative = none`, rec03 S2–S4), 12 `guideline_interval/6` (rec07 S2–S4: `after` + `geq 1`,
  `within` + `leq 4`, unit `week`, anchors `therapy-start` / `dosage-escalation`), 6
  `guideline_order/4` (`before`: rec01 S4 ×2, rec02 S7–S8, rec08 S2 ×2). No
  `guideline_recurrence/4`, `guideline_frequency/5`, `guideline_recurrence_window/7` or
  `guideline_range/3` head. All 723 top-level proof items are `node/3`: no gate head is assumed.
- 43 answer groups over 12 documents, none repeated across documents (structural compare).
- A draft `clinical_marks/3` consulted into the shipped PVM derived all 12 documents' marks:
  13–330 ms per question in Node. One compiled mutant image builds in ~17 s.
- The shipped answer's all-or-nothing check counts derivations, not sentences: with one rec03
  S3 clause line overwritten by a copy of an S2 clause line (line count kept, gates fixed),
  `clinical_derive/4` yields sentences `[2,2,4]` and `clinical_advice/4` answers rec03 with S2's
  condition twice and S3's missing (`.scratch/probe-marks/dup.mjs`).

## Design

- ONE per-sentence document derivation, `clinical_derived(Doc, Derived)` in `PROOF_SOURCE`:
  `Derived = [d(S, Rule, Proof), ...]`, one entry per `clinical_gate/4` sentence in gate order,
  each the FIRST derivation of that sentence (`clinical_derive/4`, cut), failing when any
  sentence fails. `clinical_advice/4` and `clinical_marks/3` both call it, so the answer and its
  marks can never enumerate a document differently, and a duplicated derivation can no longer
  stand in for a missing sentence. User-approved edit: `clinical-answer-live` A4 pins
  `clinical_derived(Doc,Derived)` in place of the `findall(R-P,clinical_derive(Doc,_,R,P),Derived)`
  text.
- `clinical_marks(Q, Source, Marks)` at the END of `PROOF_SOURCE`. One solution per
  `clinical_source(Q,Doc,First)`, in that order; `Source = '$guideline_id'(product,Doc,First,
  ref(1),[])`, term-identical to the answer's.
- A sentence's marks are read from the TOP-LEVEL items of its own proof — the gate heads that
  derived under its premises; a top-level item other than `node/3` fails the sentence, so an
  assumed head can never read as a KB mark. Grades derive through `derive/5` at depth 1, each
  label through its entity fact; a grade whose clause does not derive is not a KB grade.
- Marks term:

  ```text
  marks(Doc, Grades, Groups)
    Grades      = [grade(Dimension, Value, Label), ...]       Label = the label entity's noun
    Groups      = [group(Sentences), ...]                     one per answer group, its order
    Sentences   = [sentence(S, Qualifiers, Preferences, Times), ...]   members, ascending S
    Qualifiers  = [qualifier(Class, Word), ...]
    Preferences = [preference(Preferred, Alternative), ...]   Alternative = none | a noun
    Times       = [interval(Role, Comparison, Count, Unit, Anchor) | order(Relation, Anchor), ...]
  ```

  Every list keeps proof order, which is source-line order, with repeats kept: deduplication is
  a reading's job.
- A referent's noun = its `guideline_entity/4` node in the same proof, else its
  `guideline_property/4` node (sync-u2 R15), else the `guideline_entity/4` assumption that
  typed it in that proof — the premise that applied the rule, for a referent the sentence's
  condition introduces. Amended for release `kb-2026-10-29-rc.1` (user ruling): its rec01 S6 and
  rec02 S2–S3, S10–S13 anchor an order or a preference on such a referent. The mark itself
  stays a derived head node. Original text: "A referent's noun = its `guideline_entity/4` node
  in the same proof, else its `guideline_property/4` node (sync-u2 R15).". An interval's comparison + count = its quantity's
  `guideline_cardinality/5` node in the same proof; its unit is the interval's own argument.
- All-or-nothing per document, each branch its own refusal: an unresolved preferred or
  alternative referent, interval quantity, interval anchor, order anchor or grade label; an
  interval anchor `none`; an alternative whose noun is `none`, the term's no-alternative sentinel
  (ann-review G2); a `guideline_recurrence/4`, `guideline_frequency/5`,
  `guideline_recurrence_window/7` or `guideline_range/3` node. Each leaves that document with no
  solution — never a partial set. The answer is untouched either way.
- Grouping: `clinical_groups/2` — the answer's own code — orders the groups; each group then
  takes, in gate order, the sentences whose rule has its consequent (subject, modality, actions,
  `==`). Every sentence lands in exactly one group.
- Read-only: the added text calls no write builtin and names none (`clinical-inference` P7
  scans `PROOF_SOURCE` whole, comments included).
- Catalog: each entry gains `marksGoal: "clinical_marks('<id>',Source,Marks)"`, generated by
  `clinicalArtifacts`; `catalogVersion` 3 → 4, the reader pins 4. User-approved edit:
  `tests/questions-catalog-version.test.ts` expects the refused version as `emitted + 1`.
- Service: `AnswerService.marks(id, budget, signal)` runs the catalog's `marksGoal` — an id in,
  never goal text — and returns the client's `QueryOutcome`, or `rejected` for an id outside the
  catalog. `engine:check` P6.2 pins its budget parameter as it pins `ask`'s.
- `src/questions/marks.ts`: `decodeMarks(term)` → typed marks, or `undefined` on ANY violation
  of the shape or the scalar domains below; pure readings; the statement join. No
  `JSON.stringify` (`kb:asset-check` bans it under `src/`): equality is structural over typed
  values.
- Scalar domains: groups and their sentence lists proper and non-empty; sentence ids positive
  safe integers, strictly ascending in a group; every noun, word, class and label a non-empty
  atom; `Dimension` ∈ {`strength`, `evidence`}; `Role` ∈ {`after`, `before`, `within`};
  `Comparison` ∈ {`eq`, `exactly`, `geq`, `greater`, `leq`, `less`, `about`}; `Relation` ∈
  {`before`, `after`}; `Count` a non-negative safe integer; `Alternative` `none` or a noun.
- Readings (the graph's words, `tools/kb/graph.mjs` `COMPARISON_WORDS`): nouns `-`/`_` → space;
  grade = labels, strength first whatever the input order, initial capital, `, `-joined;
  qualifier = words deduplicated after normalization in first-appearance order, `, `-joined (one
  word under two classes shows once); preference `X` or `X over Y`; interval `<bound> after|before <anchor>`
  or `within <bound> of <anchor>`, `<bound>` = comparison words + count + unit, plural `s` when
  the count is not 1; order `before|after <anchor>`. Identical readings show once.
- Join: for EVERY (solution i, item k) pair, item k of row i takes group k of solution i's
  document marks; a statement's marks = the union over all its pairs, in pair order. A document
  contributes nothing and counts as missing when its marks solution is absent, duplicated,
  undecodable, names another document or `Source`, or holds a group count unequal to its row's
  item count; so does an unstructured row.
- Controller: `marks` state (Interface) — `idle` (no answer solutions), `unavailable` (the
  engine has no marks path), `loading`, `settled` (goal + the outcome as returned). It starts at
  settle for any result carrying a solution (`answer`, `limit` or `cancelled`), through the one
  engine queue with `DEMO_BUDGET`, BEFORE the trace, because every `solve` clears the proof
  cache. A new run resets it to `idle` and aborts it; dispose aborts it; a queued call whose
  signal aborted never dispatches; a retired request's late outcome never lands; a rejected
  promise settles with an `error` outcome. Selection changes leave it alone.

## Interface (binding names; tests and implementation both hold to them)

```ts
// src/questions/catalog.ts
interface CatalogEntry { /* …existing fields… */ marksGoal: string }

// src/questions/service.ts
type MarksOutcome = QueryOutcome | { kind: 'rejected'; reason: 'unknown-id' };
AnswerService.marks(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<MarksOutcome>

// src/questions/marks.ts
type Comparison = 'eq' | 'exactly' | 'geq' | 'greater' | 'leq' | 'less' | 'about';
interface Grade { dimension: 'strength' | 'evidence'; value: string; label: string }
interface Qualifier { kind: string; word: string }               // kind = the qualifier class
interface Preference { preferred: string; alternative: string | null } // null = `none`
type TimeMark =
  | { kind: 'interval'; role: 'after' | 'before' | 'within'; comparison: Comparison;
      count: number; unit: string; anchor: string }
  | { kind: 'order'; relation: 'before' | 'after'; anchor: string };
interface SentenceMarks {
  sentence: number; qualifiers: Qualifier[]; preferences: Preference[]; times: TimeMark[] }
interface DocumentMarks { document: string; grades: Grade[]; groups: SentenceMarks[][] }
decodeMarks(term: PlTerm): DocumentMarks | undefined
gradeReading(grades: readonly Grade[]): string            // '' when none
qualifierReading(qualifiers: readonly Qualifier[]): string // '' when none
preferenceReading(preference: Preference): string
timeReading(time: TimeMark): string

type MarksState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'loading'; id: QuestionId; goal: string }
  | { kind: 'settled'; id: QuestionId; goal: string; outcome: MarksOutcome };
interface StatementMarks {
  qualifier: string;          // qualifierReading over every contributor, '' when none
  grade: string;              // '' when none OR when the once-per-run rule hides it
  preferences: string[];      // readings, deduplicated, contributor order
  times: string[];            // readings, deduplicated, contributor order
}
interface MarksView {
  statements: readonly (StatementMarks | undefined)[]; // index-aligned with the points
  missing: number;            // answer documents whose marks are not usable
  total: number;              // answer documents
  notice: boolean;            // settled or unavailable, and missing > 0
}
marksView(state: MarksState, points: readonly AnswerPoint[], rows: readonly AnswerRow[],
          answers: readonly PlSolution[]): MarksView

// src/demo/DemoController.svelte.ts
DemoEngine.marks?(id: QuestionId, budget: BudgetSpec, signal?: AbortSignal): Promise<MarksOutcome>
DemoController.marks: MarksState   // $state.raw
```

A `limit` or `cancelled` marks outcome keeps the documents it returned; documents it did not reach
count as missing. A statement's grade with several contributing documents reads each document's
grade, `; `-joined in contributor order.

## Acceptance

- M1 every catalog entry carries `marksGoal` = `clinical_marks('<id>',Source,Marks)`; v4 is
  emitted and pinned; the reader refuses another version by name; the re-derived records equal
  the shipped entries field for field.
- M2 per question, the marks goal settles `solutions` under `DEMO_BUDGET` through
  `EngineSession`, one solution per answer document in the answer's order, its `Source` display
  byte-equal to the answer's; inferences and wall-clock recorded.
- M3 per document, the group count equals the answer's and group i's sentences equal the
  sentences whose `clinical_rule/3` consequent equals answer group i's — a partition, no
  sentence twice or absent. Constructed `clinical_groups` inputs pin the order: A,B,A merges
  non-adjacent repeats in first-appearance order; a changed condition with an equal consequent
  merges; a changed consequent splits.
- M4 grades equal an independent parse of the bag's `pl/` text — (dimension, value, label noun)
  per document as ordered lists, the label joined through its entity fact, 24 in all.
- M5 each sentence's marks equal an independent parse of its compiled heads in the bag's `pl/`
  text, as ordered lists with repeats, empty sentences included: 22 qualifiers, 5 preferences,
  12 intervals, 6 orders.
- M6 derived, not read: in a compiled image whose gates and premises are the shipped ones, one
  qualifier, one preference, one interval and one order head each given an unprovable body
  literal (same line, four documents) removes exactly those four documents' marks — and their
  answers — while every other document's marks hold; a grade clause given an unprovable body
  drops exactly that grade; the image carries no `clinical_marks` fact and `clinical_marks/3` is
  static (`assertz` refused).
- M7 binding: bag-side mutants, gates regenerated — one grade label entity's noun rewritten to a
  PID-unique noun; one interval quantity's count rewritten — each moves exactly that mark and its
  reading, every other mark unchanged, the answer still derived.
- M8 fail closed: bag-side mutants, gates regenerated, one refusal branch per document — the
  preferred referent, the alternative referent, an interval quantity, an interval anchor, an
  order anchor and a grade label each left unresolved; an interval anchor rewritten `none`; a
  recurrence, frequency, recurrence-window and range head each planted — each removes exactly its
  document's marks while that document's answer still derives.
- M9 every shipped marks solution decodes; a malformed variant at each level — wrong functor,
  arity or kind, improper list, variable, empty list or atom, unknown role, comparison, relation
  or dimension, a bigint or negative count, sentence ids out of order — decodes to `undefined`.
- M10 readings: every comparison × role, count 1 and plural, every relation, arbitrary nouns,
  label order independent of input order, equal words under two classes once; the M7 label and
  count reach their readings.
- M11 join: permuted marks-document order; one statement text twice in one document and across
  two documents (union in pair order); one good and one missing contributor; a duplicated, a
  wrong-document and a wrong-`Source` solution; a group-count mismatch.
- M12 controller: the marks call precedes the trace call; `DEMO_BUDGET`; a new run resets and
  aborts it, dispose aborts it, and neither writes late; an aborted queued call never reaches the
  engine; a rejected call settles with an `error` outcome; a selection change during marks keeps
  it; `unavailable` without a path; `idle` without solutions; every outcome lands in `settled`
  as returned; a cancelled answer with partial solutions starts it. `marksView` maps each state:
  `loading` and `idle` show no rows and no notice; `unavailable` and a `settled` outcome without
  usable documents show the notice with `missing = total`.
- A7 (answer path) the duplicated-clause image above yields no rec03 answer and no rec03 marks,
  every other document unchanged.
- Register: M2 and M4–M8 and A7 join `binding:check` `REQUIRED` — why: the marks and the answer
  derive once per sentence at run time over `guideline_*`, never read back.
- Red witness: the tester's suite RED at base on behaviour — no `clinical_marks/3`, no
  `marksGoal`, no `marks.ts` exports, and the shipped answer accepting the A7 image — never a
  collection error alone; command in the commit body. Firing inputs: the M6–M8 and A7 images and
  the M9 malformed table.

## Red witness (`tester-4`, diff-blind, `wt/tester-4`)

- `tests/marks-live.test.ts` 12/13 RED at base `5124d88` + stubs `49a7727`: `pnpm exec vitest run
  tests/marks-live.test.ts`; `M3 constructed grouping` base-GREEN — it pins the shipped
  `clinical_groups/2` — and uncredited, since `pnpm stryker` mutates no Prolog. A7 is RED on the
  shipped answer itself: the duplicated-clause image kept rec03 (12 answers, 11 expected).
- `tests/marks-view.test.ts` 405/405 RED at base + stubs `49a7727`: `pnpm exec vitest run
  tests/marks-view.test.ts`.
- `tests/marks-controller.test.ts` 17/23 RED at base + stubs `49a7727`: `pnpm exec vitest run
  tests/marks-controller.test.ts`; the 6 `M12 idle without solutions` cases base-GREEN — the
  shipped controller never starts a marks call — and uncredited.
- Against MAIN's implementation: 441/441 green. The suites caught two gaps the implementation
  had: `Source` joined by display text, not by term; a queued trace dispatched after a newer run
  aborted it.
