// Static semantic graph derivation over every compiled clause site.
//
// Calling the loaded predicates would keep only derivable solutions and discard
// most rule heads. Instead this module consumes the same generated source lines
// that build the PVM, maps their seven semantic schemas, and records one
// body-to-head implication edge for every Horn rule.

import { atomText, generatedJson, parseClauseSites } from './provenance.mjs';

export const GRAPH_SCHEMA_VERSION = 1;
export const GRAPH_ASSET_PATH = 'graph/semantic-graph.json';

/**
 * @typedef {'document' | 'entity' | 'event' | 'operator-context' | 'value'} GraphNodeKind
 * @typedef {'entity' | 'cardinality' | 'event' | 'argument' | 'preposition'
 *   | 'property' | 'operator' | 'implies'} GraphEdgeKind
 * @typedef {{ id: string, kind: GraphNodeKind, label: string,
 *   document?: string, sentence?: number }} GraphNode
 * @typedef {{ id: string, kind: GraphEdgeKind, source: string, target: string,
 *   label: string, document: string, sentence: number | null, line: number,
 *   predicate: string }} GraphEdge
 * @typedef {import('./provenance.mjs').ClauseSite} ClauseSite
 */

/** @param {string} value */
const encoded = (value) => encodeURIComponent(value).replace(/%/gu, '.');

/** @param {string} term */
const termLabel = (term) => atomText(term) ?? term.trim();

/** @param {string} document */
const documentId = (document) => `document:${encoded(document)}`;

/** @param {string} noun */
const entityId = (noun) => `entity:${encoded(noun)}`;

/** @param {string} verb */
const eventId = (verb) => `event:${encoded(verb)}`;

/** @param {string} document @param {number | null} sentence @param {string} reference */
const operatorId = (document, sentence, reference) =>
  `operator-context:${encoded(document)}:${sentence ?? 0}:${encoded(reference)}`;

/** @param {string} category @param {string} value */
const valueId = (category, value) => `value:${category}:${encoded(value)}`;

/** @param {Map<string, GraphNode>} nodes @param {GraphNode} node */
const addNode = (nodes, node) => {
  const previous = nodes.get(node.id);
  if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(node)) {
    throw new Error(`graph node collision for ${node.id}`);
  }
  nodes.set(node.id, node);
  return node.id;
};

/** @param {string} document @param {string} reference */
const referenceKey = (document, reference) => `${document}\u0000${reference.trim()}`;

/**
 * Return the semantic node asserted by an entity, event, or operator call and
 * optionally bind its Prolog reference for relation calls in the same sentence.
 *
 * @param {Map<string, GraphNode>} nodes
 * @param {{ name: string, args: string[] }} call
 * @param {string} document
 * @param {number | null} sentence
 * @param {Map<string, string>} references
 */
const declareCallNode = (nodes, call, document, sentence, references) => {
  if (call.name === 'guideline_entity') {
    const noun = termLabel(call.args[2] ?? '');
    const id = addNode(nodes, { id: entityId(noun), kind: 'entity', label: noun });
    references.set(call.args[1]?.trim() ?? '', id);
    return id;
  }
  if (call.name === 'guideline_event') {
    const verb = termLabel(call.args[2] ?? '');
    const id = addNode(nodes, { id: eventId(verb), kind: 'event', label: verb });
    references.set(call.args[1]?.trim() ?? '', id);
    return id;
  }
  if (call.name === 'guideline_operator') {
    const reference = call.args[1]?.trim() ?? '';
    const label = termLabel(call.args[2] ?? '');
    const node = {
      id: operatorId(document, sentence, reference),
      kind: /** @type {const} */ ('operator-context'),
      label,
      document,
      ...(sentence === null ? {} : { sentence }),
    };
    const id = addNode(nodes, node);
    references.set(reference, id);
    return id;
  }
  return null;
};

/**
 * @param {Map<string, GraphNode>} nodes
 * @param {Map<string, string>} globalReferences
 * @param {Map<string, string>} localReferences
 * @param {string} document
 * @param {number | null} sentence
 * @param {string} reference
 */
const resolveReference = (
  nodes,
  globalReferences,
  localReferences,
  document,
  sentence,
  reference,
) => {
  const normalized = reference.trim();
  const known = localReferences.get(normalized) ?? globalReferences.get(referenceKey(document, normalized));
  if (known !== undefined) return known;
  if (normalized === 'actual') return documentId(document);
  const label = termLabel(normalized);
  return addNode(nodes, {
    id: valueId('reference', `${document}:${sentence ?? 0}:${normalized}`),
    kind: 'value',
    label,
    document,
    ...(sentence === null ? {} : { sentence }),
  });
};

/**
 * Select the semantic node a schema goal is about. This is also the endpoint
 * used for body-to-head implication edges.
 *
 * @param {Map<string, GraphNode>} nodes
 * @param {Map<string, string>} globalReferences
 * @param {Map<string, string>} localReferences
 * @param {{ name: string, args: string[] }} call
 * @param {string} document
 * @param {number | null} sentence
 */
const callNode = (nodes, globalReferences, localReferences, call, document, sentence) => {
  const declared = declareCallNode(nodes, call, document, sentence, localReferences);
  if (declared !== null) return declared;
  if (
    call.name === 'guideline_cardinality' ||
    call.name === 'guideline_arg' ||
    call.name === 'guideline_pp' ||
    call.name === 'guideline_property'
  ) {
    return resolveReference(
      nodes,
      globalReferences,
      localReferences,
      document,
      sentence,
      call.args[1] ?? '',
    );
  }
  return documentId(document);
};

/** @param {Map<string, number>} counts @param {string} key */
const increment = (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1);

/** @param {Map<string, number>} counts */
const countRecord = (counts) => Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));

/**
 * @param {Map<string, Uint8Array>} files
 * @param {ClauseSite[]} [parsedClauses]
 */
export const deriveSemanticGraph = (files, parsedClauses = parseClauseSites(files)) => {
  /** @type {Map<string, GraphNode>} */
  const nodes = new Map();
  /** @type {GraphEdge[]} */
  const edges = [];
  /** @type {Map<string, string>} */
  const globalReferences = new Map();

  const documents = [...new Set(parsedClauses.map((clause) => clause.document))].sort();
  for (const document of documents) {
    addNode(nodes, {
      id: documentId(document),
      kind: 'document',
      label: document,
      document,
    });
  }

  // Register all named head references before emitting relationships. An arg
  // may precede or follow the entity/event clause it targets in source order.
  for (const clause of parsedClauses) {
    /** @type {Map<string, string>} */
    const declared = new Map();
    const id = declareCallNode(nodes, clause.head, clause.document, clause.sentence, declared);
    if (id === null) continue;
    for (const [reference, node] of declared) {
      const key = referenceKey(clause.document, reference);
      const previous = globalReferences.get(key);
      if (previous !== undefined && previous !== node) {
        throw new Error(`graph reference collision at line ${clause.line}`);
      }
      globalReferences.set(key, node);
    }
  }

  /** @type {Map<string, number>} */
  const edgeKinds = new Map();
  const emit = (
    /** @type {ClauseSite} */ clause,
    /** @type {number} */ ordinal,
    /** @type {GraphEdgeKind} */ kind,
    /** @type {string} */ source,
    /** @type {string} */ target,
    /** @type {string} */ label,
    /** @type {string} */ predicate = clause.predicate,
  ) => {
    const edge = {
      id: `edge:${clause.line}:${ordinal}`,
      kind,
      source,
      target,
      label,
      document: clause.document,
      sentence: clause.sentence,
      line: clause.line,
      predicate,
    };
    edges.push(edge);
    increment(edgeKinds, kind);
  };

  for (const clause of parsedClauses) {
    if (clause.predicate === 'guideline_schema_version' || clause.predicate === 'guideline_document') {
      continue;
    }
    /** @type {Map<string, string>} */
    const localReferences = new Map();
    // First pass makes variables in arg/pp conditions resolve regardless of body order.
    for (const call of clause.body) {
      declareCallNode(nodes, call, clause.document, clause.sentence, localReferences);
    }
    const headNode = callNode(
      nodes,
      globalReferences,
      localReferences,
      clause.head,
      clause.document,
      clause.sentence,
    );
    const args = clause.head.args;
    const doc = documentId(clause.document);
    switch (clause.predicate) {
      case 'guideline_entity':
        emit(clause, 0, 'entity', doc, headNode, 'entity');
        break;
      case 'guideline_event':
        emit(clause, 0, 'event', doc, headNode, 'event');
        break;
      case 'guideline_operator':
        emit(clause, 0, 'operator', doc, headNode, termLabel(args[2] ?? 'operator'));
        break;
      case 'guideline_cardinality': {
        const label = [args[2], args[3], args[4]].map((term) => termLabel(term ?? '')).join(' ');
        const target = addNode(nodes, {
          id: valueId('cardinality', label),
          kind: 'value',
          label,
        });
        emit(clause, 0, 'cardinality', headNode, target, label);
        break;
      }
      case 'guideline_arg': {
        const target = resolveReference(
          nodes,
          globalReferences,
          localReferences,
          clause.document,
          clause.sentence,
          args[3] ?? '',
        );
        emit(clause, 0, 'argument', headNode, target, `argument ${termLabel(args[2] ?? '')}`);
        break;
      }
      case 'guideline_pp': {
        const target = resolveReference(
          nodes,
          globalReferences,
          localReferences,
          clause.document,
          clause.sentence,
          args[3] ?? '',
        );
        emit(clause, 0, 'preposition', headNode, target, termLabel(args[2] ?? ''));
        break;
      }
      case 'guideline_property': {
        const label = `${termLabel(args[2] ?? '')}: ${termLabel(args[3] ?? '')}`;
        const target = addNode(nodes, {
          id: valueId('property', label),
          kind: 'value',
          label,
        });
        emit(clause, 0, 'property', headNode, target, label);
        break;
      }
      default:
        throw new Error(`unsupported graph predicate ${clause.predicate}`);
    }
    if (clause.kind === 'rule') {
      // The compiler gives every conditional sentence a first-class context
      // reference. Its operator clause names the modal/negative context; every
      // rule head in that context is one Horn body→head relationship. Keeping
      // this node is what avoids flattening an event into a noun→noun edge.
      const context = resolveReference(
        nodes,
        globalReferences,
        localReferences,
        clause.document,
        clause.sentence,
        args[0] ?? '',
      );
      emit(clause, 1, 'implies', context, headNode, `condition implies ${clause.predicate}`);
    }
  }

  const sortedNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = edges.sort(
    (left, right) => left.line - right.line || left.id.localeCompare(right.id),
  );
  /** @type {Map<string, number>} */
  const nodeKinds = new Map();
  for (const node of sortedNodes) increment(nodeKinds, node.kind);
  const model = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes: sortedNodes,
    edges: sortedEdges,
    stats: {
      documents: documents.length,
      clauses: parsedClauses.length,
      nodes: sortedNodes.length,
      edges: sortedEdges.length,
      byNodeKind: countRecord(nodeKinds),
      byEdgeKind: countRecord(edgeKinds),
    },
  };
  return { path: GRAPH_ASSET_PATH, bytes: generatedJson(model), model };
};
