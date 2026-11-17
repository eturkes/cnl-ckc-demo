// Network geometry shared by the build-time layout (`tools/kb/layout.mjs`, through Node's type
// stripping) and the page (g5). Screen px unless named model px. Contract `.agent/contracts/g4.md`.
//
// Every on-screen size is screen-fixed, and every box hangs from the same top offset (its dot), so
// two boxes that clear each other at one zoom clear at every larger zoom: overlap is monotone, one
// separation zoom per pair decides it, and a label's reveal zoom is one number.

export const METRICS = Object.freeze({
  font: Object.freeze({
    family: 'Atkinson Hyperlegible Next',
    weight: 600,
    size: 13,
    lineHeight: 1.2,
  }),
  /** Wrap width of a label line. */
  wrap: 130,
  outline: 3,
  /** Width allowance over the HarfBuzz advance: Chromium's centred ink + halo keeps ≥ 0.89 px of it per side (g4b). */
  tolerance: 2,
  dot: 10,
  anchorDot: 18,
  /** The largest dot radius: every box starts this far above its point. */
  radius: 9,
  labelGap: 4,
  pairGap: 4,
  lineWidth: 1.5,
  margin: 12,
  /** Every label reveals by zoom 1, so nothing gains from zooming past it. */
  maxZoom: 1,
});

export const ANCHORS = Object.freeze(['acute-pain', 'subacute-pain', 'chronic-pain'] as const);

export interface Size {
  readonly W: number;
  readonly H: number;
}

export interface Point extends Size {
  readonly id: string;
  /** Model px. */
  readonly x: number;
  /** Model px. */
  readonly y: number;
}

export interface RankedPoint extends Point {
  readonly degree: number;
  readonly anchor: boolean;
}

/** Offsets from a node's screen point; `top` < 0 covers its dot. */
export interface Offsets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface Canvas {
  readonly width: number;
  readonly height: number;
}

export interface Frame {
  readonly zoom: number;
  readonly pan: { readonly x: number; readonly y: number };
}

/** The loop block of `a` and/or `b` when it is a focus subject. */
export interface Blocks {
  readonly a?: Size | null | undefined;
  readonly b?: Size | null | undefined;
}

export interface LaidOutNode extends RankedPoint {
  readonly reveal: number;
}

/** What a frame reads of a laid-out node: its point, its label box and its reveal zoom. */
export type FramedNode = Pick<LaidOutNode, 'id' | 'x' | 'y' | 'W' | 'H' | 'reveal'>;

const { font, outline, tolerance, radius, labelGap, pairGap, margin, maxZoom } = METRICS;

/** Width of a label from its widest line's advance sum. */
export const labelWidth = (advance: number): number => advance + 2 * outline + tolerance;

/** Height of a label of `lines` lines, as Cytoscape draws it: one font size, then a line height each. */
export const labelHeight = (lines: number): number =>
  font.size + (lines - 1) * font.size * font.lineHeight + 2 * outline;

/** A node's box: its dot, its label below, and a focus subject's loop block below that. */
export const boxOf = (node: Size, block?: Size | null): Offsets => {
  const half = Math.max(node.W, block?.W ?? 0, 2 * radius) / 2;
  const bottom = radius + labelGap + node.H + (block ? labelGap + block.H : 0);
  return { left: -half, right: half, top: -radius, bottom };
};

/** The oracle: do the two boxes come closer than the pair gap at `zoom`? */
export const overlaps = (a: Point, b: Point, zoom: number, blocks: Blocks = {}): boolean => {
  const A = boxOf(a, blocks.a);
  const B = boxOf(b, blocks.b);
  const ax = a.x * zoom;
  const bx = b.x * zoom;
  const ay = a.y * zoom;
  const by = b.y * zoom;
  return (
    ax + A.left < bx + B.right + pairGap &&
    bx + B.left < ax + A.right + pairGap &&
    ay + A.top < by + B.bottom + pairGap &&
    by + B.top < ay + A.bottom + pairGap
  );
};

/** The zoom from which the two boxes clear each other (they overlap iff `zoom < sep`). */
export const sep = (a: Point, b: Point, blocks: Blocks = {}): number => {
  // One evaluation order per pair, so sep(a, b) and sep(b, a) agree to the last bit.
  if (a.id > b.id) return sep(b, a, { a: blocks.b ?? null, b: blocks.a ?? null });
  const A = boxOf(a, blocks.a);
  const B = boxOf(b, blocks.b);
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const zx = dx === 0 ? Infinity : ((A.right - A.left + B.right - B.left) / 2 + pairGap) / dx;
  const upper = a.y <= b.y ? A : B;
  const zy = dy === 0 ? Infinity : (upper.bottom - upper.top + pairGap) / dy;
  return Math.min(zx, zy);
};

/** Priority: the anchors in their order, then line degree descending, then id. */
export const byPriority = (a: RankedPoint, b: RankedPoint): number => {
  const rank = (n: RankedPoint): number =>
    n.anchor ? ANCHORS.indexOf(n.id as (typeof ANCHORS)[number]) : ANCHORS.length;
  return rank(a) - rank(b) || b.degree - a.degree || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
};

/**
 * Each node's reveal zoom, in priority order: 0 for an anchor; else the largest separation zoom
 * against a higher-priority label still hidden-free there (`sep > its reveal`), or 0.
 */
export const reveals = (nodes: readonly RankedPoint[]): { id: string; reveal: number }[] => {
  const order = [...nodes].sort(byPriority);
  const reveal: number[] = [];
  for (const [i, node] of order.entries()) {
    let z = 0;
    if (!node.anchor) {
      for (let j = 0; j < i; j++) {
        const s = sep(node, order[j] as RankedPoint);
        if (s > (reveal[j] as number) && s > z) z = s;
      }
    }
    reveal.push(z);
  }
  return order.map((node, i) => ({ id: node.id, reveal: reveal[i] as number }));
};

/** Pan that puts the points' bounding-box centre at the canvas centre. */
const centred = (nodes: readonly Point[], canvas: Canvas, zoom: number): Frame['pan'] => {
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { x: canvas.width / 2 - cx * zoom, y: canvas.height / 2 - cy * zoom };
};

/** Every dot, and every label shown at `zoom`, inside the canvas less its margin. */
const inside = (nodes: readonly FramedNode[], canvas: Canvas, zoom: number): boolean => {
  const pan = centred(nodes, canvas, zoom);
  return nodes.every((n) => {
    const x = n.x * zoom + pan.x;
    const y = n.y * zoom + pan.y;
    const box =
      n.reveal <= zoom ? boxOf(n) : { left: -radius, right: radius, top: -radius, bottom: radius };
    return (
      x + box.left >= margin &&
      x + box.right <= canvas.width - margin &&
      y + box.top >= margin &&
      y + box.bottom <= canvas.height - margin
    );
  });
};

/**
 * The full network's frame: the largest zoom ≤ the maximum at which every dot and every shown
 * label fits, the points centred. Feasibility only falls as zoom grows (more labels, wider spread),
 * so a fixed-step bisection finds it deterministically. This zoom is the canvas's minimum zoom.
 */
export const frameFull = (
  layout: { readonly nodes: readonly FramedNode[] },
  canvas: Canvas,
): Frame => {
  let low = 0;
  let high: number = maxZoom;
  if (inside(layout.nodes, canvas, high)) low = high;
  else {
    for (let step = 0; step < 64; step++) {
      const mid = (low + high) / 2;
      if (inside(layout.nodes, canvas, mid)) low = mid;
      else high = mid;
    }
  }
  return { zoom: low, pan: centred(layout.nodes, canvas, low) };
};

/** A focus view's own layout: points at zoom 1, the subject (or the first node) at the origin. */
export interface FocusView {
  readonly subject: string | null;
  readonly nodes: readonly { readonly id: string; readonly x: number; readonly y: number }[];
}

/**
 * A focus view's frame at zoom 1: its boxes centred when they fit the canvas less its margin, else
 * the anchor box — the subject's, or the topmost node's — centred at the top margin.
 */
export const frameFocus = (
  view: FocusView,
  sizes: ReadonlyMap<string, Size>,
  block: Size | null,
  canvas: Canvas,
): Frame => {
  const { margin } = METRICS;
  const boxes = view.nodes.map((n) => ({
    n,
    box: boxOf(sizes.get(n.id) as Size, n.id === view.subject ? block : null),
  }));
  const left = Math.min(...boxes.map(({ n, box }) => n.x + box.left));
  const right = Math.max(...boxes.map(({ n, box }) => n.x + box.right));
  const top = Math.min(...boxes.map(({ n, box }) => n.y + box.top));
  const bottom = Math.max(...boxes.map(({ n, box }) => n.y + box.bottom));
  if (right - left <= canvas.width - 2 * margin && bottom - top <= canvas.height - 2 * margin) {
    return {
      zoom: 1,
      pan: { x: canvas.width / 2 - (left + right) / 2, y: canvas.height / 2 - (top + bottom) / 2 },
    };
  }
  const anchor =
    boxes.find(({ n }) => n.id === view.subject) ??
    [...boxes].sort((a, b) => a.n.y - b.n.y || (a.n.id < b.n.id ? -1 : 1))[0];
  if (anchor === undefined) return { zoom: 1, pan: { x: canvas.width / 2, y: canvas.height / 2 } };
  return {
    zoom: 1,
    pan: { x: canvas.width / 2 - anchor.n.x, y: margin - (anchor.n.y + anchor.box.top) },
  };
};
