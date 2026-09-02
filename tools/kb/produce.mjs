// Turns verified bag payload into the two runtime artifacts.
//
// `swipl-wasm`'s own `generateImageBuffer` (dist/generateImage.js:33-44) saves the
// state without checking the consult result and without capturing engine stderr,
// so a payload that fails to load still yields an image. The four steps are
// re-implemented here to assert the live contract inside the building engine and
// to fail closed on any diagnostic.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** CommonJS interop is typed `any`; `unknown` makes each cast below explicit.
 * @param {string} specifier @returns {unknown} */
const load = (specifier) => require(specifier);

/** @param {string} specifier @returns {EngineFactory} */
const engineFactory = (specifier) => /** @type {EngineFactory} */ (load(specifier));

/** Engine carrying the SWI library; required to compile and to save a state. */
const bundle = () => engineFactory('swipl-wasm/dist/swipl/swipl-bundle');
/** Engine without library data; the shipping runtime loads a saved state into it. */
const bundleNoData = () => engineFactory('swipl-wasm/dist/swipl/swipl-bundle-no-data');

/**
 * @typedef {{ FS: { writeFile(path: string, data: string | Uint8Array): void,
 *   readFile(path: string): Uint8Array, utime(path: string, atime: number, mtime: number): void,
 *   lookupPath(path: string): { node: { timestamp: number } } },
 *   prolog: { query(goal: string): { once(): Record<string, unknown> } } }} Engine
 * @typedef {(options: Record<string, unknown>) => Promise<Engine>} EngineFactory
 * @typedef {{ schemaVersion: number, documents: number, prolog: string }} LiveContract
 */

const SOURCE_PATH = 'prolog.pl';
/** Pinned so the timestamp the saved state embeds cannot vary between builds. */
const SOURCE_MTIME_MS = 0;

/**
 * Run a build phase with the engine's wall clock pinned.
 *
 * A saved state is a ZIP archive whose entry timestamps come from the WASM
 * runtime's `Date.now`, and its embedded `state.qlf` records the mtime of the
 * source it compiled. Both are wall-clock reads, so two builds of identical input
 * produce different bytes until the clock is held still. Pinning it here is what
 * makes the shipped artifact byte-reproducible.
 *
 * @template T
 * @param {() => Promise<T>} phase
 * @returns {Promise<T>}
 */
const withPinnedClock = async (phase) => {
  const real = Date.now;
  Date.now = () => SOURCE_MTIME_MS;
  try {
    return await phase();
  } finally {
    Date.now = real;
  }
};

/**
 * Boot an engine, capturing every diagnostic byte it emits.
 *
 * `drain` returns the lines emitted since the last drain and clears them, so each
 * phase of a build is judged on its own output rather than on the accumulation.
 *
 * @param {EngineFactory} factory
 * @param {string[]} args
 * @param {((engine: Engine) => void)[]} preRun
 * @returns {Promise<{ engine: Engine, drain: () => string[] }>}
 */
const boot = async (factory, args, preRun) => {
  /** @type {string[]} */
  let diagnostics = [];
  const engine = await factory({
    arguments: args,
    preRun,
    print: () => {},
    printErr: (/** @type {string} */ line) => diagnostics.push(line),
    on_output: (/** @type {string} */ text, /** @type {string} */ stream) => {
      if (stream === 'stderr') diagnostics.push(text);
    },
  });
  return {
    engine,
    drain: () => {
      const lines = diagnostics;
      diagnostics = [];
      return lines;
    },
  };
};

// `qsave_program` probes for shared-library support, which a WASM build cannot
// have. Exactly two Warning lines are that probe's noise; an ERROR carrying the
// same source location is a genuine save failure and stays fatal.
const SAVE_NOISE = /^Warning:.*(?:qsave\.pl:\d+:|library\(shlib\))/u;

/** Judge each physical line on its own: a chunk may carry several. */
export const saveDiagnostics = (/** @type {string[]} */ lines) =>
  lines.flatMap((line) => line.split('\n')).filter((line) => line.trim() !== '' && !SAVE_NOISE.test(line));

/** @param {Engine} engine @param {string} source */
const writeSource = (engine, source) => {
  engine.FS.writeFile(SOURCE_PATH, source);
  // A saved state records its source file's mtime; pinning it is what makes two
  // builds of identical input byte-identical.
  engine.FS.utime(SOURCE_PATH, SOURCE_MTIME_MS, SOURCE_MTIME_MS);
};

/**
 * Read the contract back out of a live engine. Never assumes the expected values.
 *
 * @param {Engine} engine
 * @returns {LiveContract}
 */
export const readContract = (engine) => {
  // Every payload file declares the schema version, so a mixed-schema bag must be
  // caught by counting distinct values, not by reading the first solution.
  const schema = engine.prolog
    .query('findall(V,guideline_schema_version(V),Vs),sort(Vs,Us),length(Us,D),max_list(Us,Hi),min_list(Us,Lo).')
    .once();
  const documents = engine.prolog
    .query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).')
    .once();
  const version = engine.prolog.query('current_prolog_flag(version_data,swi(Ma,Mi,Pa,_)).').once();
  if (Number(schema['D']) !== 1 || Number(schema['Hi']) !== Number(schema['Lo'])) {
    throw new Error(`payload declares ${String(schema['D'])} distinct schema versions`);
  }
  return {
    schemaVersion: Number(schema['Hi']),
    documents: Number(documents['N']),
    prolog: `${String(version['Ma'])}.${String(version['Mi'])}.${String(version['Pa'])}`,
  };
};

/**
 * @param {string[]} diagnostics
 * @param {string} what
 */
const failClosed = (diagnostics, what) => {
  if (diagnostics.length > 0) {
    throw new Error(`${what}: engine emitted ${diagnostics.length} diagnostic line(s)\n${diagnostics.join('\n')}`);
  }
};

/**
 * @param {LiveContract} contract
 * @param {string} what
 */
const requireLoaded = (contract, what) => {
  if (!Number.isInteger(contract.schemaVersion) || contract.schemaVersion < 1) {
    throw new Error(`${what}: no guideline schema version reported`);
  }
  if (!Number.isInteger(contract.documents) || contract.documents < 1) {
    throw new Error(`${what}: engine reported ${contract.documents} documents`);
  }
};

/**
 * The building engine must report one document per payload file this run fed it.
 *
 * `requireLoaded`'s `>= 1` floor saves an image for a 336-file corpus, and the
 * literal 337 is forbidden as a production pass condition — so the run's own
 * input count is the only expected value available. Each `% file:` marker
 * `payloadSource` emits stands for exactly one payload document.
 *
 * @param {LiveContract} contract
 * @param {string} source
 * @param {string} what
 */
const requireEveryDocument = (contract, source, what) => {
  const expected = (source.match(/^% file:/gmu) ?? []).length;
  if (contract.documents !== expected) {
    throw new Error(`${what}: engine reported ${contract.documents} documents, build fed ${expected} payload files`);
  }
};

/**
 * Compile the payload and save the engine state, asserting the contract first.
 *
 * @param {string} source
 * @returns {Promise<{ image: Uint8Array, contract: LiveContract }>}
 */
export const buildImage = (source) =>
  withPinnedClock(async () => {
  const { engine, drain } = await boot(bundle(), ['-q', '-f', SOURCE_PATH], [
    (module) => writeSource(module, source),
  ]);
  failClosed(drain(), 'image build');
  const contract = readContract(engine);
  requireLoaded(contract, 'image build');
  requireEveryDocument(contract, source, 'image build');
  engine.prolog.query("qsave_program('prolog.pvm').").once();
  failClosed(saveDiagnostics(drain()), 'image save');
  return { image: engine.FS.readFile('prolog.pvm'), contract };
  });

/**
 * Compile the payload to a QLF fallback artifact in a fresh engine, so the image
 * build stays untouched by the compile.
 *
 * @param {string} source
 * @returns {Promise<Uint8Array>}
 */
export const buildQlf = (source) =>
  withPinnedClock(async () => {
  const { engine, drain } = await boot(bundle(), ['-q'], []);
  drain();
  writeSource(engine, source);
  engine.prolog.query(`qcompile('${SOURCE_PATH}').`).once();
  failClosed(drain(), 'qlf build');
  return engine.FS.readFile('prolog.qlf');
  });

/**
 * Load a saved state exactly the way the shipping runtime does and read its
 * contract back.
 *
 * @param {Uint8Array} image
 * @returns {Promise<LiveContract>}
 */
export const verifyImage = async (image) => {
  const { engine, drain } = await boot(bundleNoData(), ['-q', '-x', 'image.pvm'], [
    (module) => module.FS.writeFile('image.pvm', image),
  ]);
  failClosed(drain(), 'image load');
  const contract = readContract(engine);
  requireLoaded(contract, 'image load');
  return contract;
};

/**
 * Load the QLF fallback and read its contract back.
 *
 * @param {Uint8Array} qlf
 * @returns {Promise<LiveContract>}
 */
export const verifyQlf = async (qlf) => {
  const { engine, drain } = await boot(bundle(), ['-q'], [
    (module) => module.FS.writeFile('kb.qlf', qlf),
  ]);
  drain();
  engine.prolog.query("consult('kb.qlf').").once();
  failClosed(drain(), 'qlf load');
  const contract = readContract(engine);
  requireLoaded(contract, 'qlf load');
  return contract;
};

export const swiplWasmVersion = () =>
  String(/** @type {{ version: string }} */ (load('swipl-wasm/package.json')).version);
