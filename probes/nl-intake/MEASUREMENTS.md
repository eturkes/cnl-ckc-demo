# MAIN measurements — free-text intake feasibility (solo: script-derivable facts)

Base `1ecad59`, `kb/generated` as committed. Every number below re-derives from the named command.

## M1 — the KB's queryable vocabulary, as shipped

`jq -r '.stats' kb/generated/graph/semantic-graph.json` → 337 documents, 10,321 clauses,
2,901 nodes, 20,964 edges. Node kinds: document 337, entity 1,084, event 151,
operator-context 1,263, value 66. Edge kinds: implies 9,804, argument 3,805, cardinality
1,834, entity 1,834, event 1,254, preposition 1,197, operator 1,193, property 43.

Distinct labels: **1,084 entity** (mean 26.2 chars, max 109, 29,444 B total), **151 event**
(1,180 B), 66 value. Entities are kebab-case clinical concepts (`acute-pain`,
`naloxone-coprescribing`, `hepatic-insufficiency`); events are bare verbs (`prescribe`,
`taper`, `assess`); values carry numeric constraints (`na eq 30`, `na geq 5`) and property
polarity (`appropriate: pos`).

The whole 9,100,421 B graph asset already ships to the client. Nine schema predicates,
`tools/kb/proof.mjs:29-46`: `guideline_arg/4`, `guideline_cardinality/5`,
`guideline_document/3`, `guideline_entity/4`, `guideline_event/3`, `guideline_operator/3`,
`guideline_pp/4`, `guideline_property/4`, `guideline_schema_version/1`.

## M2 — lexical retrieval over that vocabulary fails on clinician phrasing

`python3 -P .scratch/probe-vocab-gap.py` → 12 clinician-phrased probes, 18 gold entities
verified present in the vocabulary: substring retrieval **returns 329 of 1,084 entities and
recalls 2/18 gold = 11%**. Illustrative probe, MAIN-authored phrases and gold, not a benchmark.

Worst cases both ways: `talk to the patient` returns 127 entities and recalls 0;
`liver problems` returns `delivery` and `local-delivery` while the right answers
(`hepatic-dysfunction`, `hepatic-insufficiency`) share no substring; `painkiller`,
`addiction`, `sleeping pills`, `quitting cold turkey` return 0. Firing input: poisoning one
gold label to `zz-not-an-entity` exits 1 naming it.

## M3 — the engine already runs a runtime-constructed goal

`EngineSession.solve(goal: string, budget, id)` at `src/engine/session.ts:307` takes an
arbitrary goal STRING: `assertGoalAvoidsReserved` → `term_string/2` parse check (an
unparsable goal raises rather than reading as zero answers, `:310-316`) → `wrapGoal` under
budget. The `query` protocol request carries `request.goal` (`:531-534`). No engine change
is needed to run a composed query.

## M4 — wrong queries fail closed, three different ways

`node .scratch/probe-adhoc-goal.mjs`, shipped `kb/generated/kb.pvm`:

| wrong thing | what happens |
|---|---|
| unknown predicate `guideline_treatment/3` | RAISES `Unknown procedure` — `unknown=error`, `autoload=false` |
| wrong arity `guideline_entity/3` | RAISES `Unknown procedure` — a different arity is a different predicate |
| unknown constant `'zz-not-a-concept'` | 0 solutions |
| unknown topic key `clinical_advice('zz-not-a-topic',S,A)` | 0 solutions |

So a composed query can return real rows, raise, or return nothing. It cannot fabricate an
answer. The residual risk is the well-formed query over real names that means something the
user did not ask — a meaning failure, not a safety failure.

## M5 — ad-hoc joins return real rows, through `clause/2`, under `user:`

Raw `engine.prolog.query` runs in module `system`; every image-compiled helper needs a
`user:` prefix (`wrapGoal` supplies it on the shipped path). Calling the schema predicates
directly on the bare image yields nothing — 1,693/1,834 entity clauses are RULES whose
bodies demand a clinical context (`.claude/rules/proof.md`, domain law). Two routes work:

- `clause/2` reaches the stored clauses. `node .scratch/probe-join.mjs`: documents carrying
  a `naloxone-coprescribing` entity → `['cdc2022-opioid-rec08-imp05']`, 2 ms. Reverse lookup
  `clinical_advice(Q,_,clinical_answer('cdc2022-opioid-rec08',_,_))` → `['opioid-safety']`, 50 ms.
- The meta-interpreter with query-local premises. `user:mi(clinical_advice('opioid-safety',S,A),1,P)`
  → a real `clinical_answer`, 70 ms. `user:clinical_derive('cdc2022-opioid-rec01',3,Rule,P)`
  → a proof rooted at `line(506)`, 3 ms.

## M6 — the graph vocabulary is a SUPERSET of the clause-head vocabulary

`node .scratch/probe-vocab-parity.mjs`:

| kind | clause-head distinct | graph distinct | graph-only | clause-only |
|---|---|---|---|---|
| entity | 800 | 1,084 | **284 (26%)** | 0 |
| event | 127 | 151 | **24 (16%)** | 0 |

Graph-only names appear only inside rule BODIES, and `clause/2` matches heads. Graph-only
samples include `PDMP-availability`, `MME-unit-per-day`, `AUDIT-C`, `ER-LA-opioid-dosage`,
and the events `outweigh`, `decide`, `need`.

**Consequence for any design that offers graph labels as query candidates:** 26% of entity
names and 16% of event names produce a head-form query with zero solutions, which renders
identically to "the guideline says nothing about this." A candidate list must be drawn from
the clause-reachable 800/127, or body-only names must resolve through graph edges instead of
a head query.

## M7 — lexical retrieval cannot feed a judgment stage here

`python3 -P .scratch/probe-candidate-recall.py`, BM25 over the 800 clause-reachable entity
names, 16 gold over 12 probes (gold restricted to clause-reachable names; `elderly patient`
carries none on purpose — the KB has no head-form entity for it):

| cutoff | recall |
|---|---|
| @10 | 0/16 = 0% |
| @30 | 1/16 = **6%** |
| @100 | 1/16 = 6% |
| @255 | 1/16 = 6% |

**8 of 12 probes score ZERO candidates** — no token overlap with any of the 800 names at all.
The one hit is `close-patient-monitoring@23` for `watch the patient closely`, the single probe
sharing a surface token.

This inverts the cookbook's BM25 → per-candidate-Noul recipe, whose precondition is that
stage 1 has recall: an omitted candidate can never be selected. The failures here are pure
synonymy (`liver`→`hepatic`, `addiction`→`opioid-use-disorder`, `sleeping pills`→
`benzodiazepine`), so no lexical stage-1 fixes them — character n-grams included.

Two viable replacements:

- **Eliminate stage 1.** The full vocabulary is 800 names / 21,098 B ≈ 5.3K tokens, so it fits
  in `ceil(800/255)` = **4 Choice questions** in ONE fan-out request, plus a runoff Choice over
  the four winners = 2 round trips. Events add 1 chunk (127 names). The docs prefer supplying
  the complete taxonomy over a trimmed subset, and say options cost a few tokens each.
- **Make stage 1 semantic.** Embeddings for retrieval, then the Noul rerank as published.
  Adds a dependency; an in-browser embedding model is heavy but keyless and offline.

## M8 — the judgment layer grounds at 82% where lexical retrieval reaches 6%

`TYPESAFE_KEY_FILE=… python3 -P .scratch/probe-grounding.py`, `jev-1.13.0`, no retrieval
stage: the 800 clause-reachable names split into 4 Choice questions of ≤254 options plus an
escape hatch, all in ONE fan-out request, then a runoff Choice over the groups that fired.

**grounding 9/11 = 82%, abstention 1/1.** Compare M7's BM25 6% recall@255 — and that baseline
measures only whether the gold reached a candidate list, while this measures exact selection.

| probe | grounded to | conf | covered |
|---|---|---|---|
| urine drug test | `toxicology-testing` | 0.81 | 0.84 |
| painkiller | `opioid-pain-medication` | 0.47 | 0.71 |
| addiction | `substance-use-disorder` | 0.36 | 0.74 |
| liver problems | `hepatic-insufficiency` | 0.95 | 0.62 |
| kidney problems | `renal-insufficiency` | 0.99 | 0.53 |
| quitting cold turkey | `abrupt-opioid-discontinuation` | 0.96 | 0.72 |
| **sleeping pills** | **abstained** (`benzodiazepine` exists) | 0.00 | 0.22 |
| overdose reversal | `naloxone-overdose-reversal-precaution` | 0.62 | 0.86 |
| talk to the patient | `clinician-patient-communication` | 0.36 | **0.12** |
| **how much is too much** | `pain-treatment-opioid-dosage-caution-threshold` | 0.65 | 0.70 |
| watch the patient closely | `patient-monitoring` | 0.23 | 0.38 |
| elderly patient | **abstained**, correct — no head-form entity exists | 0.00 | 0.24 |

Both misses, honestly: `sleeping pills` abstained when `benzodiazepine` was available — a
conservative failure, refusing rather than grounding wrong. `how much is too much` picked
`pain-treatment-opioid-dosage-caution-threshold`, a real name and arguably a better answer
than the gold `MME-dosage-determination`; **the gold was widened ONCE, on the clear-cut
`painkiller`/`addiction` pair, and deliberately not again** — widening until the score is
perfect is how an expected-output table stops being evidence.

`covered` is NOT a usable abstention threshold on its own: `talk to the patient` scored 0.12
and grounded correctly, below both true abstentions (0.22, 0.24). Abstention has to combine
it with the structural signals — no group fired, or the resulting query returns nothing.

Cost, 12 probes: 19 requests, **131,689 input + 130,188 output tokens**, 15.4 s total,
**0.81 s per request** ⇒ ~1.6 s per grounding over two round trips. Output tokens track input
because every Choice returns a full distribution over its 254 options; that is the dominant
cost and it does not shrink with a shorter question.

## M9 — end to end: grounded name → real query → real guideline rows

`node .scratch/probe-endtoend.mjs`. Code assembles the goal from a FIXED template; the model
contributed only the concept name, chosen from names the KB defines. 8/8 resolve, 0–3 ms:

| phrase | grounded name | documents |
|---|---|---|
| urine drug test | `toxicology-testing` | 4 |
| liver problems | `hepatic-insufficiency` | 1 (`rec04-imp05`) |
| kidney problems | `renal-insufficiency` | 1 (`rec04-imp05`) |
| addiction | `substance-use-disorder` | 1 |
| quitting cold turkey | `abrupt-opioid-discontinuation` | 3 |
| overdose reversal | `naloxone-overdose-reversal-precaution` | 1 |
| talk to the patient | `clinician-patient-communication` | 2 |
| painkiller | `opioid-pain-medication` | 1 |

Liver and kidney landing on the same sentence is correct — hepatic and renal insufficiency
are co-mentioned as one caution.

## M10 — free text routes onto the SEVEN already-verified goals, 13/13

`TYPESAFE_KEY_FILE=… python3 -P .scratch/probe-routing.py`. `src/questions/catalog.ts` is the
whole executable surface: seven curated topic keys, each with a goal the bag compiled and
`kb:export-check` pins. Routing free text onto one adds **no new executable surface** — the
goal that runs is byte-identical to the one today's drop-down runs, so the non-negotiable is
untouched by construction. One Choice over the seven catalog questions plus an `other` hatch.

**routing 13/13 = 100%; abstention 6/6 = 100%** over 19 MAIN-authored probes.

Every in-scope hit came at confidence 0.76–1.00, every abstention at 0.98–1.00. The two hard
abstentions were deliberately opioid-flavoured and both held: `what's the MME conversion
factor for oxycodone 5 mg?` and `can I write an opioid prescription for my own mother?`.

Honest limits: n=19, phrasing and gold both MAIN-authored, written knowing the seven topics —
that biases toward routability, so 13/13 is a feasibility signal and not an accuracy estimate.
One declared adjacency (`how do I tell if the opioid is still doing any good` accepts
`opioid-follow-up` or `continuing-or-tapering-opioids`, one clinical move split across two
curated topics). The `MME conversion` gold is contestable — the KB does hold a
`conversion-factor` concept — and was scored strictly as `other` anyway.

## M11 — the escape hatch is what refuses; the `covered` Noul cannot do it alone

Same run, both arms in ONE request over the same state: `hatched` offers `other`, `forced`
offers only the seven.

**The forced arm named a real topic on all 6 uncovered questions.** `what antibiotic for an
uncomplicated UTI?` → `acute-pain-prescription-duration`; `what's the capital of France?` →
`opioid-safety`; `how should I treat this patient's migraine?` → `when-to-use-opioids`. A
seven-option router with no hatch answers a migraine question with real opioid advice. The
hatch is load-bearing, and this is the measurement that says so rather than the assertion.

The `covered` Noul does NOT substitute for it:

| gate | score |
|---|---|
| `other` hatch | **19/19** |
| best single `covered` threshold (0.50) | 18/19 |

in-scope `covered` spans [0.50, 0.97], out-of-scope [0.01, 0.65] — they OVERLAP, so no
threshold separates them: `MME conversion` (out) scores 0.65 above `immediate release or
extended release` (in) at 0.50. This reproduces M8's finding on an independent probe set,
where `talk to the patient` grounded correctly at 0.12 below two true abstentions. **Treat
`covered` as one signal in a conjunction, never as the abstention gate.**

## M12 — cross-lingual routing holds: Japanese question, English options

`… python3 -P .scratch/probe-routing.py --ja`. The demo ships a Japanese interface, but
question text comes from the bag and stays English (`.claude/rules/i18n.md`), so a Japanese
user types Japanese against English options. That makes this a shipped-surface question.

**routing 7/7 = 100%; abstention 3/3 = 100%**, confidence 0.85–1.00, no prompt change and no
translation step — the Japanese phrase goes into `state` and the English catalog text stays
the option set.

The Japanese set is 10 probes and **omits both hard opioid-flavoured abstentions**, so its
clean Noul separation (threshold 0.54 → 10/10) is evidence that the hard cases were absent,
NOT evidence that the Noul gate works. M11's English number is the one that binds.

## M13 — the full intake ladder, end to end

Route → on `other`, ground the concept (M8) → resolve documents (M9). Stage 2 over the six
English `other` questions, `node .scratch/probe-endtoend.mjs <name>`:

| uncovered question | grounded to | documents |
|---|---|---|
| MME conversion factor | `conversion-factor` | 2 (`s33-01`, `s33-06`) |
| insurance cover this prescription | `therapy-reimbursement` | 1 (`rec02-imp04`) |
| prescribe for my own mother | `clinician-patient-relationship` | 1 (`s6-02`) |
| antibiotic for a UTI | — abstained | — |
| treat this patient's migraine | — abstained | — |
| capital of France | — abstained | — |

The layering is exactly right: the three opioid-adjacent questions no curated topic covers
still reach real guideline documents, and the three genuinely outside the KB return nothing
at both stages. Japanese behaves the same — `この処方は保険適用されますか？` →
`therapy-reimbursement`.

Cost: English arm 26 requests, 82,363 input + 69,542 output tokens, 19.6 s, 0.75 s/request;
Japanese arm 13 requests, 41,548 + 34,872 tokens, 9.3 s, 0.72 s/request. **Routing alone is
one request** — the 8-option Choice is cheap, and only an `other` verdict pays for the
800-name grounding fan-out.

## Probes

- `.scratch/probe-routing.py` — M10–M13. `--ja` cross-lingual arm, `--control` refusal
  control (a gold topic absent from the compiled catalog exits 1 naming it).
- `.scratch/probe-vocab-gap.py` — M2, with its refusal control.
- `.scratch/probe-candidate-recall.py` — M7, refuses a gold name that is not clause-reachable.
- `.scratch/probe-grounding.py` — M8. Needs `TYPESAFE_KEY_FILE`; sends only the phrase and the
  KB's own concept names, never KB content.
- `.scratch/probe-endtoend.mjs` — M9.
- `.scratch/probe-adhoc-goal.mjs` — M4, M5.
- `.scratch/probe-join.mjs` — M5 joins.
- `.scratch/probe-vocab-parity.mjs` — M6.

Scratch-local encoding; nothing here is wired into a gate.
