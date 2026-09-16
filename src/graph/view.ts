import {
  graphEdgeLabel,
  graphRelation,
  scopeReading,
  type GraphPath,
  type GraphSubgraph,
} from './model.js';

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

// Separator joins, never JSON: `kb:asset-check` refuses a serializing call anywhere in `src/`,
// because a serialized oracle is the shape a hard-coded answer would take on its way to the
// page. `model.ts` keys the same way. `\u0000` marks an absent far end, which no operator can
// collide with, so a null far scope stays distinct from an empty one.
const FIELD = '\u001f';
const GROUP = '\u001e';

const relationIdentity = (edge: EdgeView): string =>
  [edge.source, edge.target, edge.relation].join(FIELD);

const edgeVariantIdentity = (edge: EdgeView): string =>
  [
    edge.source,
    edge.target,
    edge.relation,
    edge.scope.join(FIELD),
    edge.farScope === null ? '\u0000' : edge.farScope.join(FIELD),
  ].join(GROUP);

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

/**
 * Read an edge from either endpoint. The fields are direction-fixed, but the READING is
 * reader-relative (user ruling): the node you selected reports its own end first and `→` always
 * points at the other end, away from you. Pinning the label to the edge instead would render
 * `supported by condition → should` while the reader stands on the `should` node.
 */
export const edgeLabelFrom = (edge: EdgeView, from: string): string | null => {
  if (edge.label === null) return null;
  const atTarget = from === edge.target;
  const relation = atTarget ? (REVERSED_RELATIONS[edge.relation] ?? edge.relation) : edge.relation;
  const { near, far } = scopeReading(edge.scope, edge.farScope, atTarget);
  return edgeLabel(relation, near, far);
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
