// Japanese interface text. Key-for-key with `en.ts`, enforced by `Messages`.
//
// Register is です・ます throughout — the demo addresses a reader, not a log. The
// terminology is fixed and reused rather than varied: 知識ベース, コンパイル済み,
// 制御自然言語, 証明, 出典 (a citation), 原文 (the guideline's own prose), 節 (a
// clause), 概念/動作/属性 (the three graph node kinds), 関係 (an edge).
//
// `TEXT` entries carry Japanese word order end to end. Japanese puts counters and
// postpositions where English puts none, so an entry returns its whole sentence and
// never a half that some caller joins to an English half. There is no plural helper
// here because Japanese has no plural agreement; each entry writes its own counter
// (件, 個, 行) directly.
//
// Untranslated on purpose: question strings, ACE renderings, canonical Prolog
// values, document ids, review labels and engine error messages. Those are payload.
// `LABELS.languageSwitch` is ASCII in both locales so the English page never pulls
// the Japanese face to render three characters.

import type { Messages } from './en.js';

export const INSTRUCTIONS = {
  selectQuestion: '用意された臨床質問を選択してください。',
  runQuestion: '「実行」を選択すると、知識ベースから決定的な回答が得られます。',
  notClinical: 'このデモを臨床判断に使用しないでください。',
  readLicence: '以下の4つの書体のフォントライセンスをお読みください。',
  graphSearchHelp:
    '結果を選択するとマップが移動します。「経路」を選択すると最短の意味的なつながりを表示します。',
  graphExpandHint:
    '表示は読みやすさのために制限されています。「展開」を選択すると範囲が広がります。',
  graphCompareRun: '上にある用意された質問を実行すると、グラフと実行時の証明を比較できます。',
  chatAsk: 'オピオイドの処方や疼痛ケアについて、ご自身の言葉で質問してください。',
  chatPrivacy: '氏名、日付など、患者を特定できる情報は入力しないでください。',
  chatOrPick: 'または、下にある用意された質問を選択してください。',
} as const;

export const DESCRIPTIONS = {
  wordmark: '臨床知識コンパイラ',

  documentTitle: '制御自然言語 — 臨床知識コンパイラ (CNL CKC) デモ',

  documentDescription:
    'コンパイル済みのCDC臨床ガイドラインについて、Prologによる実行時の回答、出典の来歴、意味的な関係を探索できます。',

  heroEyebrow: '制御自然言語 · Prolog · WebAssembly',

  lede:
    'コンパイル済みのCDCガイドラインに対して、用意された質問を実行します。' +
    'ブラウザは実行のたびに、ガイドラインと質問が与える臨床的文脈から各回答を証明します。' +
    'すべての回答はその出典まで追跡できます。',

  prototypeNote: '研究用の試作です。臨床上の指針ではありません。',

  aboutSummary: 'このデモについて',
  prologSummary: '正規形のProlog回答',
  licenceSummary: '書体',

  purpose: 'これは知識コンパイラの実演です。臨床ツールではなく、医学的な助言も行いません。',

  fixedCatalog:
    '質問一覧は固定です。各項目は検証済みの知識ベース書き出しから出典に対応した制御節を選び、Prologのクエリとして実行します。',

  projection:
    '原典のガイドラインは制御自然言語とPrologに射影されています。結果は選択されたすべての制御節を、内容に依存しない固定の規則で描画します。',

  clauseRendering:
    'エンジンは構造化された制御自然言語の節を返しました。固定の描画規則が、その条件、法性、否定、動作、限定を保持します。',

  answerAssembly:
    '証明されたすべての推奨事項を1つの回答にまとめます。番号付きの出典が、描画された各記述と原文との関係を保ちます。',

  sourcePassage: 'これはガイドライン自体の原文です。同じProlog結果がそのまま保持しています。',
  sourceUnavailable:
    'この結果には構造化された原文の一節がありません。正規形のProlog値は下で参照できます。',

  workingAnswer: 'コンパイル済みガイドラインに対して回答を証明しています…',

  proofStepOrigin:
    'エンジンは、範囲を限定した証明インタプリタでこの証明を改めて導出しました。' +
    '保存済みの結果ではありません。',
  proofPremiseOrigin:
    'ガイドラインの節はすべての臨床医に適用されます。以下の前提は、質問が述べる臨床的文脈を与えます。' +
    '知識ベースは前提を述べていないため、前提に出典の行はありません。',
  proofNegationOrigin:
    'エンジンは知識ベースでこの目標を探索し、何も導出しませんでした。' +
    '節はその不在を必要とするため、証明はそれを記録します。',

  reviewUnreviewed: 'このコンパイル済み文書について、人による裁定は記録されていません。',
  reviewRecorded: 'これは知識ベースの書き出しに記録されたレビューラベルです。',

  graphIntro:
    'コンパイル済み知識ベース全体でつながる臨床概念と動作を探索できます。' +
    'マップはオピオイド療法から始まります。' +
    '回答リンクは、その回答が引用する文に含まれる関係をハイライトします。',

  graphLoadNote:
    'グラフのデータとレイアウトエンジンは、この操作または回答リンクを選択したときに読み込まれます。',

  corpusIntro:
    'コンパイル済みのガイドライン文書を、その根拠が記録する対応領域ごとに一覧できます。' +
    '文書を開くと、原文の一節とガイドラインのページを確認できます。',

  corpusLoadNote: '文書の一覧は、この操作を選択したときに読み込まれます。',

  corpusPassage: 'これはガイドライン自体の原文で、この文書が記録しているとおりです。',

  graphDerivation:
    '主要概念は、質問と決定的な回答に含まれる語および意味役割から機械的に順位付けされます。',

  graphMutedBranches:
    '淡く表示された枝は、その概念が知識ベースの他の箇所とどうつながるかを示します。',

  unreviewed:
    'コンパイル済み文書はすべて unreviewed というラベルを持ちます。いずれについても人による裁定は行われていません。' +
    'この語彙にある他のラベルは approved、rejected、contested、stale です。',

  prolog:
    'Prologエンジンは以下の各値を正規構文で描画します。デモはそれらの値を書き出し用の回答形式に整えます。',

  chatDisclosure:
    'GPTモデルが、このコンピューター上のブリッジを通じて回答します。' +
    'モデルが書いたPrologのゴールは、このページのエンジンで読み取り専用として実行されます。',
  chatLegend:
    '回答の各部分には出典を示します。' +
    'KB: このページでPrologの問い合わせが実行されたことを示し、そのカードにゴールと解を表示します。' +
    'ウェブ: このターンの検索が返したページです。モデル: モデル自身の知識です。' +
    '未検証: モデルが主張した出典は、この会話の記録にありません。',
  chatLimit:
    'KBの表示は、引用された問い合わせが実行されたことを示します。' +
    '文の言い回しはモデルによるものなので、カードの解と見比べてください。',
  chatCardNote: 'これらの解は、Prologエンジンが標準構文で表示したものです。',
  attribution: '出典: CDC。米国疾病予防管理センターが原典資料を作成しました。',

  freeAvailability: '原典資料は同機関のウェブサイトで無償で入手できます。',

  nonendorsement:
    'この資料の使用は、米国疾病予防管理センターによる推奨を意味するものではありません。' +
    '保健福祉省による推奨を意味するものでもありません。' +
    '米国政府による推奨を意味するものでもありません。',

  fonts:
    'このデモは Atkinson Hyperlegible Next、Atkinson Hyperlegible Mono、Literata、BIZ UDPGothic で文字を組んでいます。' +
    '各書体は SIL Open Font License 1.1 で提供されています。',
} as const;

export const LABELS = {
  brandHome: 'CNL CKC デモのホーム',
  navAria: 'ページ',
  navQuery: 'クエリ',
  navGraph: 'グラフ',
  navNotes: 'ノート',
  sourceMaterial: '原典資料',
  backToTop: 'ページの先頭へ戻る',
  guidelineLabel: 'ガイドライン:',

  themeToLight: 'ライトテーマを使う',
  themeToDark: 'ダークテーマを使う',
  themeLight: 'ライト',
  themeDark: 'ダーク',

  languageSwitch: 'English',
  // WCAG 2.5.3: the accessible name must contain the visible label, so this reads
  // `English`, not `英語` — the label is ASCII in both locales by design.
  languageSwitchAria: 'このデモを English で表示する',

  queryEyebrow: 'クエリ',
  askHeading: 'コンパイル済みガイドラインに問い合わせる',
  questionLabel: '臨床質問',
  questionPrompt: '質問を選択してください',
  run: '実行',
  cancel: '中止',
  retry: '再試行',

  answerHeading: '回答',
  answerTurn: '決定的な回答',
  answerAuthor: '臨床知識コンパイラ',
  answerMode: '決定的な回答',
  explanationSummary: '出典と説明',
  technicalSummary: '技術的な詳細',
  sourcePicker: '調べる出典を選択',
  marksQualifier: '修飾語',
  marksGrade: 'グレード',
  marksPreferred: '優先',
  marksTime: '時期',
  marksGoals: 'これらの注記の根拠となるPrologゴール',
  selectedEvidence: '選択された根拠',

  evidenceEyebrow: '根拠',
  evidenceHeading: '証明から出典へ',
  findInGraph: 'グラフで表示',
  ladderSummary: '6つの根拠ステップを見る',
  liveProof: '実行時のProlog証明',
  proofAssumed: '仮定 (知識ベース外)',
  proofAbsent: '不成立を確認',
  evidenceLoading: '選択された文書の根拠を読み込んでいます。',
  evidenceRetry: '根拠を再取得',
  compiledClause: 'コンパイル済みの節',
  controlledSentence: '制御文',
  coverageRegion: '対応領域',
  region: '領域',
  section: 'セクション',
  physicalPage: '物理ページ',
  alignedPassage: '対応する原文の一節',
  projectionKept: '射影で保持:',
  projectionDropped: '射影で変更または省略:',
  guidelinePage: 'ガイドラインのページ',
  loadPageViewer: 'ページビューアを読み込む',
  openPageTab: 'ページを新しいタブで開く',
  compareWithProof: '現在の証明と比較する',

  graphEyebrow: 'グラフ',
  graphHeading: '意味知識グラフ',
  graphExplore: 'グラフを探索',
  graphShowAllRelations: 'すべての関係を表示',
  graphLoading: '意味グラフを読み込んでいます。',
  corpusEyebrow: '出典',
  corpusHeading: '文書ごとの対応領域',
  corpusBrowse: 'すべての文書を一覧',
  corpusLoading: '文書の一覧を読み込んでいます。',
  corpusFilter: '文書、領域、セクションで絞り込む',
  corpusOpen: '開く',
  corpusClose: '閉じる',
  corpusDocumentLoading: '文書の根拠を読み込んでいます。',
  graphTryAgain: '再試行',
  graphAnswerMap: '回答マップ',
  graphDerivationSummary: 'このマップの導出方法',
  graphSearchLabel: '概念または動作を検索',
  graphSearchPlaceholder: '臨床概念と動作を検索',
  graphRecenter: '再センタリング',
  graphFitAnswer: '回答マップに合わせる',
  graphExpand: '展開',
  graphSearchResults: 'グラフの検索結果',
  graphNoMatches: '一致するノードはありません。',
  graphPath: '経路',
  graphPrimaryConcept: '主要概念',
  graphLegendFocus: '主要な焦点',
  graphLegendConcept: '概念',
  graphLegendAction: '動作',
  graphLegendAttribute: '属性',
  graphLegendAnswer: '現在の回答',
  graphShortestPath: '最短経路',
  graphClear: 'クリア',
  graphAccessibleView: 'アクセシブルなグラフ表示',
  graphNoRelationships: 'このノードには関係がありません。',
  graphNodeIndex: 'この表示範囲にあるノード',
  graphNoPath: 'つながる経路は見つかりませんでした。',

  graphSelectedBefore: '',
  graphSelectedAfter: 'から選択しました。',

  chatLabel: 'あなたの質問',
  chatSend: '送信',
  chatStop: '停止',
  chatNew: '新しい会話',
  chatTranscript: '会話',
  chatYou: 'あなた',
  chatAssistant: 'アシスタント',
  chatTagKb: '知識ベース',
  chatTagWeb: 'ウェブ',
  chatTagModel: 'モデル',
  chatTagUnverified: '未検証',
  chatGoal: 'ゴール',
} as const;

export const TEXT = {
  answerYes: () => '回答: はい。',
  answerYesSummary: () => 'はい。質問が与える臨床的文脈のもとで、知識ベースがそれを証明します。',
  answerReady: () => '回答の準備ができました。',
  answerNo: () => '回答: いいえ。',
  answerNoSummary: () => 'いいえ。知識ベースは証明を見つけませんでした。',
  noProof: () => '証明は見つかりませんでした。',
  noProofSummary: () => '証明は見つかりませんでした。結果は空です。',
  noAnswerYet: () => 'まだ回答はありません。',

  limitStack: () => 'スタックの上限',
  limitDepth: () => '深さの上限',
  limitInference: () => '推論回数の上限',
  limitWallClock: () => '時間の上限',
  limitAnswerCap: () => '回答数の上限',
  limitHeap: () => 'メモリの上限',

  runStopped: (limitText: string, limitCode: string, partial: number) =>
    `実行は${limitText} (${limitCode}) で停止し、部分的な回答は${String(partial)}件です。`,
  runCancelled: (partial: number) => `中止しました。部分的な回答は${String(partial)}件です。`,
  runFailed: (code: string, message: string) => `実行に失敗しました (${code})。${message}`,
  runFailedSummary: () => '実行に失敗しました。',
  questionRejected: () => 'その質問はカタログにないため、実行されませんでした。',
  questionRejectedSummary: () => '質問は受け付けられませんでした。',

  engineStarting: () => 'Prologエンジンを起動しています。',
  engineFetching: (bytes?: number) =>
    bytes === undefined
      ? 'コンパイル済み知識ベースをダウンロードしています。'
      : `コンパイル済み知識ベース（${String(Math.round(bytes / 1000))} kB）をダウンロードしています。`,
  engineLoading: () => 'コンパイル済み知識ベースをPrologエンジンに読み込んでいます。',
  engineFallback: () =>
    '保存済みのエンジン状態を読み込めませんでした。代替エンジンを読み込んでいます。',
  engineVerifying: () => '読み込んだ知識ベースをビルドマニフェストと照合しています。',
  engineRestarting: () => 'Prologエンジンが時間内に起動しませんでした。もう一度起動しています。',
  engineFailed: (message: string) => `Prologエンジンが起動しませんでした。${message}`,
  engineFailedSummary: () => 'エンジンを利用できません。「再試行」を選択して起動し直してください。',
  engineReady: (documents: number, schemaVersion: string) =>
    `知識ベースの準備ができました: コンパイル済み文書${String(documents)}件、` +
    `スキーマ ${schemaVersion}。質問を選んで実行してください。`,
  engineDocuments: (documents: number) =>
    `エンジンはコンパイル済み文書を${String(documents)}件報告しています。`,
  runningQuestion: (question: string) => `実行中: ${question}`,
  cancellingRun: () => '実行を中止しています。',

  inspectSource: (index: number) => `この記述の出典${String(index)}を調べる`,
  inspectSourceDocument: (index: number, document: string | undefined) =>
    `出典${String(index)}を調べる${document === undefined ? '' : `、${document}`}`,
  sourceOrdinal: (index: number) => `出典${String(index)}`,
  sourceCount: (n: number) => `出典${String(n)}件`,
  marksMissing: (missing: number, total: number) =>
    `出典文書${String(total)}件のうち${String(missing)}件について、知識ベースは注記を返しませんでした。` +
    'これらの文書の記述には注記を表示していません。',

  traceIdle: () => '出典を選択すると、回答のその部分を追跡します。',
  traceLoading: () => '選択された出典の寄与を再証明しています。',
  traceFailure: () => '選択された出典の寄与を再証明できませんでした。',
  traceCancelled: () => '証明トレースを中止しました。',
  traceUnavailable: () => '証明の追跡は利用できません。',
  traceLimit: (limitCode: string) => `証明トレースは ${limitCode} の上限で停止しました。`,
  traceError: (code: string, message: string) => `証明トレースに失敗しました (${code})。${message}`,
  traceReady: (steps: number) =>
    `${String(steps)}件のガイドラインの節が、この実行で回答のこの部分を証明しました。`,

  proofStepCount: (n: number) => `証明ステップ${String(n)}件`,
  proofPremiseCount: (n: number) => `仮定した前提${String(n)}件`,
  proofNegationCount: (n: number) => `不成立を確認した目標${String(n)}件`,
  proofStepLine: (line: number) => `${String(line)}行目`,
  clauseJoin: (n: number) => `出典の行で対応付けられた正確な節が${String(n)}件あります。`,
  alignAce: (phrase: string) => `制御文の語句を対応表示: ${phrase}`,
  alignSource: (phrase: string) => `原文の語句を対応表示: ${phrase}`,
  reviewStatus: (label: string) => `レビュー状態: ${label}。`,
  passagePage: (page: number) => `この一節はPDFの物理ページ${String(page)}に対応します。`,
  pageViewerTitle: (page: number) => `CDCガイドライン、物理ページ${String(page)}`,
  pageRendering: () => 'ガイドラインのページを描画しています。',
  corpusCount: (documents: number) =>
    `コンパイル済み文書${String(documents)}件と、それぞれの対応領域です。`,
  corpusShown: (shown: number, total: number) =>
    `${String(total)}件中${String(shown)}件の文書を表示しています。`,
  corpusOpenDocument: (document: string) => `${document}を開く`,
  corpusCloseDocument: (document: string) => `${document}を閉じる`,
  corpusRegionPage: (region: string, page: number) => `領域 ${region}、物理ページ${String(page)}`,
  corpusFailed: (message: string) => `文書の一覧を読み込めませんでした。${message}`,
  corpusDocumentFailed: (message: string) => `文書の根拠を読み込めませんでした。${message}`,
  passageHighlighted: (page: number) => `この一節をページ${String(page)}で強調表示しています。`,
  passageContinues: (page: number) =>
    `この一節はページ${String(page)}で始まり、ページ${String(page + 1)}に続きます。` +
    'このページにある部分を強調表示しています。',
  passageNotFound: (page: number) =>
    `ページ${String(page)}でこの一節の本文が見つからないため、強調表示はありません。`,
  pageViewerFailed: (message: string) => `ページビューアがページを描画できませんでした。${message}`,

  graphCounts: (concepts: number, links: number) =>
    `概念・動作 ${concepts.toLocaleString()} 件 · 意味リンク ${links.toLocaleString()} 件`,
  graphPrimaryIs: (label: string) => `${label} が主要概念です。`,
  graphHighlightPaths: (n: number) =>
    `橙色の経路は、この回答の寄与が引用する文に含まれる${String(n)}件の関係です。`,
  graphHighlightOriginBefore: (_sentences: number) => 'ハイライトは',
  graphHighlightOriginAfter: (sentences: number) =>
    `内の制御文${String(sentences)}件に由来します。`,
  graphHiddenScaffolding: (nodes: number, edges: number) =>
    `出典詳細のノード${String(nodes)}件と関係${String(edges)}件は、` +
    '個別のハイライト項目としてマップに表示されません。' +
    '否定・法性のスコープ、来歴レコード、切り離された臨床詳細、重複する出典関係を含みます。' +
    'すべて証明の表示で参照できます。',
  graphDirectRelations: (n: number) => `直接の意味的な関係 ${String(n)}件`,
  graphSearchMatches: (shown: number, total: number) =>
    `一致するノード${total.toLocaleString()}件のうち${shown.toLocaleString()}件を表示しています。`,
  graphNodeLocation: (document: string, sentence: number | undefined) =>
    sentence === undefined ? document : `${document} · 文 ${String(sentence)}`,
  graphPathTo: (label: string) => `${label} へ`,
  graphPathLength: (relationships: number) => `最短経路: 関係${String(relationships)}件。`,
  graphRelationsFrom: (label: string) => `${label} からの関係`,
  graphViewDepth: (nodes: number, edges: number, depth: number) =>
    `概念・動作 ${nodes.toLocaleString()} 件と意味的な関係 ${edges.toLocaleString()} 件を、` +
    `深さ ${String(depth)} で表示しています。`,
  graphViewAnswer: (nodes: number, edges: number, highlighted: number) =>
    `概念・動作 ${nodes.toLocaleString()} 件と意味的な関係 ${edges.toLocaleString()} 件を表示し、` +
    `うち ${String(highlighted)} 件を現在の回答としてハイライトしています。`,
  graphViewOmissions: (nodes: number, edges: number, splitRelations: number) =>
    `現在の上限によりノード${String(nodes)}件とエッジ表示行${String(edges)}件を省略しています。` +
    `スコープの変種が一部欠けている表示済み関係識別子は${String(splitRelations)}件です。`,
  graphRelationsTruncated: (shown: number, total: number, splitRelations: number) =>
    `直接の関係${String(total)}件のうち、${String(shown)}件を表示しています。` +
    `上限によりエッジ表示行${String(total - shown)}件を省略しています。` +
    `スコープの変種が一部欠けている表示済み関係識別子は${String(splitRelations)}件です。` +
    '検索を使うと任意のノードに到達できます。',
  graphCanvasUnavailable: (message: string) =>
    `視覚的なグラフを利用できません。以下の完全なHTMLナビゲーションをお使いください。${message}`,
  graphLoadFailed: (message: string) => `意味グラフを読み込めませんでした。${message}`,

  chatAnswering: () => 'アシスタントが回答しています。',
  chatAnswered: () => '回答の準備ができました。',
  chatCancelled: () => '回答を停止しました。',
  chatTurnEnded: () => 'このターンは回答なしで終了しました。',
  chatQueries: (n: number) => `知識ベースの問い合わせ: ${String(n)}件`,
  chatSources: (n: number) => `ウェブの出典: ${String(n)}件`,
  chatCardRunning: () => '実行中',
  chatCardSolutions: (n: number) => `解${String(n)}件`,
  chatCardFailure: () => '解なし',
  chatCardLimit: (limit: string, n: number) => `${limit}の上限で停止 (解${String(n)}件)`,
  chatCardRefused: () => '読み取り専用の検査で拒否',
  chatCardError: (code: string) => `失敗 (${code})`,
  chatCardCancelled: () => '中止',
  chatModelRead: (shown: number, total: number) =>
    `モデルが読んだのは解${String(total)}件のうち${String(shown)}件です。`,
  chatClaimed: (source: string) => `主張された出典: ${source}`,
  chatAuth: () =>
    'チャットのモデルにログインしていません。' +
    'CODEX_HOME=~/.config/cnl-ckc-demo/codex codex login で一度ログインしてから、もう一度送信してください。',
  chatNetwork: () =>
    'チャットのブリッジが応答しませんでした。pnpm chat:dev で起動してから、もう一度送信してください。',
  chatServer: () =>
    'チャットのブリッジでエラーが発生しました。起動していない場合は、pnpm chat:dev で起動してください。その後、もう一度送信してください。',
  chatProtocol: () =>
    'チャットのブリッジから、このページで読めない応答が届きました。もう一度送信してください。',
  chatBusy: () => 'この会話では回答がまだ続いています。終わってから、もう一度送信してください。',
  chatExpired: () =>
    'ブリッジ側で会話が終了しました。「新しい会話」を選択してから、もう一度送信してください。',
  chatCodex: (message: string) => `チャットのモデルがエラーを報告しました。${message}`,
  chatTimeout: () => 'チャットのモデルの回答に時間がかかりすぎました。もう一度送信してください。',
  chatInterrupted: () => '回答が中断されました。もう一度送信してください。',
} as const;

export const JA: Messages = { INSTRUCTIONS, DESCRIPTIONS, LABELS, TEXT };
