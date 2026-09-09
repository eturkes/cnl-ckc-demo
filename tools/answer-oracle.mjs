// The canonical answer bytes a browser must render, derived in Node from the vendored bag.
//
// Independent of the page under test: nothing here reads `dist/`, the question catalog, or
// any committed fixture the app also loads. The producer assembles the answer terms in
// JavaScript from bag bytes; the page derives them by Prolog over the compiled image. Two
// code paths over one input is what makes the byte comparison an oracle rather than a
// tautology. The producer's own oracle is itself graded — against an independent reassembly
// by `clinical-differential` D4, and against the live derivation by `clinical-answer-live` A2.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { verifyBag } from './kb/bag.mjs';
import { clinicalArtifacts } from './kb/clinical.mjs';
import { ROOT } from './kb/paths.mjs';

/** The option ids the combobox renders: `<listbox>-option-<question id>`. */
const OPTION_ID = /-option-([a-z0-9-]+)$/u;

/**
 * @param {(message: string) => never} fail
 * @returns {Map<string, Uint8Array>} bag-relative path → bytes
 */
const vendoredBag = (fail) => {
  const kb = join(ROOT, 'kb');
  const archives = readdirSync(kb).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) fail(`expected one vendored bag in kb/, found ${archives.length}`);
  return verifyBag(readFileSync(join(kb, /** @type {string} */ (archives[0])))).files;
};

/**
 * The canonical answer for one catalog question, in the bag's `result/1` grammar.
 *
 * Rows sort as text because every projected value here is a `clinical_answer/3` term whose
 * first argument is a quoted document id — lexical order and SWI standard order agree on
 * that shape, and `serialize.ts` sorts the live rows by standard order.
 *
 * @param {string} id catalog question id
 * @param {(message: string) => never} fail
 * @returns {{ serialized: string, rows: number }}
 */
export const expectedAnswer = (id, fail) => {
  const terms = clinicalArtifacts(vendoredBag(fail)).answers.get(id);
  if (terms === undefined || terms.length === 0) fail(`clinical catalog has no answer for ${id}`);
  const rows = [.../** @type {string[]} */ (terms)].sort().map((term) => `sol([${term}])`);
  return { serialized: `solutions([${rows.join(',')}])`, rows: rows.length };
};

/** `clinical_answer('<document>',[…],"…")` — the cited document is the leading quoted atom. */
const ANSWER_DOCUMENT = /^clinical_answer\('([^']+)'/u;

/**
 * The documents each catalog question's answer cites, in answer order.
 *
 * Derived from the same bag terms as `expectedAnswer`, so the contribution set stays a
 * reading of the knowledge base rather than a list somebody keeps in step by hand.
 *
 * @param {(message: string) => never} fail
 * @returns {Map<string, string[]>} question id → cited document ids
 */
export const answerDocuments = (fail) => {
  const artifacts = clinicalArtifacts(vendoredBag(fail));
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (const [id, terms] of artifacts.answers) {
    const documents = terms.map((term) => {
      const document = ANSWER_DOCUMENT.exec(term)?.[1];
      if (document === undefined)
        fail(`${id}: answer term cites no document: ${term.slice(0, 60)}`);
      return /** @type {string} */ (document);
    });
    out.set(id, documents);
  }
  return out;
};

/**
 * The question id a rendered combobox option stands for.
 *
 * Reading the id off the DOM keeps the oracle bound to whatever the page selected, and keeps
 * the selection itself locale-independent — the accessible name of an option is translated,
 * its id is not.
 *
 * @param {string | null} optionId the option element's `id` attribute
 * @param {(message: string) => never} fail
 * @returns {string}
 */
export const questionOf = (optionId, fail) => {
  const id = OPTION_ID.exec(optionId ?? '')?.[1];
  if (id === undefined) fail(`combobox option carries no question id: ${String(optionId)}`);
  return /** @type {string} */ (id);
};
