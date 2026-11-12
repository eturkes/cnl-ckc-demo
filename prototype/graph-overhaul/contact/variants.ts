// The roster the contact page shows. The user's round-2 pick (j6) retired every other variant;
// their branches stay as evidence (.claude/rules/waves.md).
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
  { id: 'k1-pain-anchors', title: 'Start at the pain types', unconventional: false, round: 4, premise: 'Acute, subacute and chronic pain pinned in a row as the entry; the network arranges around them. Colour switch: role, clinical category, guideline area.', node: 'clinical concept', edge: 'relationship a rule states, condition on the line' },
  { id: 'k2-left-to-right', title: 'Read left to right', unconventional: false, round: 4, premise: 'What a condition names on the left, what clinicians act on to the right: each line reads as a sentence. Colour switch: role, clinical category, guideline area.', node: 'clinical concept', edge: 'relationship a rule states, condition on the line' },
  { id: 'k3-guided-start', title: 'Guided first view', unconventional: false, round: 4, premise: 'Opens on one pain type’s neighbourhood, one step from the full network. Colour switch: role, clinical category, guideline area.', node: 'clinical concept', edge: 'relationship a rule states, condition on the line' },
  { id: 'j6-cleaned-concepts', title: 'Clinical concept network, cleaned', unconventional: false, round: 3, premise: 'The picked network: clinical concepts joined by the relationships the rules state; example lists beside their rule; one fill, the KB’s kind.', node: 'clinical concept', edge: 'relationship labelled modal + verb, condition on the edge' },
];
