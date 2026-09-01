import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fresh = mkdtempSync(join(ROOT, '.spike-m1u4-src-typecheck-'));
/**
 * @param {string} command
 * @param {readonly string[]} args
 */
const run = (command, args) =>
  spawnSync(command, args, {
    cwd: fresh,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
  });

try {
  const archive = spawnSync('git', ['archive', 'HEAD'], {
    cwd: ROOT,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (archive.status !== 0) throw archive.error ?? new Error(archive.stderr.toString());
  const extracted = spawnSync('tar', ['-x', '-C', fresh], { input: archive.stdout });
  if (extracted.status !== 0) throw new Error(extracted.stderr.toString());
  symlinkSync(join(ROOT, 'node_modules'), join(fresh, 'node_modules'), 'dir');

  const spike = join(fresh, 'spikes', 'm1u4-src');
  mkdirSync(spike, { recursive: true });
  for (const name of ['catalog.ts', 'ui-consumer.ts']) {
    copyFileSync(join(ROOT, 'spikes', 'm1u4-src', name), join(spike, name));
  }
  const generated = existsSync(join(fresh, 'kb', 'generated'));

  const targeted = run('pnpm', [
    'exec',
    'tsc',
    '--noEmit',
    '--strict',
    '--noUncheckedIndexedAccess',
    '--exactOptionalPropertyTypes',
    '--target',
    'ES2022',
    '--module',
    'ESNext',
    '--moduleResolution',
    'bundler',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    '--types',
    'node,vite/client',
    '--skipLibCheck',
    'spikes/m1u4-src/catalog.ts',
    'spikes/m1u4-src/ui-consumer.ts',
  ]);
  if (targeted.status !== 0) {
    process.stderr.write(targeted.stdout);
    process.stderr.write(targeted.stderr);
    process.exit(targeted.status ?? 1);
  }

  const full = run('pnpm', ['check']);
  const diagnostics = `${full.stdout}\n${full.stderr}`;
  const modules = [
    ...new Set([...diagnostics.matchAll(/Cannot find module '([^']+)'/g)].map((match) => match[1])),
  ];
  if (full.status === 0) throw new Error('fresh full-project check unexpectedly passed');
  process.stdout.write(
    `SRC_FRESH_TYPECHECK\tgenerated=${generated}\ttargetedRc=${targeted.status}\tfullRc=${full.status}\tmissingModules=${modules.join(',')}\n`,
  );
} finally {
  rmSync(fresh, { recursive: true, force: true });
}
