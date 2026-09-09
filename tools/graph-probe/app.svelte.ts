// Component conformance probe: the SHIPPED `SemanticGraph.svelte` driving the real renderer
// over the real graph asset. `.agent/contracts/m5u10.md` C1-C12.
//
// `probe.ts` beside this file mounts the ADAPTER and grades what it draws (R1-R7). This file
// grades the seam ABOVE it — the one place the component's state and the renderer's output
// have to agree — which no vitest suite can reach: `tests/semantic-graph.dom.test.ts` mocks
// `canvas.js` away, so every interaction there is graded against a stub that records calls.
// A stub cannot say whether the path the panel lists is the path the canvas highlights.
//
// Runes live here rather than in a plain `.ts` because `graphUrl` has to change BETWEEN a
// failed load and the retry click (C9), which is what a `$state` props object buys: the
// component's own prop path, not a patched `fetch`.

import { mount, tick, unmount } from 'svelte';

import '../../src/app.css';
import SemanticGraph from '../../src/graph/SemanticGraph.svelte';
import type { GraphFocus, SemanticGraphNode } from '../../src/graph/model.js';

import { maybeCy, type CyLike } from './cy.js';

/** The graph asset, served statically by the probe vite config's `publicDir`. */
const GRAPH_URL = '/semantic-graph.json';
/** A path the dev server does not serve. C9's broken input. */
const MISSING_URL = '/no-such-graph.json';
/**
 * The graph half of `canvas.ts`'s palette. C10 sets every one to `initial` on the mount host:
 * an unregistered custom property resolves `initial` to the guaranteed-invalid value, so
 * `getPropertyValue` comes back empty and `paletteOf` refuses the mount. The list is restated
 * rather than imported because `canvas.ts` keeps it private; C10 requires the reported message
 * to name every token broken here, so a token added there cannot make this pass vacuously.
 */
const GRAPH_TOKENS = [
  '--graph-label',
  '--graph-document',
  '--graph-entity',
  '--graph-event',
  '--graph-operator',
  '--graph-value',
  '--graph-edge',
  '--graph-path',
] as const;

const stage = document.querySelector<HTMLElement>('#stage');
if (stage === null) throw new Error('probe: the harness has no #stage');
const host = stage;

interface ProbeProps {
  graphUrl: string;
  focus: GraphFocus | null;
  focusRequest: number;
  onSelect: (node: SemanticGraphNode) => void;
}

const props: ProbeProps = $state({
  graphUrl: GRAPH_URL,
  focus: null,
  focusRequest: 0,
  onSelect: () => undefined,
});

let app: Record<string, unknown> | undefined;
let emitted: string[] = [];
let requested = 0;

const record = (node: SemanticGraphNode): void => {
  emitted.push(node.id);
};

const frame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

const waitFor = async <T>(what: string, read: () => T | null | undefined): Promise<T> => {
  const deadline = performance.now() + 30_000;
  for (;;) {
    const value = read();
    if (value !== null && value !== undefined) return value;
    if (performance.now() > deadline) throw new Error(`probe: timed out waiting for ${what}`);
    await frame();
  }
};

const all = (selector: string): Element[] => [...host.querySelectorAll(selector)];
const one = (selector: string): Element | null => host.querySelector(selector);
const text = (selector: string): string =>
  one(selector)?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const labelOf = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';

const press = (element: Element | null | undefined, what: string): void => {
  if (!(element instanceof HTMLElement)) throw new Error(`probe: ${what} is not clickable`);
  element.click();
};

/** The element `canvas.ts` mounts into, which is also where Cytoscape registers itself. */
const canvasHost = (): Element => {
  const found = one('.canvas-frame .canvas');
  if (found === null) throw new Error('probe: the component rendered no canvas host');
  return found;
};

/** The index is a closed `<details>`, so opening it is what makes its buttons reachable. */
const openNodeIndex = (): void => {
  const details = one('.html-graph details');
  if (!(details instanceof HTMLDetailsElement)) throw new Error('probe: no node index');
  details.open = true;
};

const selectedLabel = (cy: CyLike): string =>
  cy
    .nodes()
    .filter((node) => node.hasClass('selected'))[0]
    ?.data('label') ?? '';

/**
 * Wait until the renderer stops moving.
 *
 * The component drives `canvas.update` from an `$effect`, so there is no `layoutstop` to
 * register ahead of an interaction the way `probe.ts` can. Stability across consecutive frames
 * is the observable left, and `tick()` first is what keeps it from reading the state the
 * interaction is about to replace.
 */
const settle = async (): Promise<CyLike> => {
  await tick();
  const cy = await waitFor('a mounted renderer', () => maybeCy(canvasHost()));
  const deadline = performance.now() + 30_000;
  let last = '';
  let stable = 0;
  while (stable < 4) {
    const pan = cy.pan();
    const now = [
      cy.nodes().length,
      cy.edges().length,
      cy.zoom().toFixed(4),
      pan.x.toFixed(2),
      pan.y.toFixed(2),
      selectedLabel(cy),
    ].join('/');
    stable = now === last ? stable + 1 : 0;
    last = now;
    if (performance.now() > deadline) throw new Error('probe: the renderer never settled');
    await frame();
  }
  return cy;
};

const remount = async (): Promise<void> => {
  if (app !== undefined) {
    void unmount(app);
    app = undefined;
  }
  host.replaceChildren();
  for (const token of GRAPH_TOKENS) host.style.removeProperty(token);
  emitted = [];
  // A live `focusRequest` is the product's own auto-activation path, so a fresh mount that
  // inherited one from the previous sweep would activate itself before the probe pressed
  // anything. The answer sweep raises it again after the mount.
  props.focusRequest = 0;
  app = mount(SemanticGraph, { target: host, props });
  await tick();
};

/** The activation control, or the retry control a failed load leaves in its place. */
const activate = async (): Promise<void> => {
  press(
    one('.activation button.primary') ?? one('.load-failure button.primary'),
    'the activation control',
  );
  await waitFor('the ready header', () => one('.counts'));
};

const typeQuery = async (query: string): Promise<void> => {
  const input = one('.toolbar input[type="search"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('probe: the search input is missing');
  input.value = query;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await tick();
};

export interface ExpandRound {
  enabled: boolean;
  nodes: number;
}

export interface InteractionReading {
  view: 'concept' | 'answer';
  counts: string;
  answerView: boolean;
  cyNodes: number;
  cyEdges: number;
  canvasWidth: number;
  canvasHeight: number;
  /** C4 — one entry per round, `nodes` read BEFORE that round's click. */
  expandRounds: ExpandRound[];
  /** C5 */
  zoomFitted: number;
  zoomPerturbed: number;
  zoomRecentered: number;
  recenterMoved: boolean;
  recenterRelaidOut: number;
  recenterSelectedOnScreen: boolean;
  /** C7 */
  indexEntries: number;
  indexCanvasNodes: number;
  indexCurrent: string;
  indexCard: string;
  indexChosen: string;
  indexChosenCard: string;
  indexChosenCanvas: string;
  /** C6 */
  tapNode: string;
  tapCard: string;
  tapCanvasSelected: string;
  tapEmitted: string;
  /** C3 */
  pathQuery: string;
  pathSteps: number;
  pathCanvasNodes: number;
  pathCanvasEdges: number;
  pathStatus: string;
  clearedPanel: boolean;
  clearedCanvasPath: number;
  /** C2 */
  missQuery: string;
  missResults: number;
  missReported: boolean;
  searchQuery: string;
  searchResults: number;
  searchChosen: string;
  searchCard: string;
  searchEmitted: string;
  searchCanvasSelected: string;
}

/** C4: the control must raise the drawn node count and go disabled at the model's own cap. */
const expandLeg = async (start: CyLike): Promise<ExpandRound[]> => {
  const rounds: ExpandRound[] = [];
  let cy = start;
  for (let round = 0; round < 4; round += 1) {
    const control = all('.search-row button')[1];
    if (!(control instanceof HTMLButtonElement)) throw new Error('probe: no expand control');
    rounds.push({ enabled: !control.disabled, nodes: cy.nodes().length });
    if (control.disabled) break;
    control.click();
    cy = await settle();
  }
  return rounds;
};

/**
 * C5: the control moves the VIEWPORT and nothing else.
 *
 * The viewport is pushed off the fit first, because in the answer view `recenter()` re-fits
 * the whole graph — which is exactly where the layout already left it, so an unperturbed
 * reading would pass on a control that did nothing at all.
 */
const recenterLeg = async (
  cy: CyLike,
): Promise<
  Pick<
    InteractionReading,
    | 'zoomFitted'
    | 'zoomPerturbed'
    | 'zoomRecentered'
    | 'recenterMoved'
    | 'recenterRelaidOut'
    | 'recenterSelectedOnScreen'
  >
> => {
  const positions = cy.nodes().map((node) => node.position());
  const zoomFitted = cy.zoom();
  cy.zoom(zoomFitted * 0.42);
  cy.pan({ x: 0, y: 0 });
  await frame();
  const zoomPerturbed = cy.zoom();
  const panPerturbed = cy.pan();
  press(all('.search-row button')[0], 'the recenter control');
  await frame();
  const zoomRecentered = cy.zoom();
  const panRecentered = cy.pan();
  const box = canvasHost().getBoundingClientRect();
  const at = cy
    .nodes()
    .filter((node) => node.hasClass('selected'))[0]
    ?.renderedPosition();
  return {
    zoomFitted,
    zoomPerturbed,
    zoomRecentered,
    recenterMoved:
      Math.abs(zoomRecentered - zoomPerturbed) > 0.01 ||
      Math.hypot(panRecentered.x - panPerturbed.x, panRecentered.y - panPerturbed.y) > 1,
    recenterRelaidOut: cy
      .nodes()
      .map((node) => node.position())
      .filter((point, index) => {
        const was = positions[index];
        return was === undefined || Math.hypot(was.x - point.x, was.y - point.y) > 0.5;
      }).length,
    recenterSelectedOnScreen:
      at !== undefined && at.x >= 0 && at.y >= 0 && at.x <= box.width && at.y <= box.height,
  };
};

/** C7: the HTML index is the canvas's own node set, and selecting from it moves both. */
const indexLeg = async (
  cy: CyLike,
): Promise<
  Pick<
    InteractionReading,
    | 'indexEntries'
    | 'indexCanvasNodes'
    | 'indexCurrent'
    | 'indexCard'
    | 'indexChosen'
    | 'indexChosenCard'
    | 'indexChosenCanvas'
  >
> => {
  openNodeIndex();
  const entries = all('.node-index li button');
  const current = entries.filter((entry) => entry.getAttribute('aria-current') === 'true');
  const chosen = entries.find((entry) => entry.getAttribute('aria-current') !== 'true');
  const reading = {
    indexEntries: entries.length,
    indexCanvasNodes: cy.nodes().length,
    indexCurrent: current.length === 1 ? labelOf(current[0]) : `${String(current.length)} current`,
    indexCard: text('.selection-card h3'),
    indexChosen: labelOf(chosen),
  };
  press(chosen, 'a node index entry');
  const after = await settle();
  return {
    ...reading,
    indexChosenCard: text('.selection-card h3'),
    indexChosenCanvas: selectedLabel(after),
  };
};

/**
 * C6: a real pointer gesture on the canvas moves the component's selection.
 *
 * `mousedown` + `mouseup` at the node's rendered position rather than `emit('tap')`, because
 * the adapter's handler is reached through Cytoscape's own hit testing in the product, and a
 * victim off the visible box cannot be hit at all — so the victim is chosen on screen.
 */
const tapLeg = async (
  cy: CyLike,
): Promise<
  Pick<InteractionReading, 'tapNode' | 'tapCard' | 'tapCanvasSelected' | 'tapEmitted'>
> => {
  const container = canvasHost();
  const victim = cy.nodes().filter((node) => !node.hasClass('selected'))[0];
  if (victim === undefined) throw new Error('probe: the view drew no unselected node');
  const tapNode = victim.data('label');
  // Cytoscape gates every container event on `eventInContainer`: the client point must fall
  // inside the container's rect AND `e.target` must be a strict DESCENDANT of it, so an event
  // dispatched on the container itself is discarded. Scrolling the canvas into view puts the
  // point inside the layout viewport, `elementFromPoint` then resolves the layer a real cursor
  // would land on, and panning the victim under that point makes the hit deterministic — which
  // the zoom floor otherwise denies, since a floored view leaves most of a dense graph outside
  // the box entirely.
  container.scrollIntoView({ block: 'center' });
  await frame();
  const box = container.getBoundingClientRect();
  const start = victim.renderedPosition();
  const pan = cy.pan();
  cy.pan({ x: pan.x + box.width / 2 - start.x, y: pan.y + box.height / 2 - start.y });
  await frame();
  const at = victim.renderedPosition();
  const position = { clientX: box.left + at.x, clientY: box.top + at.y, bubbles: true };
  const layer = document.elementFromPoint(position.clientX, position.clientY);
  if (layer === null) throw new Error('probe: the canvas point resolved to no element');
  layer.dispatchEvent(new MouseEvent('mousedown', { ...position, button: 0, buttons: 1 }));
  layer.dispatchEvent(new MouseEvent('mouseup', { ...position, button: 0 }));
  const after = await settle();
  return {
    tapNode,
    tapCard: text('.selection-card h3'),
    tapCanvasSelected: selectedLabel(after),
    tapEmitted: emitted.at(-1) ?? '',
  };
};

/**
 * C3: the canvas highlights EXACTLY the path the panel lists, and Clear empties both.
 *
 * The target is a direct peer of the selection read off the HTML relation list, so a path
 * always exists; the path control only appears on a search result, which is why the peer's own
 * label is the query.
 */
const pathLeg = async (): Promise<
  Pick<
    InteractionReading,
    | 'pathQuery'
    | 'pathSteps'
    | 'pathCanvasNodes'
    | 'pathCanvasEdges'
    | 'pathStatus'
    | 'clearedPanel'
    | 'clearedCanvasPath'
  >
> => {
  const pathQuery = labelOf(all('.relations li button')[0]);
  await typeQuery(pathQuery);
  const action = all('.search-results li')
    .map((row) => row.querySelector('.path-action'))
    .find((candidate) => candidate !== null);
  press(action, 'a path action');
  const cy = await settle();
  const pathSteps = all('.path-panel ol li').length;
  const reading = {
    pathQuery,
    pathSteps,
    pathCanvasNodes: cy.nodes().filter((node) => node.hasClass('path')).length,
    pathCanvasEdges: cy.edges().filter((edge) => edge.hasClass('path')).length,
    pathStatus: text('.path-panel p'),
  };
  press(all('.path-panel .panel-heading button')[0], 'the path Clear control');
  const cleared = await settle();
  return {
    ...reading,
    clearedPanel: one('.path-panel') === null,
    clearedCanvasPath: cleared.elements().filter((element) => element.hasClass('path')).length,
  };
};

/** C2: a miss says so, a hit lists results, and choosing one moves card, callback and canvas. */
const searchLeg = async (): Promise<
  Pick<
    InteractionReading,
    | 'missQuery'
    | 'missResults'
    | 'missReported'
    | 'searchQuery'
    | 'searchResults'
    | 'searchChosen'
    | 'searchCard'
    | 'searchEmitted'
    | 'searchCanvasSelected'
  >
> => {
  const missQuery = 'zzzz no such concept';
  await typeQuery(missQuery);
  const miss = {
    missQuery,
    missResults: all('.search-results button.result').length,
    // The empty state is a bare paragraph where a hit renders a list, so the reading stays
    // locale-independent.
    missReported: one('.search-results > p') !== null && one('.search-results ul') === null,
  };
  openNodeIndex();
  const searchQuery = labelOf(all('.node-index li button').at(-1));
  await typeQuery(searchQuery);
  const results = all('.search-results button.result');
  // A result button carries its kind in a trailing `<small>`; the `<span>` is the label alone.
  const searchChosen = labelOf(results[0]?.querySelector('span'));
  press(results[0], 'a search result');
  const cy = await settle();
  return {
    ...miss,
    searchQuery,
    searchResults: results.length,
    searchChosen,
    searchCard: text('.selection-card h3'),
    searchEmitted: emitted.at(-1) ?? '',
    searchCanvasSelected: selectedLabel(cy),
  };
};

export interface LoadFallbackReading {
  alert: string;
  namesCause: boolean;
  retryPresent: boolean;
  recovered: string;
  rendererAfterRetry: boolean;
}

export interface PaletteFallbackReading {
  canvasError: string;
  unnamedTokens: string[];
  renderer: boolean;
  relations: number;
  nodeIndex: number;
  counts: string;
}

const api = {
  /** C1 + C2-C7 in one mount, ordered so each leg establishes its own precondition. */
  async interactions(
    view: 'concept' | 'answer',
    focus: GraphFocus | null,
    options: { emit?: boolean } = {},
  ): Promise<InteractionReading> {
    props.graphUrl = GRAPH_URL;
    props.focus = focus;
    props.onSelect = options.emit === false ? () => undefined : record;
    await remount();
    if (focus === null) {
      await activate();
    } else {
      // A focus request is the product's own activation path for an answer view.
      requested += 1;
      props.focusRequest = requested;
      await waitFor('the answer focus', () => one('.evidence-focus'));
      await waitFor('the ready header', () => one('.counts'));
    }
    const cy = await settle();
    const box = canvasHost().getBoundingClientRect();
    const opening = {
      view,
      counts: text('.counts'),
      answerView: one('.evidence-focus') !== null,
      cyNodes: cy.nodes().length,
      cyEdges: cy.edges().length,
      canvasWidth: Math.round(box.width),
      canvasHeight: Math.round(box.height),
    };
    const expandRounds = await expandLeg(cy);
    const recenter = await recenterLeg(await settle());
    const index = await indexLeg(await settle());
    const tap = await tapLeg(await settle());
    const path = await pathLeg();
    const search = await searchLeg();
    return { ...opening, expandRounds, ...recenter, ...index, ...tap, ...path, ...search };
  },

  /** C9: a bad `graphUrl` announces an alert that names the cause, and retry recovers. */
  async loadFallback(): Promise<LoadFallbackReading> {
    props.graphUrl = MISSING_URL;
    props.focus = null;
    props.onSelect = record;
    await remount();
    press(one('.activation button.primary'), 'the activation control');
    const alert = await waitFor('the load failure alert', () => {
      const element = one('.load-failure[role="alert"] p');
      return element === null ? null : (element.textContent ?? '');
    });
    const retryPresent = one('.load-failure button.primary') !== null;
    props.graphUrl = GRAPH_URL;
    await tick();
    await activate();
    await settle();
    return {
      alert: alert.replace(/\s+/gu, ' ').trim(),
      // Vite answers an unknown path with the dev-server fallback page, so the status the
      // component reports is whatever it refused — the reading requires it to carry one.
      namesCause: /\b(?:404|HTTP|JSON|Unexpected|SyntaxError|graph)\b/u.test(alert),
      retryPresent,
      recovered: text('.counts'),
      rendererAfterRetry: maybeCy(canvasHost()) !== undefined,
    };
  },

  /** C10: a palette the canvas cannot read leaves the HTML relation view carrying the graph. */
  async paletteFallback(): Promise<PaletteFallbackReading> {
    props.graphUrl = GRAPH_URL;
    props.focus = null;
    props.onSelect = record;
    await remount();
    for (const token of GRAPH_TOKENS) host.style.setProperty(token, 'initial');
    await activate();
    const canvasError = await waitFor('the canvas error notice', () => {
      const element = one('.canvas-error');
      return element === null ? null : (element.textContent ?? '');
    });
    openNodeIndex();
    return {
      canvasError: canvasError.replace(/\s+/gu, ' ').trim(),
      unnamedTokens: GRAPH_TOKENS.filter((token) => !canvasError.includes(token)),
      renderer: maybeCy(canvasHost()) !== undefined,
      relations: all('.relations li button').length,
      nodeIndex: all('.node-index li button').length,
      counts: text('.counts'),
    };
  },
};

declare global {
  interface Window {
    componentProbe: typeof api;
  }
}
window.componentProbe = api;
