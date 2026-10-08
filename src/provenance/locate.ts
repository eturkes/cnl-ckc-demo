/** How much of a passage one page's text holds, and the text items that hold it. */
export interface Located {
  /** `continues` = the passage's start runs to the page's last character and on past it. */
  coverage: 'whole' | 'continues' | 'none';
  items: number[];
}

/**
 * The shortest start a page may end on and still count as the passage continuing: shorter
 * runs occur by chance (measured: every genuine spill in the corpus keeps ≥ 35 characters).
 */
const MIN_START = 20;

/**
 * A text item holding one list bullet and nothing else: the extracted passage drops list
 * markers. The guideline's symbol-font bullet extracts as U+00EF `ï`, which also occurs inside
 * words (`naïve`), so only a whole item is dropped, never the character.
 */
const BULLETS = new Set(['•', 'ï']);

/**
 * Fold text the way the comparison reads it, char by char so each folded char keeps its
 * source item: NFKC (ligatures, compatibility forms), no whitespace or soft hyphen, case
 * folded, no bullet item. PDF text runs split words and lines where the extracted passage
 * does not.
 */
const fold = (items: readonly string[]): { text: string; owner: number[] } => {
  let text = '';
  const owner: number[] = [];
  items.forEach((item, index) => {
    if (BULLETS.has(item.trim())) return;
    for (const char of item) {
      for (const folded of char.normalize('NFKC').toLowerCase()) {
        if (folded === '\u00ad' || /\s/u.test(folded)) continue;
        text += folded;
        // One entry per UTF-16 unit, the unit `indexOf` and `length` count in.
        for (let unit = 0; unit < folded.length; unit += 1) owner.push(index);
      }
    }
  });
  return { text, owner };
};

const covering = (owner: readonly number[], start: number, length: number): number[] => [
  ...new Set(owner.slice(start, start + length)),
];

/** Find `passage` in a page given as PDF.js text items, in order. */
export const locatePassage = (items: readonly string[], passage: string): Located => {
  const page = fold(items);
  const wanted = fold([passage]).text;
  if (wanted === '' || page.text === '') return { coverage: 'none', items: [] };
  const whole = page.text.indexOf(wanted);
  if (whole >= 0) return { coverage: 'whole', items: covering(page.owner, whole, wanted.length) };
  // A passage that spills onto the next page leaves its start as this page's last characters.
  for (let length = wanted.length - 1; length >= MIN_START; length -= 1) {
    if (page.text.endsWith(wanted.slice(0, length))) {
      return {
        coverage: 'continues',
        items: covering(page.owner, page.text.length - length, length),
      };
    }
  }
  return { coverage: 'none', items: [] };
};
