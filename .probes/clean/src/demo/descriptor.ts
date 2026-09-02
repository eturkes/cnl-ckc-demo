// Column labels for the ACE descriptors the question compiler attached to each
// projected variable.
//
// Structural only, on the same terms as `humanizeGuidelineId`: an unrecognized
// shape returns the descriptor unchanged, so a new descriptor form degrades to
// the truth rather than to a guessed label. Without this the answer table showed
// `noun(recommendation,countable)` as a reader-facing `<dt>`.

const NOUN = /^noun\(([\w-]+),\s*(?:countable|mass)\)$/;
const WH = /^wh\(([\w-]+)\)$/;

const sentenceCase = (text: string): string => {
  const words = text.replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** @param descriptor raw ACE descriptor, e.g. `noun(recommendation,countable)` */
export const describeDescriptor = (descriptor: string): string => {
  const noun = NOUN.exec(descriptor)?.[1];
  if (noun !== undefined) return sentenceCase(noun);
  const wh = WH.exec(descriptor)?.[1];
  if (wh !== undefined) return sentenceCase(wh);
  return descriptor;
};
