// The clinician-facing demo questions. Ids are declared here because they are
// the API the UI selects against; goals, projections and question text come from
// the generated artifact because the verified knowledge-base bag owns them.

import generated from '@kb/question-catalog.json';

/**
 * Every question the demo can run. Free text is not one of them: the intake
 * reads as future free-text but resolves an id, so this tuple is the whole
 * executable surface.
 */
export const QUESTION_IDS = [
  'when-to-use-opioids',
  'starting-opioid-therapy',
  'acute-pain-prescription-duration',
  'opioid-follow-up',
  'opioid-safety',
  'continuing-or-tapering-opioids',
  'opioid-use-disorder-treatment',
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export interface ProjectionVar {
  /** Goal variable the answer projects. */
  variable: string;
  /** ACE descriptor the question compiler attached, e.g. `noun(recommendation,countable)`. */
  descriptor: string;
}

/** The topic is curated, while its returned statements and proof coordinates are bag-derived. */
export type Provenance = 'bag-derived';

export interface CatalogEntry {
  id: QuestionId;
  question: string;
  /** Compiled goal in the bag's canonical prefix form. Never assembled from `question`. */
  goal: string;
  /** Empty means an existence question, which answers yes or no rather than rows. */
  projection: readonly ProjectionVar[];
  provenance: Provenance;
}

const PROVENANCES: readonly string[] = ['bag-derived'];

const build = (): Readonly<Record<QuestionId, CatalogEntry>> => {
  const emitted = new Map(generated.entries.map((entry) => [entry.id, entry]));
  if (emitted.size !== generated.entries.length)
    throw new Error('question catalog emitted duplicate ids');
  if (emitted.size !== QUESTION_IDS.length) {
    throw new Error(
      `question catalog holds ${emitted.size} entries, expected ${QUESTION_IDS.length}`,
    );
  }
  // A null prototype keeps `__proto__` and `constructor` from resolving to
  // inherited members if a lookup ever escapes `isQuestionId`.
  const catalog = Object.create(null) as Record<QuestionId, CatalogEntry>;
  for (const id of QUESTION_IDS) {
    const entry = emitted.get(id);
    if (entry === undefined)
      throw new Error(`question catalog is missing ${id}; run pnpm kb:build`);
    if (!PROVENANCES.includes(entry.provenance))
      throw new Error(`${id}: unknown provenance ${entry.provenance}`);
    if (entry.goal === '') throw new Error(`${id}: empty goal`);
    catalog[id] = Object.freeze({
      ...entry,
      id,
      provenance: entry.provenance as Provenance,
      projection: Object.freeze(entry.projection),
    });
  }
  return Object.freeze(catalog);
};

export const QUESTION_CATALOG = build();

export const isQuestionId = (value: unknown): value is QuestionId =>
  typeof value === 'string' && (QUESTION_IDS as readonly string[]).includes(value);
