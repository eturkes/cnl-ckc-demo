#!/usr/bin/env node
// Real-browser proof that the shipped static build answers a question.
//
// Everything else in the gate runs the engine under Node. This is the only check
// that exercises the built bundle, the module worker, the hashed PVM fetch and
// the rendered answer together, and it serves them from a NESTED path because
// `base: './'` is the whole reason a nested static host works at all.
//
// The expected terms are re-derived from the vendored bag at run time, so
// the check cannot drift from the knowledge base it claims to reproduce.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { failWith, launch, serve } from './browser.mjs';
import { verifyBag } from './kb/bag.mjs';
import { clinicalArtifacts } from './kb/clinical.mjs';
import { ROOT } from './kb/paths.mjs';

const QUESTION = 'when-to-use-opioids';
const NESTED = 'some/nested';

/** @type {(message: string) => never} */
const fail = failWith('smoke');

/**
 * Canonical answer expected from the structured clinical terms derived from the bag.
 *
 * @param {string} id
 * @returns {{ serialized: string, rows: number }}
 */
const expectedAnswer = (id) => {
  const kb = join(ROOT, 'kb');
  const archive = readdirSync(kb).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) fail('no bag archive in kb/');
  const { files } = verifyBag(readFileSync(join(kb, archive)));
  const terms = clinicalArtifacts(files).answers.get(id);
  if (terms === undefined || terms.length === 0) {
    fail(`clinical catalog has no answer terms for ${id}`);
  }
  const rows = [...terms].sort().map((term) => `sol([${term}])`);
  return { serialized: `solutions([${rows.join(',')}])`, rows: terms.length };
};

// Never trust a leftover dist tree: this check proves the current source.
execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' });

const expected = expectedAnswer(QUESTION);
const root = await mkdtemp(join(tmpdir(), 'cnl-ckc-smoke-'));
/** @type {import('./browser.mjs').LogEntry[]} */
const log = [];
const server = await serve(root, log);
const url = `http://127.0.0.1:${server.port}/${NESTED}/`;
/** @type {import('./browser.mjs').Browser | undefined} */
let browser;
/** @type {string | undefined} */
let raised;

try {
  await cp(join(ROOT, 'dist'), join(root, NESTED), { recursive: true });
  browser = await launch(fail);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => {
    raised ??= `page raised ${error.message}`;
  });

  await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForSelector('[data-engine="ready"]', { timeout: 45_000 });

  await page.locator('[role="combobox"]').click();
  await page.locator(`[role="option"][id$="-option-${QUESTION}"]`).click();
  await page.getByRole('button', { name: 'Run' }).click();

  const points = page.locator('section[aria-labelledby] .answer-point');
  await page.waitForSelector('section[aria-labelledby] .answer-point', { timeout: 45_000 });
  if ((await page.locator('.thread .turn').count()) !== 1)
    fail('the answer did not render as one assistant response');
  if ((await page.locator('.question-turn, .assistant-mark').count()) !== 0)
    fail('the response repeated the question or rendered a redundant avatar');
  if ((await page.locator('input[type="radio"]').count()) !== 0)
    fail('source solutions regressed into competing answer choices');
  if ((await page.locator('.explanation').getAttribute('open')) !== null)
    fail('source explanation was expanded before the user requested it');

  // Source mechanics stay behind the answer's explanation disclosure. Opening
  // both layers proves the controls while leaving them secondary in normal use.
  await page.locator('.explanation > summary').click();
  await page.locator('.canonical summary').click();

  const answer = page.locator('section[aria-labelledby] .canonical code');
  await answer.waitFor({ timeout: 45_000 });
  const rendered = (await answer.textContent())?.trim();
  if (rendered !== expected.serialized) {
    fail(
      `rendered answer differs from the bag\n  bag: ${expected.serialized}\n  dom: ${String(rendered)}`,
    );
  }

  const sourceButtons = await page.locator('.source-picker button').count();
  if (sourceButtons !== expected.rows) {
    fail(`expected ${String(expected.rows)} selectable sources, rendered ${sourceButtons}`);
  }
  const bullets = await points.count();
  if (bullets === 0) fail('the structured answer rendered no deterministic advice statements');
  const citations = await page.locator('.answer-point .citations button').count();
  if (citations < expected.rows) fail('the combined answer omitted source citations');
  if ((await page.locator('.source-card blockquote').count()) !== 1)
    fail('the open explanation rendered no exact source passage');
  if ((await page.locator('[data-engine="error"]').count()) > 0)
    fail('the engine reported an error');

  const broken = log.filter((entry) => entry.status !== 200 && entry.path.startsWith(`/${NESTED}`));
  if (broken.length > 0) fail(`nested assets missing: ${broken.map((e) => e.path).join(', ')}`);
  if (raised !== undefined) fail(raised);

  const served = log.filter((entry) => entry.status === 200).length;
  console.log(
    `smoke: ok — ${url} combined ${String(expected.rows)} Prolog solutions into ` +
      `${String(bullets)} cited deterministic statements, ` +
      `${served} nested requests served`,
  );
} finally {
  await browser?.close();
  server.close();
  await rm(root, { recursive: true, force: true });
}
