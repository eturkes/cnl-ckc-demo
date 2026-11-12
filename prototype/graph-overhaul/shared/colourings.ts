// Node colouring: the clinical category (user ruling, round 4; role + guideline area retired with
// k1–k3, branches wt/builder-37…39). Fills: every pair OKLab ΔE×100 ≥ 15 plain, ≥ 8 under Machado
// protan + deutan, each ≥ 3:1 against --surface-raised, per theme — checked by hand with coloraide
// (commit d28eff7 body); IMPLEMENT moves them under `pnpm palette:check`.
import type { Guideline, NetworkNode } from './data.js';

export interface ColourClass {
  id: string;
  label: string;
  light: string;
  dark: string;
}

export interface Colouring {
  id: 'category';
  label: string;
  /** Where the colour comes from, printed beside the legend. */
  source: string;
  classes: ColourClass[];
  of: (node: NetworkNode, g: Guideline) => string;
}


/** Hand-made: the KB states no clinical classes. Printed on the page as the prototype's reading. */
const CATEGORY_OF: Record<string, string> = Object.fromEntries(
  Object.entries({
    condition: ['acute-pain', 'subacute-pain', 'chronic-pain', 'opioid-use-disorder'],
    opioid: [
      'opioid-therapy', 'opioid', 'immediate-release-opioid', 'lowest-effective-dosage', 'opioid-dosage',
      'opioid-quantity', 'dosage-escalation', 'opioid-initiation', 'continued-opioid-therapy',
      'initial-opioid-therapy', 'chronic-opioid-therapy', 'opioid-therapy-initiation',
      'opioid-pain-medication', 'insufficient-benefit-discontinuation-plan',
    ],
    nonopioid: [
      'nonopioid-therapy', 'nonpharmacologic-therapy', 'nonopioid-pharmacologic-therapy', 'different-therapy',
      'evidence-based-medication-treatment', 'medication-free-detoxification',
    ],
    substance: [
      'benzodiazepine', 'central-nervous-system-depressant', 'prescribed-medication',
      'prescribed-controlled-substance', 'nonprescribed-controlled-substance',
    ],
    weighing: [
      'realistic-benefit', 'known-risk', 'individual-benefit', 'individual-risk', 'opioid-benefit', 'opioid-risk',
      'opioid-related-harm', 'high-overdose-risk', 'testing-benefit', 'testing-risk', 'overdose', 'overdose-death',
      'drug-use-resumption', 'at-least-opioid-equal-common-acute-pain-effectiveness', 'pain-goal', 'function-goal',
      'benefit', 'risk',
    ],
    safeguard: ['toxicology-testing', 'controlled-substance-prescription-history', 'naloxone-dose', 'risk-mitigation-strategy'],
  }).flatMap(([cls, ids]) => ids.map((id) => [id, cls])),
);

const CATEGORY: Colouring = {
  id: 'category',
  label: 'Clinical category',
  source: 'This prototype’s reading, made by hand: the knowledge base states no clinical categories.',
  classes: [
    { id: 'condition', label: 'Patient condition', light: '#770055', dark: '#e698df' },
    { id: 'opioid', label: 'Opioid treatment and dosing', light: '#0050a0', dark: '#6b89f9' },
    { id: 'nonopioid', label: 'Other treatment', light: '#009a9a', dark: '#00aa95' },
    { id: 'substance', label: 'Other medicines and substances', light: '#664f00', dark: '#ffda74' },
    { id: 'weighing', label: 'Benefits, risks, harms and goals', light: '#d55c13', dark: '#d57700' },
    { id: 'safeguard', label: 'Tests and safeguards', light: '#9769dc', dark: '#34ffe2' },
  ],
  of: (n) => CATEGORY_OF[n.id] ?? 'weighing',
};

export const COLOURINGS: readonly Colouring[] = [CATEGORY];

/** The fill for a node under one colouring and theme. */
export const fillOf = (c: Colouring, n: NetworkNode, g: Guideline, theme: 'light' | 'dark') => {
  const cls = c.classes.find((x) => x.id === c.of(n, g)) ?? c.classes.at(-1);
  return cls === undefined ? '#0f7558' : cls[theme];
};
