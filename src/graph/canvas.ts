import type cytoscape from 'cytoscape';

import {
  DEFAULT_ANSWER_GRAPH_LIMIT,
  DEFAULT_NEIGHBOR_LIMIT,
  graphNodeLabel,
  graphRelationLabel,
  type GraphPath,
  type GraphSubgraph,
  type SemanticGraphNodeKind,
} from './model.js';

export interface GraphCanvas {
  update(subgraph: GraphSubgraph, selectedId: string, path: GraphPath | null): void;
  recenter(selectedId?: string): void;
  destroy(): void;
}

/**
 * Every colour the canvas paints, named as an `src/app.css` token.
 *
 * The graph is drawn on a `<canvas>`, so a token reaches it only by being read — nothing here
 * inherits. Reading them per mount and again on each theme change is what makes the canvas
 * the same surface as the rest of the page; `tools/contrast.mjs` grades every one of these in
 * BOTH themes, so a colour chosen here is a colour the gate has decided.
 */
const PALETTE = [
  '--graph-label',
  '--graph-document',
  '--graph-entity',
  '--graph-event',
  '--graph-operator',
  '--graph-value',
  '--graph-edge',
  '--graph-path',
  '--action',
  '--surface-sunken',
  '--surface-raised',
] as const;

type Palette = Record<(typeof PALETTE)[number], string>;

/**
 * A missing token is a mount failure, never a black node: `SemanticGraph.svelte` catches it
 * and keeps the HTML relation view, which carries the same relations in text.
 */
const paletteOf = (container: HTMLElement): Palette => {
  const computed = getComputedStyle(container);
  const missing: string[] = [];
  const entries = PALETTE.map((token) => {
    const value = computed.getPropertyValue(token).trim();
    if (value === '') missing.push(token);
    return [token, value] as const;
  });
  if (missing.length > 0) throw new Error(`graph palette is undefined: ${missing.join(', ')}`);
  return Object.fromEntries(entries) as Palette;
};

const NODE_STYLE: Readonly<
  Record<SemanticGraphNodeKind, { shape: cytoscape.Css.NodeShape; token: keyof Palette }>
> = {
  document: { shape: 'round-rectangle', token: '--graph-document' },
  entity: { shape: 'ellipse', token: '--graph-entity' },
  event: { shape: 'diamond', token: '--graph-event' },
  'operator-context': { shape: 'hexagon', token: '--graph-operator' },
  value: { shape: 'round-tag', token: '--graph-value' },
};

/** Base node label size. The fit floor below is expressed against it. */
const LABEL_PX = 10;

/**
 * A settled view never renders a node label below this. Fitting the whole graph puts the
 * bounded worst case at 9.4 px on the 1152x558 desktop canvas and 3.5 px on the 296x384
 * mobile one, which no face survives, so below the floor the view pans instead of shrinking.
 * `.agent/contracts/m5u8.md` R5.
 */
const MIN_FIT_ZOOM = 11 / LABEL_PX;
const PADDING = 32;

/**
 * How far a layout spreads, as how many labels have to coexist in it.
 *
 * Measured at the model's own two limits on the 1152x558 canvas: an answer view reads best
 * packed, at 0.84 x 1.22 canvases of panning, while the same setting leaves the bounded hub
 * with 81 colliding labels — the wide end cuts that to 37 for 0.87 x 1.59 canvases. Neither
 * setting wins at both sizes, so the layout interpolates between them. `m5u8.md`.
 */
const spread = (count: number): number =>
  Math.min(
    1,
    Math.max(
      0,
      (count - DEFAULT_ANSWER_GRAPH_LIMIT) / (DEFAULT_NEIGHBOR_LIMIT - DEFAULT_ANSWER_GRAPH_LIMIT),
    ),
  );

const elementsOf = (
  subgraph: GraphSubgraph,
  selectedId: string,
  path: GraphPath | null,
): cytoscape.ElementDefinition[] => {
  const pathNodes = new Set(path?.nodes ?? []);
  const pathEdges = new Set(path?.edges ?? []);
  const hasHighlight = path !== null;
  return [
    ...subgraph.nodes.map((node) => ({
      group: 'nodes' as const,
      data: { id: node.id, label: graphNodeLabel(node), kind: node.kind },
      classes: [
        node.id === selectedId ? 'selected' : '',
        pathNodes.has(node.id) ? 'path' : '',
        hasHighlight && !pathNodes.has(node.id) ? 'context' : '',
      ]
        .filter(Boolean)
        .join(' '),
    })),
    ...subgraph.edges.map((edge) => ({
      group: 'edges' as const,
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: graphRelationLabel(edge),
        kind: edge.kind,
      },
      classes: pathEdges.has(edge.id) ? 'path' : hasHighlight ? 'context' : '',
    })),
  ];
};

const stylesheet = (palette: Palette): cytoscape.StylesheetJson => [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      color: palette['--graph-label'],
      'background-color': palette['--graph-entity'],
      // The border is a GAP, not a line: it carries the canvas colour out around the node so
      // one node's fill never touches its neighbour's label outline.
      'border-color': palette['--surface-sunken'],
      'border-width': 1,
      'font-family': 'Atkinson Hyperlegible Next, sans-serif',
      'font-size': LABEL_PX,
      'font-weight': 600,
      height: 34,
      width: 54,
      padding: '5px',
      // A wrapped label is wider than its 54 px node, and the overflow is near-white text on
      // a near-white canvas — `nonopioid therapy` read as `onopioid thera`, losing a
      // character at each end with nothing on screen to say so. The outline carries the
      // node's own colour out under the overflow, so the whole term stays legible.
      'text-outline-width': 2,
      'text-outline-color': palette['--graph-entity'],
      'text-outline-opacity': 1,
      // Wrap, never `ellipsis`: at 96 px the ellipsis rendered `category B recommendation` as
      // `gory B reco`, and a truncated concept name is unreadable as a map. `m5u8.md` R7.
      'text-wrap': 'wrap',
      'text-max-width': '108px',
      'text-valign': 'center',
      'text-halign': 'center',
    },
  },
  ...Object.entries(NODE_STYLE).map(([kind, style]) => ({
    selector: `node[kind = "${kind}"]`,
    style: {
      shape: style.shape,
      'background-color': palette[style.token],
      'text-outline-color': palette[style.token],
    },
  })),
  {
    selector: 'edge',
    style: {
      width: 1,
      'line-color': palette['--graph-edge'],
      'target-arrow-color': palette['--graph-edge'],
      'target-arrow-shape': 'triangle',
      // Bezier is what separates parallel edges — Cytoscape offsets each control point by the
      // edge's index within its node pair. `straight` collapsed all of them onto one line and
      // rendered opposite-polarity relations as a single stroke. `m5u8.md` R1.
      'curve-style': 'bezier',
      // Opaque, because `--graph-edge` clears 3:1 against the canvas as a colour and a
      // faded stroke does not. `.context` below is where de-emphasis lives.
      opacity: 1,
    },
  },
  {
    selector: 'node.context',
    style: {
      opacity: 0.52,
    },
  },
  {
    selector: 'edge.context',
    style: {
      opacity: 0.16,
    },
  },
  {
    selector: '.path',
    style: {
      'background-color': palette['--graph-path'],
      'line-color': palette['--graph-path'],
      'target-arrow-color': palette['--graph-path'],
      'text-outline-color': palette['--graph-path'],
      opacity: 1,
      width: 3,
      'z-index': 8,
    },
  },
  {
    selector: 'node.path',
    style: {
      'font-size': 11,
      height: 40,
      width: 66,
      'text-max-width': '124px',
    },
  },
  {
    selector: 'edge.path',
    style: {
      label: 'data(label)',
      color: palette['--graph-path'],
      'font-family': 'Atkinson Hyperlegible Next, sans-serif',
      'font-size': 9,
      'font-weight': 700,
      'text-background-color': palette['--surface-raised'],
      'text-background-opacity': 0.9,
      'text-background-padding': '2px',
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: 'node.selected',
    style: {
      'background-color': palette['--action'],
      'border-color': palette['--graph-path'],
      'text-outline-color': palette['--action'],
      'border-width': 5,
      'font-size': 13,
      height: 48,
      width: 92,
      'text-max-width': '148px',
      'underlay-opacity': 0,
      'z-index': 10,
    },
  },
];

/** Import both graph packages only after the user activates the graph surface. */
export const mountGraphCanvas = async (
  container: HTMLElement,
  onSelect: (id: string) => void,
): Promise<GraphCanvas> => {
  const [{ default: cytoscapeFactory }, { default: fcose }] = await Promise.all([
    import('cytoscape'),
    import('cytoscape-fcose'),
  ]);
  cytoscapeFactory.use(fcose);
  const cy = cytoscapeFactory({
    container,
    elements: [],
    style: stylesheet(paletteOf(container)),
    minZoom: 0.2,
    maxZoom: 3,
    // Cytoscape's built-in stylesheet paints anything `:selected` #0169D9, and a tap selects
    // whatever it hit. That repainted a plain edge in the highlight's own register while the
    // proof said nothing — selection state is the app's alone, carried by the `.selected` and
    // `.path` classes below. `m5u8.md` R3.
    autounselectify: true,
  });
  cy.on('tap', 'node', (event: cytoscape.EventObjectNode) => {
    onSelect(event.target.id());
  });

  const resize = new ResizeObserver(() => {
    cy.resize();
  });
  resize.observe(container);

  // The theme toggle rebinds the tokens on `<html>`, and nothing on a canvas inherits, so the
  // palette is re-read and the stylesheet replaced in place. Positions, zoom and selection all
  // survive, which is what keeps a toggle from re-running the layout.
  const theme = new MutationObserver(() => {
    cy.style()
      .fromJson(stylesheet(paletteOf(container)))
      .update();
  });
  theme.observe(document.documentElement, { attributeFilter: ['data-theme'] });

  /** Fit `eles`, then hold the floor by panning `focus` into view instead of shrinking. */
  const fitFloored = (
    eles: cytoscape.Collection,
    padding: number,
    focus: cytoscape.Collection,
  ): void => {
    if (eles.empty()) return;
    cy.fit(eles, padding);
    if (cy.zoom() >= MIN_FIT_ZOOM) return;
    cy.zoom(MIN_FIT_ZOOM);
    cy.center(focus.nonempty() ? focus : eles);
  };

  const layout = (selectedId: string, path: GraphPath | null): void => {
    const highlighted = new Set(path?.nodes ?? []);
    const focus =
      path === null
        ? cy.getElementById(selectedId)
        : cy.nodes().filter((node) => highlighted.has(node.id()));
    const density = spread(cy.nodes().length);
    // One layout for every view. A `concentric` arrangement used to carry the highlight —
    // subject at the centre, proof nodes in the next ring — and cost 156 edge crossings and
    // 1.88 canvas heights of panning per answer view against fcose's 56 and 1.22. Pinning the
    // subject at the origin keeps that reading for free; the highlight itself is a colour.
    const options = {
      name: 'fcose',
      quality: 'proof',
      randomize: true,
      animate: false,
      fit: false,
      padding: PADDING,
      // Labels overflow their node box by design, so a layout blind to them packs readable
      // nodes into unreadable text.
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 9000 + 11000 * density,
      idealEdgeLength: 100 + 80 * density,
      nodeSeparation: 90 + 30 * density,
      fixedNodeConstraint: path === null ? [] : [{ nodeId: selectedId, position: { x: 0, y: 0 } }],
    } as unknown as cytoscape.LayoutOptions;
    // `layoutstop` fires whether the layout ran synchronously or not, so the floor is applied
    // to final positions either way.
    const run = cy.layout(options);
    run.one('layoutstop', () => {
      fitFloored(cy.elements(), PADDING, focus);
    });
    run.run();
  };

  return {
    update(subgraph, selectedId, path) {
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elementsOf(subgraph, selectedId, path));
      });
      layout(selectedId, path);
    },
    recenter(selectedId) {
      if (selectedId === undefined) {
        fitFloored(cy.elements(), PADDING, cy.collection());
        return;
      }
      const selected = cy.getElementById(selectedId);
      if (selected.nonempty()) fitFloored(selected.closedNeighborhood(), 56, selected);
    },
    destroy() {
      resize.disconnect();
      theme.disconnect();
      cy.destroy();
    },
  };
};
