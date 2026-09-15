import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

const GRAPH_PATH = fileURLToPath(
  new URL('../kb/generated/graph/semantic-graph.json', import.meta.url),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readGraphAsset = (): Record<string, unknown> => {
  const value: unknown = JSON.parse(readFileSync(GRAPH_PATH, 'utf8'));
  if (!isRecord(value)) throw new Error('semantic graph asset must be an object');
  return value;
};

describe('generated semantic graph scopes', () => {
  it('represents the emitted scope census as one complete modality partition', () => {
    const scopes = readGraphAsset().scopes;
    if (!Array.isArray(scopes)) throw new Error('semantic graph scopes table is missing');

    const counts = new Map<string, number>();
    for (const [index, scope] of scopes.entries()) {
      if (!isRecord(scope)) throw new Error(`scopes[${String(index)}] must be an object`);
      if (typeof scope.operator !== 'string') {
        throw new Error(`scopes[${String(index)}].operator must be a string`);
      }
      counts.set(scope.operator, (counts.get(scope.operator) ?? 0) + 1);
    }

    const partition = {
      should: counts.get('should') ?? 0,
      '-': counts.get('-') ?? 0,
      may: counts.get('may') ?? 0,
      can: counts.get('can') ?? 0,
      must: counts.get('must') ?? 0,
    };
    expect(partition).toEqual({ should: 857, '-': 156, may: 156, can: 85, must: 9 });
    expect(Object.values(partition).reduce((sum, count) => sum + count, 0)).toBe(1_263);
    expect(scopes).toHaveLength(1_263);
  });

  it('adds no scope-specific node kind', () => {
    const stats = readGraphAsset().stats;
    if (!isRecord(stats) || !isRecord(stats.byNodeKind)) {
      throw new Error('semantic graph stats.byNodeKind must be an object');
    }
    expect(Object.keys(stats.byNodeKind).sort()).toEqual([
      'document',
      'entity',
      'event',
      'operator-context',
      'value',
    ]);
  });

  it('keeps default zlib gzip size within the scoped graph budget', () => {
    const compressed = gzipSync(readFileSync(GRAPH_PATH));
    expect(compressed.byteLength).toBeLessThanOrEqual(508_572);
  });

  it('links every operator edge and every scope record in both directions', () => {
    const asset = readGraphAsset();
    if (!Array.isArray(asset.edges)) throw new Error('semantic graph edges table is missing');

    const referenced = new Set<number>();
    for (const [index, edge] of asset.edges.entries()) {
      if (!isRecord(edge)) throw new Error(`edges[${String(index)}] must be an object`);
      const scope = edge.scope;
      if (edge.kind === 'operator' && !Number.isSafeInteger(scope)) {
        throw new Error(`operator edge ${String(edge.id)} must reference exactly one scope index`);
      }
      if (scope === undefined) continue;
      if (!Number.isSafeInteger(scope) || Number(scope) < 0) {
        throw new Error(`edges[${String(index)}].scope must be a non-negative safe integer`);
      }
      referenced.add(Number(scope));
    }

    if (!Array.isArray(asset.scopes)) {
      throw new Error('semantic graph scopes table is missing for edge linkage');
    }
    for (const scope of referenced) {
      if (scope >= asset.scopes.length) {
        throw new Error(`edge scope index ${String(scope)} is outside the scopes table`);
      }
    }
    for (const index of asset.scopes.keys()) {
      if (!referenced.has(index)) throw new Error(`scopes[${String(index)}] is orphaned`);
    }
  });
});
