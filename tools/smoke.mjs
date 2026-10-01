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

import { readdirSync, readFileSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { expectedAnswer } from './answer-oracle.mjs';
import { failWith, withBuiltSite } from './browser.mjs';
import { requireFiring } from './control.mjs';
import { sha256, verifyBag } from './kb/bag.mjs';
import { loadManifest, payloadSource, ROOT } from './kb/paths.mjs';

const QUESTION = 'when-to-use-opioids';
const NESTED = 'some/nested';
/** The firing input: the same build served with its hashed saved state removed. */
const STRIPPED = 'some/stripped';

/** @type {(message: string) => never} */
const fail = failWith('smoke');

/**
 * The lane's boot grader: the page must reach `ready`. Waiting for either terminal state
 * names a boot-error at once instead of letting it run out a 45 s timeout.
 *
 * @param {import('./browser.mjs').Page} page
 * @param {string} at
 * @returns {Promise<string | undefined>} the refusal, when the engine did not boot
 */
const bootRefusal = async (page, at) => {
  await page.waitForSelector('[data-engine="ready"], [data-engine="error"]', { timeout: 45_000 });
  return (await page.locator('[data-engine="error"]').count()) > 0
    ? `${at}: the engine reached boot-error instead of ready`
    : undefined;
};

/**
 * Why the served build is stale against the bag, if it is.
 *
 * `pnpm build` copies whatever `kb/generated` holds, so a skipped `pnpm kb:build` ships a page
 * that boots and answers from an older knowledge base. The manifest must record the input digest
 * the bag yields NOW, and the served saved state must be the bytes that manifest records.
 *
 * @param {string} dist
 * @param {string} inputDigest
 * @param {import('./kb/paths.mjs').KbManifest} manifest
 * @param {(path: string) => Uint8Array} [read]
 * @returns {string[]}
 */
const staleness = (dist, inputDigest, manifest, read = (path) => readFileSync(path)) => {
  /** @type {string[]} */
  const failures = [];
  if (manifest.input.sha256 !== inputDigest) {
    failures.push(
      `kb/generated was built from input ${manifest.input.sha256.slice(0, 12)}, ` +
        `the bag now yields ${inputDigest.slice(0, 12)}; run pnpm kb:build`,
    );
  }
  const record = manifest.assets.find((asset) => asset.kind === 'pvm');
  const served = readdirSync(join(dist, 'assets')).filter((name) => /^kb-.+\.pvm$/u.test(name));
  const [pvm] = served;
  if (record === undefined || pvm === undefined || served.length !== 1) {
    failures.push(`expected one served saved state, found ${String(served.length)}`);
  } else if (sha256(read(join(dist, 'assets', pvm))) !== record.sha256) {
    failures.push(`served ${pvm} is not the saved state the manifest records`);
  }
  return failures;
};

const expected = expectedAnswer(QUESTION, fail);

await withBuiltSite(
  { tool: 'smoke', fail, nested: NESTED },
  async ({ root, origin, url, log, browser }) => {
    const manifest = loadManifest();
    if (manifest === undefined) fail('no build manifest; run pnpm kb:build');
    const bags = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
    if (bags.length !== 1) fail(`expected one vendored bag in kb/, found ${String(bags.length)}`);
    const { files } = verifyBag(readFileSync(join(ROOT, 'kb', /** @type {string} */ (bags[0]))));
    const inputDigest = sha256(Buffer.from(payloadSource(files).source, 'utf8'));
    const dist = join(ROOT, 'dist');
    const staleControls = [
      requireFiring(
        'smoke',
        { mutation: 'the manifest input digest altered', expect: ['was built from input'] },
        () =>
          staleness(dist, inputDigest, {
            ...manifest,
            input: { ...manifest.input, sha256: `0${manifest.input.sha256.slice(1)}` },
          }),
      ),
      requireFiring(
        'smoke',
        {
          mutation: 'one byte of the served saved state flipped',
          expect: ['is not the saved state the manifest records'],
        },
        () =>
          staleness(dist, inputDigest, manifest, (path) => {
            const bytes = new Uint8Array(readFileSync(path));
            bytes[0] = (bytes[0] ?? 0) ^ 0xff;
            return bytes;
          }),
      ),
    ];
    const stale = staleness(dist, inputDigest, manifest);
    if (stale.length > 0) fail(`stale build: ${stale.join('; ')}`);

    /** @type {string | undefined} */
    let raised;
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => {
      raised ??= `page raised ${error.message}`;
    });

    // Control first, on the lane's own grader: a build whose saved state is gone must be refused.
    const stripped = join(root, STRIPPED);
    await cp(join(ROOT, 'dist'), stripped, { recursive: true });
    for (const name of readdirSync(join(stripped, 'assets'))) {
      if (/^kb-.+\.pvm$/u.test(name)) await rm(join(stripped, 'assets', name));
    }
    const strippedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await strippedPage.goto(`${origin}/${STRIPPED}/`, {
      waitUntil: 'load',
      timeout: 45_000,
    });
    const controlRefusal = await bootRefusal(strippedPage, 'pvm-stripped copy');
    if (controlRefusal === undefined)
      fail('control did not fire: a build without its saved state booted');

    await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    const refusal = await bootRefusal(page, 'built output');
    if (refusal !== undefined) fail(refusal);

    await page.locator('[role="combobox"]').click();
    await page.locator(`[role="option"][id$="-option-${QUESTION}"]`).click();
    await page.locator('[data-action="run"]').click();

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
    const findInGraph = page.locator('[data-action="find-in-graph"]');
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
    if ((await page.locator('[data-action="explore-graph"]').count()) !== 0)
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

    const broken = log.filter(
      (entry) => entry.status !== 200 && entry.path.startsWith(`/${NESTED}`),
    );
    if (broken.length > 0) fail(`nested assets missing: ${broken.map((e) => e.path).join(', ')}`);
    if (raised !== undefined) fail(raised);

    const served = log.filter((entry) => entry.status === 200).length;
    console.log(
      `smoke: ok — ${url} combined ${String(expected.rows)} Prolog solutions into ` +
        `${String(bullets)} cited deterministic statements, ` +
        `${served} nested requests served, saved state current with bag input ` +
        `${inputDigest.slice(0, 12)}; controls: ${staleControls.join(', ')}, a pvm-stripped copy refused at boot`,
    );
  },
);
