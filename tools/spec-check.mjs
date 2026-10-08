// `pnpm spec:check` — `.agent/spec.md` `Tasks` keeps the layout `CLAUDE.md` `Session flow` names:
// every open unit a `- [ ]` row, every ticked row its commit SHA, and the section's last item
// pointing at `.agent/deferred.md`. Format alone: a shallow CI clone cannot resolve old SHAs.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { requireFiring } from './control.mjs';
import { ROOT } from './kb/paths.mjs';

const SPEC = process.argv[2] ?? '.agent/spec.md';
const POINTER = '.agent/deferred.md';
/**
 * `state.md` clears ticked rows at phase close, so a sound block can hold none; the SHA control
 * then plants this row in a copy and strips it, as `claims:check` plants a citation.
 */
const PLANTED_TICKED = '- [x] `0000000` planted control row.';

/** @param {string} spec @returns {string[]} the section's top-level items, continuation lines dropped */
const taskItems = (spec) => {
  const start = spec.indexOf('\n# Tasks\n');
  const end = spec.indexOf('\n# ', start + 1);
  if (start < 0 || end < 0) return [];
  return spec
    .slice(start, end)
    .split('\n')
    .filter((line) => /^[-*+] /u.test(line));
};

/** @param {string} spec @returns {string[]} */
export const gradeTasks = (spec) => {
  const items = taskItems(spec);
  if (items.length === 0) return [`${SPEC} holds no "# Tasks" items`];
  /** @type {string[]} */
  const failures = [];
  const last = items.at(-1) ?? '';
  if (!last.includes(POINTER)) failures.push(`Tasks: the last item does not point at ${POINTER}`);
  for (const item of items.slice(0, -1)) {
    const head = item.slice(0, 72);
    if (item.startsWith('- [ ] ')) continue;
    if (!item.startsWith('- [x] '))
      failures.push(`Tasks: an open unit is not a "- [ ]" row: ${head}`);
    else if (!/^- \[x\] `[0-9a-f]{7,40}` /u.test(item)) {
      failures.push(`Tasks: a ticked row carries no commit SHA: ${head}`);
    }
  }
  return failures;
};

const spec = readFileSync(resolve(ROOT, SPEC), 'utf8');
const items = taskItems(spec);
const open = items.find((item) => item.startsWith('- [ ] ')) ?? '';
const pointer = items.at(-1) ?? '';
const found = items.find((item) => item.startsWith('- [x] '));
const ticked = found ?? PLANTED_TICKED;
const withTicked = found === undefined ? spec.replace(pointer, `${ticked}\n${pointer}`) : spec;
const controls = [
  requireFiring(
    'spec:check',
    {
      mutation: 'an open unit written as a plain bullet',
      expect: ['an open unit is not a "- [ ]" row'],
    },
    () => gradeTasks(spec.replace(open, open.replace('- [ ] ', '- '))),
  ),
  requireFiring(
    'spec:check',
    {
      mutation: 'an open unit written with a star bullet',
      expect: ['an open unit is not a "- [ ]" row'],
    },
    () => gradeTasks(spec.replace(open, open.replace('- [ ] ', '* [ ] '))),
  ),
  requireFiring(
    'spec:check',
    {
      mutation: `${found === undefined ? 'a planted' : 'a'} ticked row stripped of its SHA`,
      expect: ['a ticked row carries no commit SHA'],
    },
    () => gradeTasks(withTicked.replace(ticked, ticked.replace(/`[0-9a-f]{7,40}` /u, ''))),
  ),
  requireFiring(
    'spec:check',
    { mutation: 'the queue pointer dropped from the last item', expect: ['does not point at'] },
    () => gradeTasks(spec.replace(pointer, '- Queue → elsewhere.')),
  ),
];

const failures = gradeTasks(spec);
if (failures.length > 0) {
  console.error(`spec:check failed — ${failures.join('; ')}`);
  process.exit(1);
}
const done = items.filter((item) => item.startsWith('- [x] ')).length;
console.log(
  `spec:check ok — ${String(items.length - 1 - done)} open, ${String(done)} ticked with SHAs, ` +
    `pointer to ${POINTER}; controls: ${controls.join(', ')}`,
);
