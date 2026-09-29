#!/usr/bin/env node
// Live two-server check (`.agent/contracts/m5u16.md` X3): the running Vite page plus the local
// judgment Worker answer one description in a real browser. Keyed and networked, so it stays
// outside the gate. Start `pnpm intake:dev` and `pnpm dev` first, then `pnpm intake:live`.
// It fails unless the description is answered with at least one Prolog-derived row and
// "Show derivation" lands on the answer region.

import { failWith, launch } from './browser.mjs';

const PAGE = process.env.INTAKE_LIVE_URL ?? 'http://localhost:5173/';
const DESCRIPTION =
  'Chronic low back pain for two years on long-term opioid therapy; also taking a ' +
  'benzodiazepine for anxiety and waking up gasping at night.';

/** @type {(message: string) => never} */
const fail = failWith('intake:live');

const browser = await launch(fail);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(PAGE, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(
    "document.querySelector('main')?.dataset.engine === 'ready'",
    undefined,
    {
      timeout: 120_000,
    },
  );
  await page.locator('#intake-description').fill(DESCRIPTION);
  await page.locator('form[data-intake] button[type="submit"]').click();
  await page.waitForSelector('[data-intake-outcome]', { timeout: 90_000 });
  const outcome = await page.locator('[data-intake-outcome]').getAttribute('data-intake-outcome');
  const derived = await page.locator('[data-intake-text]').count();
  const gaps = await page.locator('[data-intake-gaps] li').count();
  if (outcome !== 'answered' || derived === 0) {
    fail(
      `expected an answered outcome with derived rows, got ${String(outcome)} with ${String(derived)}`,
    );
  }
  await page.locator('[data-intake-reveal]').first().click();
  await page.waitForFunction(
    "document.querySelector('.answer-region')?.getAttribute('aria-busy') === 'false' && " +
      "document.querySelector('.answer-point') !== null && " +
      "document.querySelector('[data-intake-reveal-note]') === null",
    undefined,
    { timeout: 90_000 },
  );
  if (errors.length > 0) fail(`page errors: ${errors.join(' | ')}`);
  process.stdout.write(
    `intake:live — answered, ${String(derived)} derived rows, ${String(gaps)} judged gaps, ` +
      'reveal reached the answer region, 0 page errors\n',
  );
} finally {
  await browser.close();
}
