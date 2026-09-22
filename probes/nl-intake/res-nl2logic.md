# res-nl2logic — natural language → logic form: approaches, failure modes, verification, UX

Gate: `python3 -P /run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/validate-report.py /run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/agents/res-nl2logic.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, ≤400 chars, dense/telegraphic, `→`/`=` notation, no prose padding.
`evidence` = URL, paper id, repo path, or `` `cmd` ``, ≥8 chars. Primary sources and measurements outrank popularity; name the measurement.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table keyed by row id; write one ONLY where MAIN cannot rule from the row.

Context: the target is a static browser demo over a compiled SWI-Prolog knowledge base of clinical guidelines. Answers MUST come from real Prolog execution — a language model may help FORM the query, never supply the answer. The stack already names Attempto Controlled English (APE, itself Prolog) as the planned free-text route. WebSearch allowance = 35 calls, shared session budget; prefer `WebFetch` on primary sources.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| nl.ape | pass: APE offers a deterministic controlled-English front end, but only if the intake is constrained to ACE rather than advertised as unrestricted free text. | https://attempto.ifi.uzh.ch/site/docs/ape_webservice.html |
| nl.ace-cost | fail(med): Pure ACE is learnable but not free text: 20 untrained AceWiki users produced 148/186 correct+sensible sentences (79.6%), taking 11 min to first success; 20.4% still failed despite a predictive editor, and accepted ACE can encode an unintended anaphora. | https://ceur-ws.org/Vol-543/kuhn_swui2008.pdf; https://attempto.ifi.uzh.ch/site/docs/ace_interpretationrules.html |
| nl.sempar | pass: Classical semantic parsing still leaves a large search/model gap: Overnight's original system scored 46.3% denotation accuracy versus an 84.2% oracle; unseen lexical/schema items remain ungroundable unless the target predicate inventory is supplied. | https://nlp.stanford.edu/pubs/wang-berant-liang-acl2015.pdf |
| nl.llm2pl | fail(high): Direct query-text generation is not dependable: a traffic-law→Prolog evaluation observed invented/inconsistent predicates; supplying predicate names plus arities raised accuracy only to 85% GPT-4o, 80% Gemini, 75% Llama. | https://doi.org/10.1145/3769126.3769222 |
| nl.slot | pass: Constrain selection to the exported schema, not Prolog bytes. On Spider, schema-aware PICARD moved T5-3B from 71.5→75.5% exact match and 74.4→79.3% execution, while cutting execution-error outputs 12→2%; constraints remove invalid forms, not wrong intent. | https://aclanthology.org/2021.emnlp-main.779/; https://github.com/ServiceNow/picard |
| nl.guard | pass: Type/arity/name/constant guards reject invalid forms, not a valid wrong grounding. PICARD cut execution-error SQL 12→2%; SQL→NL back-translation reranking added 2–3 points on Spider and 5–9 on OTTA → echo meaning for confirmation. | https://github.com/ServiceNow/picard; https://aclanthology.org/2022.icnlsp-1.7/ |
| nl.hybrid | pass: LINC is the closest proven split: the LM emits first-order logic, Prover9 alone returns true/false/unknown; GPT-4 rose from 72.2% CoT to 98.3% on 360 ProofWriter cases, yet FOLIO fell 75.3→72.5%, exposing semantic translation as the residual risk. | https://aclanthology.org/2023.emnlp-main.313/ |
| nl.clar | pass: Ask only when competing grounded intents change the goal. MISP-SQL’s binary component questions moved WikiSQL SQLNet 68.1→82.4% execution with 1.713 questions; real users moved 66.0→71.7%, showing benefit but also interaction noise. | https://aclanthology.org/D19-1547/ |
| nl.nodata | pass: Abstain on uncovered concepts. In ~3,000 failed real queries, 20% were problematic; DTE detected ambiguity at 75.2% and unanswerability at 70.2% on real data. Those miss rates forbid confidence-only fallback → require coverage checks and “KB cannot answer.” | https://aclanthology.org/2023.findings-acl.352/ |
| nl.eval | pass: Report intent-slot exact match + abstention coverage, then actual Prolog answer/proof agreement; answer accuracy alone hides wrong queries. On 21 Spider systems, one-database execution had 6.5% mean false positives; test-suite execution judged 100/100 audited disagreements correctly. | https://aclanthology.org/2020.emnlp-main.29/ |
| nl.ui | pass: Show an editable meaning, not raw Prolog: STEPS lets users edit a clause-by-clause natural-language query explanation and evaluated 24 participants. Here: typed slot chips + plain-language echo; show ranked alternatives only at ambiguous slots, then run. | https://aclanthology.org/2023.emnlp-main.1004/ |
| nl.risk | fail(high): WHO warns health LMMs can be false, biased, incomplete and induce automation bias. Notice: research demo; limited exported guidelines; intake can misparse/omit context; not medical advice or for care; confirm the shown interpretation and source with a clinician. | https://www.who.int/publications/i/item/9789240084759 |

## Row prompts

- `nl.ape` — Attempto Parsing Engine as a real dependency: current repo, licence, SWI-Prolog version compatibility, source size, whether it loads under `swipl-wasm` in a browser, and what its lexicon requirement costs (a KB-specific lexicon must be supplied). Report concrete numbers — files, lines, load time if anyone has measured it.
- `nl.ace-cost` — The controlled-natural-language burden, measured: published studies of how well untrained users write ACE or a comparable CNL, error rates, and the documented failure mode where a sentence is grammatical but means something else. This is the case AGAINST a pure-CNL intake; give the evidence honestly either way.
- `nl.sempar` — Classical semantic parsing into logical forms (grammar-based, CCG, seq2seq) for knowledge-base question answering: what the field established about accuracy ceilings and about handling out-of-vocabulary predicates. Name benchmarks and figures.
- `nl.llm2pl` — Language models emitting Prolog / ASP / Datalog / SPARQL directly: named systems and papers with MEASURED accuracy, plus the documented failure modes (hallucinated predicates, wrong arity, plausible-but-wrong constants). Report figures, not impressions.
- `nl.slot` — Typed slot filling and constrained decoding vs free generation of a query: published evidence that restricting the model to SELECT from an enumerated vocabulary beats letting it write the query text. Include grammar-constrained decoding and schema-linking results from the text-to-SQL literature.
- `nl.guard` — Verifying a machine-formed query BEFORE execution: type/arity checking against the schema, constant-existence checks, round-trip back-translation to natural language for user confirmation, and empty-result diagnosis. Name which of these are shown to catch real errors and at what rate.
- `nl.hybrid` — Systems that put a language model in front of a symbolic solver while keeping the answer symbolic: named architectures, what each delegates to which side, and how each proves the answer was not generated. This is the exact architecture the target needs; be concrete.
- `nl.clar` — Clarification and disambiguation in natural-language interfaces to structured data: when to ask the user rather than guess, published interaction patterns, and measured effect on task success.
- `nl.nodata` — The refusal path: how good systems detect that a question is outside the knowledge base's coverage instead of returning a confident wrong answer. Include calibration/abstention results.
- `nl.eval` — How these systems are evaluated: exact-match on the logic form vs answer accuracy vs user task success, and which metric is honest for a demo that claims deterministic execution. Recommend one.
- `nl.ui` — Interface patterns for showing a parsed query back to a user before it runs: query-as-sentence echo, editable slot chips, confidence disclosure, alternative interpretations. Name real systems that do it and what they show.
- `nl.risk` — Clinical-domain risk of a mis-parsed question: published guidance on language-model interfaces over clinical guidance, and what a demo should state about its own limits. Note that this target is a demonstration, not clinical software — report what an honest limitation notice must say.
