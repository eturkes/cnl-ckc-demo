# Free-text intake feasibility — measurements

Exploration, not a unit. Base `1ecad59`. Probe code + full measurement text = branch
`wt/res-nl-intake` `ae608ff`, path `probes/nl-intake/` — **never rename that branch**; it is
the only copy. It stays off `main` because its four `.mjs` probes fail `pnpm lint` under the
typescript-eslint project service, and widening the ESLint ignore list is a grader change
reserved for its own approved unit.

`.agent/spec.md` `Intent` names free-text intake as the future form of question intake. This
records what it would cost and what it would risk. **User ruling: hold — nothing is built.**
Queue row → `.agent/deferred.md`.

## The KB's own vocabulary, and why retrieval cannot feed a judgment stage

| id | measurement |
|---|---|
| M1 | 1,084 entity / 151 event / 66 value labels; 2,901 nodes, 20,964 edges, 337 documents, 10,321 clauses; 9 schema predicates at `tools/kb/proof.mjs:29-46` |
| M2 | substring retrieval over those labels recalls **2/18 gold = 11%** on 12 clinician-phrased probes, returning 329 of 1,084 |
| M6 | the graph vocabulary is a strict SUPERSET of the clause-head vocabulary — entity 800 reachable vs 1,084 graph = **284 graph-only (26%)**, event 127 vs 151 = **24 (16%)** |
| M7 | BM25 over the 800 reaches **recall@10 0%, recall@255 1/16 = 6%**, with **8 of 12 probes scoring zero candidates** |

M6 is the trap: a graph-only name such as `PDMP-availability` or `MME-unit-per-day` appears
only inside rule bodies, so a head-form query on it returns zero solutions and renders
identically to "the guideline says nothing about this". Any candidate list must be drawn from
the clause-reachable 800/127.

M7 kills the published BM25 → rerank recipe here. Its precondition is that stage 1 has
recall, and the failures are pure synonymy (`liver`→`hepatic`, `addiction`→
`opioid-use-disorder`, `sleeping pills`→`benzodiazepine`), which no lexical stage 1 fixes.

## What the engine already permits

| id | measurement |
|---|---|
| M3 | `EngineSession.solve` (`src/engine/session.ts:307`) accepts an arbitrary goal STRING — parse-checked via `term_string/2`, budget-wrapped. No engine change is needed to run a composed query |
| M4 | fail-closed three ways: unknown predicate and wrong arity both RAISE (`unknown=error`, `autoload=false`); unknown constant and unknown topic key return 0 solutions |
| M5 | raw `engine.prolog.query` runs in module `system`, so image helpers need a `user:` prefix. 1,693/1,834 entity clauses are RULES needing premises, so `guideline_*` called directly on the bare image yields nothing. Working routes: `clause/2` (2 ms joins), `user:mi/3` (70 ms), `user:clinical_derive/4` (3 ms) |

M4 is the safety floor: a composed query can return real rows, raise, or return nothing — it
cannot fabricate an answer. The residual risk is a well-formed query over real names meaning
something the user did not ask. That is a **meaning** failure, not a safety failure, and it is
what M10–M12 measure.

## The judgment layer

`jev-1.13.0` via `POST https://api.typesafe.ai/v1/systemone`. `model` is REQUIRED on the raw
API (422 without it). Choice caps at **255 options INCLUDING the escape hatch** → 254 real
names per group.

| id | measurement |
|---|---|
| M8 | concept grounding with stage 1 ELIMINATED — 800 names in 4 Choice groups of ≤254 plus a hatch, one fan-out request, then a runoff: **grounding 9/11 = 82%**, abstention 1/1 |
| M10 | routing onto the SEVEN compiled catalog goals: **13/13 = 100%**, abstention **6/6 = 100%**, 19 probes |
| M11 | the FORCED arm — same request, hatch removed — named a real topic on **all 6** uncovered questions |
| M12 | Japanese question against English options: **7/7 routing, 3/3 abstention**, no translation step |
| M13 | full ladder: 3 of 6 uncovered questions still reach real documents through M8 + M9; the 3 genuinely outside the KB return nothing at both stages |

### Routing is the cheap, safe form and it should be preferred

`src/questions/catalog.ts` is the whole executable surface — seven topic keys, each with a
goal the bag compiled and `kb:export-check` pins. Routing free text onto one adds **no new
executable surface**: the goal that runs is byte-identical to the one the drop-down runs, so
the non-negotiable is untouched by construction. Concept grounding (M8) does add surface and
a new answer shape the proof ladder does not currently render.

### The escape hatch is load-bearing; the `covered` Noul is not a gate

M11 is the decisive control. Without a hatch, `what antibiotic for an uncomplicated UTI?` →
`acute-pain-prescription-duration`, `what's the capital of France?` → `opioid-safety`, and a
migraine question → `when-to-use-opioids`, each answered with real opioid advice.

| gate | score |
|---|---|
| `other` hatch | **19/19** |
| best single `covered` threshold (0.50) | 18/19 |

In-scope `covered` spans [0.50, 0.97] and out-of-scope [0.01, 0.65] — they OVERLAP, so no
threshold separates them. M8 found the same independently, where `talk to the patient`
grounded correctly at 0.12, below two true abstentions at 0.22 and 0.24. **Treat `covered` as
one signal in a conjunction — hatch fired, no group fired, query returned zero rows — never as
the abstention gate.**

## Cost

M8: 19 requests, 131,689 input + 130,188 output tokens, 0.81 s/request ⇒ ~1.6 s per grounding
over two round trips. M10–M13 English arm: 26 requests, 82,363 + 69,542 tokens, 0.75 s/request.

Output tokens track input because every Choice returns a full distribution over its options;
that is the dominant cost and a shorter question does not shrink it. **Routing alone is ONE
request over 8 options** — cheap — and only an `other` verdict pays for the 800-name fan-out.
Against the 5 s answer budget, routing plus the existing `clinical_advice` derivation (70 ms,
M5) leaves ample headroom.

## Honest limits

- n=19 routing, n=12 grounding. Phrasing and gold both MAIN-authored, written knowing the
  seven topics — that biases toward routability. **13/13 is a feasibility signal, not an
  accuracy estimate.**
- The M12 Japanese set is 10 probes and OMITS both hard opioid-flavoured abstentions, so its
  clean Noul separation is evidence those cases were absent, not that the Noul gate works.
  M11's English number binds.
- M8's gold was widened exactly ONCE, on the clear-cut `painkiller`/`addiction` pair, and
  deliberately not again for `how much is too much` — widening until the score is perfect is
  how an expected-output table stops being evidence.
- Only `probe-vocab-gap.py`, `probe-candidate-recall.py` and `probe-routing.py --control`
  ship refusal controls. The other five probes are demonstrations, not graded checks.
- O3 template selection beyond topic routing, and O4 clinical-context premise compilation into
  `derive/5`, are UNMEASURED. O4 needs a new engine surface.

## Delivery posture

Key stays server-side. User ruling: **serverless proxy**, never `dangerouslyAllowBrowser` —
the SDK refuses browser construction by default, and a static Pages deploy cannot hide a key.

`res-proxy` survey (branch `probes/nl-intake/PROXY-RESEARCH.md`, 10/10 rows) recommends
**Cloudflare Workers**, Deno Deploy runner-up. Decider is abuse containment: a public demo
proxying to a metered key is an open wallet, and Workers is the only free candidate pairing an
edge rate-limiting binding with a hard 100k req/day ceiling. A one-fetch proxy fits the 10 ms
CPU limit because network wait is excluded.

Two bindings this repo would feel:

- `README.md:112` documents `connect-src 'self'` as the policy a host should set; it must gain
  the Worker origin. Claims row R040 grades that `index.html` ships no CSP meta tag and is
  unaffected.
- `wrangler` supports only non-EOL Node. `package.json` `engines` already reads
  `^20.19.0 || >=22.12.0`, so Node 22 is permitted; what holds CI at `20.19.0` is the
  secretlint `^12` cap (`.claude/rules/toolchain.md`). A separate Node 22 deploy job leaves
  the gate job untouched.
