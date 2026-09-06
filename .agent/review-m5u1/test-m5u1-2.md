# test-m5u1-2 — phase 2 red suite for M5 u1

Gate: `python3 -P .scratch/validate-report.py .scratch/agents/test-m5u1-2.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, dense/telegraphic, `→`/`=` notation, no prose padding, ≤400
chars. `evidence` = `path`, `path:line`, or `` `cmd` `` that reproduces it, ≥8
chars — a bare `` `cmd` `` placeholder fails the gate.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table are keyed by row id; write one only where MAIN
needs more than the row to rule. MAIN reads the table first — it is the budget.

Each row's `finding` = what the encoded case asserts + its RED-at-base and
GREEN-at-head result. `evidence` = `tests/<file>.test.ts:<line>` of the case.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| T1 | Frozen ordered hashes cover 7 questions, 12 terms, 12 source contributions plus old fact/record bytes; u1 census=48 rules, 346 premises, 48 gates → HEAD GREEN; BASE check pending. | `tests/clinical-records.test.ts:25` |
| T2 | Query-local own premises + 200k cap execute exact declared lines → HEAD RED: native=44 + named bounded=4, while ruled native=46 + same 4 is arithmetically impossible for 48 gates; BASE pending. | `tests/clinical-gate-live.test.ts:63` |
| T3 | Independent payload scanner + ACE↔PL bijection require 48 unique owning gates and exact both-way 686-line partition, ordered per sentence → HEAD GREEN; BASE check pending. | `tests/clinical-records.test.ts:76` |
| T4 | Raw-member scanner equals payload recipe at full keyed line/head/body vector hash `5eb476c05d18`; gate line/head projection matches modulo opaque skolem labels → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:116` |
| T5 | Real 48 sentences each have one body; rec07:S2 one-clause→`true` mutant must throw pinned `multiple antecedents` category → HEAD RED: implementation emits different exact category text; BASE pending. | `tests/clinical-records.test.ts:142` |
| T6 | Independent recursive decomposition matches all 346 premises; synthetic nested conjunction drops NAF, keeps duplicate/order/ground leaf, and true/NAF-only emit none → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:161` |
| T7 | Two derivations + reversed file-map bytes agree; canonical head-first/premise sharing matches every sentence and full skolem tokens stay sentence-scoped without ordinal pinning → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:255` |
| T8 | Synthetic repeated variable across heads/premise yields one shared opaque skolem per scope, three adjacent sentence/document scopes stay disjoint, and quoted `'acute-pain'` bytes survive → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:312` |
| T9 | Base-span hashes + invariant file bytes match; behavioural pins=48 parsed clauses, 12 canonical presentations, 12 aligned source passages, with 48 new rule/gate records required → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:369` |
| T10 | All 48 controlled clauses parse; the non-rebuildable `If then ...` sentinel throws the exact `not lossless` category, while 48 u1 gates are required for red credential → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:478` |
| T11 | Rule/premise/gate tuples remain question/source ordered with rec05 tenth, internals retain literal/site order, reruns + reversed file map agree, and two in-memory HEAD PVMs are byte-equal → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:497` |
| T12 | Frozen base helper=39,063 B/hash `4a40e521d277`; payload/PVM/QLF signed delta tuple reproduces across two independent base→HEAD derivations, with no magnitude ceiling pinned → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:554` |
| T13 | Missing/metadata-only/empty/CR ACE, missing PL marker, unterminated atom and multi-body mutants all abort before artifact use with fault-specific categories; 48 gates pin u1 → HEAD GREEN; BASE pending. | `tests/clinical-records.test.ts:572` |
| T14 | Ten ruled behaviours encoded: counts/ownership/vector/order/markers, head-first shared map, independent ordinals, fresh `_`, duplicates/true, unsupported controls, CR fail-close, P7/P10 replay → HEAD RED only on pinned P5 text; BASE pending. | `tests/clinical-records.test.ts:621` |
| T15 | Bounded sample rec01:S2=9 + rec04:S2=6 executes under own premises; deleting each exact site makes its gate fail, while one same-head/body relocation stays native and gate-fails → HEAD GREEN; BASE pending. | `tests/clinical-gate-live.test.ts:95` |

## Details

### T2

The 48-gate image returns 44 native successes and exactly the four ruled bounded cases: `rec01:3`, `rec02:3`, `rec02:8`, `rec05:4`. No other gate fails. The brief and contract partial verdict say 46/48 native, but the measured-constraint section names four non-native gates. Both assertions cannot hold: 46 + 4 exceeds the 48-gate domain. The case keeps `native=46` and the exact bounded set, so HEAD stays red pending MAIN's ruling.

### T5

D3 says that the guard matches the probe’s `multiple antecedents` category, and T14 ruling 9 says that P5’s message is pinned exactly. The synthetic mutant instead throws `cdc2022-opioid-rec07:2: 2 distinct antecedents, expected one`. The assertion retains the ruled exact category rather than accepting the implementation’s alternate wording.

### T14

All corrected rulings pass except ruling 9’s P5 exact text, which repeats T5’s finding. D9 fresh anonymous occurrences and D10’s three controls pass on synthetic inputs. A consumed PL CR also fails closed, but `deriveProvenance` rejects it first as `prolog-clause`; the public `clinicalArtifacts` surface cannot distinguish that preemption from D11’s later guard.
