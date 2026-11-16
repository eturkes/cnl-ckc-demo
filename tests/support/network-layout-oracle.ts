// g4 contract oracle: screen-space rectangles + independent priority/reveal/frame logic.
export const metrics = {
  font: { family: 'Atkinson Hyperlegible Next', weight: 600, size: 13, lineHeight: 1.2 },
  wrap: 130,
  outline: 3,
  tolerance: 2,
  dot: 10,
  anchorDot: 18,
  radius: 9,
  labelGap: 4,
  pairGap: 4,
  lineWidth: 1.5,
  margin: 12,
  maxZoom: 1,
};
export const anchors = ['acute-pain', 'subacute-pain', 'chronic-pain'];
export type Size = { W: number; H: number };
export type Node = Size & {
  id: string;
  x: number;
  y: number;
  degree: number;
  anchor?: boolean;
  reveal: number;
  label: string[];
  component: number;
};
export type Network = {
  schemaVersion: number;
  envelope: Record<string, string>;
  concepts: { id: string; label: string; class?: string }[];
  lines: { id: string; source: string; target: string; reading?: string; occurrences?: string[] }[];
  loops: { id: string; concept: string; reading: string; occurrences?: string[] }[];
  occurrences?: { key: string; document: string; sentence: number }[];
  [key: string]: unknown;
};
export type Layout = {
  schemaVersion: number;
  envelope: { digest: string; parts: Record<string, string>; network: Network['envelope'] };
  metrics: typeof metrics;
  row: { y: number; D: number };
  nodes: Node[];
  blocks: (Size & { id: string; readings: string[][] })[];
  focus: Record<string, [string, number, number][]>;
};
export type Canvas = { width: number; height: number };
export type Frame = { zoom: number; pan: { x: number; y: number } };
export type Rect = { left: number; right: number; top: number; bottom: number };
export type Blocks = { a?: Size | null; b?: Size | null };
export const node = (id: string, changes: Partial<Node> = {}): Node => ({
  id,
  x: 0,
  y: 0,
  W: 60,
  H: 19,
  degree: 0,
  anchor: anchors.includes(id),
  reveal: 0,
  label: [id.replaceAll('-', ' ')],
  component: 0,
  ...changes,
});
export const lexical = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export const priority = (
  a: Pick<Node, 'id' | 'degree'>,
  b: Pick<Node, 'id' | 'degree'>,
): number => {
  const ai = anchors.indexOf(a.id);
  const bi = anchors.indexOf(b.id);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 3 : ai) - (bi === -1 ? 3 : bi);
  return b.degree - a.degree || lexical(a.id, b.id);
};
export const offsets = (n: Size, block?: Size | null): Rect => {
  const w = Math.max(n.W, block?.W ?? 0, 18);
  return {
    left: -w / 2,
    right: w / 2,
    top: -9,
    bottom: 9 + 4 + n.H + (block === undefined || block === null ? 0 : 4 + block.H),
  };
};
export const at = (n: Node, z: number, block?: Size | null): Rect => {
  const r = offsets(n, block);
  return {
    left: n.x * z + r.left,
    right: n.x * z + r.right,
    top: n.y * z + r.top,
    bottom: n.y * z + r.bottom,
  };
};
export const intersect = (a: Rect, b: Rect, gap = 0): boolean =>
  a.left < b.right + gap &&
  b.left < a.right + gap &&
  a.top < b.bottom + gap &&
  b.top < a.bottom + gap;
export const collision = (a: Node, b: Node, z: number, blocks: Blocks = {}): boolean =>
  intersect(at(a, z, blocks.a), at(b, z, blocks.b), 4);
export const separation = (a: Node, b: Node, blocks: Blocks = {}): number => {
  // Compute clearances from rectangle edges; never call the subject's sep/overlaps/boxOf.
  const ra = offsets(a, blocks.a);
  const rb = offsets(b, blocks.b);
  const horizontal = Math.max(ra.right - rb.left, rb.right - ra.left) + 4;
  const vertical = a.y < b.y ? ra.bottom - rb.top + 4 : rb.bottom - ra.top + 4;
  return Math.min(
    a.x === b.x ? Infinity : horizontal / Math.abs(a.x - b.x),
    a.y === b.y ? Infinity : vertical / Math.abs(a.y - b.y),
  );
};
export const revelation = (nodes: Node[]): { id: string; reveal: number }[] => {
  const done: { n: Node; reveal: number }[] = [];
  for (const n of [...nodes].sort(priority)) {
    let reveal = 0;
    if (!anchors.includes(n.id)) {
      for (const prior of done) {
        const boundary = separation(n, prior.n);
        if (boundary > prior.reveal) reveal = Math.max(reveal, boundary);
      }
    }
    done.push({ n, reveal });
  }
  return done.map(({ n, reveal }) => ({ id: n.id, reveal }));
};
export const extent = (rs: Rect[]): Rect => ({
  left: Math.min(...rs.map((r) => r.left)),
  right: Math.max(...rs.map((r) => r.right)),
  top: Math.min(...rs.map((r) => r.top)),
  bottom: Math.max(...rs.map((r) => r.bottom)),
});
export const visibleBounds = (nodes: Node[], z: number): Rect =>
  extent(
    nodes.map((n) =>
      n.reveal <= z
        ? at(n, z)
        : { left: n.x * z - 9, right: n.x * z + 9, top: n.y * z - 9, bottom: n.y * z + 9 },
    ),
  );
export const fullFrame = (layout: { nodes: Node[] }, canvas: Canvas): Frame => {
  // Independent feasibility search: all dots + labels that would actually show, never hidden labels.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 64; i++) {
    const z = (lo + hi) / 2;
    const e = visibleBounds(layout.nodes, z);
    if (e.right - e.left <= canvas.width - 24 && e.bottom - e.top <= canvas.height - 24) lo = z;
    else hi = z;
  }
  const e = visibleBounds(layout.nodes, lo);
  return {
    zoom: lo,
    pan: { x: (canvas.width - e.left - e.right) / 2, y: (canvas.height - e.top - e.bottom) / 2 },
  };
};
export const components = (network: Network): string[][] => {
  const neighbours = new Map(network.concepts.map((c) => [c.id, new Set<string>()]));
  for (const line of network.lines) {
    neighbours.get(line.source)?.add(line.target);
    neighbours.get(line.target)?.add(line.source);
  }
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const c of network.concepts) {
    if (seen.has(c.id)) continue;
    const ids = [c.id];
    seen.add(c.id);
    for (const id of ids)
      for (const other of neighbours.get(id) ?? [])
        if (!seen.has(other)) {
          seen.add(other);
          ids.push(other);
        }
    out.push(ids.sort(lexical));
  }
  return out;
};
export const synthetic = (): Network => ({
  schemaVersion: 1,
  envelope: { input: 'synthetic-layout-contract' },
  concepts: [...anchors, 'opioid-therapy', 'follow-up'].map((id) => ({
    id,
    label: id.replaceAll('-', ' '),
    class: 'other',
  })),
  lines: [
    { id: 'a', source: anchors[0] ?? '', target: anchors[1] ?? '', reading: 'related' },
    { id: 'b', source: anchors[1] ?? '', target: anchors[2] ?? '', reading: 'related' },
    { id: 'c', source: anchors[1] ?? '', target: 'opioid-therapy', reading: 'should consider' },
    { id: 'd', source: anchors[2] ?? '', target: 'follow-up', reading: 'should arrange' },
  ],
  loops: [],
});
