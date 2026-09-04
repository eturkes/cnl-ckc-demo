import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  GRAPH_EDGE_KINDS,
  GRAPH_NODE_KINDS,
  SemanticGraphModel,
  parseSemanticGraph,
} from '../src/graph/model.js';

const PATH = fileURLToPath(new URL('../kb/generated/graph/semantic-graph.json', import.meta.url));
const input: unknown = JSON.parse(readFileSync(PATH, 'utf8'));
const graph = parseSemanticGraph(input);

describe('generated semantic graph', () => {
  it('passes the runtime boundary with every declared node and edge kind', () => {
    expect([...new Set(graph.nodes.map(({ kind }) => kind))].sort()).toEqual(
      [...GRAPH_NODE_KINDS].sort(),
    );
    expect([...new Set(graph.edges.map(({ kind }) => kind))].sort()).toEqual(
      [...GRAPH_EDGE_KINDS].sort(),
    );
    expect(graph.stats.nodes).toBe(graph.nodes.length);
    expect(graph.stats.edges).toBe(graph.edges.length);
    expect(graph.stats.documents).toBeGreaterThan(0);
    expect(graph.stats.byEdgeKind['implies']).toBeGreaterThan(0);
  });

  it('opens a bounded, connected document neighborhood', () => {
    const model = new SemanticGraphModel(graph);
    const document = graph.nodes.find(({ kind }) => kind === 'document');
    if (document === undefined) throw new Error('generated graph contains no document node');
    const neighborhood = model.neighborhood(document.id);
    expect(neighborhood.nodes[0]).toBe(document);
    expect(neighborhood.nodes.length).toBeGreaterThan(1);
    expect(neighborhood.nodes.length).toBeLessThanOrEqual(80);
    expect(neighborhood.edges.length).toBeGreaterThan(0);
    expect(model.search(document.label, 1)[0]).toBe(document);
  });
});
