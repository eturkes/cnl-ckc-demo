import { expect, it } from 'vitest';

import type { CatalogEntry } from '../src/questions/catalog.js';
import { serializeAnswer } from '../src/questions/serialize.js';
import { catalogRecords as clinicalCatalog } from '../tools/kb/catalog.mjs';
import { catalogRecords as legacyCatalog } from './m5-legacy-catalog.probe.mjs';
import { bagFiles, bagText, boot, solve } from './m5-probe-support.js';

const files = bagFiles();
const exported = legacyCatalog(files).records.filter(({ provenance }) => provenance === 'bag-exported');
const committedResult = (id: string): string => {
  const text = bagText(files, `/answers/${id}.pl`);
  const open = text.indexOf('result(') + 'result('.length;
  if (open < 'result('.length) throw new Error(`${id}: result/1 missing`);
  let depth = 1;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(open, i);
    }
  }
  throw new Error(`${id}: result/1 unbalanced`);
};

it('chk.oracle: all four independent bag answer bytes pass against the real image', async () => {
  const session = await boot();
  const measurements = [];
  for (const record of exported) {
    const solutions = await solve(session, record.goal);
    // Serialization consumes id/projection only; these diagnostic ids stay out of the UI catalog.
    const live = serializeAnswer(record as unknown as CatalogEntry, solutions);
    const expected = committedResult(record.id);
    expect(live, record.id).toBe(expected);
    measurements.push({ id: record.id, solutions: solutions.length, bytes: Buffer.byteLength(live) });
  }
  expect(exported).toHaveLength(4);
  expect(clinicalCatalog(files).records).toHaveLength(7);
  console.log(JSON.stringify(measurements));
  // Negative control = remove a shared semantic dependency, not query or answer fixtures.
  await solve(session, 'dynamic(guideline_entity/4), retractall(guideline_entity(_,_,_,_))');
  for (const record of exported) {
    const live = serializeAnswer(record as unknown as CatalogEntry, await solve(session, record.goal));
    expect(() => expect(live).toBe(committedResult(record.id)), `${record.id}:dependency mutation`).toThrow();
  }
  console.log('legacy oracle dependency controls = 4/4 RED; no curated answer claim made');
}, 120_000);

it('chk.exported: declared bag query set stays separate from the seven curated topics', () => {
  const guardedCatalog = (candidate: Map<string, Uint8Array>) => {
    legacyCatalog(candidate);
    return clinicalCatalog(candidate);
  };
  expect(guardedCatalog(files).records).toEqual(clinicalCatalog(files).records);
  const path = [...files.keys()].find((name) => name.endsWith('/queries/pl/dosage-reduction-content.pl'));
  if (path === undefined) throw new Error('exported query missing');
  const source = Buffer.from(files.get(path) as Uint8Array).toString('utf8');
  const cases = ['extra', 'missing', 'renamed', 'duplicate'] as const;
  for (const mutation of cases) {
    const mutant = new Map(files);
    if (mutation === 'missing' || mutation === 'renamed') mutant.delete(path);
    if (mutation !== 'missing') {
      mutant.set(path.replace('dosage-reduction-content.pl', 'zz-probe-question.pl'), Buffer.from(
        mutation === 'duplicate' ? source : source.replaceAll('dosage-reduction-content', 'zz-probe-question'),
      ));
    }
    expect(() => clinicalCatalog(mutant), `${mutation}:today ignores queries`).not.toThrow();
    expect(() => guardedCatalog(mutant), `${mutation}:restored guard`).toThrow(/expected \[|duplicate query ids/u);
  }
  console.log('EXPORTED guard = baseline 4 ids accepted; extra/missing/renamed/duplicate 4/4 RED; curated catalog ignores all 4 mutants');
}, 120_000);
