// Independent shaping oracle: public HarfBuzz/fontverter APIs, no producer helpers.
import { readFileSync } from 'node:fs';
import fontverter from 'fontverter';
import * as hb from 'harfbuzzjs';

export const fontPath = new URL(
  '../../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2',
  import.meta.url,
);
const sfnt = await fontverter.convert(readFileSync(fontPath), 'sfnt');
const face = new hb.Face(new hb.Blob(sfnt));
const font = new hb.Font(face);
font.setVariations([new hb.Variation('wght', 600)]);
font.setScale(face.upem, face.upem);
const widths = new Map<string, number>();
export const advance = (text: string): number => {
  const prior = widths.get(text);
  if (prior !== undefined) return prior;
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const width = (buffer.getGlyphPositions().reduce((n, p) => n + p.xAdvance, 0) * 13) / face.upem;
  widths.set(text, width);
  return width;
};
export const measured = (text: string): { lines: string[]; W: number; H: number } => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const joined = current === '' ? word : `${current} ${word}`;
    if (current !== '' && advance(joined) > 130) {
      lines.push(current);
      current = word;
    } else current = joined;
  }
  if (current !== '') lines.push(current);
  return { lines, W: Math.max(0, ...lines.map(advance)) + 8, H: 19 + (lines.length - 1) * 15.6 };
};
