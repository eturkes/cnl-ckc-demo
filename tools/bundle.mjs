// Static facts about a built `dist/` that the browser lanes grade.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bytes only the full `swipl-bundle` carries: the library it embeds for QLF loading. The
 * saved-state engine (`swipl-bundle-no-data`) has none, so the marker separates the two.
 */
export const FULL_ENGINE_MARKER = 'library/lists.pl';

/** Requests that take the QLF fallback: its engine chunk or the QLF itself. */
export const FALLBACK_REQUEST = /\/assets\/(?:swipl-bundle-[^/]+\.js|kb-[^/]+\.qlf)$/u;

/**
 * The chunks a built chunk loads eagerly: every specifier after a bare `import` or a `from`, which
 * covers `import "x"`, `import … from "x"` and `export … from "x"`. A dynamic `import(…)` puts a
 * parenthesis before its specifier, so it never matches.
 *
 * @param {string} code @returns {string[]}
 */
const staticImports = (code) =>
  [...code.matchAll(/\b(?:import|from)\s*["'`]\.\/([^"'`]+\.js)["'`]/gu)].map(
    ([, name]) => name ?? '',
  );

/**
 * Where the QLF fallback sits in a build, or why it sits wrong.
 *
 * The fallback is insurance a sound image never takes, so its 6.2 MB engine must stay out of
 * every chunk a sound session loads: the entry `index.html` names, the engine worker that entry
 * spawns, and everything either one statically imports. It must still be present — lazily,
 * through a dynamic `import()` from one of those chunks — or the fallback could not be taken.
 *
 * @param {string} dist
 * @param {(name: string, code: string) => string} [edit] rewrites one chunk in memory, for the controls
 * @returns {{ failures: string[], chunk: string | undefined }}
 */
export const fallbackSplit = (dist, edit = (_name, code) => code) => {
  const assets = join(dist, 'assets');
  /** @type {(name: string) => string} */
  const read = (name) => edit(name, readFileSync(join(assets, name), 'latin1'));
  const chunks = readdirSync(assets).filter((name) => name.endsWith('.js'));
  const carriers = chunks.filter((name) => read(name).includes(FULL_ENGINE_MARKER));
  const entry = /src="\.\/assets\/([^"]+\.js)"/u.exec(
    readFileSync(join(dist, 'index.html'), 'utf8'),
  )?.[1];
  const worker =
    entry === undefined ? undefined : /new URL\(`(worker-[^`]+\.js)`/u.exec(read(entry))?.[1];
  /** @type {string[]} */
  const failures = [];
  if (entry === undefined) failures.push('index.html names no entry chunk');
  if (worker === undefined) failures.push('the entry chunk spawns no engine worker chunk');
  if (carriers.length !== 1) {
    failures.push(`${String(carriers.length)} chunks carry the full engine, expected 1`);
  }
  /** @type {Set<string>} */
  const eager = new Set();
  const pending = [entry, worker].filter((name) => name !== undefined);
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (eager.has(name) || !chunks.includes(name)) continue;
    eager.add(name);
    pending.push(...staticImports(read(name)));
  }
  for (const name of eager) {
    if (carriers.includes(name)) failures.push(`eager chunk ${name} carries the full engine`);
  }
  const [chunk] = carriers;
  if (
    chunk !== undefined &&
    ![...eager].some((name) => read(name).includes(`import(\`./${chunk}\`)`))
  ) {
    failures.push(`no eager chunk reaches ${chunk} by a dynamic import`);
  }
  return { failures, chunk };
};
