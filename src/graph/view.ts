import { graphRelation, type GraphPath, type GraphSubgraph } from './model.js';

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

const scopeLabel = (operator: string): string => (operator === '-' ? 'negated' : operator);

export const edgeLabel = (relation: string, scope: readonly string[]): string =>
  scope.length === 0 ? relation : [relation, ...scope.map(scopeLabel)].join(' · ');

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
