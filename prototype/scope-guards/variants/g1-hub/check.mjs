import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({server:{middlewareMode:true}});
try {
  const { augmentGraph, HUB, ACT } = await server.ssrLoadModule('/prototype/scope-guards/variants/g1-hub/augment.ts');
  const { parseSemanticGraph, SemanticGraphModel, graphRelationLabel } = await server.ssrLoadModule('/prototype/scope-guards/variants/g1-hub/graph/model.ts');
  const raw = JSON.parse(await readFile('kb/generated/graph/semantic-graph.json', 'utf8'));
  const records = JSON.parse(await readFile('prototype/scope-guards/generated/records.json', 'utf8'));
  const data = parseSemanticGraph(augmentGraph(raw));
  const model = new SemanticGraphModel(data);
  assert.equal(records.exclusions.length,12);
  for (const r of records.exclusions) assert(data.edges.some(e=>e.target===HUB && e.document===r.document && e.sentence===r.sentence));
  for (const r of records.supersessions) assert(data.edges.some(e=>e.target===ACT && e.sentence===r.sentence));
  assert(model.searchConcepts('CDC 2022').some(n=>n.id===HUB));
  const hospital = data.edges.find(e=>e.target===HUB && e.source==='exclusion-concept:hospital care');
  assert.match(hospital.label,/unless/);
  const observational = data.edges.find(e=>e.target===HUB && e.source==='exclusion-concept:observational setting care');
  assert.match(observational.label,/possible inpatient admission/);
  const prescription = model.conceptIncident('exclusion-concept:pain management prescription');
  assert(prescription.some(e=>e.scopeOperators?.includes('-')));
  assert(data.edges.some(e=>e.kind==='threshold' && e.target==='exclusion:0:bound'));
  const waiver = model.conceptIncident('scope-event:1:obtain');
  assert(waiver.some(e=>graphRelationLabel(e).includes('[superseded]')));
  assert(waiver.some(e=>e.target==='scope:evaluation-before'));
  const neighborhood = model.conceptNeighborhood(HUB,2,240);
  assert(neighborhood.nodes.every(n=>n.kind!=='operator-context'));
  console.log(`g1-check: 12 exclusions, ${records.supersessions.length} supersessions; search, exception polarity, age bound, date bound, historical state and concept projection pass`);
} finally { await server.close(); }
