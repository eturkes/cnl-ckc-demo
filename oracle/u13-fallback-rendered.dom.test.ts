import { mount, tick, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { SemanticGraphModel, parseSemanticGraph } from '../src/graph/model.js';
import FallbackHarness from './FallbackHarness.svelte';
import {
  deriveProjection,
  expectedFallbackReading,
  readAsset,
} from './u13-oracle.mjs';

vi.mock('../src/graph/canvas.js', () => ({
  mountGraphCanvas: vi.fn(async () => ({
    update: () => undefined,
    recenter: () => undefined,
    destroy: () => undefined,
  })),
}));

const NODE_KINDS = ['document', 'entity', 'event', 'operator-context', 'value'];
const EDGE_KINDS = [
  'entity',
  'cardinality',
  'event',
  'argument',
  'preposition',
  'property',
  'operator',
  'implies',
];

const fixture = (full: any, edges: any[]) => {
  const ids = new Set(edges.flatMap(({ source, target }) => [source, target]));
  const nodes = full.nodes.filter(({ id }: any) => ids.has(id));
  const count = (values: any[], kinds: string[]) =>
    Object.fromEntries(kinds.map((kind) => [kind, values.filter((value) => value.kind === kind).length]));
  return {
    schemaVersion: full.schemaVersion,
    nodes,
    edges,
    scopes: full.scopes,
    stats: {
      documents: nodes.filter(({ kind }: any) => kind === 'document').length,
      clauses: 0,
      nodes: nodes.length,
      edges: edges.length,
      byNodeKind: count(nodes, NODE_KINDS),
      byEdgeKind: count(edges, EDGE_KINDS),
    },
  };
};

const boundedDegreeBatches = (edges: any[], limit: number): any[][] => {
  const globalDegree = new Map<string, number>();
  for (const { source, target } of edges) {
    globalDegree.set(source, (globalDegree.get(source) ?? 0) + 1);
    globalDegree.set(target, (globalDegree.get(target) ?? 0) + 1);
  }
  const ordered = [...edges].sort(
    (left, right) =>
      Math.max(globalDegree.get(right.source) ?? 0, globalDegree.get(right.target) ?? 0) -
        Math.max(globalDegree.get(left.source) ?? 0, globalDegree.get(left.target) ?? 0) ||
      left.id.localeCompare(right.id),
  );
  const batches: { edges: any[]; degree: Map<string, number> }[] = [];
  for (const edge of ordered) {
    const candidates = batches
      .filter(
        ({ degree }) =>
          (degree.get(edge.source) ?? 0) < limit && (degree.get(edge.target) ?? 0) < limit,
      )
      .sort(
        (left, right) =>
          (left.degree.get(edge.source) ?? 0) +
          (left.degree.get(edge.target) ?? 0) -
          (right.degree.get(edge.source) ?? 0) -
          (right.degree.get(edge.target) ?? 0),
      );
    const batch = candidates[0] ?? { edges: [], degree: new Map<string, number>() };
    if (candidates.length === 0) batches.push(batch);
    batch.edges.push(edge);
    batch.degree.set(edge.source, (batch.degree.get(edge.source) ?? 0) + 1);
    batch.degree.set(edge.target, (batch.degree.get(edge.target) ?? 0) + 1);
  }
  return batches.map(({ edges: batch }) => batch);
};

describe('u13 base fallback rendered text', () => {
  it('renders every model scope in target-side HTML relation text', async () => {
    const full = readAsset();
    const groups = deriveProjection(full);
    const rawById = new Map(full.edges.map((edge: any) => [edge.id, edge]));
    const rawRepresentatives = groups.map(({ representative }: any) => rawById.get(representative.id));
    const batches = boundedDegreeBatches(rawRepresentatives, 60);
    const rendered = new Map<string, string>();

    for (const rawEdges of batches) {
      const data = fixture(full, rawEdges);
      const model = new SemanticGraphModel(parseSemanticGraph(data));
      const targets = [...new Set(rawEdges.map(({ target }: any) => target))];
      const host = document.createElement('div');
      document.body.append(host);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );
      const app = mount(FallbackHarness, {
        target: host,
        props: { initial: targets[0] },
      });
      await vi.waitFor(() => expect(host.querySelector('.counts')).not.toBeNull(), {
        timeout: 10_000,
      });

      for (const target of targets) {
        app.select(target);
        await tick();
        await tick();
        const incident = model.conceptIncident(target);
        await vi.waitFor(
          () => expect(host.querySelectorAll('.relations .relation')).toHaveLength(incident.length),
          { timeout: 2_000 },
        );
        const texts = [...host.querySelectorAll('.relations .relation')].map(
          (element) => element.textContent ?? '',
        );
        for (const [index, edge] of incident.entries()) {
          if (edge.target === target) rendered.set(edge.id, texts[index] ?? '');
        }
      }
      await unmount(app);
      host.remove();
      vi.unstubAllGlobals();
    }

    const scoped = groups.filter(({ representative }: any) => representative.scope.length > 0);
    const exact = groups.filter(
      ({ representative }: any) =>
        rendered.get(representative.id) ===
        expectedFallbackReading(representative, representative.target),
    );
    const present = scoped.filter(({ representative }: any) => {
      const suffix = representative.scope
        .map((operator: string) => (operator === '-' ? 'negated' : operator))
        .join(' · ');
      return rendered.get(representative.id)?.endsWith(` · ${suffix}`) ?? false;
    });
    const examples = ['edge:3953:0', 'edge:506:8', 'edge:513:0'].map(
      (id) => `${id}=${JSON.stringify(rendered.get(id))}`,
    );
    console.log(
      `O3-rendered groups=${String(groups.length)} scoped=${String(scoped.length)} ` +
        `scope-present=${String(present.length)} exact=${String(exact.length)} ` +
        `batches=${String(batches.length)} examples=${examples.join('; ')}`,
    );

    expect(groups).toHaveLength(2630);
    expect(scoped).toHaveLength(1584);
    expect(rendered.size).toBe(groups.length);
    expect(exact).toHaveLength(groups.length);
    expect(present).toHaveLength(scoped.length);
  }, 120_000);
});
