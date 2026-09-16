import { graphEdgeLabel, graphRelation, type GraphPath, type GraphSubgraph } from './model.js';

export interface EdgeView {
  id: string;
  source: string;
  target: string;
  relation: string;
  scope: readonly string[];
  state: 'context' | 'highlight';
  dashed: boolean;
  label: string | null;
}

export const edgeLabel = graphEdgeLabel;

const REVERSED_RELATIONS: Readonly<Record<string, string>> = Object.freeze({
  actor: 'acts in',
  target: 'target of',
  participant: 'participates in',
  action: 'action for',
  'condition supports': 'supported by condition',
});

/** Read an edge from either endpoint without changing or reordering its scope. */
export const edgeLabelFrom = (edge: EdgeView, from: string): string | null => {
  if (edge.label === null) return null;
  const relation =
    from === edge.target ? (REVERSED_RELATIONS[edge.relation] ?? edge.relation) : edge.relation;
  return edgeLabel(relation, edge.scope);
};

/** Produce the renderer-neutral edge state once for every visible relationship. */
export const edgeViewsOf = (
  subgraph: GraphSubgraph,
  path: GraphPath | null,
): readonly EdgeView[] => {
  const highlighted = new Set(path?.edges ?? []);
  return Object.freeze(
    subgraph.edges.map((edge) => {
      const scope = Object.freeze([...(edge.scopeOperators ?? [])]);
      const relation = graphRelation(edge);
      return Object.freeze({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation,
        scope,
        state: highlighted.has(edge.id) ? 'highlight' : 'context',
        dashed: scope.includes('-'),
        label: edgeLabel(relation, scope),
      });
    }),
  );
};
