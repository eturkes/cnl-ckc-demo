import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = /** @type {{ assets: { kind: string, path: string, bytes: number }[] }} */ (
  JSON.parse(readFileSync(join(root, 'kb/generated/kb-manifest.json'), 'utf8'))
);
const source = readdirSync(join(root, 'src'), { recursive: true })
  .map(String)
  .filter((path) => /\.(?:ts|svelte)$/u.test(path))
  .map((path) => readFileSync(join(root, 'src', path), 'utf8'))
  .join('\n');
const shipped = new Set(
  readdirSync(join(root, 'dist/assets')).filter((name) => statSync(join(root, 'dist/assets', name)).isFile()),
);

const unused = manifest.assets
  .filter(({ kind }) => kind === 'qlf' || kind === 'provenance-index')
  .filter(({ path }) => !source.includes(path) && ![...shipped].some((name) => name.includes(path)));
assert.deepEqual(
  unused,
  [],
  'generated fallback/index assets must have a shipped runtime consumer or leave the generated inventory',
);
