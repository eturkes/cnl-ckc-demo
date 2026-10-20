#!/usr/bin/env node
// E11 — the differential that makes the perturbation battery load-bearing.
//
// `tests/clinical-binding.test.ts` E2 requires erasing one cited `guideline_*` clause to drop
// exactly that document from the answer set. Before u3 the answer shipped as a compiled FACT,
// so no erasure could reach it and E2 would have been red the day it was written. This
// replays that erasure against an archived tree and against the working tree, so "red before
// u3, green now" is a command rather than a memory.
//
// Each arm runs on its own tree whole: the bag that tree vendored, its producer and its image
// build, erasing the first clause line its own helper cites. A schema-changing re-vendor
// (`guideline_document/3` → `/4` at the 19-indicator bag) means one build machinery can no
// longer read both bags; the swipl-wasm loader is the one thing the arms share, and both trees
// pin it to the same version.
//
// Usage: node tools/binding-replay.mjs [<git ref>]
// Exit 0 when the archived arm is red and the working arm is green.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT } from './kb/paths.mjs';

/** The tree whose `clinical_advice/3` was a compiled fact rather than a derivation. */
const DEFAULT_REF = 'a944fca';
/**
 * The first cited clause line of a helper, in each generation's form: the gate a derivation
 * runs since u2, and the site list the compiled fact carried at `a944fca`.
 */
const CITED = [
  /^clinical_gate\('([^']+)',\d+,[^,]+,\[(\d+)/mu,
  /^clinical_advice_source\([^,]+,'\$guideline_id'\(product,'([^']+)',.*?\[site\((\d+),/mu,
];

/** @typedef {{ prolog: { query: (goal: string) => Iterable<unknown> } }} Queryable */
/**
 * @typedef {{
 *   verifyBag: (bytes: Uint8Array) => { files: Map<string, Uint8Array> },
 *   payloadSource: (files: Map<string, Uint8Array>) => { source: string },
 *   clinicalArtifacts: (files: Map<string, Uint8Array>) => { helper: string },
 *   buildImage: (source: string) => Promise<{ image: Uint8Array }>,
 * }} Producer
 */
/** @typedef {{ document: string, line: number, base: string[], mutant: string[] }} Arm */

/** @param {string} message @returns {never} */
const fail = (message) => {
  console.error(`binding-replay: ${message}`);
  process.exit(1);
};

const require = createRequire(import.meta.url);

/** CommonJS interop is typed `any`; `unknown` makes the cast below explicit.
 * @param {string} specifier @returns {unknown} */
const load = (specifier) => require(specifier);

/** A tree's producer arrives by path, so its shape is cast rather than imported. The specifier
 * is the working root or this process's own `mkdtemp` directory joined to a literal, never input.
 * @param {string} href @returns {Promise<unknown>} */
const loadModule = (href) =>
  // eslint-disable-next-line no-unsanitized/method -- the working root or a process-local mkdtemp path
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

/** @param {string} tree a directory holding `tools/` and `kb/` @returns {Promise<Producer>} */
const producer = async (tree) => {
  /** @param {string} path @returns {Promise<Record<string, unknown>>} */
  const module = async (path) =>
    /** @type {Record<string, unknown>} */ (await loadModule(pathToFileURL(join(tree, path)).href));
  return /** @type {Producer} */ ({
    ...(await module('tools/kb/bag.mjs')),
    ...(await module('tools/kb/paths.mjs')),
    ...(await module('tools/kb/clinical.mjs')),
    ...(await module('tools/kb/produce.mjs')),
  });
};

/**
 * Erase the first clause line a tree's own helper cites, in place, and report which documents
 * still answer before and after. In place, so every other cited line still points where it did.
 *
 * @param {string} tree @returns {Promise<Arm>}
 */
const erasureArm = async (tree) => {
  const { verifyBag, payloadSource, clinicalArtifacts, buildImage } = await producer(tree);
  const kb = join(tree, 'kb');
  const archives = readdirSync(kb).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1)
    fail(`${tree}: expected one vendored bag in kb/, found ${archives.length}`);
  const files = verifyBag(readFileSync(join(kb, /** @type {string} */ (archives[0])))).files;
  const helper = clinicalArtifacts(files).helper;
  const cited = CITED.map((pattern) => pattern.exec(helper)).find((match) => match !== null);
  if (cited === undefined) fail(`${tree}: the helper cites no clause line to perturb`);
  const document = /** @type {string} */ (/** @type {RegExpExecArray} */ (cited)[1]);
  const line = Number(/** @type {RegExpExecArray} */ (cited)[2]);
  const lines = payloadSource(files).source.split('\n');
  const victim = /** @type {string} */ (lines[line - 1]);
  if (!victim.startsWith('guideline_'))
    fail(`${tree}: line ${line} is not a schema clause: ${victim}`);
  if (lines.indexOf(victim) !== line - 1 || lines.lastIndexOf(victim) !== line - 1) {
    fail(`${tree}: victim clause is not unique: ${victim}`);
  }
  const base = derivedDocuments(await loadImage((await buildImage(lines.join('\n'))).image));
  lines[line - 1] = `% erased:${victim}`;
  const mutant = derivedDocuments(await loadImage((await buildImage(lines.join('\n'))).image));
  return { document, line, base, mutant };
};

const ref = process.argv[2] ?? DEFAULT_REF;
const archive = mkdtempSync(join(tmpdir(), 'cnl-ckc-replay-'));
/** @type {Arm} */
let archived;
try {
  execFileSync('sh', ['-c', `git archive ${ref} tools kb | tar -x -C ${archive}`], { cwd: ROOT });
  symlinkSync(join(ROOT, 'node_modules'), join(archive, 'node_modules'));
  archived = await erasureArm(archive);
} finally {
  rmSync(archive, { recursive: true, force: true });
}
const current = await erasureArm(ROOT);

/** @param {Arm} arm @returns {string} */
const verdict = (arm) => {
  const expected = arm.base.filter((name) => name !== arm.document);
  if (!arm.base.includes(arm.document)) return 'inconclusive: the base answer omits the victim';
  if (arm.mutant.length === arm.base.length) return 'red';
  return arm.mutant.join('\0') === expected.join('\0') ? 'green' : 'other';
};

const archivedVerdict = verdict(archived);
const currentVerdict = verdict(current);
/** @param {Arm} arm @returns {string} */
const shape = (arm) =>
  `erasing ${arm.document} line ${String(arm.line)}, ${arm.base.length} → ${arm.mutant.length} documents`;
console.log(
  `binding-replay: ${ref} ${archivedVerdict} (${shape(archived)}); ` +
    `working tree ${currentVerdict} (${shape(current)})`,
);
if (archivedVerdict !== 'red' || currentVerdict !== 'green') {
  fail(`expected ${ref} red and the working tree green`);
}
