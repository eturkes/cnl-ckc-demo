// Shared locations and the one canonical definition of the engine's build input.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROOF_SOURCE } from './proof.mjs';

/** @typedef {import('../../src/kb/manifest.ts').KbManifest} KbManifest */

export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const GENERATED_DIR = join(ROOT, 'kb', 'generated');
export const MANIFEST_PATH = join(GENERATED_DIR, 'kb-manifest.json');

/** Compiled-Prolog payload members, the only bag content the runtime image carries. */
const PAYLOAD = /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/;

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
  const names = [...files.keys()].filter((name) => PAYLOAD.test(name)).sort();
  if (names.length === 0) throw new Error('bag carries no compiled Prolog payload');
  const documents = names
    .map((name) => {
      const text = Buffer.from(/** @type {Uint8Array} */ (files.get(name))).toString('utf8');
      return `\n% file:${name}\n${text}`;
    })
    .join('\n');
  // Append after every marked document so their combined line keys never move
  // when the helper evolves. The helper marker is intentionally not `% file:`:
  // build validation counts those markers as payload documents.
  const source = `${documents}\n\n% helper:selected-solution-proof\n${PROOF_SOURCE}`;
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
