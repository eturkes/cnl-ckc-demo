// Every word of the demo's own prose, as data.
//
// The split is editorial, not a heuristic: the project holds instructions to 20
// words per sentence and descriptions to 25, and a validator cannot tell the two
// apart by reading a string. Declaring the bucket is what makes both limits
// mechanically checkable. `tools/copy-check.mjs` grades this file on every gate
// run.
//
// The six question strings are NOT here. They are generated from the bag's
// compiled goals, and rewriting them into smoother English would make the
// displayed question differ from the question that runs.

/** Imperative text. One instruction per sentence, 20 words per sentence. */
export const INSTRUCTIONS = {
  selectQuestion: 'Select one of the six prepared questions.',
  runQuestion: 'Select Run to prove the question against the knowledge base.',
  notClinical: 'Do not use this demo to make clinical decisions.',
  readLicence: 'Read the font licences for the three typefaces below.',
} as const;

/** Explanatory text. 25 words per sentence. */
export const DESCRIPTIONS = {
  wordmark: 'Controlled Natural Language - Clinical Knowledge Compiler (CNL CKC) Demo',

  lede:
    'This demo answers questions about a clinical guideline by running Prolog against a compiled knowledge base. ' +
    'Each answer is a live proof, never a stored result.',

  aboutSummary: 'About this demo',
  prologSummary: 'Canonical Prolog answer',
  licenceSummary: 'Typefaces',

  purpose:
    'This is a prepared demonstration of a knowledge compiler. It is not a clinical tool, and it gives no medical advice.',

  fixedCatalog:
    'The question list is fixed. A developer wrote these six questions, and the demo compiles each one to a Prolog goal before it runs.',

  projection:
    'The demo does not reproduce guideline text unchanged. It runs a compiled projection of that text into a controlled language, and then into Prolog.',

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
