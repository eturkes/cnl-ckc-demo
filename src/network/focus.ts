// Focus views (user ruling, g4): a focus view lays out its own concepts with the force layout,
// packed close, concepts that start a relationship above the concepts they lead to. One function
// serves the build (every concept and rule view, `tools/kb/layout.mjs`) and the page (a traced
// answer's view, once its proof finishes), so both draw the same positions. Screen px at zoom 1.
// Contract `.agent/contracts/g4.md` `## Focus views`.

import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

import { METRICS, boxOf, overlaps, type FocusView, type Point, type Size } from './geometry.ts';

// The focus frame is pure geometry; the page frames a view without loading Cytoscape.
export { frameFocus } from './geometry.ts';
export type { FocusView } from './geometry.ts';

cytoscape.use(fcose);

export const FOCUS_SEED = 1;
/** Fixed-direction rounds: stacking can lift a lead above its start; each round pushes it back down. */
export const FOCUS_ROUNDS = 12;
const SLACK = 0.05;

export class FocusError extends Error {
  override name = 'FocusError';
}

export interface FocusNodeSize extends Size {
  readonly id: string;
}

export interface FocusInput {
  /** The chosen concept (a pain type, a selected concept), else null (a rule, a trace). */
  readonly subject: string | null;
  readonly ids: readonly string[];
  readonly lines: readonly { readonly source: string; readonly target: string }[];
}

/**
 * fcose draws its starting positions from `Math.random`; a fixed sequence makes a layout a function
 * of its input, in Node and in the page alike. Restored on every exit.
 */
export const seeded = <T>(seed: number, run: () => T): T => {
  const random = Math.random;
  let state = seed;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return run();
  } finally {
    Math.random = random;
  }
};

interface SetLine {
  readonly source: string;
  readonly target: string;
  readonly occurrences?: readonly string[];
}

export interface FocusSet<L extends SetLine> {
  readonly key: string;
  readonly subject: string | null;
  readonly ids: string[];
  readonly lines: L[];
}

/**
 * Every focus set a reader can open from the network: each concept with its line neighbours
 * (`concept:<id>`, the concept the subject) and each rule's concepts (`rule:<document>:<sentence>`,
 * no subject). The build lays each out once (`tools/kb/layout.mjs`); the page draws a view's lines
 * from the same sets.
 */
export const focusSets = <L extends SetLine>(network: {
  readonly concepts: readonly { readonly id: string }[];
  readonly lines: readonly L[];
  readonly loops: readonly { readonly concept: string; readonly occurrences?: readonly string[] }[];
}): FocusSet<L>[] => {
  const incident = new Map<string, L[]>(network.concepts.map((c) => [c.id, []]));
  const rules = new Map<string, { ids: Set<string>; lines: L[] }>();
  const rule = (occurrence: string) => {
    const key = `rule:${occurrence.slice(0, occurrence.indexOf('#'))}`;
    const entry = rules.get(key) ?? { ids: new Set<string>(), lines: [] };
    rules.set(key, entry);
    return entry;
  };
  for (const line of network.lines) {
    incident.get(line.source)?.push(line);
    if (line.target !== line.source) incident.get(line.target)?.push(line);
    // A line with several occurrences in one sentence (variants, several events) joins it once.
    for (const occurrence of new Set(line.occurrences ?? [])) {
      const entry = rule(occurrence);
      entry.ids.add(line.source).add(line.target);
      if (entry.lines.at(-1) !== line) entry.lines.push(line);
    }
  }
  for (const loop of network.loops) {
    for (const occurrence of new Set(loop.occurrences ?? []))
      rule(occurrence).ids.add(loop.concept);
  }
  return [
    ...[...incident].map(([id, lines]) => ({
      key: `concept:${id}`,
      subject: id,
      ids: [...new Set([id, ...lines.flatMap((l) => [l.source, l.target])])].sort(),
      lines,
    })),
    ...[...rules].map(([key, { ids, lines }]) => ({
      key,
      subject: null,
      ids: [...ids].sort(),
      lines,
    })),
  ].sort((a, b) => (a.key < b.key ? -1 : 1));
};

/** The direction edges kept: each line once, in (source, target) order, unless it closes a cycle. */
export const directionEdges = (input: FocusInput): [string, string][] => {
  const ids = new Set(input.ids);
  const pairs = [
    ...new Set(
      input.lines
        .filter((l) => l.source !== l.target && ids.has(l.source) && ids.has(l.target))
        .map((l) => `${l.source}\u0000${l.target}`),
    ),
  ].sort();
  const next = new Map<string, string[]>();
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const at = stack.pop() as string;
      if (at === to) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      stack.push(...(next.get(at) ?? []));
    }
    return false;
  };
  const kept: [string, string][] = [];
  for (const pair of pairs) {
    const [source, target] = pair.split('\u0000') as [string, string];
    if (reaches(target, source)) continue;
    next.set(source, [...(next.get(source) ?? []), target]);
    kept.push([source, target]);
  }
  return kept;
};

const boxSize = (node: Size, block: Size | null): { w: number; h: number } => {
  const box = boxOf(node, block);
  return { w: box.right - box.left, h: box.bottom - box.top };
};

/**
 * A focus view's own layout. `sizes` = each member's label box; `block` = the subject's loop block,
 * if it has loops.
 */
export const layoutFocus = (
  input: FocusInput,
  sizes: ReadonlyMap<string, Size>,
  block: Size | null,
): FocusView => {
  const ids = [...new Set(input.ids)].sort();
  // An empty set (a trace whose proof touches no network concept) has no box to frame: the page
  // shows its own empty state, never a view.
  if (ids.length === 0)
    throw new FocusError('a focus view needs at least one concept; this set has no concept');
  for (const id of ids) if (!sizes.has(id)) throw new FocusError(`${id} has no label box`);
  if (input.subject !== null && !ids.includes(input.subject))
    throw new FocusError(`subject ${input.subject} is not in its view`);
  const blockOf = (id: string): Size | null => (id === input.subject ? block : null);
  const edges = directionEdges(input);
  const nodes = ids.map((id) => ({ id, ...(sizes.get(id) as Size), x: 0, y: 0 }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const size = (n: (typeof nodes)[number]) => boxSize(n, blockOf(n.id));
  if (nodes.length === 2) {
    const [a, b] = nodes as [(typeof nodes)[number], (typeof nodes)[number]];
    const [top, below] = edges.length > 0 && edges[0]?.[0] === b.id ? [b, a] : [a, b];
    below.y = size(top).h + METRICS.pairGap + SLACK;
    if (edges.length === 0)
      Object.assign(below, { x: (size(a).w + size(b).w) / 2 + METRICS.pairGap + SLACK, y: 0 });
  } else if (nodes.length > 2) {
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: [
        ...nodes.map((n) => {
          const { w, h } = size(n);
          return { data: { id: n.id, w: w + METRICS.pairGap, h: h + METRICS.pairGap } };
        }),
        ...edges.map(([source, target], i) => ({
          data: { id: `edge:${String(i)}`, source, target },
        })),
      ],
      style: [{ selector: 'node', style: { width: 'data(w)', height: 'data(h)' } }],
    });
    try {
      seeded(FOCUS_SEED, () =>
        cy
          .layout({
            name: 'fcose',
            animate: false,
            fit: false,
            randomize: true,
            quality: 'proof',
            idealEdgeLength: () => 60,
            nodeSeparation: 10,
            nodeRepulsion: () => 4500,
            gravity: 0.6,
            numIter: 2500,
            relativePlacementConstraint: edges.map(([top, bottom]) => ({ top, bottom, gap: 10 })),
          } as cytoscape.LayoutOptions)
          .run(),
      );
      for (const element of cy.nodes()) {
        const n = byId.get(element.id());
        if (n === undefined) continue;
        const box = boxOf(n, blockOf(n.id));
        const { x, y } = element.position();
        // fcose places the box centre; the point sits above it by half the box's own offset.
        n.x = x;
        n.y = y - (box.top + box.bottom) / 2;
      }
    } finally {
      cy.destroy();
    }
  }
  // Zero overlap at zoom 1 (downward stacking, as the full network's) and every kept edge pointing
  // down; a stacking move can lift a start below its lead, so the two alternate until both hold.
  const clash = (a: (typeof nodes)[number], b: (typeof nodes)[number]) =>
    overlaps(a, b, 1, { a: blockOf(a.id), b: blockOf(b.id) });
  for (let round = 0; ; round++) {
    const placed: (typeof nodes)[number][] = [];
    for (const n of [...nodes].sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1))) {
      for (
        let hit = placed.find((p) => clash(n, p));
        hit !== undefined;
        hit = placed.find((p) => clash(n, p))
      ) {
        n.y = Math.max(n.y, hit.y + size(hit).h + METRICS.pairGap + 2 * SLACK);
      }
      placed.push(n);
    }
    let moved = false;
    for (const [source, target] of edges) {
      const s = byId.get(source) as (typeof nodes)[number];
      const t = byId.get(target) as (typeof nodes)[number];
      if (t.y <= s.y) {
        t.y = s.y + SLACK;
        moved = true;
      }
    }
    if (!moved) break;
    if (round === FOCUS_ROUNDS)
      throw new FocusError(
        `focus on ${ids.slice(0, 3).join(', ')}: direction and spacing did not settle`,
      );
  }
  const origin = byId.get(input.subject ?? (ids[0] as string)) as (typeof nodes)[number];
  const round = (value: number) => Math.round(value * 100) / 100 + 0;
  return {
    subject: input.subject,
    nodes: nodes.map((n) => ({ id: n.id, x: round(n.x - origin.x), y: round(n.y - origin.y) })),
  };
};

export type { Point };
