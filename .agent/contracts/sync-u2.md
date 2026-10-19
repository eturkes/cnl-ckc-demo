# sync-u2 — the graph projects the time, strength and unit annotations and the comparison conditions

Request: the upstream sync to `83569b1d` (user: "Sync + graph + answers" — graph projection in
this request; the answer panel's share routes to ITERATE). Tier: `kernel` for the producer
mapping (MEANING ruling: no edge may read as a claim the source denies), `data` for counts.
Base: `c511755` (sync-u1), where `tools/kb/graph.mjs` `UNPROJECTED` skips every annotation kind.
Reviewed before code by `consultant-1` (`.scratch/agents/consultant-1.md`, 18/18): direction
right, ten rows changed — every change below is its finding, adopted.

## Measured at `c511755` (`parseClauseSites` over the verified bag)

| clause | heads (fact/rule) | body goals | shape notes |
|---|---|---|---|
| `guideline_grade/5` | 24 / 0 | 0 | `Rec` = the S1 `recommendation` referent; 12 documents × {strength, evidence} |
| `guideline_preference/4` | 0 / 26 | 0 | 17 with `Alternative = none` (copula `X is preferred`), 11 of them under should/negation |
| `guideline_qualifier/4` | 4 / 269 | 650 | classes usuality, ideality, focus, manner, force, possibility, applicability |
| `guideline_interval/6` | 1 / 32 | 171 | 20 heads with `Anchor = none` |
| `guideline_order/4` | 4 / 83 | 21 | each beside a `guideline_pp` with identical arguments (108/108) |
| `guideline_recurrence/4` | 1 / 10 | 4 | |
| `guideline_frequency/5` | 0 / 1 | 0 | |
| `guideline_recurrence_window/7` | 0 / 4 | 0 | anchor may be a body variable |
| `guideline_range/3` | 0 / 8 | 0 | pairs with the one `at least` interval on the same event |
| `guideline_unit/3` | 2 / 57 | 281 | heads: unit = the quantity's noun (59/59); bodies: the unit slot is a variable (281/281) |
| `guideline_satisfies/4,6` | — | 270 + 281 | each shares comparison + count variables with one body `guideline_cardinality` goal (551/551; 543 actual, 8 negated) |

Raw `value:reference:` nodes at `c511755`: 154 — 137 property referents (no node declares the
`guideline_property` referent), 17 converted time quantities (no entity literal); 36 on the
previous bag.

## Quantity readings

`B(Q)` = a quantity referent's reading: its `guideline_cardinality` comparison + count + unit,
in upstream's words — `eq` plain `N`, `exactly N`, `at least N`, `more than N`, `at most N`,
`less than N`, `about N` — plus the unit identifier. The cardinality is the referent's own head
in the sentence (skolem) or its goal in the clause (variable). A converted condition (comparison
and count are variables) reads the matched `guideline_satisfies` bound. A range folds into the
reading of its `Low`: `at least 8 to 12 hour` (upstream: the minimum lies between the two counts,
`High` bounds nothing about the event); a range without its paired interval refuses the build.

## Producer mapping (`tools/kb/graph.mjs`)

Each row emits one edge per clause head, and per body goal once per sentence and world, through
the scope-keyed `condition()` dedup (`mnt-d49`). Each edge's scope is its clause's context —
for a threshold, the context of its matched cardinality goal, since `guideline_satisfies` has
no context slot. Edges carry `label` (forward reading) and, where the reading turns,
`inverse` (the reading from the target end).

| clause | kind | source → target | label / inverse |
|---|---|---|---|
| grade | `grade` | `Rec` → value `<Dimension>: <Value>` | `grade` / `grade of` |
| preference, `Alternative` named | `preference` | `Preferred` → `Alternative` | `preferred over` / `less preferred than` |
| preference, `Alternative = none` | `preference` | `Preferred` → value `preferred` | `preference` / `preference of` |
| qualifier | `qualifier` | `Event` → value `<Word>` | `<Class>` / `<Class> of` |
| interval, `Anchor` named | `time` | `Event` → `Anchor` | `B after` / `B before`; `B before` / `B after`; `B apart from` both ways |
| interval, `Anchor = none` | `time` | `Event` → the quantity node | `duration` / `duration of`; `after-offset` / `after-offset for`; `before-offset` / `before-offset for`; `distance` / `distance for` |
| order | — | folds into its `guideline_pp` edge | that edge reads `occurs before` / `occurs after` (swapped from the target) |
| recurrence | `time` | `Event` → the quantity node | `recurrence gap` / `recurrence gap of` |
| frequency | `time` | `Event` → `Counted` | `count C per P` / `count C per P in` |
| recurrence window | `time` | `Event` → `Anchor` | `recurrence gap G; window L from` / `anchors window L with recurrence gap G for` |
| range | — | folds into its `Low`'s reading | — |
| satisfies (body) | `threshold` | the cardinality referent's node → value `<bound> <limit>[ <unit>]` | `condition bound` / `condition bound of` |
| unit | — | — | unprojected: a head unit restates its noun; a constant unit unequal to its noun refuses the build by name as a consumer limit; a variable unit is the converted case below |

- **The quantity node.** A ground quantity reads as value `B(Q)`; a converted quantity (no
  entity literal, variable unit) as one value node labelled `time quantity` with a
  referent-specific id — the explicit exception to label-keyed values, since it has no noun to
  merge. Its `guideline_pp` edge, its time edge and its threshold edge all meet that one node,
  and the bound rides the threshold value alone (the comparison's unit belongs to the bound,
  never to the node).
- **R15 (MAIN, after the review).** A property referent — typed by a `guideline_property`
  clause, declared by no entity or event — resolves to that property's value node, at clause
  scope for a body variable and at sentence scope for a skolem. The copula's `argument 2` edge
  then targets the property, and the property edge, now a self-edge, is not emitted. Measured:
  829 clause-scoped property referents, 0 with two properties.
- Value nodes otherwise key on category + label (`valueId`): one `carefully` or one
  `strength: strong` node serves every clause naming it.
- `GRAPH_SCHEMA_VERSION` 2 → 3 in `graph.mjs` and `src/graph/model.ts`.

## Model + view

- `GRAPH_EDGE_KINDS` gains `grade`, `preference`, `qualifier`, `time`, `threshold`;
  `EDGE_SOURCE_ROLES`: an event source for `qualifier` and `time`, an entity source for
  `grade`; `preference` and `threshold` admit an entity or a value source.
- `parseEdge` reads the optional `inverse`; `graphRelation(edge, from)` returns it at the
  target end, and stays the ONE derivation of a reading: `EdgeView` gains `inverse`, and
  `edgeLabelFrom` reads it in place of the view's own `REVERSED_RELATIONS` table, which retires.
  `scopeReading` composes after orientation, unchanged.
- No new node kind, colour or legend entry; the queued palette row is untouched.

## Acceptance

- A1 every annotation head and body goal maps to exactly its row — an edge with that kind,
  endpoints and label, a fold, or the unit exception — graded by an independent derivation
  from `parseClauseSites` that shares no emit code.
- A2 MEANING, readings from BOTH ends with a nonempty scope, the scope after `→` from the target
  (reader-relative ruling): `rec05` S7's `abruptly` reads `manner · should · negated` from the
  event and `manner of → should · negated` from the value, dashed; `rec07` S2's interval reads
  `at least 1 week after · should` and `at least 1 week before → should`; a `within` reads `apart
  from` from either end; a grade fact reads unscoped. Joins `binding:check` `MEANING`.
- A3 no `value:reference:` node remains whose referent a `guideline_property` or a converted
  `guideline_unit` goal types (154 at base).
- A4 each threshold value equals its satisfies bound, and its scope equals its cardinality
  goal's (the 8 negated comparisons read negated).
- A5 `pnpm graph:check` R1–R7 + C1–C12 hold; the census and rules move with the asset.
- Firing inputs: a qualifier re-scoped to `actual` (A2 names it); one threshold given the rule
  head's context (A4 names the goal line); a constant unit unequal to its noun (the build
  refuses it by name); one emitted annotation edge dropped (A1 names kind + line).
