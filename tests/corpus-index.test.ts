// d43: the corpus browser's document list is every evidence document's own id, label and coverage
// region — re-read here from each shipped document chunk, never from the index's producer.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseCorpusIndex, parseEvidenceDocument } from '../src/provenance/model.js';

const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const read = (path: string): unknown => JSON.parse(readFileSync(join(GENERATED, path), 'utf8'));

describe('corpus index', () => {
  it('lists every evidence document once, in id order, with its own label and region', () => {
    const index = parseCorpusIndex(read('provenance/corpus-index.json'));
    const manifest = read('kb-manifest.json') as { contract: { documents: number } };
    const documents = readdirSync(join(GENERATED, 'provenance', 'documents'))
      .map((name) => name.replace(/\.json$/u, ''))
      .sort();
    expect(index).toHaveLength(manifest.contract.documents);
    expect(index.map((row) => row.id)).toEqual(documents);
    for (const row of index) {
      const evidence = parseEvidenceDocument(read(`provenance/documents/${row.id}.json`), row.id);
      expect(row, row.id).toEqual({
        id: evidence.id,
        label: evidence.label,
        region: {
          id: evidence.region.id,
          page: evidence.region.page,
          section: evidence.region.section,
        },
      });
    }
  });

  it('refuses a malformed row rather than listing it', () => {
    const index = read('provenance/corpus-index.json') as { documents: { label: string }[] };
    const first = index.documents[0];
    if (first === undefined) throw new Error('corpus index is empty');
    first.label = 'approved-ish';
    expect(() => parseCorpusIndex(index)).toThrow(
      'corpus index document 0 has an unknown review label',
    );
    expect(() => parseCorpusIndex({ schemaVersion: 2, documents: [] })).toThrow(
      'unsupported schema',
    );
    const twin = read('provenance/corpus-index.json') as { documents: unknown[] };
    twin.documents.push(twin.documents[0]);
    expect(() => parseCorpusIndex(twin)).toThrow(
      `corpus index document ${String(twin.documents.length - 1)} repeats cdc2022-opioid-rec01`,
    );
  });
});
