// Independent vertical vector ink; Chromium's TextMetrics rounds ascent/descent past the ink.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import fontverter from 'fontverter';
import { Blob, Buffer as ShapeBuffer, Face, Font, Variation, shape } from 'harfbuzzjs';

const fontPath = fileURLToPath(
  new URL(
    '../../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2',
    import.meta.url,
  ),
);
/** @param {string[]} texts @returns {Promise<Record<string, { top: number, bottom: number }>>} */
export const inkOf = async (texts) => {
  const face = new Face(new Blob(await fontverter.convert(readFileSync(fontPath), 'sfnt')));
  const font = new Font(face);
  font.setVariations([new Variation('wght', 600)]);
  /** @type {Record<string, { top: number, bottom: number }>} */
  const result = {};
  for (const text of new Set(texts)) {
    const buffer = new ShapeBuffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    shape(font, buffer);
    const info = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    let top = Infinity;
    let bottom = -Infinity;
    let y = 0;
    for (let i = 0; i < info.length; i++) {
      const glyph = info[i];
      const position = positions[i];
      if (!glyph || !position) throw new Error('glyph position missing');
      const ext = font.glyphExtents(glyph.codepoint);
      if (ext && (ext.width !== 0 || ext.height !== 0)) {
        top = Math.min(top, (-(y + position.yOffset + ext.yBearing) * 13) / face.upem);
        bottom = Math.max(
          bottom,
          (-(y + position.yOffset + ext.yBearing + ext.height) * 13) / face.upem,
        );
      }
      y += position.yAdvance;
    }
    result[text] = {
      top: Number.isFinite(top) ? top : 0,
      bottom: Number.isFinite(bottom) ? bottom : 0,
    };
  }
  return result;
};
