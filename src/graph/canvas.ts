import type cytoscape from 'cytoscape';

import type { GraphPath, GraphSubgraph, SemanticGraphNodeKind } from './model.js';

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

const elementsOf = (
  subgraph: GraphSubgraph,
  selectedId: string,
  path: GraphPath | null,
): cytoscape.ElementDefinition[] => {
  const pathNodes = new Set(path?.nodes ?? []);
  const pathEdges = new Set(path?.edges ?? []);
  return [
    ...subgraph.nodes.map((node) => ({
      group: 'nodes' as const,
      data: { id: node.id, label: node.label, kind: node.kind },
      classes: [node.id === selectedId ? 'selected' : '', pathNodes.has(node.id) ? 'path' : '']
        .filter(Boolean)
        .join(' '),
    })),
    ...subgraph.edges.map((edge) => ({
      group: 'edges' as const,
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        kind: edge.kind,
      },
      classes: pathEdges.has(edge.id) ? 'path' : '',
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
      'font-size': 10,
      'font-weight': 600,
      height: 34,
      width: 54,
      padding: '5px',
      'text-wrap': 'ellipsis',
      'text-max-width': '96px',
      'text-valign': 'center',
      'text-halign': 'center',
    },
  },
  ...Object.entries(NODE_STYLE).map(([kind, style]) => ({
    selector: `node[kind = "${kind}"]`,
    style: { shape: style.shape, 'background-color': style.color },
  })),
  {
    selector: 'edge',
    style: {
      width: 1.25,
      'line-color': '#8f8270',
      'target-arrow-color': '#8f8270',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      opacity: 0.72,
    },
  },
  {
    selector: '.path',
    style: {
      'background-color': '#b34a21',
      'line-color': '#b34a21',
      'target-arrow-color': '#b34a21',
      opacity: 1,
      width: 3,
      'z-index': 8,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'border-color': '#1b1f23',
      'border-width': 4,
      'underlay-color': '#fffdf8',
      'underlay-opacity': 0.8,
      'underlay-padding': 5,
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
    wheelSensitivity: 0.18,
    selectionType: 'single',
  });
  cy.on('tap', 'node', (event: cytoscape.EventObjectNode) => {
    onSelect(event.target.id());
  });

  const resize = new ResizeObserver(() => {
    cy.resize();
  });
  resize.observe(container);

  const layout = (): void => {
    cy.layout({
      name: 'fcose',
      quality: 'default',
      randomize: true,
      animate: false,
      fit: true,
      padding: 32,
      nodeRepulsion: 6000,
      idealEdgeLength: 86,
      nodeSeparation: 60,
    } as cytoscape.LayoutOptions).run();
  };

  return {
    update(subgraph, selectedId, path) {
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elementsOf(subgraph, selectedId, path));
      });
      layout();
    },
    recenter(selectedId) {
      if (selectedId === undefined) {
        cy.fit(cy.elements(), 32);
        return;
      }
      const selected = cy.getElementById(selectedId);
      if (selected.nonempty()) cy.fit(selected.closedNeighborhood(), 56);
    },
    destroy() {
      resize.disconnect();
      cy.destroy();
    },
  };
};
