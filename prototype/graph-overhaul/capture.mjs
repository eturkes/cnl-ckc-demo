// Drives graph-overhaul variants through the shared hash states against a running dev server.
// node prototype/graph-overhaul/capture.mjs <outdir> [variant ...]   (default: every variant)
// Env: PROTO_ORIGIN (default http://localhost:5173). Exit 1 names each failed state.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch } from '../../tools/browser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const [out, ...only] = process.argv.slice(2);
if (out === undefined) throw new Error('usage: capture.mjs <outdir> [variant ...]');
const origin = process.env.PROTO_ORIGIN ?? 'http://localhost:5173';
const variants = only.length > 0 ? only : (await readdir(join(HERE, 'variants'))).sort();

const STATES = [
  ['overview', '#overview'],
  ['trace', '#trace=starting-opioid-therapy'],
  ['rule', '#rule=cdc2022-opioid-rec01:5'],
  ['explore', '#explore=naloxone'],
];
const RUNS = [
  [1280, 'light', STATES],
  [1280, 'dark', STATES.slice(0, 2)],
  [375, 'light', STATES],
];

await mkdir(out, { recursive: true });
const browser = await launch((m) => {
  throw new Error(m);
});
const results = [];
try {
  for (const variant of variants) {
    for (const [width, theme, states] of RUNS) {
      for (const [name, hash] of states) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
        });
        page.on('response', (r) => {
          if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${String(r.status())} ${r.url()}`);
        });
        const url = `${origin}/prototype/graph-overhaul/variants/${variant}/?theme=${theme}${hash}`;
        const file = join(out, `${variant}-${name}-${String(width)}-${theme}.png`);
        let ready = false;
        try {
          await page.goto(url);
          await page.waitForFunction((h) => document.body.dataset.ready === h, hash, { timeout: 45000 });
          ready = true;
          await page.waitForTimeout(400);
        } catch (e) {
          errors.push(`not ready: ${e.message.split('\n')[0]}`);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        await page.screenshot({ path: file, fullPage: false });
        results.push({ variant, state: name, width, theme, ready, overflow, errors, file });
        console.log(`${ready && !overflow && errors.length === 0 ? 'ok  ' : 'FAIL'} ${variant} ${name} ${String(width)} ${theme}${overflow ? ' overflow' : ''}${errors.length ? ` ${errors.join(' | ').slice(0, 200)}` : ''}`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(join(out, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((r) => !r.ready || r.overflow || r.errors.length > 0);
console.log(JSON.stringify({ variants: variants.length, states: results.length, failed: failed.length }));
process.exit(failed.length > 0 ? 1 : 0);
