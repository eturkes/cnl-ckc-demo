# mnt-d49 — orphan operator contexts carry their literal set; a check proves none is skipped

Row: `.agent/deferred.md` "71 operator contexts have no edge in the shipped graph" (`pri` med).
User rulings: the producer emits each orphan's literal set, AND the condition dedup keys on
scope (approval of this contract). The edge population therefore moves by the merged
relations alone. The operator count stays at 1,193, and the node population stays unchanged.
Tier: `data` for the asset field; the check joins `binding:check` `MEANING`, because it holds up
the graph-polarity ruling.

## Measured at `70c8507` (`deriveSemanticGraph` over the verified bag)

- 71 operator-context nodes carry no incident edge: 64 `-` and 7 `can`. Each resolves to one
  `scopes` record.
- Their operators stay visible: 64 records are referenced by an edge's own `scope`. The other 7
  are `-` records whose world holds only nested operator calls. Edges in those nested contexts
  carry chains through them. 0 orphans are invisible. Those 7 are exactly the pinned
  unreferenced records.
- Literals per orphan world, by signature: 44 entity + cardinality + event + arg, 12 the same
  plus pp, 5 event + arg, 3 event + arg + pp + property, 7 nested operator alone.
- **The condition dedup key omits scope.** `emittedConditions` in `tools/kb/graph.mjs` keys on
  document, sentence, kind, source, target and label. 157 body literals inside an orphan world
  were merged into an edge that another world emitted first. They form 16 distinct relations in
  14 sentences. 15 merged into an UNSCOPED edge, which an unnegated literal of the same sentence
  asserts (commonest: `have —argument 1→ patient`, where "the patient has X" and "the patient
  does not have Y" share it). 1 merged into another `-` edge. None merged into a differently
  modal edge. So no shown edge reads as a claim the source denies.

## Producer change

- The body-relation dedup (`condition()`, arg/pp/property) keys on the literal's scope too. A
  relation asserted in two worlds of one sentence then emits one edge per world: +16
  `argument`, 20,964 → 20,980. `tests/kb-derived-assets.test.ts` records the moved counts, and
  its original firing is recorded in the unit's commit body.
- The `condition supports` dedup stays scope-blind. Keying it too adds 17 shortcuts whose
  endpoint scopes contradict (38 → 55), and `tests/graph-shortcut-justification.test.ts`
  justifies none of the 17. That exceeds the approved +16. Queue row: "Condition-supports dedup
  is scope-blind".
- Each scope record whose operator-context node has no incident edge gains `literals`: the
  body literals whose world is that context, in clause-line then body-index order. Each literal
  is `{ line, index, predicate, edge }`. `edge` = the id of the edge that shows the literal's
  relation: its own `edge:<line>:<index+2>`, or the same-scope edge it deduped into. `edge` is
  `null` for a literal that emits no edge (entity, event, cardinality, nested operator). Other
  records carry no `literals` field. `validateSemanticGraphAsset` grades the field's shape.

## Acceptance (`tests/graph-orphan-scopes.test.ts`, over the shipped asset)

- O1: exactly the scope records whose node has no incident edge carry `literals`. That is 71
  (64 `-`, 7 `can`), each non-empty.
- O2: each orphan's operator rides at least one shown edge, through its own `scope` or a nested
  chain that contains it.
- O3: every non-null `edge` exists, its relation equals the literal's, and its scope chain
  contains the orphan. A literal shown only through an edge of another world fails, named by
  orphan id and literal line. Red at base: 16 relations, 157 literals.
- O4: independent arm. The literal set is re-derived from `parseClauseSites` over the bag,
  without the producer's emit path, and must equal the asset's.
- Firing inputs, each through the same graders over the REAL asset: one orphan's `literals`
  stripped (O1 names the scope id); one merged literal pointed at a `should`-scoped edge (O3
  names orphan + line); one literal dropped (O4 names it).
- Red at base: O1, O3 and O4 are red at `70c8507`, because no record carries `literals` and
  dedup merges across worlds. The red witness is the suite run against the base asset. O2 is
  base-green by measurement, and its firing input shows that it refuses.

## Records

- `.agent/spec.md` Decisions "Orphan operator contexts stay orphaned": the population sentence is
  amended to the scope-keyed count. The 71 orphan nodes stay orphaned.
- `.claude/rules/graph.md` projection and census figures are re-derived (`tests/census.test.ts`).
