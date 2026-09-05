import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const assets = join(root, 'dist/assets');
const workers = readdirSync(assets).filter((name) => /^worker-.*\.js$/u.test(name));
assert.equal(workers.length, 1, 'production build must emit exactly one engine worker');
const worker = workers[0];
assert.ok(worker !== undefined);
const bytes = statSync(join(assets, worker)).size;
assert.ok(bytes > 1_000_000, `probe requires a worker above the A5 threshold, found ${bytes}`);

const controller = readFileSync(join(root, 'src/demo/DemoController.svelte.ts'), 'utf8');
const constructorBoots = controller.includes('void this.#boot();');
assert.equal(
  constructorBoots,
  false,
  `${worker} is ${bytes} bytes and must not load until an explicit user activation`,
);
