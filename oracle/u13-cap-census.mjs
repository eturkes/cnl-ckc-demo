import { deriveProjection, readAsset } from './u13-oracle.mjs';

const DEFAULT_NEIGHBOR_LIMIT = 80;
const DEFAULT_EDGE_LIMIT = 480;
const FALLBACK_RELATION_LIMIT = 60;

const compareNode = (left, right) =>
  left.label.localeCompare(right.label, 'en', { sensitivity: 'base', numeric: true }) ||
  left.kind.localeCompare(right.kind) ||
  left.id.localeCompare(right.id);

const compareEdge = (left, right) =>
  left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);

const relationIdentity = (edge) =>
  JSON.stringify([edge.kind, edge.source, edge.target, edge.relation]);

export const deriveCapCensus = (asset) => {
  const nodes = new Map(asset.nodes.map((node) => [node.id, node]));
  const edges = deriveProjection(asset).map(({ representative }) => representative);
  const adjacent = new Map();
  for (const edge of edges) {
    for (const id of [edge.source, edge.target]) {
      const incident = adjacent.get(id) ?? [];
      incident.push(edge);
      adjacent.set(id, incident);
    }
  }

  const rows = [];
  const splitRelations = new Set();
  const splitVariants = [];
  for (const [root, unsorted] of adjacent) {
    const incident = [...unsorted].sort(compareEdge);
    const peers = [
      ...new Set(incident.map((edge) => (edge.source === root ? edge.target : edge.source))),
    ]
      .map((id) => nodes.get(id))
      .sort(compareNode)
      .map(({ id }) => id);
    const uncappedNodes = new Set([root, ...peers]);
    const selectedNodes = new Set([root, ...peers.slice(0, DEFAULT_NEIGHBOR_LIMIT - 1)]);
    const uncappedEdges = edges
      .filter((edge) => uncappedNodes.has(edge.source) && uncappedNodes.has(edge.target))
      .sort(compareEdge);
    const boundedEdges = edges
      .filter((edge) => selectedNodes.has(edge.source) && selectedNodes.has(edge.target))
      .sort(compareEdge);
    const visibleEdges = boundedEdges.slice(0, DEFAULT_EDGE_LIMIT);
    const boundedIds = new Set(boundedEdges.map(({ id }) => id));
    const boundedMeaning = new Set(boundedEdges.map(relationIdentity));
    const nodeMeaningSplit = uncappedEdges.filter(
      (edge) => !boundedIds.has(edge.id) && boundedMeaning.has(relationIdentity(edge)),
    ).length;
    const fallbackKept = incident.slice(0, FALLBACK_RELATION_LIMIT);
    const fallbackKeys = new Set(fallbackKept.map(relationIdentity));
    const fallbackDropped = incident.slice(FALLBACK_RELATION_LIMIT);
    for (const edge of fallbackDropped) {
      const identity = relationIdentity(edge);
      if (!fallbackKeys.has(identity)) continue;
      splitRelations.add(`${root}\n${identity}`);
      splitVariants.push(edge.id);
    }
    rows.push({
      root,
      degree: incident.length,
      nodeDrop: Math.max(0, peers.length - (DEFAULT_NEIGHBOR_LIMIT - 1)),
      nodeEdgeDrop: uncappedEdges.length - boundedEdges.length,
      nodeMeaningSplit,
      edgeDrop: boundedEdges.length - visibleEdges.length,
      fallbackDrop: fallbackDropped.length,
    });
  }

  const aggregate = (key) => {
    const ordered = [...rows].sort((left, right) => right[key] - left[key]);
    return {
      affected: rows.filter((row) => row[key] > 0).length,
      total: rows.reduce((sum, row) => sum + row[key], 0),
      max: ordered[0],
    };
  };
  return {
    roots: rows.length,
    nodeCap: aggregate('nodeDrop'),
    nodeCapEdges: aggregate('nodeEdgeDrop'),
    nodeMeaningSplits: aggregate('nodeMeaningSplit'),
    searchCap: { query: 'e', candidates: adjacent.size, dropped: Math.max(0, adjacent.size - 24) },
    edgeCap: aggregate('edgeDrop'),
    fallbackCap: aggregate('fallbackDrop'),
    fallbackScopeSplits: {
      relations: splitRelations.size,
      droppedVariants: splitVariants.length,
      uniqueDroppedEdges: new Set(splitVariants).size,
    },
  };
};

const census = deriveCapCensus(readAsset());
console.log(
  `O5 roots=${String(census.roots)} search24('${census.searchCap.query}')=` +
    `${String(census.searchCap.dropped)}/${String(census.searchCap.candidates)} nodes removed; ` +
    `node80=${String(census.nodeCap.affected)} roots/${String(census.nodeCap.total)} nodes/` +
    `${String(census.nodeCapEdges.total)} edge-view rows removed/` +
    `${String(census.nodeMeaningSplits.total)} meaning splits ` +
    `(max ${census.nodeCap.max.root}:${String(census.nodeCap.max.nodeDrop)} nodes/` +
    `${String(census.nodeCapEdges.max.nodeEdgeDrop)} edges); ` +
    `edge480=${String(census.edgeCap.affected)} roots/${String(census.edgeCap.total)} removed; ` +
    `fallback60=${String(census.fallbackCap.affected)} roots/${String(census.fallbackCap.total)} removed; ` +
    `meaning-splits=${String(census.fallbackScopeSplits.relations)} relations/` +
    `${String(census.fallbackScopeSplits.droppedVariants)} variants`,
);
