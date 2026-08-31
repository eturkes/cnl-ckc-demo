import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use(fcose);

const NODE_COUNTS = { noun: 800, verb: 127, document: 337 };
const nodeCount = Object.values(NODE_COUNTS).reduce((sum, count) => sum + count, 0);
const edgeCount = nodeCount * 3;
let seed = 0x5eed1234;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
const nodes = [];
let index = 0;
for (const [kind, count] of Object.entries(NODE_COUNTS)) {
  for (let i = 0; i < count; i++, index++) {
    nodes.push({
      data: { id: `n${index}`, kind, label: `${kind} ${i}` },
      position: { x: (index % 40) * 20, y: Math.floor(index / 40) * 20 },
    });
  }
}
const edges = [];
for (let i = 0; i < edgeCount; i++) {
  const source = i < nodeCount - 1 ? i : Math.floor(random() * nodeCount);
  let target = i < nodeCount - 1 ? i + 1 : Math.floor(random() * nodeCount);
  if (target === source) target = (target + 1) % nodeCount;
  edges.push({ data: { id: `e${i}`, source: `n${source}`, target: `n${target}`, predicate: `p${i % 316}` } });
}

const raf = () => new Promise((resolve) => requestAnimationFrame(resolve));
const afterPaint = async () => { await raf(); await raf(); };
const createdAt = performance.now();
const cy = cytoscape({
  container: document.querySelector('#cy'),
  elements: [...nodes, ...edges],
  layout: { name: 'preset', fit: true, padding: 24 },
  pixelRatio: 1,
  hideEdgesOnViewport: true,
  textureOnViewport: true,
  style: [
    { selector: 'node', style: { width: 8, height: 8, 'background-color': '#2f7974', label: '' } },
    { selector: 'node[kind = "verb"]', style: { 'background-color': '#bd7048', shape: 'diamond' } },
    { selector: 'node[kind = "document"]', style: { 'background-color': '#5b6ea6', shape: 'round-rectangle' } },
    { selector: 'edge', style: { width: 0.7, opacity: 0.28, 'line-color': '#5f7476', 'curve-style': 'straight' } },
    { selector: ':selected', style: { label: 'data(label)', 'font-size': 11, 'text-background-opacity': 0.9, 'text-background-color': '#ffffff' } },
  ],
});

await new Promise((resolve) => cy.ready(resolve));
await afterPaint();
const firstPaintMs = performance.now() - createdAt;
const layout = cy.layout({
  name: 'fcose',
  quality: 'draft',
  randomize: true,
  animate: false,
  fit: true,
  padding: 24,
  nodeDimensionsIncludeLabels: false,
  uniformNodeDimensions: true,
  sampleSize: 25,
  nodeRepulsion: 4500,
  idealEdgeLength: 55,
  numIter: 1500,
});
const layoutDone = new Promise((resolve) => layout.one('layoutstop', resolve));
const layoutStarted = performance.now();
layout.run();
await layoutDone;
const layoutMs = performance.now() - layoutStarted;
await afterPaint();
const layoutPaintMs = performance.now() - layoutStarted;

const baseZoom = cy.zoom();
const basePan = cy.pan();
const frameIntervals = [];
let previous = performance.now();
for (let frame = 0; frame < 140; frame++) {
  await raf();
  const now = performance.now();
  if (frame >= 20) frameIntervals.push(now - previous);
  previous = now;
  const phase = frame / 14;
  cy.viewport({
    zoom: baseZoom * (1 + 0.08 * Math.sin(phase)),
    pan: { x: basePan.x + 32 * Math.sin(phase), y: basePan.y + 24 * Math.cos(phase) },
  });
}
frameIntervals.sort((a, b) => a - b);
const percentile = (p) => frameIntervals[Math.min(frameIntervals.length - 1, Math.floor(frameIntervals.length * p))];
const result = {
  userAgent: navigator.userAgent,
  viewport: `${innerWidth}x${innerHeight}`,
  nodes: cy.nodes().length,
  edges: cy.edges().length,
  firstPaintMs: +firstPaintMs.toFixed(1),
  fcoseDraftLayoutMs: +layoutMs.toFixed(1),
  layoutAndPaintMs: +layoutPaintMs.toFixed(1),
  panZoomFrames: frameIntervals.length,
  panZoomMedianMs: +percentile(0.5).toFixed(1),
  panZoomP95Ms: +percentile(0.95).toFixed(1),
  panZoomMaxMs: +frameIntervals.at(-1).toFixed(1),
  panZoomOver25Ms: frameIntervals.filter((ms) => ms > 25).length,
};
document.querySelector('#result').textContent = JSON.stringify(result, null, 2);
document.body.dataset.done = 'true';
console.log(result);
