// The slice of Cytoscape the two probes beside this file read back.
//
// `src/graph/canvas.ts` exposes no renderer instance by design (`.claude/rules/graph.md`
// renderer seam), so a probe that has to see RENDERED output reads the registration Cytoscape
// leaves on its own container. Declaring that slice once is what keeps both probes free of
// `any` while the adapter keeps its narrow surface.

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface CyElement {
  id(): string;
  hasClass(name: string): boolean;
  style(name: string): string;
  style(name: string, value: string): void;
  emit(event: string): void;
}

export interface CyNode extends CyElement {
  data(name: string): string;
  position(): Point;
  renderedPosition(): Point;
  renderedBoundingBox(options?: { includeLabels?: boolean }): Box;
  _private: { rscratch: { labelWrapCachedLines?: string[] } };
}

export interface CyEdge extends CyElement {
  source(): CyNode;
  target(): CyNode;
  renderedMidpoint(): Point;
}

export interface CyCollection<T> {
  readonly [index: number]: T | undefined;
  length: number;
  map<R>(fn: (element: T) => R): R[];
  filter(fn: (element: T) => boolean): CyCollection<T>;
  forEach(fn: (element: T) => void): void;
  select(): void;
}

export interface CyLike {
  zoom(): number;
  zoom(level: number): void;
  pan(): Point;
  pan(position: Point): void;
  nodes(): CyCollection<CyNode>;
  edges(): CyCollection<CyEdge>;
  elements(): CyCollection<CyElement>;
  $(selector: string): { length: number };
  one(event: string, handler: () => void): void;
}

/** Cytoscape registers itself on its container. */
interface CyRegistered extends Element {
  _cyreg?: { cy?: CyLike };
}

/** The renderer on `container`, or `undefined` when none mounted — which C10 requires. */
export const maybeCy = (container: Element): CyLike | undefined =>
  (container as CyRegistered)._cyreg?.cy;

export const cyOf = (container: Element): CyLike => {
  const registered = maybeCy(container);
  if (registered === undefined) throw new Error('canvas mounted no cytoscape instance');
  return registered;
};
