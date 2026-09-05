// Real Svelte/Cytoscape renders of six source-bound candidate labels; no app edits.
// Run: node tools/probe-polarity-render.mjs. Outputs: .scratch/polarity-render/.
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { createServer } from 'vite';

import { launch } from './browser.mjs';

/**
 * @typedef {{
 *   goto(url: string, options: object): Promise<unknown>,
 *   waitForSelector(selector: string, options: object): Promise<unknown>,
 *   evaluate(source: string): Promise<unknown>,
 *   locator(selector: string): { screenshot(options: { path: string }): Promise<unknown> },
 *   close(): Promise<void>,
 *   on: {
 *     (event: 'pageerror', handler: (error: Error) => void): void;
 *     (event: 'response', handler: (response: { status(): number, url(): string }) => void): void;
 *   }
 * }} ProbePage
 * @typedef {{ id: string, dataLabel: string, drawnLabel: string, lineStyle: string,
 *   arrow: string, width: string, fontSize: string, textWidth: number, textHeight: number }} LabelBox
 * @typedef {{ mode: string, nodes: number, edges: number, nodePositionsUnchanged: boolean,
 *   beforeFit: number, afterFit: number, htmlRowHeight: number, htmlLabelWidth: number,
 *   htmlLabelText: string, documentWidth: number, viewportWidth: number,
 *   boxes: LabelBox[], png: string }} RenderMetric
 */

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, '.scratch/polarity-render');
mkdirSync(OUT, { recursive: true });
rmSync(join(OUT, 'measurements.json'), { force: true });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Polarity rendering probe</title></head><body><main id="probe" style="max-width:1140px;margin:0 auto;width:calc(100% - 32px)"></main><script type="module">
import '/src/app.css';
import { mount } from 'svelte';
import SemanticGraph from '/src/graph/SemanticGraph.svelte';
const fonts = await Promise.all([
  document.fonts.load('600 10px "Atkinson Hyperlegible Next"'),
  document.fonts.load('700 12px "Atkinson Hyperlegible Mono"')
]);
if (fonts.some(group => group.length === 0)) throw new Error('probe fonts unavailable');
mount(SemanticGraph, { target: document.querySelector('#probe'), props: {
  graphUrl: '/kb/generated/graph/semantic-graph.json',
  focusRequest: 1,
  focus: {
    document: 'cdc2022-opioid-rec01', sentences: [3],
    question: 'When should clinicians consider opioid therapy for pain?',
    answer: 'If an opioid benefit does not outweigh an opioid risk, clinicians should not consider opioid therapy for acute pain.'
  }
}});
</script></body></html>`;
const server = await createServer({
  root: ROOT,
  cacheDir: join(OUT, 'vite-cache'),
  server: {
    host: '127.0.0.1',
    port: 0,
    fs: { allow: [ROOT, realpathSync(join(ROOT, 'node_modules'))] },
  },
  plugins: [
    {
      name: 'polarity-probe-page',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] !== '/__polarity') return next();
          void vite.transformIndexHtml('/__polarity', html).then((page) => {
            response.setHeader('content-type', 'text/html');
            response.end(page);
          });
        });
      },
    },
  ],
});
let browser;
/** @param {Uint8Array} bytes */
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
try {
  await server.listen();
  const address = server.httpServer?.address();
  assert(address && typeof address === 'object');
  browser = await launch((message) => {
    throw new Error(message);
  });
  const results = [];
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 320, height: 720 },
  ]) {
    const page = /** @type {ProbePage} */ (
      /** @type {unknown} */ (await browser.newPage({ viewport }))
    );
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`http://127.0.0.1:${address.port}/__polarity`, {
      waitUntil: 'load',
      timeout: 60_000,
    });
    await page.waitForSelector('.canvas canvas', { timeout: 60_000 });
    await page.evaluate(`(async () => {
      await document.fonts.ready;
      const cy = document.querySelector('.canvas')._cyreg.cy;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const labels = {
        'edge:506:8': 'if not outweigh · actor: an',
        'edge:506:9': 'if not outweigh · target: an',
        'edge:512:12': 'if not outweigh → should not consider',
        'edge:513:0': 'then should not consider · actor: every',
        'edge:514:0': 'then should not consider · target: an',
        'edge:515:0': 'then should not consider · for: an'
      };
      const source = 'If an opioid benefit does not outweigh an opioid risk, every clinician should not consider an opioid therapy for an acute pain.';
      const baseStyle = cy.style().json();
      for (const rule of baseStyle) {
        const css = rule.style ?? rule.css;
        if (/^[0-9]+$/.test(String(css['font-weight']))) css['font-weight'] = Number(css['font-weight']);
      }
      const baseElements = cy.elements().map(e => ({ id: e.id(), data: { ...e.data() }, classes: e.classes() }));
      const baseZoom = cy.zoom();
      const basePan = { ...cy.pan() };
      const basePositions = cy.nodes().map(n => ({ id: n.id(), position: { ...n.position() } }));
      const htmlLabel = document.querySelector('.relations li .relation');
      const baseHtml = htmlLabel.textContent;
      const pathRule = baseStyle.find(style => style.selector === 'edge.path');
      const pathLabelStyle = pathRule.style ?? pathRule.css;
      if (!pathLabelStyle?.label) throw new Error('missing edge.path label style');
      window.polarityProbe = { cy, labels, source, baseStyle, baseElements, baseZoom, basePan, basePositions, htmlLabel, baseHtml, pathLabelStyle };
    })()`);
    const modes = [
      'baseline',
      'fields-only',
      'class-only',
      'words',
      'words-dashed',
      'words-barred',
      'words-width',
      'ordinary-baseline',
      'ordinary-data-words',
      'ordinary-words',
    ];
    /** @type {(RenderMetric & { pngSha256: string })[]} */
    const measures = [];
    for (const mode of modes) {
      const metric = /** @type {RenderMetric} */ (
        await page.evaluate(`(async () => {\n        const mode = ${JSON.stringify(mode)};
        const p = window.polarityProbe;
        const {cy} = p;
        cy.batch(() => {
          cy.style(p.baseStyle);
          for (const saved of p.baseElements) {
            const e = cy.getElementById(saved.id);
            e.removeStyle();\n            e.data(saved.data);
            e.removeData('scope');
            e.classes(saved.classes);
          }
          cy.zoom(p.baseZoom);
          cy.pan(p.basePan);
          p.htmlLabel.textContent = p.baseHtml;
          const ordinary = mode.startsWith('ordinary');
          if (ordinary) cy.elements().removeClass('path context');
          for (const [id, label] of Object.entries(p.labels)) {
            const edge = cy.getElementById(id);
            if (mode === 'fields-only') edge.data('scope', { polarity: 'negative', modality: 'should' });
            if (mode === 'class-only') edge.addClass('negative');
            if (mode.includes('words')) edge.data('label', label);
            if (mode === 'words-dashed') edge.style('line-style', 'dashed');
            if (mode === 'words-barred') edge.style('target-arrow-shape', 'triangle-tee');
            if (mode === 'words-width') edge.style('width', 4);
            if (mode === 'ordinary-words') edge.addClass('probe-scope');
          }
          if (mode === 'ordinary-words') cy.style([...p.baseStyle, { selector: 'edge.probe-scope', style: p.pathLabelStyle }]);
          if (mode.includes('words')) p.htmlLabel.textContent = p.source + ' Target of:';
        });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const beforeFit = cy.zoom();
        const boxes = Object.keys(p.labels).map(id => {
          const edge = cy.getElementById(id);
          return {
            id, dataLabel: edge.data('label'), drawnLabel: edge.style('label'),
            lineStyle: edge.style('line-style'), arrow: edge.style('target-arrow-shape'), width: edge.style('width'),
            fontSize: edge.style('font-size'),
            textWidth: edge.style('label') ? edge._private.rscratch.labelWidth ?? 0 : 0,
            textHeight: edge._private.rscratch.labelHeight ?? 0
          };
        });
        const nodePositionsUnchanged = p.basePositions.every(saved => {
          const now = cy.getElementById(saved.id).position();
          return saved.position.x === now.x && saved.position.y === now.y;
        });
        cy.fit(cy.elements(), 32);
        const afterFit = cy.zoom();
        cy.zoom(p.baseZoom); cy.pan(p.basePan);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          mode, nodes: cy.nodes().length, edges: cy.edges().length,
          nodePositionsUnchanged, beforeFit, afterFit,
          htmlRowHeight: p.htmlLabel.closest('li').getBoundingClientRect().height,
          htmlLabelWidth: p.htmlLabel.getBoundingClientRect().width,
          htmlLabelText: p.htmlLabel.textContent,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          boxes,
          png: cy.png({ output: 'base64', bg: getComputedStyle(document.querySelector('.canvas-frame')).backgroundColor, scale: 1 })
        };
      })()`)
      );
      const { png, ...rest } = metric;
      const image = Buffer.from(png, 'base64');
      const file = `${viewport.width}-${mode}.png`;
      writeFileSync(join(OUT, file), image);
      measures.push({ ...rest, png: file, pngSha256: digest(image) });
      if (mode === 'baseline' || mode === 'words')
        await page
          .locator('.html-graph')
          .screenshot({ path: join(OUT, `${viewport.width}-${mode}-html.png`) });
    }
    /** @param {number} index */
    const imageAt = (index) => {
      const row = measures[index];
      assert(row, `missing measurement ${index}`);
      return row.pngSha256;
    };
    assert.equal(imageAt(0), imageAt(1), 'inert edge fields must not change pixels');
    assert.equal(imageAt(0), imageAt(2), 'an unstyled class must not change pixels');
    assert.equal(imageAt(7), imageAt(8), 'unlabelled edges must ignore changed data labels');
    assert.notEqual(
      imageAt(8),
      imageAt(9),
      'a label selector must expose ordinary-edge qualifiers',
    );
    assert(
      measures.every((row) => row.nodePositionsUnchanged),
      'style/data mutations must preserve positions',
    );
    assert.deepEqual(errors, []);
    results.push({ viewport, errors, measures });
    await page.close();
  }
  writeFileSync(join(OUT, 'measurements.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(
    JSON.stringify(
      results.map(({ viewport, errors, measures }) => ({
        viewport,
        errors,
        measures: measures.map(
          ({
            mode,
            nodePositionsUnchanged,
            beforeFit,
            afterFit,
            htmlRowHeight,
            documentWidth,
            boxes,
            pngSha256,
          }) => ({
            mode,
            nodePositionsUnchanged,
            beforeFit,
            afterFit,
            htmlRowHeight,
            documentWidth,
            longestLabel: Math.max(...boxes.map((box) => box.textWidth)),
            pngSha256,
          }),
        ),
      })),
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
