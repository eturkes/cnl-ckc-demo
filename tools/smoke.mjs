#!/usr/bin/env node
// Real-browser proof that the shipped static build answers a question.
//
// Everything else in the gate runs the engine under Node. This is the only check
// that exercises the built bundle, the module worker, the hashed PVM fetch and
// the rendered answer together, and it serves them from a NESTED path because
// `base: './'` is the whole reason a nested static host works at all.
//
// The oracle is read out of the vendored bag at run time rather than written
// here, so the expectation cannot drift from the knowledge base it claims to
// reproduce.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { failWith, launch, serve } from './browser.mjs';
import { verifyBag } from './kb/bag.mjs';
import { ROOT } from './kb/paths.mjs';

const QUESTION = 'dosage-reduction-content';
const NESTED = 'some/nested';

/** @type {(message: string) => never} */
const fail = failWith('smoke');

/**
 * The bag's own recorded answer for `id`, unwrapped from its `result(...)` envelope.
 *
 * @param {string} id
 * @returns {string}
 */
const committedAnswer = (id) => {
  const kb = join(ROOT, 'kb');
  const archive = readdirSync(kb).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) fail('no bag archive in kb/');
  const { files } = verifyBag(readFileSync(join(kb, archive)));
  const path = [...files.keys()].find((name) => name.endsWith(`/answers/${id}.pl`));
  const bytes = path === undefined ? undefined : files.get(path);
  if (bytes === undefined) fail(`bag has no committed answer for ${id}`);
  const text = Buffer.from(bytes).toString('utf8');
  const open = text.indexOf('result(') + 'result('.length;
  let depth = 1;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')' && (depth -= 1) === 0) return text.slice(open, i);
  }
  return fail(`committed answer for ${id} is unbalanced`);
};

if (!existsSync(join(ROOT, 'dist', 'index.html'))) execFileSync('pnpm', ['build'], { cwd: ROOT });

const expected = committedAnswer(QUESTION);
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

  // The canonical answer ships behind a disclosure, so a visibility wait needs
  // it open first. Opening it is also what proves the control works.
  await page.locator('.canonical summary').click();

  const answer = page.locator('section[aria-labelledby] .canonical code');
  await answer.waitFor({ timeout: 45_000 });
  const rendered = (await answer.textContent())?.trim();
  if (rendered !== expected) {
    fail(`rendered answer differs from the bag\n  bag: ${expected}\n  dom: ${String(rendered)}`);
  }

  const rows = await page.locator('section[aria-labelledby] fieldset input[type="radio"]').count();
  if (rows !== 2) fail(`expected 2 answer rows, rendered ${rows}`);
  if ((await page.locator('[data-engine="error"]').count()) > 0)
    fail('the engine reported an error');

  const broken = log.filter((entry) => entry.status !== 200 && entry.path.startsWith(`/${NESTED}`));
  if (broken.length > 0) fail(`nested assets missing: ${broken.map((e) => e.path).join(', ')}`);
  if (raised !== undefined) fail(raised);

  const served = log.filter((entry) => entry.status === 200).length;
  console.log(
    `smoke: ok — ${url} answered ${QUESTION} with ${rows} rows matching the bag, ` +
      `${served} nested requests served`,
  );
} finally {
  await browser?.close();
  server.close();
  await rm(root, { recursive: true, force: true });
}
