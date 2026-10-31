# Default-operator mutation credit — the legacy export lane (mnt5 m12, ruled at n6)

Global `CLAUDE.md` `Engineering` credits a test that already passes once the stack's mutation
tool, at its default operators, kills mutants in the files the test imports or calls, scope +
command + every survivor recorded, and each survivor ruled against the contract by someone other
than the test's author. This is that record for `tests/legacy-export-lane.test.ts` (m5u6), green at
base since it shipped; `pnpm mutate`'s hand-written mutants stay firing records.

- Tool: StrykerJS 10.0.0 with `@stryker-mutator/vitest-runner` 10.0.0, default mutators,
  `perTest` coverage (the runner's only mode).
- Scope: the production modules the suite imports — `tools/kb/exports.mjs`,
  `tools/kb/paths.mjs`, `tools/kb/produce.mjs`, each unchanged from `c511755` to the n6 run;
  n34 appended the read-only arithmetic block to `paths.mjs` `payloadSource` after it.
  `tests/clinical-test-support.ts` is test code.
- Command: `pnpm stryker` = `tools/mutation/stryker.config.mjs`, the suite run alone per mutant
  through `tools/mutation/vitest.config.mjs`, then `tools/mutation/survivors.mjs`.
- Result (n6): 299 mutants — 126 killed, 0 timed out, 54 survived, 49 fail the suite at collection,
  70 uncovered. The suite is credited with the 126 kills alone. Earlier runs: m12 `2c76c7b` 102
  killed (296 mutants); m16 112 (296); after the upstream sync, at `25f1c9c`, 112 killed, 65
  survived, 49 collection failures, 73 uncovered (299).

## Rulings (n6)

Every mutant the `25f1c9c` run left alive — 65 survived + 73 uncovered = 138 — carries a ruling
against the m5u6 contract (D1–D9) by `reviewer-18`, a `reviewer` teammate that wrote neither the
suite nor this record: 14 `specified`, 120 `open`, 4 `equivalent`. `open` = behaviour D1–D9 leave
unspecified, never a product-wide approval; `equivalent` = no input in the lane's domain can
observe the difference. Each `specified` mutant gained a case that kills it through observable
behaviour, and the n6 run shows it killed:

| mutant | ruling | killed by |
| --- | --- | --- |
| M001 `tools/kb/paths.mjs:14:41` StringLiteral | specified (D1) | `D1 the preflight reads the manifest kb:build wrote over the vendored bag` |
| M002 `tools/kb/paths.mjs:14:47` StringLiteral | specified (D1) | `D1 the preflight reads the manifest kb:build wrote over the vendored bag` |
| M003 `tools/kb/paths.mjs:15:50` StringLiteral | specified (D1) | `D1 the preflight reads the manifest kb:build wrote over the vendored bag` |
| M004 `tools/kb/paths.mjs:35:5` StringLiteral | specified (D7) | `D7 the shipped image was built from exactly the payload source, so the lane compiled nothing into it` |
| M005 `tools/kb/paths.mjs:36:5` StringLiteral | specified (D7) | `D7 the shipped image was built from exactly the payload source, so the lane compiled nothing into it` |
| M006 `tools/kb/paths.mjs:41:35` BlockStatement | specified (D1) | `D1 the preflight reads the manifest kb:build wrote over the vendored bag` |
| M007 `tools/kb/paths.mjs:42:7` BlockStatement | specified (D1) | `D1 the preflight reads the manifest kb:build wrote over the vendored bag` |
| M121 `tools/kb/exports.mjs:31:27` StringLiteral | specified (D6) | `D6 binding:check requires this file under the name LANE_SUITE carries` |
| M122 `tools/kb/exports.mjs:33:20` Regex | specified (D1) | `D1 a file outside a guideline query directory, or past its .pl, joins no export` |
| M123 `tools/kb/exports.mjs:33:20` Regex | specified (D1) | `D1 a file outside a guideline query directory, or past its .pl, joins no export` |
| M129 `tools/kb/exports.mjs:102:7` StringLiteral | specified (D9) | `D2 every offender is named apart, under the declared count` |
| M132 `tools/kb/exports.mjs:103:67` StringLiteral | specified (D2) | `D2 every offender is named apart, under the declared count` |
| M136 `tools/kb/exports.mjs:104:58` StringLiteral | specified (D2) | `D2 every offender is named apart, under the declared count` |
| M138 `tools/kb/exports.mjs:133:46` StringLiteral | specified (D3) | `D3 a projection of two variables keeps both columns` |

The ruling of each mutant still alive is the last column of the table below. Register, from the
same review: m5u6 D1 and D3 count 4 exports where `EXPORTED` declares 6 since the upstream sync
(the registry rows for `.agent/contracts/m5u6.md` D1 and D3 say so), and its heading `Why RED-under-dependency-removal is the
whole credit` predates the default-operator credit law, which `.claude/rules/kb-build.md`
`Legacy export lane` states: D5 is the firing record, these kills are the credit.

## Collection failures

Stryker reports 103 mutants `Survived`; 49 of them completed zero tests. The suite reads the bag
through `exportedQueries` at module scope, so a mutant that breaks that call throws at import and
no case runs, and the vitest runner reads that as a survivor. `tools/mutation/survivors.mjs`
replays each such mutant by hand: written into the working tree, the suite run alone, the file
restored and proven byte-equal. Each fails the suite at import: 45 throw the exporter's own
refusal, 4 a JavaScript error from a mutated call (`Cannot read properties of null` ×2, `Digest
method not supported`, `Unknown encoding`). A collection failure is no assertion catching the
mutant (`.claude/rules/firing.md`), so none is credited and none owes a ruling.

## Guards

At m12 the five guards that refuse a malformed exported query — `exports.mjs:67`, `:69`, `:72`,
`:74`, `:93` — each survived as `false`, because no suite planted the input they refuse. m16's
`D2 guards` case plants each one into a copy of the verified bag and requires its message; all
five `false` mutants and the five refusal-message mutants are killed.

## Every mutant left alive

In location order, as `pnpm stryker` prints it, each with its non-author ruling (row id of
`reviewer-18`'s table, then the ruling).

| mutant | mutator | replacement | verdict | ruling |
| --- | --- | --- | --- | --- |
| `tools/kb/paths.mjs:45:83` | StringLiteral | "\"\"" | Survived | M008 equivalent: encoding '' returns a Buffer, and JSON.parse converts that Buffer to the same default UTF-8 text before parsing. |
| `tools/kb/paths.mjs:47:11` | BlockStatement | "{}" | NoCoverage | M009 equivalent: an empty catch falls off the function and returns undefined, exactly like its explicit return. |
| `tools/kb/produce.mjs:23:22` | ArrowFunction | "() => undefined" | Survived | M010 open: the standalone verifyImage factory disappears; D4's lane uses loadImageDefault, not this verifier. |
| `tools/kb/produce.mjs:23:42` | StringLiteral | "\"\"" | NoCoverage | M011 open: standalone saved-image verifier module selection; nearest D4 does not specify this unused verifier. |
| `tools/kb/produce.mjs:56:13` | BlockStatement | "{}" | Survived | M012 open: caller wall-clock restoration; D7 specifies unchanged PVM bytes, not Date.now after a completed build. |
| `tools/kb/produce.mjs:79:15` | ArrowFunction | "() => undefined" | Survived | M013 open: printErr diagnostic capture; D5 requires the dependency-erasure oracle to fail, not every builder diagnostic to be fatal. |
| `tools/kb/produce.mjs:80:78` | BlockStatement | "{}" | Survived | M014 open: on_output diagnostic capture; nearest D5 specifies wrong-answer detection, not stderr handling. |
| `tools/kb/produce.mjs:81:11` | ConditionalExpression | "false" | Survived | M015 open: suppressing stderr capture; D3/D5 grade answer bytes, not build-time diagnostic policy. |
| `tools/kb/produce.mjs:81:11` | ConditionalExpression | "true" | Survived | M016 open: capturing stdout as diagnostics; D4's shipped-image baseline does not specify acceptance of arbitrary stdout-emitting payloads. |
| `tools/kb/produce.mjs:81:11` | EqualityOperator | "stream !== 'stderr'" | Survived | M017 open: reversed output-channel filter; nearest D5 leaves builder stdout/stderr classification unspecified. |
| `tools/kb/produce.mjs:81:22` | StringLiteral | "\"\"" | Survived | M018 open: matching an empty stream name suppresses normal stderr capture; no D-row specifies that channel policy. |
| `tools/kb/produce.mjs:81:32` | CallExpression | ";" | Survived | M019 open: removing diagnostics.push(text) changes build diagnostics, which D3/D5 do not grade. |
| `tools/kb/produce.mjs:101:33` | BlockStatement | "{}" | NoCoverage | M020 open: builder exception normalization; D5 uses a valid erasure and specifies no thrown-value or error-message contract. |
| `tools/kb/produce.mjs:102:7` | ConditionalExpression | "false" | NoCoverage | M021 open: standard Error objects become wrapped; D5 specifies a valid dependency erasure, not error identity or formatting. |
| `tools/kb/produce.mjs:102:7` | ConditionalExpression | "true" | NoCoverage | M022 open: non-Error causes escape unchanged; no D-row specifies normalization of thrown values. |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "false" | NoCoverage | M023 open: object.message gives way to String(cause); D5 does not specify halt-message preservation. |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage | M024 open: unconditional cause.message access can mask null/undefined causes; D5 specifies no arbitrary-cause handling. |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage | M025 open: removing the object/null/property guards can throw while formatting a cause; nearest D5 specifies no formatting contract. |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage | M026 open: the in operator becomes reachable on primitives; D5 never requires arbitrary thrown primitives to be normalized. |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage | M027 open: primitive causes reach the in operator; D5 does not define this builder exception surface. |
| `tools/kb/produce.mjs:104:5` | EqualityOperator | "typeof cause !== 'object'" | NoCoverage | M028 open: reversed object test loses object messages and can throw on primitives; no D-row specifies either result. |
| `tools/kb/produce.mjs:104:5` | LogicalOperator | "typeof cause === 'object' && cause !== null && 'message' in " | NoCoverage | M029 open: OR defeats the message guard and admits non-string messages; D5 leaves thrown-cause normalization open. |
| `tools/kb/produce.mjs:104:5` | LogicalOperator | "typeof cause === 'object' && cause !== null \|\| 'message' in " | NoCoverage | M030 open: OR reaches the property test for nonobjects; nearest D5 does not specify behaviour after a thrown primitive. |
| `tools/kb/produce.mjs:104:5` | LogicalOperator | "typeof cause === 'object' \|\| cause !== null" | NoCoverage | M031 open: OR admits null and primitives before the in test; D5 specifies no arbitrary-cause conversion. |
| `tools/kb/produce.mjs:104:22` | StringLiteral | "\"\"" | NoCoverage | M032 open: an impossible typeof tag forces stringification; D5 does not promise that an ExitStatus.message is retained. |
| `tools/kb/produce.mjs:104:34` | ConditionalExpression | "true" | NoCoverage | M033 open: deleting the null guard can replace the original halt with a TypeError; D5 does not define null causes. |
| `tools/kb/produce.mjs:104:34` | EqualityOperator | "cause === null" | NoCoverage | M034 open: reversed null guard rejects useful object messages and dereferences null; no D-row specifies this error path. |
| `tools/kb/produce.mjs:104:52` | StringLiteral | "\"\"" | NoCoverage | M035 open: empty property key suppresses ordinary object messages; D5 does not specify message extraction. |
| `tools/kb/produce.mjs:104:74` | ConditionalExpression | "true" | NoCoverage | M036 open: non-string message properties are accepted; nearest D5 has no arbitrary object-message contract. |
| `tools/kb/produce.mjs:104:74` | EqualityOperator | "typeof cause.message !== 'string'" | NoCoverage | M037 open: the message-type check is reversed; D5 specifies wrong-answer detection, not halt-message types. |
| `tools/kb/produce.mjs:104:99` | StringLiteral | "\"\"" | NoCoverage | M038 open: impossible message typeof tag disables object-message preservation; no D-row specifies that preservation. |
| `tools/kb/produce.mjs:107:20` | StringLiteral | "``" | NoCoverage | M039 open: the builder halt message becomes empty; D2's named-id requirement applies to exported-set refusal, not builder errors. |
| `tools/kb/produce.mjs:113:20` | Regex | "/Warning:.*(?:qsave\\.pl:\\d+:\|library\\(shlib\\))/u" | Survived | M040 open: unanchored warning matching can suppress an ERROR containing Warning text; D5 does not specify save-diagnostic rejection. |
| `tools/kb/produce.mjs:117:52` | ArrowFunction | "() => undefined" | Survived | M041 open: filtering everything hides genuine save errors; nearest D5 specifies dependency-loss detection, not save-diagnostic validation. |
| `tools/kb/produce.mjs:117:62` | ConditionalExpression | "false" | Survived | M042 open: false filter discards all save errors; D3/D5 require answer comparison, not a general build diagnostic oracle. |
| `tools/kb/produce.mjs:117:62` | MethodExpression | "line" | Survived | M043 open: whitespace-only diagnostics become fatal; D4's shipped baseline does not specify whitespace normalization for arbitrary diagnostics. |
| `tools/kb/produce.mjs:124:3` | CallExpression | ";" | Survived | M044 equivalent: writeSource runs under the pinned clock; fresh MEMFS creation/write already sets the source timestamps to the same zero values. |
| `tools/kb/produce.mjs:142:39` | StringLiteral | "\"\"" | Survived | M045 open: the reported Prolog version loses its query; D3/D5 grade live answers, not build metadata's runtime-version field. |
| `tools/kb/produce.mjs:143:7` | ConditionalExpression | "false" | Survived | M047 open: distinct-value count guard disappears; D5 does not define mixed-schema/coercion handling. |
| `tools/kb/produce.mjs:143:7` | ConditionalExpression | "false" | Survived | M046 open: mixed-schema rejection disappears; D5 removes an answer dependency, not a schema declaration, and specifies no schema validator. |
| `tools/kb/produce.mjs:143:7` | LogicalOperator | "Number(schema['D']) !== 1 && Number(schema['Hi']) !== Number" | Survived | M048 open: both schema discrepancies become necessary to refuse; no D-row defines this metadata consistency policy. |
| `tools/kb/produce.mjs:143:36` | ConditionalExpression | "false" | Survived | M049 open: min/max cross-check is removed; D5 specifies no readContract validation, and the check is redundant for ordinary singleton numeric schemas. |
| `tools/kb/produce.mjs:143:83` | BlockStatement | "{}" | NoCoverage | M050 open: schema inconsistency no longer throws; D5's valid payload-dependency erasure does not specify mixed-schema rejection. |
| `tools/kb/produce.mjs:144:21` | StringLiteral | "``" | NoCoverage | M051 open: schema-refusal wording becomes empty; D2 names query ids, not schema counts or builder errors. |
| `tools/kb/produce.mjs:144:55` | StringLiteral | "\"\"" | NoCoverage | M052 open: schema-refusal count reads the wrong key; D2's named-id requirement does not cover builder schema diagnostics. |
| `tools/kb/produce.mjs:149:13` | StringLiteral | "``" | Survived | M053 open: contract.prolog becomes empty; D3/D5 specify answer bytes, not runtime-version metadata. |
| `tools/kb/produce.mjs:149:31` | StringLiteral | "\"\"" | Survived | M054 open: reported Prolog major version is wrong; no D-row specifies that metadata field. |
| `tools/kb/produce.mjs:149:56` | StringLiteral | "\"\"" | Survived | M055 open: reported Prolog minor version is wrong; nearest D7 constrains PVM bytes, not returned metadata. |
| `tools/kb/produce.mjs:149:81` | StringLiteral | "\"\"" | Survived | M056 open: reported Prolog patch version is wrong; D3/D5 leave runtime-version metadata unspecified. |
| `tools/kb/produce.mjs:157:43` | BlockStatement | "{}" | Survived | M057 open: all diagnostic rejection is removed; D5 requires an oracle mismatch after dependency erasure, not diagnostic refusal. |
| `tools/kb/produce.mjs:158:7` | ConditionalExpression | "false" | Survived | M058 open: diagnostic rejection is disabled; nearest D5 specifies answer-path dependency detection, not stderr policy. |
| `tools/kb/produce.mjs:158:31` | BlockStatement | "{}" | NoCoverage | M059 open: nonempty diagnostics no longer cause a throw; D3/D5 do not grade this general builder guard. |
| `tools/kb/produce.mjs:159:21` | StringLiteral | "``" | NoCoverage | M060 open: diagnostic refusal loses its wording; D2 names export ids, not builder diagnostic text. |
| `tools/kb/produce.mjs:159:107` | StringLiteral | "\"\"" | NoCoverage | M061 open: diagnostic lines concatenate without separators; D2 names export ids and does not define builder diagnostic layout. |
| `tools/kb/produce.mjs:167:43` | BlockStatement | "{}" | Survived | M062 open: loaded-schema/document validation disappears; D5 erases an entity dependency and does not specify metadata validation. |
| `tools/kb/produce.mjs:168:7` | ConditionalExpression | "false" | Survived | M063 open: invalid schemaVersion is accepted; no D-row specifies the builder's positive-integer schema constraint. |
| `tools/kb/produce.mjs:168:7` | LogicalOperator | "!Number.isInteger(contract.schemaVersion) && contract.schema" | Survived | M064 open: schema rejection requires both noninteger and below-one; D5 does not define this schema-domain check. |
| `tools/kb/produce.mjs:168:52` | ConditionalExpression | "false" | Survived | M065 open: zero/negative integer schema versions pass; nearest D5 does not vary schema versions. |
| `tools/kb/produce.mjs:168:80` | BlockStatement | "{}" | NoCoverage | M066 open: the invalid-schema throw disappears; D5's dependency-erasure observable is an export mismatch, not metadata refusal. |
| `tools/kb/produce.mjs:169:21` | StringLiteral | "``" | NoCoverage | M067 open: invalid-schema error text becomes empty; D2's named offender is an exported query id, not a schema diagnostic. |
| `tools/kb/produce.mjs:171:7` | ConditionalExpression | "false" | Survived | M068 open: nonpositive/noninteger document metadata passes requireLoaded; D5 does not specify document-count validation. |
| `tools/kb/produce.mjs:171:7` | LogicalOperator | "!Number.isInteger(contract.documents) && contract.documents " | Survived | M069 open: document rejection requires both conditions; D5 does not define acceptance of zero, fractional or malformed document counts. |
| `tools/kb/produce.mjs:171:48` | ConditionalExpression | "false" | Survived | M070 open: the positive-document floor disappears; nearest D5 never supplies an empty corpus. |
| `tools/kb/produce.mjs:171:48` | EqualityOperator | "contract.documents <= 1" | Survived | M071 open: a sound one-document build is rejected; D4 specifies the shipped image at base, not every corpus size. |
| `tools/kb/produce.mjs:171:72` | BlockStatement | "{}" | NoCoverage | M072 open: invalid document metadata no longer throws; nearest D5 preserves document declarations and checks exported solutions. |
| `tools/kb/produce.mjs:172:21` | StringLiteral | "``" | NoCoverage | M073 open: document-count refusal loses its text; D2 does not prescribe builder error messages. |
| `tools/kb/produce.mjs:188:58` | BlockStatement | "{}" | Survived | M074 open: source-marker/document-count agreement is unchecked; D5 only requires the selected exported answer to lose its erased dependency. |
| `tools/kb/produce.mjs:189:34` | Regex | "/% file:/gmu" | Survived | M075 open: inline marker text counts as a document; D5 specifies no marker grammar or whole-corpus build-count guard. |
| `tools/kb/produce.mjs:189:52` | ArrayDeclaration | "[\"Stryker was here\"]" | NoCoverage | M076 open: marker-free source gets expected count one; D5's marked payload does not define marker-free-source validation. |
| `tools/kb/produce.mjs:190:7` | ConditionalExpression | "false" | Survived | M077 open: marker/document disagreement is accepted; nearest D5 tests exported dependency loss, not all corpus-document completeness. |
| `tools/kb/produce.mjs:190:40` | BlockStatement | "{}" | NoCoverage | M078 open: the whole-corpus-count throw disappears; D5 supplies no count mismatch and requires no such guard. |
| `tools/kb/produce.mjs:191:21` | StringLiteral | "``" | NoCoverage | M079 open: count-mismatch diagnostic becomes empty; D2 names query-set offenders, not payload-file counts. |
| `tools/kb/produce.mjs:207:25` | StringLiteral | "\"\"" | Survived | M080 open: diagnostic refusal loses the image-build phase label; no D-row specifies builder phase wording. |
| `tools/kb/produce.mjs:209:29` | StringLiteral | "\"\"" | Survived | M081 open: loaded-contract refusal loses the image-build phase label; D2's named-query obligation does not cover this text. |
| `tools/kb/produce.mjs:210:44` | StringLiteral | "\"\"" | Survived | M082 open: whole-corpus-count refusal loses its phase label; no D-row specifies that label. |
| `tools/kb/produce.mjs:212:42` | StringLiteral | "\"\"" | Survived | M083 open: save-diagnostic refusal loses its phase label; D2 specifies query ids, not image-save wording. |
| `tools/kb/produce.mjs:214:19` | BlockStatement | "{}" | NoCoverage | M084 open: a failing build resolves undefined instead of rejecting; D5 specifies a valid erasure that builds, not builder exception propagation. |
| `tools/kb/produce.mjs:215:17` | StringLiteral | "\"\"" | NoCoverage | M085 open: non-Error build failures lose their phase label; no D-row fixes this message format. |
| `tools/kb/produce.mjs:226:25` | ArrowFunction | "() => undefined" | Survived | M086 open: QLF compilation disappears; D3/D4 use the saved PVM and D7 constrains PVM bytes, not fallback generation. |
| `tools/kb/produce.mjs:227:31` | BlockStatement | "{}" | NoCoverage | M087 open: the pinned QLF build phase returns no artifact; no D-row specifies the QLF fallback. |
| `tools/kb/produce.mjs:228:7` | BlockStatement | "{}" | NoCoverage | M088 open: QLF build's try body disappears; D3/D5 execute PVMs, not QLF artifacts. |
| `tools/kb/produce.mjs:229:52` | ArrayDeclaration | "[]" | NoCoverage | M089 open: QLF boot loses quiet mode; no D-row defines fallback boot flags or startup output. |
| `tools/kb/produce.mjs:229:53` | StringLiteral | "\"\"" | NoCoverage | M090 open: QLF boot receives an empty argument; no D-row specifies this fallback's CLI configuration. |
| `tools/kb/produce.mjs:229:60` | ArrayDeclaration | "[\"Stryker was here\"]" | NoCoverage | M091 open: QLF preRun contains a noncallback; D1–D9 contain no QLF-build contract. |
| `tools/kb/produce.mjs:230:5` | CallExpression | ";" | NoCoverage | M092 open: QLF startup diagnostics are retained into compile grading; no D-row fixes fallback diagnostic phase boundaries. |
| `tools/kb/produce.mjs:231:5` | CallExpression | ";" | NoCoverage | M093 open: QLF compilation receives no source file; D3/D4's PVM lane and D7's PVM bytes do not specify the fallback. |
| `tools/kb/produce.mjs:232:25` | StringLiteral | "``" | NoCoverage | M094 open: qcompile is replaced by an empty query; no D-row requires a QLF output. |
| `tools/kb/produce.mjs:233:25` | StringLiteral | "\"\"" | NoCoverage | M095 open: QLF build diagnostic label becomes empty; D2's query-id requirement does not reach fallback errors. |
| `tools/kb/produce.mjs:234:31` | StringLiteral | "\"\"" | NoCoverage | M096 open: QLF output is read from an empty path; D7 specifies PVM byte invariance, not QLF generation. |
| `tools/kb/produce.mjs:235:19` | BlockStatement | "{}" | NoCoverage | M097 open: QLF build errors resolve undefined instead of rejecting; no D-row specifies fallback error propagation. |
| `tools/kb/produce.mjs:236:17` | StringLiteral | "\"\"" | NoCoverage | M098 open: QLF halt messages lose the phase name; D2's naming obligation is for query-set offenders only. |
| `tools/kb/produce.mjs:247:45` | BlockStatement | "{}" | NoCoverage | M099 open: standalone image verification returns nothing; D4's lane loads through loadImageDefault and does not specify verifyImage. |
| `tools/kb/produce.mjs:248:56` | ArrayDeclaration | "[]" | NoCoverage | M100 open: standalone verifier loses saved-state boot arguments; nearest D4 uses a different loader and does not cover this API. |
| `tools/kb/produce.mjs:248:57` | StringLiteral | "\"\"" | NoCoverage | M101 open: standalone image verification gets an empty quiet-mode argument; D4 does not specify this verifier's flags. |
| `tools/kb/produce.mjs:248:63` | StringLiteral | "\"\"" | NoCoverage | M102 open: standalone verifier loses its saved-state option; nearest D4 uses loadImageDefault rather than verifyImage. |
| `tools/kb/produce.mjs:248:69` | StringLiteral | "\"\"" | NoCoverage | M103 open: standalone verifier selects an empty image filename; D4's independent loader does not consume this filename. |
| `tools/kb/produce.mjs:248:83` | ArrayDeclaration | "[]" | NoCoverage | M104 open: verifyImage loses the hook that provides its saved image; D4 specifies the lane's separate loadImageDefault path. |
| `tools/kb/produce.mjs:249:5` | ArrowFunction | "() => undefined" | NoCoverage | M105 open: verifyImage's hook no longer writes the PVM; nearest D4 leaves this standalone wrapper unspecified. |
| `tools/kb/produce.mjs:249:37` | StringLiteral | "\"\"" | NoCoverage | M106 open: verifyImage writes the saved state to an empty path; no D-row defines this wrapper's filesystem protocol. |
| `tools/kb/produce.mjs:251:23` | StringLiteral | "\"\"" | NoCoverage | M107 open: standalone image-load diagnostic label becomes empty; D2 names export ids, not image-load failures. |
| `tools/kb/produce.mjs:253:27` | StringLiteral | "\"\"" | NoCoverage | M108 open: standalone image metadata errors lose their phase label; no D-row specifies it. |
| `tools/kb/produce.mjs:263:41` | BlockStatement | "{}" | NoCoverage | M109 open: QLF verification disappears; D3/D4 execute the PVM and D7 compares PVM bytes alone. |
| `tools/kb/produce.mjs:264:50` | ArrayDeclaration | "[]" | NoCoverage | M110 open: QLF verification loses quiet mode; D4's PVM baseline says nothing about fallback boot output. |
| `tools/kb/produce.mjs:264:51` | StringLiteral | "\"\"" | NoCoverage | M111 open: QLF verifier gets an empty boot argument; no D-row specifies fallback startup flags. |
| `tools/kb/produce.mjs:264:58` | ArrayDeclaration | "[]" | NoCoverage | M112 open: QLF verifier loses its input-file hook; D1–D9 specify no QLF verification. |
| `tools/kb/produce.mjs:265:5` | ArrowFunction | "() => undefined" | NoCoverage | M113 open: QLF verifier no longer writes its input; nearest D4's lane never uses the fallback. |
| `tools/kb/produce.mjs:265:37` | StringLiteral | "\"\"" | NoCoverage | M114 open: QLF input is written under an empty name; no D-row defines fallback filenames or loading. |
| `tools/kb/produce.mjs:267:3` | CallExpression | ";" | NoCoverage | M115 open: QLF startup diagnostics leak into load grading; D4 does not specify fallback diagnostic-drain boundaries. |
| `tools/kb/produce.mjs:268:23` | StringLiteral | "\"\"" | NoCoverage | M116 open: QLF verifier does not consult its input; D3/D4's live answers come from the PVM, not this fallback path. |
| `tools/kb/produce.mjs:269:23` | StringLiteral | "\"\"" | NoCoverage | M117 open: QLF load diagnostic label becomes empty; D2's exported-id naming does not reach fallback messages. |
| `tools/kb/produce.mjs:271:27` | StringLiteral | "\"\"" | NoCoverage | M118 open: QLF metadata errors lose their phase label; D1–D9 specify no fallback error format. |
| `tools/kb/produce.mjs:275:33` | ArrowFunction | "() => undefined" | Survived | M119 open: package-version reporting returns undefined; D3/D5 specify answers and D7 specifies PVM bytes, not this metadata API. |
| `tools/kb/produce.mjs:276:51` | StringLiteral | "\"\"" | NoCoverage | M120 open: package-version lookup loads an empty module specifier; no D-row specifies that metadata lookup. |
| `tools/kb/exports.mjs:21:39` | ArrayDeclaration | "[]" | collection failure: legacy export lane: bag exports differ from the declared set of 0; unexpected [category-a-recommenda | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:22:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [category-a-recommenda | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:23:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [dosage-reduction-cont | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:24:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [evidence-type-1-recom | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:25:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [long-term-therapy-ons | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:26:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [recommendation-exists | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:27:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [tablet-use-spacing]; | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:33:20` | Regex | "/^data\\/guidelines\\/[/]+\\/queries\\/pl\\/([^/]+)\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:33:20` | Regex | "/^data\\/guidelines\\/[^/]\\/queries\\/pl\\/([^/]+)\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:33:20` | Regex | "/^data\\/guidelines\\/[^/]+\\/queries\\/pl\\/([/]+)\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:33:20` | Regex | "/^data\\/guidelines\\/[^/]+\\/queries\\/pl\\/([^/])\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:39:20` | Regex | "/'\\$guideline_query_projection'\\(goal\\((.*)\\),answers\\((\\[.*" | Survived | M124 open: dropping the projection start anchor can accept a nested projection inside a malformed outer candidate; D3 specifies valid exported goals, not malformed-input refusal. |
| `tools/kb/exports.mjs:39:20` | Regex | "/^'\\$guideline_query_projection'\\(goal\\((.)\\),answers\\((\\[.*" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:39:20` | Regex | "/^'\\$guideline_query_projection'\\(goal\\((.*)\\),answers\\((\\[." | Survived | M125 open: trailing garbage after a projection becomes tolerated; D3 does not specify rejection of malformed compiler output. |
| `tools/kb/exports.mjs:39:20` | Regex | "/^'\\$guideline_query_projection'\\(goal\\((.*)\\),answers\\((\\[." | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:40:19` | Regex | "/\\banswer\\(([^A-Z_][A-Za-z0-9_]*)/gu" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:40:19` | Regex | "/\\banswer\\(([A-Z_][A-Za-z0-9_])/gu" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:42:18` | Regex | "/\\bLane[^A-Za-z0-9_]*/u" | Survived | M126 equivalent: both regexes test exactly whether a word-boundary Lane occurs; either starred suffix may match zero characters, and only the boolean is consumed. |
| `tools/kb/exports.mjs:42:18` | Regex | "/\\bLane[A-Za-z0-9_]/u" | Survived | M127 open: bare Lane ceases to be rejected, while LaneRaw/LaneSorted/LaneResult/LaneText still match; D3 does not specify the extra prefix reservation. |
| `tools/kb/exports.mjs:66:15` | StringLiteral | "\"\"" | collection failure: Unknown encoding: | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:67:12` | StringLiteral | "\"\"" | collection failure: legacy export lane: category-a-recommendations carries no goal projection | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:68:11` | ArrowFunction | "() => undefined" | collection failure: legacy export lane: category-a-recommendations carries no goal projection | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:68:26` | MethodExpression | "candidate.endsWith(\"'$guideline_query_projection'(\")" | collection failure: legacy export lane: category-a-recommendations carries no goal projection | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:68:47` | StringLiteral | "\"\"" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:69:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations carries no goal projection | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:69:7` | EqualityOperator | "line !== undefined" | collection failure: legacy export lane: category-a-recommendations carries no goal projection | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:71:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:71:7` | EqualityOperator | "match !== null" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:74:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations names a variable the lane reserves | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:75:21` | ArrayDeclaration | "[]" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:7` | ConditionalExpression | "true" | collection failure: legacy export lane: recommendation-exists projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:7` | EqualityOperator | "answers === '[]'" | collection failure: legacy export lane: recommendation-exists projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:7` | LogicalOperator | "answers !== '[]' \|\| projected.length === 0" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:19` | StringLiteral | "\"\"" | collection failure: legacy export lane: recommendation-exists projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:27` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:76:27` | EqualityOperator | "projected.length !== 0" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:77:41` | StringLiteral | "\"\"" | collection failure: Digest method not supported | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:91:36` | BlockStatement | "{}" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:93:9` | ConditionalExpression | "false" | collection failure: Cannot read properties of null (reading '1') | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:93:9` | ConditionalExpression | "true" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:93:9` | EqualityOperator | "match !== null" | collection failure: Cannot read properties of null (reading '1') | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:95:9` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations is exported by two guidelines | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:96:5` | CallExpression | ";" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:98:22` | MethodExpression | "[...found.keys()]" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [category-a-recommenda | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:98:22` | MethodExpression | "[...found.keys()].filter(id => !EXPORTED.includes(id))" | Survived | M128 open: unexpected ids follow insertion order rather than sort order; D2 requires every offender named, not a diagnostic ordering. |
| `tools/kb/exports.mjs:98:55` | BooleanLiteral | "EXPORTED.includes(id)" | collection failure: legacy export lane: bag exports differ from the declared set of 6; unexpected [category-a-recommenda | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:99:19` | MethodExpression | "EXPORTED" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:99:43` | BooleanLiteral | "found.has(id)" | collection failure: legacy export lane: bag exports differ from the declared set of 6; missing [category-a-recommendatio | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:100:7` | ConditionalExpression | "true" | collection failure: legacy export lane: bag exports differ from the declared set of 6 | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:100:7` | EqualityOperator | "unexpected.length <= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 6 | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:100:7` | EqualityOperator | "unexpected.length >= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 6 | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:100:32` | EqualityOperator | "missing.length <= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 6 | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:100:32` | EqualityOperator | "missing.length >= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 6 | n/a — a collection failure earns no credit and owes no ruling |
| `tools/kb/exports.mjs:103:10` | ConditionalExpression | "true" | Survived | M130 open: missing-only refusals gain unexpected []; D2 requires naming the actual offenders, not omitting empty categories. |
| `tools/kb/exports.mjs:103:10` | EqualityOperator | "unexpected.length >= 0" | Survived | M131 open: always-true nonnegative length check adds unexpected [] on missing-only refusals; D2 does not prescribe empty-category formatting. |
| `tools/kb/exports.mjs:103:78` | StringLiteral | "\"Stryker was here!\"" | Survived | M133 open: unrelated text is added when no extra id exists; D2 requires refusal and offender names, not exact ancillary prose. |
| `tools/kb/exports.mjs:104:10` | ConditionalExpression | "true" | Survived | M134 open: extra-only refusals gain missing []; D2 does not require omitting an empty missing category. |
| `tools/kb/exports.mjs:104:10` | EqualityOperator | "missing.length >= 0" | Survived | M135 open: nonnegative missing length always appends a category; D2 specifies named offenders, not empty-category layout. |
| `tools/kb/exports.mjs:104:69` | StringLiteral | "\"Stryker was here!\"" | Survived | M137 open: unrelated suffix appears on extra-only refusals; D2 does not freeze prose beyond refusal and offender identity. |
