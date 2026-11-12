// The roster the contact page shows: the approved prototype alone (ITERATE close); every other
// variant retired, its branch kept as evidence (.claude/rules/waves.md).
export interface Variant {
  id: string;
  title: string;
  unconventional: boolean;
  /** ITERATE round that built it; absent = a PROTOTYPE reference form. */
  round?: number;
  premise: string;
  node: string;
  edge: string;
}

export const VARIANTS: Variant[] = [
  { id: 'm1-guided-anchors', title: 'Guided start, pain types anchored', unconventional: false, round: 5, premise: 'The user’s round-4 pick: opens on one pain type’s neighbourhood; the full network keeps the three pain types in a top row. Coloured by clinical category.', node: 'clinical concept', edge: 'relationship a rule states, condition on the line' },
];
