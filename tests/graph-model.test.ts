import { describe, expect, it } from 'vitest';

import {
  GRAPH_SCHEMA_VERSION,
  GraphDataError,
  SemanticGraphModel,
  graphFocusKey,
  graphRelationLabel,
  parseSemanticGraph,
} from '../src/graph/model.js';

import { GRAPH_FIXTURE } from './graph-fixture.js';

const model = (): SemanticGraphModel => new SemanticGraphModel(parseSemanticGraph(GRAPH_FIXTURE));

describe('semantic graph boundary', () => {
  it('accepts the producer contract and preserves its measured totals', () => {
    const parsed = parseSemanticGraph(GRAPH_FIXTURE);
    expect(parsed.stats).toMatchObject({ documents: 2, clauses: 5, nodes: 7, edges: 5 });
    expect(parsed.nodes).toHaveLength(7);
    expect(parsed.edges).toHaveLength(5);
    expect(parsed.scopes).toEqual([
      expect.objectContaining({ operator: 'should', chain: ['actual', 'scope:should'] }),
    ]);
    expect(parsed.edges.find(({ id }) => id === 'edge:event-operator')?.scope).toBe(0);
    expect(Object.isFrozen(parsed.nodes)).toBe(true);
    expect(Object.isFrozen(parsed.scopes[0]?.chain)).toBe(true);
  });

  it.each([
    [
      'malformed scope record',
      { ...GRAPH_FIXTURE, scopes: [{ ...GRAPH_FIXTURE.scopes[0], chain: [] }] },
      'scopes[0].chain',
    ],
    [
      'scope chain with the wrong terminal reference',
      {
        ...GRAPH_FIXTURE,
        scopes: [{ ...GRAPH_FIXTURE.scopes[0], chain: ['actual', 'scope:other'] }],
      },
      'scopes[0].chain must end with its reference',
    ],
    [
      'scope chain with a repeated context',
      {
        ...GRAPH_FIXTURE,
        scopes: [{ ...GRAPH_FIXTURE.scopes[0], chain: ['actual', 'actual', 'scope:should'] }],
      },
      'scopes[0].chain must not repeat a context',
    ],
    [
      'edge scope from another source unit',
      {
        ...GRAPH_FIXTURE,
        edges: GRAPH_FIXTURE.edges.map((edge) =>
          edge.id === 'edge:dosage-event' ? { ...edge, sentence: 3 } : edge,
        ),
      },
      'edges[2].scope belongs to another source unit',
    ],
    [
      'operator target that disagrees with its scope',
      {
        ...GRAPH_FIXTURE,
        scopes: [{ ...GRAPH_FIXTURE.scopes[0], operator: 'may' }],
      },
      'edges[3].scope does not describe its operator target',
    ],
    [
      'non-integer edge scope',
      {
        ...GRAPH_FIXTURE,
        edges: GRAPH_FIXTURE.edges.map((edge) =>
          edge.id === 'edge:event-operator' ? { ...edge, scope: 0.5 } : edge,
        ),
      },
      'edges[3].scope',
    ],
    [
      'out-of-range edge scope',
      {
        ...GRAPH_FIXTURE,
        edges: GRAPH_FIXTURE.edges.map((edge) =>
          edge.id === 'edge:event-operator' ? { ...edge, scope: 1 } : edge,
        ),
      },
      'edges[3].scope 1 is out of range',
    ],
    [
      'operator edge without scope',
      {
        ...GRAPH_FIXTURE,
        edges: GRAPH_FIXTURE.edges.map((edge) =>
          edge.id === 'edge:event-operator' ? { ...edge, scope: undefined } : edge,
        ),
      },
      'edges[3].scope is required',
    ],
    [
      'argument source whose node is not an event',
      {
        ...GRAPH_FIXTURE,
        edges: GRAPH_FIXTURE.edges.map((edge) =>
          edge.id === 'edge:event-value' ? { ...edge, source: 'doc:cdc' } : edge,
        ),
      },
      'edges[4].source must reference an event for an argument edge',
    ],
    [
      'preposition source whose node is not an event',
      {
        ...GRAPH_FIXTURE,
        edges: GRAPH_FIXTURE.edges.map((edge) =>
          edge.id === 'edge:event-value'
            ? { ...edge, kind: 'preposition', source: 'doc:cdc', predicate: 'guideline_pp' }
            : edge,
        ),
      },
      'edges[4].source must reference an event for a preposition edge',
    ],
  ])('rejects %s by field', (_name, input, field) => {
    expect(() => parseSemanticGraph(input)).toThrow(field);
  });

  it('accepts scope records that no edge references', () => {
    const unreferenced = {
      ...GRAPH_FIXTURE.scopes[0],
      id: 'scope:unused',
      chain: ['actual', 'scope:unused'],
      reference: 'scope:unused',
    } as const;
    expect(() =>
      parseSemanticGraph({ ...GRAPH_FIXTURE, scopes: [...GRAPH_FIXTURE.scopes, unreferenced] }),
    ).not.toThrow();
  });

  it('refuses unreferenced scope semantics that the projection cannot resolve', () => {
    const unrepresentable = {
      ...GRAPH_FIXTURE.scopes[0],
      id: 'scope:unused',
      chain: ['actual', 'scope:missing', 'scope:unused'],
      operator: 'may',
      reference: 'scope:unused',
    } as const;
    const parsed = parseSemanticGraph({
      ...GRAPH_FIXTURE,
      scopes: [...GRAPH_FIXTURE.scopes, unrepresentable],
    });

    expect(() => new SemanticGraphModel(parsed)).toThrow(
      'scope:unused.chain cannot resolve scope:missing',
    );
  });

  it.each([
    // Derived, never a literal: this row spelled `2` while the reader pinned 1, so u11's bump
    // to 2 turned the drift case into the CURRENT version and it silently stopped refusing.
    ['schema drift', { ...GRAPH_FIXTURE, schemaVersion: GRAPH_SCHEMA_VERSION + 1 }],
    [
      'duplicate node',
      { ...GRAPH_FIXTURE, nodes: [...GRAPH_FIXTURE.nodes, GRAPH_FIXTURE.nodes[0]] },
    ],
    [
      'orphan edge',
      {
        ...GRAPH_FIXTURE,
        edges: [{ ...GRAPH_FIXTURE.edges[0], source: 'missing' }, ...GRAPH_FIXTURE.edges.slice(1)],
      },
    ],
    [
      'unsafe label',
      {
        ...GRAPH_FIXTURE,
        nodes: [
          { ...GRAPH_FIXTURE.nodes[0], label: 'hidden\u202evalue' },
          ...GRAPH_FIXTURE.nodes.slice(1),
        ],
      },
    ],
    ['dishonest stats', { ...GRAPH_FIXTURE, stats: { ...GRAPH_FIXTURE.stats, nodes: 8 } }],
    [
      'dishonest kind stats',
      {
        ...GRAPH_FIXTURE,
        stats: {
          ...GRAPH_FIXTURE.stats,
          byNodeKind: { ...GRAPH_FIXTURE.stats.byNodeKind, entity: 3 },
        },
      },
    ],
  ])('rejects %s', (_name, input) => {
    expect(() => parseSemanticGraph(input)).toThrow(GraphDataError);
  });
});

describe('semantic graph indexes', () => {
  it('ranks exact and prefix label matches ahead of metadata matches', () => {
    const graph = model();
    expect(graph.search('dosage').map(({ id }) => id)).toEqual(['entity:dosage']);
    expect(graph.search('cdc2022-opioid-rec05', 3).map(({ id }) => id)).toEqual([
      'entity:dosage',
      'event:have',
      'entity:recommendation',
    ]);
    expect(graph.search('missing')).toEqual([]);
  });

  it('resolves ids and typed external focus without fuzzy substitution', () => {
    const graph = model();
    expect(graph.resolveFocus('event:have')?.label).toBe('have');
    expect(
      graph.resolveFocus({
        kind: 'entity',
        label: 'dosage reduction',
        document: 'cdc2022-opioid-rec05',
        sentence: 2,
      })?.id,
    ).toBe('entity:dosage');
    expect(graph.resolveFocus({ kind: 'value', label: 'absent' })).toBeUndefined();
  });

  it('builds a bounded neighborhood and can include a selected path beyond the cap', () => {
    const graph = model();
    const bounded = graph.neighborhood('doc:cdc', 3, 2);
    expect(bounded.nodes.map(({ id }) => id)).toEqual(['doc:cdc', 'entity:recommendation']);
    expect(bounded.truncatedNodes).toBe(true);

    const included = graph.neighborhood('doc:cdc', 1, 2, ['event:have']);
    expect(included.nodes.map(({ id }) => id)).toContain('event:have');

    const preferred = graph.neighborhood(
      'doc:cdc',
      3,
      6,
      ['operator:should'],
      ['edge:event-operator'],
    );
    expect(preferred.edges[0]?.id).toBe('edge:event-operator');
  });

  it('isolates every relationship from the controlled sentences cited by a proof', () => {
    const graph = model();
    const evidence = graph.evidenceSubgraph({
      document: 'cdc2022-opioid-rec05',
      sentence: 2,
      sentences: [2],
      lines: [22],
    });

    expect(evidence).toMatchObject({
      document: 'cdc2022-opioid-rec05',
      sentences: [2],
      lines: [22],
      truncatedNodes: false,
      truncatedEdges: false,
    });
    expect(evidence?.edges.map(({ id }) => id)).toEqual([
      'edge:recommendation-dosage',
      'edge:dosage-event',
      'edge:event-operator',
    ]);
    expect(evidence?.nodes.map(({ id }) => id).sort()).toEqual([
      'entity:dosage',
      'entity:recommendation',
      'event:have',
      'operator:should',
    ]);
    expect(graph.resolveFocus({ document: 'cdc2022-opioid-rec05', lines: [23] })?.id).toBe(
      'event:have',
    );
  });

  it('projects answer evidence around a clinical concept and leaves grammar out of the map', () => {
    const graph = model();
    const answer = graph.answerSubgraph({
      document: 'cdc2022-opioid-rec05',
      sentence: 2,
      sentences: [2],
      lines: [22],
      question: 'How should clinicians reduce dosage?',
      answer: 'Clinicians should make dosage reduction gradual.',
    });

    expect(answer).toMatchObject({
      root: 'entity:dosage',
      highlight: {
        nodes: ['entity:dosage', 'event:have'],
        edges: ['edge:dosage-event'],
      },
      hiddenTechnicalNodes: 2,
      hiddenTechnicalEdges: 2,
    });
    expect(answer?.nodes.map(({ id }) => id)).toEqual([
      'entity:dosage',
      'event:have',
      'value:gradual',
    ]);
    expect(answer?.nodes.some(({ kind }) => kind === 'operator-context')).toBe(false);
    expect(graph.searchConcepts('operator')).toEqual([]);
  });

  it('keeps ordered operator scope distinct while grouping identical relations', () => {
    const scopes = [
      GRAPH_FIXTURE.scopes[0],
      {
        ...GRAPH_FIXTURE.scopes[0],
        id: 'scope:then-may',
        chain: ['actual', 'scope:should', 'scope:then-may'],
        operator: 'may',
        reference: 'scope:then-may',
      },
      {
        ...GRAPH_FIXTURE.scopes[0],
        id: 'scope:unused-may',
        chain: ['actual', 'scope:unused-may'],
        operator: 'may',
        reference: 'scope:unused-may',
      },
      {
        ...GRAPH_FIXTURE.scopes[0],
        id: 'scope:unused-should',
        chain: ['actual', 'scope:unused-may', 'scope:unused-should'],
        reference: 'scope:unused-should',
      },
    ] as const;
    const source = GRAPH_FIXTURE.edges.find(({ id }) => id === 'edge:dosage-event');
    if (source === undefined) throw new Error('missing scoped fixture edge');
    const edges = [
      ...GRAPH_FIXTURE.edges,
      { ...source, id: 'edge:dosage-event-should-may', line: 24, scope: 1 },
      { ...source, id: 'edge:dosage-event-may-should', line: 25, scope: 3 },
    ] as const;
    const graph = new SemanticGraphModel(
      parseSemanticGraph({
        ...GRAPH_FIXTURE,
        scopes,
        edges,
        stats: {
          ...GRAPH_FIXTURE.stats,
          edges: 7,
          byEdgeKind: { ...GRAPH_FIXTURE.stats.byEdgeKind, event: 3 },
        },
      }),
    );
    const variants = graph
      .conceptNeighborhood('event:have', 1, 10)
      .edges.filter(({ source, target }) => source === 'entity:dosage' && target === 'event:have')
      .sort((left, right) => left.line - right.line);

    expect(variants.map(({ relation }) => relation)).toEqual([
      'participates in event',
      'participates in event',
      'participates in event',
    ]);
    expect(variants.map(({ scopeOperators }) => scopeOperators)).toEqual([
      ['should'],
      ['should', 'may'],
      ['may', 'should'],
    ]);
    expect(graph.conceptEdgeCount).toBe(4);
  });

  it('keeps a far scope that agrees with the near end so the target reading can flip', () => {
    // The source reading is identical whether or not an agreeing far end is stored, so this
    // grades the TARGET reading, where dropping it strands the reader with an empty near scope.
    const graph = new SemanticGraphModel(
      parseSemanticGraph({
        ...GRAPH_FIXTURE,
        nodes: [
          ...GRAPH_FIXTURE.nodes,
          {
            id: 'event:outweigh',
            kind: 'event',
            label: 'outweigh',
            document: 'cdc2022-opioid-rec05',
            sentence: 2,
          },
        ],
        edges: [
          ...GRAPH_FIXTURE.edges,
          {
            id: 'edge:agreeing-support',
            kind: 'implies',
            source: 'event:outweigh',
            target: 'event:have',
            label: 'condition supports',
            document: 'cdc2022-opioid-rec05',
            sentence: 2,
            // `edge:dosage-event` witnesses `event:have` on this line, so both ends read
            // `['should']` — the case that used to null the far end.
            line: 21,
            predicate: 'guideline_condition',
            scope: 0,
          },
        ],
        stats: {
          ...GRAPH_FIXTURE.stats,
          nodes: 8,
          edges: 6,
          byNodeKind: { ...GRAPH_FIXTURE.stats.byNodeKind, event: 2 },
          byEdgeKind: { ...GRAPH_FIXTURE.stats.byEdgeKind, implies: 2 },
        },
      }),
    );
    const edge = graph.edge('edge:agreeing-support');
    if (edge === undefined) throw new Error('missing agreeing-scope support edge');

    expect(edge.scopeOperators).toEqual(['should']);
    expect(edge.farScopeOperators).toEqual(['should']);
    expect(graphRelationLabel(edge)).toBe('condition supports · should');
    expect(graphRelationLabel(edge, 'event:have')).toBe('supported by condition · should');
  });

  it('finds a deterministic shortest path in either edge direction', () => {
    const graph = model();
    expect(graph.shortestPath('doc:cdc', 'operator:should')).toEqual({
      nodes: ['doc:cdc', 'entity:recommendation', 'entity:dosage', 'event:have', 'operator:should'],
      edges: [
        'edge:document-entity',
        'edge:recommendation-dosage',
        'edge:dosage-event',
        'edge:event-operator',
      ],
    });
    expect(graph.shortestPath('operator:should', 'doc:isolated')).toBeUndefined();
  });

  it('keeps focus keys stable and prefers producer edge labels', () => {
    const graph = model();
    expect(
      graphFocusKey({
        kind: 'entity',
        label: 'Recommendation',
        sentence: 1,
        sentences: [2, 1, 2],
        lines: [22, 20],
      }),
    ).toBe('\u001fentity\u001fRecommendation\u001f\u001f1\u001f1,2\u001f20,22\u001f\u001f');
    expect(graphRelationLabel(graph.data.edges[0] as (typeof graph.data.edges)[number])).toBe(
      'declares entity',
    );
  });
});
