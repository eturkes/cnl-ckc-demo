# KB release intake — closing review check set

Fixed before dispatch. Target = `git diff 4b8b8b3..HEAD` (rel-u1 `b5d3d8b`, audit `6acb906`,
rel-u2) read in the working tree at close. One `reviewer` covering every lens (MAINTAIN). Findings
bind to these rows; anything outside them is a register entry. Rulings → `.agent/contracts/rel-u1.md`.

| id | lens | check |
|---|---|---|
| K1 | correctness | `tools/kb/proof.mjs`: the 22 indicators, the assumption arm (`\+ \+ assumed`, `!`, `assumed`), `clinical_depth(4)` and the noun fallback keep every invariant `.claude/rules/proof.md` states; no path lets a guard succeed without its inner search finishing |
| K2 | correctness | `tools/kb/clinical.mjs` `antecedent` + fact verbs, `tools/kb/graph.mjs` unprojected records + date skip, `tools/kb/provenance.mjs` tables: each change is the narrowest the schema needs and fails closed on anything else |
| K3 | correctness + security | `tools/kb/release.mjs` + `kb:build`'s record check: every byte written is checked first; a hostile release (extra asset, bad digest, path escape in the tree, wrong root) is refused; no path outside `kb/` and `vendor/cnl-ckc/` is written |
| K4 | security | `src/engine/readonly.ts`: the five admitted names add no write, no atom builder, no `call/N`; the X4 finding is stated where it binds |
| C1 | checks | every grader edit in `.agent/contracts/rel-u1.md` E1–E9, X1–X6 is the approved one, no wider; every new check fires on its planted input |
| C2 | checks | figure re-pins match the bag (spot-check five against a fresh derivation); no assertion was dropped |
| R1 | records | `.claude/rules/`, `.agent/spec.md`, `.agent/deferred.md`, README and the contracts state what the tree does; no live law reads a `cnl-ckc` checkout or names `../cnl-ckc` beyond the sibling-scan note |
| R2 | records | each commit body's witnesses are reproducible by the command it names |

## Verdicts (reviewer-25 over `9502c6d`; MAIN's rulings)

| id | verdict | ruling |
|---|---|---|
| K1 K2 K4 C1 C2 | pass | — (C1 reran tests/proof-guard.test.ts 5/5 red on the base interpreter built in memory; C2 five raw-bag figures match) |
| K3-1 | major: `vendoredEntries` admitted `tests/ui/../../../escaped.txt` by prefix and the write joined it outside `vendor/cnl-ckc` (red: its scratch test `Missing expected exception`) | fixed: unsafe tree paths refused by name, every write held inside `vendor/cnl-ckc/`; `tests/kb-release.test.ts` R4 plants four hostile paths |
| R1-1 | minor: `kb:fetch --verify` never compared `PROVENANCE.tsv`, against `requires every vendored byte equal` | fixed: the lane compares the manifest it regenerates from the tree; red: a corrupted manifest exits 1 `PROVENANCE.tsv differs from the tag's commit tree` |
| R2-1 | minor: rel-u1's E/X rows carried outputs without a rerun command | fixed: `.agent/contracts/rel-u1.md` states the recipe — the base suite restored over the rel-u1 tree |
