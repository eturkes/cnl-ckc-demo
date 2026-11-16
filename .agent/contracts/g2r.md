# g2r — the projection's domain limits repaired (`kernel`)

Review row GI-1 (`.agent/review.md`), ruled by consultant-12, a non-author: Stryker S170–S173 are
`specified` survivors, so each shape `g2.md` `## Domain limits` carved out earns a red-first case
expecting the faithful projection, and the readers are repaired. Schema oracle = the bag's
`README-dist.md`, never the producer. Scope: `tools/kb/provenance.mjs` `parseClauseSites` (clause
attribution, `## Clause attribution`), `tools/kb/frames.mjs` (g1) + `tools/kb/network.mjs` (g2); the
shipped bag states none of the shapes, so the shipped projection does not move.
Review: consultant-12 r2 (SCHEMA, SHAPES, GAPS pass; PRED, ALIAS, CLOSE fail(med) → D2, D7, D9, D10
and this Close, amended).

## Schema facts the predicates encode (README-dist)

- `Time annotations`: "The patterns read referents by their noun anywhere in the document."
  `Ranged minimum`: a `range` preposition "pairs with the one `at least` interval on the same
  event … The pair emits `guideline_range(Context, Low, High)` beside the interval clause";
  `guideline_range` = "the minimum that the interval quantity `Low` states lies from the count of
  `Low` to the count of `High`". ⇒ `Low` may be an antecedent referent (W2), and the range belongs
  with the interval that names `Low`.
- `Order`: "its object is a plain referent. The object may come from the antecedent or from an
  earlier sentence." `Proof traces`: "A clause that cites an earlier sentence's referent still
  names its own sentence." ⇒ a head of sentence S may name `'$guideline_id'(product, D, S', ref(N),
  Deps)` with S' < S in the same document D; that referent is S′'s, never S's own `ref(N)`.
- `Deps` (README-dist 161–171): "Both variants of a split mint the same `ref(N)`, distinguished by
  `Deps`" ⇒ an earlier referent's identity = (S′, `ref(N)`, `Deps`); its noun = S′'s `ref(N)` noun.
  `Deps` "is the concatenation of every curried antecedent segment's top-level referents" ⇒ a
  `Deps` entry is a referent — a variable or an id term — never a data atom.
- `Proof traces`: a trace "names the resolved clause by its document and by the `% S<n>:` block that
  holds the clause's line" ⇒ a clause's sentence = its `% S` block, whichever sentence its head's
  first id names. `Context ::= actual | '$guideline_id'(context, DocId, S, box(B), Deps)`, `box(B)`
  numbering "a sentence's operator boxes"; witness terms "carry the document's own document,
  sentence, and variant coordinates" ⇒ only a `product` id may name another sentence.

## Shapes (constructed bags, `tests/support/network-subject.ts` `synthetic`)

- **W2 inherited range low** — `g2.md` `Domain limits` W2 verbatim: `If at least 8 hours elapse
  then every clinician should wait for the hours to 12 hours.`, its ten heads and body as listed
  there (`Low` = the antecedent quantity `Q` = `dep(0)`, `High` = `ref(4)`, `wait` = `ref(5)`).
- **Earlier-sentence order object** — S1 introduces a product referent X (`ref(k)`, noun ≠ any S2
  noun); S2's `guideline_order(Ctx2, E2, before, X)` (and its `guideline_pp(Ctx2, E2, before, X)`)
  name X by S1's id, while S2 has its OWN `ref(k)` with another noun (the alias trap).
- **Earlier-sentence argument** — S2's `guideline_arg(Ctx2, E2, 2, X)` names S1's X the same way.
- **Earlier-sentence range low** (consultant-12 r2 GAPS) — S1 `At least 8 hours elapse.` (root fact:
  quantity L = `ref(1)`, `hour`, `geq 8`); S2 `A clinician waits for the hours to 12 hours.` (root
  fact, context `actual`): `guideline_interval(actual, E2, duration, L, hour, none)` and
  `guideline_range(actual, L, H)`, H = S2's `ref(4)` — the range head's FIRST id names S1.

## Predicates

- D1 W2 derives: no error; one frame; the `wait` occurrence's payload holds the `range` item and
  the `interval` item; every non-operator head of the frame belongs to exactly one occurrence
  (N6 over the frame). RED on the `b54372d` producer: `line 11 belongs to no occurrence`.
- D2 the range follows its interval, never ownership by subject alone: W2 plus a second main event
  of the same frame naming the SAME inherited `Low` as its ordinary argument 2
  (`guideline_arg(Ctx, E2, 2, Q)`, no interval, no other time pattern on E2) puts the range in the
  interval event's payload and in no other occurrence's.
- D3 earlier-sentence order object derives: no error; the order payload item names X's noun from
  S1, never S2's own `ref(k)` noun; S2's frame `deps` come from S2's own ids alone. RED on
  `b54372d`: `FrameError: line … id names …:1`.
- D4 earlier-sentence argument derives: the occurrence's target is X's noun (rule T1), never S2's
  own `ref(k)` noun. RED on `b54372d`: the same refusal.
- D5 still refused, each by name, in ANY head position: a head id naming another document; one
  naming a LATER sentence; a `context` or `witness` id naming another sentence — README-dist admits
  none of them → `parseClauseSites` `ProvenanceError` `prolog-sentence` naming the line. RED on
  `b54372d` in a non-first position, which `sentenceFrames` refused as `FrameError` instead.
- D6 the shipped projection is unchanged: the real bag's model minus `envelope` is byte-identical
  before and after the repair (`jq -cS 'del(.envelope)' | sha256sum`, recorded in the commit body);
  N1–N12 and F1–F24 stay green.
- D7 S170–S173's sites rerun under Stryker over the repaired code (scope = the lines that replace
  them): every mutant reported killed or survived, each survivor ruled (specified → its missing
  case; equivalent or obsolete → its reason) in `mnt5-stryker.md` `## g2r`.
- D9 an earlier referent keeps its `Deps`: two S2 events citing S1's `ref(k)` under different
  `Deps`, each bound by S2's body, are two referents — neither event embeds in the other through
  them, while each reads S1's `ref(k)` noun. RED on `b54372d` (refusal) and under the `inv` mutant
  keying an earlier referent by (S′, `ref(N)`) alone.
- D10 narrower domain, refused by name: an earlier referent whose `Deps` hold a variable the citing
  clause's body leaves unbound (`_` included) — README-dist gives no reading that tells two such
  citations apart — refuses with `FrameError` naming the referent and the variable.

## Clause attribution (user ruling: T9's declared edit of `tools/kb/provenance.mjs`)

`parseClauseSites` took a clause's sentence from its head's FIRST id and refused unless it was the
`% S` block. Repair: the clause's sentence = its block; every head id checked — same document,
sentence ≤ block, only a `product` id naming another sentence; `sentenceFrames` drops its own id
check (`parseClauseSites` owns it in every position). Accepted cost (user): a clause filed under a
LATER block whose ids all name earlier sentences is no longer caught.

- D8 earlier-sentence range low derives: `parseClauseSites` gives the range clause S2 (its `% S`
  block); S2's `wait` occurrence payload holds the `range` item and the `interval` item, the range's
  `Low` reading S1's noun. RED on `b54372d`: `ProvenanceError: prolog-sentence: line …`.

## Close

`g2.md` `## Domain limits` → retired, pointing here; GI-1 → fixed. The `.agent/deferred.md` row `A
consequent head naming an inherited or earlier-sentence referent refuses the build` narrows to what
stays refused: D10's unbound `Deps`.

## Red witnesses

Cases `G2R-D1`…`G2R-D10` (`tests/network-fields.test.ts` D1–D4, D8, D9; `tests/frames.test.ts` D5,
D10), blind, `tester-10`, `wt/tester-10` `5047771`, from this contract + README-dist alone. Each RED on
`60f2217` (the unrepaired readers) — `(cd <worktree at 60f2217> && pnpm exec vitest run
tests/frames.test.ts tests/network-fields.test.ts -t 'G2R-D')` → 8 failed:

- D1, D2 `NetworkError: range-inherited:1#1: line 11 belongs to no occurrence`;
- D3 `FrameError: line 17: id names earlier-order:1`; D4 `FrameError: line 13: id names earlier-arg:1`;
- D5 `expected error to be instance of ProvenanceError` (a non-first id threw `FrameError`);
- D8 `ProvenanceError: prolog-sentence: line 21`;
- D9 `FrameError: line 13: id names g2r-dependency-identity:1`;
- D10 `expected [Function run] to throw error matching /unbound/iu but got 'line 13: id names earlier-arg:1'`.

Both suites green on the repaired readers: 40/40 at the merge, 48/48 with the D7 cases. D10 also caught the first repair's message naming the reader's
canonical variable (`V2`), which the source line never writes; the message names the variable as
written.

## D7 result

`mnt5-stryker.md` `## g2r`: S170–S173 killed (each fails G2R-D2 on replay); 114 of 236 mutants
killed, every one left alive or hanging ruled by consultant-12 (r3–r5): 44 `equivalent`, 5 `open`,
9 `hang`. Cases `G2R-R02`, `R08`, `R17`, `R18`, `R31`, `R32`, `G2R-Q03`, `Q26` (MAIN, from the
`specified` rulings; named by ruling row) are credited by the kill of their mutant, never by a red
at `60f2217`.
