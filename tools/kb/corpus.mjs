// The document-first index the corpus browser lists: each evidence document's id, review label
// and coverage region, read from the same chunks the ladder resolves one at a time. Small enough
// to fetch whole, and fetched only when the reader opens the browser.

import { generatedJson } from './provenance.mjs';

export const CORPUS_INDEX_PATH = 'provenance/corpus-index.json';
export const CORPUS_SCHEMA_VERSION = 1;

/**
 * @param {unknown} value @param {string} at
 * @returns {Record<string, unknown>}
 */
const object = (value, at) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`corpus index: ${at} is not an object`);
  }
  return /** @type {Record<string, unknown>} */ (value);
};

/**
 * @param {{ model: unknown }[]} chunks the provenance chunks, as `deriveProvenance` returns them
 * @returns {{ path: string, bytes: Buffer, documents: number }}
 */
export const deriveCorpusIndex = (chunks) => {
  const documents = chunks
    .map(({ model }, index) => {
      const document = object(model, `chunk ${String(index)}`);
      const region = object(document.region, `chunk ${String(index)} region`);
      const { id, label } = document;
      if (typeof id !== 'string' || typeof label !== 'string') {
        throw new Error(`corpus index: chunk ${String(index)} carries no id or label`);
      }
      return { id, label, region: { id: region.id, page: region.page, section: region.section } };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    path: CORPUS_INDEX_PATH,
    bytes: generatedJson({ schemaVersion: CORPUS_SCHEMA_VERSION, documents }),
    documents: documents.length,
  };
};
