// The clinical network's renderer: draws the build-time layout on one Canvas 2D element. Every size
// on screen is fixed (13 px labels, 10 px dots, 1.5 px lines at any zoom), so each frame is drawn
// from the model in screen px — no per-zoom restyle, which through Cytoscape's style system cost
// 139–683 ms a zoom step (`Decisions`, g4b). Contract `.agent/contracts/g4.md`
// `## Canvas adapter`; rendered output is graded by `pnpm layout:check`.

import type { NetworkScene } from './asset.ts';
import {
  ANCHORS,
  METRICS,
  boxOf,
  frameFocus,
  frameFull,
  type Canvas,
  type Frame,
  type Size,
} from './geometry.ts';

export type { NetworkScene } from './asset.ts';

export type NetworkCanvasView =
  | { readonly kind: 'full'; readonly scene: NetworkScene }
  | {
      readonly kind: 'focus';
      readonly scene: NetworkScene;
      readonly subject: string | null;
      /** `[id, x, y]` at zoom 1: a `layout.focus` entry, or `layoutFocus`'s view for a trace. */
      readonly nodes: readonly (readonly [string, number, number])[];
      /** The line ids the view draws. */
      readonly lines: readonly string[];
    };

export interface NetworkCamera {
  readonly zoom: number;
  readonly pan: { readonly x: number; readonly y: number };
  readonly minZoom: number;
  readonly maxZoom: number;
}

export interface NetworkCanvas {
  show(view: NetworkCanvasView): void;
  /** Zoom about a canvas point (default: its centre), clamped to the view's limits. */
  zoomTo(zoom: number, at?: { readonly x: number; readonly y: number }): void;
  camera(): NetworkCamera;
  destroy(): void;
}

const { font, outline, dot, anchorDot, radius, labelGap, lineWidth, maxZoom } = METRICS;

/** The canvas font as `document.fonts` names it: no label draws before this face loads. */
export const NETWORK_FONT = `${String(font.weight)} ${String(font.size)}px "${font.family}"`;
/**
 * Alphabetic baseline below a line's top. The shipped face's ink over every label and reading
 * line at 13 px rises ≤ 9.607 px and falls ≤ 2.574 px (HarfBuzz glyph extents), so a baseline at
 * 10 keeps all ink inside the line's 13 px band.
 */
export const BASELINE = 10;
const LINE_STEP = font.size * font.lineHeight;
/** Screen px between parallel lines of one concept pair, at their middle. */
const PARALLEL_STEP = 10;
const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 3;
/** A tap moves less than this; more is a pan. */
const TAP_SLOP = 6;
const TAP_MS = 600;
/** Screen px around a dot that still hits it. */
const HIT_SLACK = 6;
const WHEEL_RATE = 0.0015;

const PALETTE = [
  '--text',
  '--text-muted',
  '--surface-sunken',
  '--graph-edge',
  '--concept-other',
] as const;

type Palette = {
  readonly base: Readonly<Record<(typeof PALETTE)[number], string>>;
  /** A filled class's colour; null for a class on the shared grey. */
  readonly fills: ReadonlyMap<string, string | null>;
};

/** Every colour comes from a token, read at mount; a missing token fails by name. */
const paletteOf = (container: HTMLElement, scene: NetworkScene): Palette => {
  const computed = getComputedStyle(container);
  const missing: string[] = [];
  const read = (token: string): string => {
    const value = computed.getPropertyValue(token).trim();
    if (value === '') missing.push(token);
    return value;
  };
  const base = Object.fromEntries(PALETTE.map((t) => [t, read(t)])) as Palette['base'];
  const fills = new Map(
    scene.network.classes.map((c) => [c.id, c.filled ? read(`--concept-${c.id}`) : null]),
  );
  if (missing.length > 0) throw new Error(`network palette is undefined: ${missing.join(', ')}`);
  return { base, fills };
};

interface ModelLine {
  readonly id: string;
  readonly source: number;
  readonly target: number;
}

/** A scene's arrays, built once per `NetworkScene` identity. */
interface Model {
  readonly scene: NetworkScene;
  readonly ids: readonly string[];
  readonly index: ReadonlyMap<string, number>;
  /** Layout points, model px. */
  readonly layoutX: Float64Array;
  readonly layoutY: Float64Array;
  readonly reveal: Float64Array;
  readonly radius: Float64Array;
  readonly labels: readonly (readonly string[])[];
  readonly sizes: ReadonlyMap<string, Size>;
  readonly blocks: ReadonlyMap<string, Size & { readonly lines: readonly string[] }>;
  /** Node indices per fill colour, so each colour fills in one path. */
  readonly fills: readonly (readonly [string, readonly number[]])[];
  readonly lines: readonly ModelLine[];
  readonly lineIndex: ReadonlyMap<string, number>;
}

const modelOf = (scene: NetworkScene, palette: Palette): Model => {
  const { layout, network } = scene;
  const ids = layout.nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const anchors = new Set<string>(ANCHORS);
  const classOf = new Map(network.concepts.map((c) => [c.id, c.class]));
  const groups = new Map<string, number[]>();
  for (const [i, id] of ids.entries()) {
    // An unfilled class and the codebook's no-class state share the grey.
    const fill = palette.fills.get(classOf.get(id) ?? '') ?? palette.base['--concept-other'];
    groups.set(fill, [...(groups.get(fill) ?? []), i]);
  }
  const lines = network.lines.map((l) => ({
    id: l.id,
    source: index.get(l.source) ?? -1,
    target: index.get(l.target) ?? -1,
  }));
  return {
    scene,
    ids,
    index,
    layoutX: Float64Array.from(layout.nodes, (n) => n.x),
    layoutY: Float64Array.from(layout.nodes, (n) => n.y),
    reveal: Float64Array.from(layout.nodes, (n) => n.reveal),
    radius: Float64Array.from(layout.nodes, (n) => (anchors.has(n.id) ? anchorDot : dot) / 2),
    labels: layout.nodes.map((n) => n.label),
    sizes: new Map(layout.nodes.map((n) => [n.id, { W: n.W, H: n.H }])),
    blocks: new Map(layout.blocks.map((b) => [b.id, { W: b.W, H: b.H, lines: b.readings.flat() }])),
    fills: [...groups],
    lines,
    lineIndex: new Map(lines.map((l, i) => [l.id, i])),
  };
};

/** What one view shows: positions, the nodes and lines drawn, forced labels, the subject. */
interface State {
  readonly view: NetworkCanvasView;
  readonly model: Model;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly nodes: readonly number[];
  readonly drawn: ReadonlySet<number>;
  readonly lines: readonly number[];
  /** Per model line: its offset from the pair's straight line, in parallel steps. */
  readonly bend: Float64Array;
  /** A focus view forces every member's label; the full view reveals by zoom. */
  readonly forced: boolean;
  readonly subject: number;
}

/** A pair's drawn lines fan out around its straight line; a pair drawing one line draws it straight. */
const bendsOf = (model: Model, lines: readonly number[]): Float64Array => {
  const pairs = new Map<string, number[]>();
  for (const i of lines) {
    const { source, target } = model.lines[i] as ModelLine;
    const key = source < target ? `${source} ${target}` : `${target} ${source}`;
    pairs.set(key, [...(pairs.get(key) ?? []), i]);
  }
  const bend = new Float64Array(model.lines.length);
  for (const members of pairs.values())
    for (const [k, i] of members.entries()) {
      const { source, target } = model.lines[i] as ModelLine;
      // Each line's normal turns with its direction; the sign undoes that, so one pair's offsets
      // share one side convention whichever way each line points.
      bend[i] = (k - (members.length - 1) / 2) * (source < target ? 1 : -1);
    }
  return bend;
};

const stateOf = (view: NetworkCanvasView, model: Model): State => {
  if (view.kind === 'full') {
    const nodes = model.ids.map((_, i) => i);
    const lines = model.lines.map((_, i) => i);
    return {
      view,
      model,
      x: model.layoutX,
      y: model.layoutY,
      nodes,
      drawn: new Set(nodes),
      lines,
      bend: bendsOf(model, lines),
      forced: false,
      subject: -1,
    };
  }
  const x = new Float64Array(model.ids.length);
  const y = new Float64Array(model.ids.length);
  const nodes: number[] = [];
  for (const [id, px, py] of view.nodes) {
    const i = model.index.get(id);
    if (i === undefined) throw new Error(`focus view names an unknown concept: ${id}`);
    x[i] = px;
    y[i] = py;
    nodes.push(i);
  }
  const drawn = new Set(nodes);
  const lines = view.lines.map((id) => {
    const i = model.lineIndex.get(id);
    const line = i === undefined ? undefined : model.lines[i];
    if (i === undefined || line === undefined)
      throw new Error(`focus view names an unknown line: ${id}`);
    if (!drawn.has(line.source) || !drawn.has(line.target))
      throw new Error(`focus view line ${id} leaves the view`);
    return i;
  });
  const subject = view.subject === null ? -1 : (model.index.get(view.subject) ?? -1);
  if (view.subject !== null && !drawn.has(subject))
    throw new Error(`focus view subject ${view.subject} is not in its view`);
  const bend = bendsOf(model, lines);
  return { view, model, x, y, nodes, drawn, lines, bend, forced: true, subject };
};

export const mountNetworkCanvas = (
  container: HTMLElement,
  onSelect: (conceptId: string) => void,
): NetworkCanvas => {
  const element = document.createElement('canvas');
  element.style.display = 'block';
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.touchAction = 'none';
  container.append(element);
  const context = element.getContext('2d');
  if (context === null) throw new Error('network canvas: no 2D context');
  const ctx = context;

  let palette: Palette | null = null;
  let model: Model | null = null;
  let state: State | null = null;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let minZoom = 1;
  let maxZoomNow = 1;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame = 0;
  let viewGeneration = 0;
  let fontReady = document.fonts.check(NETWORK_FONT);
  let destroyed = false;

  const draw = () => {
    frame = 0;
    if (state === null || palette === null || !fontReady) return;
    const { base } = palette;
    const { model: m, x, y, nodes, drawn, lines, bend, forced, subject } = state;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = base['--surface-sunken'];
    ctx.fillRect(0, 0, width, height);
    const sx = (i: number) => (x[i] as number) * zoom + pan.x;
    const sy = (i: number) => (y[i] as number) * zoom + pan.y;
    // Closed bounds, as for labels: a box touching the canvas edge still meets the canvas.
    const near = (px: number, py: number, pad: number) =>
      px >= -pad && py >= -pad && px <= width + pad && py <= height + pad;

    // Lines: one stroked path, then one filled path of arrowheads at each target's dot.
    ctx.strokeStyle = base['--graph-edge'];
    ctx.fillStyle = base['--graph-edge'];
    ctx.lineWidth = lineWidth;
    const heads: number[] = [];
    ctx.beginPath();
    for (const li of lines) {
      const line = m.lines[li] as ModelLine;
      const ax = sx(line.source);
      const ay = sy(line.source);
      const bx = sx(line.target);
      const by = sy(line.target);
      const length = Math.hypot(bx - ax, by - ay);
      if (length === 0) continue;
      // The line stops 1 px off the target dot's rim, on the straight line between the points.
      const rim = (m.radius[line.target] as number) + 1;
      const ex = bx - ((bx - ax) / length) * rim;
      const ey = by - ((by - ay) / length) * rim;
      // A bent line's control point sits twice its offset out from the middle of its own ends, so
      // the curve's middle sits at the offset from the line it draws (measured from the points'
      // centres instead, a short line's bend read 3.0 px for 5).
      const bent = bend[li] as number;
      const offset = 2 * bent * PARALLEL_STEP;
      const cx = (ax + ex) / 2 - ((by - ay) / length) * offset;
      const cy = (ay + ey) / 2 + ((bx - ax) / length) * offset;
      // The arrowhead follows a curve's last tangent, a straight line's direction to its target
      // (whose own length is 0 where the source touches the target's rim + 1 px).
      const tl = bent === 0 ? 0 : Math.hypot(ex - cx, ey - cy);
      const ux = tl > 0 ? (ex - cx) / tl : (bx - ax) / length;
      const uy = tl > 0 ? (ey - cy) / tl : (by - ay) / length;
      ctx.moveTo(ax, ay);
      if (bent === 0) ctx.lineTo(ex, ey);
      else ctx.quadraticCurveTo(cx, cy, ex, ey);
      heads.push(
        ex,
        ey,
        ex - ux * ARROW_LENGTH - uy * ARROW_HALF_WIDTH,
        ey - uy * ARROW_LENGTH + ux * ARROW_HALF_WIDTH,
        ex - ux * ARROW_LENGTH + uy * ARROW_HALF_WIDTH,
        ey - uy * ARROW_LENGTH - ux * ARROW_HALF_WIDTH,
      );
    }
    ctx.stroke();
    // `fill` closes each triangle; an explicit closePath measured ~14 ms a frame.
    ctx.beginPath();
    for (let k = 0; k < heads.length; k += 6) {
      ctx.moveTo(heads[k] as number, heads[k + 1] as number);
      ctx.lineTo(heads[k + 2] as number, heads[k + 3] as number);
      ctx.lineTo(heads[k + 4] as number, heads[k + 5] as number);
    }
    ctx.fill();

    // Dots: one filled path per colour.
    for (const [fill, members] of m.fills) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const i of members) {
        if (!drawn.has(i)) continue;
        const px = sx(i);
        const py = sy(i);
        const r = m.radius[i] as number;
        if (!near(px, py, r)) continue;
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, 2 * Math.PI);
      }
      ctx.fill();
    }

    // Labels below their dots; each halo is stroked before its text, covering the lines beneath.
    ctx.font = NETWORK_FONT;
    // Unhinted advances, the ones HarfBuzz sizes the model with: a hinting engine (stock Linux
    // Chromium) otherwise rounds each glyph's advance, and "MME unit per day" draws 106 px wide
    // for its 104.83 px box, 0.58 px past it on each side.
    ctx.textRendering = 'geometricPrecision';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2 * outline;
    ctx.strokeStyle = base['--surface-sunken'];
    const text = (rows: readonly string[], px: number, top: number, colour: string) => {
      ctx.fillStyle = colour;
      for (const [k, row] of rows.entries())
        ctx.strokeText(row, px, top + BASELINE + k * LINE_STEP);
      for (const [k, row] of rows.entries()) ctx.fillText(row, px, top + BASELINE + k * LINE_STEP);
    };
    for (const i of nodes) {
      if (!forced && (m.reveal[i] as number) > zoom) continue;
      const id = m.ids[i] as string;
      const label = m.sizes.get(id) as Size;
      const box = boxOf(label, i === subject ? (m.blocks.get(id) ?? null) : null);
      const px = sx(i);
      const py = sy(i);
      if (
        px + box.right < 0 ||
        px + box.left > width ||
        py + box.bottom < 0 ||
        py + box.top > height
      )
        continue;
      // The label box's top (its halo's top) sits `R + labelGap` below the point, as the model's.
      text(m.labels[i] ?? [], px, py + radius + labelGap + outline, base['--text']);
      const block = i === subject ? m.blocks.get(id) : undefined;
      if (block !== undefined)
        text(
          block.lines,
          px,
          py + radius + labelGap + label.H + labelGap + outline,
          base['--text-muted'],
        );
    }
    element.dataset['drawnGeneration'] = String(viewGeneration);
  };

  const redraw = () => {
    if (frame === 0 && !destroyed) frame = requestAnimationFrame(draw);
  };

  const clamp = (z: number) => Math.min(maxZoomNow, Math.max(minZoom, z));

  /** Zoom about a screen point, keeping the model point under it in place. */
  const zoomAt = (next: number, px: number, py: number) => {
    const z = clamp(next);
    pan = { x: px - ((px - pan.x) * z) / zoom, y: py - ((py - pan.y) * z) / zoom };
    zoom = z;
    redraw();
  };

  const fit = () => {
    if (state === null) return;
    const { sizes, blocks } = state.model;
    const canvas: Canvas = { width, height };
    let target: Frame;
    if (state.view.kind === 'full') {
      target = frameFull(state.view.scene.layout, canvas);
      minZoom = target.zoom;
      maxZoomNow = maxZoom;
    } else {
      const { subject, nodes } = state.view;
      target = frameFocus(
        { subject, nodes: nodes.map(([id, x, y]) => ({ id, x, y })) },
        sizes,
        subject === null ? null : (blocks.get(subject) ?? null),
        canvas,
      );
      minZoom = 1;
      maxZoomNow = 1;
    }
    zoom = target.zoom;
    pan = { ...target.pan };
    redraw();
  };

  const measure = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    ratio = window.devicePixelRatio || 1;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
  };

  const observer = new ResizeObserver(() => {
    measure();
    fit();
  });
  observer.observe(container);

  /** The concept under a screen point: the nearest dot within reach, else a shown label's box. */
  const hit = (px: number, py: number): string | null => {
    if (state === null) return null;
    const { model: m, x, y, nodes, forced, subject } = state;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const i of nodes) {
      const distance = Math.hypot(
        px - ((x[i] as number) * zoom + pan.x),
        py - ((y[i] as number) * zoom + pan.y),
      );
      if (distance <= (m.radius[i] as number) + HIT_SLACK && distance < bestDistance) {
        best = m.ids[i] as string;
        bestDistance = distance;
      }
    }
    if (best !== null) return best;
    for (const i of nodes) {
      if (!forced && (m.reveal[i] as number) > zoom) continue;
      const id = m.ids[i] as string;
      const box = boxOf(m.sizes.get(id) as Size, i === subject ? (m.blocks.get(id) ?? null) : null);
      const nx = (x[i] as number) * zoom + pan.x;
      const ny = (y[i] as number) * zoom + pan.y;
      if (
        px >= nx + box.left &&
        px <= nx + box.right &&
        py >= ny + box.top &&
        py <= ny + box.bottom
      )
        return id;
    }
    return null;
  };

  // Gestures: one pointer pans (or taps), two pinch; the wheel zooms about the cursor.
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { x: number; y: number; at: number; moved: boolean; spread: number } | null = null;
  const local = (event: PointerEvent | WheelEvent) => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const spreadOf = () => {
    const [a, b] = [...pointers.values()];
    return a !== undefined && b !== undefined ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const middle = () => {
    const all = [...pointers.values()];
    return {
      x: all.reduce((sum, p) => sum + p.x, 0) / all.length,
      y: all.reduce((sum, p) => sum + p.y, 0) / all.length,
    };
  };
  const onDown = (event: PointerEvent) => {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, local(event));
    const at = middle();
    gesture = {
      x: at.x,
      y: at.y,
      at: event.timeStamp,
      moved: pointers.size > 1 || (gesture?.moved ?? false),
      spread: spreadOf(),
    };
  };
  const onMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId) || gesture === null) return;
    pointers.set(event.pointerId, local(event));
    const at = middle();
    const dx = at.x - gesture.x;
    const dy = at.y - gesture.y;
    if (!gesture.moved && pointers.size === 1 && Math.hypot(dx, dy) < TAP_SLOP) return;
    gesture.moved = true;
    pan = { x: pan.x + dx, y: pan.y + dy };
    if (pointers.size > 1) {
      const spread = spreadOf();
      if (gesture.spread > 0 && spread > 0) zoomAt((zoom * spread) / gesture.spread, at.x, at.y);
      gesture.spread = spread;
    }
    gesture.x = at.x;
    gesture.y = at.y;
    redraw();
  };
  const onUp = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    const tapped =
      pointers.size === 1 &&
      gesture !== null &&
      !gesture.moved &&
      event.timeStamp - gesture.at < TAP_MS;
    pointers.delete(event.pointerId);
    if (tapped) {
      const at = local(event);
      const id = hit(at.x, at.y);
      if (id !== null) onSelect(id);
    }
    if (pointers.size === 0) gesture = null;
    else if (gesture !== null) {
      const at = middle();
      gesture = { ...gesture, x: at.x, y: at.y, spread: spreadOf() };
    }
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const at = local(event);
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomAt(zoom * Math.exp(-delta * WHEEL_RATE), at.x, at.y);
  };
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  element.addEventListener('wheel', onWheel, { passive: false });

  if (!fontReady) {
    void document.fonts.load(NETWORK_FONT).then(() => {
      fontReady = true;
      redraw();
    });
  }

  measure();

  return {
    show(view) {
      if (destroyed) return;
      // All or nothing: a refused view (a missing token, an unknown id) leaves the shown one intact.
      const nextPalette =
        model?.scene === view.scene && palette !== null
          ? palette
          : paletteOf(container, view.scene);
      const nextModel =
        model?.scene === view.scene && palette !== null ? model : modelOf(view.scene, nextPalette);
      state = stateOf(view, nextModel);
      palette = nextPalette;
      model = nextModel;
      viewGeneration += 1;
      element.dataset['viewGeneration'] = String(viewGeneration);
      fit();
    },
    zoomTo(next, at = { x: width / 2, y: height / 2 }) {
      if (state !== null) zoomAt(next, at.x, at.y);
    },
    camera: () => ({ zoom, pan: { ...pan }, minZoom, maxZoom: maxZoomNow }),
    destroy() {
      destroyed = true;
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('wheel', onWheel);
      element.remove();
    },
  };
};
