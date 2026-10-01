// Every synthesized `condition supports` shortcut whose two endpoint scopes CONTRADICT (neither
// operator sequence a prefix of the other) is justified by its own source clause: re-parsed here
// from the clause text, independently of the producer, the condition event's world chains up
// through the clause's own `guideline_operator` literals to exactly the edge's near scope, and
// the clause head sits in the context the far scope records. The KB joins the two scopes in one
// clause — the shortcut does not invent the join.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  parseSemanticGraph,
  SemanticGraphModel,
  type SemanticGraphEdge,
} from '../src/graph/model.js';
import { ROOT } from '../tools/kb/paths.mjs';

const GENERATED = join(ROOT, 'kb', 'generated');

let model: SemanticGraphModel;
let scopes: { document: string; sentence: number; reference: string; operator: string }[];
const clauseText = new Map<number, string>();
let contradicting: SemanticGraphEdge[];

const isPrefix = (a: readonly string[], b: readonly string[]): boolean =>
  a.every((item, index) => b[index] === item);

beforeAll(() => {
  const raw = JSON.parse(readFileSync(join(GENERATED, 'graph', 'semantic-graph.json'), 'utf8')) as {
    scopes: typeof scopes;
  };
  scopes = raw.scopes;
  model = new SemanticGraphModel(parseSemanticGraph(raw));
  const chunks = join(GENERATED, 'provenance', 'documents');
  for (const file of readdirSync(chunks)) {
    const chunk = JSON.parse(readFileSync(join(chunks, file), 'utf8')) as {
      clauses: { line: number; text: string }[];
    };
    for (const clause of chunk.clauses) clauseText.set(clause.line, clause.text);
  }
  contradicting = model.data.edges.filter((edge) => {
    if ((edge.relation ?? edge.label) !== 'condition supports') return false;
    const near = edge.scopeOperators ?? [];
    const far = edge.farScopeOperators ?? [];
    return far.length > 0 && !isPrefix(near, far) && !isPrefix(far, near);
  });
});

/** The operator chain, outermost first, from `actual` down to the world `variable` sits in. */
const chainTo = (text: string, variable: string): string[] => {
  const chain: string[] = [];
  let world = variable;
  while (world !== 'actual') {
    const literal = new RegExp(`guideline_operator\\((\\w+),${world},([^)]+)\\)`, 'u').exec(text);
    if (literal === null) return [...chain, `<no operator scopes ${world}>`];
    chain.unshift((literal[2] ?? '').replace(/^'|'$/gu, ''));
    world = literal[1] ?? 'actual';
  }
  return chain;
};

/** Every contradicting shortcut its clause text does not justify, named by edge id. */
const audit = (textOf: (line: number) => string): string[] =>
  contradicting.flatMap((edge) => {
    const text = textOf(edge.line);
    const verb = model.node(edge.source)?.label ?? '';
    const head = /^guideline_event\(('\$guideline_id'\(context,[^)]*\([^)]*\),\[[^\]]*\]\))/u.exec(
      text,
    )?.[1];
    // The body call the shortcut starts from: the condition event named by its source node.
    const call = new RegExp(`guideline_event\\((\\w+),\\w+,'?${verb}'?\\)`, 'u').exec(text);
    const near = call === null ? ['<no condition event>'] : chainTo(text, call[1] ?? '');
    const record = scopes.find(
      (scope) =>
        scope.document === edge.document &&
        scope.sentence === edge.sentence &&
        scope.reference === head,
    );
    const far = edge.farScopeOperators ?? [];
    const nearOk = near.join(',') === (edge.scopeOperators ?? []).join(',');
    const farOk = record !== undefined && record.operator === far.at(-1);
    return nearOk && farOk
      ? []
      : [
          `${edge.id} line ${String(edge.line)}: near ${near.join(',')} vs ${(edge.scopeOperators ?? []).join(',')}, far ${String(record?.operator)} vs ${far.join(',')}`,
        ];
  });

describe('contradicting shortcut scopes', () => {
  it('records the 38 shortcuts whose endpoint scopes contradict', () => {
    expect(contradicting).toHaveLength(38);
  });

  it('justifies each from its own clause: the near chain and the far context', () => {
    expect(audit((line) => clauseText.get(line) ?? '')).toEqual([]);
  });

  it('refuses a shortcut whose clause no longer scopes its condition event', () => {
    const [victim] = contradicting;
    if (victim === undefined) throw new Error('no contradicting shortcut');
    const refused = audit((line) => {
      const text = clauseText.get(line) ?? '';
      return line === victim.line ? text.replaceAll('guideline_operator(', 'zz_operator(') : text;
    });
    expect(refused.some((line) => line.startsWith(`${victim.id} `))).toBe(true);
  });
});
