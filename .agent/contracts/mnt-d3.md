# mnt-d3 — Japanese register grader (approved by the user as drafted)

Row: `.agent/deferred.md` `Japanese copy has no register grader`. The row names the three rule
kinds; the numbers, the term table and the copy edits below are MAIN's, approved by the user as
drafted. J4 (no `：`) grades the punctuation clause the same `i18n.md` bullet states. Tier: `docs`.

## Unit of measure

- Sentence = a run of a `ja.ts` entry's text up to and including `。`, `！` or `？`; an entry's
  trailing run with no terminator is a label, not a sentence.
- Length unit = one character, except each ASCII word run (`Atkinson Hyperlegible Next`,
  `Prolog`, `CDC`) = 1 and each `${…}` interpolation = 1. An English name reads as one term.

## Rules (`copy:check`, Japanese grader beside parity)

| id | rule | base `9b793fd` | firing input (real catalog, in process) |
|---|---|---|---|
| J1 | `INSTRUCTIONS` sentence ≤ 40 units; `DESCRIPTIONS`, `LABELS`, `TEXT` ≤ 60 | pass — max 36 / 53 / 20 / 51 | limit 0 → every sentence refused by key |
| J2 | every key whose English source matches a term row carries that row's Japanese term (table below) | **3 fail** — copy edits below | `知識ベース` → `ナレッジベース` in the ja text → refused by key + term |
| J3 | a sentence ending in hiragana ends in a です・ます form (`ます ません ました ませんでした です でした でしょう ましょう ください`), a trailing `（…）` stripped first; answer words `はい`/`いいえ` exempt | pass — 0 of 162 terminated sentences | first `します。` → `する。` → refused by key |

- J1 numbers: `公用文作成の考え方` (文化審議会建議, 2022) Ⅲ-3 ア sets 50–60 字 as the point to
  re-check readability → 60; `INSTRUCTIONS` mirrors the English ≤ 20-word imperative at ≈ 2
  characters per word → 40.
- J3 leaves labels in dictionary form (`ページの先頭へ戻る`), the Japanese UI convention for
  buttons and headings: 16 unterminated labels end in plain form today, by design.

## J2 term table (`.claude/rules/i18n.md` fixed terminology)

| English pattern | Japanese term |
|---|---|
| `knowledge base` | 知識ベース |
| `compiled` | コンパイル済み |
| `controlled natural language` | 制御自然言語 |
| `proof` | 証明 |
| `citation` | 出典 |
| `clause` | 節 |
| `concept` | 概念 |
| `relationship` | 関係 |

## Copy edits J2 forces (visible text change → needs approval)

| key | today | proposed |
|---|---|---|
| `DESCRIPTIONS.lede` | `CDCガイドラインをコンパイルした版に対して、…` | `コンパイル済みのCDCガイドラインに対して、…` |
| `DESCRIPTIONS.answerAssembly` | `番号付きの引用が、描画された各記述と出典との対応を保ちます。` | `番号付きの出典が、描画された各記述と原文との関係を保ちます。` |
| `TEXT.traceIdle` | `引用を選択すると、回答のその部分を追跡します。` | `出典を選択すると、回答のその部分を追跡します。` |

The alternative to an edit is a per-key exemption in the grader, named with its reason.

## Acceptance

`pnpm copy:check` runs J1–J3 over `src/i18n/ja.ts` and exits 0; each rule's firing input is
refused by key in the same run, and its success line names the three controls;
`.claude/rules/gate.md` `Firing inputs` gains the J-rows; `.claude/rules/i18n.md` `Gate` states the
rules and numbers.
