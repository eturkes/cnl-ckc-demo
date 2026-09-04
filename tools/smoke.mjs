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

  // The proof-to-graph action is itself explicit graph activation. One click
  // must load the lazy asset, move to the graph, and isolate the controlled
  // sentences behind the selected answer contribution.
  const graphAsset = /semantic-graph-.+\.json$/u;
  if (log.some((entry) => graphAsset.test(entry.path)))
    fail('the semantic graph loaded before the proof-to-graph action');
  const findInGraph = page.getByRole('button', { name: /Find in graph/iu });
  await findInGraph.waitFor({ timeout: 45_000 });
  await findInGraph.click();
  const graphFocus = page.locator('.graph-shell .evidence-focus');
  await graphFocus.waitFor({ timeout: 45_000 });
  await page.waitForSelector('.graph-shell .evidence-focus:focus', { timeout: 45_000 });
  const focusText = (await graphFocus.textContent()) ?? '';
  if (!/opioid therapy is the primary concept/iu.test(focusText))
    fail('the graph did not identify opioid therapy as the primary answer concept');
  if (!/Orange paths are the [1-9]\d*\s+relationships?/u.test(focusText))
    fail('the graph did not explain the proof-backed answer highlight');
  if (!(await page.locator('.graph-shell .view-status').textContent())?.includes('highlighted'))
    fail('the graph opened without a highlighted answer path');
  const selectedConcept = (
    (await page.locator('.graph-shell .selection-card h3').textContent()) ?? ''
  ).trim();
  if (selectedConcept !== 'opioid therapy')
    fail(`the graph selected ${selectedConcept || 'nothing'} instead of opioid therapy`);
  const selectedKind = (
    (await page.locator('.graph-shell .selection-card .kind').textContent()) ?? ''
  ).trim();
  if (selectedKind !== 'Primary concept') fail('the graph did not mark its primary focus');
  const nodeIndex = (await page.locator('.graph-shell .node-index').textContent()) ?? '';
  if (/\bshould\b/iu.test(nodeIndex)) fail('the concept map exposed a grammatical modality node');
  if ((await page.getByRole('button', { name: 'Explore graph' }).count()) !== 0)
    fail('the proof-to-graph action stopped at the graph activation prompt');
  if (!log.some((entry) => graphAsset.test(entry.path)))
    fail('the proof-to-graph action requested no semantic graph data');
  const focusTop = Number(
    await page.evaluate(
      "document.querySelector('.graph-shell .evidence-focus').getBoundingClientRect().top",
    ),
  );
  if (focusTop < 50 || focusTop > 180)
    fail(`the answer evidence focus did not land below the header (${String(focusTop)}px)`);

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
