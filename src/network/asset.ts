// The two network assets as the page reads them: the clinical network (`tools/kb/network.mjs`,
// contract `.agent/contracts/g2.md`) and its build-time layout (`tools/kb/layout.mjs`, `g4.md`).
// Fields the page does not read stay out; the producers own the full shapes.

export type DocumentKind = 'recommendation' | 'implementation' | 'supporting';

export interface NetworkConcept {
  readonly id: string;
  readonly label: string;
  /** A codebook class, or null for the coders' `none`. */
  readonly class: string | null;
}

export interface NetworkClass {
  readonly id: string;
  /** A class with its own fill (`--concept-<id>`); the rest share `--concept-other`. */
  readonly filled: boolean;
}

export interface NetworkLine {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly reading: string;
  readonly kind: DocumentKind;
  readonly superseded: boolean;
  readonly guarded: boolean;
  readonly occurrences: readonly string[];
}

export interface NetworkLoop {
  readonly id: string;
  readonly concept: string;
  readonly reading: string;
  readonly kind: DocumentKind;
  readonly superseded: boolean;
  readonly guarded: boolean;
  readonly occurrences: readonly string[];
}

export interface NetworkAsset {
  readonly schemaVersion: 1;
  readonly envelope: Readonly<Record<string, string>>;
  readonly classes: readonly NetworkClass[];
  readonly concepts: readonly NetworkConcept[];
  readonly lines: readonly NetworkLine[];
  readonly loops: readonly NetworkLoop[];
}

export interface LayoutNode {
  readonly id: string;
  /** Model px. */
  readonly x: number;
  readonly y: number;
  /** The label's lines, as HarfBuzz wrapped them. */
  readonly label: readonly string[];
  readonly W: number;
  readonly H: number;
  readonly reveal: number;
  readonly degree: number;
  readonly component: number;
}

export interface LayoutBlock {
  readonly id: string;
  /** Each loop reading's own lines. */
  readonly readings: readonly (readonly string[])[];
  readonly W: number;
  readonly H: number;
}

export interface LayoutAsset {
  readonly schemaVersion: 1;
  readonly envelope: {
    readonly digest: string;
    readonly parts: Readonly<Record<string, string>>;
    /** The network asset's own envelope: the page draws only when the two agree. */
    readonly network: Readonly<Record<string, string>>;
  };
  /** Priority order: the anchors, then line degree descending, then id. */
  readonly nodes: readonly LayoutNode[];
  readonly blocks: readonly LayoutBlock[];
  /** Every concept and rule focus view: `[id, x, y]` at zoom 1, the subject (else the first id) at the origin. */
  readonly focus: Readonly<Record<string, readonly (readonly [string, number, number])[]>>;
}

export interface NetworkScene {
  readonly network: NetworkAsset;
  readonly layout: LayoutAsset;
}
