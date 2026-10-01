#!/usr/bin/env node
// `pnpm readme:check` — the README's setup path, run from a clean clone of HEAD.
//
// The README is a durable human-facing claim that re-stales on any `package.json`, lockfile or
// `tools/kb/` change, and nothing else runs it as written. This check clones committed HEAD into
// a scratch directory, executes ONLY the `sh` blocks of `## Run locally` — the keyed intake
// blocks excepted — and grades every command's exit status plus the corpus and module counts.
//
// Outside `pnpm gate`: it needs a clean clone, a package install and a real browser.
//
// One deviation from the README text, sandbox only: `corepack enable` gains
// `--install-directory <scratch>/bin`, because the bare command writes shims beside the system
// `corepack` binary. The pnpm it provisions still honours `packageManager`.

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { failWith, launch } from './browser.mjs';
import { requireFiring } from './control.mjs';
import { loadManifest, ROOT } from './kb/paths.mjs';

const SECTION = '## Run locally';
/** Blocks that need the TypeSafe key are a live, billed path — never part of setup. */
const KEYED = /\.dev\.vars|intake:/u;
/** Commands that serve until stopped; each passes once its page answers. */
const SERVERS = new Set(['pnpm dev', 'pnpm preview']);
const TIMEOUT = 300_000;

/** @type {(message: string) => never} */
const fail = failWith('readme-check');

/**
 * Every setup command, in README order.
 *
 * @param {string} readme
 * @returns {string[]}
 */
export const setupCommands = (readme) => {
  const start = readme.indexOf(`\n${SECTION}\n`);
  if (start === -1) throw new Error(`README has no ${SECTION} section`);
  const next = readme.indexOf('\n## ', start + SECTION.length + 1);
  const section = readme.slice(start, next === -1 ? undefined : next);
  /** @type {string[]} */
  const commands = [];
  for (const block of section.matchAll(/^ *```sh\n([\s\S]*?)^ *```$/gmu)) {
    const body = block[1] ?? '';
    if (KEYED.test(body)) continue;
    commands.push(
      ...body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    );
  }
  if (commands.length === 0) throw new Error(`README ${SECTION} carries no setup commands`);
  return commands;
};

/**
 * @param {{documents: {build: number, engine: number, bag: number}, modules: {clone: number, reference: number}}} counts
 * @returns {string[]}
 */
export const gradeCounts = ({ documents, modules }) => {
  /** @type {string[]} */
  const failures = [];
  if (documents.build !== documents.bag || documents.engine !== documents.bag) {
    failures.push(
      `documents: kb:build ${String(documents.build)}, engine ${String(documents.engine)}, ` +
        `bag manifest ${String(documents.bag)}`,
    );
  }
  if (modules.clone === 0 || modules.clone !== modules.reference) {
    failures.push(
      `modules: clean clone ${String(modules.clone)}, reference build ${String(modules.reference)}`,
    );
  }
  return failures;
};

/** @param {string} output @returns {number} */
const moduleCount = (output) => Number(/(\d+) modules transformed/u.exec(output)?.[1] ?? 0);

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const commandsControl = requireFiring(
  'readme:check',
  { mutation: `README with ${SECTION} renamed`, expect: [SECTION] },
  () => setupCommands(readme.replace(`\n${SECTION}\n`, '\n## Running\n')),
);

const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
if (dirty.trim() !== '') {
  fail(`the working tree is dirty, so HEAD is not what it holds:\n${dirty.trimEnd()}`);
}
const bag = loadManifest()?.contract.documents;
if (bag === undefined) fail('no build manifest in the primary tree; run pnpm kb:build');
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const commands = setupCommands(readme);

const scratch = await mkdtemp(join(tmpdir(), 'cnl-ckc-readme-'));
const clone = join(scratch, 'repo');
const bin = join(scratch, 'bin');
// The outer `pnpm readme:check` put this tree's `node_modules/.bin` on PATH and exported its
// config as `npm_*`; either one would let the clone borrow the tools it is meant to install.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^npm_|^pnpm_config_/iu.test(key)),
);
env.PATH = [
  bin,
  ...(process.env.PATH ?? '').split(delimiter).filter((p) => !p.startsWith(ROOT)),
].join(delimiter);
env.COREPACK_HOME = join(scratch, 'corepack');
env.COREPACK_ENABLE_DOWNLOAD_PROMPT = '0';

/**
 * Run one README line to completion inside the clone.
 *
 * @param {string} command
 * @returns {Promise<string>}
 */
const run = (command) =>
  new Promise((resolve) => {
    const line = command === 'corepack enable' ? `${command} --install-directory ${bin}` : command;
    const child = spawn('sh', ['-c', line], { cwd: clone, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += String(chunk)));
    child.stderr.on('data', (chunk) => (output += String(chunk)));
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT);
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) fail(`\`${command}\` exited ${String(code)}:\n${output.slice(-1200)}`);
      resolve(output);
    });
  });

/**
 * Start a README server, hand its URL to `use`, then stop the whole process group.
 *
 * @param {string} command
 * @param {(url: string) => Promise<void>} use
 * @returns {Promise<void>}
 */
const served = async (command, use) => {
  // `detached` + a group kill: signalling the pnpm wrapper alone orphans vite, which keeps
  // the inherited pipes open so this process never exits (`.claude/rules/gate.md`).
  const child = spawn('sh', ['-c', command], {
    cwd: clone,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const stop = () => {
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  };
  try {
    const url = await /** @type {Promise<string>} */ (
      new Promise((resolve, reject) => {
        let seen = '';
        const timer = setTimeout(() => reject(new Error(`no URL within ${TIMEOUT} ms`)), TIMEOUT);
        /** @param {unknown} chunk */
        const read = (chunk) => {
          seen += String(chunk);
          const found = /(http:\/\/(?:localhost|127\.0\.0\.1):\d+\/)/u.exec(seen)?.[1];
          if (found === undefined) return;
          clearTimeout(timer);
          resolve(found);
        };
        child.stdout.on('data', read);
        child.stderr.on('data', read);
        child.on('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`exited ${String(code)} before serving: ${seen.slice(-600)}`));
        });
      })
    );
    await use(url);
  } catch (cause) {
    stop();
    fail(`\`${command}\`: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  stop();
};

/** @type {import('./browser.mjs').Browser | undefined} */
let browser;
try {
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', ROOT, clone]);
  await mkdir(bin);
  let buildOutput = '';
  let engineDocuments = -1;
  let ran = 0;
  for (const command of commands) {
    if (!SERVERS.has(command)) {
      const output = await run(command);
      if (command === 'pnpm kb:build' || command === 'pnpm build') buildOutput += output;
      ran += 1;
      continue;
    }
    await served(command, async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} answered HTTP ${String(response.status)}`);
      if (command !== 'pnpm preview') return;
      // The served production build has to boot the engine and report its corpus.
      browser ??= await launch(fail);
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
      await page.waitForSelector('[data-engine="ready"]', { timeout: 60_000 });
      const corpus = page.locator('details.about [data-documents]');
      await corpus.waitFor({ state: 'attached', timeout: 60_000 });
      engineDocuments = Number(await corpus.getAttribute('data-documents'));
    });
    ran += 1;
  }
  const builtDocuments = Number(/(\d+) documents, control:/u.exec(buildOutput)?.[1] ?? -1);
  // The reference is THIS tree's committed state built in place, so the two counts differ only
  // when the clone is missing something the working tree quietly supplies.
  const reference = moduleCount(
    execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', join(scratch, 'reference')], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  const counts = {
    documents: { build: builtDocuments, engine: engineDocuments, bag },
    modules: { clone: moduleCount(buildOutput), reference },
  };
  const countsControl = requireFiring(
    'readme:check',
    { mutation: 'reference module count off by one', expect: ['modules: clean clone'] },
    () => gradeCounts({ ...counts, modules: { ...counts.modules, reference: reference + 1 } }),
  );
  const failures = gradeCounts(counts);
  if (failures.length > 0) fail(failures.join('; '));
  console.log(
    `readme:check ok — clone of ${head}: ${String(ran)} README commands rc 0; ` +
      `${String(bag)} documents from kb:build, the booted engine and the bag manifest; ` +
      `${String(counts.modules.clone)} modules, equal to the reference build; ` +
      `controls: ${commandsControl}, ${countsControl}`,
  );
} finally {
  await browser?.close();
  await rm(scratch, { recursive: true, force: true });
}
