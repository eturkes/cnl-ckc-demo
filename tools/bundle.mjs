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
 * Where the QLF fallback sits in a build, or why it sits wrong.
 *
 * The fallback is insurance a sound image never takes, so its 6.2 MB engine must stay out of
 * every chunk a sound session loads: the entry `index.html` names and the engine worker that
 * entry spawns. It must still be present — lazily, through a dynamic `import()` — or the
 * fallback could not be taken at all.
 *
 * @param {string} dist
 * @returns {{ failures: string[], chunk: string | undefined }}
 */
export const fallbackSplit = (dist) => {
  const assets = join(dist, 'assets');
  /** @type {(name: string) => string} */
  const read = (name) => readFileSync(join(assets, name), 'latin1');
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
  for (const eager of [entry, worker]) {
    if (eager !== undefined && carriers.includes(eager)) {
      failures.push(`eager chunk ${eager} carries the full engine`);
    }
  }
  const [chunk] = carriers;
  if (
    chunk !== undefined &&
    worker !== undefined &&
    !read(worker).includes(`import(\`./${chunk}\`)`)
  ) {
    failures.push(`the worker reaches ${chunk} by no dynamic import`);
  }
  return { failures, chunk };
};
