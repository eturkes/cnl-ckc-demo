// Static semantic graph derivation over every compiled clause site.
//
// Calling the loaded predicates would keep only derivable solutions and discard
// most rule heads. Instead this module consumes the same generated source lines
// that build the PVM, maps their seven semantic schemas, and records one
// body-to-head implication edge for every Horn rule.

import { atomText, generatedJson, parseClauseSites } from './provenance.mjs';

export const GRAPH_SCHEMA_VERSION = 3;
export const GRAPH_ASSET_PATH = 'graph/semantic-graph.json';

/**
 * @typedef {'document' | 'entity' | 'event' | 'operator-context' | 'value'} GraphNodeKind
 * @typedef {'entity' | 'cardinality' | 'event' | 'argument' | 'preposition'
 *   | 'property' | 'operator' | 'implies' | 'grade' | 'preference' | 'qualifier' | 'time'
 *   | 'threshold'} GraphEdgeKind
 * @typedef {{ id: string, kind: GraphNodeKind, label: string,
 *   document?: string, sentence?: number }} GraphNode
 * @typedef {{ id: string, kind: GraphEdgeKind, source: string, target: string,
 *   label: string, document: string, sentence: number | null, line: number,
 *   predicate: string, scope?: number, inverse?: string }} GraphEdge
 * @typedef {'-' | 'should' | 'may' | 'can' | 'must'} ScopeOperator
 * @typedef {{ outer: string, operator: ScopeOperator, document: string,
 *   sentence: number | null, reference: string }} ScopeDefinition
 * @typedef {{ line: number, index: number, predicate: string, edge: string | null }} ScopeLiteral
 * @typedef {{ id: string, chain: string[], operator: ScopeOperator,
 *   document: string, sentence: number | null, reference: string,
 *   literals?: ScopeLiteral[] }} ScopeRecord
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

/** @param {string} document @param {number | null} sentence @param {string} reference */
const scopeKey = (document, sentence, reference) =>
  JSON.stringify([document, sentence, reference.trim()]);

/** @param {string} document @param {number | null} sentence @param {string} reference */
const scopeId = (document, sentence, reference) =>
  `scope:${encoded(document)}:${sentence ?? 0}:${encoded(reference.trim())}`;

const CONTEXT_SENTENCE = /,([1-9][0-9]*),box/u;

/** @param {ScopeDefinition} definition */
const parentScopeKey = ({ outer, document, sentence }) => {
  if (outer === 'actual') return undefined;
  const embedded = CONTEXT_SENTENCE.exec(outer)?.[1];
  return scopeKey(document, embedded === undefined ? sentence : Number(embedded), outer);
};

/**
 * Dedupe every operator call by the compiler's context identity and resolve its
 * ordered outer chain. Head and body occurrences both carry semantic scope.
 *
 * @param {ClauseSite[]} parsedClauses
 * @returns {ScopeRecord[]}
 */
const deriveScopeRecords = (parsedClauses) => {
  /** @type {Map<string, ScopeDefinition>} */
  const definitions = new Map();
  for (const clause of parsedClauses) {
    for (const call of [clause.head, ...clause.body]) {
      if (call.name !== 'guideline_operator') continue;
      const definition = {
        outer: call.args[0]?.trim() ?? '',
        operator: /** @type {ScopeOperator} */ (termLabel(call.args[2] ?? '')),
        document: clause.document,
        sentence: clause.sentence,
        reference: call.args[1]?.trim() ?? '',
      };
      const key = scopeKey(definition.document, definition.sentence, definition.reference);
      const previous = definitions.get(key);
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(definition)) {
        throw new Error(`graph scope collision at line ${String(clause.line)}`);
      }
      definitions.set(key, definition);
    }
  }

  /**
   * @param {ScopeDefinition} definition
   * @param {Set<string>} [seen]
   * @returns {string[]}
   */
  const chainFor = (definition, seen = new Set()) => {
    const key = scopeKey(definition.document, definition.sentence, definition.reference);
    if (seen.has(key)) throw new Error(`graph scope cycle for ${definition.reference}`);
    const next = new Set(seen).add(key);
    const parentKey = parentScopeKey(definition);
    const parent = parentKey === undefined ? undefined : definitions.get(parentKey);
    const outer = parent === undefined ? [definition.outer] : chainFor(parent, next);
    return [...outer, definition.reference];
  };

  return [...definitions.values()]
    .map((definition) => ({
      id: scopeId(definition.document, definition.sentence, definition.reference),
      chain: chainFor(definition),
      operator: definition.operator,
      document: definition.document,
      sentence: definition.sentence,
      reference: definition.reference,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
};

const SCOPE_OPERATORS = /** @type {const} */ (['-', 'should', 'may', 'can', 'must']);
const SCOPE_FIELDS = ['chain', 'document', 'id', 'operator', 'reference', 'sentence'];

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Grade the serialized scope table and every numeric edge reference into it.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export const validateSemanticGraphAsset = (value) => {
  if (!isRecord(value)) return ['semantic graph must be an object for scopes validation'];
  const scopes = value.scopes;
  if (!Array.isArray(scopes)) return ['scopes must be an array'];
  if (scopes.length === 0) {
    return ['scopes table is empty, so graph scope validation grades no record'];
  }

  /** @type {string[]} */
  const failures = [];
  const ids = new Set();
  /** @type {{ at: string, literals: unknown }[]} */
  const literalRefs = [];
  const operatorCounts = new Map(SCOPE_OPERATORS.map((operator) => [operator, 0]));
  let previousId;
  for (const [index, scope] of scopes.entries()) {
    const at = `scopes[${String(index)}]`;
    if (!isRecord(scope)) {
      failures.push(`${at} must be an object`);
      continue;
    }
    const fields = Object.keys(scope)
      .filter((field) => field !== 'literals')
      .sort();
    if (fields.join(',') !== SCOPE_FIELDS.join(',')) {
      failures.push(`${at} fields ${fields.join(',')}, expected ${SCOPE_FIELDS.join(',')}`);
    }
    if ('literals' in scope) literalRefs.push({ at, literals: scope.literals });
    const { id, chain, operator, document, sentence, reference } = scope;
    if (typeof id !== 'string' || id.trim() === '') failures.push(`${at}.id must be non-empty text`);
    else {
      if (ids.has(id)) failures.push(`${at}.id duplicates ${id}`);
      ids.add(id);
      if (previousId !== undefined && id.localeCompare(previousId) < 0) {
        failures.push(`${at}.id is not sorted`);
      }
      previousId = id;
    }
    if (
      !Array.isArray(chain) ||
      chain.length === 0 ||
      chain.some((entry) => typeof entry !== 'string' || entry.trim() === '')
    ) {
      failures.push(`${at}.chain must be a non-empty text array`);
    }
    if (!SCOPE_OPERATORS.includes(/** @type {ScopeOperator} */ (operator))) {
      failures.push(`${at}.operator has unknown value ${String(operator)}`);
    } else {
      const known = /** @type {ScopeOperator} */ (operator);
      operatorCounts.set(known, (operatorCounts.get(known) ?? 0) + 1);
    }
    if (typeof document !== 'string' || document.trim() === '') {
      failures.push(`${at}.document must be non-empty text`);
    }
    if (sentence !== null && (!Number.isSafeInteger(sentence) || Number(sentence) < 1)) {
      failures.push(`${at}.sentence must be a positive integer or null`);
    }
    if (typeof reference !== 'string' || reference.trim() === '') {
      failures.push(`${at}.reference must be non-empty text`);
    }
    if (
      typeof id === 'string' &&
      typeof document === 'string' &&
      (sentence === null || Number.isSafeInteger(sentence)) &&
      typeof reference === 'string' &&
      id !== scopeId(document, /** @type {number | null} */ (sentence), reference)
    ) {
      failures.push(`${at}.id does not encode its document, sentence and reference`);
    }
  }
  for (const [operator, count] of operatorCounts) {
    if (count === 0) failures.push(`scopes operator ${operator} has zero records`);
  }

  const edges = value.edges;
  if (!Array.isArray(edges)) return [...failures, 'edges must be an array for scopes validation'];
  let scopedEdges = 0;
  for (const [index, edge] of edges.entries()) {
    if (!isRecord(edge)) continue;
    if (edge.scope === undefined) {
      if (edge.kind === 'operator') {
        failures.push(`operator edge ${String(edge.id)} must reference a scope index`);
      }
      continue;
    }
    scopedEdges += 1;
    if (!Number.isSafeInteger(edge.scope)) {
      failures.push(`edges[${String(index)}].scope must be an integer`);
      continue;
    }
    const scope = Number(edge.scope);
    if (scope < 0 || scope >= scopes.length) {
      failures.push(`edges[${String(index)}].scope ${String(scope)} is out of range`);
    }
  }
  if (scopedEdges === 0) failures.push('edges carry zero scope references');
  const edgeIds = new Set(edges.map((edge) => (isRecord(edge) ? edge.id : undefined)));
  for (const { at, literals } of literalRefs) {
    if (!Array.isArray(literals) || literals.length === 0) {
      failures.push(`${at}.literals must be a non-empty array`);
      continue;
    }
    for (const [index, literal] of literals.entries()) {
      const where = `${at}.literals[${String(index)}]`;
      if (
        !isRecord(literal) ||
        Object.keys(literal).sort().join(',') !== 'edge,index,line,predicate' ||
        !Number.isSafeInteger(literal.line) ||
        !Number.isSafeInteger(literal.index) ||
        typeof literal.predicate !== 'string' ||
        (literal.edge !== null && typeof literal.edge !== 'string')
      ) {
        failures.push(`${where} must be { line, index, predicate, edge }`);
      } else if (literal.edge !== null && !edgeIds.has(literal.edge)) {
        failures.push(`${where}.edge ${String(literal.edge)} names no edge`);
      }
    }
  }
  return failures;
};

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

/** @param {{ args: string[] }} call */
const propertyLabel = (call) => `${termLabel(call.args[2] ?? '')}: ${termLabel(call.args[3] ?? '')}`;

/** @param {Map<string, GraphNode>} nodes @param {string} category @param {string} label */
const valueNode = (nodes, category, label) =>
  addNode(nodes, { id: valueId(category, label), kind: 'value', label });

/** Upstream's words for a comparison; a plain number (`eq`) states at least that many. */
const COMPARISON_WORDS = new Map([
  ['eq', ''],
  ['exactly', 'exactly '],
  ['geq', 'at least '],
  ['greater', 'more than '],
  ['leq', 'at most '],
  ['less', 'less than '],
  ['about', 'about '],
]);

/** @param {string} comparison @param {string} count */
const boundText = (comparison, count) => {
  const words = COMPARISON_WORDS.get(comparison.trim());
  if (words === undefined) throw new Error(`graph: comparison ${comparison} states no bound`);
  return `${words}${count.trim()}`;
};

/** @param {string} term */
const isVariable = (term) => /^[A-Z_]/u.test(term.trim());

/**
 * The pp edge an order or an anchorless interval types reads that annotation: label + inverse.
 * @type {ReadonlyMap<string, readonly [string, string]>}
 */
const ORDER_READINGS = new Map([
  ['before', ['occurs before', 'occurs after']],
  ['after', ['occurs after', 'occurs before']],
]);
/** @type {ReadonlyMap<string, readonly [string, string]>} */
const OFFSET_READINGS = new Map([
  ['duration', ['duration', 'duration of']],
  ['after', ['after offset', 'after offset for']],
  ['before', ['before offset', 'before offset for']],
  ['within', ['distance', 'distance for']],
]);
/**
 * An anchored interval reads its bound from either end; `within` allows either order.
 * @type {ReadonlyMap<string, (bound: string) => readonly [string, string]>}
 */
const ANCHOR_READINGS = new Map([
  ['after', (/** @type {string} */ bound) => [`${bound} after`, `${bound} before`]],
  ['before', (/** @type {string} */ bound) => [`${bound} before`, `${bound} after`]],
  ['within', (/** @type {string} */ bound) => [`${bound} apart from`, `${bound} apart from`]],
]);

/** Annotations whose second argument names the referent they are about. */
const ANNOTATIONS = new Set([
  'guideline_grade',
  'guideline_preference',
  'guideline_qualifier',
  'guideline_interval',
  'guideline_recurrence',
  'guideline_frequency',
  'guideline_order',
  'guideline_recurrence_window',
  'guideline_range',
  'guideline_unit',
]);

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
    call.name === 'guideline_property' ||
    ANNOTATIONS.has(call.name)
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

/**
 * Clause kinds that emit no edge of their own: the document record, the annotations that fold
 * into another reading — a unit or a range into its quantity's node, an order into the pp edge it
 * types (`sync-u2.md`) — and the scope-exclusion, supersession and evaluation-date records, whose
 * projection is a queued feature (`.agent/deferred.md`).
 */
const UNPROJECTED = new Set([
  'guideline_schema_version',
  'guideline_document',
  'guideline_unit',
  'guideline_order',
  'guideline_range',
  'guideline_exclusion',
  'guideline_supersession',
  'guideline_evaluation_date',
]);

/** @param {Map<string, number>} counts @param {string} key */
const increment = (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1);

/** @param {Map<string, number>} counts */
const countRecord = (counts) => Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));

/**
 * The quantity facts one clause scope holds: each referent's cardinality, each comparison goal
 * keyed by the comparison + count variables it shares with that cardinality, and each range.
 *
 * @typedef {{ cardinality: Map<string, { comparison: string, count: string, call: { name: string, args: string[] } }>,
 *   satisfies: Map<string, { name: string, args: string[] }>, range: Map<string, string> }} QuantityFacts
 */

/** @returns {QuantityFacts} */
const emptyFacts = () => ({ cardinality: new Map(), satisfies: new Map(), range: new Map() });

/**
 * `B(Q)`: a quantity referent's reading — its comparison + count in upstream's words + unit,
 * a range folded in as `<low> to <high>`, or a converted condition's bound. Returns `null` for
 * a converted quantity, whose bound rides its threshold edge instead.
 *
 * @param {QuantityFacts[]} scopes nearest first: the clause's body, then the sentence's heads
 * @param {string} reference
 * @param {string} unit
 * @param {number} line
 * @returns {string | null}
 */
const quantityReading = (scopes, reference, unit, line) => {
  const ref = reference.trim();
  const found = scopes.map((facts) => facts.cardinality.get(ref)).find(Boolean);
  if (found === undefined) throw new Error(`graph: line ${String(line)}: quantity ${ref} states no cardinality`);
  if (isVariable(found.comparison) || isVariable(found.count)) return null;
  const high = scopes.map((facts) => facts.range.get(ref)).find(Boolean);
  let bound = boundText(found.comparison, found.count);
  if (high !== undefined) {
    const upper = scopes.map((facts) => facts.cardinality.get(high)).find(Boolean);
    if (upper === undefined || isVariable(upper.count)) {
      throw new Error(`graph: line ${String(line)}: range ${ref} names no counted upper end`);
    }
    bound = `${bound} to ${upper.count.trim()}`;
  }
  return isVariable(unit) ? bound : `${bound} ${unit.trim()}`;
};

/** The bound a comparison goal states: `<words><limit>[ <unit>]`. @param {{ args: string[] }} call */
const conditionBound = (call) => {
  const [, , third = '', fourth = '', fifth = '', sixth = ''] = call.args;
  return call.args.length === 6
    ? `${boundText(fourth, fifth)} ${sixth.trim()}`
    : `${boundText(third, fourth)}`;
};

/**
 * @param {Map<string, Uint8Array>} files
 * @param {ClauseSite[]} [parsedClauses]
 */
export const deriveSemanticGraph = (files, parsedClauses = parseClauseSites(files)) => {
  const scopes = deriveScopeRecords(parsedClauses);
  const scopeIndexes = new Map(
    scopes.map((scope, index) => [scopeKey(scope.document, scope.sentence, scope.reference), index]),
  );
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
  // A property referent no entity or event declares IS the property — a copula's
  // `argument 2` — so it resolves to the property's own value node; an adjective on a declared
  // noun stays an attribute edge of that noun.
  for (const clause of parsedClauses) {
    if (clause.predicate !== 'guideline_property') continue;
    const key = referenceKey(clause.document, clause.head.args[1] ?? '');
    if (!globalReferences.has(key)) {
      globalReferences.set(key, valueNode(nodes, 'property', propertyLabel(clause.head)));
    }
  }

  // Head facts per sentence, which the annotation readings join: quantities, ranges, the pp
  // readings an order or an anchorless interval types, and the nouns a unit must restate.
  /** @type {Map<string, QuantityFacts>} */
  const sentenceFacts = new Map();
  const factsOf = (/** @type {ClauseSite} */ clause) => {
    const key = `${clause.document}\u0000${String(clause.sentence ?? 0)}`;
    let facts = sentenceFacts.get(key);
    if (facts === undefined) {
      facts = emptyFacts();
      sentenceFacts.set(key, facts);
    }
    return facts;
  };
  /** @type {Map<string, string>} */
  const nounOf = new Map();
  /** `<document>\0<context>\0<event>\0<object>` → the reading of the pp clause an annotation types. */
  /** @type {Map<string, readonly [string, string]>} */
  const headTypings = new Map();
  /** `<document>\0<sentence>\0<quantity>` of every head interval, which a range must pair with. */
  /** @type {Set<string>} */
  const headIntervals = new Set();
  const typingKey = (/** @type {string} */ document, /** @type {string[]} */ parts) =>
    [document, ...parts.map((part) => part.trim())].join('\u0000');
  for (const clause of parsedClauses) {
    const [context = '', subject = '', second = '', third = '', fourth = '', fifth = ''] =
      clause.head.args;
    if (clause.predicate === 'guideline_cardinality') {
      factsOf(clause).cardinality.set(subject.trim(), {
        comparison: third,
        count: fourth,
        call: clause.head,
      });
    }
    if (clause.predicate === 'guideline_range') factsOf(clause).range.set(subject.trim(), second.trim());
    if (clause.predicate === 'guideline_entity') nounOf.set(referenceKey(clause.document, subject), termLabel(second));
    if (clause.predicate === 'guideline_order') {
      const reading = ORDER_READINGS.get(termLabel(second));
      if (reading === undefined) throw new Error(`graph: line ${String(clause.line)}: order ${second} is no relation`);
      headTypings.set(typingKey(clause.document, [context, subject, third]), reading);
    }
    if (clause.predicate === 'guideline_interval') {
      headIntervals.add(`${clause.document}\u0000${String(clause.sentence ?? 0)}\u0000${third.trim()}`);
    }
    if (clause.predicate === 'guideline_interval' && fifth.trim() === 'none') {
      const reading = OFFSET_READINGS.get(termLabel(second));
      if (reading === undefined) throw new Error(`graph: line ${String(clause.line)}: interval role ${second}`);
      headTypings.set(typingKey(clause.document, [context, subject, third]), reading);
    }
  }
  // A range folds into its low quantity's interval reading, so a range no interval reads would
  // vanish from the graph: refuse it.
  for (const [sentence, facts] of sentenceFacts) {
    for (const low of facts.range.keys()) {
      if (!headIntervals.has(`${sentence}\u0000${low}`)) {
        throw new Error(`graph: range ${low} in ${sentence.replace('\u0000', ' S')} pairs with no interval`);
      }
    }
  }

  // A head quantity a unit types resolves to its own reading node, never to the noun every
  // same-unit referent shares: `at least 1 week`, not `week` with every sentence's counts on it.
  /** @type {Set<string>} */
  const foldedCardinalities = new Set();
  for (const clause of parsedClauses) {
    if (clause.predicate !== 'guideline_unit') continue;
    const [, quantity = '', unit = ''] = clause.head.args;
    const key = referenceKey(clause.document, quantity);
    const noun = nounOf.get(key);
    // A consumer limit, not an upstream invalidity: the projection names a quantity by its noun.
    if (noun !== termLabel(unit)) {
      throw new Error(
        `graph: line ${String(clause.line)}: guideline_unit types ${String(noun)} as ${unit.trim()}; ` +
          'the graph reads a quantity unit from its noun',
      );
    }
    const reading = quantityReading([factsOf(clause)], quantity, unit, clause.line);
    if (reading === null) throw new Error(`graph: line ${String(clause.line)}: head quantity ${quantity.trim()} is converted`);
    globalReferences.set(key, valueNode(nodes, 'quantity', reading));
    foldedCardinalities.add(key);
  }

  /** @type {Map<string, number>} */
  const edgeKinds = new Map();
  /** Each shown body relation's dedup key → the id of the edge that shows it. */
  /** @type {Map<string, string>} */
  const emittedConditions = new Map();
  /**
   * Every `condition supports` occurrence the dedup folded into an earlier one — the world it sat
   * in beside the kept edge's — so a check can prove what each fold hides (queue row
   * `Condition-supports dedup is scope-blind`). Not shipped in the asset.
   * @type {{ document: string, sentence: number, source: string, target: string, kept: string,
   *   keptWorld: number, world: number }[]}
   */
  const conditionMerges = [];
  /** @type {Map<string, number>} */
  const conditionWorlds = new Map();
  /** `<line>:<body index>` → the edge showing that body literal's relation. */
  /** @type {Map<string, string>} */
  const literalEdges = new Map();
  /** Property referents the projection resolved, and those an arg or pp edge reaches. */
  /** @type {Set<string>} */
  const propertyReferents = new Set();
  /** @type {Set<string>} */
  const reachedProperties = new Set();
  /** The scope index a call's world resolves to, the way `emit` resolves an edge's scope. */
  const world = (/** @type {ClauseSite} */ clause, /** @type {{ args: string[] }} */ call) =>
    scopeIndexes.get(scopeKey(clause.document, clause.sentence, call.args[0] ?? '')) ?? -1;
  const emit = (
    /** @type {ClauseSite} */ clause,
    /** @type {number} */ ordinal,
    /** @type {GraphEdgeKind} */ kind,
    /** @type {string} */ source,
    /** @type {string} */ target,
    /** @type {string} */ label,
    /** @type {string} */ predicate = clause.predicate,
    /** @type {{ name: string, args: string[] }} */ scopeCall = clause.head,
    /** @type {string | undefined} */ inverse = undefined,
  ) => {
    if (source === target) throw new Error(`graph: line ${String(clause.line)}: ${kind} edge loops on ${source}`);
    const reference = scopeCall.args[scopeCall.name === 'guideline_operator' ? 1 : 0] ?? '';
    const scope = scopeIndexes.get(scopeKey(clause.document, clause.sentence, reference));
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
      ...(scope === undefined ? {} : { scope }),
      ...(inverse === undefined ? {} : { inverse }),
    };
    edges.push(edge);
    increment(edgeKinds, kind);
  };

  /**
   * The edge one annotation call projects — `null` for a fold — over the given resolver and
   * quantity facts. Heads and body goals share it, so a body goal reads exactly as its head would.
   *
   * @param {{ name: string, args: string[] }} call
   * @param {(reference: string) => string} resolve
   * @param {QuantityFacts[]} facts
   * @param {number} line
   * @returns {{ kind: GraphEdgeKind, source: string, target: string, label: string, inverse: string } | null}
   */
  const annotationEdge = (call, resolve, facts, line) => {
    const [, subject = '', second = '', third = '', fourth = '', fifth = '', sixth = ''] = call.args;
    switch (call.name) {
      case 'guideline_grade': {
        const label = `${termLabel(second)}: ${termLabel(third)}`;
        const target = valueNode(nodes, 'grade', label);
        return { kind: 'grade', source: resolve(subject), target, label: 'grade', inverse: 'grade of' };
      }
      case 'guideline_preference':
        return third.trim() === 'none'
          ? {
              kind: 'preference',
              source: resolve(second),
              target: valueNode(nodes, 'preference', 'preferred'),
              label: 'preference',
              inverse: 'preference of',
            }
          : {
              kind: 'preference',
              source: resolve(second),
              target: resolve(third),
              label: 'preferred over',
              inverse: 'less preferred than',
            };
      case 'guideline_qualifier': {
        const clas = termLabel(second);
        return {
          kind: 'qualifier',
          source: resolve(subject),
          target: valueNode(nodes, 'qualifier', termLabel(third)),
          label: clas,
          inverse: `${clas} of`,
        };
      }
      case 'guideline_interval': {
        if (fifth.trim() === 'none') return null;
        const reading = ANCHOR_READINGS.get(termLabel(second));
        if (reading === undefined) throw new Error(`graph: line ${String(line)}: anchored interval role ${second}`);
        const bound = quantityReading(facts, third, fourth, line);
        if (bound === null) throw new Error(`graph: line ${String(line)}: anchored interval on a converted quantity`);
        const [label, inverse] = reading(bound);
        return { kind: 'time', source: resolve(subject), target: resolve(fifth), label, inverse };
      }
      case 'guideline_recurrence':
        return {
          kind: 'time',
          source: resolve(subject),
          target: resolve(second),
          label: 'recurrence gap',
          inverse: 'recurrence gap of',
        };
      case 'guideline_frequency': {
        const counted = facts.map((scope) => scope.cardinality.get(second.trim())).find(Boolean);
        if (counted === undefined) throw new Error(`graph: line ${String(line)}: frequency counts no items`);
        const period = quantityReading(facts, third, fourth, line);
        const per = `count ${boundText(counted.comparison, counted.count)} per ${String(period)}`;
        return { kind: 'time', source: resolve(subject), target: resolve(second), label: per, inverse: `${per} in` };
      }
      case 'guideline_recurrence_window': {
        const gap = quantityReading(facts, second, third, line);
        const length = quantityReading(facts, fifth, sixth, line);
        return {
          kind: 'time',
          source: resolve(subject),
          target: resolve(fourth),
          label: `recurrence gap ${String(gap)}; window ${String(length)} from`,
          inverse: `anchors window ${String(length)} with recurrence gap ${String(gap)} for`,
        };
      }
      default:
        return null;
    }
  };

  for (const clause of parsedClauses) {
    if (UNPROJECTED.has(clause.predicate)) continue;
    const headFacts = factsOf(clause);
    const [headContext = '', headSubject = '', , headObject = '', , headAnchor = ''] = clause.head.args;
    // A cardinality a unit folded into its quantity's reading, and an anchorless interval the pp
    // edge it types reads, emit nothing of their own.
    if (
      (clause.predicate === 'guideline_cardinality' &&
        foldedCardinalities.has(referenceKey(clause.document, headSubject))) ||
      (clause.predicate === 'guideline_interval' && headAnchor.trim() === 'none')
    ) {
      continue;
    }
    /** @type {Map<string, string>} */
    const localReferences = new Map();
    // First pass makes variables in arg/pp conditions resolve regardless of body order.
    for (const call of clause.body) {
      declareCallNode(nodes, call, clause.document, clause.sentence, localReferences);
    }
    for (const call of clause.body) {
      const reference = call.args[1]?.trim() ?? '';
      if (
        call.name === 'guideline_property' &&
        !localReferences.has(reference) &&
        !globalReferences.has(referenceKey(clause.document, reference))
      ) {
        localReferences.set(reference, valueNode(nodes, 'property', propertyLabel(call)));
      }
    }
    // Body quantity facts, and the quantities a body unit types: a ground one reads as its own
    // value, a converted one (variable unit, no entity literal) as one `time quantity` node.
    const bodyFacts = emptyFacts();
    /** `<context>\0<event>\0<object>` → the reading of the body pp an annotation types. */
    /** @type {Map<string, readonly [string, string]>} */
    const bodyTypings = new Map();
    for (const call of clause.body) {
      const [context = '', subject = '', second = '', third = '', fourth = '', fifth = ''] = call.args;
      if (call.name === 'guideline_cardinality') {
        bodyFacts.cardinality.set(subject.trim(), { comparison: third, count: fourth, call });
      }
      if (call.name === 'guideline_satisfies') bodyFacts.satisfies.set(`${context.trim()}\u0000${subject.trim()}`, call);
      if (call.name === 'guideline_range') bodyFacts.range.set(subject.trim(), second.trim());
      if (call.name === 'guideline_order') {
        const reading = ORDER_READINGS.get(termLabel(second));
        if (reading === undefined) throw new Error(`graph: line ${String(clause.line)}: order ${second} is no relation`);
        bodyTypings.set([context, subject, third].map((part) => part.trim()).join('\u0000'), reading);
      }
      if (call.name === 'guideline_interval' && fifth.trim() === 'none') {
        const reading = OFFSET_READINGS.get(termLabel(second));
        if (reading === undefined) throw new Error(`graph: line ${String(clause.line)}: interval role ${second}`);
        bodyTypings.set([context, subject, third].map((part) => part.trim()).join('\u0000'), reading);
      }
    }
    for (const low of bodyFacts.range.keys()) {
      const paired = clause.body.some(
        (call) => call.name === 'guideline_interval' && call.args[3]?.trim() === low,
      );
      if (!paired) throw new Error(`graph: line ${String(clause.line)}: range ${low} pairs with no interval`);
    }
    for (const call of clause.body) {
      if (call.name !== 'guideline_unit') continue;
      const quantity = call.args[1]?.trim() ?? '';
      const reading = quantityReading([bodyFacts], quantity, call.args[2] ?? '', clause.line);
      localReferences.set(
        quantity,
        reading === null
          ? addNode(nodes, {
              id: valueId('quantity', `${clause.document}:${String(clause.sentence ?? 0)}:${quantity}`),
              kind: 'value',
              label: 'time quantity',
              document: clause.document,
              ...(clause.sentence === null ? {} : { sentence: clause.sentence }),
            })
          : valueNode(nodes, 'quantity', reading),
      );
    }
    const resolve = (/** @type {string} */ reference) =>
      resolveReference(nodes, globalReferences, localReferences, clause.document, clause.sentence, reference);
    const isProperty = (/** @type {string} */ reference, /** @type {boolean} */ body) =>
      nodes.get(resolve(reference))?.id.startsWith('value:property:') === true
        ? `${body && isVariable(reference) ? String(clause.line) : clause.document}\u0000${reference.trim()}`
        : undefined;
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
        const target = resolve(args[3] ?? '');
        const property = isProperty(args[3] ?? '', false);
        if (property !== undefined) reachedProperties.add(property);
        emit(clause, 0, 'argument', headNode, target, `argument ${termLabel(args[2] ?? '')}`);
        break;
      }
      case 'guideline_pp': {
        const target = resolve(args[3] ?? '');
        const property = isProperty(args[3] ?? '', false);
        if (property !== undefined) reachedProperties.add(property);
        const typed = headTypings.get(typingKey(clause.document, [headContext, headSubject, headObject]));
        emit(
          clause,
          0,
          'preposition',
          headNode,
          target,
          typed?.[0] ?? termLabel(args[2] ?? ''),
          clause.predicate,
          clause.head,
          typed?.[1],
        );
        break;
      }
      case 'guideline_property': {
        const target = valueNode(nodes, 'property', propertyLabel(clause.head));
        // A referent that resolved to this very node is the property; its copula edge reaches it.
        if (headNode === target) propertyReferents.add(`${clause.document}\u0000${headSubject.trim()}`);
        else emit(clause, 0, 'property', headNode, target, propertyLabel(clause.head));
        break;
      }
      default: {
        const projected = annotationEdge(clause.head, resolve, [headFacts], clause.line);
        if (projected === null) throw new Error(`unsupported graph predicate ${clause.predicate}`);
        emit(
          clause,
          0,
          projected.kind,
          projected.source,
          projected.target,
          projected.label,
          clause.predicate,
          clause.head,
          projected.inverse,
        );
      }
    }
    if (clause.kind === 'rule') {
      // A rule body carries the clinical condition. Earlier graph builds used
      // it only to resolve the parser's operator context, which left concepts
      // such as "opioid therapy" disconnected from recommendations about
      // starting it. Emit each body relation once per controlled sentence so
      // the reader-facing ontology can show the condition as an ordinary
      // entity/action path without multiplying identical bodies for every head.
      // The supersession guard compares the evaluation date, which names no quantity; it projects
      // with the supersession records.
      const evaluationDates = new Set(
        clause.body.filter(({ name }) => name === 'guideline_evaluation_date').map(({ args }) => args[0]?.trim()),
      );
      for (const [index, call] of clause.body.entries()) {
        const condition = (
          /** @type {GraphEdgeKind} */ kind,
          /** @type {string} */ source,
          /** @type {string} */ target,
          /** @type {string} */ label,
          /** @type {string | undefined} */ inverse = undefined,
          /** @type {{ name: string, args: string[] }} */ scopeCall = call,
        ) => {
          // The world joins the key: a relation asserted under a negation and plainly in one
          // sentence is two claims, and a scope-blind key showed the negated one as the plain.
          const key = [clause.document, clause.sentence ?? 0, kind, source, target, label, world(clause, scopeCall)].join(
            '\u0000',
          );
          const shown = emittedConditions.get(key);
          if (shown !== undefined) {
            literalEdges.set(`${String(clause.line)}:${String(index)}`, shown);
            return;
          }
          const id = `edge:${String(clause.line)}:${String(index + 2)}`;
          emittedConditions.set(key, id);
          literalEdges.set(`${String(clause.line)}:${String(index)}`, id);
          emit(clause, index + 2, kind, source, target, label, call.name, scopeCall, inverse);
        };
        if (call.name === 'guideline_arg' || call.name === 'guideline_pp') {
          const source = resolve(call.args[1] ?? '');
          const target = resolve(call.args[3] ?? '');
          const property = isProperty(call.args[3] ?? '', true);
          if (property !== undefined) reachedProperties.add(property);
          const typed =
            call.name === 'guideline_pp'
              ? bodyTypings.get([call.args[0], call.args[1], call.args[3]].map((part) => (part ?? '').trim()).join('\u0000'))
              : undefined;
          condition(
            call.name === 'guideline_arg' ? 'argument' : 'preposition',
            source,
            target,
            call.name === 'guideline_arg'
              ? `argument ${termLabel(call.args[2] ?? '')}`
              : (typed?.[0] ?? termLabel(call.args[2] ?? '')),
            typed?.[1],
          );
        } else if (call.name === 'guideline_property') {
          const source = resolve(call.args[1] ?? '');
          const target = valueNode(nodes, 'property', propertyLabel(call));
          if (source === target) {
            propertyReferents.add(
              `${isVariable(call.args[1] ?? '') ? String(clause.line) : clause.document}\u0000${(call.args[1] ?? '').trim()}`,
            );
          } else condition('property', source, target, propertyLabel(call));
        } else if (call.name === 'guideline_satisfies') {
          if (evaluationDates.has(call.args[1]?.trim())) continue;
          // No context slot: the bound takes the world of the cardinality whose comparison and
          // count it constrains.
          const card = [...bodyFacts.cardinality.values()].find(
            ({ comparison, count }) =>
              comparison.trim() === call.args[0]?.trim() && count.trim() === call.args[1]?.trim(),
          );
          if (card === undefined) throw new Error(`graph: line ${String(clause.line)}: comparison constrains no cardinality`);
          condition(
            'threshold',
            resolve(card.call.args[1] ?? ''),
            valueNode(nodes, 'threshold', conditionBound(call)),
            'condition bound',
            'condition bound of',
            card.call,
          );
        } else if (ANNOTATIONS.has(call.name)) {
          const projected = annotationEdge(call, resolve, [bodyFacts, headFacts], clause.line);
          if (projected !== null) {
            condition(projected.kind, projected.source, projected.target, projected.label, projected.inverse);
          }
        }
      }

      // The consequent event is the bridge from condition to recommendation.
      // Entity arguments on both sides then preserve the n-ary semantics instead
      // of flattening the rule into a noun-to-noun assertion.
      if (clause.predicate === 'guideline_event') {
        for (const [index, call] of clause.body
          .filter(({ name }) => name === 'guideline_event')
          .entries()) {
          const conditionEvent = declareCallNode(
            nodes,
            call,
            clause.document,
            clause.sentence,
            localReferences,
          );
          if (conditionEvent === null || conditionEvent === headNode) continue;
          const key = [
            clause.document,
            clause.sentence ?? 0,
            'implies',
            conditionEvent,
            headNode,
            'condition supports',
          ].join('\u0000');
          const kept = emittedConditions.get(key);
          if (kept !== undefined) {
            conditionMerges.push({
              document: clause.document,
              sentence: clause.sentence ?? 0,
              source: conditionEvent,
              target: headNode,
              kept,
              keptWorld: conditionWorlds.get(key) ?? -1,
              world: world(clause, call),
            });
            continue;
          }
          emittedConditions.set(key, `edge:${String(clause.line)}:${String(clause.body.length + index + 2)}`);
          conditionWorlds.set(key, world(clause, call));
          emit(
            clause,
            clause.body.length + index + 2,
            'implies',
            conditionEvent,
            headNode,
            'condition supports',
            'guideline_condition',
            call,
          );
        }
      }

      // The compiler gives every conditional sentence a first-class context
      // reference. Its operator clause names the modal/negative context; every
      // rule head in that context is one Horn body→head relationship. Keeping
      // this node is what avoids flattening an event into a noun→noun edge.
      const context = resolve(args[0] ?? '');
      emit(clause, 1, 'implies', context, headNode, `condition implies ${clause.predicate}`);
    }
  }
  // Dropping a property's own edge is sound only while a copula edge reaches the property.
  const unreached = [...propertyReferents].filter((key) => !reachedProperties.has(key));
  if (unreached.length > 0) {
    throw new Error(`graph: ${String(unreached.length)} property referent(s) no edge reaches, first ${String(unreached[0]).replace('\u0000', ' ')}`);
  }

  // An operator context whose node no edge touches records the body literals inside it, so a
  // check over the asset can prove each one still shows its operator (`mnt-d49.md`).
  const incident = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const orphans = new Set(
    scopes.flatMap((scope, index) =>
      incident.has(operatorId(scope.document, scope.sentence, scope.reference)) ? [] : [index],
    ),
  );
  for (const clause of parsedClauses) {
    for (const [index, call] of clause.body.entries()) {
      const scope = world(clause, call);
      if (!orphans.has(scope)) continue;
      const record = /** @type {ScopeRecord} */ (scopes[scope]);
      (record.literals ??= []).push({
        line: clause.line,
        index,
        predicate: call.name,
        edge: literalEdges.get(`${String(clause.line)}:${String(index)}`) ?? null,
      });
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
    scopes,
    stats: {
      documents: documents.length,
      clauses: parsedClauses.length,
      nodes: sortedNodes.length,
      edges: sortedEdges.length,
      byNodeKind: countRecord(nodeKinds),
      byEdgeKind: countRecord(edgeKinds),
    },
  };
  return { path: GRAPH_ASSET_PATH, bytes: generatedJson(model), model, conditionMerges };
};
