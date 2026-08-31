# polish register

Off-spine improvements. Each entry carries the acceptance check that closes it.

- **Phased boot telemetry** — replace the single boot spinner with ordered
  progress phases. Accept: each phase emits one accessible status event in
  order, and no percentage is reported that the runtime does not supply.
- **Question deep-links + history** — encode the selected catalog ID in the URL.
  Accept: reload and back/forward restore only a catalog ID, and never start a
  run without an explicit user action.
- **Offline asset caching** — service worker over the hashed runtime assets.
  Accept: a second visit boots with the network offline, and a changed KB input
  hash invalidates every stale PVM asset.
- **Four-query byte differential** — only category-A is byte-proven against its
  committed answer bundle. Accept: a committed script reproduces byte identity
  for all four exported queries, or records the exact canonical-form divergence
  for each of the other three.
- **u1 adversarial review** — u1 shipped without `rev`/`rev2`; MAIN hit the
  context reserve after wave 1. Accept: a reviewer enumerates its check set from
  `.scratch/contract-m1u1.md` and adjudicates every row against commit range
  `4befd92..u1`, shipping a red test for each accepted defect.
- **Finish the u1 wave-1 reports** — `map-m1u1` (17/25 rows) and
  `spike-m1u1-det` (9/12) were stopped at the reserve. Accept: both reports pass
  `validate-report.py` with rc 0, or the open rows are re-derived and their
  findings folded into memory.
- **QLF fallback delivery path** — the fallback needs the 6.2 MB `swipl-bundle`,
  so a naive import would double the shipped engine. Accept: the fallback engine
  loads only when the saved state fails, and a production build that never takes
  the fallback ships no bytes of it.
