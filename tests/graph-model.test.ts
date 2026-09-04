import { describe, expect, it } from 'vitest';

import {
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
    expect(Object.isFrozen(parsed.nodes)).toBe(true);
  });

  it.each([
    ['schema drift', { ...GRAPH_FIXTURE, schemaVersion: 2 }],
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
