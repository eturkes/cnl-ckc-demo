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
  { id: 'j6-cleaned-concepts', title: 'Clinical concept network, cleaned', unconventional: false, round: 3, premise: 'The picked network: clinical concepts joined by the relationships the rules state; example lists beside their rule; one fill, the KB’s kind.', node: 'clinical concept', edge: 'relationship labelled modal + verb, condition on the edge' },
];
