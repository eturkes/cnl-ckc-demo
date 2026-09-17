import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECK = join(ROOT, 'tools/kb/check.mjs');

const TABLES = [
  {
    name: 'PRODUCTION_ROOTS',
    declaration:
      "const PRODUCTION_ROOTS = ['src', 'tools', 'vite.config.ts', 'index.html'];",
  },
  { name: 'SERIALIZE_ROOTS', declaration: "const SERIALIZE_ROOTS = ['src'];" },
  { name: 'QUESTION_ROOTS', declaration: "const QUESTION_ROOTS = ['src', 'tests'];" },
] as const;

it('C2 refuses every emptied kb:asset-check root table by name', () => {
  const original = readFileSync(CHECK, 'utf8');
  const accepted: string[] = [];
  try {
    for (const table of TABLES) {
      const mutated = original.replace(
        table.declaration,
        `const ${table.name} = [];`,
      );
      expect(mutated).not.toBe(original);
      writeFileSync(CHECK, mutated);
      const run = spawnSync(process.execPath, [CHECK], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const output = `${run.stdout}${run.stderr}`;
      if (run.status === 0 || !output.includes(table.name)) {
        accepted.push(`${table.name}: rc ${String(run.status)}, named=${String(output.includes(table.name))}`);
      }
    }
  } finally {
    writeFileSync(CHECK, original);
  }
  expect(accepted).toEqual([]);
});
