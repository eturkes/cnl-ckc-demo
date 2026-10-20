// `pnpm palette:check` — prove the graph's node fills stay apart for every reader, colour-blind
// readers included.
//
// `CLAUDE.md` `Execution` Charts + figures: categorical marks on a map need OKLab ΔE×100 ≥ 15
// between every pair, and ≥ 8 between every pair under Machado protan and deutan simulation.
// Node kind also rides shape, legend and label, but fill is what a reader scans first.
// `tools/contrast.mjs` owns the other half of the rule, the 3:1 of each fill against the canvas.
//
// The method is coloraide's (`Color.filter(cvd, 1.0, method='machado')`, then
// `delta_e(method='ok')`), ported so the gate needs no Python: hex → linear sRGB, the Machado 2009
// severity-1 matrix applied there with no gamut clip, then OKLab and its Euclidean distance.
// `tests/palette-check.test.ts` holds the port to coloraide's own figures.
//
// Usage: node tools/palette-check.mjs

import { requireFiring } from './control.mjs';
import { rgb, themeTokens } from './contrast.mjs';

/** Unsimulated floor, OKLab ΔE×100. */
const PLAIN = 15;
/** Floor under each simulated deficiency, OKLab ΔE×100. */
const SIMULATED = 8;

/**
 * The categorical fills: one per node kind, every pair able to sit side by side on the map, so
 * every pair is graded rather than neighbours in a legend order.
 */
export const FILLS = Object.freeze([
  '--graph-document',
  '--graph-entity',
  '--graph-event',
  '--graph-operator',
  '--graph-value',
]);

/** @typedef {[number, number, number]} Vector */
/** @typedef {[Vector, Vector, Vector]} Matrix */

/**
 * Machado, Oliveira and Fernandes 2009 at severity 1.0, in linear sRGB — coloraide
 * `filters/cvd.py` `MACHADO_PROTAN[10]` and `MACHADO_DEUTAN[10]`.
 *
 * @type {Readonly<Record<'plain' | 'protan' | 'deutan', Matrix | null>>}
 */
export const VISIONS = Object.freeze({
  plain: null,
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
});

/** coloraide `spaces/srgb_linear.py` `RGB_TO_XYZ`. @type {Matrix} */
const RGB_TO_XYZ = [
  [0.4123907992659593, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151024, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
/** coloraide `spaces/oklab` `XYZD65_TO_LMS`. @type {Matrix} */
const XYZ_TO_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.03298365393238847, 0.9292868615863434, 0.03614466635064236],
  [0.04817718935962421, 0.2642395317527308, 0.6335478284694309],
];
/** coloraide `spaces/oklab` `LMS3_TO_OKLAB`. @type {Matrix} */
const LMS3_TO_OKLAB = [
  [0.21045426830931396, 0.7936177747023053, -0.0040720430116192585],
  [1.9779985324311686, -2.42859224204858, 0.450593709617411],
  [0.025904042465547734, 0.7827717124575297, -0.8086757549230774],
];

/** @param {Matrix} m @param {Vector} v @returns {Vector} */
const apply = (m, v) => {
  /** @param {Vector} row @returns {number} */
  const dot = (row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2];
  return [dot(m[0]), dot(m[1]), dot(m[2])];
};

/** @param {number} channel 0–255 @returns {number} linear light, sign kept as coloraide keeps it */
const linear = (channel) => {
  const s = channel / 255;
  return Math.abs(s) > 0.04045 ? Math.sign(s) * ((Math.abs(s) + 0.055) / 1.055) ** 2.4 : s / 12.92;
};

/**
 * OKLab of a hex colour as a reader with `vision` sees it. The simulated value may leave the
 * sRGB gamut; coloraide keeps it there unclipped, and so does this.
 *
 * @param {string} hex @param {keyof typeof VISIONS} vision @returns {Vector}
 */
export const oklab = (hex, vision) => {
  const [r, g, b] = rgb(hex, hex);
  const lin = /** @type {Vector} */ ([linear(r), linear(g), linear(b)]);
  const matrix = VISIONS[vision];
  const seen = matrix === null ? lin : apply(matrix, lin);
  const [l, m, s] = apply(XYZ_TO_LMS, apply(RGB_TO_XYZ, seen));
  return apply(LMS3_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
};

/** @param {string} a @param {string} b @param {keyof typeof VISIONS} vision @returns {number} */
export const deltaOk = (a, b, vision) => {
  const [p, q] = [oklab(a, vision), oklab(b, vision)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
};

/**
 * Every pair of the declared fills in every theme, under every vision.
 *
 * @param {readonly string[]} fills
 * @param {[string, Map<string, string>][]} themes
 * @returns {{failures: string[], graded: number}}
 */
export const gradePalette = (fills, themes) => {
  if (fills.length === 0)
    return { failures: ['the FILLS table is empty, so it grades no pair'], graded: 0 };
  /** @type {string[]} */
  const failures = [];
  let graded = 0;
  for (const [theme, tokens] of themes) {
    fills.forEach((a, at) => {
      for (const b of fills.slice(at + 1)) {
        const [hexA, hexB] = [tokens.get(a), tokens.get(b)];
        if (hexA === undefined) throw new Error(`${a} is not defined for ${theme}`);
        if (hexB === undefined) throw new Error(`${b} is not defined for ${theme}`);
        for (const vision of /** @type {(keyof typeof VISIONS)[]} */ (Object.keys(VISIONS))) {
          const floor = vision === 'plain' ? PLAIN : SIMULATED;
          // Floor rather than round, as `contrast.mjs` does: 14.999 must not report as 15 and pass.
          const delta = Math.floor(deltaOk(hexA, hexB, vision) * 100) / 100;
          graded += 1;
          if (delta < floor) {
            failures.push(
              `${theme}: ${a} vs ${b} = ${String(delta)} ${vision}, need ${String(floor)}`,
            );
          }
        }
      }
    });
  }
  return { failures, graded };
};

const main = () => {
  const { light, dark } = themeTokens();
  /** @type {[string, Map<string, string>][]} */
  const themes = [
    ['light', light],
    ['dark', dark],
  ];
  const entity = light.get('--graph-entity') ?? '';
  const controls = [
    // A fill collapsed onto another must read 0 apart.
    requireFiring(
      'palette',
      {
        mutation: '--graph-value collapsed onto --graph-entity',
        expect: ['light: --graph-entity vs --graph-value = 0 plain'],
      },
      () => gradePalette(FILLS, [['light', new Map(light).set('--graph-value', entity)]]).failures,
    ),
    // A pink and a cyan 22.68 apart unsimulated, 4.51 under protan and 5.79 under deutan
    // (coloraide): only the simulation can refuse them, so this proves it still runs.
    requireFiring(
      'palette',
      {
        mutation: 'a pair only colour-blind readers confuse as --graph-entity and --graph-event',
        expect: ['light: --graph-entity vs --graph-event = ', ' protan, need 8', ' deutan, need 8'],
      },
      () => {
        const planted = new Map(light)
          .set('--graph-entity', '#ea9cd2')
          .set('--graph-event', '#18c1ca');
        const { failures } = gradePalette(FILLS, [['light', planted]]);
        const pair = failures.filter((line) =>
          line.startsWith('light: --graph-entity vs --graph-event'),
        );
        return pair.some((line) => line.includes(' plain,')) ? [] : pair;
      },
    ),
    requireFiring(
      'palette',
      { mutation: 'the FILLS table emptied', expect: ['FILLS table is empty'] },
      () => gradePalette([], themes).failures,
    ),
  ];
  const { failures, graded } = gradePalette(FILLS, themes);
  if (failures.length > 0) {
    console.error(`palette: ${String(failures.length)} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(
    `palette: ${String(graded)} fill distances pass (${String(FILLS.length)} fills, light + dark, ` +
      `plain ≥ ${String(PLAIN)}, protan + deutan ≥ ${String(SIMULATED)}); controls: ${controls.join(', ')}`,
  );
};

if (process.argv[1] === import.meta.filename) main();
