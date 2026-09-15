import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  GraphDataError,
  SemanticGraphModel,
  graphRelationLabel,
  parseSemanticGraph,
} from '../src/graph/model.js';

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
  line: number;
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

const KEY_FIELD_SEPARATOR = String.fromCodePoint(0x1f);
const KEY_SCOPE_SEPARATOR = String.fromCodePoint(0x1e);

const relationKey = (edge: OracleEdge): string =>
  [edge.kind, edge.source, edge.target, edge.label].join(KEY_FIELD_SEPARATOR);

const projectionKey = (
  edge: OracleEdge,
  orderedScope: (edge: OracleEdge) => readonly string[],
): string => `${relationKey(edge)}${KEY_SCOPE_SEPARATOR}${JSON.stringify(orderedScope(edge))}`;

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

const projectedScope = (asset: OracleAsset, edge: unknown): readonly string[] => {
  if (!isRecord(edge)) throw new Error('projected edge must be an object');
  const candidate = edge.orderedScope ?? edge.scope;
  if (Array.isArray(candidate)) {
    if (!candidate.every((operator) => typeof operator === 'string')) {
      throw new Error(`${String(edge.id)} projected scope must contain strings`);
    }
    return candidate as string[];
  }
  if (candidate === undefined) return [];
  if (!Number.isSafeInteger(candidate)) {
    throw new Error(`${String(edge.id)} projected scope must be an index or string sequence`);
  }
  return orderedScopeResolver(asset)({
    ...edge,
    scope: Number(candidate),
  } as unknown as OracleEdge);
};

const edgeById = (asset: OracleAsset, id: string): OracleEdge => {
  const edge = asset.edges.find((candidate) => candidate.id === id);
  if (edge === undefined) throw new Error(`oracle input misses ${id}`);
  return edge;
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
        .filter(
          (edge) =>
            relationKey(edge as OracleEdge) === relationKey(relation as unknown as OracleEdge),
        )
        .map((edge) => resolveScope(edge as OracleEdge))
        .sort();

      expect(actual).toEqual(expected);
      expect(expected).toEqual([
        ['-', 'should'],
        ['should', '-'],
      ]);
    });
  });

  describe('P3 reviewed source-fidelity cases', () => {
    it('attaches negated premise and recommendation relations to their exact scopes', () => {
      const asset = readOracleAsset();
      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      const view = model.answerSubgraph({
        document: 'cdc2022-opioid-rec01',
        sentences: [3],
        lines: [506],
      });
      if (view === undefined) throw new Error('negated recommendation view is missing');
      const premise = view.edges.find(
        ({ source, target, label }) =>
          source === 'event:outweigh' &&
          target === 'entity:opioid-benefit' &&
          label === 'argument 1',
      );
      const recommendation = view.edges.find(
        ({ source, target, label }) =>
          source === 'event:consider' &&
          target === 'entity:opioid-therapy' &&
          label === 'argument 2',
      );

      expect(projectedScope(asset, premise)).toEqual(['-']);
      expect(projectedScope(asset, recommendation)).toEqual(['-', 'should']);
    });

    it('attaches modal force and numeric cardinality to the qualified relation', () => {
      const asset = readOracleAsset();
      const rawRelation = edgeById(asset, 'edge:1803:0');
      const cardinality = asset.edges.find(
        (edge) =>
          edge.kind === 'cardinality' &&
          edge.source === rawRelation.target &&
          edge.document === rawRelation.document &&
          edge.sentence === rawRelation.sentence,
      );
      if (cardinality === undefined) throw new Error('qualified day cardinality is missing');
      const expected = [...orderedScopeResolver(asset)(rawRelation), cardinality.label];
      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      const view = model.answerSubgraph({
        document: 'cdc2022-opioid-rec02-imp21',
        sentences: [1],
        lines: [1795],
      });
      const relation = view?.edges.find(
        ({ source, target, label }) =>
          source === rawRelation.source &&
          target === rawRelation.target &&
          label === rawRelation.label,
      );

      expect(expected).toEqual(['may', 'na eq 30']);
      expect(projectedScope(asset, relation)).toEqual(expected);
    });

    it('attaches a nested operator to the operator named by its outer scope', () => {
      const asset = readOracleAsset();
      const rawShould = edgeById(asset, 'edge:507:0');
      if (rawShould.scope === undefined) throw new Error('nested should scope is missing');
      const shouldScope = asset.scopes[rawShould.scope];
      const outerReference = shouldScope?.chain.at(-2);
      if (shouldScope === undefined || outerReference === undefined) {
        throw new Error('nested should chain has no outer reference');
      }
      const outerScopeIndex = asset.scopes.findIndex(
        (scope) =>
          scope.document === shouldScope.document &&
          scope.sentence === shouldScope.sentence &&
          scope.reference === outerReference,
      );
      const outerEdge = asset.edges.find(
        (edge) => edge.kind === 'operator' && edge.scope === outerScopeIndex,
      );
      if (outerEdge === undefined) throw new Error('outer operator edge is missing');
      const model = new SemanticGraphModel(parseSemanticGraph(asset));

      expect(model.edge(rawShould.id)?.source).toBe(outerEdge.target);
    });

    it('omits a shortcut whose scope cannot preserve both asserted event contexts', () => {
      const asset = readOracleAsset();
      const shortcut = edgeById(asset, 'edge:512:12');
      const recommendation = edgeById(asset, 'edge:514:0');
      const resolveScope = orderedScopeResolver(asset);
      expect({
        premise: resolveScope(shortcut),
        recommendation: resolveScope(recommendation),
      }).toEqual({ premise: ['-'], recommendation: ['-', 'should'] });

      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      expect(model.edge(shortcut.id)).toBeUndefined();
    });

    it('does not highlight the cross-scope shortcut', () => {
      const asset = readOracleAsset();
      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      const view = model.answerSubgraph({
        document: 'cdc2022-opioid-rec01',
        sentences: [3],
        lines: [506],
      });

      expect(view?.highlight.edges).not.toContain('edge:512:12');
    });

    it('names a directed support relation from its target perspective', () => {
      const asset = readOracleAsset();
      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      const support = model.edge('edge:4501:11');
      if (support === undefined) throw new Error('positive support relation is missing');

      expect(graphRelationLabel(support, support.target)).toBe('supported by condition');
    });
  });

  describe('P4 accepted-open separation', () => {
    it('keeps the S9 headline defect independent of scope-aware edge grouping', () => {
      const asset = readOracleAsset();
      const connected = new Set(conceptEdges(asset).flatMap((edge) => [edge.source, edge.target]));
      const connectedNodes = asset.nodes.filter((node) => connected.has(node.id));
      const conceptsAndActions = connectedNodes.filter(
        (node) => node.kind === 'entity' || node.kind === 'event',
      ).length;
      const attributes = connectedNodes.filter((node) => node.kind === 'value').length;
      const model = new SemanticGraphModel(parseSemanticGraph(asset));

      expect({
        reportedConceptsAndActions: model.conceptNodeCount,
        actualConceptsAndActions: conceptsAndActions,
        attributes,
      }).toEqual({
        reportedConceptsAndActions: conceptsAndActions,
        actualConceptsAndActions: conceptsAndActions,
        attributes,
      });
    });

    it('keeps S13+ endpoint-role validation independent while its scope stays valid', () => {
      const asset = structuredClone(readOracleAsset()) as OracleAsset & {
        edges: OracleEdge[];
      };
      const malformed = edgeById(asset, 'edge:513:0');
      malformed.source = 'document:cdc2022-opioid-rec01';

      expect(orderedScopeResolver(asset)(malformed)).toEqual(['-', 'should']);
      expect(() => parseSemanticGraph(asset)).toThrow(GraphDataError);
    });
  });

  describe('P5 concept-first feasibility', () => {
    it('carries 1,572 scoped of 2,615 groups without operator-context endpoints', () => {
      const asset = readOracleAsset();
      const resolveScope = orderedScopeResolver(asset);
      const expected = new Map(
        conceptEdges(asset).map((edge) => [projectionKey(edge, resolveScope), edge]),
      );
      const scoped = [...expected.values()].filter((edge) => resolveScope(edge).length > 0);
      const nodes = new Map(asset.nodes.map((node) => [node.id, node]));
      const forbiddenEndpoints = [...expected.values()].filter(
        (edge) =>
          nodes.get(edge.source)?.kind === 'operator-context' ||
          nodes.get(edge.target)?.kind === 'operator-context',
      );
      const nested = edgeById(asset, 'edge:514:0');
      const model = new SemanticGraphModel(parseSemanticGraph(asset));
      const shippedForbidden = projectedRepresentatives(model).filter(
        (edge) =>
          model.node(edge.source)?.kind === 'operator-context' ||
          model.node(edge.target)?.kind === 'operator-context',
      );

      expect({ groups: expected.size, scoped: scoped.length }).toEqual({
        groups: 2_615,
        scoped: 1_572,
      });
      expect(resolveScope(nested)).toEqual(['-', 'should']);
      expect(forbiddenEndpoints).toEqual([]);
      expect(shippedForbidden).toEqual([]);
    });
  });

  describe('P6 silent-drop census', () => {
    it('partitions all 20,964 edges across the five relationship rejection branches', () => {
      const asset = readOracleAsset();
      const nodes = new Map(asset.nodes.map((node) => [node.id, node]));
      const counts = {
        cardinality: 0,
        operator: 0,
        nonSupportImplication: 0,
        nonConceptSource: 0,
        nonConceptTarget: 0,
        retained: 0,
      };
      for (const edge of asset.edges) {
        if (edge.kind === 'cardinality') counts.cardinality += 1;
        else if (edge.kind === 'operator') counts.operator += 1;
        else if (edge.kind === 'implies' && edge.label !== 'condition supports') {
          counts.nonSupportImplication += 1;
        } else if (!CONCEPT_KINDS.has(nodes.get(edge.source)?.kind ?? '')) {
          counts.nonConceptSource += 1;
        } else if (!CONCEPT_KINDS.has(nodes.get(edge.target)?.kind ?? '')) {
          counts.nonConceptTarget += 1;
        } else counts.retained += 1;
      }

      expect(counts).toEqual({
        cardinality: 1_834,
        operator: 1_193,
        nonSupportImplication: 9_053,
        nonConceptSource: 3_088,
        nonConceptTarget: 0,
        retained: 5_796,
      });
      expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(20_964);
    });

    it('finds 660 occurrences misrepresented across 234 scope-distinct variants', () => {
      const asset = readOracleAsset();
      const resolveScope = orderedScopeResolver(asset);
      const groups = new Map<string, OracleEdge[]>();
      for (const edge of conceptEdges(asset)) {
        const group = groups.get(relationKey(edge)) ?? [];
        group.push(edge);
        groups.set(relationKey(edge), group);
      }
      let affectedGroups = 0;
      let extraScopeVariants = 0;
      let misrepresentedOccurrences = 0;
      let sameScopeDedup = 0;
      for (const group of groups.values()) {
        group.sort((left, right) => left.line - right.line || left.id.localeCompare(right.id));
        const variants = new Map<string, OracleEdge[]>();
        for (const edge of group) {
          const key = JSON.stringify(resolveScope(edge));
          const variant = variants.get(key) ?? [];
          variant.push(edge);
          variants.set(key, variant);
        }
        sameScopeDedup += group.length - variants.size;
        if (variants.size < 2) continue;
        affectedGroups += 1;
        extraScopeVariants += variants.size - 1;
        const representative = group[0];
        if (representative === undefined) throw new Error('projection group is empty');
        const representedScope = JSON.stringify(resolveScope(representative));
        for (const [scope, edges] of variants) {
          if (scope !== representedScope) misrepresentedOccurrences += edges.length;
        }
      }

      expect({
        qualifyingOccurrences: conceptEdges(asset).length,
        legacyGroups: groups.size,
        totalLegacyDedup: conceptEdges(asset).length - groups.size,
        scopeAwareGroups: groups.size + extraScopeVariants,
        affectedGroups,
        extraScopeVariants,
        misrepresentedOccurrences,
        sameScopeDedup,
      }).toEqual({
        qualifyingOccurrences: 5_796,
        legacyGroups: 2_381,
        totalLegacyDedup: 3_415,
        scopeAwareGroups: 2_615,
        affectedGroups: 173,
        extraScopeVariants: 234,
        misrepresentedOccurrences: 660,
        sameScopeDedup: 3_181,
      });
    });

    it('refuses a role-invalid edge instead of accepting then filtering it', () => {
      const asset = structuredClone(readOracleAsset()) as OracleAsset & {
        edges: OracleEdge[];
      };
      edgeById(asset, 'edge:513:0').source = 'document:cdc2022-opioid-rec01';
      let parsed: ReturnType<typeof parseSemanticGraph> | undefined;
      try {
        parsed = parseSemanticGraph(asset);
      } catch (error) {
        if (!(error instanceof GraphDataError)) throw error;
      }
      const projected =
        parsed === undefined
          ? false
          : projectedRepresentatives(new SemanticGraphModel(parsed)).some(
              (edge) => edge.id === 'edge:513:0',
            );

      expect({ accepted: parsed !== undefined, projected }).toEqual({
        accepted: false,
        projected: false,
      });
    });
  });
});
