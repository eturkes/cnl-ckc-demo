export const SITUATIONS = [
  { id: 'acute-pain', label: 'Acute pain', terms: ['acute-pain'] },
  { id: 'subacute-pain', label: 'Subacute pain', terms: ['subacute-pain'] },
  { id: 'chronic-pain', label: 'Chronic pain', terms: ['chronic-pain'] },
  { id: 'opioid-therapy', label: 'Receiving or continuing opioid therapy', terms: ['chronic-opioid-therapy'], therapy: true },
  { id: 'opioid-use-disorder', label: 'Opioid use disorder', terms: ['opioid-use-disorder'] },
  { id: 'co-prescribing', label: 'Opioids with benzodiazepines or CNS depressants', terms: ['benzodiazepine', 'central-nervous-system-depressant'] },
];
const word = (s, t) => new RegExp(`(?:^|[^a-z-])${t}(?:$|[^a-z-])`, 'u').test(s);
export function journeys(g) {
  const byRule = new Map(g.rules.map(r => [`${r.document}:${r.sentence}`, r]));
  const matches = (s, r, e) => {
    const c = r?.condition ?? '';
    return s.terms.some(t => word(c, t) || e.source === t || e.target === t) ||
      (s.therapy && /(?:patient (?:that )?(?:receives|continues)|patient that receives) an? opioid-therapy/u.test(c));
  };
  const assigned = new Set();
  const panels = SITUATIONS.map(s => {
    const edges = g.network.edges.filter(e => matches(s, byRule.get(e.rule), e));
    edges.forEach(e => assigned.add(e.id));
    return { ...s, edges };
  });
  panels.push({ id: 'other', label: 'No selected situation named', edges: g.network.edges.filter(e => !assigned.has(e.id)) });
  return panels.map(s => ({...s, groups: [...new Set(s.edges.map(e => e.rec))].sort((a,b)=>a-b).map(rec => ({
    id: `${s.id}:${rec}`, rec, edges: s.edges.filter(e=>e.rec===rec),
    verbs: [...new Set(s.edges.filter(e=>e.rec===rec).map(e=>e.modal==='fact'?'fact':`${e.modal}${e.negative?' not':''}`))].join(' / '),
  }))}));
}
