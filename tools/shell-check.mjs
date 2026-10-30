// `pnpm shell:check` — ShellCheck over every tracked shell script. The binary is one pinned
// release fetched by its digest, so the gate, CI and the pool hosts all run the same ShellCheck
// whatever the host carries, and a host install never decides a finding.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { requireFiring } from './control.mjs';
import { ROOT } from './kb/paths.mjs';

const VERSION = 'v0.11.0';
/** `node` platform.arch → release build + its `.tar.gz` digest, as GitHub reports the asset. */
const BUILDS = /** @type {Record<string, [string, string]>} */ ({
  'linux.x64': ['linux.x86_64', 'b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6'],
  'linux.arm64': [
    'linux.aarch64',
    '68a8133197a50beb8803f8d42f9908d1af1c5540d4bb05fdfca8c1fa47decefc',
  ],
  'darwin.x64': [
    'darwin.x86_64',
    'c2c15e08df0e8fbc374c335b230a7ee958c313fa5714817a59aa59f1aa594f51',
  ],
  'darwin.arm64': [
    'darwin.aarch64',
    '339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f',
  ],
});
const DIRECTIVE = '# shellcheck disable=SC2016';

/**
 * The archive's one member named `*\/shellcheck`, read off its ustar headers.
 *
 * @param {Buffer} tar
 * @returns {Buffer}
 */
const member = (tar) => {
  for (let at = 0; at + 512 <= tar.length && tar[at] !== 0;) {
    const name = tar.toString('latin1', at, at + 100).replace(/\0.*$/su, '');
    const size = Number.parseInt(tar.toString('latin1', at + 124, at + 136).trim(), 8);
    if (name.endsWith('/shellcheck')) return tar.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`no shellcheck binary in the ${VERSION} archive`);
};

/** @returns {Promise<string>} the cached binary, fetched and verified on first use */
const binary = async () => {
  const build = BUILDS[`${process.platform}.${process.arch}`];
  if (build === undefined) {
    throw new Error(`no pinned ShellCheck build for ${process.platform}.${process.arch}`);
  }
  const [target, digest] = build;
  const dir = join(ROOT, 'node_modules', '.cache', 'shellcheck', `${VERSION}.${target}`);
  const path = join(dir, 'shellcheck');
  if (existsSync(path)) return path;
  const url = `https://github.com/koalaman/shellcheck/releases/download/${VERSION}/shellcheck-${VERSION}.${target}.tar.gz`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== digest) throw new Error(`${url}: sha256 ${actual}, pinned ${digest}`);
  mkdirSync(dir, { recursive: true });
  // Written aside, then renamed: an interrupted fetch never leaves a cached binary behind.
  writeFileSync(`${path}.partial`, member(gunzipSync(archive)));
  chmodSync(`${path}.partial`, 0o755);
  renameSync(`${path}.partial`, path);
  return path;
};

/** @returns {string[]} tracked files named `*.sh` or opening with a POSIX-family shebang */
const scripts = () =>
  execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((file) => {
      if (file === '') return false;
      if (file.endsWith('.sh')) return true;
      if (!existsSync(join(ROOT, file))) return false;
      const head = readFileSync(join(ROOT, file), 'latin1').slice(0, 128).split('\n')[0] ?? '';
      return /^#!.*[/ ](?:ba|da|k)?sh\b/u.test(head);
    });

/**
 * @param {string} shellcheck
 * @param {string[]} files repo-relative, or `-` with `input` on stdin
 * @param {string} [input]
 * @returns {string[]} findings; empty = rc 0
 */
const grade = (shellcheck, files, input) => {
  if (files.length === 0) throw new Error('no shell script found, so ShellCheck grades nothing');
  const run = spawnSync(shellcheck, ['--format=gcc', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
  });
  if (run.status === 0) return [];
  const findings = `${run.stdout}${run.stderr}`.split('\n').filter((line) => line !== '');
  return findings.length > 0 ? findings : [`shellcheck exited ${String(run.status)}`];
};

const shellcheck = await binary();
const files = scripts();
const findings = grade(shellcheck, files);
if (findings.length > 0) {
  console.error(`shell:check failed — ${findings.join('\n')}`);
  process.exit(1);
}

const specLint = readFileSync(join(ROOT, '.agent/spec-lint'), 'utf8');
const controls = [
  requireFiring(
    'shell:check',
    {
      mutation: `.agent/spec-lint with its \`${DIRECTIVE}\` line removed`,
      expect: ['[SC2016]'],
    },
    () => {
      const lines = specLint.split('\n');
      const kept = lines.filter((line) => !line.startsWith(DIRECTIVE));
      if (kept.length !== lines.length - 1) throw new Error(`${DIRECTIVE} is not one line`);
      return grade(shellcheck, ['-'], kept.join('\n'));
    },
  ),
  requireFiring(
    'shell:check',
    { mutation: 'the script set emptied', expect: ['no shell script found'] },
    () => grade(shellcheck, []),
  ),
];

console.log(
  `shell:check ok — ShellCheck ${VERSION} passes ${String(files.length)} scripts ` +
    `(${files.join(', ')}); controls: ${controls.join(', ')}`,
);
