import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SemanticGraphModel, parseSemanticGraph } from '../src/graph/model.js';

const PATH = fileURLToPath(new URL('../kb/generated/graph/semantic-graph.json', import.meta.url));
const graph = new SemanticGraphModel(parseSemanticGraph(JSON.parse(readFileSync(PATH, 'utf8'))));

const visibleSemantics = (document: string, sentence: number, line: number): readonly string[] => {
  const view = graph.answerSubgraph({ document, sentences: [sentence], lines: [line] });
  if (view === undefined) throw new Error(`missing answer graph for ${document}:${String(sentence)}`);
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
});
