import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SemanticGraphModel, graphRelationLabel, parseSemanticGraph } from '../src/graph/model.js';
import { answerDocuments } from '../tools/answer-oracle.mjs';
import { deriveCapCensus } from './u13-cap-census.mjs';
import { deriveProjection, deriveSpanningScopes, readAsset } from './u13-oracle.mjs';

const GENERATED = join(process.cwd(), 'kb/generated');
const json = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
const fail = (message: string): never => {
  throw new Error(message);
};

const focusTokens = () => {
  const catalog = json(join(GENERATED, 'question-catalog.json'));
  const questions = new Map(
    catalog.entries.map(({ id, question }: { id: string; question: string }) => [id, question]),
  );
  const tokens = [];
  for (const [id, documents] of answerDocuments(fail)) {
    const question = questions.get(id);
    if (question === undefined) fail(`${id}: missing question`);
    for (const document of documents) {
      const chunk = json(join(GENERATED, 'provenance/documents', `${document}.json`));
      const sentences = chunk.ace.sentences
        .slice(1)
        .map(({ number }: { number: number }) => number);
      const lines = sentences.flatMap((sentence: number) => {
        const clause = chunk.clauses.find(
          (candidate: { sentence: number | null }) => candidate.sentence === sentence,
        );
        return clause === undefined ? [] : [clause.line];
      });
      tokens.push({ document, sentences, lines, question, answer: chunk.ace.text });
    }
  }
  return tokens;
};

const exactWhenShown = (view: {
  relation: string;
  scope: string[];
  label: string | null;
}): boolean =>
  view.label === null ||
  view.label ===
    [
      view.relation,
      ...view.scope.map((operator) => (operator === '-' ? 'negated' : operator)),
    ].join(' · ');

describe('u13 predicate gap witnesses', () => {
  it('shows concrete inputs that the written predicates can miss', () => {
    const asset = readAsset();
    const model = new SemanticGraphModel(parseSemanticGraph(asset));
    const groups = deriveProjection(asset);
    const groupByOccurrence = new Map(
      groups.flatMap((group: any) => group.occurrences.map(({ id }: any) => [id, group])),
    );
    const spanning = deriveSpanningScopes(asset);
    const affected = new Set(
      spanning.different.map(({ id }) => (groupByOccurrence.get(id) as any).key),
    );

    const fixtureKeys = new Set<string>();
    for (const focus of focusTokens()) {
      const view = model.answerSubgraph(focus);
      if (view === undefined) fail(`${focus.document}: no answer fixture`);
      for (const { id } of view.edges) {
        const group: any = groupByOccurrence.get(id);
        if (group !== undefined) fixtureKeys.add(group.key);
      }
    }
    let hub = '';
    let widest = -1;
    for (const node of model.data.nodes) {
      const degree = model.conceptIncident(node.id).length;
      if (degree <= widest) continue;
      hub = node.id;
      widest = degree;
    }
    for (const { id } of model.conceptNeighborhood(hub, 1, 80).edges) {
      const group: any = groupByOccurrence.get(id);
      if (group !== undefined) fixtureKeys.add(group.key);
    }
    const covered = [...affected].filter((key) => fixtureKeys.has(key));
    const uncovered = [...affected].filter((key) => !fixtureKeys.has(key));
    const uncoveredIds = uncovered.slice(0, 5).map((key) => {
      const group = groups.find((candidate: any) => candidate.key === key);
      return group?.representative.id;
    });

    const shortcut = model.edge('edge:512:12');
    const target = model.edge('edge:512:0');
    if (shortcut === undefined || target === undefined) fail('edge:512 scope witness is missing');
    const partialFallback = graphRelationLabel(shortcut, shortcut.target);
    const nullModalPasses = exactWhenShown({
      relation: 'condition supports',
      scope: ['should'],
      label: null,
    });
    const caps = deriveCapCensus(asset);

    console.log(
      `O6 V2-null-modal-passes=${String(nullModalPasses)}; ` +
        `V3-edge512=model${JSON.stringify(shortcut.scopeOperators)} target${JSON.stringify(target.scopeOperators)} ` +
        `text=${JSON.stringify(partialFallback)}; ` +
        `V4-fixtures-cover=${String(covered.length)}/${String(affected.size)} spanning groups ` +
        `uncovered=${JSON.stringify(uncoveredIds)}; ` +
        `V7-search-drops=${String(caps.searchCap.dropped)} fallback-splits=` +
        `${String(caps.fallbackScopeSplits.droppedVariants)}`,
    );

    expect(nullModalPasses).toBe(true);
    expect(shortcut.scopeOperators).toEqual(['-']);
    expect(target.scopeOperators).toEqual(['-', 'should']);
    expect(uncovered.length).toBeGreaterThan(0);
    expect(caps.fallbackScopeSplits.droppedVariants).toBeGreaterThan(0);
  }, 20_000);
});
