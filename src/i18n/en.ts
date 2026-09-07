// Every word of the demo's own prose, as data, in English.
//
// The bucket split is editorial, not a heuristic: the project holds instructions
// to 20 words per sentence and everything else to 25, and a validator cannot tell
// the two apart by reading a string. Declaring the bucket is what makes both
// limits mechanically checkable. `tools/copy-check.mjs` grades this file on every
// gate run and grades `ja.ts` for parity against it.
//
// `TEXT` holds every string that interpolates a value. Each entry returns a WHOLE
// sentence rather than a fragment other code joins, because Japanese reorders what
// English concatenates — a shared `${count} ${noun}` helper would force one
// language's word order onto the other. Nothing outside a locale file builds a
// sentence from parts.
//
// NOT here, and deliberately: question strings, ACE renderings, canonical Prolog
// values, document ids and engine error messages. Those are payload — the demo
// answers in the language its knowledge base is written in.

/** Imperative text. One instruction per sentence, 20 words per sentence. */
export const INSTRUCTIONS = {
  selectQuestion: 'Select a prepared clinical question.',
  runQuestion: 'Select Run to get a deterministic answer from the knowledge base.',
  notClinical: 'Do not use this demo to make clinical decisions.',
  readLicence: 'Read the font licences for the four typefaces below.',
  graphSearchHelp:
    'Select a result to move the map. Select Path to show the shortest semantic connection.',
  graphExpandHint: 'The view is capped for readability. Select Expand to reveal more.',
  graphCompareRun: 'Run a prepared question above to compare the graph with a live proof.',
} as const;

/** Explanatory text. 25 words per sentence. */
export const DESCRIPTIONS = {
  wordmark: 'Clinical Knowledge Compiler',

  documentTitle: 'Controlled Natural Language - Clinical Knowledge Compiler (CNL CKC) Demo',

  documentDescription:
    'Explore live Prolog answers, source provenance, and semantic relationships in a compiled CDC clinical guideline.',

  heroEyebrow: 'Controlled language · Prolog · WebAssembly',

  lede:
    'Run prepared questions against a compiled version of the CDC guideline. ' +
    'Every answer is proved live in the browser and traceable to its source.',

  prototypeNote: 'Research prototype. Not clinical guidance.',

  aboutSummary: 'About this demo',
  prologSummary: 'Canonical Prolog answer',
  licenceSummary: 'Typefaces',

  purpose:
    'This is a prepared demonstration of a knowledge compiler. It is not a clinical tool, and it gives no medical advice.',

  fixedCatalog:
    'The question list is fixed. Each topic selects source-aligned controlled clauses from the verified knowledge-base export and runs as a Prolog query.',

  projection:
    'The source guideline is projected into controlled language and Prolog. Results render every selected controlled clause through fixed, content-independent rules.',

  clauseRendering:
    'The engine returned structured controlled-language clauses. Fixed rendering rules preserve their conditions, modality, negation, actions and qualifiers.',

  answerAssembly:
    'All proved recommendations are combined into one answer. Numbered citations retain the source relationship for each rendered statement.',

  sourcePassage: 'This passage is carried in the same Prolog result and remains unchanged.',
  sourceUnavailable:
    'This result has no structured source passage. Its canonical Prolog value remains available below.',

  workingAnswer: 'Proving the answer against the compiled guideline…',

  proofStepOrigin:
    'The engine re-ran the selected source contribution through its bounded proof interpreter.',

  reviewUnreviewed: 'No human adjudication is recorded for this compiled document.',
  reviewRecorded: 'This is the review label recorded by the knowledge-base export.',

  graphIntro:
    'Explore clinical concepts and actions connected across the compiled knowledge base. ' +
    'The map starts with opioid therapy; answer links add the exact proof path as a highlight.',

  graphLoadNote: 'The graph data and layout engine load only after you select this control.',

  graphDerivation:
    'The primary concept is ranked mechanically from terms and semantic roles in the question and deterministic answer.',

  graphMutedBranches:
    'Muted branches show how the concept connects elsewhere in the knowledge base.',

  // No corpus number is written here. The count is read from the booted engine and
  // substituted by `TEXT.engineReady`, so shipped copy can never state a size the
  // engine does not report.
  unreviewed:
    'Every compiled document carries the label unreviewed. No person has adjudicated any of them. ' +
    'The other labels in that vocabulary are approved, rejected, contested and stale.',

  prolog:
    'The Prolog engine renders each value below in canonical syntax. The demo sorts those values into the exported answer format.',

  attribution:
    'Source: CDC. The Centers for Disease Control and Prevention developed the source material.',

  freeAvailability: 'The source material is available on the agency website at no charge.',

  nonendorsement:
    'Use of this material does not imply endorsement by the Centers for Disease Control and Prevention. ' +
    'It does not imply endorsement by the Department of Health and Human Services. ' +
    'It does not imply endorsement by the United States Government.',

  fonts:
    'This demo sets text in Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono, Literata and BIZ UDPGothic. ' +
    'Each typeface ships under the SIL Open Font License 1.1.',
} as const;

/**
 * Chrome: headings, controls and accessible names. Short by nature, so the word
 * limit rarely binds — the value of grading them is the banned-filler sweep and
 * the parity check against `ja.ts`.
 *
 * `languageSwitch` is ASCII in BOTH locales on purpose. Naming the target language
 * in its own script would put Japanese glyphs on the English page, and the browser
 * would fetch the 1,319,288 B Japanese face to render three characters nobody in
 * English mode asked for.
 */
export const LABELS = {
  brandHome: 'CNL CKC demo home',
  navAria: 'Page',
  navQuery: 'Query',
  navGraph: 'Graph',
  navNotes: 'Notes',
  sourceMaterial: 'Source material',
  backToTop: 'Back to top',

  themeToLight: 'Use the light theme',
  themeToDark: 'Use the dark theme',
  themeLight: 'Light',
  themeDark: 'Dark',

  languageSwitch: 'Japanese',
  languageSwitchAria: 'Show this demo in Japanese',

  queryEyebrow: 'Query',
  askHeading: 'Ask the compiled guideline',
  questionLabel: 'Clinical question',
  questionPrompt: 'Choose a question',
  run: 'Run',
  cancel: 'Cancel',
  retry: 'Retry',

  answerHeading: 'Answer',
  answerTurn: 'Deterministic answer',
  answerAuthor: 'Clinical Knowledge Compiler',
  answerMode: 'Deterministic answer',
  explanationSummary: 'Sources and explanation',
  technicalSummary: 'Technical details',
  sourcePicker: 'Select a source to inspect',
  selectedEvidence: 'Selected evidence',

  evidenceEyebrow: 'Evidence',
  evidenceHeading: 'Proof to source',
  findInGraph: 'Find in graph',
  ladderSummary: 'Explore the six evidence steps',
  liveProof: 'Live Prolog proof',
  evidenceLoading: 'Loading the selected document evidence.',
  evidenceRetry: 'Retry evidence',
  compiledClause: 'Compiled clause',
  controlledSentence: 'Controlled sentence',
  coverageRegion: 'Coverage region',
  region: 'Region',
  section: 'Section',
  physicalPage: 'Physical page',
  alignedPassage: 'Aligned source passage',
  projectionKept: 'Projection kept:',
  projectionDropped: 'Projection changed or omitted:',
  guidelinePage: 'Guideline page',
  loadPageViewer: 'Load page viewer',
  openPageTab: 'Open page in a new tab',
  compareWithProof: 'Compare with the current proof',

  graphEyebrow: 'Graph',
  graphHeading: 'Semantic knowledge graph',
  graphExplore: 'Explore graph',
  graphLoading: 'Loading the semantic graph.',
  graphTryAgain: 'Try again',
  graphAnswerMap: 'Answer map',
  graphDerivationSummary: 'How this map was derived',
  graphSearchLabel: 'Find a concept or action',
  graphSearchPlaceholder: 'Search clinical concepts and actions',
  graphRecenter: 'Recenter',
  graphFitAnswer: 'Fit answer map',
  graphExpand: 'Expand',
  graphSearchResults: 'Graph search results',
  graphNoMatches: 'No matching nodes.',
  graphPath: 'Path',
  graphPrimaryConcept: 'Primary concept',
  graphLegendFocus: 'Primary focus',
  graphLegendConcept: 'Concept',
  graphLegendAction: 'Action',
  graphLegendAttribute: 'Attribute',
  graphLegendAnswer: 'Current answer',
  graphShortestPath: 'Shortest path',
  graphClear: 'Clear',
  graphAccessibleView: 'Accessible graph view',
  graphNoRelationships: 'This node has no relationships.',
  graphNodeIndex: 'Nodes in this visual neighborhood',
  graphNoPath: 'No connecting path was found.',

  // Split around a `<code>` element: English leads with the phrase, Japanese
  // trails it. A single returned string cannot carry the element.
  graphSelectedBefore: 'Selected from',
  graphSelectedAfter: '.',
} as const;

/** English plural agreement. Japanese has no equivalent, so `ja.ts` omits it. */
const plural = (n: number, singular: string, many = `${singular}s`): string =>
  `${String(n)} ${n === 1 ? singular : many}`;

/**
 * Interpolated prose. Each entry owns a complete sentence in its own word order.
 *
 * Engine-authored values — limit codes, error codes, error messages, document ids,
 * review labels — arrive already rendered and pass through verbatim.
 */
export const TEXT = {
  answerYes: () => 'Answer: yes.',
  answerYesSummary: () => 'Yes. The knowledge base proves it.',
  answerReady: () => 'Answer ready.',
  answerNo: () => 'Answer: no.',
  answerNoSummary: () => 'No. The knowledge base found no proof.',
  noProof: () => 'No proof found.',
  noProofSummary: () => 'No proof found. The result is empty.',
  noAnswerYet: () => 'No answer yet.',

  limitStack: () => 'the stack limit',
  limitDepth: () => 'the depth limit',
  limitInference: () => 'the inference limit',
  limitWallClock: () => 'the time limit',
  limitAnswerCap: () => 'the answer limit',
  limitHeap: () => 'the memory limit',

  runStopped: (limitText: string, limitCode: string, partial: number) =>
    `The run stopped at ${limitText} (${limitCode}) with ${plural(partial, 'partial answer')}.`,
  runCancelled: (partial: number) => `Cancelled with ${plural(partial, 'partial answer')}.`,
  runFailed: (code: string, message: string) => `The run failed (${code}). ${message}`,
  runFailedSummary: () => 'The run failed.',
  questionRejected: () => 'That question is not in the catalog, so it was never run.',
  questionRejectedSummary: () => 'The question was rejected.',

  engineStarting: () => 'Starting the Prolog engine.',
  engineFailed: (message: string) => `The Prolog engine did not start. ${message}`,
  engineFailedSummary: () => 'The engine is unavailable. Select Retry to start it again.',
  engineReady: (documents: number, schemaVersion: string) =>
    `Knowledge base ready: ${plural(documents, 'compiled document')} at schema ${schemaVersion}. ` +
    'Pick a question and run it.',
  engineDocuments: (documents: number) =>
    `The engine reports ${plural(documents, 'compiled document')}.`,
  runningQuestion: (question: string) => `Running ${question}`,
  cancellingRun: () => 'Cancelling the run.',

  inspectSource: (index: number) => `Inspect source ${String(index)} for this statement`,
  inspectSourceDocument: (index: number, document: string | undefined) =>
    `Inspect source ${String(index)}${document === undefined ? '' : `, ${document}`}`,
  sourceOrdinal: (index: number) => `Source ${String(index)}`,
  sourceCount: (n: number) => plural(n, 'source'),

  traceIdle: () => 'Select a citation to trace that part of the answer.',
  traceLoading: () => 'Re-proving the selected source contribution.',
  traceFailure: () => 'The selected source contribution could not be re-proved.',
  traceCancelled: () => 'The proof trace was cancelled.',
  traceUnavailable: () => 'Proof tracing is unavailable.',
  traceLimit: (limitCode: string) => `The proof trace stopped at the ${limitCode} limit.`,
  traceError: (code: string, message: string) => `The proof trace failed (${code}). ${message}`,
  traceReady: (steps: number) =>
    `${plural(steps, 'source clause')} re-proved this part of the answer live.`,

  proofStepCount: (n: number) => plural(n, 'proof step'),
  proofStepLine: (line: number) => `line ${String(line)}`,
  clauseJoin: (n: number) => `${plural(n, 'exact clause')} joined by source line.`,
  alignAce: (phrase: string) => `Align controlled phrase: ${phrase}`,
  alignSource: (phrase: string) => `Align source phrase: ${phrase}`,
  reviewStatus: (label: string) => `Review status: ${label}.`,
  passagePage: (page: number) => `The passage maps to physical PDF page ${String(page)}.`,
  pageViewerTitle: (page: number) => `CDC guideline, physical page ${String(page)}`,

  graphCounts: (concepts: number, links: number) =>
    `${concepts.toLocaleString()} concepts/actions · ${links.toLocaleString()} semantic links`,
  graphPrimaryIs: (label: string) => `${label} is the primary concept.`,
  graphHighlightPaths: (n: number) =>
    `Orange paths are the ${plural(n, 'relationship')} proved by this answer contribution.`,
  // Split around a `<code>` element, which a single returned string cannot carry.
  // Both halves take the count because English puts it before the document id and
  // Japanese puts it after.
  graphHighlightOriginBefore: (sentences: number) =>
    `The highlight comes from ${plural(sentences, 'controlled sentence')} in`,
  graphHighlightOriginAfter: (_sentences: number) => '.',
  graphHiddenScaffolding: (nodes: number, edges: number) =>
    `${String(nodes)} parser or provenance nodes and ${String(edges)} lower-level relationships ` +
    'are hidden here and remain inspectable in the proof view.',
  graphDirectRelations: (n: number) => `${plural(n, 'direct semantic relationship')}`,
  graphNodeLocation: (document: string, sentence: number | undefined) =>
    sentence === undefined ? document : `${document} · sentence ${String(sentence)}`,
  graphPathTo: (label: string) => `to ${label}`,
  graphPathLength: (relationships: number) =>
    `Shortest path: ${plural(relationships, 'relationship')}.`,
  graphRelationsFrom: (label: string) => `Relationships from ${label}`,
  graphViewDepth: (nodes: number, edges: number, depth: number) =>
    `Showing ${nodes.toLocaleString()} concepts/actions and ${edges.toLocaleString()} ` +
    `semantic relationships at depth ${String(depth)}.`,
  graphViewAnswer: (nodes: number, edges: number, highlighted: number) =>
    `Showing ${nodes.toLocaleString()} concepts/actions and ${edges.toLocaleString()} ` +
    `semantic relationships, with ${String(highlighted)} highlighted for the current answer.`,
  graphRelationsTruncated: (shown: number, total: number) =>
    `Showing the first ${String(shown)} of ${String(total)} direct relationships. ` +
    'Use search to reach any node.',
  graphCanvasUnavailable: (message: string) =>
    `The visual graph is unavailable. Use the complete HTML navigation below. ${message}`,
  graphLoadFailed: (message: string) => `The semantic graph did not load. ${message}`,
} as const;

/**
 * Locale contract. Every key is required and every value widens to `string`, so a
 * missing, extra or misnamed key in `ja.ts` is a `pnpm check` failure rather than
 * a string that silently falls back to English at run time.
 */
export interface Messages {
  INSTRUCTIONS: Record<keyof typeof INSTRUCTIONS, string>;
  DESCRIPTIONS: Record<keyof typeof DESCRIPTIONS, string>;
  LABELS: Record<keyof typeof LABELS, string>;
  TEXT: { [K in keyof typeof TEXT]: (...args: Parameters<(typeof TEXT)[K]>) => string };
}

export const EN: Messages = { INSTRUCTIONS, DESCRIPTIONS, LABELS, TEXT };
