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

const NODE_STYLE: Readonly<
  Record<SemanticGraphNodeKind, { shape: cytoscape.Css.NodeShape; color: string }>
> = {
  document: { shape: 'round-rectangle', color: '#245c73' },
  entity: { shape: 'ellipse', color: '#176b68' },
  event: { shape: 'diamond', color: '#956019' },
  'operator-context': { shape: 'hexagon', color: '#75558a' },
  value: { shape: 'round-tag', color: '#5d6871' },
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

const stylesheet = (): cytoscape.StylesheetJson => [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      color: '#fffdf8',
      'background-color': '#176b68',
      'border-color': '#fffdf8',
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
      'text-outline-color': '#176b68',
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
      'background-color': style.color,
      'text-outline-color': style.color,
    },
  })),
  {
    selector: 'edge',
    style: {
      width: 1,
      'line-color': '#7f8b98',
      'target-arrow-color': '#7f8b98',
      'target-arrow-shape': 'triangle',
      // Bezier is what separates parallel edges — Cytoscape offsets each control point by the
      // edge's index within its node pair. `straight` collapsed all of them onto one line and
      // rendered opposite-polarity relations as a single stroke. `m5u8.md` R1.
      'curve-style': 'bezier',
      opacity: 0.38,
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
      'background-color': '#b34a21',
      'line-color': '#b34a21',
      'target-arrow-color': '#b34a21',
      'text-outline-color': '#b34a21',
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
      color: '#6f2b13',
      'font-family': 'Atkinson Hyperlegible Next, sans-serif',
      'font-size': 9,
      'font-weight': 700,
      'text-background-color': '#fffdf8',
      'text-background-opacity': 0.9,
      'text-background-padding': '2px',
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: 'node.selected',
    style: {
      'background-color': '#174f9e',
      'border-color': '#d05a2a',
      'text-outline-color': '#174f9e',
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
    style: stylesheet(),
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
      cy.destroy();
    },
  };
};
