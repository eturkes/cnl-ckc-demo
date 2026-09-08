# rev-sem-2 — verdict table

| id | finding | evidence |
| --- | --- | --- |
| S2 | fail(high): both graph views erase “should not” and the negated premise, so a prohibited conditional action reads as positive. | `tests/graph-semantics.review.test.ts:39`; `pnpm exec vitest run tests/graph-semantics.review.test.ts --project node` → RED |
| S5 | fail(high): displayed action edges discard modal, negative, conditional, and numeric scope, so they are not the assertions made by the source. | `tests/graph-semantics.review.test.ts:48`; `src/graph/model.ts:350` |
| S9 | fail(med): the headline count calls 1,288 nodes “concepts/actions,” but 53 are value/attribute nodes that the same view labels as attributes. | `tests/graph-semantics.review.test.ts:56`; `src/graph/SemanticGraph.svelte:299` |
| S11+ | fail(med): nested `guideline_operator` edges replace their asserted outer context with the document node, breaking endpoint and scope fidelity. | `tools/kb/graph.mjs:262`; `tests/graph-semantics.review.test.ts:66` → RED |
| S12+ | fail(high): a Horn rule with a negated premise and negated recommendation is synthesized as positive `outweigh → consider` support. | `tools/kb/graph.mjs:398`; `tests/graph-semantics.review.test.ts:78` → RED |
| S13+ | fail(med): the runtime parser accepts predicate-role-invalid edges, then the concept projection silently drops them instead of failing closed. | `src/graph/model.ts:220`; `tests/graph-semantics.review.test.ts:92` → RED |
| S14+ | fail(high): the primary projection deletes operator/cardinality scope but retains dependent action edges, changing qualified relations into unconditional ones. | `src/graph/model.ts:350`; `tests/graph-semantics.review.test.ts:48` → RED |
| S15+ | fail(high): the answer highlight uses a direct positive event edge that bypasses both hidden negation contexts, so its displayed path is not source-faithful. | `tests/graph-semantics.review.test.ts:103`; `src/graph/model.ts:714` |
| S16+ | pass: all 12 prepared contribution roots stay inside cited evidence entities; lexical and semantic-role ranking never promotes an external central node. | `src/graph/model.ts:627`; `tests/graph-live.test.ts:87`; targeted Vitest PASS |
| S17+ | fail(high): bounded ontology neighborhoods systematically omit scope-bearing modality/cardinality context and disclose only size caps, not changed meaning. | `src/graph/model.ts:844`; `src/graph/SemanticGraph.svelte:444`; red test at `tests/graph-semantics.review.test.ts:48` |
| S18+ | fail(med): canvas arrows retain edge direction, but HTML navigation reuses forward labels at target nodes and reverses the asserted relation. | `src/graph/model.ts:1063`; `tests/graph-semantics.review.test.ts:113` → RED |
| S19+ | pass: all 12 prepared answer highlights select representatives from the cited document and controlled-sentence set; broader context stays unhighlighted. | `src/graph/model.ts:680`; `tests/graph-semantics.review.test.ts:121`; targeted Vitest PASS |

## Added fixed check set

- **S11+** — Every explicit-schema edge preserves its predicate, argument role,
  direction, document, sentence, and endpoint identity.
- **S12+** — Every Horn implication edge is a real premise-to-conclusion dependency
  within one source clause; variable, polarity, and operator scope remain intact.
- **S13+** — Graph parsing fails closed on malformed kinds, dangling endpoints, and
  missing relation semantics instead of coercing or dropping them.
- **S14+** — Primary projection hides nodes only; it never invents an unsupported
  direct edge or turns a scoped relation into an unconditional assertion.
- **S15+** — Every displayed or highlighted path consists of displayed source-backed
  edges; hidden segments are neither silently contracted nor misattributed.
- **S16+** — Primary-concept ranking selects a concept supported by the question and
  cited proof contribution; centrality alone cannot become source meaning.
- **S17+** — Bounded neighborhoods retain the relation context needed to interpret
  every shown edge, or explicitly disclose the semantic omission.
- **S18+** — Canvas and HTML views give each shared node and edge the same direction,
  label, provenance scope, polarity, and modality.
- **S19+** — Answer-focus highlighting attributes only relations supported by that
  live proof contribution; cross-source context never inherits its attribution.

## Register

## Detail

### S17+

**Source sentence:** “An opioid-continuation may initiate a long-term-opioid-therapy after 30 days.” (`cdc2022-opioid-rec02-imp21.ace:1`.)

**Rendered reading:** A neighborhood around `initiate` includes the actor, target, and `after day` edges while excluding `may` and `30`. The ordinary graph view offers no semantic-omission disclosure; it mentions only a readability cap when node or edge limits bind.

**Divergence:** `src/graph/model.ts:844` constructs every regular neighborhood from the already scope-stripped concept index. `src/graph/SemanticGraph.svelte:444` explains cardinality of the view, not lost modal/cardinality meaning. Close by retaining edge scope or disclosing each omitted qualifier beside the affected relation; the modal/count red test at `tests/graph-semantics.review.test.ts:48` must turn green.

### S18+

**Source sentence:** “If a benefit outweighs a risk then every clinician should work with a patient and should optimize a nonopioid-therapy and should continue an opioid-therapy.” (`cdc2022-opioid-rec05.ace:3`.)

**Rendered reading:** The canvas edge points `outweigh → continue` and labels it `condition supports`. When the selected HTML node is `continue`, the row reads `condition supports outweigh`, reversing subject and object.

**Divergence:** `src/graph/model.ts:1063` handles reverse wording only for argument and event edges; every other directed relation returns its forward label. `src/graph/SemanticGraph.svelte:493` places that label before the peer regardless of direction. Close by defining forward and reverse readings for every directed edge kind; make `tests/graph-semantics.review.test.ts:113` green.

### S15+

**Source sentence:** “If an opioid-benefit does not outweigh an opioid-risk then every clinician should not consider an opioid-therapy for an acute-pain.” (`cdc2022-opioid-rec01.ace:3`.)

**Rendered reading:** The orange answer highlight includes `edge:512:12`, a direct `outweigh —condition supports→ consider` link. Neither omitted negative context appears anywhere in the displayed path.

**Divergence:** The highlight skips the source’s scope-bearing nodes and presents the opposite positive dependency as proved. `src/graph/model.ts:711` promotes the synthesized edge by its concept key. Close by requiring highlighted paths to retain every semantically load-bearing hidden segment or an equivalent visible qualifier; make `tests/graph-semantics.review.test.ts:103` green.

### S14+

**Source sentence:** “An opioid-continuation may initiate a long-term-opioid-therapy after 30 days.” (`cdc2022-opioid-rec02-imp21.ace:1`.)

**Rendered reading:** The primary map retains `initiate`, its actor and target, and an `after day` edge. It removes the `may` operator and the `30` cardinality relation.

**Divergence:** This is not a presentation-only hiding operation: the remaining graph asserts an unqualified initiation after an unquantified day. `src/graph/model.ts:350` deliberately admits the dependent concept edges while excluding their scope edges. Close by projecting scoped semantic units rather than independent edges; make `tests/graph-semantics.review.test.ts:48` green.

### S13+

**Source sentence:** “If an opioid-benefit does not outweigh an opioid-risk then every clinician should not consider an opioid-therapy for an acute-pain.” Its compiled `guideline_arg` at line 513 makes `event:consider` the source and `entity:clinician` argument 1.

**Rendered reading:** A mutated shipped asset can retain the same valid IDs but source that argument from the document. `parseSemanticGraph` accepts it; the ontology filter then silently omits the malformed relation.

**Divergence:** The source requires an event-to-participant argument. `src/graph/model.ts:220` checks enums, duplicate IDs, and endpoint existence, but never the endpoint kinds or predicate-kind contract. Close by validating every edge schema’s allowed endpoint kinds, predicate, and label/role domain before model construction; make `tests/graph-semantics.review.test.ts:92` green.

### S12+

**Source sentence:** “If an opioid-benefit does not outweigh an opioid-risk then every clinician should not consider an opioid-therapy for an acute-pain.” (`cdc2022-opioid-rec01.ace:3`.)

**Rendered reading:** The derived edge `edge:512:12` says `outweigh —condition supports→ consider`. This unqualified edge enters the primary ontology and both renderers.

**Divergence:** The source premise is `not outweigh`, and its consequent is `should not consider`. `tools/kb/graph.mjs:398` selects only body and head event labels, then synthesizes positive support without either operator context. Close by deriving implication through the complete scoped body/consequent structure and make `tests/graph-semantics.review.test.ts:78` green.

### S11+

**Source sentence:** “If an opioid-benefit does not outweigh an opioid-risk then every clinician should not consider an opioid-therapy for an acute-pain.” Its PL head at combined line 507 is `guideline_operator(<negative-context>, <should-context>, should)`.

**Rendered reading:** The graph asset emits the `should` operator edge from `document:cdc2022-opioid-rec01` rather than from the sentence’s negative operator-context node.

**Divergence:** `tools/kb/graph.mjs:262` hard-codes every operator edge source to `doc`, discarding the head’s first argument. The separate generic implication does not repair the false explicit-schema edge. Close by resolving `args[0]` as the operator edge source and make `tests/graph-semantics.review.test.ts:66` green.

### S9

**Source sentence:** “If a patient has a long-term-opioid-use and needs an additional-medication for an acute-pain and a nonopioid-medication is possible then every clinician should use the nonopioid-medication.” (`data/guidelines/cdc-2022-opioid/ace/cdc2022-opioid-rec01-imp04.ace:1`.)

**Rendered reading:** The property value `possible: pos` is an `attribute` in the legend and node-kind label, but `src/graph/SemanticGraph.svelte:299` includes it in the headline “concepts/actions” total.

**Divergence:** `src/graph/model.ts:334` defines values as concept nodes, so `conceptNodeCount` returns 1,288. Only 1,235 participating nodes are entities or events; 53 attributes inflate the reader-facing label. Close by either naming all three counted kinds or counting only entities/actions, then make `tests/graph-semantics.review.test.ts:56` green.

### S5

**Source sentence:** “An opioid-continuation may initiate a long-term-opioid-therapy after 30 days.” (`data/guidelines/cdc-2022-opioid/ace/cdc2022-opioid-rec02-imp21.ace:1` in the extracted vendored bag.)

**Rendered reading:** Both views show `initiate` with `actor` opioid continuation, `target` long-term opioid therapy, and `after` day. Neither view shows `may` or `30`.

**Divergence:** The source asserts a possible action after a quantified interval. `src/graph/model.ts:350` excludes both operator and cardinality edges while retaining their dependent argument and preposition edges. The projection therefore changes possibility into an unqualified action and “30 days” into “day.” Close by preserving every relation’s modal and quantitative scope in both views, then make `tests/graph-semantics.review.test.ts:48` green.

### S2

**Source sentence:** “If an opioid-benefit does not outweigh an opioid-risk then every clinician should not consider an opioid-therapy for an acute-pain.” (`data/guidelines/cdc-2022-opioid/ace/cdc2022-opioid-rec01.ace:3` in the extracted vendored bag.)

**Rendered reading:** Both graph views receive a concept projection containing positive `outweigh` and `consider` actions, ordinary actor/target edges, and `outweigh —condition supports→ consider`. It contains neither `should` nor any negative marker.

**Divergence:** The source negates the condition and the recommendation. `src/graph/model.ts:350` removes operator edges, while `tools/kb/graph.mjs:398` adds the unqualified direct implication. The canvas arrow and HTML relationships therefore assert the opposite-scoped reading. Close by retaining visible polarity and modality in the projected relation, then make `tests/graph-semantics.review.test.ts:39` green.
