import { loadEvidenceDocument } from '../../../../src/provenance/assets';

export const GOAL = `(guideline_supersession(Document,Sentence,source(Citation,Url),Date), sub_atom_icasechk(Document,0,'cdc2022-opioid-rec12-'), Kind = supersession ; clause(guideline_exclusion('cdc-2022-opioid'),Body), Kind = exclusion)`;

const scalar = (term: any) => term?.value ?? '';
const compounds = (term: any): any[] => term?.kind === 'compound' ? [term, ...term.args.flatMap(compounds)] : [];
const readable = (text: string) => text.replaceAll('-', ' ');

export async function loadGuardRecords(demo: any) {
  const outcome = await demo.runGoal(GOAL);
  if (outcome?.kind !== 'solutions') return { goal: GOAL, error: JSON.stringify(outcome), returned: 0 };
  const superseded = [];
  const exclusions = [];
  let rawExclusions = 0;
  for (const solution of outcome.solutions) {
    const b = solution.bindings;
    if (scalar(b.Kind) === 'supersession') {
      const document = await loadEvidenceDocument(scalar(b.Document));
      const text = document.ace.sentences.find(s => s.number === scalar(b.Sentence))?.text.replaceAll('-', ' ').replace('it is recommended that the clinician does not', 'the clinician should not');
      const date = String(scalar(b.Date));
      const parsed = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00Z`);
      superseded.push({ text: text ?? 'Provenance sentence unavailable', citation: scalar(b.Citation), url: scalar(b.Url), date: parsed.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }) });
    } else {
      rawExclusions++;
      const terms = compounds(b.Body);
      const nouns = terms.filter(x => x.functor === 'guideline_entity').map(x => scalar(x.args[2])).filter(x => x !== 'patient');
      const comparison = terms.find(x => x.functor === 'guideline_satisfies');
      let label = nouns.filter(x => !['pain-management-prescription','facility-discharge'].includes(x)).map(readable).join(' with ');
      if (comparison) label += ` ${scalar(comparison.args[comparison.args.length - 3])} ${scalar(comparison.args[comparison.args.length - 2])} ${scalar(comparison.args[comparison.args.length - 1])}s`;
      if (nouns.includes('pain-management-prescription')) label += ' unless a pain management prescription at facility discharge can be proved';
      if (!exclusions.some(x => x.label === label)) exclusions.push({ label, body: solution.display.Body });
    }
  }
  exclusions.sort((a, b) => Number(!a.label.includes('pain') || a.label.includes('prescription')) - Number(!b.label.includes('pain') || b.label.includes('prescription')));
  return { superseded, exclusions, rawExclusions, goal: GOAL, returned: outcome.solutions.length };
}
