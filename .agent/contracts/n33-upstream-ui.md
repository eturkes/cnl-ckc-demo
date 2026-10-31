# n33 — upstream `tests/ui/` corpus: default-operator mutation record

Queue row `The vendored tests/ui/ corpus runs against no suite` (`.agent/deferred.md` at `2f439d6`).
Suite `tests/upstream-ui-corpus.test.ts`; base-green cases (U1, U2 and the 28 U3 families the base
port already met) are credited by the kills below, the six red at base by their red witness (commit
body).

- Command: `STRYKER_SUITE=tests/upstream-ui-corpus.test.ts STRYKER_MUTATE='tools/kb/provenance.mjs:55-310,tools/kb/provenance.mjs:520-562,tools/kb/provenance.mjs:588-700' pnpm stryker`
  (the final run's line ranges; the first ran 55-296, 508-548, 574-684 on the file before the
  representation check was narrowed).
- Scope: the port functions the families target — text decoding, ids, coverage, the representation
  inventory, projection notes, release labels, extraction, passage selection, alignment, and
  `deriveProvenance`. The Prolog clause parser (`splitTopLevel` … `parseClauseSites`) is out of
  scope; `tests/kb-derived-assets.test.ts` and `tests/proof-identity.test.ts` grade it over the
  shipped bag.
- First run (U3 green = no throw, PL strictly decoded): 353 killed, 1 timeout, 174 survived, 85
  uncovered. Rulings by `classifier-1` (classifier, non-author) over all 259: 16 specified, 35
  equivalent, 208 open. Every specified mutant was a green-family join-output gap, so U3 now holds
  each green family's chunks to an independent reading of its own tree (document set, region,
  passage, ACE text and sentences, native alignment rows, clause texts).
- Final run (PL checked for UTF-8 alone, so T14's CR-in-Prolog case keeps its clause-level
  refusal): 381 killed, 1 timeout, 157 survived, 85 uncovered. Of the 242 alive, 240 are first-run
  mutants at their shifted lines and 2 are new (M260, M261), ruled by `classifier-1`. Killed since
  the first run: specified M112 M161 M205 M206 M208 M215 M216 M222 M223 M226 M227 M228 M229 M230 M233 M256; open M207 M232 M259.
- Alive and ruled: 35 equivalent, 207 open, 0 specified.

`open` = behaviour the row's contract (each applicable family's verdict) leaves unspecified —
guards no family plants, refusal order across several defects, refusal detail prose, generated
index and statistics plumbing — never a product-wide approval; `equivalent` = no input in the
port's domain observes the change.

## Every mutant left alive

| id | site | mutant | status | ruling (`classifier-1`) |
| --- | --- | --- | --- | --- |
| M001 | `tools/kb/provenance.mjs:69:35` | StringLiteral "``" | Survived | open — UTF-8 error detail changes; the contract requires the recorded refusal reason, not exception prose. |
| M002 | `tools/kb/provenance.mjs:72:7` | ConditionalExpression "false" | Survived | open — control-byte decoding outside the applicable corpus; control fixtures target the unsupported README surface. |
| M003 | `tools/kb/provenance.mjs:72:64` | StringLiteral "\"\"" | NoCoverage | open — control-byte refusal reason outside the applicable corpus; its control fixture targets README. |
| M004 | `tools/kb/provenance.mjs:73:7` | ConditionalExpression "false" | Survived | open — bidi decoding outside the applicable corpus; its fixture targets unsupported README. |
| M005 | `tools/kb/provenance.mjs:73:58` | StringLiteral "\"\"" | NoCoverage | open — bidi refusal reason outside the applicable corpus; its fixture targets README. |
| M006 | `tools/kb/provenance.mjs:74:7` | ConditionalExpression "false" | Survived | open — CR decoding outside the applicable corpus; its fixture targets unsupported README. |
| M007 | `tools/kb/provenance.mjs:74:35` | StringLiteral "\"\"" | NoCoverage | open — CR refusal reason outside the applicable corpus; its fixture targets README. |
| M008 | `tools/kb/provenance.mjs:83:7` | ConditionalExpression "false" | Survived | open — missing terminal LF in TSV is not an applicable corpus family; unterminated source payloads bypass this helper. |
| M009 | `tools/kb/provenance.mjs:83:22` | StringLiteral "\"\"" | Survived | open — terminal-LF sentinel changes acceptance beyond the applicable corpus; joined family verdicts do not define all TSV bytes. |
| M010 | `tools/kb/provenance.mjs:83:36` | StringLiteral "\"\"" | NoCoverage | open — missing-final-LF refusal text is not a recorded reason of any applicable family. |
| M011 | `tools/kb/provenance.mjs:89:33` | ConditionalExpression "false" | Survived | equivalent — GUIDELINE_ID already restricts ASCII identifiers to 250 bytes; the extra byte bound cannot fail alone. |
| M012 | `tools/kb/provenance.mjs:89:55` | StringLiteral "\"\"" | Survived | equivalent — Buffer.byteLength uses UTF-8 when its encoding is empty, and the regex admits ASCII only. |
| M013 | `tools/kb/provenance.mjs:89:91` | StringLiteral "``" | Survived | open — invalid-id detail changes; applicable red families require the reason, not detail prose. |
| M014 | `tools/kb/provenance.mjs:95:7` | ConditionalExpression "false" | Survived | open — region validation removed; no applicable red family contains a space-bearing or overlong region. |
| M015 | `tools/kb/provenance.mjs:95:7` | LogicalOperator "!REGION_ID.test(id) && Buffer.byteLength(id, 'utf8') > 250" | Survived | open — invalid-region conjunction admits spaced short regions; no applicable family requires their refusal. |
| M016 | `tools/kb/provenance.mjs:95:30` | ConditionalExpression "false" | Survived | open — overlong region admitted; the corpus length cases target document and guideline ids, not regions. |
| M017 | `tools/kb/provenance.mjs:95:30` | EqualityOperator "Buffer.byteLength(id, 'utf8') >= 250" | Survived | open — 250-byte region rejected; corpus boundary family constrains document and guideline ids only. |
| M018 | `tools/kb/provenance.mjs:95:52` | StringLiteral "\"\"" | Survived | equivalent — Buffer.byteLength defaults to UTF-8 with an empty encoding; byte bound unchanged. |
| M019 | `tools/kb/provenance.mjs:95:74` | StringLiteral "\"\"" | NoCoverage | open — invalid-region reason changed; no applicable family records that reason. |
| M020 | `tools/kb/provenance.mjs:95:92` | StringLiteral "``" | NoCoverage | open — invalid-region diagnostic detail is outside the required family verdicts. |
| M021 | `tools/kb/provenance.mjs:101:7` | ConditionalExpression "false" | Survived | open — source-path guard removed; applicable corpus has no unsafe source path. |
| M022 | `tools/kb/provenance.mjs:101:7` | ConditionalExpression "false" | Survived | open — source-path subguard removed; applicable corpus has only direct safe source paths. |
| M023 | `tools/kb/provenance.mjs:101:7` | LogicalOperator "!SOURCE_PATH.test(path) && path.includes('..')" | Survived | open — unsafe source names accepted by conjunction; no applicable family exercises traversal. |
| M024 | `tools/kb/provenance.mjs:101:7` | LogicalOperator "(!SOURCE_PATH.test(path) \\|\\| path.includes('..')) && path.inc" | Survived | open — conjunction requires a backslash before refusal; unsafe path families target HTTP, not this port. |
| M025 | `tools/kb/provenance.mjs:101:78` | BlockStatement "{}" | NoCoverage | open — unsafe-source refusal erased; applicable corpus does not specify a path-safety verdict. |
| M026 | `tools/kb/provenance.mjs:102:12` | StringLiteral "\"\"" | NoCoverage | open — unsafe-source refusal reason changed outside the applicable corpus. |
| M027 | `tools/kb/provenance.mjs:110:20` | Regex "/^data\\/guidelines\\/([^/]+)\\/coverage\\.tsv/u" | Survived | open — trailing path suffix can become a guideline candidate; no family supplies such a path. |
| M028 | `tools/kb/provenance.mjs:110:20` | Regex "/data\\/guidelines\\/([^/]+)\\/coverage\\.tsv$/u" | Survived | open — prefixed path can become a guideline candidate; no family supplies such a path. |
| M029 | `tools/kb/provenance.mjs:112:55` | StringLiteral "``" | Survived | open — guideline-count diagnostic detail changes; its recorded reason remains intact. |
| M030 | `tools/kb/provenance.mjs:113:74` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — successful regex has a nonempty first capture, so the fallback identifier is unreachable. |
| M031 | `tools/kb/provenance.mjs:113:78` | StringLiteral "\"\"" | Survived | open — invalid guideline diagnostic subject changes, not the family refusal reason. |
| M032 | `tools/kb/provenance.mjs:121:23` | ConditionalExpression "true" | Survived | open — blank TSV lines retained; applicable fixtures contain no interior blank data line. |
| M033 | `tools/kb/provenance.mjs:121:32` | StringLiteral "\"Stryker was here!\"" | Survived | open — blank-line filter instead removes a sentinel; applicable corpus contains neither affected data form. |
| M034 | `tools/kb/provenance.mjs:134:53` | StringLiteral "``" | Survived | open — coverage-row diagnostic detail changes; the recorded reason does not. |
| M035 | `tools/kb/provenance.mjs:134:64` | ArithmeticOperator "index - 1" | Survived | open — diagnostic line number changes; the corpus contract requires refusal reason alone. |
| M036 | `tools/kb/provenance.mjs:135:24` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — five-field length guard precedes destructuring, so rawRegion fallback is unreachable. |
| M037 | `tools/kb/provenance.mjs:135:38` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — five-field length guard makes rawFile fallback unreachable. |
| M038 | `tools/kb/provenance.mjs:135:52` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — five-field length guard makes rawPage fallback unreachable. |
| M039 | `tools/kb/provenance.mjs:135:66` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — five-field length guard makes section fallback unreachable. |
| M040 | `tools/kb/provenance.mjs:135:79` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — five-field length guard makes status fallback unreachable. |
| M041 | `tools/kb/provenance.mjs:136:45` | StringLiteral "``" | Survived | open — region-validation detail changes, not a family verdict. |
| M042 | `tools/kb/provenance.mjs:136:56` | ArithmeticOperator "index - 1" | Survived | open — region diagnostic line numbering is outside the corpus verdict contract. |
| M043 | `tools/kb/provenance.mjs:139:9` | ConditionalExpression "false" | Survived | open — page/section validation removed; malformed-coverage family fails the earlier field-count check. |
| M044 | `tools/kb/provenance.mjs:139:9` | ConditionalExpression "false" | Survived | open — page validation removed; corpus supplies no five-field coverage row with invalid page. |
| M045 | `tools/kb/provenance.mjs:139:9` | LogicalOperator "pageMatch === null && section === ''" | Survived | open — invalid page and empty section both required for refusal; corpus exercises neither. |
| M046 | `tools/kb/provenance.mjs:139:31` | ConditionalExpression "false" | Survived | open — empty section admitted; no applicable family constrains this branch. |
| M047 | `tools/kb/provenance.mjs:139:43` | StringLiteral "\"Stryker was here!\"" | Survived | open — empty section test becomes sentinel test; applicable families contain neither affected section. |
| M048 | `tools/kb/provenance.mjs:139:54` | StringLiteral "\"\"" | NoCoverage | open — page/section refusal reason outside the applicable corpus branch. |
| M049 | `tools/kb/provenance.mjs:139:70` | StringLiteral "``" | NoCoverage | open — page/section diagnostic detail is not a required recorded reason. |
| M050 | `tools/kb/provenance.mjs:139:81` | ArithmeticOperator "index - 1" | NoCoverage | open — page/section diagnostic line number is outside the contract. |
| M051 | `tools/kb/provenance.mjs:140:9` | ConditionalExpression "false" | Survived | open — duplicate region guard removed; applicable duplicate families target document ids instead. |
| M052 | `tools/kb/provenance.mjs:140:37` | StringLiteral "\"\"" | NoCoverage | open — duplicate-region refusal reason is not recorded by an applicable family. |
| M053 | `tools/kb/provenance.mjs:143:17` | Regex "/^ace\\(([^()]+)\\)/u" | Survived | open — ACE status with suffix admitted; applicable invalid statuses do not have an ACE prefix. |
| M054 | `tools/kb/provenance.mjs:143:17` | Regex "/ace\\(([^()]+)\\)$/u" | Survived | open — ACE status with prefix admitted; no applicable family contains that status. |
| M055 | `tools/kb/provenance.mjs:145:38` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — ace regex has a nonempty first capture; fallback document id is unreachable. |
| M056 | `tools/kb/provenance.mjs:145:42` | StringLiteral "``" | Survived | open — document-id diagnostic context changes, not invalid-id reason. |
| M057 | `tools/kb/provenance.mjs:145:53` | ArithmeticOperator "index - 1" | Survived | open — document-id diagnostic row number changes, not the family verdict. |
| M058 | `tools/kb/provenance.mjs:149:8` | Regex "/^restates\\([A-Za-z0-9][A-Za-z0-9-]*\\)/u" | Survived | open — closed restates status with suffix admitted; recorded unclosed-restates family remains refused. |
| M059 | `tools/kb/provenance.mjs:149:8` | Regex "/^restates\\([A-Za-z0-9][A-Za-z0-9-]\\)$/u" | Survived | open — restates requires exactly two id characters; the corpus uses r2 and does not specify other lengths. |
| M060 | `tools/kb/provenance.mjs:149:8` | Regex "/restates\\([A-Za-z0-9][A-Za-z0-9-]*\\)$/u" | Survived | open — restates status with prefix admitted; recorded unclosed-restates family remains refused. |
| M061 | `tools/kb/provenance.mjs:150:8` | Regex "/^uncovered\\((?:heading\\|process\\|external\\|aim\\|descriptive\\|not" | Survived | open — uncovered status with suffix admitted; no-reason family still lacks the mandatory colon and reason. |
| M062 | `tools/kb/provenance.mjs:150:8` | Regex "/uncovered\\((?:heading\\|process\\|external\\|aim\\|descriptive\\|noti" | Survived | open — uncovered status with prefix admitted; no applicable family has such a prefix. |
| M063 | `tools/kb/provenance.mjs:154:33` | StringLiteral "``" | Survived | open — invalid coverage-status detail changes; refusal reason remains required and unchanged. |
| M064 | `tools/kb/provenance.mjs:154:44` | ArithmeticOperator "index - 1" | Survived | open — coverage-status diagnostic row numbering is not a required verdict. |
| M065 | `tools/kb/provenance.mjs:166:5` | CallExpression ";" | Survived | open — duplicate-region tracking erased; corpus duplicate families target distinct regions sharing a document. |
| M066 | `tools/kb/provenance.mjs:169:7` | ConditionalExpression "false" | Survived | open — zero-document coverage accepted; green/empty-guidelines targets the unsupported multi-guideline index. |
| M067 | `tools/kb/provenance.mjs:169:36` | StringLiteral "\"\"" | NoCoverage | open — coverage-empty refusal reason is not recorded by any applicable family. |
| M260 | `tools/kb/provenance.mjs:197:11` | ConditionalExpression "false" | Survived | open — ACE UTF-8 refusal moves earlier, preserving red/invalid-utf8-ace's recorded reason; an invalid ACE plus malformed projection notes can change refusal precedence, which no applicable family specifies. |
| M261 | `tools/kb/provenance.mjs:201:32` | StringLiteral "``" | Survived | open — invalid-utf8 diagnostic detail erased; the applicable invalid-Prolog family requires the refusal reason alone, not its detail template. |
| M068 | `tools/kb/provenance.mjs:214:9` | ConditionalExpression "false" | Survived | open — projection field-count validation removed; no applicable family targets malformed projection notes. |
| M069 | `tools/kb/provenance.mjs:214:37` | StringLiteral "\"\"" | NoCoverage | open — projection-row refusal reason outside the applicable family verdicts. |
| M070 | `tools/kb/provenance.mjs:214:55` | StringLiteral "``" | NoCoverage | open — projection-row diagnostic detail outside the required verdicts. |
| M071 | `tools/kb/provenance.mjs:214:66` | ArithmeticOperator "index - 1" | NoCoverage | open — projection-row diagnostic numbering outside the required verdicts. |
| M072 | `tools/kb/provenance.mjs:215:26` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field guard makes rawDocument fallback unreachable. |
| M073 | `tools/kb/provenance.mjs:215:42` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field guard makes rawRegion fallback unreachable. |
| M074 | `tools/kb/provenance.mjs:215:53` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field guard makes kept fallback unreachable. |
| M075 | `tools/kb/provenance.mjs:215:67` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field guard makes dropped fallback unreachable. |
| M076 | `tools/kb/provenance.mjs:216:45` | StringLiteral "``" | Survived | open — projection document-id diagnostic context changes, not a corpus verdict. |
| M077 | `tools/kb/provenance.mjs:216:56` | ArithmeticOperator "index - 1" | Survived | open — projection document-id diagnostic numbering is outside the contract. |
| M078 | `tools/kb/provenance.mjs:217:45` | StringLiteral "``" | Survived | open — projection region diagnostic context is outside the contract. |
| M079 | `tools/kb/provenance.mjs:217:56` | ArithmeticOperator "index - 1" | Survived | open — projection region diagnostic numbering is outside the contract. |
| M080 | `tools/kb/provenance.mjs:218:9` | ConditionalExpression "false" | Survived | open — projection validation disabled; no applicable family exercises empty/duplicate projection notes. |
| M081 | `tools/kb/provenance.mjs:218:9` | ConditionalExpression "false" | Survived | open — projection validation subcondition disabled; corpus has populated unique projection rows. |
| M082 | `tools/kb/provenance.mjs:218:9` | ConditionalExpression "false" | Survived | open — projection validation subcondition disabled; corpus has populated unique projection rows. |
| M083 | `tools/kb/provenance.mjs:218:9` | LogicalOperator "(kept === '' \\|\\| dropped === '') && notes.has(document)" | Survived | open — projection guard now requires duplication and empty text; no applicable family targets either defect. |
| M084 | `tools/kb/provenance.mjs:218:9` | LogicalOperator "kept === '' && dropped === ''" | Survived | open — projection guard requires both texts empty; no applicable family supplies an empty kept/dropped field. |
| M085 | `tools/kb/provenance.mjs:218:18` | StringLiteral "\"Stryker was here!\"" | Survived | open — kept-field sentinel replaces empty test; affected projection input absent from applicable corpus. |
| M086 | `tools/kb/provenance.mjs:218:24` | ConditionalExpression "false" | Survived | open — empty dropped-field guard removed; no applicable family exercises it. |
| M087 | `tools/kb/provenance.mjs:218:36` | StringLiteral "\"Stryker was here!\"" | Survived | open — dropped-field sentinel replaces empty test; no applicable family exercises either value. |
| M088 | `tools/kb/provenance.mjs:218:63` | BlockStatement "{}" | NoCoverage | open — projection-row refusal erased; malformed notes are outside the family-specific contract. |
| M089 | `tools/kb/provenance.mjs:219:14` | StringLiteral "\"\"" | NoCoverage | open — projection-row refusal reason not recorded by an applicable family. |
| M090 | `tools/kb/provenance.mjs:219:32` | StringLiteral "``" | NoCoverage | open — projection-row diagnostic detail is not required. |
| M091 | `tools/kb/provenance.mjs:219:43` | ArithmeticOperator "index - 1" | NoCoverage | open — projection-row diagnostic numbering is not required. |
| M092 | `tools/kb/provenance.mjs:231:29` | StringLiteral "\"\"" | Survived | open — approved release label removed; adapter synthesizes unreviewed labels, not corpus review labels. |
| M093 | `tools/kb/provenance.mjs:231:41` | StringLiteral "\"\"" | Survived | open — rejected release label removed; release labels are bag-only adapter plumbing. |
| M094 | `tools/kb/provenance.mjs:231:53` | StringLiteral "\"\"" | Survived | open — contested release label removed; no family supplies that bag-only label. |
| M095 | `tools/kb/provenance.mjs:231:66` | StringLiteral "\"\"" | Survived | open — stale release label removed; no family supplies that bag-only label. |
| M096 | `tools/kb/provenance.mjs:233:9` | ConditionalExpression "false" | Survived | open — non-label manifest rows parsed; adapter emits label rows alone. |
| M097 | `tools/kb/provenance.mjs:233:26` | StringLiteral "\"\"" | Survived | open — every manifest row passes prefix guard; non-label release metadata is outside the adapted corpus. |
| M098 | `tools/kb/provenance.mjs:235:9` | ConditionalExpression "false" | Survived | open — release-label row-length guard removed; adapter supplies three fields. |
| M099 | `tools/kb/provenance.mjs:235:37` | StringLiteral "\"\"" | NoCoverage | open — malformed release-label reason is outside the applicable corpus. |
| M100 | `tools/kb/provenance.mjs:235:50` | StringLiteral "``" | NoCoverage | open — release-label diagnostic detail is outside the required verdicts. |
| M101 | `tools/kb/provenance.mjs:235:61` | ArithmeticOperator "index - 1" | NoCoverage | open — release-label diagnostic row numbering is outside the contract. |
| M102 | `tools/kb/provenance.mjs:236:45` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — fields.length is three before indexing, so fields[1] cannot be undefined. |
| M103 | `tools/kb/provenance.mjs:236:49` | StringLiteral "``" | Survived | open — release-label identifier diagnostic context is not a family verdict. |
| M104 | `tools/kb/provenance.mjs:236:60` | ArithmeticOperator "index - 1" | Survived | open — release-label diagnostic numbering is not required. |
| M105 | `tools/kb/provenance.mjs:237:35` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — three-field length guard makes fields[2] fallback unreachable. |
| M106 | `tools/kb/provenance.mjs:238:9` | ConditionalExpression "false" | Survived | open — release-label validity/duplication guard removed; labels are synthesized bag plumbing. |
| M107 | `tools/kb/provenance.mjs:238:9` | LogicalOperator "!accepted.has(rawLabel) && labels.has(document)" | Survived | open — invalid or duplicate labels individually admitted; corpus verdicts never target release labels. |
| M108 | `tools/kb/provenance.mjs:238:65` | StringLiteral "\"\"" | NoCoverage | open — release-label refusal reason is outside the applicable family contract. |
| M109 | `tools/kb/provenance.mjs:238:78` | StringLiteral "``" | NoCoverage | open — release-label diagnostic detail is outside the contract. |
| M110 | `tools/kb/provenance.mjs:238:89` | ArithmeticOperator "index - 1" | NoCoverage | open — release-label diagnostic numbering is outside the contract. |
| M111 | `tools/kb/provenance.mjs:253:19` | MethodExpression "text.startsWith('\\n')" | Survived | open — terminal LF retained on normal extraction; blank-line filtering and locator payload selection preserve corpus joins, no terminal-blank output claim is made. |
| M113 | `tools/kb/provenance.mjs:253:41` | MethodExpression "text" | Survived | equivalent — keeping a terminal LF adds a final blank ignored by ordinal filtering and locator scanning. |
| M114 | `tools/kb/provenance.mjs:256:7` | ConditionalExpression "false" | Survived | open — extraction header separator guard removed; no applicable family lacks the separator. |
| M115 | `tools/kb/provenance.mjs:256:7` | EqualityOperator "firstBlank <= 0" | Survived | open — separator at first line newly refused; no applicable family starts with an empty header. |
| M116 | `tools/kb/provenance.mjs:256:30` | StringLiteral "\"\"" | NoCoverage | open — extraction-header reason is not recorded by an applicable family. |
| M117 | `tools/kb/provenance.mjs:257:23` | Regex "/(?:identify\\|identifies) (?:the )?([1-9][^0-9]*) payloads be" | Survived | open — multi-digit census grammar changes; applicable fixtures use single-digit census counts. |
| M118 | `tools/kb/provenance.mjs:257:23` | Regex "/(?:identify\\|identifies) (?:the )([1-9][0-9]*) payloads belo" | Survived | open — optional `the` becomes mandatory; applicable headers contain `the`. |
| M119 | `tools/kb/provenance.mjs:258:5` | MethodExpression "lines" | Survived | open — census scan includes payloads; no applicable payload contains a competing census sentence. |
| M120 | `tools/kb/provenance.mjs:258:37` | StringLiteral "\"\"" | Survived | open — header lines concatenated without LF; applicable census phrases lie on one line. |
| M121 | `tools/kb/provenance.mjs:262:18` | Regex "/\\[([^\\]\\| ]+) \\\\| (p[1-9][0-9]*) \\\\| ([^\\]]+)\\]$/u" | Survived | open — locator with leading scaffolding accepted; no applicable family contains a prefixed locator line. |
| M122 | `tools/kb/provenance.mjs:262:18` | Regex "/^\\[([^\\]\\| ]+) \\\\| (p[1-9][^0-9]*) \\\\| ([^\\]]+)\\]$/u" | Survived | open — multi-digit locator pages stop matching; applicable corpus uses single-digit pages. |
| M123 | `tools/kb/provenance.mjs:262:18` | Regex "/^\\[([^\\]\\| ]+) \\\\| (p[1-9][0-9]*) \\\\| ([^\\]]+)\\]/u" | Survived | open — locator suffix accepted; no applicable family contains a suffixed locator line. |
| M124 | `tools/kb/provenance.mjs:263:20` | ArithmeticOperator "firstBlank - 1" | Survived | open — locator scan includes two header lines; applicable headers contain no locator-shaped line. |
| M125 | `tools/kb/provenance.mjs:263:36` | EqualityOperator "index <= lines.length" | Survived | equivalent — one extra iteration reads undefined as empty string; empty string cannot match the locator regex. |
| M126 | `tools/kb/provenance.mjs:264:47` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — loop bound ensures lines[index] exists in this unmutated implementation. |
| M127 | `tools/kb/provenance.mjs:266:46` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — locator regex has a nonempty first capture; fallback region is unreachable. |
| M128 | `tools/kb/provenance.mjs:266:50` | StringLiteral "``" | Survived | open — locator region diagnostic context changes, not a family reason. |
| M129 | `tools/kb/provenance.mjs:266:61` | ArithmeticOperator "index - 1" | Survived | open — locator diagnostic numbering is outside the contract. |
| M130 | `tools/kb/provenance.mjs:268:9` | ConditionalExpression "false" | Survived | open — missing payload guard removed; empty-payload family has an empty string, not undefined. |
| M131 | `tools/kb/provenance.mjs:269:36` | StringLiteral "``" | Survived | open — extraction-locator diagnostic detail changes; recorded refusal reason stays intact. |
| M132 | `tools/kb/provenance.mjs:269:47` | ArithmeticOperator "index - 1" | Survived | open — locator diagnostic row number changes; recorded refusal reason stays intact. |
| M133 | `tools/kb/provenance.mjs:275:9` | ConditionalExpression "false" | Survived | open — locator census guard removed; applicable mismatch family exercises ordinal coverage count instead. |
| M134 | `tools/kb/provenance.mjs:275:9` | ConditionalExpression "true" | Survived | open — missing-census handling changes; applicable locator headers contain a census. |
| M135 | `tools/kb/provenance.mjs:275:9` | EqualityOperator "censusMatch === null" | Survived | open — census guard inverted; applicable locator counts agree and remain joined, absent/mismatched census is not a family target. |
| M136 | `tools/kb/provenance.mjs:275:75` | BlockStatement "{}" | NoCoverage | open — locator census refusal erased; no applicable family has a mismatched declared locator count. |
| M137 | `tools/kb/provenance.mjs:276:14` | StringLiteral "\"\"" | NoCoverage | open — extraction-census reason is not the recorded ordinal-census refusal. |
| M138 | `tools/kb/provenance.mjs:276:35` | StringLiteral "``" | NoCoverage | open — locator census diagnostic detail is outside the required family verdicts. |
| M139 | `tools/kb/provenance.mjs:278:58` | ArrayDeclaration "[\"Stryker was here\"]" | Survived | equivalent — unused ordinal array gains a sentinel only when locators exist; passageFor ignores ordered in that branch and parseExtraction is private. |
| M140 | `tools/kb/provenance.mjs:280:19` | MethodExpression "lines.slice(firstBlank + 1)" | Survived | open — ordinal blank-line filtering erased; applicable ordinal payload block contains no blank interior line. |
| M141 | `tools/kb/provenance.mjs:282:23` | ConditionalExpression "true" | Survived | open — ordinal blank-line filtering disabled; applicable ordinal payload block has no blank line. |
| M142 | `tools/kb/provenance.mjs:282:32` | StringLiteral "\"Stryker was here!\"" | Survived | open — ordinal filter removes sentinel instead of blanks; neither affected line occurs in applicable ordinal families. |
| M143 | `tools/kb/provenance.mjs:283:33` | Regex "/[1-9][0-9]*\\. /u" | Survived | open — ordinal prefix pattern can match inside payload; applicable payloads have their numbering at the start. |
| M144 | `tools/kb/provenance.mjs:283:33` | Regex "/^[1-9][^0-9]*\\. /u" | Survived | open — multi-digit ordinal prefix grammar changes; applicable corpus has only single-digit ordinal numbers. |
| M145 | `tools/kb/provenance.mjs:284:7` | ConditionalExpression "false" | Survived | open — declared ordinal census validation removed; corpus mismatch family instead reaches same-file coverage census. |
| M146 | `tools/kb/provenance.mjs:284:7` | ConditionalExpression "false" | Survived | open — ordinal census subguard removed; corpus has a matching extraction declaration. |
| M147 | `tools/kb/provenance.mjs:284:7` | LogicalOperator "censusMatch === null && Number(censusMatch[1]) !== ordered.l" | Survived | open — null census dereference possible outside corpus; applicable ordinal families all declare counts. |
| M148 | `tools/kb/provenance.mjs:284:31` | ConditionalExpression "false" | Survived | open — declared count mismatch admitted; applicable mismatch concerns coverage rows, not extraction header declaration. |
| M149 | `tools/kb/provenance.mjs:284:74` | BlockStatement "{}" | NoCoverage | open — extraction-census refusal erased; applicable ordinal mismatch still refuses ordinal-census downstream. |
| M150 | `tools/kb/provenance.mjs:285:12` | StringLiteral "\"\"" | NoCoverage | open — extraction-census reason is not recorded by an applicable family. |
| M151 | `tools/kb/provenance.mjs:285:33` | StringLiteral "``" | NoCoverage | open — ordinal extraction-census diagnostic detail not required. |
| M152 | `tools/kb/provenance.mjs:285:54` | LogicalOperator "censusMatch?.[1] && 'none'" | NoCoverage | open — absent-census diagnostic value changes; no required family targets this detail. |
| M153 | `tools/kb/provenance.mjs:285:54` | OptionalChaining "censusMatch[1]" | NoCoverage | open — absent-census diagnostic can throw; applicable families provide a census and do not reach this refusal. |
| M154 | `tools/kb/provenance.mjs:285:74` | StringLiteral "\"\"" | NoCoverage | open — missing-census diagnostic sentinel changes; diagnostic prose outside contract. |
| M155 | `tools/kb/provenance.mjs:303:30` | StringLiteral "``" | Survived | open — ordinal-census diagnostic detail erased; the recorded reason remains correct. |
| M156 | `tools/kb/provenance.mjs:306:7` | ConditionalExpression "false" | Survived | equivalent — sameFileRows is built from coverage.rows and contains the identical row object passed here. |
| M157 | `tools/kb/provenance.mjs:306:27` | StringLiteral "\"\"" | NoCoverage | equivalent — negative ordinal branch is unreachable from deriveProvenance's same-object grouping. |
| M158 | `tools/kb/provenance.mjs:307:48` | StringLiteral "\"\"" | NoCoverage | equivalent — ordinal is in bounds after equal-length census and same-object index lookup. |
| M159 | `tools/kb/provenance.mjs:524:7` | ConditionalExpression "false" | Survived | open — empty alignment accepted; corpus red alignment families have nonempty rows. |
| M160 | `tools/kb/provenance.mjs:524:33` | StringLiteral "\"\"" | NoCoverage | open — alignment-empty reason not recorded by an applicable family. |
| M162 | `tools/kb/provenance.mjs:531:9` | ConditionalExpression "false" | Survived | open — alignment field-count guard removed; applicable red families exercise valid-width rows. |
| M163 | `tools/kb/provenance.mjs:531:37` | StringLiteral "\"\"" | NoCoverage | open — alignment-row reason is not recorded by any applicable family. |
| M164 | `tools/kb/provenance.mjs:531:54` | StringLiteral "``" | NoCoverage | open — alignment field-count diagnostic detail is outside required verdicts. |
| M165 | `tools/kb/provenance.mjs:531:65` | ArithmeticOperator "index - 1" | NoCoverage | open — alignment field-count diagnostic numbering is outside required verdicts. |
| M166 | `tools/kb/provenance.mjs:532:23` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field length guard makes rawGroup fallback unreachable. |
| M167 | `tools/kb/provenance.mjs:532:37` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field length guard makes rawSide fallback unreachable. |
| M168 | `tools/kb/provenance.mjs:532:52` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field length guard makes rawStart fallback unreachable. |
| M169 | `tools/kb/provenance.mjs:532:66` | StringLiteral "\"Stryker was here!\"" | NoCoverage | equivalent — four-field length guard makes surface fallback unreachable. |
| M170 | `tools/kb/provenance.mjs:533:9` | ConditionalExpression "false" | Survived | open — alignment lexical guard removed; corpus red cases target span mismatch, overlap and one-sided groups. |
| M171 | `tools/kb/provenance.mjs:533:9` | ConditionalExpression "false" | Survived | open — numeric alignment subguard removed; applicable rows use valid decimal group/start fields. |
| M172 | `tools/kb/provenance.mjs:533:9` | LogicalOperator "!DECIMAL.test(rawGroup) && !DECIMAL.test(rawStart)" | Survived | open — both numeric fields must now be invalid before refusal; no applicable family exercises numeric grammar. |
| M173 | `tools/kb/provenance.mjs:533:9` | LogicalOperator "(!DECIMAL.test(rawGroup) \\|\\| !DECIMAL.test(rawStart)) && surf" | Survived | open — malformed numeric fields require empty surface for refusal; applicable alignment cases have valid fields. |
| M174 | `tools/kb/provenance.mjs:533:63` | ConditionalExpression "false" | Survived | open — empty alignment surface admitted; no applicable alignment family contains one. |
| M175 | `tools/kb/provenance.mjs:533:75` | StringLiteral "\"Stryker was here!\"" | Survived | open — empty surface test replaced by sentinel test; neither surface is present in applicable alignment rows. |
| M176 | `tools/kb/provenance.mjs:533:79` | BlockStatement "{}" | NoCoverage | open — alignment-row refusal erased; no applicable family records this reason. |
| M177 | `tools/kb/provenance.mjs:534:14` | StringLiteral "\"\"" | NoCoverage | open — alignment-row reason changed outside the applicable family verdicts. |
| M178 | `tools/kb/provenance.mjs:534:31` | StringLiteral "``" | NoCoverage | open — alignment-row diagnostic detail is outside the contract. |
| M179 | `tools/kb/provenance.mjs:534:42` | ArithmeticOperator "index - 1" | NoCoverage | open — alignment-row diagnostic numbering is outside the contract. |
| M180 | `tools/kb/provenance.mjs:536:49` | ConditionalExpression "true" | Survived | open — unknown alignment side treated as ace; applicable families use src or ace only. |
| M181 | `tools/kb/provenance.mjs:537:9` | ConditionalExpression "false" | Survived | open — unknown-side guard removed; applicable corpus contains no unknown alignment side. |
| M182 | `tools/kb/provenance.mjs:537:31` | StringLiteral "\"\"" | NoCoverage | open — alignment-side refusal reason not recorded by an applicable family. |
| M183 | `tools/kb/provenance.mjs:537:49` | StringLiteral "``" | NoCoverage | open — alignment-side diagnostic detail not required by the contract. |
| M184 | `tools/kb/provenance.mjs:537:60` | ArithmeticOperator "index - 1" | NoCoverage | open — alignment-side diagnostic numbering not required by the contract. |
| M185 | `tools/kb/provenance.mjs:543:32` | StringLiteral "``" | Survived | open — alignment-span diagnostic detail changes, not its recorded refusal reason. |
| M186 | `tools/kb/provenance.mjs:543:43` | ArithmeticOperator "index - 1" | Survived | open — alignment-span diagnostic numbering changes, not its recorded refusal reason. |
| M187 | `tools/kb/provenance.mjs:548:21` | MethodExpression "[...groups.ace]" | Survived | open — ACE group insertion order replaces numeric sort; applicable family group orders coincide across sides. |
| M188 | `tools/kb/provenance.mjs:548:42` | ArrowFunction "() => undefined" | Survived | open — ACE group sort comparator disabled; applicable family group orders coincide across sides. |
| M189 | `tools/kb/provenance.mjs:548:59` | ArithmeticOperator "left + right" | Survived | open — ACE group comparator sums instead of orders; no applicable family needs insertion-order normalization. |
| M190 | `tools/kb/provenance.mjs:549:24` | MethodExpression "[...groups.source]" | Survived | open — source group insertion order replaces numeric sort; applicable group orders already coincide. |
| M191 | `tools/kb/provenance.mjs:549:48` | ArrowFunction "() => undefined" | Survived | open — source group comparator disabled; no applicable family has unequal group encounter orders. |
| M192 | `tools/kb/provenance.mjs:549:65` | ArithmeticOperator "left + right" | Survived | open — source group comparator sums instead of orders; relevant differing encounter orders absent from corpus. |
| M193 | `tools/kb/provenance.mjs:551:45` | StringLiteral "\"\"" | Survived | open — source overlap pass skipped; applicable overlap family overlaps ACE spans, not source spans. |
| M194 | `tools/kb/provenance.mjs:552:21` | MethodExpression "spans.filter(span => span.side === side)" | Survived | open — overlap spans left in file order; applicable overlap family is already in start order. |
| M195 | `tools/kb/provenance.mjs:553:25` | EqualityOperator "span.side !== side" | Survived | equivalent — complementing the side filter swaps the source and ace passes; both still run, with identical refusal reason and path. |
| M196 | `tools/kb/provenance.mjs:554:13` | ArrowFunction "() => undefined" | Survived | open — overlap sort disabled; corpus overlap rows already arrive in start order. |
| M197 | `tools/kb/provenance.mjs:554:30` | ArithmeticOperator "left.start + right.start" | Survived | open — sum comparator need not order starts; applicable overlap rows already ordered and still refused. |
| M198 | `tools/kb/provenance.mjs:554:30` | ConditionalExpression "false" | Survived | open — comparator returns false; unsorted-span behavior is not exercised by applicable families. |
| M199 | `tools/kb/provenance.mjs:554:30` | ConditionalExpression "true" | Survived | open — comparator returns true; applicable rows retain verdicts without testing unordered nonoverlapping spans. |
| M200 | `tools/kb/provenance.mjs:554:30` | LogicalOperator "left.start - right.start && left.end - right.end" | Survived | open — comparator combines differences with AND; no applicable family distinguishes its ordering. |
| M201 | `tools/kb/provenance.mjs:554:58` | ArithmeticOperator "left.end + right.end" | NoCoverage | equivalent — changed tie-break runs only for equal starts; nonempty same-start spans overlap regardless of end order, and sorted array is not returned. |
| M202 | `tools/kb/provenance.mjs:556:11` | EqualityOperator "(ordered[index]?.start ?? 0) <= (ordered[index - 1]?.end ?? " | Survived | open — touching spans become overlaps; applicable green alignments have no adjacent spans on one side. |
| M203 | `tools/kb/provenance.mjs:556:12` | OptionalChaining "ordered[index].start" | Survived | equivalent — dense array and index from 1 to length-1 guarantee current entry exists. |
| M204 | `tools/kb/provenance.mjs:556:43` | OptionalChaining "ordered[index - 1].end" | Survived | equivalent — dense array and index at least 1 guarantee previous entry exists. |
| M209 | `tools/kb/provenance.mjs:622:48` | StringLiteral "\"\"" | NoCoverage | open — projection-missing reason outside applicable corpus; all fixture projection notes exist. |
| M210 | `tools/kb/provenance.mjs:623:50` | StringLiteral "\"\"" | NoCoverage | open — label-missing reason concerns synthesized bag-only labels, not a corpus family. |
| M211 | `tools/kb/provenance.mjs:624:9` | ConditionalExpression "false" | Survived | open — projection-region join guard removed; no applicable family mismatches projection region and coverage. |
| M212 | `tools/kb/provenance.mjs:624:52` | StringLiteral "\"\"" | NoCoverage | open — projection-region refusal reason not recorded by an applicable family. |
| M213 | `tools/kb/provenance.mjs:625:68` | StringLiteral "\"\"" | NoCoverage | equivalent — coverageByFile and extractions are built from exactly the same coverage row file keys before document traversal. |
| M214 | `tools/kb/provenance.mjs:628:47` | ArrayDeclaration "[\"Stryker was here\"]" | NoCoverage | equivalent — each coverage document's file has a bucket in coverageByFile, so fallback array is unreachable. |
| M217 | `tools/kb/provenance.mjs:634:11` | ConditionalExpression "false" | Survived | open — empty ACE sentence accepted; no applicable family contains an interior empty ACE sentence. |
| M218 | `tools/kb/provenance.mjs:634:20` | StringLiteral "\"Stryker was here!\"" | Survived | open — sentinel ACE sentence refused instead of empty sentence; neither occurs in applicable families. |
| M219 | `tools/kb/provenance.mjs:634:31` | StringLiteral "\"\"" | NoCoverage | open — ace-empty-sentence reason not recorded by an applicable family. |
| M220 | `tools/kb/provenance.mjs:634:53` | StringLiteral "``" | NoCoverage | open — empty ACE sentence diagnostic detail outside required verdicts. |
| M221 | `tools/kb/provenance.mjs:634:67` | ArithmeticOperator "index - 1" | NoCoverage | open — empty ACE sentence diagnostic numbering outside required verdicts. |
| M224 | `tools/kb/provenance.mjs:639:5` | AssignmentOperator "alignmentSpans -= spans.length" | Survived | open — alignment summary count negated; contract does not specify aggregate build statistics. |
| M225 | `tools/kb/provenance.mjs:640:71` | StringLiteral "\"\"" | NoCoverage | open — clauses-missing refusal reason is not a recorded corpus verdict; adapter adds a document fact where needed. |
| M231 | `tools/kb/provenance.mjs:653:26` | StringLiteral "\"\"" | Survived | open — coordinate-unit metadata emptied; corpus join verdict does not prescribe the bag-only JSON metadata spelling. |
| M234 | `tools/kb/provenance.mjs:660:40` | BlockStatement "{}" | Survived | open — projection-orphan refusal erased; no applicable corpus family contains orphan projection notes. |
| M235 | `tools/kb/provenance.mjs:661:9` | ConditionalExpression "false" | Survived | open — projection-orphan membership guard disabled; no applicable family exercises it. |
| M236 | `tools/kb/provenance.mjs:661:51` | StringLiteral "\"\"" | NoCoverage | open — projection-orphan reason not recorded by an applicable family. |
| M237 | `tools/kb/provenance.mjs:663:41` | BlockStatement "{}" | Survived | open — label-orphan refusal erased; release labels are adapter plumbing and are synthesized only for coverage docs. |
| M238 | `tools/kb/provenance.mjs:664:9` | ConditionalExpression "false" | Survived | open — label-orphan membership guard disabled; no applicable family supplies an orphan label. |
| M239 | `tools/kb/provenance.mjs:664:51` | StringLiteral "\"\"" | NoCoverage | open — label-orphan refusal reason is outside applicable family verdicts. |
| M240 | `tools/kb/provenance.mjs:666:52` | BlockStatement "{}" | Survived | open — clause-orphan refusal erased; orphan-pl family is refused earlier by requireRepresentations. |
| M241 | `tools/kb/provenance.mjs:667:9` | ConditionalExpression "false" | Survived | open — clause-orphan guard disabled; applicable orphan files fail file-orphan before clause processing. |
| M242 | `tools/kb/provenance.mjs:667:51` | StringLiteral "\"\"" | NoCoverage | open — clause-orphan refusal reason not recorded by an applicable family. |
| M243 | `tools/kb/provenance.mjs:670:22` | ObjectLiteral "{}" | Survived | open — generated clause-index model erased; corpus contract requires family joins, not a generated bag-only index schema. |
| M244 | `tools/kb/provenance.mjs:672:27` | ArrowFunction "() => undefined" | Survived | open — generated document-index entries undefined; family joins remain present in chunks, index metadata is not specified. |
| M245 | `tools/kb/provenance.mjs:672:52` | ObjectLiteral "{}" | Survived | open — generated document-index entries empty; corpus does not prescribe generated index records. |
| M246 | `tools/kb/provenance.mjs:674:12` | ObjectLiteral "{}" | Survived | open — generated index statistics erased; aggregate build statistics are outside the corpus contract. |
| M247 | `tools/kb/provenance.mjs:677:9` | ConditionalExpression "false" | Survived | open — PDF root prefix guard removed; PDF files are bag-only stand-ins and no family targets candidate selection. |
| M248 | `tools/kb/provenance.mjs:677:26` | StringLiteral "``" | Survived | open — PDF root prefix test always passes; corpus supplies only one synthesized PDF per root. |
| M249 | `tools/kb/provenance.mjs:680:7` | ConditionalExpression "false" | Survived | open — PDF-count validation removed; PDF stand-in is bag plumbing outside corpus semantics. |
| M250 | `tools/kb/provenance.mjs:680:42` | StringLiteral "\"\"" | NoCoverage | open — pdf-count reason not recorded by an applicable family. |
| M251 | `tools/kb/provenance.mjs:680:55` | StringLiteral "``" | NoCoverage | open — PDF-count diagnostic detail outside corpus family verdicts. |
| M252 | `tools/kb/provenance.mjs:683:7` | ConditionalExpression "false" | Survived | open — PDF-signature guard disabled; corpus PDF is synthesized and no family targets it. |
| M253 | `tools/kb/provenance.mjs:683:73` | StringLiteral "\"\"" | Survived | equivalent — `%PDF-` is ASCII, so ASCII and default UTF-8 encode exactly the same bytes. |
| M254 | `tools/kb/provenance.mjs:683:84` | BlockStatement "{}" | NoCoverage | open — PDF-signature refusal erased; PDF validation outside family-specific contract. |
| M255 | `tools/kb/provenance.mjs:684:12` | StringLiteral "\"\"" | NoCoverage | open — pdf-signature refusal reason not recorded by an applicable family. |
| M257 | `tools/kb/provenance.mjs:689:12` | ObjectLiteral "{}" | Survived | open — returned generated-index wrapper erased; family join contract does not prescribe a bag index wrapper. |
| M258 | `tools/kb/provenance.mjs:691:10` | ObjectLiteral "{}" | Survived | open — returned PDF wrapper erased; PDF stand-in is explicitly adapter plumbing, not a fixture target. |
