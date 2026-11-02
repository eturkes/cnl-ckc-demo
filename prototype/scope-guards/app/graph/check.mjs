import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const base = '/prototype/scope-guards/app/graph/';
  const { SemanticGraphModel, parseSemanticGraph, scopeReading } = await server.ssrLoadModule(base + 'model.ts');
  const { project, HUB, ACT } = await server.ssrLoadModule(base + 'project.ts');
  const { edgeViewsOf, edgeLabelFrom } = await server.ssrLoadModule(base + 'view.ts');
  const raw = JSON.parse(await readFile('kb/generated/graph/semantic-graph.json', 'utf8'));
  const m = new SemanticGraphModel(parseSemanticGraph(raw), project);
  assert.equal(m.searchConcepts('CDC 2022')[0].id, HUB);
  assert.equal(m.conceptIncident(HUB).length, 8);
  const hubExpected = new Map([
    ['age', 'age less than 18 years'],
    ['sickle-cell-disease-pain', 'sickle cell disease pain'],
    ['cancer-related-pain', 'cancer related pain'],
    ['palliative-care', 'palliative care'],
    ['end-of-life-care', 'end of life care'],
    ['hospital-care', 'hospital care, unless the patient is proved to receive a pain management prescription at facility discharge'],
    ['emergency-department-care', 'emergency department care, unless the patient is proved to receive a pain management prescription at facility discharge'],
    ['observational-setting-care', 'observational setting care with possible inpatient admission, unless the patient is proved to receive a pain management prescription at facility discharge'],
  ]);
  const hubViews = edgeViewsOf(m.conceptNeighborhood(HUB,1,Infinity,[],[],Infinity),null);
  for (const [noun, text] of hubExpected) {
    const edge = hubViews.find(e => e.source === HUB && e.target === `entity:${noun}`);
    assert(edge, `missing hub condition ${noun}`);
    assert.equal(edgeLabelFrom(edge,HUB), `excluded when ${text}`);
    assert.equal(edgeLabelFrom(edge,edge.target), `excludes these recommendations when ${text}`);
  }
  const projectionSource = await readFile('prototype/scope-guards/app/graph/project.ts','utf8');
  assert(!/s7-02|age less|observational|18|pain-management|hospital-care|facility-discharge|possible-inpatient|\bpatient\b/.test(projectionSource));
  // A changed bag must move the rendered condition, not preserve this bag's vocabulary/bound.
  const changed = JSON.parse(await readFile('prototype/scope-guards/generated/records.json','utf8'));
  changed.exclusions.forEach((record,index) => {
    record.document = `probe-document-${index}`;
    for (const group of record.body) for (const literal of group.literals) {
      if (literal.name === 'guideline_entity' || literal.name === 'guideline_event') literal.args[2] = `probe-${literal.args[2].replaceAll("'",'')}`;
      if (literal.name === 'guideline_satisfies') {
        literal.args[3] = 'greater'; literal.args[4] = '42'; literal.args[5] = 'week';
      }
      if (literal.name === 'guideline_pp') literal.args[2] = 'beside';
    }
  });
  const moved = new SemanticGraphModel(parseSemanticGraph(raw), data => project(data,changed));
  const movedViews = edgeViewsOf(moved.conceptNeighborhood(HUB,1,Infinity,[],[],Infinity),null);
  assert.equal(movedViews.length,8);
  const movedLabels = movedViews.map(e => edgeLabelFrom(e,HUB));
  assert(movedLabels.every(text => text.includes('probe')));
  assert(movedLabels.some(text => text.includes('probe age greater than 42 weeks')));
  assert(movedLabels.some(text => text.includes('beside probe possible inpatient admission')));
  assert(movedLabels.some(text => text.includes('unless the probe patient is proved to probe receive a probe pain management prescription beside probe facility discharge')));
  for (const edge of movedViews) assert.equal(edgeLabelFrom(edge,edge.target), edgeLabelFrom(edge,HUB).replace('excluded when','excludes these recommendations when'));
  const conditions = m.data.edges.filter(e => e.id.startsWith('exclusion:'));
  assert.equal(conditions.length, 36);
  assert.equal(conditions.filter(e => e.scopeOperators.join(',') === 'excluded,-').length, 9);
  assert(conditions.every(e => e.scopeOperators[0] === 'excluded'));
  const scene = id => m.conceptNeighborhood(id, 1, Infinity, [], [], Infinity);
  const pall = edgeViewsOf(scene('entity:palliative-care'), null);
  assert(pall.some(e => e.source === HUB || e.target === HUB));
  assert(pall.some(e => e.scope.includes('excluded')));
  assert(pall.filter(e => e.scope.includes('excluded')).every(e => !e.dashed));
  const waiver = edgeViewsOf(scene('superseded:1:obtain'), null);
  assert(waiver.some(e => e.source === ACT || e.target === ACT));
  assert(waiver.some(e => e.relation === 'condition bound'));
  assert(waiver.some(e => e.guarded && edgeLabelFrom(e, 'superseded:1:obtain').includes('unless excluded')));
  assert.equal(m.data.edges.filter(e => e.id.startsWith('evaluation:')).length, 3);
  assert.deepEqual(scopeReading(['excluded','-'], ['excluded','-'], false), {near:['excluded','-'],far:['excluded','-']});
  const exception = edgeViewsOf(scene('entity:pain-management-prescription'), null);
  assert(exception.some(e => e.dashed && edgeLabelFrom(e, 'entity:pain-management-prescription').includes('excludes the guideline · not provably')));
  assert(scene(HUB).nodes.every(n => n.kind !== 'operator-context'));
  console.log('combined-graph: 8 full hub conditions at both endpoints + changed-bag vocabulary/bound/PP probes; 36 exclusion occurrences (9 nested negative), 3 historical bounds; search, labels, Act, selected guard passed');
} finally { await server.close(); }
