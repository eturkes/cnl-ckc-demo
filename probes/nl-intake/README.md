# Free-text intake feasibility — probe evidence

Evidence branch. Nothing here is wired into a gate, and `main` does not carry it: the four
`.mjs` probes fail `pnpm lint` under the project service (`was not found by the project
service`), and widening the ESLint ignore list is a grader change that needs its own approved
unit. This branch is the repo's documented home for probe code
(`.claude/rules/waves.md`, `Research probe branches held as evidence`).

Base `1ecad59`. Findings live on `main` at `.agent/archive/nl-intake.md`; `MEASUREMENTS.md`
here is the same text with the probe index.

## Re-deriving each measurement

Run from a checkout of this branch copied over a working tree, or `git show` a single file.
`node` probes need the primary `node_modules` and `kb/generated/kb.pvm`; Python probes need
only the standard library.

| probe | measurements | command |
|---|---|---|
| `probe-vocab-gap.py` | M2 substring recall 2/18 | `python3 -P probe-vocab-gap.py` |
| `probe-adhoc-goal.mjs` | M3–M5 fail-closed behaviour | `node probe-adhoc-goal.mjs` |
| `probe-join.mjs` | M5 `clause/2` joins | `node probe-join.mjs` |
| `probe-vocab-parity.mjs` | M6 graph-vs-clause superset | `node probe-vocab-parity.mjs` |
| `probe-candidate-recall.py` | M7 BM25 recall@255 = 6% | `python3 -P probe-candidate-recall.py` |
| `probe-grounding.py` | M8 grounding 9/11 | `TYPESAFE_KEY_FILE=… python3 -P probe-grounding.py` |
| `probe-endtoend.mjs` | M9, M13 documents | `node probe-endtoend.mjs [name…]` |
| `probe-routing.py` | M10–M13 routing, hatch, Japanese | `TYPESAFE_KEY_FILE=… python3 -P probe-routing.py [--ja]` |

`clause-entities.txt` is the 800-name clause-reachable vocabulary `probe-vocab-parity.mjs`
derives; the two key-bearing probes read it rather than the graph's 1,084, because 284 entity
names are body-only and answer zero (M6).

## Key

The two live probes read a key file named by `TYPESAFE_KEY_FILE`; no key is committed. The
request carries the typed phrase and the knowledge base's own concept names — never guideline
content and never patient data.

## Refusal controls

- `probe-vocab-gap.py` — a poisoned gold label exits 1 naming it.
- `probe-candidate-recall.py` — a gold name that is not clause-reachable exits 1.
- `probe-routing.py --control` — a gold topic absent from the compiled catalog exits 1
  naming `zz-not-a-topic`.
- `probe-grounding.py`, `probe-endtoend.mjs`, `probe-join.mjs`, `probe-vocab-parity.mjs`,
  `probe-adhoc-goal.mjs` ship NO refusal control. Their numbers are demonstrations, not
  graded checks; read them with that limit in mind.
