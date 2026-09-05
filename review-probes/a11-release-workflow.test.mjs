import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const workflow = readFileSync(join(root, '.github/workflows/pages.yml'), 'utf8');
assert.equal(
  /^\s*- run: pnpm release:check\s*$/mu.test(workflow),
  true,
  'the publishing workflow must run the release check that owns reproduction and real-browser claims',
);
