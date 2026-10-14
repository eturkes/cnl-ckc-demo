# Default-operator mutation credit — the legacy export lane (mnt5 m12)

Global `CLAUDE.md` `Engineering` credits a test that already passes once the stack's mutation
tool, at its default operators, kills mutants in the files the test imports or calls, scope +
command + every survivor recorded. This is that record for `tests/legacy-export-lane.test.ts`
(m5u6), green at base since it shipped; `pnpm mutate`'s hand-written mutants stay firing records.

- Tool: StrykerJS 10.0.0 with `@stryker-mutator/vitest-runner` 10.0.0, default mutators,
  `perTest` coverage (the runner's only mode).
- Scope: the production modules the suite imports — `tools/kb/exports.mjs`,
  `tools/kb/paths.mjs`, `tools/kb/produce.mjs`, each byte-equal to `6d45194`.
  `tests/clinical-test-support.ts` is test code.
- Command: `pnpm stryker` = `tools/mutation/stryker.config.mjs`, the suite run alone per mutant
  through `tools/mutation/vitest.config.mjs`, then `tools/mutation/survivors.mjs`.
- Result: 296 mutants — 112 killed, 0 timed out, 64 survived, 47 fail the suite at collection,
  73 uncovered. The suite is credited with the 112 kills alone. At m12 `2c76c7b`, before the
  `D2 guards` case: 102 killed, 69 survived, 78 uncovered.

## Collection failures

Stryker reports 116 mutants `Survived`; 47 of them completed zero tests. The suite reads the bag
through `exportedQueries` at module scope, so a mutant that breaks that call throws at import and
no case runs, and the vitest runner reads that as a survivor. `tools/mutation/survivors.mjs`
replays each such mutant by hand: written into the working tree, the suite run alone, the file
restored and proven byte-equal. All 47 throw the exporter's own refusal at import. A collection
failure is no assertion catching the mutant (`.claude/rules/firing.md`), so none is credited.

## Guards

At m12 the five guards that refuse a malformed exported query — `exports.mjs:67`, `:69`, `:72`,
`:74`, `:93` — each survived as `false`, because no suite planted the input they refuse. m16's
`D2 guards` case plants each one into a copy of the verified bag and requires its message; all
five `false` mutants and the five refusal-message mutants are killed. The survivors left are
equivalent on the shipped bag (regex anchors, message text, `LANE_SUITE`, which
`binding:check` reads) or the producer's fail-closed paths D5's sound build never takes.

## Every mutant left alive

In location order, as `pnpm stryker` prints it.

| mutant | mutator | replacement | verdict |
| --- | --- | --- | --- |
| `tools/kb/paths.mjs:14:41` | StringLiteral | "\"\"" | Survived |
| `tools/kb/paths.mjs:14:47` | StringLiteral | "\"\"" | Survived |
| `tools/kb/paths.mjs:15:50` | StringLiteral | "\"\"" | Survived |
| `tools/kb/paths.mjs:35:5` | StringLiteral | "``" | Survived |
| `tools/kb/paths.mjs:40:35` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/paths.mjs:41:7` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/paths.mjs:44:83` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/paths.mjs:46:11` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:23:22` | ArrowFunction | "() => undefined" | Survived |
| `tools/kb/produce.mjs:23:42` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:56:13` | BlockStatement | "{}" | Survived |
| `tools/kb/produce.mjs:79:15` | ArrowFunction | "() => undefined" | Survived |
| `tools/kb/produce.mjs:80:78` | BlockStatement | "{}" | Survived |
| `tools/kb/produce.mjs:81:11` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:81:11` | ConditionalExpression | "true" | Survived |
| `tools/kb/produce.mjs:81:11` | EqualityOperator | "stream !== 'stderr'" | Survived |
| `tools/kb/produce.mjs:81:22` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:81:32` | CallExpression | ";" | Survived |
| `tools/kb/produce.mjs:101:33` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:102:7` | ConditionalExpression | "false" | NoCoverage |
| `tools/kb/produce.mjs:102:7` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "false" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | EqualityOperator | "typeof cause !== 'object'" | NoCoverage |
| `tools/kb/produce.mjs:104:5` | LogicalOperator | "typeof cause === 'object' && cause !== null && 'message' in " | NoCoverage |
| `tools/kb/produce.mjs:104:5` | LogicalOperator | "typeof cause === 'object' && cause !== null \|\| 'message' in " | NoCoverage |
| `tools/kb/produce.mjs:104:5` | LogicalOperator | "typeof cause === 'object' \|\| cause !== null" | NoCoverage |
| `tools/kb/produce.mjs:104:22` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:104:34` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:34` | EqualityOperator | "cause === null" | NoCoverage |
| `tools/kb/produce.mjs:104:52` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:104:74` | ConditionalExpression | "true" | NoCoverage |
| `tools/kb/produce.mjs:104:74` | EqualityOperator | "typeof cause.message !== 'string'" | NoCoverage |
| `tools/kb/produce.mjs:104:99` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:107:20` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:113:20` | Regex | "/Warning:.*(?:qsave\\.pl:\\d+:\|library\\(shlib\\))/u" | Survived |
| `tools/kb/produce.mjs:117:52` | ArrowFunction | "() => undefined" | Survived |
| `tools/kb/produce.mjs:117:62` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:117:62` | MethodExpression | "line" | Survived |
| `tools/kb/produce.mjs:124:3` | CallExpression | ";" | Survived |
| `tools/kb/produce.mjs:142:39` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:143:7` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:143:7` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:143:7` | LogicalOperator | "Number(schema['D']) !== 1 && Number(schema['Hi']) !== Number" | Survived |
| `tools/kb/produce.mjs:143:36` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:143:83` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:144:21` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:144:55` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:149:13` | StringLiteral | "``" | Survived |
| `tools/kb/produce.mjs:149:31` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:149:56` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:149:81` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:157:43` | BlockStatement | "{}" | Survived |
| `tools/kb/produce.mjs:158:7` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:158:31` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:159:21` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:159:107` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:167:43` | BlockStatement | "{}" | Survived |
| `tools/kb/produce.mjs:168:7` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:168:7` | LogicalOperator | "!Number.isInteger(contract.schemaVersion) && contract.schema" | Survived |
| `tools/kb/produce.mjs:168:52` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:168:80` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:169:21` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:171:7` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:171:7` | LogicalOperator | "!Number.isInteger(contract.documents) && contract.documents " | Survived |
| `tools/kb/produce.mjs:171:48` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:171:48` | EqualityOperator | "contract.documents <= 1" | Survived |
| `tools/kb/produce.mjs:171:72` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:172:21` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:188:58` | BlockStatement | "{}" | Survived |
| `tools/kb/produce.mjs:189:34` | Regex | "/% file:/gmu" | Survived |
| `tools/kb/produce.mjs:189:52` | ArrayDeclaration | "[\"Stryker was here\"]" | NoCoverage |
| `tools/kb/produce.mjs:190:7` | ConditionalExpression | "false" | Survived |
| `tools/kb/produce.mjs:190:40` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:191:21` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:207:25` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:209:29` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:210:44` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:212:42` | StringLiteral | "\"\"" | Survived |
| `tools/kb/produce.mjs:214:19` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:215:17` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:226:25` | ArrowFunction | "() => undefined" | Survived |
| `tools/kb/produce.mjs:227:31` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:228:7` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:229:52` | ArrayDeclaration | "[]" | NoCoverage |
| `tools/kb/produce.mjs:229:53` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:229:60` | ArrayDeclaration | "[\"Stryker was here\"]" | NoCoverage |
| `tools/kb/produce.mjs:230:5` | CallExpression | ";" | NoCoverage |
| `tools/kb/produce.mjs:231:5` | CallExpression | ";" | NoCoverage |
| `tools/kb/produce.mjs:232:25` | StringLiteral | "``" | NoCoverage |
| `tools/kb/produce.mjs:233:25` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:234:31` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:235:19` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:236:17` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:247:45` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:248:56` | ArrayDeclaration | "[]" | NoCoverage |
| `tools/kb/produce.mjs:248:57` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:248:63` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:248:69` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:248:83` | ArrayDeclaration | "[]" | NoCoverage |
| `tools/kb/produce.mjs:249:5` | ArrowFunction | "() => undefined" | NoCoverage |
| `tools/kb/produce.mjs:249:37` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:251:23` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:253:27` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:263:41` | BlockStatement | "{}" | NoCoverage |
| `tools/kb/produce.mjs:264:50` | ArrayDeclaration | "[]" | NoCoverage |
| `tools/kb/produce.mjs:264:51` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:264:58` | ArrayDeclaration | "[]" | NoCoverage |
| `tools/kb/produce.mjs:265:5` | ArrowFunction | "() => undefined" | NoCoverage |
| `tools/kb/produce.mjs:265:37` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:267:3` | CallExpression | ";" | NoCoverage |
| `tools/kb/produce.mjs:268:23` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:269:23` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:271:27` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/produce.mjs:275:33` | ArrowFunction | "() => undefined" | Survived |
| `tools/kb/produce.mjs:276:51` | StringLiteral | "\"\"" | NoCoverage |
| `tools/kb/exports.mjs:21:39` | ArrayDeclaration | "[]" | collection failure: legacy export lane: bag exports differ from the declared set of 0; unexpected [category-a-recommenda |
| `tools/kb/exports.mjs:22:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 4; unexpected [category-a-recommenda |
| `tools/kb/exports.mjs:23:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 4; unexpected [dosage-reduction-cont |
| `tools/kb/exports.mjs:24:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 4; unexpected [evidence-type-1-recom |
| `tools/kb/exports.mjs:25:3` | StringLiteral | "\"\"" | collection failure: legacy export lane: bag exports differ from the declared set of 4; unexpected [recommendation-exists |
| `tools/kb/exports.mjs:29:27` | StringLiteral | "\"\"" | Survived |
| `tools/kb/exports.mjs:31:20` | Regex | "/^data\\/guidelines\\/[/]+\\/queries\\/pl\\/([^/]+)\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:31:20` | Regex | "/^data\\/guidelines\\/[^/]\\/queries\\/pl\\/([^/]+)\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:31:20` | Regex | "/^data\\/guidelines\\/[^/]+\\/queries\\/pl\\/([/]+)\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:31:20` | Regex | "/^data\\/guidelines\\/[^/]+\\/queries\\/pl\\/([^/])\\.pl$/u" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:31:20` | Regex | "/^data\\/guidelines\\/[^/]+\\/queries\\/pl\\/([^/]+)\\.pl/u" | Survived |
| `tools/kb/exports.mjs:31:20` | Regex | "/data\\/guidelines\\/[^/]+\\/queries\\/pl\\/([^/]+)\\.pl$/u" | Survived |
| `tools/kb/exports.mjs:37:20` | Regex | "/'\\$guideline_query_projection'\\(goal\\((.*)\\),answers\\((\\[.*" | Survived |
| `tools/kb/exports.mjs:37:20` | Regex | "/^'\\$guideline_query_projection'\\(goal\\((.)\\),answers\\((\\[.*" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape |
| `tools/kb/exports.mjs:37:20` | Regex | "/^'\\$guideline_query_projection'\\(goal\\((.*)\\),answers\\((\\[." | Survived |
| `tools/kb/exports.mjs:37:20` | Regex | "/^'\\$guideline_query_projection'\\(goal\\((.*)\\),answers\\((\\[." | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape |
| `tools/kb/exports.mjs:38:19` | Regex | "/\\banswer\\(([^A-Z_][A-Za-z0-9_]*)/gu" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:38:19` | Regex | "/\\banswer\\(([A-Z_][A-Za-z0-9_])/gu" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:40:18` | Regex | "/\\bLane[^A-Za-z0-9_]*/u" | Survived |
| `tools/kb/exports.mjs:40:18` | Regex | "/\\bLane[A-Za-z0-9_]/u" | Survived |
| `tools/kb/exports.mjs:64:15` | StringLiteral | "\"\"" | collection failure: Unknown encoding:  |
| `tools/kb/exports.mjs:65:12` | StringLiteral | "\"\"" | collection failure: legacy export lane: category-a-recommendations carries no goal projection |
| `tools/kb/exports.mjs:66:11` | ArrowFunction | "() => undefined" | collection failure: legacy export lane: category-a-recommendations carries no goal projection |
| `tools/kb/exports.mjs:66:26` | MethodExpression | "candidate.endsWith(\"'$guideline_query_projection'(\")" | collection failure: legacy export lane: category-a-recommendations carries no goal projection |
| `tools/kb/exports.mjs:66:47` | StringLiteral | "\"\"" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape |
| `tools/kb/exports.mjs:67:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations carries no goal projection |
| `tools/kb/exports.mjs:67:7` | EqualityOperator | "line !== undefined" | collection failure: legacy export lane: category-a-recommendations carries no goal projection |
| `tools/kb/exports.mjs:69:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape |
| `tools/kb/exports.mjs:69:7` | EqualityOperator | "match !== null" | collection failure: legacy export lane: category-a-recommendations projection has an unsupported shape |
| `tools/kb/exports.mjs:72:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations names a variable the lane reserves |
| `tools/kb/exports.mjs:73:21` | ArrayDeclaration | "[]" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:74:7` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:74:7` | ConditionalExpression | "true" | collection failure: legacy export lane: recommendation-exists projects nothing it reports |
| `tools/kb/exports.mjs:74:7` | EqualityOperator | "answers === '[]'" | collection failure: legacy export lane: recommendation-exists projects nothing it reports |
| `tools/kb/exports.mjs:74:7` | LogicalOperator | "answers !== '[]' \|\| projected.length === 0" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:74:19` | StringLiteral | "\"\"" | collection failure: legacy export lane: recommendation-exists projects nothing it reports |
| `tools/kb/exports.mjs:74:27` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:74:27` | EqualityOperator | "projected.length !== 0" | collection failure: legacy export lane: category-a-recommendations projects nothing it reports |
| `tools/kb/exports.mjs:75:41` | StringLiteral | "\"\"" | collection failure: Digest method not supported |
| `tools/kb/exports.mjs:89:36` | BlockStatement | "{}" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:91:9` | ConditionalExpression | "false" | collection failure: Cannot read properties of null (reading '1') |
| `tools/kb/exports.mjs:91:9` | ConditionalExpression | "true" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:91:9` | EqualityOperator | "match !== null" | collection failure: Cannot read properties of null (reading '1') |
| `tools/kb/exports.mjs:93:9` | ConditionalExpression | "true" | collection failure: legacy export lane: category-a-recommendations is exported by two guidelines |
| `tools/kb/exports.mjs:94:5` | CallExpression | ";" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:96:22` | MethodExpression | "[...found.keys()]" | collection failure: legacy export lane: bag exports differ from the declared set of 4; unexpected [category-a-recommenda |
| `tools/kb/exports.mjs:96:22` | MethodExpression | "[...found.keys()].filter(id => !EXPORTED.includes(id))" | Survived |
| `tools/kb/exports.mjs:96:55` | BooleanLiteral | "EXPORTED.includes(id)" | collection failure: legacy export lane: bag exports differ from the declared set of 4; unexpected [category-a-recommenda |
| `tools/kb/exports.mjs:97:19` | MethodExpression | "EXPORTED" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:97:43` | BooleanLiteral | "found.has(id)" | collection failure: legacy export lane: bag exports differ from the declared set of 4; missing [category-a-recommendatio |
| `tools/kb/exports.mjs:98:7` | ConditionalExpression | "true" | collection failure: legacy export lane: bag exports differ from the declared set of 4 |
| `tools/kb/exports.mjs:98:7` | EqualityOperator | "unexpected.length <= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 4 |
| `tools/kb/exports.mjs:98:7` | EqualityOperator | "unexpected.length >= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 4 |
| `tools/kb/exports.mjs:98:32` | EqualityOperator | "missing.length <= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 4 |
| `tools/kb/exports.mjs:98:32` | EqualityOperator | "missing.length >= 0" | collection failure: legacy export lane: bag exports differ from the declared set of 4 |
| `tools/kb/exports.mjs:100:7` | StringLiteral | "``" | Survived |
| `tools/kb/exports.mjs:101:10` | ConditionalExpression | "true" | Survived |
| `tools/kb/exports.mjs:101:10` | EqualityOperator | "unexpected.length >= 0" | Survived |
| `tools/kb/exports.mjs:101:67` | StringLiteral | "\"\"" | Survived |
| `tools/kb/exports.mjs:101:78` | StringLiteral | "\"Stryker was here!\"" | Survived |
| `tools/kb/exports.mjs:102:10` | ConditionalExpression | "true" | Survived |
| `tools/kb/exports.mjs:102:10` | EqualityOperator | "missing.length >= 0" | Survived |
| `tools/kb/exports.mjs:102:58` | StringLiteral | "\"\"" | Survived |
| `tools/kb/exports.mjs:102:69` | StringLiteral | "\"Stryker was here!\"" | Survived |
| `tools/kb/exports.mjs:131:46` | StringLiteral | "\"\"" | Survived |
