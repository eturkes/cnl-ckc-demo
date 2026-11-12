// Reproduce label overlap + pain-row invariants against the running variant.
import { launch } from '../../../../tools/browser.mjs';
const browser = await launch(m => { throw new Error(m); });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${process.env.PROTO_ORIGIN ?? 'http://127.0.0.1:5337'}/prototype/graph-overhaul/variants/k1-pain-anchors/#overview`);
  await page.waitForFunction(() => document.body.dataset.ready && window.__cy, null, { timeout: 60000 });
  const result = await page.evaluate(() => {
    const cy = window.__cy;
    const bb = cy.nodes().map(n => n.boundingBox({ includeLabels: true, includeOverlays: false }));
    let overlaps = 0;
    for (let i = 0; i < bb.length; i++) for (let j = i + 1; j < bb.length; j++) {
      const a = bb[i], b = bb[j];
      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) overlaps++;
    }
    const anchors = ['acute-pain', 'subacute-pain', 'chronic-pain'].map(id => ({ id, ...cy.getElementById(id).position() }));
    return { overlaps, nodes: cy.nodes().length, lines: cy.edges().length, anchors, labelPx: cy.zoom() * parseFloat(cy.nodes()[0].style('font-size')) };
  });
  console.log(JSON.stringify(result));
  if (result.overlaps !== 0 || new Set(result.anchors.map(n => n.y)).size !== 1 || !result.anchors.every((n, i, a) => i === 0 || n.x > a[i - 1].x)) process.exitCode = 1;
} finally { await browser.close(); }
