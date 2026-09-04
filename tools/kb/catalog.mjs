// Clinician-facing catalog generated from the verified bag.
//
// `clinicalArtifacts` owns the deliberately curated question topics, but every
// answer statement and source coordinate is re-read from the bag on each build.
// The resulting goals query the `clinical_advice/3` facts compiled into the PVM.

import { clinicalArtifacts } from './clinical.mjs';

/**
 * @param {Map<string, Uint8Array>} files
 * @returns {{ records: ReturnType<typeof clinicalArtifacts>['records'], names: string[], source: string }}
 */
export const catalogRecords = (files) => {
  const { records, names, source } = clinicalArtifacts(files);
  return { records, names, source };
};

/** @param {ReturnType<typeof clinicalArtifacts>['records']} records */
export const catalogJson = (records) =>
  `${JSON.stringify({ catalogVersion: 3, entries: records }, undefined, 2)}\n`;
