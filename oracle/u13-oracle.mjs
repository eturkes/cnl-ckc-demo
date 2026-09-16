import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ASSET = fileURLToPath(new URL('../kb/generated/graph/semantic-graph.json', import.meta.url));
const CONCEPT_KINDS = new Set(['entity', 'event', 'value']);

const coordinate = (document, sentence, reference) =>
  `${document}${sentence === null ? '' : String(sentence)}${reference}`;

export const readAsset = () => JSON.parse(readFileSync(ASSET, 'utf8'));

export const deriveScopeChains = (asset) => {
  const byReference = new Map(
    asset.scopes.map((scope, index) => [
      coordinate(scope.document, scope.sentence, scope.reference),
      { index, scope },
    ]),
  );
  return asset.scopes.map((scope) =>
    scope.chain.flatMap((reference) => {
      const resolved = byReference.get(coordinate(scope.document, scope.sentence, reference));
      return resolved === undefined ? [] : [resolved.scope.operator];
    }),
  );
};

const retained = (edge, nodes) => {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  return (
    source !== undefined &&
    target !== undefined &&
    CONCEPT_KINDS.has(source.kind) &&
    CONCEPT_KINDS.has(target.kind) &&
    edge.kind !== 'operator' &&
    (edge.kind !== 'implies' || edge.label === 'condition supports') &&
    (edge.kind !== 'cardinality' || edge.label !== 'na eq 1')
  );
};

const compareOccurrence = (left, right) =>
  left.line - right.line || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);

export const deriveProjection = (asset) => {
  const nodes = new Map(asset.nodes.map((node) => [node.id, node]));
  const scopeChains = deriveScopeChains(asset);
  const groups = new Map();
  for (const edge of asset.edges) {
    if (!retained(edge, nodes)) continue;
    const scope = edge.scope === undefined ? [] : (scopeChains[edge.scope] ?? []);
    const key = JSON.stringify([edge.kind, edge.source, edge.target, edge.label, ...scope]);
    const occurrence = { ...edge, relation: edge.label, scope: [...scope] };
    const group = groups.get(key) ?? [];
    group.push(occurrence);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, occurrences]) => {
      occurrences.sort(compareOccurrence);
      return { key, representative: occurrences[0], occurrences };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
};

export const projectionSummary = (asset) => {
  const groups = deriveProjection(asset);
  const rows = groups.map(({ representative }) => ({
    id: representative.id,
    relation: representative.relation,
    scope: representative.scope,
  }));
  return {
    groups: groups.length,
    occurrences: groups.reduce((sum, group) => sum + group.occurrences.length, 0),
    scopeBearing: groups.filter(({ representative }) => representative.scope.length > 0).length,
    digest: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    rows,
  };
};

const main = () => {
  const summary = projectionSummary(readAsset());
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(summary.rows, null, 2)}\n`);
    return;
  }
  console.log(
    `O1 groups=${String(summary.groups)} scope-bearing=${String(summary.scopeBearing)} ` +
      `occurrences=${String(summary.occurrences)} sha256=${summary.digest}`,
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
