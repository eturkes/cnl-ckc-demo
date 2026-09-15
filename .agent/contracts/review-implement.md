# Contract — IMPLEMENT close review

Fixed check set for the judgment pass that gates the IMPLEMENT phase close. Written BEFORE the
surface is read, which is what terminates the review (project `CLAUDE.md` review-termination
rule). Rows are adjudicated into `.agent/review.md`; the phase closes when every row carries a
verdict and none stays open.

## Scope

**User ruling:** this review reads the **SHIPPED SURFACE at close** — `src/`, `tools/`, the
gate chain, `.claude/rules/` and `.agent/contracts/` as they stand at the closing commit — not
a commit range. That ruling discharges the outstanding u3–u10 judgment pass: those units are
adjudicated through the surface they left behind, and there is no separate history pass.

- **Under evaluation:** architecture and seams (`A`), semantic behavior (`S`), the graph scope
  pipeline (`G`), assurance claims and report honesty (`C`).
- **Accepted, never a finding:** visual design, layout, colour, type, spacing, motion,
  component composition, affordance placement, disclosure and interaction structure, question
  phrasing as reading matter, chat-style answer presentation. The user has accepted every one
  of these surfaces; a defect there is a register entry, not a contract row.
- **The graph's look alone is open to change** (user ruling, `.agent/spec.md`). A `G` finding
  may propose a visual change; an `A`/`S`/`C` finding that forces a visual difference anywhere
  else stops and reports instead.
- A finding reachable only by changing interaction structure states the minimum change and
  marks itself `design-coupled`.

## Authority

1. `.agent/spec.md` `Intent` — outranks everything below. Binding line: **"Answers reflect real
   Prolog execution over the exported KB, never hard-coding."**
2. `.agent/spec.md` `Decisions` — the user rulings, then MAIN's.
3. `.agent/contracts/m5u*.md` `Accept:` predicates, as written.
4. `.claude/rules/` recorded measurements and law.
5. Project `CLAUDE.md` `Engineering` + `Authoring`.

**Demo-tier rigor applies** (`Intent` waives `cnl-ckc`-level rigor) and it does NOT waive 1.
The waiver reaches verification integrity OFF the answer path — there, a thin check is a
demo-tier choice rather than a defect, and strengthening one is scheduled work, not a finding.
**Report honesty is unwaived everywhere**, and `C` grades it as such.

## Decision rules

- Verdict = `pass` | `fail(low|med|high)` | `n/a`, each with `file:line`, the breached
  predicate, and an acceptance check that would close it.
- A predicate about displayed meaning is decided against the **source ACE sentence in the
  vendored bag**, never against another derived artifact.
- A claim is `pass` only when a named command re-derives it from committed state.
- "Deterministic" never establishes "correct": a reproducible heuristic decides an `S` or `G`
  row only when its output is checked against the source.
- A row whose subject is already a `.agent/deferred.md` entry with an acceptance check is
  `n/a — deferred`, citing the row. Deferral is a disposition, not a pass.
- Evidence bar (global `CLAUDE.md` `Subagents`): behavior → a red test; an artifact's text →
  the disputed bytes in `/usr/bin/rg -Fn` form plus `file:line`.

---

## A — architecture and seams

| id | predicate |
| --- | --- |
| A1 | Every runtime artifact derives from the verified bag through `pnpm kb:build`. No runtime path reads outside `kb/generated` and `public/`, and `kb:asset-check`'s forbidden-reach scan still covers every root it claims. |
| A2 | `../cnl-ckc` is never linked and never a runtime dependency. The vendored bag is the whole interface, in the shipped code and in the build scripts alike. |
| A3 | Layer direction holds: `engine` → `questions`/`provenance`/`graph` → `demo` and components. No cycles, no semantics inside `.svelte` components, no component reaching into a build script. |
| A4 | Every worker-boundary value is structured-clone-safe and re-validated at the consumer. No engine-native value crosses the boundary. |
| A5 | Failure modes stay fail-closed. A malformed generated artifact, a missing chunk, a disposed client or a diagnostic-emitting engine yields an explicit terminal error state, never partial or neighbouring content. |
| A6 | Payload growth is bounded, measured and lazy: no artifact above 1 MB loads before an explicit user activation, and every shipped artifact class is recorded in `.claude/rules/`. |
| A7 | Two forced builds are byte-identical across every generated asset class, and the claim is backed by a command that reruns from committed state. |
| A8 | The producer/reader version seam is coherent: every generated asset's `schemaVersion` is pinned by exactly one reader that refuses a mismatch by name, and no reader silently drops a field the producer emits. |

## S — semantic behavior (the non-negotiable)

| id | predicate |
| --- | --- |
| S1 | Each shipped answer is computed by real Prolog execution at run time. Retracting the `guideline_*` clauses it cites changes or removes that answer. |
| S2 | The displayed proof is a derivation, not a build-time record replayed. The same retraction moves or removes the proof. |
| S3 | Each question compiles its clinical context into EXPLICIT premises and derives through the `guideline_*` clauses. `guideline_operator(actual, C, should)` failing on the bare KB is correct behavior, not a defect. |
| S4 | Premise display is deduplicated steps inside the existing ladder rungs, carrying hypothetical origin and no source line, and never a new step type. |
| S5 | A quotation, a hypothetical premise and a derived clause read as DISTINCT to a user, in both locales. |
| S6 | Every displayed provenance line resolves to the source ACE sentence in the bag, at the line it names. |
| S7 | Cancel is honoured: a cancelled or rejected run reaches a terminal state the UI reads, and no discarded promise leaves the view busy. |
| S8 | No shipped surface asserts a stronger epistemic status than the pipeline delivers — no derived artifact is presented as a quotation, and no heuristic output is presented as a derivation. |

## G — graph scope pipeline (u8 → u13)

| id | predicate |
| --- | --- |
| G1 | Graph polarity is EDGE state. Negation and modality ride the edges, and no `operator-context` node returns to the concept view. |
| G2 | Every projected edge preserves its relation AND its ordered scope. Order is preserved as a sequence, not re-derived from a set. |
| G3 | Every SHOWN edge preserves relation and ordered scope in BOTH the canvas and the fallback view, graded whole against the final renderer rather than per-layer. |
| G4 | The scope records are internally closed: every operator-bearing edge resolves to exactly one scope record and every record is referenced. No orphan in either direction. |
| G5 | The emitted asset stays inside its recorded gzip budget, and the budget names the compressor and level it was measured with. |
| G6 | Fit clamps to a zoom FLOOR with pan below it, and node labels WRAP rather than ellipsize. Every legibility defect is a Cytoscape style property, per the user's renderer ruling. |

## C — assurance claims and report honesty

| id | predicate |
| --- | --- |
| C1 | Every purpose-built check ships the input that makes it fail, and that firing input drives the check's OWN grader over its REAL input — never a synthetic table built beside it. |
| C2 | No declared table, allowlist or pinned surface can grade nothing while its step still prints a count. Emptying it yields a nonzero exit that NAMES the table. |
| C3 | Every shipped threshold, cutoff and timeout has a named owner whose search returns rc 0, or a `.agent/deferred.md` row with an acceptance check. |
| C4 | `binding:check`'s declared inventory matches the cases the gate's own run actually executed. A rename, deletion or skip fails the gate. |
| C5 | Every claim in `README.md` and the shipped UI copy names a committed-state command that re-derives it. |
| C6 | Each unit's commit body carries its measurements, its base revision and its `dispatch:` trailer, and each contract from u11 on carries its red witness with the command that reproduces it. |
| C7 | No check grades a fixture's expected value that the contract does not own, and no expected-output table is asserted in a form the corpus cannot distinguish from a wrong implementation. |
| C8 | Every report of a gate-only run names `kb:reproduce`, `smoke`, `browser:check`, `graph:check` and `binding:replay` as not-run, by name, and `none` is used as the sentinel when nothing was skipped. |
| C9 | A skipped, xfailed, deleted or tier-demoted case carries a `.agent/deferred.md` row and the user's approval. No case was quietly demoted to make a gate green. |
| C10 | The `.agent/deferred.md` queue is honest: each row's acceptance check is written and checkable, and nothing in it is a defect actually fixed but left recorded as open. |

## Dispatch

One `rev` teammate per lens, each in its own worktree, diff-blind to MAIN's findings and to
each other. Findings ship as red tests wherever behavior is the subject. MAIN adjudicates,
and where MAIN and a reviewer agree independently that counts as confirmation. Where verdicts
differ in severity the higher stands — each is evidence-backed and the lower one saw less.

Rows added inside a lens are admitted as `+` rows and adjudicated like any other; the FIXED
set above is what terminates the pass.
