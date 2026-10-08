# mnt3 Close — Rust/Verus upstream port, closing review check set

Fixed before dispatch. Target = the shipped surface that `git diff 2d52b23..9cf5680` touched, read at
`9cf5680` (`.agent/spec.md` Decisions: judgment review reads the shipped surface). Upstream =
`../cnl-ckc` at `2acd0d70`, read-only. One `reviewer` covers every lens (MAINTAIN). Findings bind
to these rows; anything outside them is a register entry. The security lens stays on MAIN.

| id | lens | check |
|---|---|---|
| A1 | product | Non-negotiable: the vendored bag is the archive upstream `ckc dist build` emits at `2acd0d70` — sidecar verifies, `release-manifest.tsv` byte-equal to upstream's committed one — and every answer-path asset (pvm, catalog, provenance, graph, intake) re-derives from it through `kb:build` + `kb:asset-check`; no answer, figure or row entered by hand. |
| A2 | product | Old → new bag delta: nothing the demo parses changed meaning — `pl/` clause bodies + line numbers, query goals + `query_sha256`, answer envelopes, coverage data rows, alignment rows, review labels. Every changed byte is a header comment, the coverage grammar header or a manifest `meta` row, and no demo code reads a dropped `meta` row. |
| B1 | gate | `tests/kb-derived-assets.test.ts` `admits every uncovered class …` is RED at base `2d52b23` on `inexpressible` by the recorded command, its class list equals upstream `check.rs` `uncovered_class_ok`, and it refuses an undeclared class by `coverage-status`. |
| B2 | gate | `tools/kb/provenance.mjs` coverage-status grammar admits exactly upstream `status_of`'s uncovered classes — no wider, no narrower — and the change moves no derived asset byte for the shipped bag. |
| C1 | records | `.claude/rules/kb-build.md`: the regeneration recipe runs as written and leaves `../cnl-ckc` byte-clean; the bag-name + provenance bullet matches upstream `docs/REFERENCE.md` `Export`; each port-spec function named exists under `../cnl-ckc/rust/ckc-spec/src/`; the `tests/ui/` census (15 green + 84 red) holds. |
| C2 | records | `docs/claims.md` rows the change moved are adjudicated truthfully; no live text (outside `.agent/archive/`, commit history and closed contracts) still names the retired Python toolchain (`dist.py`, `goal.py`, `ui.py`, `meta head`) as current; `.agent/spec.md` `Tasks` + the new `.agent/deferred.md` row state what the tree does. |
