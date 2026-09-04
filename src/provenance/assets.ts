import pdfUrl from '@kb/provenance/guideline.pdf?url&no-inline';

import { parseEvidenceDocument, type EvidenceDocument } from './model.js';

const urls = import.meta.glob<string>('@kb/provenance/documents/*.json', {
  eager: true,
  import: 'default',
  query: '?url&no-inline',
});

const byId = new Map(
  Object.entries(urls).map(([path, url]) => {
    const id = /\/([^/]+)\.json$/u.exec(path)?.[1];
    if (id === undefined) throw new Error(`unrecognised provenance asset path: ${path}`);
    return [id, url] as const;
  }),
);

export const guidelinePdfUrl = pdfUrl;

export const hasEvidenceDocument = (id: string): boolean => byId.has(id);

export const loadEvidenceDocument = async (
  id: string,
  signal?: AbortSignal,
): Promise<EvidenceDocument> => {
  const url = byId.get(id);
  if (url === undefined) throw new Error(`No provenance asset exists for ${id}.`);
  const response = await fetch(url, signal === undefined ? undefined : { signal });
  if (!response.ok) throw new Error(`Provenance request returned HTTP ${String(response.status)}.`);
  return parseEvidenceDocument(await response.json(), id);
};
