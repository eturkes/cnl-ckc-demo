// d41: the owned page viewer marks a coverage row's passage in its page's PDF.js text items.
// `locatePassage` is graded on synthetic runs, then over every shipped evidence document against
// the shipped guideline PDF, read here through PDF.js's Node build.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';

import { locatePassage } from '../src/provenance/locate.js';

const PROVENANCE = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  'kb',
  'generated',
  'provenance',
);

describe('locatePassage', () => {
  it('finds a passage split across runs, line breaks, ligatures and case', () => {
    const items = [
      'Intro text. ',
      'Clinicians should ',
      'maxi',
      'mize use of ',
      'nonopioid ',
      'ther',
      'apies',
      ' ﬁrst.',
      'After.',
    ];
    expect(
      locatePassage(items, 'clinicians should maximize use of nonopioid therapies first.'),
    ).toEqual({
      coverage: 'whole',
      items: [1, 2, 3, 4, 5, 6, 7],
    });
  });

  it('maps an astral character before the match to its own item only', () => {
    // UTF-16 offsets run one unit ahead per astral character, so a per-code-point map would
    // shift the marks one character right, onto the next item.
    expect(locatePassage(['\u{1F600}', 'ab', 'cd'], 'ab')).toEqual({
      coverage: 'whole',
      items: [1],
    });
    expect(
      locatePassage(
        ['\u{1F600}', 'starts here and', 'runs off'],
        'starts here and runs off the page',
      ),
    ).toEqual({ coverage: 'continues', items: [1, 2] });
  });

  it('ignores whitespace and soft hyphens inside the page text', () => {
    expect(locatePassage(['Opi\u00adoid', '  therapy\n', 'is'], 'Opioid therapy is')).toEqual({
      coverage: 'whole',
      items: [0, 1, 2],
    });
  });

  it('skips a lone bullet item and keeps ï inside a word', () => {
    // The shipped guideline's two bullet glyphs, each its own item followed by a space item.
    const items = ['ï', ' ', 'For opioid-naïve patients;', '', '•', ' ', 'start low.'];
    expect(locatePassage(items, 'For opioid-naïve patients; start low.')).toEqual({
      coverage: 'whole',
      items: [2, 6],
    });
    expect(locatePassage(items, 'For opioid-nave patients')).toEqual({
      coverage: 'none',
      items: [],
    });
  });

  it('marks a passage that runs off the page end as continuing', () => {
    const items = [
      'Other text here. ',
      'When opioids are needed for acute pain, ',
      'clinicians should',
    ];
    expect(
      locatePassage(
        items,
        'When opioids are needed for acute pain, clinicians should prescribe no more.',
      ),
    ).toEqual({ coverage: 'continues', items: [1, 2] });
  });

  it('refuses a prefix that diverges mid-page or is too short to be the passage', () => {
    const items = [
      'When opioids are needed for acute pain, clinicians must wait. More text follows.',
    ];
    expect(
      locatePassage(
        items,
        'When opioids are needed for acute pain, clinicians should prescribe no more.',
      ),
    ).toEqual({ coverage: 'none', items: [] });
    expect(locatePassage(['Some text. When'], 'When opioids are needed')).toEqual({
      coverage: 'none',
      items: [],
    });
  });

  it('reads a table row as the extraction joins its cells and rows', () => {
    // Table convention: title, header and body rows in reading order, each row `<cell>: <cell>`,
    // rows joined `; `. The page holds each cell as its own item and no joiner.
    const items = ['TABLE. Doses for opioids', '', 'Opioid', ' ', 'Factor*', '', 'Codeine', ' '];
    expect(
      locatePassage([...items, '0.15', ''], 'Doses for opioids. Opioid: Factor*; Codeine: 0.15.'),
    ).toEqual({ coverage: 'whole', items: [0, 2, 4, 6, 8] });
  });

  it('skips a lone list label item and keeps a label inside text', () => {
    // One sentence, so no label sits at a sentence break the in-order reading could bridge.
    const items = ['criteria (317):', '1.', ' ', 'taken longer, and', '10.', ' ', 'tolerance:'];
    expect(
      locatePassage(
        [...items, ' a. ', ' ', 'a need, or', 'b.', 'more.'],
        'criteria (317): taken longer, and tolerance: a need, or more.',
      ),
    ).toEqual({ coverage: 'whole', items: [0, 3, 6, 9, 11] });
    expect(locatePassage(['See item', '2. Then'], 'See item 2. Then')).toEqual({
      coverage: 'whole',
      items: [0, 1],
    });
    // The label inside text stays page text: a passage without it is not the page's.
    expect(locatePassage(['See item', '2. Then'], 'See item Then')).toEqual({
      coverage: 'none',
      items: [],
    });
  });

  it('finds the sentences in order across lines the extraction leaves out', () => {
    // The sources and abbreviations lines under a table are scaffolding outside the passage.
    const items = [
      'Doses for opioids',
      'Codeine 0.15',
      'Sources: Adapted from Von Korff 2008.',
      'Abbreviations: mg = milligram.',
      '* Multiply the dose.',
    ];
    const passage = 'Doses for opioids. Codeine: 0.15. * Multiply the dose.';
    expect(locatePassage(items, passage)).toEqual({ coverage: 'whole', items: [0, 1, 4] });
    expect(locatePassage([...items.slice(4), ...items.slice(0, 4)], passage)).toEqual({
      coverage: 'none',
      items: [],
    });
    expect(locatePassage(items.slice(0, 4), passage)).toEqual({ coverage: 'none', items: [] });
    expect(
      locatePassage(
        items.map((item) => item.replace('0.15', '0.25')),
        passage,
      ),
    ).toEqual({ coverage: 'none', items: [] });
    // Each sentence must sit after the last, so a page holding a sentence once holds no repeat.
    expect(locatePassage(items, 'Doses for opioids. Doses for opioids.')).toEqual({
      coverage: 'none',
      items: [],
    });
  });

  it('reads a passage opening the page as whole though the page ends with its start again', () => {
    expect(
      locatePassage(
        ['Doses for opioids given today.', 'Doses for opioids given'],
        'Doses for opioids given today.',
      ),
    ).toEqual({ coverage: 'whole', items: [0] });
  });

  it('prefers the passage whole over its sentences scattered earlier on the page', () => {
    const items = ['Doses for opioids.', 'Other text.', 'Doses for opioids.', 'Codeine 0.15.'];
    expect(locatePassage(items, 'Doses for opioids. Codeine: 0.15.')).toEqual({
      coverage: 'whole',
      items: [2, 3],
    });
  });

  it('locates nothing in an empty page or for an empty passage', () => {
    expect(locatePassage([], 'anything')).toEqual({ coverage: 'none', items: [] });
    expect(locatePassage(['text'], '   ')).toEqual({ coverage: 'none', items: [] });
  });
});

describe('the shipped corpus', () => {
  it('locates every coverage passage on its recorded page: 469 whole, 21 continuing, 2 not found', async () => {
    const task = getDocument({
      data: new Uint8Array(readFileSync(join(PROVENANCE, 'guideline.pdf'))),
    });
    const pdf = await task.promise;
    const pages = new Map<number, string[]>();
    const pageItems = async (page: number): Promise<string[]> => {
      const cached = pages.get(page);
      if (cached !== undefined) return cached;
      const content = await (await pdf.getPage(page)).getTextContent();
      const items = content.items.map((item) => ('str' in item ? item.str : ''));
      pages.set(page, items);
      return items;
    };
    const counts = { whole: 0, continues: 0, none: 0 };
    const unlocated: string[] = [];
    for (const name of readdirSync(join(PROVENANCE, 'documents')).sort()) {
      const document = JSON.parse(readFileSync(join(PROVENANCE, 'documents', name), 'utf8')) as {
        id: string;
        region: { page: number };
        source: { text: string };
      };
      const located = locatePassage(await pageItems(document.region.page), document.source.text);
      counts[located.coverage] += 1;
      if (located.coverage === 'none') unlocated.push(document.id);
      else expect(located.items.length, document.id).toBeGreaterThan(0);
    }
    await task.destroy();
    expect(counts).toEqual({ whole: 469, continues: 21, none: 2 });
    // rec06 and rec07 record page 14 while their passage sits whole on page 13: the producer's
    // page (`.agent/deferred.md`).
    expect(unlocated).toEqual(['cdc2022-opioid-rec06', 'cdc2022-opioid-rec07']);
  }, 120_000);
});
