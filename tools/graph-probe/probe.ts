// Renderer conformance probe for the edge-view contract R1-R7 (`.agent/contracts/m5u8.md`).
//
// It mounts the SHIPPED `src/graph/canvas.ts` — not a copy of its stylesheet — so a rule that
// stops holding reddens here instead of passing against a restated style. The contract is
// renderer-neutral; this probe is not, because a guarantee about rendered curves, rendered
// label text and selection state is only decidable inside the renderer.
//
// `tests/semantic-graph.dom.test.ts` MOCKS this adapter and jsdom has no canvas, so no suite
// in the repo can see any of R1-R7. Driven from `tools/graph-check.mjs`.

import { mountGraphCanvas, type GraphCanvas } from '../../src/graph/canvas.js';
import {
  DEFAULT_NEIGHBOR_LIMIT,
  SemanticGraphModel,
  graphRelationLabel,
  parseSemanticGraph,
  type GraphFocusToken,
  type GraphPath,
  type GraphSubgraph,
  type SemanticGraphEdge,
  type SemanticGraphNode,
} from '../../src/graph/model.js';

// The app's own faces. Cytoscape measures label width with `measureText`, so a probe running
// on a fallback face wraps at different points than the product does.
import '../../src/app.css';

interface Fixture {
  subgraph: GraphSubgraph;
  selectedId: string;
  path: GraphPath | null;
}

interface Point {
  x: number;
  y: number;
}

/** Cytoscape registers itself on its container; the adapter exposes no instance by design. */
interface CyRegistered extends HTMLElement {
  _cyreg?: { cy?: CyLike };
}

/** The slice of Cytoscape this probe reads. Declared here so the probe owns no `any`. */
interface CyLike {
  zoom(): number;
  nodes(): CyCollection<CyNode>;
  edges(): CyCollection<CyEdge>;
  elements(): CyCollection<CyElement>;
  $(selector: string): { length: number };
  one(event: string, handler: () => void): void;
}

interface CyCollection<T> {
  readonly [index: number]: T | undefined;
  length: number;
  map<R>(fn: (element: T) => R): R[];
  filter(fn: (element: T) => boolean): CyCollection<T>;
  forEach(fn: (element: T) => void): void;
  select(): void;
}

interface CyElement {
  id(): string;
  hasClass(name: string): boolean;
  style(name: string): string;
  style(name: string, value: string): void;
  emit(event: string): void;
}

interface CyNode extends CyElement {
  data(name: string): string;
  renderedBoundingBox(options?: { includeLabels?: boolean }): {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  };
  renderedPosition(): Point;
  _private: { rscratch: { labelWrapCachedLines?: string[] } };
}

interface CyEdge extends CyElement {
  source(): CyNode;
  target(): CyNode;
  renderedMidpoint(): Point;
}

const stage = document.querySelector('#stage') as HTMLElement;

const fixtures = new Map<string, Fixture>();
let model: SemanticGraphModel;
let canvas: GraphCanvas;
let selections: string[] = [];

/**
 * Two concept nodes joined by edges whose polarity disagrees.
 *
 * The shipped projection carries no scope yet (u11/u12), so no live view contains a pair the
 * reader must tell apart. R1 is exactly the guarantee that stops such a pair from rendering
 * as one stroke, and it has to be decidable before the data arrives.
 */
const parallelFixture = (): Fixture => {
  const node = (id: string, label: string): SemanticGraphNode => ({
    id,
    kind: 'entity',
    label,
    document: 'fixture',
  });
  const edge = (n: number, label: string, target: string): SemanticGraphEdge => ({
    id: `fixture:e${String(n)}`,
    kind: 'event',
    source: 'fixture:a',
    target,
    label,
    document: 'fixture',
    sentence: n,
    line: n,
    predicate: 'guideline_event',
  });
  return {
    subgraph: {
      nodes: [
        node('fixture:a', 'opioid therapy'),
        node('fixture:b', 'acute pain'),
        node('fixture:c', 'naloxone'),
      ],
      edges: [
        edge(1, 'should consider for', 'fixture:b'),
        edge(2, 'should not consider for', 'fixture:b'),
        edge(3, 'can taper for', 'fixture:b'),
        edge(4, 'should offer with', 'fixture:c'),
        edge(5, 'should not offer with', 'fixture:c'),
      ],
      truncatedNodes: false,
      truncatedEdges: false,
    },
    selectedId: 'fixture:a',
    path: { nodes: ['fixture:a', 'fixture:b'], edges: ['fixture:e1'] },
  };
};

const cyOf = (): CyLike => {
  const registered = (stage as CyRegistered)._cyreg?.cy;
  if (registered === undefined) throw new Error('canvas mounted no cytoscape instance');
  return registered;
};

const frame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

const boot = async (tokens: GraphFocusToken[]): Promise<void> => {
  const response = await fetch('/semantic-graph.json');
  model = new SemanticGraphModel(parseSemanticGraph((await response.json()) as unknown));
  for (const token of tokens) {
    const view = model.answerSubgraph(token);
    if (view === undefined) throw new Error(`no answer view for ${String(token.document)}`);
    fixtures.set(`${String(token.question ?? '')}/${String(token.document)}`, {
      subgraph: view,
      selectedId: view.root,
      path: view.highlight,
    });
  }
  // The densest concept hub at the shipped neighbour limit: the worst view the app can reach
  // without the user raising the limit.
  let hub = '';
  let widest = -1;
  for (const node of model.data.nodes) {
    const degree = model.conceptIncident(node.id).length;
    if (degree <= widest) continue;
    widest = degree;
    hub = node.id;
  }
  fixtures.set('worst-bounded', {
    subgraph: model.conceptNeighborhood(hub, 1, DEFAULT_NEIGHBOR_LIMIT),
    selectedId: hub,
    path: null,
  });
  fixtures.set('parallel-opposite', parallelFixture());
  await document.fonts.ready;
  canvas = await mountGraphCanvas(stage, (id) => selections.push(id));
};

/** Two rendered midpoints closer than this read as one stroke. */
const SEPARATION_PX = 3;

const distinct = (points: Point[]): number => {
  const seen: Point[] = [];
  for (const point of points) {
    if (seen.some((other) => Math.hypot(other.x - point.x, other.y - point.y) < SEPARATION_PX))
      continue;
    seen.push(point);
  }
  return seen.length;
};

const crossings = (segments: [Point, Point][]): number => {
  const side = (a: Point, b: Point, c: Point): number =>
    Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  let count = 0;
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const [p1, p2] = segments[i] as [Point, Point];
      const [q1, q2] = segments[j] as [Point, Point];
      if (
        side(p1, p2, q1) !== side(p1, p2, q2) &&
        side(q1, q2, p1) !== side(q1, q2, p2) &&
        side(p1, p2, q1) !== 0 &&
        side(q1, q2, p1) !== 0
      )
        count += 1;
    }
  }
  return count;
};

/**
 * What Cytoscape will actually paint, after wrapping.
 *
 * `text-wrap: wrap` splits on U+200B as well as whitespace, so both come back out before the
 * comparison. A node the renderer has not measured yet reports its own data, which keeps a
 * culled node from reading as truncated; `labelsMeasured` is what says how much R7 covered.
 */
/** `#rgb`, `#rrggbb` and the `rgb(...)` Cytoscape reports back, as one comparable triple. */
const triple = (value: string): string => {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/iu.exec(value.trim())?.[1];
  if (hex !== undefined) {
    const digits = hex.length === 3 ? hex.replace(/./gu, (d) => d + d) : hex;
    return [0, 1, 2].map((i) => Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16)).join(',');
  }
  // Cytoscape reports `rgb(r,g,b)` with integer channels, so integers are the whole grammar.
  const channels = value.match(/\d+/gu);
  if (channels === null) throw new Error(`unreadable colour ${value}`);
  return channels.slice(0, 3).join(',');
};

/**
 * Every canvas colour against the `src/app.css` token it must equal.
 *
 * This is what makes the graph the same surface as the page: `tools/contrast.mjs` decides the
 * ratios of the token pairs in both themes, and a ratio it decided is only the graph's if the
 * renderer actually paints that value. A hardcoded hex passes the static grader and reddens
 * here.
 */
const paletteMismatches = (cy: CyLike): string[] => {
  const token = (name: string): string => {
    const value = getComputedStyle(stage).getPropertyValue(name).trim();
    if (value === '') throw new Error(`token ${name} is undefined on the stage`);
    return value;
  };
  const plain = cy.nodes().filter((node) => !node.hasClass('path') && !node.hasClass('selected'));
  const kindToken = new Map([
    ['document', '--graph-document'],
    ['entity', '--graph-entity'],
    ['event', '--graph-event'],
    ['operator-context', '--graph-operator'],
    ['value', '--graph-value'],
  ]);
  const out: string[] = [];
  const check = (
    where: string,
    element: CyElement | undefined,
    property: string,
    name: string,
  ): void => {
    if (element === undefined) return;
    const actual = element.style(property);
    if (triple(actual) !== triple(token(name)))
      out.push(`${where} ${property} is ${actual}, not ${name} ${token(name)}`);
  };
  for (const [kind, name] of kindToken) {
    const node = plain.filter((candidate) => candidate.data('kind') === kind)[0];
    check(`${kind} node`, node, 'background-color', name);
    check(`${kind} node`, node, 'text-outline-color', name);
    check(`${kind} node`, node, 'color', '--graph-label');
    check(`${kind} node`, node, 'border-color', '--surface-sunken');
  }
  check(
    'plain edge',
    cy.edges().filter((edge) => !edge.hasClass('path'))[0],
    'line-color',
    '--graph-edge',
  );
  const pathNode = cy.nodes().filter((node) => node.hasClass('path') && !node.hasClass('selected'));
  check('path node', pathNode[0], 'background-color', '--graph-path');
  const pathEdge = cy.edges().filter((edge) => edge.hasClass('path'));
  check('path edge', pathEdge[0], 'line-color', '--graph-path');
  check('path edge', pathEdge[0], 'color', '--graph-path');
  check('path edge', pathEdge[0], 'text-background-color', '--surface-raised');
  const selected = cy.nodes().filter((node) => node.hasClass('selected'));
  check('selected node', selected[0], 'background-color', '--action');
  check('selected node', selected[0], 'border-color', '--graph-path');
  return out;
};

const shownLabel = (node: CyNode): string =>
  (node._private.rscratch.labelWrapCachedLines ?? [node.data('label')])
    .join(' ')
    .replace(/\u200b/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

export interface Reading {
  view: string;
  nodes: number;
  edges: number;
  zoom: number;
  labelPx: number;
  /** R1 */
  parallelPairs: number;
  parallelSeparated: number;
  /** R2 — edges whose rendered label is not `graphRelationLabel`, and labelled non-path edges */
  labelMismatches: string[];
  labelledOffPath: number;
  /** R3 */
  selectableElements: number;
  highlightBeforeTap: number;
  highlightAfterTap: number;
  tapDelivered: boolean;
  /** R4 */
  dashedEdges: number;
  /** R7 */
  truncatedLabels: string[];
  labelsMeasured: number;
  wrapModes: string[];
  /** u10 — rendered colour against the `src/app.css` token it must equal, per theme */
  theme: 'light' | 'dark';
  paletteMismatches: string[];
  /** context */
  labelOverlaps: number;
  crossings: number;
  /** What the floor costs: the settled extent in canvas widths and heights. */
  panWidths: number;
  panHeights: number;
  settleMs: number;
}

const api = {
  boot,
  views: (): string[] => [...fixtures.keys()],
  async render(view: string, theme: 'light' | 'dark'): Promise<Reading> {
    const fixture = fixtures.get(view);
    if (fixture === undefined) throw new Error(`unknown fixture ${view}`);
    // `src/app.css` binds the dark palette on `:root[data-theme]`, and `canvas.ts` re-reads it
    // from a `MutationObserver` on that attribute. Setting it anywhere else styles nothing.
    document.documentElement.dataset.theme = theme;
    selections = [];
    const started = performance.now();
    const settled = new Promise<void>((resolve) => {
      cyOf().one('layoutstop', resolve);
    });
    canvas.update(fixture.subgraph, fixture.selectedId, fixture.path);
    await settled;
    await frame();
    const settleMs = performance.now() - started;
    const cy = cyOf();

    const labelBoxes = cy.nodes().map((node) => node.renderedBoundingBox({ includeLabels: true }));
    const extent = labelBoxes.reduce(
      (box, next) => ({
        x1: Math.min(box.x1, next.x1),
        x2: Math.max(box.x2, next.x2),
        y1: Math.min(box.y1, next.y1),
        y2: Math.max(box.y2, next.y2),
      }),
      { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity },
    );
    let labelOverlaps = 0;
    for (let i = 0; i < labelBoxes.length; i += 1) {
      for (let j = i + 1; j < labelBoxes.length; j += 1) {
        const a = labelBoxes[i] as { x1: number; x2: number; y1: number; y2: number };
        const b = labelBoxes[j] as { x1: number; x2: number; y1: number; y2: number };
        if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) labelOverlaps += 1;
      }
    }

    const relations = new Map(
      fixture.subgraph.edges.map((edge) => [edge.id, graphRelationLabel(edge)]),
    );
    const pairs = new Map<string, Point[]>();
    const segments: [Point, Point][] = [];
    const labelMismatches: string[] = [];
    let labelledOffPath = 0;
    let dashedEdges = 0;
    cy.edges().forEach((edge) => {
      const shown = edge.style('label');
      const onPath = edge.hasClass('path');
      if (shown !== '' && shown !== relations.get(edge.id())) labelMismatches.push(edge.id());
      if (shown !== '' && !onPath) labelledOffPath += 1;
      if (edge.style('line-style') !== 'solid') dashedEdges += 1;
      if (edge.source().id() === edge.target().id()) return;
      const key = [edge.source().id(), edge.target().id()].sort().join(' ');
      const bucket = pairs.get(key) ?? [];
      bucket.push(edge.renderedMidpoint());
      pairs.set(key, bucket);
      segments.push([edge.source().renderedPosition(), edge.target().renderedPosition()]);
    });
    let parallelPairs = 0;
    let parallelSeparated = 0;
    for (const points of pairs.values()) {
      if (points.length < 2) continue;
      parallelPairs += 1;
      if (distinct(points) === points.length) parallelSeparated += 1;
    }

    const truncatedLabels = cy
      .nodes()
      .filter((node) => shownLabel(node) !== node.data('label').replace(/\s+/gu, ' ').trim())
      .map((node) => node.id());
    const labelsMeasured = cy
      .nodes()
      .filter((node) => node._private.rscratch.labelWrapCachedLines !== undefined).length;
    // `ellipsis` truncates without ever caching wrapped lines, so the mode itself is what
    // says whether a label CAN come out whole; the comparison above says whether it did.
    const wrapModes = [...new Set(cy.nodes().map((node) => node.style('text-wrap')))].sort();

    // R3: nothing may become `:selected`, and a tap must move the app's selection without
    // moving the highlight. The victim is a node the proof does NOT carry.
    const highlightBefore = cy.elements().filter((element) => element.hasClass('path')).length;
    cy.elements().select();
    const selectableElements = cy.$(':selected').length;
    const victim = cy.nodes().filter((node) => !node.hasClass('path'));
    victim[0]?.emit('tap');
    await frame();
    const highlightAfter = cy.elements().filter((element) => element.hasClass('path')).length;

    return {
      view,
      nodes: cy.nodes().length,
      edges: cy.edges().length,
      zoom: cy.zoom(),
      labelPx: 10 * cy.zoom(),
      parallelPairs,
      parallelSeparated,
      labelMismatches,
      labelledOffPath,
      selectableElements,
      highlightBeforeTap: highlightBefore,
      highlightAfterTap: highlightAfter,
      tapDelivered: victim.length === 0 || selections.length > 0,
      dashedEdges,
      truncatedLabels,
      labelsMeasured,
      wrapModes,
      theme,
      paletteMismatches: paletteMismatches(cy),
      labelOverlaps,
      crossings: crossings(segments),
      panWidths: (extent.x2 - extent.x1) / stage.clientWidth,
      panHeights: (extent.y2 - extent.y1) / stage.clientHeight,
      settleMs,
    };
  },
  /**
   * u10: the theme toggle restyles a MOUNTED graph.
   *
   * Colours have to change, the palette has to stay consistent in the new theme, and no node
   * may move — a remount would re-run the layout, which is what a reader would notice.
   */
  async themeFlip(): Promise<{
    before: string;
    after: string;
    restored: string;
    moved: number;
    mismatches: number;
  }> {
    const cy = cyOf();
    const probe = cy.nodes()[0];
    if (probe === undefined) throw new Error('fixture has no node to read');
    const root = document.documentElement;
    const started = root.dataset.theme === 'dark' ? 'dark' : 'light';
    const positions = cy.nodes().map((node) => node.renderedPosition());
    const before = probe.style('background-color');
    root.dataset.theme = started === 'dark' ? 'light' : 'dark';
    await frame();
    const after = probe.style('background-color');
    const mismatches = paletteMismatches(cy).length;
    root.dataset.theme = started;
    await frame();
    const moved = cy
      .nodes()
      .map((node) => node.renderedPosition())
      .filter((point, index) => {
        const was = positions[index];
        return was === undefined || Math.hypot(was.x - point.x, was.y - point.y) > 0.5;
      }).length;
    return { before, after, restored: probe.style('background-color'), moved, mismatches };
  },
  /**
   * R4 positive control: `line-style` is a per-edge property the renderer honours.
   *
   * u12 rides scope polarity on it, so the guarantee has to be decidable before that payload
   * exists — otherwise the first dashed edge is also the first test of dashing.
   */
  dashControl(): { before: number; during: number; after: number } {
    const cy = cyOf();
    const dashed = (): number =>
      cy.edges().filter((edge) => edge.style('line-style') !== 'solid').length;
    const before = dashed();
    const victim = cy.edges()[0];
    if (victim === undefined) throw new Error('fixture has no edge to dash');
    victim.style('line-style', 'dashed');
    const during = dashed();
    victim.style('line-style', 'solid');
    return { before, during, after: dashed() };
  },
};

declare global {
  interface Window {
    graphProbe: typeof api;
  }
}
window.graphProbe = api;
