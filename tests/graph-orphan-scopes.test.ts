// `.agent/contracts/mnt-d49.md` O1–O4: an operator context whose node no edge touches records the
// body literals inside it, and no such literal is shown through an edge of another world. That is
// what proves a shown path cannot skip a negation the KB asserts with no edge of its own.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { verifyBag } from '../tools/kb/bag.mjs';
import { parseClauseSites } from '../tools/kb/provenance.mjs';

import { ROOT } from './clinical-test-support.js';

interface Literal {
  line: number;
  index: number;
  predicate: string;
  edge: string | null;
}
interface Scope {
  id: string;
  chain: string[];
  operator: string;
  document: string;
  sentence: number | null;
  reference: string;
  literals?: Literal[];
}
interface Edge {
  id: string;
  source: string;
  target: string;
  document: string;
  sentence: number | null;
  predicate: string;
  scope?: number;
}
interface Graph {
  nodes: { id: string; kind: string }[];
  edges: Edge[];
  scopes: Scope[];
}

const shipped = JSON.parse(
  readFileSync(join(ROOT, 'kb', 'generated', 'graph', 'semantic-graph.json'), 'utf8'),
) as Graph;
const clone = (): Graph => structuredClone(shipped);

/** Scope indexes whose operator-context node no edge touches. */
const orphanIndexes = (graph: Graph): number[] => {
  const incident = new Set(graph.edges.flatMap(({ source, target }) => [source, target]));
  const orphanNodes = new Set(
    graph.nodes
      .filter(({ id, kind }) => kind === 'operator-context' && !incident.has(id))
      .map(({ id }) => id.replace(/^operator-context:/u, '')),
  );
  return graph.scopes.flatMap((scope, index) =>
    orphanNodes.has(scope.id.replace(/^scope:/u, '')) ? [index] : [],
  );
};

/** O1: exactly the orphan records carry a non-empty literal set. */
const gradeCarriers = (graph: Graph): string[] => {
  const orphans = new Set(orphanIndexes(graph));
  return graph.scopes.flatMap((scope, index) => {
    if (orphans.has(index) && (scope.literals?.length ?? 0) === 0)
      return [`${scope.id}: orphan carries no literals`];
    if (!orphans.has(index) && scope.literals !== undefined)
      return [`${scope.id}: literals on a context an edge touches`];
    return [];
  });
};

/** Does `edge` sit in the world of scope `index`, directly or through a nested chain? */
const within = (graph: Graph, edge: Edge, index: number): boolean => {
  if (edge.scope === undefined) return false;
  if (edge.scope === index) return true;
  const own = graph.scopes[edge.scope];
  const orphan = graph.scopes[index];
  return (
    own !== undefined &&
    orphan !== undefined &&
    own.document === orphan.document &&
    own.sentence === orphan.sentence &&
    own.chain.includes(orphan.reference)
  );
};

/** O2: every orphan's operator rides at least one shown edge. */
const gradeVisible = (graph: Graph): string[] =>
  orphanIndexes(graph).flatMap((index) =>
    graph.edges.some((edge) => within(graph, edge, index))
      ? []
      : [`${graph.scopes[index]?.id ?? String(index)}: its operator rides no shown edge`],
  );

/** O3: every relation literal is shown through an edge of its own world. */
const gradeShown = (graph: Graph): string[] => {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return orphanIndexes(graph).flatMap((index) => {
    const scope = graph.scopes[index];
    return (scope?.literals ?? []).flatMap(({ line, predicate, edge: id }) => {
      if (id === null) return [];
      const edge = edges.get(id);
      const at = `${scope?.id ?? String(index)} line ${String(line)}`;
      if (edge === undefined) return [`${at}: names missing edge ${id}`];
      if (
        edge.predicate !== predicate ||
        edge.document !== scope?.document ||
        edge.sentence !== scope.sentence
      )
        return [`${at}: ${id} shows another relation`];
      return within(graph, edge, index) ? [] : [`${at}: shown through ${id} of another world`];
    });
  });
};

/** O4: the literal set re-derived from the bag's clauses, without the producer's emit path. */
const bagLiterals = (() => {
  const bags = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
  const { files } = verifyBag(readFileSync(join(ROOT, 'kb', bags[0] ?? '')));
  const clauses = parseClauseSites(files);
  const orphans = new Map(
    orphanIndexes(shipped).map((index) => {
      const scope = shipped.scopes[index];
      return [JSON.stringify([scope?.document, scope?.sentence, scope?.reference]), index];
    }),
  );
  const found = new Map<number, string[]>();
  for (const clause of clauses) {
    for (const [index, call] of clause.body.entries()) {
      const world = (call.args[0] ?? '').trim();
      const orphan = orphans.get(JSON.stringify([clause.document, clause.sentence, world]));
      if (orphan === undefined) continue;
      found.set(orphan, [
        ...(found.get(orphan) ?? []),
        `${String(clause.line)}:${String(index)}:${call.name}`,
      ]);
    }
  }
  return found;
})();

const gradeIndependent = (graph: Graph): string[] =>
  orphanIndexes(graph).flatMap((index) => {
    const asset = (graph.scopes[index]?.literals ?? []).map(
      ({ line, index: at, predicate }) => `${String(line)}:${String(at)}:${predicate}`,
    );
    const bag = bagLiterals.get(index) ?? [];
    const missing = bag.filter((literal) => !asset.includes(literal));
    const extra = asset.filter((literal) => !bag.includes(literal));
    return [...missing, ...extra].map(
      (literal) =>
        `${graph.scopes[index]?.id ?? String(index)}: literal ${literal} differs from the bag`,
    );
  });

describe('orphan operator contexts', () => {
  it('O1 records a literal set on exactly the 71 contexts no edge touches', () => {
    const carriers = shipped.scopes.filter(({ literals }) => literals !== undefined);
    expect(carriers.map(({ operator }) => operator).sort()).toEqual([
      ...Array<string>(64).fill('-'),
      ...Array<string>(7).fill('can'),
    ]);
    expect(gradeCarriers(shipped)).toEqual([]);
    const stripped = clone();
    const victim = stripped.scopes.find(({ literals }) => literals !== undefined);
    if (victim === undefined) throw new Error('no orphan to strip');
    delete victim.literals;
    expect(gradeCarriers(stripped)).toEqual([`${victim.id}: orphan carries no literals`]);
  });

  it('O2 shows each orphan operator on at least one edge', () => {
    expect(gradeVisible(shipped)).toEqual([]);
    const hidden = clone();
    const [index = -1] = orphanIndexes(hidden);
    for (const edge of hidden.edges) if (within(hidden, edge, index)) delete edge.scope;
    expect(gradeVisible(hidden)).toEqual([
      `${hidden.scopes[index]?.id ?? ''}: its operator rides no shown edge`,
    ]);
  });

  it('O3 shows no orphan literal through an edge of another world', () => {
    expect(gradeShown(shipped)).toEqual([]);
    const moved = clone();
    const [index = -1] = orphanIndexes(moved);
    const scope = moved.scopes[index];
    const literal = scope?.literals?.find(({ edge }) => edge !== null);
    const elsewhere = moved.edges.find(
      (edge) =>
        edge.predicate === literal?.predicate &&
        edge.document === scope?.document &&
        edge.sentence === scope.sentence &&
        !within(moved, edge, index),
    );
    if (literal === undefined || elsewhere === undefined) throw new Error('no edge to move onto');
    literal.edge = elsewhere.id;
    expect(gradeShown(moved)).toEqual([
      `${scope?.id ?? ''} line ${String(literal.line)}: shown through ${elsewhere.id} of another world`,
    ]);
  });

  it('O4 matches the literal set re-derived from the bag', () => {
    expect(bagLiterals.size).toBe(71);
    expect(gradeIndependent(shipped)).toEqual([]);
    const short = clone();
    const [index = -1] = orphanIndexes(short);
    const dropped = short.scopes[index]?.literals?.shift();
    if (dropped === undefined) throw new Error('no literal to drop');
    expect(gradeIndependent(short)).toEqual([
      `${short.scopes[index]?.id ?? ''}: literal ${String(dropped.line)}:${String(dropped.index)}:${dropped.predicate} differs from the bag`,
    ]);
  });
});
