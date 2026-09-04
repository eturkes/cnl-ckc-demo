import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GRAPH_EDGE_KINDS,
  GRAPH_NODE_KINDS,
  SemanticGraphModel,
  parseSemanticGraph,
} from '../src/graph/model.js';
import { QUESTION_CATALOG } from '../src/questions/catalog.js';
import type { QuestionId } from '../src/questions/catalog.js';

const PATH = fileURLToPath(new URL('../kb/generated/graph/semantic-graph.json', import.meta.url));
const input: unknown = JSON.parse(readFileSync(PATH, 'utf8'));
const graph = parseSemanticGraph(input);
const PROVENANCE = fileURLToPath(new URL('../kb/generated/provenance/documents/', import.meta.url));
const ANSWER_SOURCES = {
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
} as const satisfies Readonly<Record<QuestionId, readonly string[]>>;

describe('generated semantic graph', () => {
  it('passes the runtime boundary with every declared node and edge kind', () => {
    expect([...new Set(graph.nodes.map(({ kind }) => kind))].sort()).toEqual(
      [...GRAPH_NODE_KINDS].sort(),
    );
    expect([...new Set(graph.edges.map(({ kind }) => kind))].sort()).toEqual(
      [...GRAPH_EDGE_KINDS].sort(),
    );
    expect(graph.stats.nodes).toBe(graph.nodes.length);
    expect(graph.stats.edges).toBe(graph.edges.length);
    expect(graph.stats.documents).toBeGreaterThan(0);
    expect(graph.stats.byEdgeKind['implies']).toBeGreaterThan(0);
  });

  it('opens a bounded, connected document neighborhood', () => {
    const model = new SemanticGraphModel(graph);
    const document = graph.nodes.find(({ kind }) => kind === 'document');
    if (document === undefined) throw new Error('generated graph contains no document node');
    const neighborhood = model.neighborhood(document.id);
    expect(neighborhood.nodes[0]).toBe(document);
    expect(neighborhood.nodes.length).toBeGreaterThan(1);
    expect(neighborhood.nodes.length).toBeLessThanOrEqual(80);
    expect(neighborhood.edges.length).toBeGreaterThan(0);
    expect(model.search(document.label, 1)[0]).toBe(document);
  });

  it('centers the first clinical answer on opioid therapy and highlights only its concept paths', () => {
    const model = new SemanticGraphModel(graph);
    const focus = {
      document: 'cdc2022-opioid-rec01',
      sentences: [2, 3],
      lines: [496, 506],
      question: QUESTION_CATALOG['when-to-use-opioids'].question,
      answer:
        'Clinicians should maximize nonopioid therapy for acute pain and should only consider opioid therapy when benefits outweigh risks.',
    } as const;
    const view = model.answerSubgraph(focus);

    expect(view?.root).toBe('entity:opioid-therapy');
    expect(view?.nodes.some(({ kind }) => kind === 'document')).toBe(false);
    expect(view?.nodes.some(({ kind }) => kind === 'operator-context')).toBe(false);
    expect(view?.highlight.nodes).toContain('entity:opioid-therapy');
    expect(view?.highlight.edges.length).toBeGreaterThan(0);
    expect(view?.nodes.length).toBeGreaterThan(view?.highlight.nodes.length ?? 0);
    expect(
      view?.highlight.edges.every(
        (id) => view.edges.find((edge) => edge.id === id)?.document === focus.document,
      ),
    ).toBe(true);
    expect(model.answerSubgraph(focus)).toEqual(view);
  });

  it('produces a concept-first answer map for every prepared source contribution', () => {
    const model = new SemanticGraphModel(graph);
    const roots: string[] = [];
    for (const [id, documents] of Object.entries(ANSWER_SOURCES) as [
      QuestionId,
      readonly string[],
    ][]) {
      for (const document of documents) {
        const chunk = JSON.parse(readFileSync(join(PROVENANCE, `${document}.json`), 'utf8')) as {
          ace: { text: string; sentences: { number: number }[] };
          clauses: { line: number; sentence: number | null }[];
        };
        const sentences = chunk.ace.sentences.slice(1).map(({ number }) => number);
        const lines = sentences.flatMap((sentence) => {
          const clause = chunk.clauses.find((candidate) => candidate.sentence === sentence);
          return clause === undefined ? [] : [clause.line];
        });
        const view = model.answerSubgraph({
          document,
          sentences,
          lines,
          question: QUESTION_CATALOG[id].question,
          answer: chunk.ace.text,
        });
        const root = view === undefined ? undefined : model.node(view.root);
        expect(root, `${id}/${document} primary concept`).toBeDefined();
        expect(root?.kind, `${id}/${document} primary concept kind`).toBe('entity');
        expect(
          view?.highlight.edges.length,
          `${id}/${document} highlighted relationships`,
        ).toBeGreaterThan(0);
        expect(
          view?.nodes.some(({ kind }) => kind === 'document' || kind === 'operator-context'),
          `${id}/${document} technical nodes`,
        ).toBe(false);
        roots.push(`${id}/${document}: ${root?.label ?? 'missing'}`);
      }
    }
    expect(roots).toEqual([
      'when-to-use-opioids/cdc2022-opioid-rec01: opioid-therapy',
      'when-to-use-opioids/cdc2022-opioid-rec02: opioid-therapy',
      'starting-opioid-therapy/cdc2022-opioid-rec03: opioid-therapy',
      'starting-opioid-therapy/cdc2022-opioid-rec04: opioid-therapy',
      'acute-pain-prescription-duration/cdc2022-opioid-rec06: acute-pain',
      'opioid-follow-up/cdc2022-opioid-rec07: opioid-benefit',
      'opioid-safety/cdc2022-opioid-rec08: opioid-related-harm',
      'opioid-safety/cdc2022-opioid-rec09: initial-opioid-therapy',
      'opioid-safety/cdc2022-opioid-rec10: opioid',
      'opioid-safety/cdc2022-opioid-rec11: opioid',
      'continuing-or-tapering-opioids/cdc2022-opioid-rec05: opioid',
      'opioid-use-disorder-treatment/cdc2022-opioid-rec12: opioid-use-disorder',
    ]);
  });
});
