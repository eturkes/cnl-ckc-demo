import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, 'tools/kb/clinical.mjs');
const buildPath = join(root, 'tools/kb/build.mjs');
const original = readFileSync(sourcePath, 'utf8');
const needle = '`${group.mode},[${group.actions.map(actionTerm).join(\',\')}])`';
const changed = '`${\'can\'},[${group.actions.map(actionTerm).join(\',\')}])`';
assert.equal(original.split(needle).length - 1, 1, 'probe mutation must have one target');

let accepted = false;
try {
  writeFileSync(sourcePath, original.replace(needle, changed));
  try {
    execFileSync(process.execPath, [buildPath, '--force'], { stdio: 'pipe' });
    accepted = true;
  } catch {
    accepted = false;
  }
} finally {
  writeFileSync(sourcePath, original);
  execFileSync(process.execPath, [buildPath, '--force'], { stdio: 'pipe' });
}

assert.equal(
  accepted,
  false,
  'kb:build must reject an emitted answer modality that no longer byte-round-trips to source ACE',
);
