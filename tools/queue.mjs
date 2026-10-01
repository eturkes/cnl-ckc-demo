// `pnpm queue:index` — rewrite the deferral queue's `## Index` from its rows: one line per
// `high` + `med` row, its title beside its acceptance check's first sentence. `claims:check`
// grades the committed index against the same derivation, so a row added or re-ranked without a
// rewrite fails the gate by title.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './kb/paths.mjs';

export const QUEUE = '.agent/deferred.md';
const HEADING = '\n## Index — one line per `high` + `med` row\n';
const TABLE_HEAD = '| defect | accept |\n| --- | --- |';

/** @typedef {{ title: string, pri: string, accept: string }} QueueRow */

/** @param {string} queue @returns {QueueRow[]} every row above the index, in queue order */
export const queueRows = (queue) => {
  const at = queue.indexOf(HEADING);
  if (at < 0) throw new Error(`${QUEUE} has no "## Index" heading`);
  const body = queue.slice(0, at);
  const starts = [...body.matchAll(/^- \*\*(.+?)\*\*/gmu)];
  return starts.map((match, index) => {
    const text = body
      .slice(match.index, starts[index + 1]?.index ?? body.length)
      .replace(/\s+/gu, ' ');
    const accept = /Accept: (.*?)(?: `pri`|$)/u.exec(text)?.[1] ?? '';
    return {
      title: match[1] ?? '',
      pri: /`pri` (high|med|low)/u.exec(text)?.[1] ?? '',
      accept: (accept.split(/(?<=\.) (?=[A-Z`*])/u)[0] ?? '').replace(/\.$/u, ''),
    };
  });
};

/** @param {QueueRow[]} rows @returns {string} */
export const indexTable = (rows) =>
  [
    TABLE_HEAD,
    ...rows
      .filter((row) => row.pri === 'high' || row.pri === 'med')
      .map(
        (row) =>
          `| ${row.pri === 'high' ? '**high** ' : ''}${row.title.replaceAll('|', '\\|')} | ` +
          `${row.accept.replaceAll('|', '\\|')} |`,
      ),
  ].join('\n');

/** @param {string} queue @returns {{ start: number, end: number }} the committed table's span */
const tableSpan = (queue) => {
  const start = queue.indexOf(TABLE_HEAD, queue.indexOf(HEADING));
  if (start < 0)
    throw new Error(`${QUEUE} index has no "${TABLE_HEAD.split('\n')[0] ?? ''}" table`);
  const end = queue.indexOf('\n\n', start);
  return { start, end: end < 0 ? queue.length : end };
};

/**
 * The committed index against the one its rows derive, by line.
 *
 * @param {string} queue @returns {string[]}
 */
export const gradeIndex = (queue) => {
  const rows = queueRows(queue);
  if (rows.length === 0) return [`${QUEUE} holds no rows, so the index grades nothing`];
  const want = indexTable(rows).split('\n');
  const { start, end } = tableSpan(queue);
  const have = queue.slice(start, end).split('\n');
  return [
    ...want.filter((line) => !have.includes(line)).map((line) => `queue index lacks ${line}`),
    ...have.filter((line) => !want.includes(line)).map((line) => `queue index carries ${line}`),
  ].map((line) => `${line}; run pnpm queue:index`);
};

if (process.argv[1]?.endsWith('queue.mjs')) {
  const path = join(ROOT, QUEUE);
  const queue = readFileSync(path, 'utf8');
  const { start, end } = tableSpan(queue);
  writeFileSync(path, `${queue.slice(0, start)}${indexTable(queueRows(queue))}${queue.slice(end)}`);
  console.log(
    `queue:index — ${String(indexTable(queueRows(queue)).split('\n').length - 2)} index lines`,
  );
}
