import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SemanticGraphModel, parseSemanticGraph } from '../src/graph/model.js';
import { answerDocuments } from '../tools/answer-oracle.mjs';
import { deriveProjection, readAsset } from './u13-oracle.mjs';

const GENERATED = join(process.cwd(), 'kb/generated');
const json = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const fail = (message: string): never => {
  throw new Error(message);
};

const normalized = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase('en-US')
    .trim();
const words = (value: string): string[] =>
  normalized(value)
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((word) => word !== '');
const singular = (word: string): string => {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};
const lexicalWords = (value: string): string[] => words(value).map(singular);
const phraseIncludes = (haystack: string[], needle: string[]): boolean =>
  needle.length > 0 &&
  needle.length <= haystack.length &&
  haystack.some(
    (_word, index) =>
      index + needle.length <= haystack.length &&
      needle.every((word, offset) => haystack[index + offset] === word),
  );
const lexicalScore = (label: string, text: string, phraseWeight: number): number => {
  const labelWords = lexicalWords(label);
  const textWords = lexicalWords(text);
  const textSet = new Set(textWords);
  const overlap = labelWords.filter((word) => textSet.has(word)).length;
  return (
    (phraseIncludes(textWords, labelWords) ? phraseWeight : 0) +
    overlap * 320 +
    (labelWords.length > 0 ? Math.round((overlap / labelWords.length) * 120) : 0)
  );
};
const compareNodes = (left: any, right: any): number =>
  left.label.localeCompare(right.label, 'en', { sensitivity: 'base', numeric: true }) ||
  left.kind.localeCompare(right.kind) ||
  left.id.localeCompare(right.id);
const compareEdges = (left: any, right: any): number =>
  left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
const otherEnd = (edge: any, id: string): string =>
  edge.source === id ? edge.target : edge.source;
const conceptRole = (edge: any): number => {
  if (edge.kind === 'argument') {
    if (edge.relation === 'argument 2') return 4;
    if (edge.relation === 'argument 1') return 1;
    return 3;
  }
  if (edge.kind === 'preposition') return 3;
  if (edge.kind === 'property') return 2;
  return 1;
};

const focusTokens = () => {
  const catalog = json(join(GENERATED, 'question-catalog.json')) as {
    entries: { id: string; question: string }[];
  };
  const questions = new Map(catalog.entries.map(({ id, question }) => [id, question]));
  const tokens = [];
  for (const [id, documents] of answerDocuments(fail)) {
    const question = questions.get(id);
    if (question === undefined) fail(`${id}: missing question`);
    for (const document of documents) {
      const chunk = json(join(GENERATED, 'provenance/documents', `${document}.json`)) as {
        ace: { text: string; sentences: { number: number }[] };
        clauses: { line: number; sentence: number | null }[];
      };
      const sentences = chunk.ace.sentences.slice(1).map(({ number }) => number);
      const lines = sentences.flatMap((sentence) => {
        const clause = chunk.clauses.find((candidate) => candidate.sentence === sentence);
        return clause === undefined ? [] : [clause.line];
      });
      tokens.push({ document, sentences, lines, question, answer: chunk.ace.text });
    }
  }
  return tokens;
};

const deriveAnswerView = (
  asset: any,
  model: SemanticGraphModel,
  focus: ReturnType<typeof focusTokens>[number],
  root: string,
  nodeLimit: number,
) => {
  const groups = deriveProjection(asset);
  const groupByOccurrence = new Map(
    groups.flatMap((group: any) => group.occurrences.map((edge: any) => [edge.id, group])),
  );
  const evidence = model.evidenceSubgraph(focus);
  if (evidence === undefined) fail(`${focus.document}: no evidence`);
  const rawEvidenceIds = new Set(evidence.edges.map(({ id }) => id));
  const evidenceConceptEdges = evidence.edges.flatMap(({ id }) => {
    const group: any = groupByOccurrence.get(id);
    const edge = group?.occurrences.find((candidate: any) => candidate.id === id);
    return edge === undefined ? [] : [edge];
  });
  const evidenceAdjacent = new Map<string, any[]>();
  for (const edge of evidenceConceptEdges) {
    for (const id of [edge.source, edge.target]) {
      const incident = evidenceAdjacent.get(id) ?? [];
      incident.push(edge);
      evidenceAdjacent.set(id, incident);
    }
  }
  const evidenceNodes = new Set([root]);
  const queue = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const edge of evidenceAdjacent.get(current) ?? []) {
      const next = otherEnd(edge, current);
      if (evidenceNodes.has(next)) continue;
      evidenceNodes.add(next);
      queue.push(next);
    }
  }
  const evidenceKeys = new Set(
    evidenceConceptEdges
      .filter(
        (edge) =>
          !(
            edge.kind === 'implies' &&
            edge.relation === 'condition supports' &&
            edge.scope.includes('-')
          ) &&
          evidenceNodes.has(edge.source) &&
          evidenceNodes.has(edge.target),
      )
      .map((edge) => groupByOccurrence.get(edge.id)?.key),
  );
  const representatives = groups.map((group: any) => ({
    group,
    edge: group.occurrences.find(({ id }: any) => rawEvidenceIds.has(id)) ?? group.representative,
  }));
  const adjacent = new Map<string, any[]>();
  for (const { edge } of representatives) {
    for (const id of [edge.source, edge.target]) {
      const incident = adjacent.get(id) ?? [];
      incident.push(edge);
      adjacent.set(id, incident);
    }
  }
  const nodes = new Map(asset.nodes.map((node: any) => [node.id, node]));
  const context = `${focus.question ?? ''} ${focus.answer ?? ''}`;
  const edgeRank = (edge: any, from: string): number => {
    const group: any = groupByOccurrence.get(edge.id);
    const peer: any = nodes.get(otherEnd(edge, from));
    return (
      (evidenceKeys.has(group.key) ? 20_000 : 0) +
      (peer === undefined ? 0 : lexicalScore(peer.label, context, 2_000)) +
      conceptRole(edge) * 100 +
      Math.min(group.occurrences.length, 99)
    );
  };
  const rankedEdges = (id: string): any[] =>
    [...(adjacent.get(id) ?? [])].sort(
      (left, right) =>
        edgeRank(right, id) - edgeRank(left, id) ||
        compareNodes(nodes.get(otherEnd(left, id)), nodes.get(otherEnd(right, id))) ||
        compareEdges(left, right),
    );

  const selected = new Set(evidenceNodes);
  selected.add(root);
  const selectedKeys = new Set(evidenceKeys);
  const firstHop: string[] = [];
  const directEdges = rankedEdges(root);
  for (const edge of directEdges) {
    const peer = otherEnd(edge, root);
    if (!selected.has(peer) && selected.size >= nodeLimit) break;
    selected.add(peer);
    selectedKeys.add((groupByOccurrence.get(edge.id) as any).key);
    if (!firstHop.includes(peer)) firstHop.push(peer);
  }
  const branchEdges = firstHop.map((id) =>
    rankedEdges(id).filter((edge) => otherEnd(edge, id) !== root),
  );
  for (let round = 0; round < 4 && selected.size < nodeLimit; round += 1) {
    for (const [branchIndex, edges] of branchEdges.entries()) {
      const edge = edges[round];
      const branch = firstHop[branchIndex];
      if (edge === undefined || branch === undefined) continue;
      const peer = otherEnd(edge, branch);
      if (!selected.has(peer) && selected.size >= nodeLimit) continue;
      selected.add(branch);
      selected.add(peer);
      selectedKeys.add((groupByOccurrence.get(edge.id) as any).key);
      if (selected.size >= nodeLimit) break;
    }
  }
  const visible = representatives
    .filter(
      ({ group, edge }: any) =>
        selectedKeys.has(group.key) && selected.has(edge.source) && selected.has(edge.target),
    )
    .map(({ group, edge }: any) => ({ group, edge }))
    .sort(
      (left, right) =>
        Number(evidenceKeys.has(right.group.key)) - Number(evidenceKeys.has(left.group.key)) ||
        compareEdges(left.edge, right.edge),
    )
    .map(({ edge }) => edge);
  return { nodes: selected, edges: visible };
};

describe('u13 answer-view cap census', () => {
  it('derives exact default losses against an uncapped asset-side selection', () => {
    const asset = readAsset();
    const model = new SemanticGraphModel(parseSemanticGraph(asset));
    const rows = focusTokens().map((focus) => {
      const shipped = model.answerSubgraph(focus, 24);
      if (shipped === undefined) fail(`${focus.document}: no answer view`);
      const bounded = deriveAnswerView(asset, model, focus, shipped.root, 24);
      const uncapped = deriveAnswerView(
        asset,
        model,
        focus,
        shipped.root,
        Number.POSITIVE_INFINITY,
      );
      expect(new Set(shipped.nodes.map(({ id }) => id)), `${focus.document} nodes`).toEqual(
        bounded.nodes,
      );
      expect(
        shipped.edges.map(({ id }) => id),
        `${focus.document} edges`,
      ).toEqual(bounded.edges.slice(0, 480).map(({ id }) => id));
      const boundedEdgeIds = new Set(bounded.edges.map(({ id }) => id));
      const boundedMeaning = new Set(
        bounded.edges.map((edge) =>
          JSON.stringify([edge.kind, edge.source, edge.target, edge.relation]),
        ),
      );
      const droppedEdges = uncapped.edges.filter(({ id }) => !boundedEdgeIds.has(id));
      return {
        document: focus.document,
        nodeDrop: [...uncapped.nodes].filter((id) => !bounded.nodes.has(id)).length,
        nodeEdgeDrop: droppedEdges.length,
        meaningSplit: droppedEdges.filter((edge) =>
          boundedMeaning.has(JSON.stringify([edge.kind, edge.source, edge.target, edge.relation])),
        ).length,
        edgeCapDrop: Math.max(0, bounded.edges.length - 480),
        fallbackDrop: shipped.nodes.reduce((sum, { id }) => {
          const incident = shipped.edges.filter((edge) => edge.source === id || edge.target === id);
          return sum + Math.max(0, incident.length - 60);
        }, 0),
      };
    });
    const total = (
      key: 'nodeDrop' | 'nodeEdgeDrop' | 'meaningSplit' | 'edgeCapDrop' | 'fallbackDrop',
    ) => rows.reduce((sum, row) => sum + row[key], 0);
    const max = [...rows].sort(
      (left, right) => right.nodeEdgeDrop - left.nodeEdgeDrop || right.nodeDrop - left.nodeDrop,
    )[0];
    console.log(
      `O5-answer views=${String(rows.length)} node24=${String(total('nodeDrop'))} nodes/` +
        `${String(total('nodeEdgeDrop'))} edge-view rows removed ` +
        `(max ${max.document}:${String(max.nodeDrop)} nodes/${String(max.nodeEdgeDrop)} edges); ` +
        `meaning-splits=${String(total('meaningSplit'))}; edge480=${String(total('edgeCapDrop'))}; ` +
        `fallback60=${String(total('fallbackDrop'))}`,
    );
  }, 20_000);
});
