# orc-m5u2 — independent reference evaluator

| id | finding | evidence |
| --- | --- | --- |
| O1 | pass: cap 1 proves 47/48; cap 2 is least sufficient; cap 3 adds nothing | independent `ref_*` MI; exact failure = `cdc2022-opioid-rec05:5` |
| O2 | pass: every 1-of-686 site erasure defeats its sentence; zero survivors; snapshots restore 48/48 | `node tools/reference-evaluator.mjs O2`: 686 failed / 0 survived; 6560.380 ms native-SWI wall time |
| O3 | pass: withheld premises leave 2/48 sentences but 0/12 complete documents | survivors = `rec10:4`, `rec12:3`; both have zero premises (`true` antecedents) |
| O4 | pass: erasing all schema clauses leaves 0/48 sentences and 0/12 documents | dynamic campaign image reaches 0 schema clauses; snapshot restores 48/48 |
| O5 | pass: all 346 premises occur only as line-free assumption leaves; every proof line is gate-owned; all 12 document unions are exact | 48 proofs; 3,930 assumption occurrences / 346 unique; 686/686 unique proof lines; zero violations |
| O6 | pass: 144 cap×sentence runs stay inside 16 MiB / depth 100 / 100,000 inferences / 1,000 ms; all four handed gates terminate | maxima = 7.390 ms, 7,144 inferences, call depth 63; four gates all `proved` |
| O7 | pass: evaluator core contains zero world-write calls; 48 derivations preserve all nine static schema predicates and counts; direct `assertz` is denied | before=after across 10,321 clauses; permission error names `guideline_schema_version/1` |
| O8 | pass: record-free bag census independently yields 12 documents / 48 sentences / 686 sites / 346 premises | `node tools/reference-evaluator.mjs O8`: zero disagreements; 24 preamble sites excluded, preventing 710 |

## O1

Command:

```sh
node tools/reference-evaluator.mjs O1
```

Raw stdout:

```text
O1 {"caps":[{"cap":1,"failed":1,"failures":["cdc2022-opioid-rec05:5"],"proved":47},{"cap":2,"failed":0,"failures":[],"proved":48},{"cap":3,"failed":0,"failures":[],"proved":48}],"least_sufficient_cap":2,"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"}}
```

Result: contract P3 reproduced exactly. The oracle derives each count; no production evaluator source was read or imported.

## O2

Command:

```sh
node tools/reference-evaluator.mjs O2
```

Raw stdout:

```text
O2 {"outcomes":{"failed":686,"survived":0},"post_campaign_proved":48,"survivors":[],"total":686,"wall_ms":6560.379505157471,"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"}}
```

Result: semantic claim reproduced exactly. The native-SWI campaign took 6.560 s, versus MAIN's 4.8 s candidate run; this is an environment/runtime timing difference, not a survivor or budget failure. Each test converts shipped schema predicates to dynamic only in the campaign image, erases the cited clause inside `snapshot/1`, and invokes the same independent evaluator. The static image remains separate for O7.

## O3

Command:

```sh
node tools/reference-evaluator.mjs O3 O4
```

Raw O3 stdout:

```text
O3 {"document_grain":{"proved":0,"total":12},"sentence_grain":{"proved":2,"total":48},"survivors":[{"gate_lines":[9137,9138,9139,9140,9141,9142,9143,9144,9145,9146,9147,9148,9149,9150,9151,9152,9153,9154,9155,9156],"id":"cdc2022-opioid-rec10:4","premises":0,"proof_nodes":20,"reason":"true_antecedent"},{"gate_lines":[9991,9992,9993,9994,9995,9996,9997,9998,9999,10000,10001],"id":"cdc2022-opioid-rec12:3","premises":0,"proof_nodes":11,"reason":"true_antecedent"}],"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"}}
```

Result: P5's grain distinction reproduces exactly. `cdc2022-opioid-rec10:4` and `cdc2022-opioid-rec12:3` have `true` antecedents, zero compiled premises, and therefore no assumptions to withhold. Each containing document has other gated sentences, so neither document completes.

## O4

Raw O4 stdout from the same command:

```text
O4 {"document_grain":{"proved":0,"total":12},"post_snapshot_proved":48,"remaining_schema_clauses":0,"sentence_grain":{"proved":0,"total":48},"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"}}
```

Result: P5's schema-erased control reproduces exactly. The test converts all nine schema predicates to dynamic only in the campaign image, retracts all their clauses inside `snapshot/1`, and observes 0/48 sentences plus 0/12 documents. Rollback restores 48/48.

## O5

Command:

```sh
node tools/reference-evaluator.mjs O5
```

Raw stdout:

```text
O5 {"assumption_leaves_with_source_lines":0,"assumption_occurrences":3930,"document_line_unions":{"matching":12,"mismatches":[],"total":12},"extra_assumptions":[],"missing_premises":[],"premise_literals_as_line_nodes":[],"premise_records":346,"proof_line_occurrences":686,"proof_lines_outside_sentence_gate":[],"proofs":48,"unique_assumptions":346,"unique_proof_lines":686,"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"}}
```

Result: P6 reproduces exactly. The 346 distinct premise literals appear across 3,930 assumption-leaf occurrences because each gated clause independently discharges its antecedent. No premise literal appears as a line node. No assumption leaf carries a line. All 686 proof lines belong to their sentence gates, and all 12 document unions equal their cited sets.

## O6

Command:

```sh
node tools/reference-evaluator.mjs O6
```

Raw stdout:

```text
O6 {"depth_limit_failures":[],"envelope":{"depth":100,"inferences":100000,"stack_bytes":16777216,"wall_ms":1000},"inference_limit_failures":[],"measured_cases":144,"native_unresolvable_handover":[{"cap":2,"depth_reached":43,"id":"cdc2022-opioid-rec01:3","inference_guard":"!","inferences":2469,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":0.2429485321044922},{"cap":2,"depth_reached":40,"id":"cdc2022-opioid-rec02:3","inference_guard":"!","inferences":1737,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":0.4589557647705078},{"cap":2,"depth_reached":39,"id":"cdc2022-opioid-rec02:8","inference_guard":"!","inferences":1493,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":0.4248619079589844},{"cap":2,"depth_reached":57,"id":"cdc2022-opioid-rec05:4","inference_guard":"!","inferences":5885,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":3.240346908569336}],"worst_call_depth":{"cap":1,"depth_reached":63,"id":"cdc2022-opioid-rec04:5","inference_guard":"!","inferences":3925,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":0.7264614105224609},"worst_inferences":{"cap":1,"depth_reached":63,"id":"cdc2022-opioid-rec05:2","inference_guard":"!","inferences":7144,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":2.1343231201171875},"worst_proved_tree_schema_depth":{"cap":1,"depth_reached":18,"id":"cdc2022-opioid-rec01:2","inference_guard":"!","inferences":310,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":0.1533031463623047},"worst_wall":{"cap":3,"depth_reached":33,"id":"cdc2022-opioid-rec12:4","inference_guard":"!","inferences":789,"outcome":"proved","proved_tree_schema_depth":1,"wall_ms":7.390260696411133},"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"}}
```

Result: P8 reproduces. The run fixes SWI's stack limit at 16 MiB, warms all cases, then measures all 48 sentences at caps 1, 2, and 3. No inference or depth guard fires. The maximum call depth is 63/100, the maximum is 7,144/100,000 inferences, and the worst wall time is 7.390/1,000 ms. Native SWI returns `!` for each deterministic success from `call_with_inference_limit/3`; `inference_limit_exceeded` never appears. `rec01:3`, `rec02:3`, `rec02:8`, and `rec05:4` all terminate as `proved` at cap 2.

## O7

Command:

```sh
node tools/reference-evaluator.mjs O7
```

Raw stdout:

```text
O7 {"after":[{"arity":4,"clauses":2513,"dynamic":false,"predicate":"guideline_arg"},{"arity":5,"clauses":1834,"dynamic":false,"predicate":"guideline_cardinality"},{"arity":3,"clauses":337,"dynamic":false,"predicate":"guideline_document"},{"arity":4,"clauses":1834,"dynamic":false,"predicate":"guideline_entity"},{"arity":3,"clauses":1254,"dynamic":false,"predicate":"guideline_event"},{"arity":3,"clauses":1193,"dynamic":false,"predicate":"guideline_operator"},{"arity":4,"clauses":1003,"dynamic":false,"predicate":"guideline_pp"},{"arity":4,"clauses":16,"dynamic":false,"predicate":"guideline_property"},{"arity":1,"clauses":337,"dynamic":false,"predicate":"guideline_schema_version"}],"before":[{"arity":4,"clauses":2513,"dynamic":false,"predicate":"guideline_arg"},{"arity":5,"clauses":1834,"dynamic":false,"predicate":"guideline_cardinality"},{"arity":3,"clauses":337,"dynamic":false,"predicate":"guideline_document"},{"arity":4,"clauses":1834,"dynamic":false,"predicate":"guideline_entity"},{"arity":3,"clauses":1254,"dynamic":false,"predicate":"guideline_event"},{"arity":3,"clauses":1193,"dynamic":false,"predicate":"guideline_operator"},{"arity":4,"clauses":1003,"dynamic":false,"predicate":"guideline_pp"},{"arity":4,"clauses":16,"dynamic":false,"predicate":"guideline_property"},{"arity":1,"clauses":337,"dynamic":false,"predicate":"guideline_schema_version"}],"derived":48,"direct_assertz":{"error":"error(permission_error(modify,static_procedure,guideline_schema_version/1),context(system:assertz/1,_7876))","status":"permission_error"},"snapshots_identical":true,"static_predicates_after":9,"static_predicates_before":9,"image_contract":{"schemaVersion":1,"documents":337,"prolog":"10.1.13"},"evaluator_mutation_calls":[]}
```

Result: P7 reproduces. The independent evaluator core contains no `assertz`, `asserta`, `retract`, `retractall`, `erase`, or `dynamic` operation. A full 48-sentence pass leaves all 10,321 schema clauses unchanged and all nine predicates static. A direct `assertz/1` still raises `permission_error(modify,static_procedure,guideline_schema_version/1)`.

## O8

Command:

```sh
node tools/reference-evaluator.mjs O8
```

Raw stdout:

```text
O8 {"selection_rule":"base cdc2022-opioid-recNN ACE documents; implication files excluded","selected_documents":["cdc2022-opioid-rec01","cdc2022-opioid-rec02","cdc2022-opioid-rec03","cdc2022-opioid-rec04","cdc2022-opioid-rec05","cdc2022-opioid-rec06","cdc2022-opioid-rec07","cdc2022-opioid-rec08","cdc2022-opioid-rec09","cdc2022-opioid-rec10","cdc2022-opioid-rec11","cdc2022-opioid-rec12"],"measured":{"documents":12,"content_sentences":48,"content_sites":686,"premises":346},"u1_claim":{"documents":12,"content_sentences":48,"content_sites":686,"premises":346},"disagreements":[],"per_document":[{"document":"cdc2022-opioid-rec01","sentences":3,"sites":43,"premises":14},{"document":"cdc2022-opioid-rec02","sentences":7,"sites":73,"premises":30},{"document":"cdc2022-opioid-rec03","sentences":3,"sites":54,"premises":30},{"document":"cdc2022-opioid-rec04","sentences":9,"sites":72,"premises":131},{"document":"cdc2022-opioid-rec05","sentences":4,"sites":72,"premises":36},{"document":"cdc2022-opioid-rec06","sentences":1,"sites":9,"premises":11},{"document":"cdc2022-opioid-rec07","sentences":4,"sites":144,"premises":8},{"document":"cdc2022-opioid-rec08","sentences":4,"sites":54,"premises":8},{"document":"cdc2022-opioid-rec09","sentences":5,"sites":57,"premises":34},{"document":"cdc2022-opioid-rec10","sentences":3,"sites":44,"premises":20},{"document":"cdc2022-opioid-rec11","sentences":2,"sites":15,"premises":20},{"document":"cdc2022-opioid-rec12","sentences":3,"sites":49,"premises":4}],"missing_sentences":[],"unexpected_sentences":[],"distinct_antecedent_violations":[],"excluded_file_preamble_sites":24,"record_predicates_consulted":[]}
```

Result: the independent bag census agrees with u1 on all four totals. It selects the 12 base recommendation ACE documents by corpus path, counts nonmetadata ACE sentences, scans the matching PL files, and derives premise counts from each unique raw antecedent. It does not consult `clinical_rule/3`, `clinical_premise/4`, `clinical_gate/4`, or `clinical_use/2`. Resetting the open sentence at each `% file:` boundary excludes exactly 24 preamble facts; retaining the prior sentence would produce the warned 710-site miscount.
