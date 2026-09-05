import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { parseSemanticGraph, type SemanticGraphEdge } from '../src/graph/model.js';
import { sha256, verifyBag } from '../tools/kb/bag.mjs';
import { generatedJson, parseClauseSites } from '../tools/kb/provenance.mjs';

const raw = readFileSync('kb/generated/graph/semantic-graph.json');
const graph = parseSemanticGraph(JSON.parse(raw.toString()));
const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
const concept = (edge: SemanticGraphEdge): boolean =>
  !['operator', 'cardinality'].includes(edge.kind) &&
  (edge.kind !== 'implies' || edge.label === 'condition supports') &&
  [edge.source, edge.target].every((id) =>
    ['entity', 'event', 'value'].includes(nodes.get(id)?.kind ?? ''),
  );
const archive = readdirSync('kb').filter((name) => name.endsWith('.tar.gz'));
if (archive.length !== 1) throw new Error('expected one vendored bag');
const bagPath = join('kb', archive[0]!);
const bag = readFileSync(bagPath);
expect(sha256(bag)).toBe(readFileSync(`${bagPath}.sha256`, 'utf8').trim().split(/\s+/u)[0]);
const clauses = parseClauseSites(verifyBag(bag).files);
type Clause = (typeof clauses)[number];
const coordinate = (value: { document: string; sentence: number | null }): string =>
  `${value.document}:${String(value.sentence)}`;
const sentenceClauses = new Map<string, Clause[]>();
for (const clause of clauses) {
  if (clause.sentence === null) continue;
  const key = coordinate(clause);
  const group = sentenceClauses.get(key) ?? [];
  group.push(clause);
  sentenceClauses.set(key, group);
}
const callData = (call: Clause['head']) => ({ predicate: call.name, args: call.args });
// Serialization prototypes retain the whole source structure, not a guessed sign.
// Runtime projection/labelling is deliberately NOT implemented by this size probe.
const records = Object.fromEntries(
  [...sentenceClauses].map(([id, group]) => {
    const calls: ReturnType<typeof callData>[] = [];
    const guards: number[][] = [];
    const intern = <T>(values: T[], value: T): number => {
      const key = JSON.stringify(value);
      const previous = values.findIndex((candidate) => JSON.stringify(candidate) === key);
      if (previous >= 0) return previous;
      values.push(value);
      return values.length - 1;
    };
    const rules = group.map((clause) => ({
      line: clause.line,
      head: intern(calls, callData(clause.head)),
      guard: intern(
        guards,
        clause.body.map((call) => intern(calls, callData(call))),
      ),
    }));
    for (const [index, clause] of group.entries()) {
      const rule = rules[index]!;
      expect(calls[rule.head]).toEqual(callData(clause.head));
      expect(guards[rule.guard]!.map((call) => calls[call])).toEqual(clause.body.map(callData));
    }
    return [
      id,
      { document: group[0]!.document, sentence: group[0]!.sentence, calls, guards, rules },
    ];
  }),
);
const oldKinds = new Set(graph.edges.map((edge) => edge.kind));
const kindEdges = graph.edges.map((edge) =>
  concept(edge) ? { ...edge, kind: `${edge.kind}@${coordinate(edge)}` } : edge,
);
const kindCounts = Object.fromEntries(
  [...new Set(kindEdges.map((edge) => edge.kind))]
    .sort()
    .map((kind) => [kind, kindEdges.filter((edge) => edge.kind === kind).length]),
);
const variants = {
  inlineFields: {
    ...graph,
    edges: graph.edges.map((edge) =>
      concept(edge) ? { ...edge, scope: records[coordinate(edge)] } : edge,
    ),
  },
  kindAndRecords: {
    ...graph,
    edges: kindEdges,
    scopes: records,
    stats: { ...graph.stats, byEdgeKind: kindCounts },
  },
  referencedRecords: {
    ...graph,
    edges: graph.edges.map((edge) => (concept(edge) ? { ...edge, scope: coordinate(edge) } : edge)),
    scopes: records,
  },
};

describe('lossless edge-state serialization options', () => {
  it('prices three equivalent scope attachments with the shipped JSON serializer', () => {
    expect(generatedJson(graph)).toEqual(raw);
    const conceptSentences = new Set(graph.edges.filter(concept).map(coordinate));
    const operators = graph.nodes.filter((node) => node.kind === 'operator-context');
    expect(
      operators.every((node) => conceptSentences.has(`${node.document}:${String(node.sentence)}`)),
    ).toBe(true);
    const measured = Object.entries(variants).map(([option, artifact]) => {
      const bytes = generatedJson(artifact);
      const compressed = gzipSync(bytes, { level: 9 });
      return {
        option,
        raw: bytes.length,
        rawDelta: bytes.length - raw.length,
        gzip9: compressed.length,
        gzip9Delta: compressed.length - gzipSync(raw, { level: 9 }).length,
        sha256: sha256(bytes),
      };
    });
    console.log(
      JSON.stringify(
        {
          baseline: {
            raw: raw.length,
            gzip9: gzipSync(raw, { level: 9 }).length,
            sha256: sha256(raw),
          },
          conceptEdgesAttached: graph.edges.filter(concept).length,
          scopeRecords: Object.keys(records).length,
          operatorCoverage: Object.fromEntries(
            [...new Set(operators.map((node) => node.label))]
              .sort()
              .map((label) => [label, operators.filter((node) => node.label === label).length]),
          ),
          edgeKindsBefore: oldKinds.size,
          edgeKindsAfter: Object.keys(kindCounts).length,
          measured,
        },
        null,
        2,
      ),
    );
    expect(measured.every((option) => option.rawDelta > 0)).toBe(true);
    expect(measured.find((option) => option.option === 'referencedRecords')!.raw).toBeLessThan(
      measured.find((option) => option.option === 'inlineFields')!.raw,
    );
  }, 120_000);
});
