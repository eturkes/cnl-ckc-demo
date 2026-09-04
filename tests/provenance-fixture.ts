import type { EvidenceDocument } from '../src/provenance/model.js';

export const EVIDENCE_FIXTURE: EvidenceDocument = {
  schemaVersion: 1,
  id: 'cdc2022-opioid-rec01-imp01',
  label: 'unreviewed',
  region: {
    id: 'S42-1',
    sourceFile: 'source/example.txt',
    page: 42,
    section: 'Example section',
  },
  source: { text: 'A 💊 dose.' },
  ace: { text: 'Dose.', sentences: [{ number: 1, text: 'Dose.' }] },
  alignment: {
    unit: 'unicode-code-point',
    spans: [
      { group: 7, side: 'source', start: 4, end: 8, text: 'dose' },
      { group: 7, side: 'ace', start: 0, end: 4, text: 'Dose' },
    ],
  },
  projection: { kept: 'the dose relation', dropped: 'the example qualifier' },
  clauses: [
    {
      line: 77,
      sentence: 1,
      predicate: 'guideline_property',
      arity: 5,
      kind: 'fact',
      text: "guideline_property('$guideline_id'(cdc2022_opioid_rec01_imp01,1,a),dose,example,none,none).",
    },
  ],
};
