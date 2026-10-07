// The third-party notice a build ships as `dist/licenses/third-party.txt`. Minification strips
// every licence comment from the bundled chunks, so each package whose code lands in a chunk is
// listed here with its own licence file, verbatim.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { requireFiring } from './control.mjs';

export const NOTICE = 'licenses/third-party.txt';

/**
 * Bundler-injected modules carry no package path; each names the packages that resolve to the
 * one shipping it, each from the one before.
 *
 * @type {[RegExp, string[]][]}
 */
const VIRTUAL = [
  [/^\0vite\//u, ['vite']],
  [/^__vite-browser-external/u, ['vite']],
  [/^\0rolldown\/runtime\.js$/u, ['vite', 'rolldown']],
];

const NODE_MODULES = '/node_modules/';
const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:\.(?:md|txt))?$/iu;
const RULE = '='.repeat(80);

/** @param {string[]} chain @returns {string} */
const resolveChain = (chain) => {
  let from = import.meta.url;
  for (const name of chain) from = createRequire(from).resolve(`${name}/package.json`);
  return dirname(from);
};

/**
 * The package directory a bundled module id belongs to, or `undefined` for first-party code.
 * The LAST `node_modules` segment names it, so a nested dependency maps to itself.
 *
 * @param {string} id @returns {string | undefined}
 */
export const packageDir = (id) => {
  const virtual = VIRTUAL.find(([pattern]) => pattern.test(id));
  if (virtual !== undefined) return resolveChain(virtual[1]);
  if (id.startsWith('\0'))
    throw new Error(`bundled virtual module ${JSON.stringify(id)} names no package`);
  const at = id.lastIndexOf(NODE_MODULES);
  if (at < 0) return undefined;
  const [scope = '', name = ''] = id.slice(at + NODE_MODULES.length).split('/');
  return (
    id.slice(0, at + NODE_MODULES.length) + (scope.startsWith('@') ? `${scope}/${name}` : scope)
  );
};

/** @typedef {{name: string, version: string, license: string, text: string}} Notice */

/** @param {Iterable<string>} dirs @returns {Notice[]} */
export const notices = (dirs) =>
  [...new Set(dirs)]
    .map((dir) => {
      const parsed = /** @type {unknown} */ (
        JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      );
      const pkg = /** @type {{name: string, version: string, license?: string}} */ (parsed);
      const file = readdirSync(dir).find((entry) => LICENCE_FILE.test(entry));
      if (file === undefined) throw new Error(`${pkg.name}@${pkg.version} ships no licence file`);
      return {
        name: pkg.name,
        version: pkg.version,
        license: pkg.license ?? 'see text',
        text: readFileSync(join(dir, file), 'utf8').trimEnd(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

/** @param {Notice} notice @returns {string} */
const section = ({ name, version, license, text }) =>
  `${RULE}\n${name}@${version} (${license})\n${RULE}\n\n${text}\n`;

/** @param {Notice[]} list @returns {string} */
export const noticeText = (list) =>
  [
    'Third-party software in the bundled JavaScript of this build. Minification removes the',
    "licence comments from the bundled code, so each package's licence file is reproduced here.\n",
    ...list.map(section),
  ].join('\n');

/**
 * Every bundled package whose licence section is absent from `text`, byte for byte.
 *
 * @param {Notice[]} list @param {string} text @returns {string[]}
 */
export const missingNotices = (list, text) => [
  ...(list.length === 0 ? [`no bundled package reached ${NOTICE}`] : []),
  ...list
    .filter((notice) => !text.includes(section(notice)))
    .map(({ name, version }) => `${name}@${version} is missing from ${NOTICE}`),
];

/**
 * Grades the notice as written to `outDir`, after its control refuses the same file with its
 * first section cut.
 *
 * @param {string} outDir @param {Notice[]} list @returns {string} the success line
 */
export const checkNotice = (outDir, list) => {
  const text = readFileSync(join(outDir, NOTICE), 'utf8');
  const [first] = list;
  const control = requireFiring(
    'build',
    {
      mutation: `${NOTICE} without its first section`,
      expect: [`${first?.name ?? '<none>'}@`, 'is missing from'],
    },
    () => missingNotices(list, first === undefined ? text : text.replace(section(first), '')),
  );
  const missing = missingNotices(list, text);
  if (missing.length > 0) throw new Error(missing.join('\n'));
  return `licence-notice: ${list.length} bundled packages in ${NOTICE}; control: ${control}`;
};
