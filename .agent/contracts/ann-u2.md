# ann-u2 — a qualifier before the verb leaves the verb slot

Request: user ruling at the IMPLEMENT orientation (`.agent/spec.md` `Decisions`): carry the adverb
apart from the verb in `clinical_rule/3`; the T9 frozen spans move as declared edits; every
rendered answer stays byte-identical; the term digests outside T9 that the change moves (T1
`terms`, T12/T14 `baselineHelper`) re-pin as approved figure edits. Closes the two
`.agent/deferred.md` rows on the verb slot (`clinical_rule/3` puts a qualifier in the action's
verb slot; A qualifier adverb takes the verb slot of a clinical action). Tier `kernel`: the answer
term is the answer path's own structure, and the chat's model reads it. Base: the plan commit
that lands this contract. Reviewed before code by `consultant-3`
(`.scratch/agents/consultant-3.md`, 12 rows: direction right; Q1–Q3 R3 R4 changed here).

## Measured at base (`5700e6c`, `.scratch/probe-marks/verbs.mjs`, consultant-3 probes)

- Fragments: 53 sentences, 75 actions. 19 open with a word the bag's qualifier vocabulary
  declares (`data/guidelines/<corpus>/vocabulary.tsv`, 56 `qualifier` rows), one word each:
  rec04 S7–S8 `carefully` ×4; rec05 S2–S3 `carefully`, S4–S5 `closely`, S5 `gradually`, S6
  `appropriately` ×2, S7 `abruptly` and S8 `rapidly` under `not`; rec07 S5 `regularly` ×2; rec08
  S3 `periodically` ×2; rec09 S5 `periodically`; rec11 S2 `particularly`. Each word equals a
  `guideline_qualifier/4` head word of its own sentence.
- Answer terms: 12 documents, 43 groups, 63 actions, 17 of them qualified — grouping merges
  identical consequents, so the two populations differ.
- Those actions record the adverb as `Verb` and open `Object` with the verb. With the leading
  words lifted, every one of the 69 `should`/`can` actions' verb equals a `guideline_event/3`
  lemma of its own sentence: 0 misses, against 19 at base.
- 3 qualifiers follow an object or a modifier — rec04 S5–S6 `the opioid cautiously`, rec11 S2
  `the benzodiazepine cautiously` — and stay in that text: their verbs already name the event.
- Rendering: all 75 action strings are unchanged by the split, both negative actions included;
  dropping the qualifiers changes all 19. The 43 rendered group statements digest to SHA-256
  `8ed9ee9e090f2b69baf398d846866a198bb91b5ce995da31d10600f8cef4f0ea` over
  `JSON.stringify(items)` in catalog document/group order.
- The ACE lexicon (`lexicon.ulex`, 17 `adv` entries) recognizes 2 of the 19 words.

## Design

- Term: `action(Polarity, Verb, Object, Modifiers, Qualifiers)`. `Qualifiers` = the LEADING
  surface qualifier words before the verb, in order, as atoms; `[]` when none. It is not the
  sentence's whole qualifier set. Every action carries it.
- Vocabulary: the selected document's corpus `vocabulary.tsv`, rows
  `qualifier\t<word>\t<class>`; a bag without that file, or with no such row, fails the build by
  name.
- Parser: `parseAdviceSentence(original, sentence, qualifiers)` takes the vocabulary word set as
  a REQUIRED argument; `parseAction` lifts the leading vocabulary words after an optional `not`,
  then reads the verb. The lossless rebuild emits `[not ][qualifiers ]verb[ object][ modifiers]`
  and still refuses any sentence it cannot rebuild byte for byte.
- Build checks in `clinicalArtifacts`, in this order, each naming document + sentence and reading
  the sentence's own HEADS: a qualifier on a copula (`is`) action; a lifted word that equals no
  `guideline_qualifier/4` head word of its sentence; a `should`/`can` verb that equals no
  `guideline_event/3` lemma of its sentence.
- Renderer (`src/questions/advice.ts`): `[not ]` + qualifiers + verb + object + modifiers, each
  part through the same `words`; `is not` unchanged; a malformed fifth argument falls back to the
  passage like any malformed shape.
- Reference producer (`tools/clinical-reference.mjs`): reads the vocabulary itself and emits the
  fifth argument from its own term builder; only the parser still crosses the boundary (D1's
  import assertion holds).
- Chat guide (`server/chat-guide.md`): the `clinical_rule/3` schema names `action/5` and the
  leading-qualifier list; the positive example term and the negative example goal use arity 5;
  the sentence documenting the defect goes.
- Pins that move: T9 — a declared edit per changed frozen span of `tools/kb/clinical.mjs` and
  `src/questions/advice.ts`, the `parsed` and `presentations` figures; T1 `terms`; T12/T14
  `baselineHelper` byte length + digest; the parser calls in T9 and T10 (corpus maps and the
  malformed sentence) pass the vocabulary; the `structuredAnswer` fixture
  (`tests/demo-controller.dom.test.ts`) gains the fifth argument; `.claude/rules/proof.md`'s
  `clinical.mjs` line anchors and their `docs/claims.md` row follow the moved lines.
- Mutation credit: `tools/mutation/` takes optional `STRYKER_MUTATE` (targets) and `STRYKER_SUITE`
  (one include), defaults unchanged, so `pnpm stryker` can run Q3's suite alone over
  `src/questions/advice.ts`; the survivor replay inherits the selection.

## Acceptance

- Q1 keyed identity, literal: every fragment action `(Doc, S, action index)` → qualifiers, verb,
  object, modifiers, against an oracle derived independently from the ACE text + vocabulary;
  19 of 75 fragment actions and 17 of 63 answer-term actions carry a one-atom list, the rest `[]`;
  argument 5 is a proper list of atoms. The live leg reads the rebuilt image's
  `clinical_rule/3` and `clinical_advice/3`.
- Q2 refusals, each reached on a planted bag mutant and naming its own defect: the vocabulary
  file absent; its qualifier rows empty; rec11 S2's `particularly` head removed (lifted word with
  no head); rec11 S2's `prescribe` event head removed (verb with no event); a copula carrying a
  qualifier. Propagation: a new qualifier word added consistently to the vocabulary, the ACE
  sentence and the compiled head reaches the action's list with the verb unchanged. A stacked
  pair of leading qualifiers parses and rebuilds.
- Q3 the 43 rendered group statements of the 12 answers, an ordered document/group vector with
  `structured === true` and 12 documents / 43 items, are byte-identical to base — the digest
  above. GREEN at base by design: its credit is `STRYKER_SUITE=<Q3 suite>
  STRYKER_MUTATE=src/questions/advice.ts pnpm stryker` killing default-operator mutants, every
  survivor ruled; a planted renderer that drops the qualifiers is its firing record.
- Q4 all 53 sentences still rebuild byte for byte, and the malformed-sentence refusal holds.
- Q5 `clinical-differential` D1–D4 and `clinical-answer-live` A2/A3 hold on the new terms.
- Q6 the guide's schema text, positive example and negative example goal use arity 5, and the
  negative example goal answers on the rebuilt image.
- Red witness: Q1, Q2 and Q6 RED at base on behaviour (arity 4, no refusals, guide at arity 4),
  command in the commit body; Q3 is the declared base-GREEN case above.

## Red witness (`tester-5`, diff-blind, `wt/tester-5` `f64bb2d`)

- `tests/qualifier-slot.test.ts` 15/18 RED at base `5124d88`, no stubs: `pnpm exec vitest run
  tests/qualifier-slot.test.ts` — arity 4 everywhere, no refusal on any planted mutant, the guide
  at arity 4. Base-GREEN, declared: Q3 (its credit below) and the two Q4 cases, which pin the
  shipped lossless guard beside T10 and stay uncredited.
- Against MAIN's implementation: 18/18 green. The suite caught two gaps the implementation had:
  a hyphenated leading qualifier refused as a verb before the lift; the guide not naming the
  list as the leading qualifiers.

## Q3 credit (`pnpm stryker`, default operators, MAIN's run)

`STRYKER_SUITE=tests/qualifier-slot.test.ts STRYKER_TESTNAME='Q3 all 43'
STRYKER_MUTATE=src/questions/advice.ts pnpm exec stryker run tools/mutation/stryker.config.mjs
--timeoutMS 60000 && node tools/mutation/survivors.mjs`: 214 mutants, **155 killed** by Q3's
output alone, 47 survived, 12 uncovered, 0 timed out. At Stryker's default timeout the same run
read 132 killed + 23 timed out: every timeout sat in `renderAction`/`renderRule` behind Q3's
~3.5 s engine boot, and none counts as a kill.

Every survivor by `advice.ts` line (count), each ruled against Q3's contract by MAIN, who did not
author Q3 — the 43 shipped statements, byte-identical:

- Input validation Q3's well-formed terms never fail — `malformed` 46–47 (2), `asAtom`/
  `asString`/`asList`/`asCompound`/`nonempty` 51 54 57 64 68 (16), the polarity and modality
  guards 81 94 96 (3), `presentClinicalAdvice`'s outer guards, fallback and `catch` 164–189 (31):
  behaviour Q3's contract leaves open, recorded. Graded elsewhere: `questions-live` `fails
  closed to the carried source passage for malformed inner structure` and `degrades to engine
  text for an unknown term shape`, `qualifier-slot` `Q1 the renderer accepts action/5 and
  rejects every malformed qualifier-list shape`.
- `words` 112 (1): the article regex without `+` on its hyphen group — EQUIVALENT: `an x-y-z`
  matches as `an x-y` and keeps `-z`, the same output for every input.
- `words` 113 (1) and 115 (1): `every clinician that does` occurs in no shipped answer, and the
  `every clinician` regex mutant renders the shipped subjects identically: the inputs Q3 owns
  never reach the difference. Recorded open.
- `coordinate` 122 (2): an empty coordination occurs in no shipped answer. Recorded open.
