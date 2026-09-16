import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  GraphDataError,
  SemanticGraphModel,
  graphRelationLabel,
  parseSemanticGraph,
} from '../src/graph/model.js';

const PATH = fileURLToPath(new URL('../kb/generated/graph/semantic-graph.json', import.meta.url));
const sourceText = readFileSync(PATH, 'utf8');
const graph = new SemanticGraphModel(parseSemanticGraph(JSON.parse(sourceText)));
const ANSWER_DOCUMENTS = [
  'cdc2022-opioid-rec01',
  'cdc2022-opioid-rec02',
  'cdc2022-opioid-rec03',
  'cdc2022-opioid-rec04',
  'cdc2022-opioid-rec05',
  'cdc2022-opioid-rec06',
  'cdc2022-opioid-rec07',
  'cdc2022-opioid-rec08',
  'cdc2022-opioid-rec09',
  'cdc2022-opioid-rec10',
  'cdc2022-opioid-rec11',
  'cdc2022-opioid-rec12',
] as const;

const visibleSemantics = (document: string, sentence: number, line: number): readonly string[] => {
  const view = graph.answerSubgraph({ document, sentences: [sentence], lines: [line] });
  if (view === undefined)
    throw new Error(`missing answer graph for ${document}:${String(sentence)}`);
  return [...view.nodes.map(({ label }) => label), ...view.edges.map(({ label }) => label)];
};

describe('semantic graph source fidelity review', () => {
  it('keeps polarity and modality visible for a negated recommendation', () => {
    // ACE: If an opioid-benefit does not outweigh an opioid-risk then every
    // clinician should not consider an opioid-therapy for an acute-pain.
    const semantics = visibleSemantics('cdc2022-opioid-rec01', 3, 506);

    expect(semantics.some((label) => /\bshould\b/iu.test(label))).toBe(true);
    expect(semantics.some((label) => /\b(?:not|negative|negated)\b/iu.test(label))).toBe(true);
  });

  it('keeps modal force and numeric scope visible for a qualified action', () => {
    // ACE: An opioid-continuation may initiate a long-term-opioid-therapy after 30 days.
    const semantics = visibleSemantics('cdc2022-opioid-rec02-imp21', 1, 1795);

    expect(semantics.some((label) => /\bmay\b/iu.test(label))).toBe(true);
    expect(semantics.some((label) => /\b30\b/u.test(label))).toBe(true);
  });

  it('does not count attributes as concepts or actions', () => {
    const conceptsAndActions = graph.data.nodes.filter(
      (node) =>
        (node.kind === 'entity' || node.kind === 'event') &&
        graph.conceptIncident(node.id).length > 0,
    );

    expect(graph.conceptNodeCount).toBe(conceptsAndActions.length);
  });

  it('keeps a nested operator edge attached to its asserted outer context', () => {
    const edges = graph.data.edges.filter(
      ({ document, sentence, kind }) =>
        document === 'cdc2022-opioid-rec01' && sentence === 3 && kind === 'operator',
    );
    const negative = edges.find(({ label }) => label === '-');
    const should = edges.find(({ label }) => label === 'should');

    expect(negative).toBeDefined();
    expect(should?.source).toBe(negative?.target);
  });

  it('does not turn a negated premise into positive event support', () => {
    const inverted = graph.data.edges.find(
      ({ document, sentence, kind, source, target, label }) =>
        document === 'cdc2022-opioid-rec01' &&
        sentence === 3 &&
        kind === 'implies' &&
        source === 'event:outweigh' &&
        target === 'event:consider' &&
        label === 'condition supports',
    );

    expect(inverted).toBeUndefined();
  });

  it('rejects an argument edge whose source is not an event', () => {
    const malformed = JSON.parse(sourceText) as {
      edges: { id: string; source: string }[];
    };
    malformed.edges = malformed.edges.map((edge) =>
      edge.id === 'edge:513:0' ? { ...edge, source: 'document:cdc2022-opioid-rec01' } : edge,
    );

    expect(() => parseSemanticGraph(malformed)).toThrow(GraphDataError);
  });

  it('does not highlight a direct edge that skips hidden negation contexts', () => {
    const view = graph.answerSubgraph({
      document: 'cdc2022-opioid-rec01',
      sentences: [3],
      lines: [506],
    });

    expect(view?.highlight.edges).not.toContain('edge:512:12');
  });

  it('reverses a directed relation label when HTML navigation starts at its target', () => {
    // ACE: If a benefit outweighs a risk then every clinician should ... continue an opioid-therapy.
    const support = graph.edge('edge:4501:11');
    if (support === undefined) throw new Error('missing positive condition-support edge');

    expect(graphRelationLabel(support, support.target)).toBe('supported by condition · should');
  });

  it('keeps every prepared answer highlight inside its cited source contribution', () => {
    for (const document of ANSWER_DOCUMENTS) {
      const documentEdges = graph.data.edges.filter((edge) => edge.document === document);
      const sentences = [
        ...new Set(documentEdges.flatMap(({ sentence }) => (sentence === null ? [] : [sentence]))),
      ];
      const firstLine = documentEdges[0]?.line;
      if (firstLine === undefined) throw new Error(`missing graph edges for ${document}`);
      const view = graph.answerSubgraph({ document, sentences, lines: [firstLine] });
      if (view === undefined) throw new Error(`missing answer graph for ${document}`);

      for (const id of view.highlight.edges) {
        const edge = graph.edge(id);
        if (edge === undefined) throw new Error(`missing highlighted edge ${id}`);
        expect(edge.document, `${document}/${id}`).toBe(document);
        expect(
          edge.sentence === null || sentences.includes(edge.sentence),
          `${document}/${id}`,
        ).toBe(true);
      }
    }
  });
});
