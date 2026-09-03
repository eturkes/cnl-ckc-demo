#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const kb = process.argv[2];
if (!kb) throw new Error('usage: vite-asset-map-probe.mjs <kb>');
const ids = readdirSync(join(kb, 'data/guidelines/cdc-2022-opioid/ace')).filter(name => name.endsWith('.ace')).map(name => name.slice(0, -4)).sort();
const root = mkdtempSync(join(tmpdir(), 'vite-asset-map-'));

function outputFiles(path) {
  return readdirSync(path, { recursive: true }).map(name => join(path, name)).filter(path => statSync(path).isFile());
}

async function probe(name, options) {
  const project = join(root, name);
  const source = join(project, 'src');
  const assets = join(source, 'provenance');
  mkdirSync(assets, { recursive: true });
  for (const id of ids) writeFileSync(join(assets, `${id}.json`), JSON.stringify({ id }));
  writeFileSync(join(project, 'index.html'), '<script type="module" src="/src/main.js"></script>');
  writeFileSync(join(source, 'main.js'), `globalThis.provenanceUrls = import.meta.glob('./provenance/*.json', ${JSON.stringify(options)});`);
  await build({ configFile: false, root: project, base: './', logLevel: 'silent', build: { outDir: 'dist', emptyOutDir: true, minify: 'oxc' } });
  const dist = join(project, 'dist');
  const files = outputFiles(dist);
  const javascript = files.filter(path => /\.js$/.test(path));
  const entry = javascript.find(path => /\/assets\/index-[^/]+\.js$/.test(path));
  const data = readFileSync(entry);
  const jsRaw = javascript.reduce((total, path) => total + statSync(path).size, 0);
  const jsGzip = javascript.reduce((total, path) => total + gzipSync(readFileSync(path), { level: 9 }).byteLength, 0);
  console.log(`${name}\tfiles=${files.length}\tjs=${javascript.length}\tjson=${files.filter(path => /\.json$/.test(path)).length}\tentry_raw=${data.byteLength}\tentry_gzip=${gzipSync(data, { level: 9 }).byteLength}\tjs_raw=${jsRaw}\tjs_gzip=${jsGzip}`);
}

try {
  await probe('eager_url', { eager: true, query: '?url&no-inline', import: 'default' });
  await probe('lazy_url', { query: '?url&no-inline', import: 'default' });
} finally {
  rmSync(root, { recursive: true, force: true });
}
