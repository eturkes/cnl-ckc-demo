// The jsdom contrast pin's probe in real Chromium (`pnpm test:browser`): with layout and a canvas,
// axe decides the unreadable pair, so the pin's reading does not hold here. This is the pin's
// planted environment — the one it would see if jsdom ever learned to decide contrast.

import { describe, expect, it } from 'vitest';

import { contrastReading, JSDOM_READING } from './support/axe-contrast.js';

describe('axe-core color-contrast in Chromium', () => {
  it('decides the unreadable pair a violation, where the jsdom pin no longer holds', async () => {
    const reading = await contrastReading();
    expect(reading).toEqual({ incomplete: [], violations: ['color-contrast'], passes: [] });
    expect(reading).not.toEqual(JSDOM_READING);
  });
});
