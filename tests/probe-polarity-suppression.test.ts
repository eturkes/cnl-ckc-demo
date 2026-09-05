import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  GRAPH_EDGE_KINDS,
  SemanticGraphModel,
  parseSemanticGraph,
  type SemanticGraphData,
  type SemanticGraphEdge,
} from '../src/graph/model.js';
import { QUESTION_CATALOG } from '../src/questions/catalog.js';
import { sha256, verifyBag } from '../tools/kb/bag.mjs';
import { parseClauseSites } from '../tools/kb/provenance.mjs';

const bytes = readFileSync('kb/generated/graph/semantic-graph.json');
const graph = parseSemanticGraph(JSON.parse(bytes.toString()));
const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
const baseline = new SemanticGraphModel(graph);
const archive = readdirSync('kb').filter((name) => name.endsWith('.tar.gz'));
if (archive.length !== 1) throw new Error('expected one vendored bag');
const bagPath = join('kb', archive[0]!);
const bag = readFileSync(bagPath);
expect(sha256(bag)).toBe(readFileSync(`${bagPath}.sha256`, 'utf8').trim().split(/\s+/u)[0]);
const clauses = parseClauseSites(verifyBag(bag).files);
const coordinate = (value: { document: string; sentence: number | null }): string =>
  `${value.document}:${String(value.sentence)}`;
const concept = (edge: SemanticGraphEdge): boolean =>
  edge.kind !== 'operator' &&
  edge.kind !== 'cardinality' &&
  (edge.kind !== 'implies' || edge.label === 'condition supports') &&
  [edge.source, edge.target].every((id) =>
    ['entity', 'event', 'value'].includes(nodes.get(id)?.kind ?? ''),
  );
const conceptEdges = graph.edges.filter(concept);
const negativeSentences = new Set(
  graph.nodes
    .filter((node) => node.kind === 'operator-context' && node.label === '-')
    .map((node) => `${node.document}:${String(node.sentence)}`),
);
const qualifiedSentences = new Set(
  clauses
    .filter(
      (clause) =>
        clause.sentence !== null &&
        (clause.kind === 'rule' ||
          [clause.head, ...clause.body].some((call) =>
            ['guideline_operator', 'guideline_cardinality'].includes(call.name),
          )),
    )
    .map(coordinate),
);
const sources = {
  'when-to-use-opioids': ['cdc2022-opioid-rec01', 'cdc2022-opioid-rec02'],
  'starting-opioid-therapy': ['cdc2022-opioid-rec03', 'cdc2022-opioid-rec04'],
  'acute-pain-prescription-duration': ['cdc2022-opioid-rec06'],
  'opioid-follow-up': ['cdc2022-opioid-rec07'],
  'opioid-safety': [
    'cdc2022-opioid-rec08',
    'cdc2022-opioid-rec09',
    'cdc2022-opioid-rec10',
    'cdc2022-opioid-rec11',
  ],
  'continuing-or-tapering-opioids': ['cdc2022-opioid-rec05'],
  'opioid-use-disorder-treatment': ['cdc2022-opioid-rec12'],
} as const;

const suppress = (sentences: ReadonlySet<string>): SemanticGraphData => {
  const edges = graph.edges.filter((edge) => !concept(edge) || !sentences.has(coordinate(edge)));
  return parseSemanticGraph({
    ...graph,
    edges,
    stats: {
      ...graph.stats,
      edges: edges.length,
      byEdgeKind: Object.fromEntries(
        GRAPH_EDGE_KINDS.map((kind) => [kind, edges.filter((edge) => edge.kind === kind).length]),
      ),
    },
  });
};

const topicHighlights = (model: SemanticGraphModel) =>
  Object.entries(sources).map(([id, documents]) => ({
    topic: id,
    contributions: documents.map((document) => {
      const chunk = JSON.parse(
        readFileSync(`kb/generated/provenance/documents/${document}.json`, 'utf8'),
      ) as { ace: { text: string; sentences: { number: number }[] } };
      const focus = {
        document,
        sentences: chunk.ace.sentences.slice(1).map(({ number }) => number),
        question: QUESTION_CATALOG[id as keyof typeof sources].question,
        answer: chunk.ace.text,
      };
      const before = baseline.answerSubgraph(focus);
      const after = model.answerSubgraph(focus);
      return {
        document,
        before: before?.highlight.edges.length ?? 0,
        after: after?.highlight.edges.length ?? 0,
        viewSurvives: after !== undefined,
      };
    }),
  }));

describe('polarity suppression option measurements', () => {
  it('measures negative-only and fail-closed sentence suppression, not a minimum edge cut', () => {
    expect(conceptEdges.length).toBeGreaterThan(0);
    const measurements = Object.entries({
      negativeOnly: negativeSentences,
      allQualified: qualifiedSentences,
    }).map(([policy, excluded]) => {
      const data = suppress(excluded);
      const model = new SemanticGraphModel(data);
      const topics = topicHighlights(model);
      return {
        policy,
        excludedSentences: excluded.size,
        rawConceptEdgesBefore: conceptEdges.length,
        rawConceptEdgesDropped: conceptEdges.filter((edge) => excluded.has(coordinate(edge)))
          .length,
        uniqueConceptEdgesBefore: baseline.conceptEdgeCount,
        uniqueConceptEdgesAfter: model.conceptEdgeCount,
        conceptNodesBefore: baseline.conceptNodeCount,
        conceptNodesAfter: model.conceptNodeCount,
        topicsWithAnyHighlight: topics.filter((topic) =>
          topic.contributions.some((entry) => entry.after > 0),
        ).length,
        contributionsWithHighlight: topics
          .flatMap((topic) => topic.contributions)
          .filter((entry) => entry.after > 0).length,
        negativeExampleAfter:
          model.answerSubgraph({ document: 'cdc2022-opioid-rec01', sentences: [3] })?.highlight
            .edges.length ?? 0,
        topics,
      };
    });
    console.log(
      JSON.stringify(
        {
          graphBytes: bytes.length,
          graphGzip9: gzipSync(bytes, { level: 9 }).length,
          measurements,
        },
        null,
        2,
      ),
    );
    expect(measurements.every((row) => row.negativeExampleAfter === 0)).toBe(true);
    expect(
      measurements.find((row) => row.policy === 'allQualified')?.contributionsWithHighlight,
    ).toBe(0);
  });
});
