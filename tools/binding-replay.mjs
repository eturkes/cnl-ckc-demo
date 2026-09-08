#!/usr/bin/env node
// E11 — the differential that makes the perturbation battery load-bearing.
//
// `tests/clinical-binding.test.ts` E2 requires erasing one cited `guideline_*` clause to drop
// exactly that document from the answer set. Before u3 the answer shipped as a compiled FACT,
// so no erasure could reach it and E2 would have been red the day it was written. This
// replays that one erasure against an archived tree and against the working tree, so "red
// before u3, green now" is a command rather than a memory.
//
// Only the answer-path producer varies: `payloadSource` comes from the tree under test, while
// the bag, the image build and the loader stay the working tree's. Holding the build
// machinery fixed leaves the producer as the single variable — and the two trees ship a
// byte-identical `produce.mjs`, `payload.mjs` and `bag.mjs`, so nothing is lost by fixing it.
//
// Usage: node tools/binding-replay.mjs [<git ref>]
// Exit 0 when the archived arm is red and the working arm is green.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifyBag } from './kb/bag.mjs';
import { clinicalArtifacts } from './kb/clinical.mjs';
import { payloadSource, ROOT } from './kb/paths.mjs';
import { buildImage } from './kb/produce.mjs';

/** The tree whose `clinical_advice/3` was a compiled fact rather than a derivation. */
const DEFAULT_REF = 'a944fca';
/** First cited gate in the helper: `clinical_gate('<document>',<sentence>,_,[<line>,...])`. */
const GATE = /^clinical_gate\('([^']+)',\d+,[^,]+,\[(\d+)/mu;

/** @typedef {{ prolog: { query: (goal: string) => Iterable<unknown> } }} Queryable */

/** @param {string} message @returns {never} */
const fail = (message) => {
  console.error(`binding-replay: ${message}`);
  process.exit(1);
};

const require = createRequire(import.meta.url);

/** CommonJS interop is typed `any`; `unknown` makes the cast below explicit.
 * @param {string} specifier @returns {unknown} */
const load = (specifier) => require(specifier);

/** The archived producer arrives by path, so its shape is cast rather than imported. The
 * specifier is this process's own `mkdtemp` directory joined to a literal, never input.
 * @param {string} href @returns {Promise<unknown>} */
const loadModule = (href) =>
  // eslint-disable-next-line no-unsanitized/method -- process-local mkdtemp path
  import(href);

/**
 * Load a saved state the way `clinical-binding` does, so both arms answer as the demo would.
 *
 * @param {Uint8Array} image
 * @returns {Promise<Queryable>}
 */
const loadImage = async (image) => {
  const factory =
    /** @type {{ default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Queryable> }} */ (
      load('swipl-wasm/dist/loadImageDefault.js')
    );
  return factory.default(image)({});
};

/** @param {Queryable} engine @returns {string[]} every document whose answer derives */
const derivedDocuments = (engine) =>
  [...engine.prolog.query('clinical_advice(_,_,clinical_answer(Doc,_,_))')].map((row) =>
    String(/** @type {Record<string, unknown>} */ (row).Doc),
  );

/** @returns {Map<string, Uint8Array>} the working tree's verified bag */
const vendoredBag = () => {
  const kb = join(ROOT, 'kb');
  const archives = readdirSync(kb).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) fail(`expected one vendored bag in kb/, found ${archives.length}`);
  return verifyBag(readFileSync(join(kb, /** @type {string} */ (archives[0])))).files;
};

/**
 * Erase one line of `source` in place and report which documents still answer.
 *
 * In place, so every other gate's line list still points where it did — an erasure that
 * shortened the source would move lines the answer path never touched.
 *
 * @param {string} source
 * @param {string} victim exact clause text to erase
 * @returns {Promise<{ base: string[], mutant: string[] }>}
 */
const erasureArm = async (source, victim) => {
  const lines = source.split('\n');
  const at = lines.indexOf(victim);
  if (at < 0 || lines.lastIndexOf(victim) !== at) fail(`victim clause is not unique: ${victim}`);
  const base = derivedDocuments(await loadImage((await buildImage(source)).image));
  lines[at] = `% erased:${victim}`;
  const mutant = derivedDocuments(await loadImage((await buildImage(lines.join('\n'))).image));
  return { base, mutant };
};

const ref = process.argv[2] ?? DEFAULT_REF;
const files = vendoredBag();
const gate = GATE.exec(clinicalArtifacts(files).helper);
if (gate === null) fail('the working tree emits no cited gate to perturb');
const document = /** @type {string} */ (/** @type {RegExpExecArray} */ (gate)[1]);
const line = Number(/** @type {RegExpExecArray} */ (gate)[2]);
const working = payloadSource(files).source;
const victim = /** @type {string} */ (working.split('\n')[line - 1]);
if (!victim.startsWith('guideline_')) fail(`line ${line} is not a schema clause: ${victim}`);

const archive = mkdtempSync(join(tmpdir(), 'cnl-ckc-replay-'));
/** @type {{ base: string[], mutant: string[] }} */
let archived;
try {
  execFileSync('sh', ['-c', `git archive ${ref} tools | tar -x -C ${archive}`], { cwd: ROOT });
  symlinkSync(join(ROOT, 'node_modules'), join(archive, 'node_modules'));
  const older = /** @type {{ payloadSource: typeof payloadSource }} */ (
    await loadModule(pathToFileURL(join(archive, 'tools/kb/paths.mjs')).href)
  );
  archived = await erasureArm(older.payloadSource(files).source, victim);
} finally {
  rmSync(archive, { recursive: true, force: true });
}
const current = await erasureArm(working, victim);

/** @param {{ base: string[], mutant: string[] }} arm @returns {string} */
const verdict = (arm) => {
  const expected = arm.base.filter((name) => name !== document);
  if (!arm.base.includes(document)) return 'inconclusive: the base answer omits the victim';
  if (arm.mutant.length === arm.base.length) return 'red';
  return arm.mutant.join('\0') === expected.join('\0') ? 'green' : 'other';
};

const archivedVerdict = verdict(archived);
const currentVerdict = verdict(current);
const shape = (/** @type {{ base: string[], mutant: string[] }} */ arm) =>
  `${arm.base.length} → ${arm.mutant.length} documents`;
console.log(
  `binding-replay: erasing ${document} line ${String(line)} — ` +
    `${ref} ${archivedVerdict} (${shape(archived)}), working tree ${currentVerdict} ` +
    `(${shape(current)})`,
);
if (archivedVerdict !== 'red' || currentVerdict !== 'green') {
  fail(`expected ${ref} red and the working tree green`);
}
