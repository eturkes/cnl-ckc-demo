// Canonical concatenation of the bag's compiled Prolog documents.
//
// Helpers are appended elsewhere so the line numbers in this string remain the
// exact `clause_property/2` lines used by provenance and selected-answer proofs.

/** Compiled-Prolog payload members, the only bag documents the runtime image carries. */
const PAYLOAD = /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u;

/**
 * @param {Map<string, Uint8Array>} files
 * @returns {{ source: string, names: string[] }}
 */
export const payloadDocuments = (files) => {
  const names = [...files.keys()].filter((name) => PAYLOAD.test(name)).sort();
  if (names.length === 0) throw new Error('bag carries no compiled Prolog payload');
  const source = names
    .map((name) => {
      const text = Buffer.from(/** @type {Uint8Array} */ (files.get(name))).toString('utf8');
      return `\n% file:${name}\n${text}`;
    })
    .join('\n');
  return { source, names };
};
