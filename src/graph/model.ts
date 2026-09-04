export const GRAPH_SCHEMA_VERSION = 1;
export const DEFAULT_NEIGHBOR_LIMIT = 80;
export const MAX_NEIGHBOR_LIMIT = 240;
export const DEFAULT_EDGE_LIMIT = 480;

export const GRAPH_NODE_KINDS = [
  'document',
  'entity',
  'event',
  'operator-context',
  'value',
] as const;
export type SemanticGraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

export const GRAPH_EDGE_KINDS = [
  'entity',
  'cardinality',
  'event',
  'argument',
  'preposition',
  'property',
  'operator',
  'implies',
] as const;
export type SemanticGraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number];

export interface SemanticGraphNode {
  id: string;
  kind: SemanticGraphNodeKind;
  label: string;
  document?: string;
  sentence?: number;
}

export interface SemanticGraphEdge {
  id: string;
  kind: SemanticGraphEdgeKind;
  source: string;
  target: string;
  label: string;
  document: string;
  sentence: number | null;
  line: number;
  predicate: string;
}

export interface SemanticGraphStats {
  documents: number;
  clauses: number;
  nodes: number;
  edges: number;
  byNodeKind: Readonly<Record<string, number>>;
  byEdgeKind: Readonly<Record<string, number>>;
}

export interface SemanticGraphData {
  schemaVersion: typeof GRAPH_SCHEMA_VERSION;
  nodes: readonly SemanticGraphNode[];
  edges: readonly SemanticGraphEdge[];
  stats: SemanticGraphStats;
}

export interface GraphFocusToken {
  /** Stable graph id. This wins over every descriptive field. */
  id?: string;
  /** Producer node kind, for example `document`, `noun`, `event`, or `operator`. */
  kind?: string;
  label?: string;
  document?: string;
  sentence?: number;
}

export type GraphFocus = string | GraphFocusToken;

export interface GraphSubgraph {
  nodes: readonly SemanticGraphNode[];
  edges: readonly SemanticGraphEdge[];
  truncatedNodes: boolean;
  truncatedEdges: boolean;
}

export interface GraphPath {
  nodes: readonly string[];
  edges: readonly string[];
}

export class GraphDataError extends Error {
  override name = 'GraphDataError';
}

const hasForbiddenText = (value: string): boolean =>
  [...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return (
      point <= 8 ||
      point === 11 ||
      point === 12 ||
      (point >= 14 && point <= 31) ||
      point === 127 ||
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069)
    );
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, at: string): string => {
  if (typeof value !== 'string' || value.trim() === '' || hasForbiddenText(value)) {
    throw new GraphDataError(`${at} must be non-empty safe text`);
  }
  return value;
};

const optionalText = (
  source: Record<string, unknown>,
  key: string,
  at: string,
): string | undefined =>
  source[key] === undefined ? undefined : text(source[key], `${at}.${key}`);

const integer = (value: unknown, at: string, minimum = 0): number => {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) {
    throw new GraphDataError(`${at} must be a safe integer of at least ${String(minimum)}`);
  }
  return Number(value);
};

const enumText = <T extends string>(value: unknown, allowed: readonly T[], at: string): T => {
  const parsed = text(value, at);
  if (!(allowed as readonly string[]).includes(parsed)) {
    throw new GraphDataError(`${at} has unknown value ${parsed}`);
  }
  return parsed as T;
};

const parseNode = (value: unknown, index: number): SemanticGraphNode => {
  const at = `nodes[${String(index)}]`;
  if (!isRecord(value)) throw new GraphDataError(`${at} must be an object`);
  const document = optionalText(value, 'document', at);
  const sentence =
    value.sentence === undefined ? undefined : integer(value.sentence, `${at}.sentence`, 1);
  return Object.freeze({
    id: text(value.id, `${at}.id`),
    kind: enumText(value.kind, GRAPH_NODE_KINDS, `${at}.kind`),
    label: text(value.label, `${at}.label`),
    ...(document === undefined ? {} : { document }),
    ...(sentence === undefined ? {} : { sentence }),
  });
};

const parseEdge = (value: unknown, index: number): SemanticGraphEdge => {
  const at = `edges[${String(index)}]`;
  if (!isRecord(value)) throw new GraphDataError(`${at} must be an object`);
  const sentence = value.sentence === null ? null : integer(value.sentence, `${at}.sentence`, 1);
  return Object.freeze({
    id: text(value.id, `${at}.id`),
    kind: enumText(value.kind, GRAPH_EDGE_KINDS, `${at}.kind`),
    source: text(value.source, `${at}.source`),
    target: text(value.target, `${at}.target`),
    label: text(value.label, `${at}.label`),
    document: text(value.document, `${at}.document`),
    sentence,
    line: integer(value.line, `${at}.line`, 1),
    predicate: text(value.predicate, `${at}.predicate`),
  });
};

const countRecord = (value: unknown, at: string): Readonly<Record<string, number>> => {
  if (!isRecord(value)) throw new GraphDataError(`${at} must be an object`);
  const output: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [key, count] of Object.entries(value)) {
    text(key, `${at} key`);
    output[key] = integer(count, `${at}.${key}`);
  }
  return Object.freeze(output);
};

const parseStats = (value: unknown): SemanticGraphStats => {
  if (!isRecord(value)) throw new GraphDataError('stats must be an object');
  return Object.freeze({
    documents: integer(value.documents, 'stats.documents'),
    clauses: integer(value.clauses, 'stats.clauses'),
    nodes: integer(value.nodes, 'stats.nodes'),
    edges: integer(value.edges, 'stats.edges'),
    byNodeKind: countRecord(value.byNodeKind, 'stats.byNodeKind'),
    byEdgeKind: countRecord(value.byEdgeKind, 'stats.byEdgeKind'),
  });
};

/** Parse and freeze the producer boundary before any graph library sees it. */
export const parseSemanticGraph = (value: unknown): SemanticGraphData => {
  if (!isRecord(value)) throw new GraphDataError('semantic graph must be an object');
  if (value.schemaVersion !== GRAPH_SCHEMA_VERSION) {
    throw new GraphDataError(
      `semantic graph schema ${String(value.schemaVersion)}, expected ${String(GRAPH_SCHEMA_VERSION)}`,
    );
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new GraphDataError('semantic graph must contain node and edge arrays');
  }
  const nodes = value.nodes.map(parseNode);
  const edges = value.edges.map(parseEdge);
  const stats = parseStats(value.stats);
  if (nodes.length === 0) throw new GraphDataError('semantic graph contains no nodes');
  if (stats.nodes !== nodes.length || stats.edges !== edges.length) {
    throw new GraphDataError(
      `stats record ${String(stats.nodes)}/${String(stats.edges)}, parsed ${String(nodes.length)}/${String(edges.length)}`,
    );
  }

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw new GraphDataError(`duplicate node id ${node.id}`);
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) throw new GraphDataError(`duplicate edge id ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source))
      throw new GraphDataError(`${edge.id}: missing source ${edge.source}`);
    if (!nodeIds.has(edge.target))
      throw new GraphDataError(`${edge.id}: missing target ${edge.target}`);
  }
  const actualNodeKinds = Object.fromEntries(
    GRAPH_NODE_KINDS.map((kind) => [kind, nodes.filter((node) => node.kind === kind).length]),
  );
  const actualEdgeKinds = Object.fromEntries(
    GRAPH_EDGE_KINDS.map((kind) => [kind, edges.filter((edge) => edge.kind === kind).length]),
  );
  for (const kind of GRAPH_NODE_KINDS) {
    if ((stats.byNodeKind[kind] ?? 0) !== actualNodeKinds[kind]) {
      throw new GraphDataError(`stats.byNodeKind.${kind} disagrees with parsed nodes`);
    }
  }
  for (const kind of GRAPH_EDGE_KINDS) {
    if ((stats.byEdgeKind[kind] ?? 0) !== actualEdgeKinds[kind]) {
      throw new GraphDataError(`stats.byEdgeKind.${kind} disagrees with parsed edges`);
    }
  }
  if (stats.documents !== actualNodeKinds.document) {
    throw new GraphDataError('stats.documents disagrees with document nodes');
  }
  return Object.freeze({
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    stats,
  });
};

const normalized = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase('en-US')
    .trim();

const words = (value: string): readonly string[] =>
  normalized(value).split(/[^\p{Letter}\p{Number}]+/u);

const compareNodes = (left: SemanticGraphNode, right: SemanticGraphNode): number =>
  left.label.localeCompare(right.label, 'en', { sensitivity: 'base', numeric: true }) ||
  left.kind.localeCompare(right.kind) ||
  left.id.localeCompare(right.id);

const compareEdges = (left: SemanticGraphEdge, right: SemanticGraphEdge): number =>
  left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);

const otherEnd = (edge: SemanticGraphEdge, id: string): string =>
  edge.source === id ? edge.target : edge.source;

interface SearchRow {
  node: SemanticGraphNode;
  label: string;
  id: string;
  kind: string;
  metadata: string;
  words: readonly string[];
}

/** Immutable indexes and deterministic graph operations shared by both views. */
export class SemanticGraphModel {
  readonly data: SemanticGraphData;
  readonly #nodes = new Map<string, SemanticGraphNode>();
  readonly #edges = new Map<string, SemanticGraphEdge>();
  readonly #adjacent = new Map<string, readonly SemanticGraphEdge[]>();
  readonly #search: readonly SearchRow[];

  constructor(data: SemanticGraphData) {
    this.data = data;
    for (const node of data.nodes) this.#nodes.set(node.id, node);
    for (const edge of data.edges) this.#edges.set(edge.id, edge);

    const adjacent = new Map<string, SemanticGraphEdge[]>();
    for (const node of data.nodes) adjacent.set(node.id, []);
    for (const edge of data.edges) {
      adjacent.get(edge.source)?.push(edge);
      if (edge.target !== edge.source) adjacent.get(edge.target)?.push(edge);
    }
    for (const [id, edges] of adjacent) {
      this.#adjacent.set(id, Object.freeze(edges.sort(compareEdges)));
    }

    this.#search = Object.freeze(
      data.nodes.map((node) => {
        const metadata = normalized(
          [node.document, node.sentence === undefined ? undefined : String(node.sentence)]
            .filter(Boolean)
            .join(' '),
        );
        return {
          node,
          label: normalized(node.label),
          id: normalized(node.id),
          kind: normalized(node.kind),
          metadata,
          words: words(node.label),
        };
      }),
    );
  }

  node(id: string): SemanticGraphNode | undefined {
    return this.#nodes.get(id);
  }

  edge(id: string): SemanticGraphEdge | undefined {
    return this.#edges.get(id);
  }

  incident(id: string): readonly SemanticGraphEdge[] {
    return this.#adjacent.get(id) ?? [];
  }

  search(query: string, limit = 24): readonly SemanticGraphNode[] {
    const needle = normalized(query);
    if (needle === '' || limit < 1) return [];
    const terms = needle.split(/\s+/u);
    const ranked: { node: SemanticGraphNode; score: number }[] = [];
    for (const row of this.#search) {
      const haystack = `${row.label} ${row.id} ${row.kind} ${row.metadata}`;
      if (!terms.every((term) => haystack.includes(term))) continue;
      const score =
        row.id === needle || row.label === needle
          ? 0
          : row.label.startsWith(needle)
            ? 1
            : row.words.some((word) => word.startsWith(needle))
              ? 2
              : row.kind === needle
                ? 3
                : row.label.includes(needle)
                  ? 4
                  : row.id.includes(needle)
                    ? 5
                    : 6;
      ranked.push({ node: row.node, score });
    }
    ranked.sort(({ node: a, score: aScore }, { node: b, score: bScore }) =>
      aScore === bScore ? compareNodes(a, b) : aScore - bScore,
    );
    return ranked.slice(0, limit).map(({ node }) => node);
  }

  resolveFocus(focus: GraphFocus): SemanticGraphNode | undefined {
    if (typeof focus === 'string') return this.node(focus) ?? this.search(focus, 1)[0];
    if (focus.id !== undefined) {
      const direct = this.node(focus.id);
      if (direct !== undefined) return direct;
    }
    const expected = {
      kind: focus.kind === undefined ? undefined : normalized(focus.kind),
      label: focus.label === undefined ? undefined : normalized(focus.label),
      document: focus.document === undefined ? undefined : normalized(focus.document),
      sentence: focus.sentence,
    };
    return this.data.nodes.find(
      (node) =>
        (expected.kind === undefined || normalized(node.kind) === expected.kind) &&
        (expected.label === undefined || normalized(node.label) === expected.label) &&
        (expected.document === undefined ||
          normalized(node.document ?? '') === expected.document) &&
        (expected.sentence === undefined || node.sentence === expected.sentence),
    );
  }

  neighborhood(
    root: string,
    depth = 1,
    nodeLimit = DEFAULT_NEIGHBOR_LIMIT,
    include: readonly string[] = [],
    includeEdges: readonly string[] = [],
  ): GraphSubgraph {
    if (!this.#nodes.has(root)) {
      return { nodes: [], edges: [], truncatedNodes: false, truncatedEdges: false };
    }
    const limit = Math.max(1, Math.min(MAX_NEIGHBOR_LIMIT, Math.trunc(nodeLimit)));
    const selected = new Set<string>([root]);
    const queue: { id: string; depth: number }[] = [{ id: root, depth: 0 }];
    let truncatedNodes = false;
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === undefined || current.depth >= depth) continue;
      const candidates = this.incident(current.id)
        .map((edge) => otherEnd(edge, current.id))
        .filter((id, position, ids) => ids.indexOf(id) === position)
        .sort((left, right) =>
          compareNodes(
            this.#nodes.get(left) as SemanticGraphNode,
            this.#nodes.get(right) as SemanticGraphNode,
          ),
        );
      for (const id of candidates) {
        if (selected.has(id)) continue;
        if (selected.size >= limit) {
          truncatedNodes = true;
          continue;
        }
        selected.add(id);
        queue.push({ id, depth: current.depth + 1 });
      }
    }
    for (const id of include) {
      if (this.#nodes.has(id)) selected.add(id);
    }

    const nodes = [...selected]
      .map((id) => this.#nodes.get(id) as SemanticGraphNode)
      .sort((left, right) =>
        left.id === root ? -1 : right.id === root ? 1 : compareNodes(left, right),
      );
    const preferredEdges = new Set(includeEdges);
    const allEdges = this.data.edges
      .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
      .sort((left, right) => {
        const preferred =
          Number(preferredEdges.has(right.id)) - Number(preferredEdges.has(left.id));
        return preferred || compareEdges(left, right);
      });
    const edges = allEdges.slice(0, DEFAULT_EDGE_LIMIT);
    return {
      nodes,
      edges,
      truncatedNodes,
      truncatedEdges: edges.length < allEdges.length,
    };
  }

  shortestPath(source: string, target: string): GraphPath | undefined {
    if (!this.#nodes.has(source) || !this.#nodes.has(target)) return undefined;
    if (source === target) return { nodes: [source], edges: [] };
    const seen = new Set<string>([source]);
    const queue = [source];
    const previous = new Map<string, { node: string; edge: string }>();
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === undefined) break;
      for (const edge of this.incident(current)) {
        const next = otherEnd(edge, current);
        if (seen.has(next)) continue;
        seen.add(next);
        previous.set(next, { node: current, edge: edge.id });
        if (next === target) {
          const nodes = [target];
          const edges: string[] = [];
          let cursor = target;
          while (cursor !== source) {
            const step = previous.get(cursor);
            if (step === undefined) return undefined;
            nodes.push(step.node);
            edges.push(step.edge);
            cursor = step.node;
          }
          return { nodes: nodes.reverse(), edges: edges.reverse() };
        }
        queue.push(next);
      }
    }
    return undefined;
  }
}

export const graphFocusKey = (focus: GraphFocus | null): string => {
  if (focus === null) return '';
  if (typeof focus === 'string') return `id:${focus}`;
  return [focus.id, focus.kind, focus.label, focus.document, focus.sentence]
    .map((value) => value ?? '')
    .join('\u001f');
};

export const graphRelationLabel = (edge: SemanticGraphEdge): string =>
  edge.label ?? edge.kind.replace(/[_-]+/gu, ' ');
