// Producer guards: what the building engine must prove before an artifact exists.
// Sources are synthesized here, so neither case depends on the vendored bag.

import { describe, expect, it } from 'vitest';

import { buildImage, saveDiagnostics } from '../tools/kb/produce.mjs';

const BOOT_TIMEOUT = 120_000;
const DOCUMENT = (id: string): string => `guideline_document(${id},title,2022).\n`;

/** The exact shape `payloadSource` emits: one `% file:` marker per payload document. */
const payload = (bodies: string[]): string =>
  bodies.map((body, index) => `\n% file:data/guidelines/g/pl/doc${index}.pl\n${body}`).join('\n');

describe('image build', () => {
  it(
    'refuses a corpus that loads fewer documents than it fed',
    async () => {
      const short = payload(['guideline_schema_version(1).\n', DOCUMENT('a')]);
      await expect(buildImage(short)).rejects.toThrow(
        'image build: engine reported 1 documents, build fed 2 payload files',
      );
    },
    BOOT_TIMEOUT,
  );

  it(
    'saves when every fed file reports its document',
    async () => {
      const whole = payload([`guideline_schema_version(1).\n${DOCUMENT('a')}`, DOCUMENT('b')]);
      const { image, contract } = await buildImage(whole);
      expect(contract.documents).toBe(2);
      expect(image.byteLength).toBeGreaterThan(0);
    },
    BOOT_TIMEOUT,
  );
});

describe('save diagnostics', () => {
  it('tolerates the two qsave shlib warnings and nothing else', () => {
    expect(
      saveDiagnostics([
        'Warning: [Thread main] /swipl/library/qsave.pl:47: \n',
        'Warning: [Thread main]   library(shlib): No such file\n',
      ]),
    ).toEqual([]);
    expect(saveDiagnostics(['ERROR: /swipl/library/qsave.pl:99: cannot write state\n'])).toEqual([
      'ERROR: /swipl/library/qsave.pl:99: cannot write state',
    ]);
    expect(saveDiagnostics(['ERROR: library(shlib) refused\n'])).toEqual([
      'ERROR: library(shlib) refused',
    ]);
  });

  it('judges each line of a multi-line chunk on its own', () => {
    expect(saveDiagnostics(['Warning: qsave.pl:1: \nERROR: qsave.pl:2: boom\n'])).toEqual([
      'ERROR: qsave.pl:2: boom',
    ]);
  });
});
