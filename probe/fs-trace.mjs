// Traces every host-fs write/mkdir/rename/open-for-write during a build.
// Logs through pre-captured originals + a reentrancy guard: appendFileSync
// internally calls writeFileSync, so a naive wrapper recurses forever.
import fs from 'node:fs';
const openSync = fs.openSync, writeSync = fs.writeSync;
const fd = openSync(process.env.FSTRACE_LOG, 'a');
let inside = false;
const OPS = ['writeFileSync','appendFileSync','mkdirSync','renameSync','copyFileSync','symlinkSync','linkSync','openSync','createWriteStream','writeSync','rmSync','unlinkSync','truncateSync','cpSync','mkdtempSync','promises'];
for (const op of OPS) {
  const orig = fs[op];
  if (typeof orig !== 'function') continue;
  fs[op] = function (...args) {
    if (!inside) { inside = true; try { writeSync(fd, `${op} ${String(args[0])}\n`); } finally { inside = false; } }
    return orig.apply(this, args);
  };
}
