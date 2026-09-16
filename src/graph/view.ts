import { graphEdgeLabel, graphRelation, type GraphPath, type GraphSubgraph } from './model.js';

export interface EdgeView {
  id: string;
  source: string;
  target: string;
  relation: string;
  scope: readonly string[];
  farScope: readonly string[] | null;
  state: 'context' | 'highlight';
  dashed: boolean;
  label: string | null;
}

export const edgeLabel = graphEdgeLabel;

export interface EdgeCapDisclosure {
  removed: number;
  splitRelations: number;
}

const relationIdentity = (edge: EdgeView): string =>
  JSON.stringify([edge.source, edge.target, edge.relation]);

const edgeVariantIdentity = (edge: EdgeView): string =>
  JSON.stringify([edge.source, edge.target, edge.relation, edge.scope, edge.farScope]);

/** Count removed rows separately from shown relation identities missing scope variants. */
export const edgeCapDisclosure = (
  shown: readonly EdgeView[],
  all: readonly EdgeView[],
): EdgeCapDisclosure => {
  const shownVariants = new Set(shown.map(edgeVariantIdentity));
  const shownRelations = new Set(shown.map(relationIdentity));
  const removed = all.filter((edge) => !shownVariants.has(edgeVariantIdentity(edge)));
  return Object.freeze({
    removed: removed.length,
    splitRelations: new Set(
      removed.flatMap((edge) => {
        const identity = relationIdentity(edge);
        return shownRelations.has(identity) ? [identity] : [];
      }),
    ).size,
  });
};

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
  return edgeLabel(relation, edge.scope, edge.farScope);
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
      const farScope =
        edge.farScopeOperators === undefined ? null : Object.freeze([...edge.farScopeOperators]);
      const relation = graphRelation(edge);
      return Object.freeze({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation,
        scope,
        farScope,
        state: highlighted.has(edge.id) ? 'highlight' : 'context',
        dashed: scope.includes('-') || (farScope?.includes('-') ?? false),
        label: edgeLabel(relation, scope, farScope),
      });
    }),
  );
};
