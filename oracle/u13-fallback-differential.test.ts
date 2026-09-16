import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SemanticGraphModel, graphRelationLabel, parseSemanticGraph } from '../src/graph/model.js';
import { deriveProjection, expectedFallbackReading, readAsset } from './u13-oracle.mjs';

describe('u13 reversed HTML fallback oracle', () => {
  it('preserves the independently derived relation and ordered scope at every target', () => {
    const source = readAsset();
    const expected = deriveProjection(source);
    const model = new SemanticGraphModel(parseSemanticGraph(source));
    const actualById = new Map(model.data.edges.map((edge) => [edge.id, edge]));
    const disagreements = expected.flatMap(({ representative }) => {
      const edge = actualById.get(representative.id);
      const expectedText = expectedFallbackReading(representative, representative.target);
      const actualText = edge === undefined ? undefined : graphRelationLabel(edge, edge.target);
      return actualText === expectedText
        ? []
        : [{ id: representative.id, expected: expectedText, actual: actualText }];
    });
    const component = readFileSync('src/graph/SemanticGraph.svelte', 'utf8');
    expect(component).toContain('graphRelationLabel(relation, selected.id)');
    console.log(
      `O3 reversed=${String(expected.length)} disagreements=${String(disagreements.length)} ` +
        `samples=${JSON.stringify(disagreements.slice(0, 5))}`,
    );
    expect(disagreements).toEqual([]);
  });
});
