# n29–n36 close — queue run, closing review check set

Fixed before dispatch. Target = the shipped surface `git diff 1ed8b82..<tip>` touched on
`wip/kb-release`, read at the tip the dispatch names (`.agent/spec.md` Decisions: judgment review reads
the shipped surface), plus the n35 draft `git diff 9736d24..9936ffa` on `wip/n35-error-steps`, owed the
user's approval. Units: n29 `4ae9f46`, n31 `18c83fe`, n32 `2f439d6`, n33 `9736d24` (draft `5a3e015`,
approved), n34 `d18f034`, n36 `661524a`; records `4f515dd`. One `reviewer` covers every lens
(MAINTAIN); MAIN holds S1. Findings bind to these rows; anything outside them is a register entry.

| id | lens | check |
|---|---|---|
| U1 | code | n29 `src/provenance/locate.ts`: the joiner fold, the lone-label skip and the in-order sentence reading return what `.claude/rules/ui.md` `Page viewer` states; each new case in `tests/passage-locate.test.ts` pins what its name claims; the 469 / 21 / 2 census holds. |
| U2 | code | n31 + n34 read-only arithmetic (`src/engine/session.ts`, `budget.ts`, `readonly.ts`, `tools/kb/readonly-arithmetic.mjs`, `tools/kb/paths.mjs`): the integer cap is set iff read-only and lifted on every exit; `readOutcome` reads every bound non-atom resource term as `resource`; `'$ro_rewrite'/2` walks exactly `CONTROL`'s goal positions; a twin's value equals `is/2`'s wherever it admits an expression; the G9 rows and A1–A3 go red on the defects they name. |
| U3 | code | n32 `tools/kb/sshsig.mjs` + `tools/kb/release.mjs` `gradeTag`: SSHSIG parsed and verified per OpenSSH `PROTOCOL.sshsig`; the signed payload bound to the recorded commit, tag and archive digest; R5–R8 test observable behaviour. |
| U4 | code | n33 `tools/kb/provenance.mjs` + `tests/upstream-ui-corpus.test.ts`: the four port rules match `vendor/cnl-ckc/rust/ckc-spec/src/check.rs`; the adapter adds bag-only plumbing alone; every family placed once; T9's nine declared edits equal the port's edits. |
| U5 | code | n35 draft: `stepValue` settles every error step as error `prolog` in both loops; the three edited cases keep their claims (P3.1 ×2 now trip the stack with `length/2`; E27 still answers two correlated requests with their own ids) and nothing else changes. |
| U6 | test | n36 `tests/chat-server.test.ts` `rows`: no complete record is dropped; B0 pins the partial-line read. |
| R1 | records | `.agent/spec.md` (Tasks, the release Decisions bullet), `.agent/deferred.md` (pruned rows, the interleave row), `.claude/rules/` (ui, engine, proof, kb-build, firing, gate, waves), `.agent/contracts/` (chat-c1, mnt5-inventory, mnt5-stryker, n33-upstream-ui, n34-readonly-arithmetic), and every `docs/claims.md` row re-adjudicated since `1ed8b82`: each states the shipped behaviour exactly. |
| R2 | records | The commit bodies of the units above: each red witness, firing and measurement reproduces by its recorded command on its recorded revision, and no sentence claims beyond what it measured. |
| S1 | security | MAIN: what each new path admits — the SSHSIG verifier and the pinned signer as the KB's trust anchor; the read-only rewrite as part of the chat's goal boundary (no data position rewritten, no helper reachable from a model-written goal). |

## Verdicts

`reviewer-30` (reviewer, GPT teammate, non-author), read at `20208bc` and the n35 draft `9936ffa` in its
own worktrees: 8/8 rows, validator rc 0. U1 U2 U4 U5 U6 pass — n29's, n33's and n36's reds replayed
exactly on overlays of their base files. Findings, each fixed in the review commit:

- U3-1 (minor) `tools/kb/sshsig.mjs` accepted bytes after the raw signature inside the signature field,
  which OpenSSH refuses (`unexpected bytes remain after decoding`) → `the signature field carries
  trailing bytes`; `tests/kb-release.test.ts` R8 plants the byte, red without the check.
- R1-1 (minor) `.claude/rules/kb-build.md` `Generated payload` counted two helpers after n34 added a
  third block → the four blocks named.
- R2-1 (minor) n31's commit body (`18c83fe`) gave its Stryker ranges as a placeholder, and that run
  preceded n31's lifecycle restructure → replayed at `18c83fe` over exactly the lines n31 added:
  `STRYKER_SUITE='tests/engine-{budgets,readonly-budget}.test.ts' STRYKER_TESTNAME='P2.8|between
  queries|does not take|25,000-digit|inside the integer cap'
  STRYKER_MUTATE='src/engine/session.ts:118-125,src/engine/session.ts:446-446,src/engine/session.ts:456-456,src/engine/session.ts:462-464,src/engine/session.ts:530-531,src/engine/session.ts:533-541,src/engine/session.ts:878-899,src/engine/budget.ts:127-134,src/engine/budget.ts:149-153'
  pnpm stryker` → 55 killed, 2 survived: `session.ts:534:11` `query?.close()` (equivalent: the
  wrapper's query always carries `close`) and `session.ts:891:79` the cap's diagnostic noun (open),
  the same two reviewer-27 ruled.

Register, fixed with them: `src/engine/readonly.ts` pointed its arithmetic-cost note at the queue row
n34 pruned → it names the twins; `.agent/contracts/n33-upstream-ui.md` gave 6 of its 242 rows a
duplicated id (identical location text collapsed in the line mapping) → 242 distinct ids, counts
unchanged. S1 (MAIN): pass — the verifier binds the pinned key blob, namespace `git`, the hash and
algorithm allowlists and the payload's commit, tag and single checksum line; the read-only rewrite
touches no data position (A1), and no `'$ro_*'` helper is on the guard's allowlist, so a model-written
goal cannot name one.
