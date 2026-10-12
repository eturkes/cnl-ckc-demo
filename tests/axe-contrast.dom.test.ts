// jsdom has no canvas, so axe-core can never decide `color-contrast` there: every result lands
// in `incomplete`. That is why `pnpm contrast:check` grades a declared token table instead
// (`.claude/rules/ui.md` `Colour`), and why the dom suites' axe passes say nothing about colour.
// `tests/axe-contrast.browser.test.ts` runs the same probe in Chromium, where it is decided.

import { describe, expect, it } from 'vitest';

import { contrastReading, JSDOM_READING } from './support/axe-contrast.js';

describe('axe-core color-contrast under jsdom', () => {
  it('reports even an unreadable pair as incomplete, never as a violation or a pass', async () => {
    expect(await contrastReading()).toEqual(JSDOM_READING);
  });
});
