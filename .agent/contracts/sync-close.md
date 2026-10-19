# sync-close — closing review check set (upstream sync to 83569b1d)

Diff: `5191a0f..e73ed6c` (sync-u1 `c511755`, sync-u2 `e73ed6c`). Fixed before the diff is read.
Lenses: correctness, cleanup, altitude, records. Evidence = a red test, or the disputed bytes
`rg -Fn`-matchable plus `file:line`. Out of scope: `src/engine/readonly.ts` (reviewed by MAIN).

| id | check |
|---|---|
| C1 | `tools/kb/clinical.mjs`: the recommended form and the positive copula parse every sentence of the 12 documents losslessly into the mode + polarity their compiled operators carry (SHOULD over a negation → `should` + negative); T9's declared edits equal the shipped span bytes |
| C2 | the 19-indicator schema is consistent everywhere it is enumerated (`proof.mjs`, `provenance.mjs`, census, test support, chat guide); `guideline_document/4` in every live goal; the `% schema:` block moves no document line |
| C3 | `tools/kb/graph.mjs` implements each row of `.agent/contracts/sync-u2.md`: labels, inverses, folds, the threshold's world, the quantity + property resolutions and their guards |
| C4 | `src/graph/model.ts` + `view.ts`: `graphRelation` is the one reading; old kinds read as before; source roles + `inverse` parse fail closed |
| C5 | re-pinned and re-anchored tests still exercise the property their case names (no fixture passing on a sentence or edge that changed shape); new controls fire on their planted input |
| C6 | declared tables (`binding-check.mjs`, `mutants.mjs`, `exports.mjs`, inventory) name live cases and anchors |
| C7 | records match the shipped state: rules figures, spec `Decisions`, the chat-c1 amendment, the registry dispositions, queue rows, README |
| C8 | `server/chat-guide.md` states the KB the model will query: predicates, arities, counts, example goals |
