# Contract — expedited surface (5ed81a3..a944fca)

Acceptance contract for the expedited implementation of M2/M3/M4. Written after
the fact because that range shipped without one. It fixes the check set for the
independent evaluation and terminates it (project `CLAUDE.md` review-termination
rule).

## Scope

- **Under evaluation:** architecture (`A`), semantic behavior (`S`), assurance
  claims (`C`).
- **Accepted, never a finding:** visual design, layout, colour, type, spacing,
  motion, component composition, affordance placement, disclosure/interaction
  structure, question phrasing as reading matter, chat-style answer presentation.
  A defect in these is a register entry, not a contract row.
- A finding that is *only* reachable by changing the interaction structure states
  the minimum change and marks it `design-coupled`.

## Authority

1. `.agent/initial-prompt.md` — user intent. Binding line: *"the answers must
   reflect real Prolog execution, never hard-coding"*.
2. `.agent/roadmap.md` goal block — *"The one non-negotiable = answers trace to
   genuine Prolog solutions"*; M3's *"Event and operator-context nodes stay;
   noun→noun collapse is forbidden"*.
3. `.agent/roadmap.md` M2 `u1`–`u7` `Accept:` clauses — already explicit, written
   by PLANNING before the range, never retracted.
4. `.agent/memory.md` recorded measurements + rulings.
5. Project `CLAUDE.md` Engineering + Authoring.

Demo-tier rigor applies (intent waives `cnl-ckc`-level rigor) — it does **not**
waive 1 or 2.

## Decision rules

- Verdict = `pass` | `fail(low|med|high)` | `n/a`, with `file:line` + the
  breached predicate + an acceptance check that closes it.
- A predicate about displayed meaning is decided against the **source ACE
  sentence in the vendored bag**, never against another derived artifact.
- A claim is `pass` only if a named command re-derives it from committed state.
- "Deterministic" never establishes "correct": a reproducible heuristic decides
  `S`-rows only when its output is checked against the source.

---

## A — architecture

| id | predicate |
| --- | --- |
| A1 | Every runtime artifact derives from the verified bag through `pnpm kb:build`; no runtime path reads outside `kb/generated` + `public/`. `kb:asset-check` still enforces the forbidden-reach scan over `src`, `tools`, `vite.config.ts`, `index.html`. |
| A2 | Which questions exist is *declared* and mechanically bound to the bag: a bag whose content invalidates a declared question fails the build rather than silently changing the catalog. (M1 shipped this as `EXPORTED` in `catalog.mjs`.) |
| A3 | A build step that computes what an answer *says* must prove its output equivalent to the source ACE, byte for byte, and fail the build otherwise. |
| A4 | Layer direction holds: `engine` → `questions`/`provenance`/`graph` → `demo`/components. No cycles; no semantics in `.svelte` components; no component reaching into a build script. |
| A5 | Payload growth is bounded, measured and lazy: no artifact above 1 MB loads before an explicit user activation, and every shipped artifact class is recorded in `.agent/memory.md`. |
| A6 | Every worker-boundary value is structured-clone-safe and re-validated at the consumer; no engine-native value crosses it. |
| A7 | Two forced builds are byte-identical across every generated asset class (`pnpm kb:reproduce`). |
| A8 | Failure modes stay fail-closed: a malformed generated artifact, a missing chunk, or a diagnostic-emitting engine yields an explicit error state, never partial or neighbouring content. |

## S — semantic behavior

| id | predicate |
| --- | --- |
| S1 | The displayed answer is **entailed by the compiled guideline clauses**, not merely stored in the image. Decision: perturb `guideline_*` clauses for a cited sentence ⇒ the answer changes; the answer must not survive a KB that no longer supports it. |
| S2 | Polarity and modality survive **every** rendering surface — answer text, proof step, clause, coverage passage, and both graph views. No surface may present a reading the source sentence contradicts. |
| S3 | Every displayed proof step names a clause that actually participated in deriving the displayed answer, and its rendered head equals the compiled clause at that line. No step is synthesized from a build-time record. |
| S4 | Numbered citation → source contribution is total and injective: every rendered statement carries the sources that produced it, and no source is attributed a statement it did not produce. |
| S5 | Any graph edge shown asserts a relation the KB asserts, with the same scope. A projection that removes operator/modality nodes must not leave the remaining edges readable as a claim the source denies. |
| S6 | Source and ACE text stay byte-faithful and code-point aligned; highlight groups pair identically under pointer and keyboard. |
| S7 | Every failure path (deletion, duplicate, bad offset, wrong page, stale run, limit, cancel) reaches an explicit state and never shows neighbouring evidence. |
| S8 | The question→document selection is a semantic claim. Either it is mechanically checkable against the bag, or the UI discloses it as a curated selection. |
| S9 | Reader-facing counts and labels describe what they actually count (`hidden technical nodes`, `re-proved`, `mechanically`, `concepts/actions`). |
| S10 | An existence/`no proof` outcome remains distinguishable from a limit, a cancel and an error. |

## C — assurance claims

| id | predicate |
| --- | --- |
| C1 | Every claim in `.agent/roadmap.md`, `.agent/memory.md`, `README.md` and shipped UI copy for this range re-derives from committed state by a named command. |
| C2 | No check retired without record: every gate step, oracle and test class present at `5ed81a3~1` is present at `a944fca`, or its removal is recorded with rationale in `.agent/memory.md`. |
| C3 | The non-negotiable carries a live mechanical binding at least as strong as M1's: inject a PID-unique clause into the **guideline schema predicates**, require the projected answer *and* its line-keyed proof to change, read no committed fixture. |
| C4 | Each M2 `u1`–`u7` `Accept:` clause holds as written, or the roadmap records where it does not. One row per unit. |
| C5 | Recorded measurements match re-derivation: manifest counts, graph stats, asset totals, test/file counts, `dist` size class list. |
| C6 | Durable text conforms to project `CLAUDE.md` Authoring; commit subjects use `<scope>: <cause> → <fix>`. |
| C7 | Claim scope matches evidence scope: browser claims rest on browser runs, "mechanical" claims on checked mechanisms, "verified" on a rerunnable check. |

## Fixed row set

A1–A8, S1–S10, C1–C7 = **25 contract rows**. A reviewer may add rows inside its
lens; added rows carry the same verdict shape and are marked `+`. Rows outside
every lens land in the report's register section.
