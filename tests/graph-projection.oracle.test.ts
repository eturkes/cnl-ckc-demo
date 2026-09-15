import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GraphDataError, SemanticGraphModel, parseSemanticGraph } from '../src/graph/model.js';

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

interface OracleNode {
  id: string;
  kind: string;
}

interface OracleEdge {
  id: string;
  kind: string;
  source: string;
  target: string;
  label: string;
  document: string;
  sentence: number | null;
  scope?: number;
}

interface OracleScope {
  chain: readonly string[];
  operator: string;
  document: string;
  sentence: number | null;
  reference: string;
}

interface OracleAsset {
  nodes: readonly OracleNode[];
  edges: readonly OracleEdge[];
  scopes: readonly OracleScope[];
}

const GRAPH_PATH = fileURLToPath(
  new URL('../kb/generated/graph/semantic-graph.json', import.meta.url),
);
const CONCEPT_KINDS = new Set(['entity', 'event', 'value']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readOracleAsset = (): OracleAsset => {
  const value: unknown = JSON.parse(readFileSync(GRAPH_PATH, 'utf8'));
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    !Array.isArray(value.scopes)
  ) {
    throw new Error('oracle input must contain nodes, edges, and scopes arrays');
  }
  return value as unknown as OracleAsset;
};

const scopeCoordinate = (document: string, sentence: number | null, reference: string): string =>
  JSON.stringify([document, sentence, reference]);

const orderedScopeResolver = (asset: OracleAsset): ((edge: OracleEdge) => readonly string[]) => {
  const byReference = new Map(
    asset.scopes.map((scope) => [
      scopeCoordinate(scope.document, scope.sentence, scope.reference),
      scope,
    ]),
  );
  return (edge): readonly string[] => {
    if (edge.scope === undefined) return [];
    const scope = asset.scopes[edge.scope];
    if (scope === undefined) throw new Error(`${edge.id} has unresolved scope ${edge.scope}`);
    return scope.chain.flatMap((reference) => {
      if (reference === 'actual') return [];
      const context = byReference.get(scopeCoordinate(scope.document, scope.sentence, reference));
      if (context === undefined) {
        throw new Error(`${scope.document}/${String(scope.sentence)} misses ${reference}`);
      }
      return [context.operator];
    });
  };
};

const conceptEdges = (asset: OracleAsset): readonly OracleEdge[] => {
  const nodes = new Map(asset.nodes.map((node) => [node.id, node]));
  return asset.edges.filter(
    (edge) =>
      edge.kind !== 'cardinality' &&
      edge.kind !== 'operator' &&
      (edge.kind !== 'implies' || edge.label === 'condition supports') &&
      CONCEPT_KINDS.has(nodes.get(edge.source)?.kind ?? '') &&
      CONCEPT_KINDS.has(nodes.get(edge.target)?.kind ?? ''),
  );
};

const relationKey = (edge: OracleEdge): string =>
  [edge.kind, edge.source, edge.target, edge.label].join('');

const projectionKey = (
  edge: OracleEdge,
  orderedScope: (edge: OracleEdge) => readonly string[],
): string => `${relationKey(edge)}${JSON.stringify(orderedScope(edge))}`;

const projectedRepresentatives = (model: SemanticGraphModel): readonly OracleEdge[] => {
  const byId = new Map<string, OracleEdge>();
  for (const node of model.data.nodes) {
    if (!CONCEPT_KINDS.has(node.kind)) continue;
    for (const edge of model.conceptIncident(node.id)) {
      byId.set(edge.id, edge as OracleEdge);
    }
  }
  return [...byId.values()];
};

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

  describe('P2 ordered scope', () => {
    it('matches every projected relation plus its independently resolved operator sequence', () => {
      const asset = readOracleAsset();
      const resolveScope = orderedScopeResolver(asset);
      const expected = new Map(
        conceptEdges(asset).map((edge) => [projectionKey(edge, resolveScope), edge]),
      );
      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      const representatives = projectedRepresentatives(model);
      const actualKeys = new Set(representatives.map((edge) => projectionKey(edge, resolveScope)));
      const expectedScoped = [...expected.values()].filter(
        (edge) => resolveScope(edge).length > 0,
      ).length;
      const actualScoped = representatives.filter((edge) => resolveScope(edge).length > 0).length;
      const missing = [...expected.keys()].filter((key) => !actualKeys.has(key));
      const unexpected = [...actualKeys].filter((key) => !expected.has(key));

      expect({
        projected: representatives.length,
        scoped: actualScoped,
        missing: missing.length,
        unexpected: unexpected.length,
      }).toEqual({
        projected: expected.size,
        scoped: expectedScoped,
        missing: 0,
        unexpected: 0,
      });
    });

    it('keeps opposite orderings as separate projected relations', () => {
      const input = boundaryAsset();
      input.scopes = [
        {
          ...scopeRecord('scope:outer-negative'),
          chain: ['actual', 'outer-negative'],
          operator: '-',
          reference: 'outer-negative',
        },
        {
          ...scopeRecord('scope:negative-should'),
          chain: ['actual', 'outer-negative', 'negative-should'],
          reference: 'negative-should',
        },
        {
          ...scopeRecord('scope:outer-should'),
          chain: ['actual', 'outer-should'],
          reference: 'outer-should',
        },
        {
          ...scopeRecord('scope:should-negative'),
          chain: ['actual', 'outer-should', 'should-negative'],
          operator: '-',
          reference: 'should-negative',
        },
      ];
      const relation = input.edges[4];
      if (relation === undefined) throw new Error('fixture concept edge is missing');
      input.edges[4] = { ...relation, scope: 1 };
      input.edges.push({ ...relation, id: 'edge:opposite-order', line: 24, scope: 3 });
      if (!isRecord(input.stats) || !isRecord(input.stats.byEdgeKind)) {
        throw new Error('fixture stats are missing');
      }
      input.stats.edges = input.edges.length;
      input.stats.byEdgeKind.argument = 2;

      const asset = input as unknown as OracleAsset;
      const resolveScope = orderedScopeResolver(asset);
      const expected = input.edges
        .filter((edge) => edge.id === relation.id || edge.id === 'edge:opposite-order')
        .map((edge) => resolveScope(edge as unknown as OracleEdge))
        .sort();
      const model = new SemanticGraphModel(parseSemanticGraph(input));
      const actual = model
        .conceptIncident('event:have')
        .filter((edge) => relationKey(edge as OracleEdge) === relationKey(relation as unknown as OracleEdge))
        .map((edge) => resolveScope(edge as OracleEdge))
        .sort();

      expect(actual).toEqual(expected);
      expect(expected).toEqual([
        ['-', 'should'],
        ['should', '-'],
      ]);
    });
  });
});
