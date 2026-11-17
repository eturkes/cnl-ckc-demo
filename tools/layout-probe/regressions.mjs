import { normalizePath } from './shape.ts';

// Observed R6 counterexample: a legal quadratic becomes nearly linear on x after DPR3 conversion.
export const assertGeometryRegressions = () => {
  const css = (/** @type {number} */ x, /** @type {number} */ y) => ({
    x: (x * 3) / 3,
    y: (y * 3) / 3,
  });
  const start = css(3142.9173642932888, 5068.6423033142155);
  const control = css(3198.729980189949, 5058.6423033142155);
  const end = css(3254.5425960866096, 5068.6423033142155);
  if (!normalizePath(start, [{ control, end }]).valid)
    throw new Error('R6 matcher regression: near-linear DPR3 quadratic rejected');
  const origin = { x: 0, y: 0 };
  for (const segments of [
    [{ end: origin, control: null }],
    [{ end: origin, control: { x: 0, y: 20 } }],
    [
      { end: { x: 0, y: 10 }, control: { x: 0, y: 10 } },
      { end: origin, control: { x: 0, y: 10 } },
    ],
    [{ end: { x: -3, y: 0 }, control: null }],
  ])
    if (!normalizePath(origin, segments).valid)
      throw new Error('R6 matcher regression: contact/overshoot geometry rejected');
};
