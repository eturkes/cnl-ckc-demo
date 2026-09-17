import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { SemanticGraphModel, graphRelationLabel, parseSemanticGraph } from '../src/graph/model.js';

const ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const ASSET = fileURLToPath(new URL('../kb/generated/graph/semantic-graph.json', import.meta.url));
const REPORT = fileURLToPath(new URL('../.rev-graph-g3-report.json', import.meta.url));

interface SpanningReading {
  caseId: string;
  edgeId: string;
  rendered: string | null;
}

it('binds each spanning-scope browser reading to its declared edge in both directions', () => {
  rmSync(REPORT, { force: true });
  const run = spawnSync(
    process.execPath,
    [join(ROOT, 'tools/graph-check.mjs'), '--report', REPORT],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);

  try {
    const model = new SemanticGraphModel(
      parseSemanticGraph(JSON.parse(readFileSync(ASSET, 'utf8')) as unknown),
    );
    const edge = model.edge('edge:512:12');
    if (edge === undefined) throw new Error('missing edge:512:12');
    const expected = {
      forward: graphRelationLabel(edge, edge.source),
      reverse: graphRelationLabel(edge, edge.target),
    };
    const report = JSON.parse(readFileSync(REPORT, 'utf8')) as {
      spanningScopeReadings: SpanningReading[];
    };
    const readings = report.spanningScopeReadings.filter(({ edgeId }) => edgeId === edge.id);

    expect(readings).toHaveLength(4);
    for (const row of readings) {
      const direction = row.caseId.includes('forward') ? 'forward' : 'reverse';
      expect.soft(row.rendered, row.caseId).toBe(expected[direction]);
    }
  } finally {
    rmSync(REPORT, { force: true });
  }
}, 180_000);
