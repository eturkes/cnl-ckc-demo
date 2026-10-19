# ann-review — closing review of the answer-panel annotations scope

Fixed BEFORE any reviewer reads the diff. Target = the SHIPPED SURFACE at the closing commit
(user ruling: judgment review reads the working tree, not a commit range) as it bears on this
scope: `tools/kb/{clinical,proof,catalog}.mjs`, `tools/clinical-reference.mjs`,
`src/questions/{marks,advice,service,catalog}.ts`, `src/demo/{DemoController.svelte.ts,
AnswerPanel.svelte,describe.ts}`, `src/App.svelte`, `src/i18n/{en,ja}.ts`, `server/chat-guide.md`,
the scope's tests, `tools/{binding-check,engine-check,presentation-check,mutants}.mjs`,
`tools/mutation/`, `.claude/rules/`, `.agent/contracts/ann-u{1,2,3}.md`, `.agent/spec.md`,
README. Scope diff for orientation: `git diff 5700e6c..HEAD`. One `reviewer` per lens; the
security lens is MAIN's alone. Verdicts `pass:` / `fail(low|med|high):`; evidence = a red test
(command + failing output on the reviewed revision) or the disputed bytes in `rg -Fn` form +
`file:line`. Findings bind to the unit contracts; anything else is a register entry.

| id | lens | check |
|---|---|---|
| R1 | correctness/spec | `clinical_marks/3` + `clinical_derived/2` implement ann-u1's Design: per-sentence first derivation, top-level node reading, all-or-nothing branches, answer-ordered groups |
| R2 | correctness/spec | `marks.ts` decoder/readings/join and `marksView` match ann-u1's Interface, scalar domains and join rule |
| R3 | correctness/spec | the controller's marks lifecycle matches ann-u1 (ordering before the trace, aborts, late writes, states) |
| R4 | correctness/spec | the qualifier lift, build checks and renderer match ann-u2; every rendered answer byte-identical |
| R5 | correctness/spec | the panel matches ann-u3 and the user's Decisions (order, grade once per run, labels, notice, disclosure, busy) |
| C1 | claim soundness | every claim the scope added to `.claude/rules/`, contracts, README and commit bodies states what its cited evidence shows, at that strength |
| C2 | claim soundness | user-facing copy (en + ja) says what the panel does — no overreach on what a mark or a missing mark means |
| G1 | guarantee-vs-claim | "every mark comes from a live read-only goal over the KB's annotation predicates" — guaranteed by code, not only by tests |
| G2 | guarantee-vs-claim | "a missing mark never reads as an absent one" — every path where marks can fail reaches the notice |
| G3 | guarantee-vs-claim | the answer path's all-or-nothing and the marks' all-or-nothing hold for every input shape the build admits |
| V1 | verification integrity | each new suite's red witness is behavioural, on a recorded revision + command; base-GREEN cases declared and credited or uncredited as recorded |
| V2 | verification integrity | every changed graded case, digest or declared table is a user-approved edit or a tightening, its original firing recorded |
| V3 | verification integrity | mutation credit runs (Q3, U1) and every survivor ruling are sound; migrated mutants still plant their original defect |
| K1 | CLAUDE.md conformance | Authoring (agent-optimized internal text, human-facing register for README + copy), comments carry the why only |
| K2 | CLAUDE.md conformance | Engineering + Session flow: units, tiers, contracts before code, teammates, gates at every commit, records current |
| S1 | security (MAIN) | every untrusted input this scope reaches traced to its sinks; raw-HTML sinks; data exposure |
