export const GRAPH_SCHEMA_VERSION = 1;
export const DEFAULT_NEIGHBOR_LIMIT = 80;
export const MAX_NEIGHBOR_LIMIT = 240;
export const DEFAULT_EDGE_LIMIT = 480;
export const DEFAULT_ANSWER_GRAPH_LIMIT = 24;
export const MAX_ANSWER_GRAPH_LIMIT = 72;

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
  /** All controlled sentences represented by the selected answer contribution. */
  sentences?: readonly number[];
  /** Exact compiled clause lines in the live proof, used when sentence metadata is absent. */
  lines?: readonly number[];
  /** Reader-visible question used only to rank the primary concept. */
  question?: string;
  /** Deterministically rendered answer contribution used only to rank the primary concept. */
  answer?: string;
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

export interface GraphEvidenceSubgraph extends GraphSubgraph {
  document: string;
  sentences: readonly number[];
  lines: readonly number[];
}

/** Reader-facing ontology projection around one cited answer contribution. */
export interface GraphAnswerView extends GraphEvidenceSubgraph {
  /** Entity or action the question and answer are principally about. */
  root: string;
  /** Concept relationships carried by the live proof, highlighted over broader context. */
  highlight: GraphPath;
  /** Low-level compiled nodes omitted from the concept map but retained in provenance. */
  hiddenTechnicalNodes: number;
  /** Low-level compiled relationships omitted from the concept map but retained in provenance. */
  hiddenTechnicalEdges: number;
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
  normalized(value)
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((word) => word !== '');

const singular = (word: string): string => {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

const lexicalWords = (value: string): readonly string[] => words(value).map(singular);

const phraseIncludes = (haystack: readonly string[], needle: readonly string[]): boolean => {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  return haystack.some(
    (_word, index) =>
      index + needle.length <= haystack.length &&
      needle.every((word, offset) => haystack[index + offset] === word),
  );
};

const lexicalScore = (label: string, text: string, phraseWeight: number): number => {
  const labelWords = lexicalWords(label);
  const textWords = lexicalWords(text);
  const textSet = new Set(textWords);
  const overlap = labelWords.filter((word) => textSet.has(word)).length;
  return (
    (phraseIncludes(textWords, labelWords) ? phraseWeight : 0) +
    overlap * 320 +
    (labelWords.length > 0 ? Math.round((overlap / labelWords.length) * 120) : 0)
  );
};

const compareNodes = (left: SemanticGraphNode, right: SemanticGraphNode): number =>
  left.label.localeCompare(right.label, 'en', { sensitivity: 'base', numeric: true }) ||
  left.kind.localeCompare(right.kind) ||
  left.id.localeCompare(right.id);

const compareEdges = (left: SemanticGraphEdge, right: SemanticGraphEdge): number =>
  left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);

const otherEnd = (edge: SemanticGraphEdge, id: string): string =>
  edge.source === id ? edge.target : edge.source;

const CONCEPT_NODE_KINDS: ReadonlySet<SemanticGraphNodeKind> = new Set([
  'entity',
  'event',
  'value',
]);

const isConceptNode = (node: SemanticGraphNode | undefined): node is SemanticGraphNode =>
  node !== undefined && CONCEPT_NODE_KINDS.has(node.kind);

const conceptEdgeKey = (edge: SemanticGraphEdge): string =>
  [edge.kind, edge.source, edge.target, edge.label].join('\u001f');

const isConceptRelationship = (
  edge: SemanticGraphEdge,
  nodes: ReadonlyMap<string, SemanticGraphNode>,
): boolean =>
  edge.kind !== 'cardinality' &&
  edge.kind !== 'operator' &&
  (edge.kind !== 'implies' || edge.label === 'condition supports') &&
  isConceptNode(nodes.get(edge.source)) &&
  isConceptNode(nodes.get(edge.target));

const conceptRole = (edge: SemanticGraphEdge): number => {
  if (edge.kind === 'argument') {
    if (edge.label === 'argument 2') return 4;
    if (edge.label === 'argument 1') return 1;
    return 3;
  }
  if (edge.kind === 'preposition') return 3;
  if (edge.kind === 'property') return 2;
  return 1;
};

const positiveIntegers = (values: readonly number[]): readonly number[] =>
  [...new Set(values.filter((value) => Number.isSafeInteger(value) && value > 0))].sort(
    (left, right) => left - right,
  );

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
  readonly #conceptGroups = new Map<string, readonly SemanticGraphEdge[]>();
  readonly #conceptAdjacent = new Map<string, readonly SemanticGraphEdge[]>();
  readonly #conceptNodeIds = new Set<string>();
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

    const conceptGroups = new Map<string, SemanticGraphEdge[]>();
    for (const edge of data.edges) {
      if (!isConceptRelationship(edge, this.#nodes)) continue;
      const key = conceptEdgeKey(edge);
      const group = conceptGroups.get(key) ?? [];
      group.push(edge);
      conceptGroups.set(key, group);
      this.#conceptNodeIds.add(edge.source);
      this.#conceptNodeIds.add(edge.target);
    }
    const conceptAdjacent = new Map<string, SemanticGraphEdge[]>();
    for (const id of this.#conceptNodeIds) conceptAdjacent.set(id, []);
    for (const [key, group] of conceptGroups) {
      group.sort((left, right) => left.line - right.line || compareEdges(left, right));
      const frozen = Object.freeze(group);
      this.#conceptGroups.set(key, frozen);
      const representative = frozen[0];
      if (representative === undefined) continue;
      conceptAdjacent.get(representative.source)?.push(representative);
      if (representative.target !== representative.source) {
        conceptAdjacent.get(representative.target)?.push(representative);
      }
    }
    for (const [id, edges] of conceptAdjacent) {
      this.#conceptAdjacent.set(id, Object.freeze(edges.sort(compareEdges)));
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

  /** Search the reader-facing ontology, excluding documents and parser/modality nodes. */
  searchConcepts(query: string, limit = 24): readonly SemanticGraphNode[] {
    if (limit < 1) return [];
    return this.search(query, this.#search.length)
      .filter((node) => this.#conceptNodeIds.has(node.id))
      .slice(0, limit);
  }

  get conceptNodeCount(): number {
    return this.#conceptNodeIds.size;
  }

  get conceptEdgeCount(): number {
    return this.#conceptGroups.size;
  }

  defaultConcept(preferred = ''): SemanticGraphNode | undefined {
    const requested = preferred === '' ? undefined : this.searchConcepts(preferred, 1)[0];
    return (
      requested ??
      this.data.nodes.find((node) => node.kind === 'entity' && this.#conceptNodeIds.has(node.id)) ??
      this.data.nodes.find((node) => this.#conceptNodeIds.has(node.id))
    );
  }

  conceptIncident(id: string): readonly SemanticGraphEdge[] {
    return this.#conceptAdjacent.get(id) ?? [];
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
      sentence: focus.sentence ?? positiveIntegers(focus.sentences ?? [])[0],
    };
    const lineOnly = (focus.lines?.length ?? 0) > 0 && expected.sentence === undefined;
    const direct = lineOnly
      ? undefined
      : this.data.nodes.find(
          (node) =>
            (expected.kind === undefined || normalized(node.kind) === expected.kind) &&
            (expected.label === undefined || normalized(node.label) === expected.label) &&
            (expected.document === undefined ||
              normalized(node.document ?? '') === expected.document) &&
            (expected.sentence === undefined || node.sentence === expected.sentence),
        );
    if (direct !== undefined) return direct;

    // Most reusable semantic nodes intentionally carry no source location. The
    // edge does, so a proof focus can still land on the exact clause endpoint.
    const evidence = this.evidenceSubgraph(focus);
    const primary = evidence?.edges.find((edge) => edge.kind !== 'implies') ?? evidence?.edges[0];
    if (primary === undefined) return undefined;
    const id =
      primary.kind === 'entity' || primary.kind === 'event' || primary.kind === 'operator'
        ? primary.target
        : primary.source;
    return this.node(id);
  }

  /**
   * Return only the relationships compiled from the cited controlled sentences.
   *
   * Proof lines are the strongest identity. Their sentence coordinates expand
   * the view from the proof's representative clause to every semantic relation
   * encoded by that same controlled sentence. A line without a sentence remains
   * visible as an exact-line fallback.
   */
  evidenceSubgraph(focus: GraphFocusToken): GraphEvidenceSubgraph | undefined {
    if (focus.document === undefined) return undefined;
    const document = normalized(focus.document);
    const requestedLines = positiveIntegers(focus.lines ?? []);
    const requestedSentences = positiveIntegers([
      ...(focus.sentences ?? []),
      ...(focus.sentence === undefined ? [] : [focus.sentence]),
    ]);
    if (requestedLines.length === 0 && requestedSentences.length === 0) return undefined;

    const lineSet = new Set(requestedLines);
    const sentenceSet = new Set(requestedSentences);
    for (const edge of this.data.edges) {
      if (normalized(edge.document) !== document || !lineSet.has(edge.line)) continue;
      if (edge.sentence !== null) sentenceSet.add(edge.sentence);
    }

    const edges = this.data.edges.filter(
      (edge) =>
        normalized(edge.document) === document &&
        ((edge.sentence !== null && sentenceSet.has(edge.sentence)) || lineSet.has(edge.line)),
    );
    if (edges.length === 0) return undefined;

    const nodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    return {
      document: focus.document,
      sentences: Object.freeze([...sentenceSet].sort((left, right) => left - right)),
      lines: Object.freeze(requestedLines),
      nodes: Object.freeze(
        [...nodeIds].map((id) => this.#nodes.get(id) as SemanticGraphNode).sort(compareNodes),
      ),
      edges: Object.freeze(
        [...edges].sort((left, right) => left.line - right.line || compareEdges(left, right)),
      ),
      truncatedNodes: false,
      truncatedEdges: false,
    };
  }

  #conceptRepresentatives(preferred = new Set<string>()): readonly SemanticGraphEdge[] {
    return [...this.#conceptGroups.values()]
      .flatMap((group) => {
        const representative = group.find((edge) => preferred.has(edge.id)) ?? group[0];
        return representative === undefined ? [] : [representative];
      })
      .sort((left, right) => left.line - right.line || compareEdges(left, right));
  }

  #primaryAnswerConcept(
    focus: GraphFocusToken,
    evidence: GraphEvidenceSubgraph,
    conceptEdges: readonly SemanticGraphEdge[],
  ): SemanticGraphNode | undefined {
    if (focus.id !== undefined) {
      const exact = this.#nodes.get(focus.id);
      if (isConceptNode(exact)) return exact;
    }
    const candidates = evidence.nodes.filter((node) => this.#conceptNodeIds.has(node.id));
    if (candidates.length === 0) return undefined;
    const entityCandidates = candidates.filter((node) => node.kind === 'entity');
    const eventCandidates = candidates.filter((node) => node.kind === 'event');
    const semanticRole = (node: SemanticGraphNode): number =>
      conceptEdges.reduce((best, edge) => {
        if (edge.target !== node.id && edge.source !== node.id) return best;
        const directionBonus = edge.target === node.id ? 1 : 0;
        return Math.max(best, conceptRole(edge) * 100 + directionBonus * 25);
      }, 0);
    // Universal actors such as "clinician" are graph participants, not the
    // clinical topic. Prefer an entity used as an object, condition or property
    // whenever the evidence supplies one, then apply lexical ranking.
    const topicalEntities = entityCandidates.filter((node) => semanticRole(node) > 225);
    const tier =
      topicalEntities.length > 0
        ? topicalEntities
        : entityCandidates.length > 0
          ? entityCandidates
          : eventCandidates.length > 0
            ? eventCandidates
            : candidates;
    const score = (node: SemanticGraphNode): number => {
      const documentSpread = new Set(this.conceptIncident(node.id).map((edge) => edge.document))
        .size;
      return (
        lexicalScore(node.label, focus.question ?? '', 5_000) +
        lexicalScore(node.label, focus.answer ?? '', 2_500) +
        semanticRole(node) +
        lexicalWords(node.label).length * 8 -
        Math.min(documentSpread, 300)
      );
    };
    return [...tier].sort(
      (left, right) => score(right) - score(left) || compareNodes(left, right),
    )[0];
  }

  /**
   * Project a proof's parser-level graph into a bounded clinical concept map.
   *
   * Documents, modal operators, cardinality scaffolding and Horn implication
   * edges remain available in `evidenceSubgraph`; this view keeps only relations
   * whose endpoints are entities, actions or meaningful values. Identical
   * relations asserted by several documents collapse to one visual edge, with a
   * cited edge preferred as the representative so the live proof can highlight it.
   */
  answerSubgraph(
    focus: GraphFocusToken,
    nodeLimit = DEFAULT_ANSWER_GRAPH_LIMIT,
  ): GraphAnswerView | undefined {
    const evidence = this.evidenceSubgraph(focus);
    if (evidence === undefined) return undefined;
    const rawEvidenceIds = new Set(evidence.edges.map((edge) => edge.id));
    const evidenceConceptEdges = evidence.edges.filter((edge) =>
      isConceptRelationship(edge, this.#nodes),
    );
    const root = this.#primaryAnswerConcept(focus, evidence, evidenceConceptEdges);
    if (root === undefined) return undefined;

    // Highlight the evidence component containing the primary concept. This
    // drops disconnected recommendation metadata without dropping any semantic
    // path that actually reaches the question's topic.
    const evidenceAdjacent = new Map<string, SemanticGraphEdge[]>();
    for (const edge of evidenceConceptEdges) {
      const source = evidenceAdjacent.get(edge.source) ?? [];
      source.push(edge);
      evidenceAdjacent.set(edge.source, source);
      const target = evidenceAdjacent.get(edge.target) ?? [];
      target.push(edge);
      evidenceAdjacent.set(edge.target, target);
    }
    const evidenceNodes = new Set<string>([root.id]);
    const queue = [root.id];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === undefined) continue;
      for (const edge of evidenceAdjacent.get(current) ?? []) {
        const next = otherEnd(edge, current);
        if (evidenceNodes.has(next)) continue;
        evidenceNodes.add(next);
        queue.push(next);
      }
    }
    const evidenceKeys = new Set(
      evidenceConceptEdges
        .filter((edge) => evidenceNodes.has(edge.source) && evidenceNodes.has(edge.target))
        .map(conceptEdgeKey),
    );
    const representatives = this.#conceptRepresentatives(rawEvidenceIds);
    const representativeByKey = new Map(
      representatives.map((edge) => [conceptEdgeKey(edge), edge] as const),
    );
    const highlightEdges = [...evidenceKeys]
      .flatMap((key) => {
        const edge = representativeByKey.get(key);
        return edge === undefined ? [] : [edge];
      })
      .sort((left, right) => left.line - right.line || compareEdges(left, right));

    const adjacent = new Map<string, SemanticGraphEdge[]>();
    for (const edge of representatives) {
      const source = adjacent.get(edge.source) ?? [];
      source.push(edge);
      adjacent.set(edge.source, source);
      const target = adjacent.get(edge.target) ?? [];
      target.push(edge);
      adjacent.set(edge.target, target);
    }
    const limit = Math.max(
      evidenceNodes.size,
      Math.min(MAX_ANSWER_GRAPH_LIMIT, Math.trunc(nodeLimit)),
    );
    const selected = new Set<string>(evidenceNodes);
    selected.add(root.id);
    const contextWords = `${focus.question ?? ''} ${focus.answer ?? ''}`;
    const edgeRank = (edge: SemanticGraphEdge, from: string): number => {
      const peer = this.#nodes.get(otherEnd(edge, from));
      const occurrences = this.#conceptGroups.get(conceptEdgeKey(edge))?.length ?? 1;
      return (
        (evidenceKeys.has(conceptEdgeKey(edge)) ? 20_000 : 0) +
        (peer === undefined ? 0 : lexicalScore(peer.label, contextWords, 2_000)) +
        conceptRole(edge) * 100 +
        Math.min(occurrences, 99)
      );
    };
    const rankedEdges = (id: string): SemanticGraphEdge[] =>
      [...(adjacent.get(id) ?? [])].sort(
        (left, right) =>
          edgeRank(right, id) - edgeRank(left, id) ||
          compareNodes(
            this.#nodes.get(otherEnd(left, id)) as SemanticGraphNode,
            this.#nodes.get(otherEnd(right, id)) as SemanticGraphNode,
          ) ||
          compareEdges(left, right),
      );

    // Keep every direct branch from the topic, then admit a few explanatory
    // peers per branch in rounds. This avoids one high-degree verb consuming the
    // entire view while still showing how the topic connects elsewhere.
    const directEdges = rankedEdges(root.id);
    const selectedEdgeKeys = new Set(evidenceKeys);
    const firstHop: string[] = [];
    for (const edge of directEdges) {
      const peer = otherEnd(edge, root.id);
      if (!selected.has(peer) && selected.size >= limit) break;
      selected.add(peer);
      selectedEdgeKeys.add(conceptEdgeKey(edge));
      if (!firstHop.includes(peer)) firstHop.push(peer);
    }
    const branchEdges = firstHop.map((id) =>
      rankedEdges(id).filter((edge) => otherEnd(edge, id) !== root.id),
    );
    for (let round = 0; round < 4 && selected.size < limit; round += 1) {
      for (const [branchIndex, edges] of branchEdges.entries()) {
        const edge = edges[round];
        const branch = firstHop[branchIndex];
        if (edge === undefined || branch === undefined) continue;
        const peer = otherEnd(edge, branch);
        if (!selected.has(peer) && selected.size >= limit) continue;
        selected.add(branch);
        selected.add(peer);
        selectedEdgeKeys.add(conceptEdgeKey(edge));
        if (selected.size >= limit) break;
      }
    }

    const allVisibleEdges = representatives
      .filter(
        (edge) =>
          selectedEdgeKeys.has(conceptEdgeKey(edge)) &&
          selected.has(edge.source) &&
          selected.has(edge.target),
      )
      .sort((left, right) => {
        const highlighted =
          Number(evidenceKeys.has(conceptEdgeKey(right))) -
          Number(evidenceKeys.has(conceptEdgeKey(left)));
        return highlighted || compareEdges(left, right);
      });
    const visibleEdges = allVisibleEdges.slice(0, DEFAULT_EDGE_LIMIT);
    const reachableWithinTwo = new Set<string>([root.id]);
    for (const edge of directEdges) {
      const peer = otherEnd(edge, root.id);
      reachableWithinTwo.add(peer);
      for (const branch of adjacent.get(peer) ?? []) reachableWithinTwo.add(otherEnd(branch, peer));
    }
    return {
      document: evidence.document,
      sentences: evidence.sentences,
      lines: evidence.lines,
      root: root.id,
      highlight: {
        nodes: Object.freeze([...evidenceNodes].filter((id) => selected.has(id))),
        edges: Object.freeze(highlightEdges.map((edge) => edge.id)),
      },
      hiddenTechnicalNodes: Math.max(0, evidence.nodes.length - evidenceNodes.size),
      hiddenTechnicalEdges: Math.max(0, evidence.edges.length - highlightEdges.length),
      nodes: Object.freeze(
        [...selected]
          .map((id) => this.#nodes.get(id) as SemanticGraphNode)
          .sort((left, right) =>
            left.id === root.id
              ? -1
              : right.id === root.id
                ? 1
                : Number(evidenceNodes.has(right.id)) - Number(evidenceNodes.has(left.id)) ||
                  compareNodes(left, right),
          ),
      ),
      edges: Object.freeze(visibleEdges),
      truncatedNodes: reachableWithinTwo.size > selected.size,
      truncatedEdges: visibleEdges.length < allVisibleEdges.length,
    };
  }

  /** Bounded ontology neighborhood with parser and document scaffolding removed. */
  conceptNeighborhood(
    root: string,
    depth = 1,
    nodeLimit = DEFAULT_NEIGHBOR_LIMIT,
    include: readonly string[] = [],
    includeEdges: readonly string[] = [],
  ): GraphSubgraph {
    if (!this.#conceptNodeIds.has(root)) {
      return { nodes: [], edges: [], truncatedNodes: false, truncatedEdges: false };
    }
    const limit = Math.max(1, Math.min(MAX_NEIGHBOR_LIMIT, Math.trunc(nodeLimit)));
    const selected = new Set<string>([root]);
    const queue: { id: string; depth: number }[] = [{ id: root, depth: 0 }];
    let truncatedNodes = false;
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === undefined || current.depth >= depth) continue;
      const candidates = this.conceptIncident(current.id)
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
      if (this.#conceptNodeIds.has(id)) selected.add(id);
    }
    const preferred = new Set(includeEdges);
    const allEdges = this.#conceptRepresentatives()
      .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
      .sort((left, right) => {
        const preferredOrder = Number(preferred.has(right.id)) - Number(preferred.has(left.id));
        return preferredOrder || compareEdges(left, right);
      });
    const edges = allEdges.slice(0, DEFAULT_EDGE_LIMIT);
    return {
      nodes: Object.freeze(
        [...selected]
          .map((id) => this.#nodes.get(id) as SemanticGraphNode)
          .sort((left, right) =>
            left.id === root ? -1 : right.id === root ? 1 : compareNodes(left, right),
          ),
      ),
      edges: Object.freeze(edges),
      truncatedNodes,
      truncatedEdges: edges.length < allEdges.length,
    };
  }

  shortestConceptPath(source: string, target: string): GraphPath | undefined {
    if (!this.#conceptNodeIds.has(source) || !this.#conceptNodeIds.has(target)) return undefined;
    if (source === target) return { nodes: [source], edges: [] };
    const seen = new Set<string>([source]);
    const queue = [source];
    const previous = new Map<string, { node: string; edge: string }>();
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === undefined) break;
      for (const edge of this.conceptIncident(current)) {
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
  return [
    focus.id,
    focus.kind,
    focus.label,
    focus.document,
    focus.sentence,
    positiveIntegers(focus.sentences ?? []).join(','),
    positiveIntegers(focus.lines ?? []).join(','),
    focus.question,
    focus.answer,
  ]
    .map((value) => value ?? '')
    .join('\u001f');
};

export const graphNodeLabel = (node: SemanticGraphNode): string =>
  node.kind === 'document' ? node.label : node.label.replace(/[_-]+/gu, ' ');

export const graphNodeKindLabel = (node: SemanticGraphNode): string => {
  if (node.kind === 'entity') return 'concept';
  if (node.kind === 'event') return 'action';
  if (node.kind === 'value') return 'attribute';
  if (node.kind === 'operator-context') return 'logical context';
  return 'document';
};

export const graphRelationLabel = (edge: SemanticGraphEdge, from?: string): string => {
  if (edge.kind === 'argument') {
    const outward = from === undefined || from === edge.source;
    if (edge.label === 'argument 1') return outward ? 'actor' : 'acts in';
    if (edge.label === 'argument 2') return outward ? 'target' : 'target of';
    return outward ? 'participant' : 'participates in';
  }
  if (edge.kind === 'event') return from === edge.target ? 'action for' : 'action';
  return edge.label.replace(/[_-]+/gu, ' ');
};
