// U03: seven P1.3 entry classes -> pairwise-distinct typed reasons.
// U04: refusal not repair -- no rejected name is accepted in any rewritten form.
import { readBag } from '../tools/kb/bag.mjs';
import { ROOT, tar, reasonOf, detailOf } from './mkbag.mjs';

const CTRL = String.fromCharCode(1);
const NUL = String.fromCharCode(0);

const classes = {
  'non-regular type (symlink)': () => tar([{ name: `${ROOT}/l`, typeflag: '2' }]),
  'absolute path': () => tar([{ name: '/etc/passwd', data: 'x' }]),
  'dotdot segment': () => tar([{ name: `${ROOT}/../escape.pl`, data: 'x' }]),
  'control char in name': () => tar([{ name: `${ROOT}/a${CTRL}.pl`, data: 'x' }]),
  'duplicate name': () => tar([{ name: `${ROOT}/a.pl`, data: 'x' }, { name: `${ROOT}/a.pl`, data: 'y' }]),
  'resolves outside root (foreign root)': () => tar([{ name: `${ROOT}/a.pl`, data: 'x' }, { name: 'other/b.pl', data: 'y' }]),
  'size inconsistent with stream': () => tar([{ name: `${ROOT}/a.pl`, data: 'x', declaredSize: 1 << 20 }]),
};
const got = {};
for (const [k, build] of Object.entries(classes)) got[k] = reasonOf(() => readBag(build()));
console.log('--- U03 seven classes ---');
for (const [k, v] of Object.entries(got)) console.log(`  ${v.padEnd(24)} <- ${k}`);
const vals = Object.values(got);
console.log(`  distinct=${new Set(vals).size}/7  accepted=${vals.filter((v) => v === 'ACCEPTED').length}  untyped=${vals.filter((v) => v.startsWith('other:')).length}`);

console.log('--- U03 extras ---');
console.log('  NUL in long name   ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/data/g/pl/${'n'.repeat(80)}${NUL}evil.pl`, data: 'x' }]))));
console.log('  file at root       ->', reasonOf(() => readBag(tar([{ name: 'loose.pl', data: 'x' }]))));
console.log('  block device       ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/b`, typeflag: '4' }]))));
console.log('  fifo               ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/f`, typeflag: '6' }]))));
console.log('  hardlink           ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/h`, typeflag: '1' }]))));
console.log('  char device        ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/c`, typeflag: '3' }]))));
console.log('  pax header         ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/p`, typeflag: 'x', data: 'p' }]))));

console.log('--- U04 refusal-not-repair ---');
const hostile = [
  `${ROOT}/a/../a/../a`,
  `${ROOT}/../a/../a/../a`,
  '/abs.pl',
  `${ROOT}//double.pl`,
  `${ROOT}/./dot.pl`,
  `${ROOT}/a\\b.pl`,
  `${ROOT}/deep/../../../../etc/shadow`,
  `/${ROOT}/lead-slash.pl`,
];
for (const name of hostile) {
  const build = () => tar([{ name, data: 'x' }]);
  const r = reasonOf(() => readBag(build()));
  const d = String(detailOf(() => readBag(build())));
  let accepted = 'REFUSED';
  try {
    accepted = [...readBag(build()).files.keys()].join(',');
  } catch {
    /* refused */
  }
  console.log(`  ${r.padEnd(18)} verbatim=${String(d.includes(name)).padEnd(5)} accepted-as=${JSON.stringify(accepted)}  <- ${JSON.stringify(name)}`);
}
// A prefix+base split must be held to the same rules as an in-header name.
console.log('  prefix-split ..    ->', reasonOf(() => readBag(tar([{ name: 'a.pl', prefix: `${ROOT}/..`, data: 'x' }]))));
// Long-name path: the out-of-band name must face the same rules.
console.log('  long-name ..       ->', reasonOf(() => readBag(tar([{ name: `${ROOT}/../${'e'.repeat(100)}`, data: 'x' }]))));
