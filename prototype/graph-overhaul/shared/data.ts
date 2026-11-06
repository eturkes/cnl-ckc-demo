// Shared seam for every graph-overhaul variant: the guideline data + the page harness.
// Variants import from here; edits here reach every variant, so they are MAIN's alone.

export type Modal = 'should' | 'may' | 'can' | 'must' | 'fact';

export interface Sentence {
  n: number;
  ace: string;
  /** Text-level split of the ACE sentence (prototype heuristic, not the KB's parse). */
  condition: string | null;
  conclusion: string;
  modal: Modal;
  negated: boolean;
}

export interface Doc {
  id: string;
  /** Recommendation number 1–12, null for guideline-wide text (scope, methods, populations). */
  rec: number | null;
  kind: 'recommendation' | 'implementation' | 'supporting';
  section: string;
  page: number;
  region: string;
  /** Verbatim guideline text this document encodes. */
  source: string;
  sentences: Sentence[];
}

export interface Recommendation {
  id: string;
  number: number;
  page: number;
  source: string;
  grade: { category: 'A' | 'B'; evidenceType: number } | null;
  implementation: string[];
  supporting: string[];
}

export interface Action {
  polarity: 'positive' | 'negative';
  verb: string;
  object: string;
  modifiers: { preposition: string; value: string }[];
  qualifiers: unknown[];
}

/** The clinical layer's own parse of one recommendation sentence. */
export interface Rule {
  document: string;
  sentence: number;
  original: string;
  condition?: string;
  subject: string;
  mode: Modal;
  form?: string;
  actions: Action[];
}

export interface Question {
  id: string;
  question: string;
  /** The Prolog goal the shipped demo runs live for this question. */
  goal: string;
  /** The statements the answer derives, in answer order. */
  statements: { document: string; sentence: number }[];
  documents: string[];
}

export interface Exclusion {
  key: string;
  document: string;
  sentence: number;
  line: number;
  ace: string;
}

export interface Supersession {
  document: string;
  sentence: number;
  line: number;
  ace: string;
  citation: string;
  url: string;
  /** yyyymmdd */
  date: number;
}

export interface Concept {
  id: string;
  label: string;
  kind: 'entity' | 'event' | 'value';
  /** `<document>:<sentence>` keys of every sentence that mentions the concept. */
  mentions: string[];
}

/** A clinical concept of the i1 network (`network.mjs`): a situation a rule anchors on or a thing acted on. */
export interface NetworkNode {
  id: string;
  label: string;
  roles: ('situation' | 'acted-on' | 'subject')[];
  /** `<document>:<sentence>` keys of the rules it takes part in. */
  rules: string[];
}

/** One action of one clinical rule: source —verb→ target, the rest of the condition in `when`. */
export interface NetworkEdge {
  id: string;
  rule: string;
  rec: number | null;
  source: string;
  target: string;
  verb: string;
  detail: string;
  when: string[];
  modal: Modal;
  negative: boolean;
}

export interface Guideline {
  bag: string;
  derivation: string;
  pdf: string;
  recommendations: Recommendation[];
  documents: Doc[];
  rules: Rule[];
  questions: Question[];
  exclusions: Exclusion[];
  supersessions: Supersession[];
  concepts: Concept[];
  network: { nodes: NetworkNode[]; edges: NetworkEdge[] };
  counts: Record<string, number>;
}

/**
 * The four clinical areas the guideline PDF's BOX 3 groups the twelve recommendations under.
 * Hard-coded from the PDF (p. 13): the KB carries no area record — prototype shortcut.
 */
export const AREAS = [
  { id: 'initiate', label: 'Determining whether or not to initiate opioids for pain', recs: [1, 2] },
  { id: 'select', label: 'Selecting opioids and determining opioid dosages', recs: [3, 4, 5] },
  { id: 'duration', label: 'Deciding duration of initial opioid prescription and conducting follow-up', recs: [6, 7] },
  { id: 'harms', label: 'Assessing risk and addressing potential harms of opioid use', recs: [8, 9, 10, 11, 12] },
] as const;

export const loadGuideline = async (): Promise<Guideline> => {
  const response = await fetch(new URL('../generated/guideline.json', import.meta.url));
  if (!response.ok) throw new Error('Run node prototype/graph-overhaul/derive.mjs first');
  return (await response.json()) as Guideline;
};

/** Index helpers every variant needs. */
export const indexGuideline = (g: Guideline) => {
  const docs = new Map(g.documents.map((d) => [d.id, d]));
  const rules = new Map(g.rules.map((r) => [`${r.document}:${r.sentence}`, r]));
  const sentence = (key: string): Sentence | undefined => {
    const at = key.lastIndexOf(':');
    return docs.get(key.slice(0, at))?.sentences.find((s) => s.n === Number(key.slice(at + 1)));
  };
  return { docs, rules, sentence };
};

/**
 * Page harness. URL hash = the state the capture script drives:
 *   #overview | #trace=<question id> | #rule=<document>:<sentence> | #explore=<search text>
 * `?theme=dark` sets the theme. Call `markReady()` once a state has rendered and settled.
 */
export type HashState =
  | { view: 'overview' }
  | { view: 'trace'; question: string }
  | { view: 'rule'; document: string; sentence: number }
  | { view: 'explore'; query: string };

export const readHash = (): HashState => {
  const [key = '', raw = ''] = location.hash.slice(1).split('=');
  const value = decodeURIComponent(raw);
  if (key === 'trace' && value) return { view: 'trace', question: value };
  if (key === 'explore') return { view: 'explore', query: value };
  if (key === 'rule' && value.includes(':')) {
    const at = value.lastIndexOf(':');
    return { view: 'rule', document: value.slice(0, at), sentence: Number(value.slice(at + 1)) };
  }
  return { view: 'overview' };
};

export const writeHash = (state: HashState): void => {
  const next =
    state.view === 'trace'
      ? `#trace=${state.question}`
      : state.view === 'rule'
        ? `#rule=${state.document}:${String(state.sentence)}`
        : state.view === 'explore'
          ? `#explore=${encodeURIComponent(state.query)}`
          : '#overview';
  if (location.hash !== next) history.replaceState(null, '', next);
};

export const applyTheme = (): void => {
  const theme = new URLSearchParams(location.search).get('theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
};

/** Signals the capture script that the current hash state has rendered. */
export const markReady = (): void => {
  document.body.dataset.ready = location.hash || '#overview';
};
