#!/usr/bin/env node
import { execFile, execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { build, minifySync } from 'vite';

const version = process.argv[2] ?? '6.3.289';
const pdf = process.argv[3] && resolve(process.argv[3]);
const root = mkdtempSync(join(tmpdir(), 'pdfjs-probe-'));
const run = promisify(execFile);

async function download(url, path) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
}

function size(path, minify = false) {
  const source = readFileSync(path, 'utf8');
  const code = minify ? minifySync(path, source, { module: true }).code : source;
  return `${Buffer.byteLength(code)}/${gzipSync(code, { level: 9 }).byteLength}`;
}

function treeSize(path) {
  return Number(execFileSync('du', ['-sb', path], { encoding: 'utf8' }).split(/\s/, 1)[0]);
}

function files(path) {
  return readdirSync(path, { recursive: true }).map(name => join(path, name)).filter(name => statSync(name).isFile());
}

async function browserProbe(npm) {
  const fixture = join(root, 'fixture');
  const source = join(fixture, 'src');
  mkdirSync(source, { recursive: true });
  copyFileSync(join(npm, 'build/pdf.min.mjs'), join(source, 'pdf.min.mjs'));
  copyFileSync(join(npm, 'build/pdf.worker.min.mjs'), join(source, 'pdf.worker.min.mjs'));
  copyFileSync(pdf, join(source, 'guideline.pdf'));
  writeFileSync(join(fixture, 'index.html'), `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'"><p id="status">loading</p><canvas id="page"></canvas><script type="module" src="/src/main.js"></script>`);
  writeFileSync(join(source, 'main.js'), `import * as pdfjs from './pdf.min.mjs';
import workerUrl from './pdf.worker.min.mjs?url';
import pdfUrl from './guideline.pdf?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const pdf = await pdfjs.getDocument({ url: pdfUrl, useWasm: false }).promise;
const page = await pdf.getPage(19);
const viewport = page.getViewport({ scale: 0.5 });
const canvas = document.querySelector('#page');
canvas.width = viewport.width; canvas.height = viewport.height;
await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
document.querySelector('#status').textContent = \`ok pages=\${pdf.numPages} page=\${page.pageNumber} canvas=\${canvas.width}x\${canvas.height} isolated=\${crossOriginIsolated}\`;
`);
  await build({ configFile: false, root: fixture, base: './', logLevel: 'silent', build: { outDir: 'dist', emptyOutDir: true, minify: 'oxc' } });
  const dist = join(fixture, 'dist');
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.pdf': 'application/pdf' };
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(dist, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (!path.startsWith(`${resolve(dist)}/`) && path !== resolve(dist, 'index.html')) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const { port } = server.address();
    const { stdout } = await run('webcap', [`http://127.0.0.1:${port}/`, '--dom', '-', '--selector', '#status', '--wait', '1000', '--timeout', '30000'], { maxBuffer: 10_000_000 });
    const status = stdout.match(/<p id="status">([^<]+)<\/p>/)?.[1];
    if (!status?.startsWith('ok ')) throw new Error(`browser probe failed: ${status ?? 'missing status'}`);
    console.log(`vite_static\t${status}\tfiles=${files(dist).map(path => `${path.slice(dist.length + 1)}:${statSync(path).size}`).sort().join(',')}`);
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
  }
}

try {
  const registry = await (await fetch('https://registry.npmjs.org/pdfjs-dist')).json();
  const metadata = registry.versions[version];
  if (!metadata) throw new Error(`unknown pdfjs-dist ${version}`);
  const packageDir = join(root, 'npm');
  mkdirSync(packageDir);
  const tarball = join(root, 'pdfjs.tgz');
  await download(metadata.dist.tarball, tarball);
  execFileSync('tar', ['-xzf', tarball, '-C', packageDir]);

  const releaseDir = join(root, 'release');
  mkdirSync(releaseDir);
  const releaseZip = join(root, 'pdfjs-dist.zip');
  await download(`https://github.com/mozilla/pdf.js/releases/download/v${version}/pdfjs-${version}-dist.zip`, releaseZip);
  execFileSync('unzip', ['-q', releaseZip, '-d', releaseDir]);

  const npm = join(packageDir, 'package');
  const core = join(npm, 'build/pdf.min.mjs');
  const worker = join(npm, 'build/pdf.worker.min.mjs');
  const components = join(npm, 'web/pdf_viewer.mjs');
  const app = join(releaseDir, 'web/viewer.mjs');
  const css = join(releaseDir, 'web/viewer.css');
  const html = join(releaseDir, 'web/viewer.html');
  console.log(`package\tversion=${version}\tlicense=${metadata.license}\tpublished=${registry.time[version]}\tunpacked=${metadata.dist.unpackedSize}`);
  const canvasRegistry = await (await fetch('https://registry.npmjs.org/@napi-rs%2fcanvas')).json();
  const canvasVersion = canvasRegistry['dist-tags'].latest;
  const canvasLeaves = Object.keys(canvasRegistry.versions[canvasVersion].optionalDependencies ?? {});
  console.log(`dependencies\trequired=${Object.keys(metadata.dependencies ?? {}).length}\toptional=${Object.keys(metadata.optionalDependencies ?? {}).length}\toptional_names=${Object.keys(metadata.optionalDependencies ?? {}).join(',')}\tdeclared_transitive_nodes=${1 + canvasLeaves.length}\tcanvas=${canvasVersion}\tplatform_leaves=${canvasLeaves.length}`);
  console.log(`core_js\tmin/gzip=${size(core)}\tworker_min/gzip=${size(worker)}\ttotal_min=${readFileSync(core).byteLength + readFileSync(worker).byteLength}`);
  console.log(`viewer_components_js\tmin/gzip=${size(components, true)}`);
  console.log(`generic_viewer_app_js\tmin/gzip=${size(app, true)}\tcss_raw/gzip=${size(css)}\thtml_raw/gzip=${size(html)}`);
  console.log(`archives\tnpm_tree=${treeSize(npm)}\trelease_zip=${readFileSync(releaseZip).byteLength}`);
  for (const name of ['cmaps', 'iccs', 'image_decoders', 'standard_fonts', 'wasm']) console.log(`support\t${name}=${treeSize(join(npm, name))}`);
  if (pdf) await browserProbe(npm);
} finally {
  rmSync(root, { recursive: true, force: true });
}
