// Every word of the demo's own prose, as data.
//
// The split is editorial, not a heuristic: the project holds instructions to 20
// words per sentence and descriptions to 25, and a validator cannot tell the two
// apart by reading a string. Declaring the bucket is what makes both limits
// mechanically checkable. `tools/copy-check.mjs` grades this file on every gate
// run.
//
// Question strings are NOT here. The generated catalog keeps each displayed
// clinical topic next to the Prolog goal that runs it.

/** Imperative text. One instruction per sentence, 20 words per sentence. */
export const INSTRUCTIONS = {
  selectQuestion: 'Select a prepared clinical question.',
  runQuestion: 'Select Run to prove the question against the knowledge base.',
  notClinical: 'Do not use this demo to make clinical decisions.',
  readLicence: 'Read the font licences for the three typefaces below.',
} as const;

/** Explanatory text. 25 words per sentence. */
export const DESCRIPTIONS = {
  wordmark: 'Clinical Knowledge Compiler',

  lede:
    'Run prepared questions against a compiled version of the CDC guideline. ' +
    'Every answer is proved live in the browser and traceable to its source.',

  aboutSummary: 'About this demo',
  prologSummary: 'Canonical Prolog answer',
  sourcePassageSummary: 'Read the exact source passage',
  licenceSummary: 'Typefaces',

  purpose:
    'This is a prepared demonstration of a knowledge compiler. It is not a clinical tool, and it gives no medical advice.',

  fixedCatalog:
    'The question list is fixed. Each topic selects source-aligned controlled clauses from the verified knowledge-base export and runs as a Prolog query.',

  projection:
    'The source guideline is projected into controlled language and Prolog. Results render every selected controlled clause through fixed, content-independent rules.',

  clauseRendering:
    'The engine returned structured controlled-language clauses. Fixed rendering rules preserve their conditions, modality, negation, actions and qualifiers.',

  sourcePassage: 'This passage is carried in the same Prolog result and remains unchanged.',

  // No corpus number is written here. The count is read from the booted engine and
  // substituted into `corpusSize`, so shipped copy can never state a size the engine
  // does not report.
  corpusSize: 'The engine reports {documents} compiled documents.',

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
    'This demo sets text in Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono and Literata. ' +
    'Each typeface ships under the SIL Open Font License 1.1.',
} as const;

export const GUIDELINE = {
  title: 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain — United States, 2022',
  html: 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm',
} as const;

/** Font licence files, copied verbatim from each package and served from `dist/`. */
export const FONT_LICENCES = [
  { family: 'Atkinson Hyperlegible Next', href: 'licenses/atkinson-hyperlegible-next.txt' },
  { family: 'Atkinson Hyperlegible Mono', href: 'licenses/atkinson-hyperlegible-mono.txt' },
  { family: 'Literata', href: 'licenses/literata.txt' },
] as const;
