// TEMPORARY evaluation probe — not committed. Drives the real answer-graph
// projection with the focus token the UI hands it for a negated recommendation.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it } from 'vitest';

import {
  SemanticGraphModel,
  graphNodeLabel,
  graphRelationLabel,
  parseSemanticGraph,
} from '../src/graph/model.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

describe('probe', () => {
  it('renders the negated recommendation', () => {
    const data = parseSemanticGraph(
      JSON.parse(
        readFileSync(join(ROOT, 'kb/generated/graph/semantic-graph.json'), 'utf8'),
      ) as unknown,
    );
    const model = new SemanticGraphModel(data);
    const focus = {
      document: 'cdc2022-opioid-rec01',
      sentences: [3],
      question: 'When should clinicians consider opioid therapy for pain?',
      answer:
        'If an opioid benefit does not outweigh an opioid risk, clinicians should not consider opioid therapy for acute pain.',
    };
    const view = model.answerSubgraph(focus);
    if (view === undefined) throw new Error('no answer view');
    const node = (id: string) => model.node(id);
    console.log('root =', graphNodeLabel(node(view.root)!));
    console.log(
      'hiddenTechnicalNodes =',
      view.hiddenTechnicalNodes,
      'hiddenTechnicalEdges =',
      view.hiddenTechnicalEdges,
    );
    console.log('visible nodes:', view.nodes.map((n) => `${graphNodeLabel(n)}[${n.kind}]`).join(', '));
    console.log('HIGHLIGHTED (cited proof) edges:');
    for (const id of view.highlight.edges) {
      const e = model.edge(id)!;
      console.log(
        `  ${graphNodeLabel(node(e.source)!)} --${graphRelationLabel(e, e.source)}--> ${graphNodeLabel(node(e.target)!)}`,
      );
    }
    console.log('all visible edges:', view.edges.length);
    for (const e of view.edges.slice(0, 20)) {
      console.log(
        `  ${graphNodeLabel(node(e.source)!)} --${graphRelationLabel(e, e.source)}--> ${graphNodeLabel(node(e.target)!)}`,
      );
    }
    const evidence = model.evidenceSubgraph(focus)!;
    console.log(
      'evidence subgraph (accessible view) node kinds:',
      JSON.stringify(
        Object.fromEntries(
          [...new Set(evidence.nodes.map((n) => n.kind))].map((k) => [
            k,
            evidence.nodes.filter((n) => n.kind === k).map((n) => n.label).join('|'),
          ]),
        ),
        null,
        1,
      ),
    );
  });
});
