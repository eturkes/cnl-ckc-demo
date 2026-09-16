import { describe, expect, it } from 'vitest';

import { SemanticGraphModel, parseSemanticGraph } from '../src/graph/model.js';
import { deriveProjection, readAsset } from './u13-oracle.mjs';

describe('u13 asset-derived scope oracle', () => {
  it('differentials every independently grouped representative against the shipped model', () => {
    const source = readAsset();
    const expected = deriveProjection(source);
    const model = new SemanticGraphModel(parseSemanticGraph(source));
    const actualById = new Map(model.data.edges.map((edge) => [edge.id, edge]));
    const disagreements = expected.flatMap(({ representative }) => {
      const actual = actualById.get(representative.id);
      const actualReading = {
        relation: actual?.relation,
        scope: actual?.scopeOperators ?? [],
      };
      const expectedReading = {
        relation: representative.relation,
        scope: representative.scope,
      };
      return JSON.stringify(actualReading) === JSON.stringify(expectedReading)
        ? []
        : [{ id: representative.id, expected: expectedReading, actual: actualReading }];
    });
    const agreements = expected.length - disagreements.length;
    console.log(
      `O2 agreements=${String(agreements)} disagreements=${String(disagreements.length)} ` +
        `model-groups=${String(model.conceptEdgeCount)} samples=${JSON.stringify(disagreements.slice(0, 5))}`,
    );
    expect(model.conceptEdgeCount).toBe(expected.length);
    expect(disagreements).toEqual([]);
  });
});
