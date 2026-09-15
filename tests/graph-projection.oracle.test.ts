import { describe, expect, it } from 'vitest';

import { GraphDataError, parseSemanticGraph } from '../src/graph/model.js';

import { GRAPH_FIXTURE } from './graph-fixture.js';

type MutableAsset = Record<string, unknown> & {
  edges: Record<string, unknown>[];
  scopes: unknown[];
};

const scopeRecord = (id = 'scope:fixture'): Record<string, unknown> => ({
  id,
  chain: ['actual', id],
  operator: 'should',
  document: 'cdc2022-opioid-rec05',
  sentence: 2,
  reference: id,
});

const boundaryAsset = (): MutableAsset => {
  const asset = structuredClone(GRAPH_FIXTURE) as unknown as MutableAsset;
  asset.scopes = [scopeRecord()];
  const operator = asset.edges[3];
  if (operator === undefined) throw new Error('fixture operator edge is missing');
  asset.edges[3] = { ...operator, scope: 0 };
  return asset;
};

const parsedScopeState = (
  value: ReturnType<typeof parseSemanticGraph>,
): { scopes?: unknown[]; edges: { scope?: unknown }[] } =>
  value as unknown as { scopes?: unknown[]; edges: { scope?: unknown }[] };

describe('scope projection differential oracle', () => {
  describe('P1 producer boundary', () => {
    it('preserves the scopes table and edge scope index', () => {
      const input = boundaryAsset();
      const parsed = parsedScopeState(parseSemanticGraph(input));

      expect(parsed.scopes).toEqual(input.scopes);
      expect(parsed.edges[3]?.scope).toBe(0);
    });

    it.each([
      {
        name: 'malformed scope record',
        field: 'scopes[0].chain',
        mutate: (asset: MutableAsset) => {
          asset.scopes[0] = { ...scopeRecord(), chain: 'actual' };
        },
      },
      {
        name: 'out-of-range scope index',
        field: 'edges[3].scope',
        mutate: (asset: MutableAsset) => {
          const edge = asset.edges[3];
          if (edge !== undefined) edge.scope = asset.scopes.length;
        },
      },
      {
        name: 'non-integer scope index',
        field: 'edges[3].scope',
        mutate: (asset: MutableAsset) => {
          const edge = asset.edges[3];
          if (edge !== undefined) edge.scope = 0.5;
        },
      },
    ])('refuses a $name by field', ({ field, mutate }) => {
      const input = boundaryAsset();
      mutate(input);
      const read = (): void => {
        parseSemanticGraph(input);
      };

      expect(read).toThrowError(GraphDataError);
      expect(read).toThrow(field);
    });

    it('accepts an unreferenced scope record', () => {
      const input = boundaryAsset();
      input.scopes.push(scopeRecord('scope:unreferenced'));

      expect(() => parseSemanticGraph(input)).not.toThrow();
    });
  });
});
