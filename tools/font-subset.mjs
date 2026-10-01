// `pnpm font:subset` — rewrite each shipped Japanese subset from its `@fontsource` original.
// Run it after any `src/i18n/ja.ts` edit that adds a code point; `presentation:check` refuses a
// stale subset by code point.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CATALOG,
  cmapOf,
  cut,
  expectedPoints,
  originalPath,
  rangeOf,
  shippedUrl,
  SUBSETS,
} from './fonts.mjs';
import { ROOT } from './kb/paths.mjs';

const css = readFileSync(join(ROOT, 'src/app.css'), 'utf8');
const text = readFileSync(join(ROOT, CATALOG), 'utf8');

for (const subset of SUBSETS) {
  const points = expectedPoints(
    text,
    rangeOf(css, shippedUrl(subset)),
    await cmapOf(originalPath(subset)),
  );
  const bytes = await cut(subset, points);
  writeFileSync(join(ROOT, subset.shipped), bytes);
  console.log(
    `font:subset — ${subset.shipped}: ${String(points.length)} code points, ${String(bytes.length)} B`,
  );
}
