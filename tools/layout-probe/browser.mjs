import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const BROWSER_CACHE = join(ROOT, 'node_modules/.cache/ms-playwright');
export const INSTALL =
  'PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright pnpm exec playwright install chromium-headless-shell';
const NAMES = new Set([
  'headless_shell',
  'headless_shell.exe',
  'chrome-headless-shell',
  'chrome-headless-shell.exe',
]);
/** @param {string} path @returns {unknown} */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
/** @param {string} directory @returns {string[]} */
const executables = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? executables(path) : NAMES.has(entry.name) ? [path] : [];
  });
/** Explicit executable path defeats both global-cache fallback and pre-loaded Playwright registry state. */
export const localShell = () => {
  const pkg = dirname(require.resolve('playwright/package.json'));
  const core = dirname(require.resolve('playwright-core/package.json', { paths: [pkg] }));
  const descriptor = /** @type {{browsers:{name:string,revision:string}[]}} */ (
    readJson(join(core, 'browsers.json'))
  ).browsers.find((b) => b.name === 'chromium-headless-shell');
  if (!descriptor) throw new Error('playwright declares no chromium-headless-shell revision');
  const directory = join(BROWSER_CACHE, `chromium_headless_shell-${descriptor.revision}`);
  const paths = existsSync(directory) ? executables(directory) : [];
  if (paths.length !== 1)
    throw new Error(
      `pinned Chromium headless shell ${descriptor.revision} missing in ${directory}. Install from the project root:\n${INSTALL}`,
    );
  const path = realpathSync(paths[0] ?? '');
  if (!path.startsWith(realpathSync(BROWSER_CACHE) + sep))
    throw new Error(`Chromium headless shell is not project-local: ${path}\n${INSTALL}`);
  return path;
};
/** @param {(message:string)=>never} fail @returns {Promise<import('playwright').Browser>} */
export const launch = async (fail) => {
  try {
    const executablePath = localShell();
    const { chromium } = await import('playwright');
    return await chromium.launch({ headless: true, executablePath });
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
};
