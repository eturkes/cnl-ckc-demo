# u16 shape probes

Orientation probes behind the u16 design ruling in `.agent/spec.md` `Decisions` and the
`O4 remeasured` section of `.agent/archive/nl-intake.md`. Base `ace381c`.

They stay on this branch for the reason `wt/res-nl-intake` does: `probes/` is linted, the
typescript-eslint project service resolves every linted file through `tsconfig.json`, and a
bare `.mjs` probe has no project entry. Widening the ESLint ignore list is a grader change
reserved for its own approved unit. **Never rename this branch** — `.agent/spec.md` and
`.agent/archive/nl-intake.md` both cite it.

Run from the repository root, against the verified bag:

```
node probes/u16-shape/premise-shape.mjs
node probes/u16-shape/rule-shape.mjs
```

Both read the committed bag through `verifyBag` + `payloadSource`, so they re-derive from
committed state and need no build.

## What they answered

`premise-shape.mjs` asked whether the 346 `clinical_premise` facts are a shared patient-fact
vocabulary that a judgment layer could select over. They are not: 346 raw-distinct literals
collapse to **42** once `'$clinical_hypothetical'(Doc,S,N)` is normalized, and the two
commonest shapes are universal-instantiation scaffolding present in 46 and 45 of the 46
premise-bearing sentences. Selecting premises cannot partition the corpus.

`rule-shape.mjs` located the signal that does: `clinical_rule/3` carries **24 distinct
condition strings** over 48 rules, 22 of them unconditional, plus 27 action modifiers and 12
document scopes. Those conditions read as clinical situations and fit one judgment request.

Together they retire the archive's O4 framing — premise compilation into `derive/5`, new
engine surface — and replace it with a selector over existing records.
