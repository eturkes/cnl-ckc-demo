import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { clinicalDifferential, referenceCorpus } from '../tools/clinical-reference.mjs';
import { verifyBag } from '../tools/kb/bag.mjs';
import { clinicalArtifacts } from '../tools/kb/clinical.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`expected one KB bag, found ${String(archives.length)}`);
const files = verifyBag(readFileSync(join(ROOT, 'kb', archives[0] as string))).files;
const reference = referenceCorpus(files);
const differential = clinicalDifferential(reference, clinicalArtifacts(files).source);
const evidence = (divergences: string[]): string => divergences.slice(0, 20).join('\n');

describe('clinical compiler differential', () => {
  it('D1: emits the independently enumerated keyed source vectors', () => {
    const producer = readFileSync(join(ROOT, 'tools', 'clinical-reference.mjs'), 'utf8');
    expect(producer.match(/\.\/kb\/clinical\.mjs/gu) ?? []).toHaveLength(1);
    expect(producer).toContain("import { parseAdviceSentence } from './kb/clinical.mjs';");
    expect(differential.D1.divergences, evidence(differential.D1.divergences)).toEqual([]);
    expect(differential.D1).toMatchObject({
      expectedRecords: 48,
      actualRecords: 48,
      expectedSites: 686,
      actualSites: 686,
    });
  });

  it('D2: preserves premise order and opaque-skolem sharing', () => {
    expect(differential.D2.divergences, evidence(differential.D2.divergences)).toEqual([]);
    expect(differential.D2).toMatchObject({ expectedPremises: 346, actualPremises: 346 });
  });
});
