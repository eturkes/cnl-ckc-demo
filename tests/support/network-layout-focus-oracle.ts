// g4 G8 oracle: source membership, canonical greedy DAG, screen-space focus frame.
import {
  at,
  extent,
  lexical,
  node,
  type Canvas,
  type Frame,
  type Network,
  type Node,
  type Rect,
  type Size,
} from './network-layout-oracle.js';
export type FocusInput = { subject: string | null; ids: string[]; lines: Network['lines'] };
export type FocusSet = FocusInput & { key: string };
export type FocusView = { subject: string | null; nodes: { id: string; x: number; y: number }[] };
export const sets = (network: Network): FocusSet[] => {
  const sentences = new Map(
    (network.occurrences ?? []).map((o) => [o.key, `${o.document}:${String(o.sentence)}`]),
  );
  const owns = (keys: string[] | undefined, sentence: string): boolean =>
    (keys ?? []).some((key) => sentences.get(key) === sentence);
  const out: FocusSet[] = network.concepts.map((c) => {
    const lines = network.lines.filter((l) => l.source === c.id || l.target === c.id);
    return {
      key: `concept:${c.id}`,
      subject: c.id,
      ids: [...new Set([c.id, ...lines.flatMap((l) => [l.source, l.target])])].sort(lexical),
      lines,
    };
  });
  const rules = new Set<string>();
  for (const record of [...network.lines, ...network.loops])
    for (const key of record.occurrences ?? []) {
      const sentence = sentences.get(key);
      if (sentence === undefined) throw new Error(`unresolved occurrence ${key}`);
      rules.add(sentence);
    }
  for (const sentence of rules) {
    const lines = network.lines.filter((l) => owns(l.occurrences, sentence));
    const loops = network.loops.filter((l) => owns(l.occurrences, sentence));
    out.push({
      key: `rule:${sentence}`,
      subject: null,
      ids: [
        ...new Set([...lines.flatMap((l) => [l.source, l.target]), ...loops.map((l) => l.concept)]),
      ].sort(lexical),
      lines,
    });
  }
  return out.sort((a, b) => lexical(a.key, b.key));
};
export const directions = (input: FocusInput): [string, string][] => {
  const ids = new Set(input.ids);
  const candidates = new Map<string, [string, string]>();
  for (const line of input.lines)
    if (line.source !== line.target && ids.has(line.source) && ids.has(line.target))
      candidates.set(`${line.source}\u0000${line.target}`, [line.source, line.target]);
  const selected: [string, string][] = [];
  const reachable = (start: string, goal: string): boolean => {
    const visited = new Set([start]);
    const queue = [start];
    for (const id of queue) {
      if (id === goal) return true;
      for (const [source, target] of selected)
        if (source === id && !visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
    }
    return false;
  };
  for (const [source, target] of [...candidates]
    .sort(([a], [b]) => lexical(a, b))
    .map(([, pair]) => pair))
    if (!reachable(target, source)) selected.push([source, target]);
  return selected;
};
export const sized = (view: FocusView, sizes: Map<string, Size>): Node[] =>
  view.nodes.map((p) => {
    const size = sizes.get(p.id);
    if (size === undefined) throw new Error(`missing focus size ${p.id}`);
    return node(p.id, { ...p, ...size });
  });
export const boxes = (view: FocusView, sizes: Map<string, Size>, block: Size | null): Rect[] =>
  sized(view, sizes).map((n) => at(n, 1, n.id === view.subject ? block : null));
export const frame = (
  view: FocusView,
  sizes: Map<string, Size>,
  block: Size | null,
  canvas: Canvas,
): Frame => {
  const rs = boxes(view, sizes, block);
  const all = extent(rs);
  if (all.right - all.left <= canvas.width - 24 && all.bottom - all.top <= canvas.height - 24)
    return {
      zoom: 1,
      pan: {
        x: (canvas.width - all.left - all.right) / 2,
        y: (canvas.height - all.top - all.bottom) / 2,
      },
    };
  const topmost = [...view.nodes].sort((a, b) => a.y - b.y || lexical(a.id, b.id))[0];
  const index = view.nodes.findIndex((n) => n.id === (view.subject ?? topmost?.id));
  const subject = rs[index];
  if (subject === undefined) throw new Error('focus view has no subject or topmost node');
  return {
    zoom: 1,
    pan: { x: canvas.width / 2 - (subject.left + subject.right) / 2, y: 12 - subject.top },
  };
};
