// The Japanese face is shipped as a subset of the `@fontsource` original: exactly the code
// points `src/i18n/ja.ts` can render, plus SAFETY. `pnpm font:subset` writes it and
// `presentation:check` regrades it, so a glyph added to `ja.ts` without a rebuild fails the gate.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import fontverter from 'fontverter';
import { Blob, Face } from 'harfbuzzjs';
import subsetFont from 'subset-font';

import { ROOT } from './kb/paths.mjs';

export const CATALOG = 'src/i18n/ja.ts';

/** Original `node_modules` path → the shipped subset, which `src/app.css` names `./fonts/…`. */
export const SUBSETS = [400, 700].map((weight) => ({
  weight,
  original: `@fontsource/biz-udpgothic/files/biz-udpgothic-japanese-${String(weight)}-normal.woff2`,
  shipped: `src/fonts/biz-udpgothic-japanese-${String(weight)}-normal.subset.woff2`,
}));

/** @param {{shipped: string}} subset */
export const shippedUrl = ({ shipped }) => `./${shipped.replace(/^src\//u, '')}`;

/**
 * Kana, CJK punctuation and fullwidth ASCII: what any Japanese text a user types is built
 * from, so free text keeps the face for everything but kanji the catalog never uses.
 *
 * @type {[number, number][]}
 */
export const SAFETY = [
  [0x3000, 0x30ff],
  [0xff01, 0xff5e],
];

/**
 * FreeType's autofitter sizes CJK blue zones from these reference glyphs (`afblue.dat`
 * `AF_BLUE_STRING_CJK_*` + `afscript.h` `hani` 田 囗), and Chromium on Linux hints with it.
 * A subset without them rasterizes every kana a few pixels differently from the original.
 */
const AUTOFIT = new Set(
  [
    ...'个为主事些人他以们你來例個們军別别到制前动動即同吗吧听呢和品响嗎囗因地增大她學它对将將對就已师師席年得情想意愿我或指收政断斯新斷既时明星是時景最會有朝期来构样樣民沒没為然照物特现現球理生用田當看眼着确种第經置者能自舰著裡要說調说谁调費费起軍过还这进這通進過道還那都配里開間间际陈限除陳随際隨雷露面顾齊',
  ].map((char) => char.codePointAt(0) ?? 0),
);

/** @param {number} point @param {[number, number][]} ranges */
const inRanges = (point, ranges) => ranges.some(([lo, hi]) => point >= lo && point <= hi);

/**
 * The `unicode-range` of the `@font-face` rule whose `src` names `url`.
 *
 * @param {string} css @param {string} url
 * @returns {[number, number][]}
 */
export const rangeOf = (css, url) => {
  const body = [...css.matchAll(/@font-face\s*\{([^}]*)\}/gu)]
    .map((match) => match[1] ?? '')
    .find((text) => text.includes(`url('${url}')`));
  const value = /unicode-range:([^;]+);/u.exec(body ?? '')?.[1];
  if (value === undefined) throw new Error(`app.css: no unicode-range on the face at ${url}`);
  return value.split(',').map((part) => {
    const [lo = '', hi = lo] = part.trim().replace(/^U\+/iu, '').split('-');
    return [Number.parseInt(lo, 16), Number.parseInt(hi, 16)];
  });
};

/**
 * Sorted code points the subset must carry: those the catalog text uses inside the face's
 * range, plus SAFETY and AUTOFIT, each limited to what the original maps. `autofit: false`
 * is the rendered text alone — what `browser:check` draws, and its hinting control's cut.
 *
 * @param {string} text @param {[number, number][]} range @param {Set<number>} original
 * @param {{autofit?: boolean}} [options]
 * @returns {number[]}
 */
export const expectedPoints = (text, range, original, { autofit = true } = {}) => {
  const used = new Set([...text].map((char) => char.codePointAt(0) ?? 0));
  return [...original]
    .filter(
      (point) =>
        inRanges(point, SAFETY) ||
        (autofit && AUTOFIT.has(point)) ||
        (inRanges(point, range) && used.has(point)),
    )
    .sort((a, b) => a - b);
};

/**
 * The original cut to `points`, as woff2.
 *
 * @param {{original: string}} subset @param {number[]} points
 * @returns {Promise<Buffer>}
 */
export const cut = async (subset, points) =>
  subsetFont(await readFile(originalPath(subset)), String.fromCodePoint(...points), {
    targetFormat: 'woff2',
  });

/**
 * The code points a font file's cmap maps, read through HarfBuzz after woff2 decompression.
 *
 * @param {string} path absolute
 * @returns {Promise<Set<number>>}
 */
export const cmapOf = async (path) => {
  const sfnt = await fontverter.convert(await readFile(path), 'sfnt');
  return new Set(new Face(new Blob(sfnt)).collectUnicodes());
};

/** @param {{original: string}} subset */
export const originalPath = ({ original }) => join(ROOT, 'node_modules', original);
