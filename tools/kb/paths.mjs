// Shared locations and the one canonical definition of the engine's build input.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { clinicalArtifacts } from './clinical.mjs';
import { payloadDocuments, payloadSchema, SCHEMA_PATH } from './payload.mjs';
import { PROOF_SOURCE } from './proof.mjs';
import { READONLY_SOURCE } from './readonly-arithmetic.mjs';

/** @typedef {import('../../src/kb/manifest.ts').KbManifest} KbManifest */

export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const GENERATED_DIR = join(ROOT, 'kb', 'generated');
export const MANIFEST_PATH = join(GENERATED_DIR, 'kb-manifest.json');

/**
 * Concatenate the payload into the exact string the engine consults.
 *
 * Order is the sorted member path, fixed here so the input digest identifies the
 * build input completely. The `% file:` markers keep engine diagnostics traceable
 * to a source document.
 *
 * @param {Map<string, Uint8Array>} files bag-relative path → bytes
 * @returns {{ source: string, names: string[] }}
 */
export const payloadSource = (files) => {
  const { source: documents, names } = payloadDocuments(files);
  const clinical = clinicalArtifacts(files);
  // Append after every marked document so their combined line keys never move
  // when the schema or any helper evolves. The markers are intentionally not
  // `% file:`: build validation counts those markers as payload documents.
  const source =
    `${documents}\n\n% schema:${SCHEMA_PATH}\n${payloadSchema(files)}` +
    `\n% helper:clinical-advice\n${clinical.helper}` +
    `\n% helper:selected-solution-proof\n${PROOF_SOURCE}` +
    `\n% helper:read-only-arithmetic\n${READONLY_SOURCE}`;
  return { source, names };
};

/** @returns {KbManifest | undefined} the manifest on disk, or undefined when absent or unreadable */
export const loadManifest = () => {
  try {
    // `JSON.parse` is typed `any`; routing it through `unknown` keeps the cast to
    // the manifest type an explicit, checkable claim.
    const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
    return /** @type {KbManifest} */ (parsed);
  } catch {
    return undefined;
  }
};
