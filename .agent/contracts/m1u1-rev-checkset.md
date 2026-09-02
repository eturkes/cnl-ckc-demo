# rev-m1u4-3-u1 — adversarial review of M1.u1, export→PVM producer

Check set enumerated here, then adjudicated here. 30 rows. Sources = `.agent/contracts/m1u1.md`
(D0, C1, P1–P5, I, G, Q), `.agent/roadmap.md` u1, `.agent/memory.md` "Knowledge base" and
"Generated runtime payload (u1)", `CLAUDE.md`.
Grade: `python3 -P .scratch/validate-report.py .scratch/agents/rev-m1u4-3-u1.md --verdict`

Review target = `e3ef450`. Ids in the check-set table are backticked so the grader reads one row
per id from the verdict table alone.

| id | finding | evidence |
| --- | --- | --- |
| U01 | unknown | unknown |
| U02 | unknown | unknown |
| U03 | unknown | unknown |
| U04 | unknown | unknown |
| U05 | unknown | unknown |
| U06 | unknown | unknown |
| U07 | unknown | unknown |
| U08 | unknown | unknown |
| U09 | unknown | unknown |
| U10 | unknown | unknown |
| U11 | unknown | unknown |
| U12 | unknown | unknown |
| U13 | unknown | unknown |
| U14 | unknown | unknown |
| U15 | unknown | unknown |
| U16 | unknown | unknown |
| U17 | unknown | unknown |
| U18 | unknown | unknown |
| U19 | unknown | unknown |
| U20 | unknown | unknown |
| U21 | unknown | unknown |
| U22 | unknown | unknown |
| U23 | unknown | unknown |
| U24 | unknown | unknown |
| U25 | unknown | unknown |
| U26 | unknown | unknown |
| U27 | unknown | unknown |
| U28 | unknown | unknown |
| U29 | unknown | unknown |
| U30 | unknown | unknown |

## Check set

| id | check | source | how to decide it |
| --- | --- | --- | --- |
| `U01` | mechanical · Does `kb:build` verify the archive against its `.sha256` sidecar before parsing any archive byte, and abort nonzero on mismatch? | P1.1 | Read the call order in `tools/kb/build.mjs` and `tools/kb/bag.mjs`; flip one sidecar byte and one archive byte, observe rc and the message each time. |
| `U02` | mechanical · Is the archive parsed entirely in memory, with no code path writing a member to the filesystem, through a purpose-built reader rather than a sanitizing tar library? | P1.2, D0.3 | Scan `tools/kb/` for write APIs and for any tar dependency; run `pnpm kb:build` under a probe that traces `fs` writes and confirm only the three `kb/generated/` artifacts appear. |
| `U03` | mechanical · Does the reader reject each of the seven named entry classes with a distinct typed reason — non-regular type, absolute path, `..` segment, NUL/control in name, duplicate name, resolves outside root, size inconsistent with the stream? | P1.3 | Synthesize one bag per class; assert the reason strings are pairwise distinct and typed, not a shared generic error. |
| `U04` | judgment · Is rejection refusal rather than repair — is no rejected name rewritten, stripped or normalized into an accepted one? | P1.4, D0.3 | Read every name-handling path for strip/normalize/resolve-and-continue; feed `a/../a/../a` and a leading-slash name and confirm neither is accepted in any rewritten form. |
| `U05` | mechanical · Does BagIt verification assert `BagIt-Version: 1.0` and verify every entry of both `manifest-sha256.txt` and `tagmanifest-sha256.txt`? | P1.5 | Read the verifier; run a `BagIt-Version: 0.97` fixture and a flipped tagmanifest digest, both must abort. |
| `U06` | mechanical · Is verification complete in both directions — every `data/` payload member listed, every manifest entry present — with an unlisted payload file rejected rather than warned? | P1.6 | Two synthetic bags: one extra unlisted payload file, one manifest entry with no archive member; both must abort nonzero. |
| `U07` | mechanical · Does a single flipped byte in any payload file, any tag file, or any manifest line abort the build nonzero? | P1.7 | Three one-byte mutants through the real verifier, each rc nonzero with a named cause. |
| `U08` | judgment · Does the committed suite cover the 20 hostile inputs the Q corpus names, with every fixture synthesized by the test rather than committed as an opaque binary? | Q corpus, I "hostile-bag fixtures are synthesized" | Census `tests/kb-bag.test.ts` case names against the Q list; confirm no binary fixture is committed under `tests/`. |
| `U09` | mechanical · Does the reader handle the five GNU `././@LongLink` (`L`) headers the real bag carries, which a resolving parser hides and a naive raw reader refuses? | `.agent/memory.md` Knowledge base | Read the header dispatch in `bag.mjs`; confirm the real bag yields 1041 payload + 5 tag entries + tagmanifest = 1047 members and that names over 100 chars resolve. |
| `U10` | mechanical · Are the 337 `pl/` payload files fed in a deterministic order fixed by the code, with that order's identity recorded in the manifest as a digest of the exact concatenated input? | P2.1 | Read the sort and the `% file:<path>` join; recompute the concatenation digest independently and compare against `input.sha256`. |
| `U11` | mechanical · Does the producer assert schema 1 and exactly 337 `guideline_document/3` documents inside the building engine before `qsave_program` runs, and abort nonzero otherwise? | P2.2 | Read the assertion's position relative to the save call; drop or corrupt a payload file and confirm the build aborts before any artifact is written. |
| `U12` | mechanical · Is engine diagnostic output captured during consult, with any error diagnostic aborting nonzero, and are the two `library(shlib)` warnings the only tolerated noise, tolerated at image save alone? | P2.3, D0.4, `.agent/memory.md` | Read the `printErr`/sink wiring; inject a payload clause that emits a diagnostic and confirm rc nonzero; confirm the runtime-consult path treats the same text as fatal. |
| `U13` | mechanical · Does one run emit both `kb.pvm` and `kb.qlf`, neither produced from an input different from the digest the manifest records? | P2.4 | Single-run artifact census; cross-check both asset entries against the one recorded `input.sha256`. |
| `U14` | judgment · Is the manifest written last, after every asset is on disk, so an interrupted build never leaves a manifest claiming artifacts it did not produce? | P2.5 | Read the write ordering; kill a build between asset write and manifest write and confirm the surviving state fails `kb:asset-check` rather than passing. |
| `U15` | mechanical · Is `generateImageBuffer` absent from every code path, with its four steps re-implemented under a caller-supplied diagnostic sink? | D0.4 | Scan `tools/` and `src/` for the symbol; read `tools/kb/produce.mjs` for the four steps and the sink. |
| `U16` | mechanical · Do two consecutive `kb:build --force` runs from a clean cache emit contract-equivalent manifests, with nondeterministic fields named explicitly in `src/kb/manifest.ts` and excluded by name rather than by a blanket comparison? | P3.1, G2 | Run G2; read the exclusion list in `src/kb/manifest.ts` and confirm it names fields rather than pattern-matching them. |
| `U17` | mechanical · Does the clock pin make two forced builds byte-identical at the recorded digests, and does `pnpm kb:reproduce` prove it from committed state? | `.agent/memory.md` Generated runtime payload | Run `pnpm kb:reproduce`; compare against `pvm 3ae8d455d875` / `qlf 62bc61cc7d0e`; confirm `withPinnedClock` scopes the pin to the build phase. |
| `U18` | mechanical · Does a second `kb:build` without `--force` skip the rebuild only when input digest, toolchain version and asset digests all still match, while still verifying every digest it skips rebuilding for? | P3.2 | Read the cache decision; run twice and confirm the second run reports a cache hit yet still recomputes and compares each digest. |
| `U19` | mechanical · Is a cache hit invalidated by each of the five named triggers — changed input digest, changed `swipl-wasm` version, missing asset, asset digest mismatch, manifest schema mismatch? | P3.3 | One probe per trigger; each must force a rebuild rather than pass on stale artifacts. |
| `U20` | mechanical · Does the manifest record every field group P3.4 names, at minimum: schema version; bag filename and sha256; BagIt payload and tag counts; input file count, byte count and concatenated sha256; `swipl-wasm` version; per-asset path, bytes, sha256 and kind; and the live-verified schema version and document count? | P3.4 | Field census of the emitted `kb-manifest.json` against the P3.4 list, naming any absent group. |
| `U21` | judgment · Is every manifest number observed during the run that wrote it, with 337 and the schema version read from the engine rather than hard-coded as a pass condition in production code? | P3.5, I "never hard-coded" | Trace each numeric field to its producing expression; scan `tools/` and `src/` for the literals and rule on every hit. |
| `U22` | mechanical · Does a freshly built `kb.pvm`, loaded through the documented loader, report schema version 1 and exactly 337 documents? | P4.1 | Run the committed live case against the real artifact and read the reported values. |
| `U23` | mechanical · Does the forced-QLF path satisfy the identical assertions from `kb.qlf`, behind a switch that is explicit and testable, and is the engine split D0.6 states a shipped fact? | P4.2, D0.6, G3 | Locate the switch; run G3 with it set; confirm the QLF path boots the large bundle and reports the same contract values. |
| `U24` | mechanical · Is the live contract asserted by a committed test that boots the real generated artifact, reading no fixture, recorded answer or stand-in constant, and does no test assert a digest it computed from the artifact it verifies? | P4.3, I "no test asserts a digest constant" | Read `tests/kb-live.test.ts` and trace every expectation to its anchor; flag any self-computed digest comparison. |
| `U25` | mechanical · Does the live test fail rather than skip when `kb/generated/` is absent, and can `kb:asset-check` never pass on an empty `kb/generated/`? | P4.4, I "cannot pass when empty" | Remove `kb/generated` and run both `pnpm test` and `pnpm kb:asset-check`; require nonzero and zero skips from each. |
| `U26` | mechanical · Does `pnpm gate` run `kb:build` then `kb:asset-check` ordered so no later member can pass on unverified artifacts, and is the gate rc 0 from a clean checkout with `kb/generated/` deleted? | P5.1, P5.6, G1 | Read the `gate` script order in `package.json`; run G1 from a clean extraction of the reviewed commit. |
| `U27` | mechanical · Does `kb:asset-check` re-verify manifest↔disk digests and recompute the input digest from the vendored bag without ever rebuilding? | P5.2 | Read the script for any produce call; tamper one asset byte and confirm it fails; confirm artifact mtimes are unchanged across a run. |
| `U28` | mechanical · Is the sibling-path scan empty over exactly the six paths P5.3 scopes, does the pipeline succeed with the sibling absent, and does no code path reference `../cnl-ckc`? | P5.3, P5.4, G4 | Compare the implemented scan roots against P5.3's list; run the scan; plant a positive control that must fail; grep for the sibling path outside `.agent/` and `CLAUDE.md`. |
| `U29` | mechanical · Are the generated paths in `.gitignore` and in both halves of the synced read-exclusion pair, and does the app reach them through the Vite alias with a `?url` image import? | P5.5, D0.5 | Read `.gitignore`, `.claude/settings.json` `permissions.deny`, `.serena/project.yml` `ignored_paths`, and the alias plus import site. |
| `U30` | judgment · Do the C1 artifacts all exist with their declared kind, are the tools ESM JSDoc-typed under `allowJs`/`checkJs` with no new dependency and no TypeScript runner, and does every touched durable file pass a per-file `CLAUDE.md` ledger? | C1, D0.1, D0.2, `CLAUDE.md` Authoring and Engineering | C1 path census; read `tsconfig.json` include and the dependency delta; adjudicate the ledger; confirm `format:check`, `lint` and `check` pass over the u1 files. |

## Details

One `### <row id>` section per row needing a ruling. Omit sections for clean `pass` rows.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.
