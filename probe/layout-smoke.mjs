import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import coseBilkent from 'cytoscape-cose-bilkent';
import dagre from 'cytoscape-dagre';
import elk from 'cytoscape-elk';
import fcose from 'cytoscape-fcose';

for (const extension of [cola, coseBilkent, dagre, elk, fcose]) cytoscape.use(extension);

const nodes = Array.from({ length: 30 }, (_, i) => ({ data: { id: `n${i}` } }));
const edges = Array.from({ length: 50 }, (_, i) => ({
  data: { id: `e${i}`, source: `n${i % 30}`, target: `n${(i * 7 + 3) % 30}` },
}));
const options = {
  cola: { name: 'cola', animate: false, maxSimulationTime: 1000 },
  'cose-bilkent': { name: 'cose-bilkent', animate: false, randomize: true },
  dagre: { name: 'dagre', animate: false },
  elk: { name: 'elk', animate: false },
  fcose: { name: 'fcose', animate: false, quality: 'draft', randomize: true },
};

for (const [name, layoutOptions] of Object.entries(options)) {
  const cy = cytoscape({ headless: true, styleEnabled: false, elements: [...nodes, ...edges] });
  const layout = cy.layout(layoutOptions);
  const done = new Promise((resolve) => layout.one('layoutstop', resolve));
  const started = performance.now();
  layout.run();
  await Promise.race([done, new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} timeout`)), 10000))]);
  const finite = cy.nodes().every((node) => Number.isFinite(node.position('x')) && Number.isFinite(node.position('y')));
  console.log(JSON.stringify({ name, ms: +(performance.now() - started).toFixed(1), nodes: cy.nodes().length, finite }));
  cy.destroy();
}
