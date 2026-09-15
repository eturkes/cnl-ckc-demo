import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { parseSemanticGraph } from '../src/graph/model.js';

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

  it('links every operator edge to a resolvable scope and pins unreferenced records', () => {
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
    // User ruling: the 71 edgeless operator contexts stay orphaned, so unreferenced records are
    // legal. Pinned as an exact count rather than dropped — a relaxed direction that asserts
    // nothing is green for the same reason a correct one is. Records, not nodes: 1,256 of 1,263
    // are referenced because a non-operator edge can cite a context whose own node has no edge.
    const unreferenced = [...asset.scopes.keys()].filter((index) => !referenced.has(index));
    const expectedUnreferencedScopeRecords = 7;
    expect(unreferenced).toHaveLength(expectedUnreferencedScopeRecords);
  });

  it('preserves ordered outer context when scope chains are permutations', async () => {
    const { deriveSemanticGraph } = await import('../tools/kb/graph.mjs');
    const operatorSite = (
      line: number,
      document: string,
      outer: string,
      reference: string,
      operator: string,
    ) => {
      const source = `guideline_operator(${outer},${reference},${operator})`;
      return {
        line,
        document,
        sentence: 1,
        predicate: 'guideline_operator',
        arity: 3,
        kind: 'fact' as const,
        text: `${source}.`,
        head: { name: 'guideline_operator', args: [outer, reference, operator], source },
        body: [],
      };
    };
    const clauses = [
      operatorSite(1, 'scope-order-a', 'actual', 'A', 'should'),
      operatorSite(2, 'scope-order-a', 'A', 'B', 'may'),
      operatorSite(3, 'scope-order-b', 'actual', 'B', 'should'),
      operatorSite(4, 'scope-order-b', 'B', 'A', 'may'),
    ];
    const derived = deriveSemanticGraph(new Map(), clauses).model as unknown;
    if (!isRecord(derived) || !Array.isArray(derived.scopes)) {
      throw new Error('constructed semantic graph scopes table is missing');
    }

    const nested = derived.scopes.filter(
      (scope): scope is Record<string, unknown> => isRecord(scope) && scope.operator === 'may',
    );
    expect(nested).toHaveLength(2);
    expect(nested.map(({ chain }) => chain)).toEqual(
      expect.arrayContaining([
        ['actual', 'A', 'B'],
        ['actual', 'B', 'A'],
      ]),
    );
    expect(new Set(nested.map(({ id }) => id)).size).toBe(2);
  });

  it('bumps producer and reader together and makes a v1 reader refuse v2 by name', () => {
    const asset = readGraphAsset();
    if (asset.schemaVersion !== 2) {
      throw new Error(`semantic graph producer schema ${String(asset.schemaVersion)}, expected 2`);
    }

    expect(() => parseSemanticGraph(asset)).not.toThrow();
    expect(() => parseSemanticGraph({ ...asset, schemaVersion: 1 })).toThrow(
      'semantic graph schema 1, expected 2',
    );
    const readAsVersionOne = (value: Record<string, unknown>): void => {
      if (value.schemaVersion !== 1) {
        throw new Error(`semantic graph schema ${String(value.schemaVersion)}, expected 1`);
      }
    };
    expect(() => readAsVersionOne(asset)).toThrow('semantic graph schema 2, expected 1');
  });

  it('validates the emitted scope shape and refuses an empty scopes table by name', async () => {
    const graphModule: unknown = await import('../tools/kb/graph.mjs');
    if (!isRecord(graphModule) || typeof graphModule.validateSemanticGraphAsset !== 'function') {
      throw new Error('semantic graph structural validator export is missing');
    }
    const validate = graphModule.validateSemanticGraphAsset as (value: unknown) => string[];
    const asset = readGraphAsset();
    expect(validate(asset)).toEqual([]);
    const failures = validate({ ...asset, scopes: [] });
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((failure) => /\bscopes\b/u.test(failure))).toBe(true);
  });
});
