// Round 4 seam: the three node colourings the user asked to compare (role, clinical category,
// guideline area), shared so every entry-point version colours alike. Fills = a palette search
// (.scratch/iterate/pal/search.py): every pair OKLab ΔE×100 ≥ 15 plain, ≥ 8 under Machado protan +
// deutan, each ≥ 3:1 against --surface-raised, per theme. Role reuses the gated --graph-* token values (src/app.css).
import { AREAS, type Guideline, type NetworkNode } from './data.js';

export interface ColourClass {
  id: string;
  label: string;
  light: string;
  dark: string;
}

export interface Colouring {
  id: 'role' | 'category' | 'area';
  label: string;
  /** Where the colour comes from, printed beside the legend. */
  source: string;
  classes: ColourClass[];
  of: (node: NetworkNode, g: Guideline) => string;
}


const ROLE: Colouring = {
  id: 'role',
  label: 'Role in the rules',
  source: 'Derived from the rules: what a condition names, what clinicians act on, or both.',
  classes: [
    { id: 'situation', label: 'Named in rule conditions', light: '#0f7558', dark: '#5fb28f' },
    { id: 'acted-on', label: 'Acted on by clinicians', light: '#734300', dark: '#e0a949' },
    { id: 'subject', label: 'Subject of a statement', light: '#342a36', dark: '#d4d1d7' },
    { id: 'several', label: 'Several roles', light: '#792d74', dark: '#eb8ed0' },
  ],
  of: (n) => (n.roles.length > 1 ? 'several' : (n.roles[0] ?? 'acted-on')),
};

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

const AREA: Colouring = {
  id: 'area',
  label: 'Guideline area',
  source: 'The guideline’s four clinical areas (its BOX 3), reached through the recommendations that use each concept.',
  classes: [
    ...AREAS.map((a, i) => ({ id: a.id, label: a.label, light: ['#009c89', '#6f046c', '#254e00', '#d55c13'][i] ?? '', dark: ['#4aa494', '#ffcaf9', '#d0ee5f', '#ef8600'][i] ?? '' })),
    { id: 'several', label: 'Used in several areas', light: '#9769dc', dark: '#a376e9' },
  ],
  of: (n, g) => {
    const recs = new Set(n.rules.map((k) => g.documents.find((d) => d.id === k.slice(0, k.lastIndexOf(':')))?.rec));
    const hit = AREAS.filter((a) => a.recs.some((r) => recs.has(r)));
    return hit.length === 1 ? (hit[0]?.id ?? 'several') : 'several';
  },
};

export const COLOURINGS: readonly Colouring[] = [ROLE, CATEGORY, AREA];

/** The fill for a node under one colouring and theme. */
export const fillOf = (c: Colouring, n: NetworkNode, g: Guideline, theme: 'light' | 'dark') => {
  const cls = c.classes.find((x) => x.id === c.of(n, g)) ?? c.classes.at(-1);
  return cls === undefined ? '#0f7558' : cls[theme];
};
