import type { Point } from './oracle.js';

export interface Segment {
  end: Point;
  control: Point | null;
}
const EPS = 1e-6;
const close = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= EPS;
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const roots = (a: number, b: number, c: number): number[] => {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const d = b * b - 4 * a * c;
  if (d < 0) return [];
  const k = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(d));
  return k === 0 ? [-b / (2 * a)] : [k / a, c / k];
};
/** Normalize one geometric line/quadratic even when native calls subdivide or overdraw it. */
export const normalizePath = (
  start: Point,
  segments: Segment[],
): { end: Point; control: Point | null; valid: boolean } => {
  const end = segments.at(-1)?.end ?? start;
  const chord = subtract(end, start);
  const length = Math.hypot(chord.x, chord.y);
  if (length <= EPS) {
    const points = segments.flatMap((s) => (s.control ? [s.control, s.end] : [s.end]));
    if (![start, ...points].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
      return { end, control: null, valid: false };
    const direction = points.find((p) => Math.hypot(p.x - start.x, p.y - start.y) > EPS);
    if (!direction) return { end, control: null, valid: true };
    const axis = subtract(direction, start);
    const magnitude = Math.hypot(axis.x, axis.y);
    if (!points.every((p) => Math.abs(cross(subtract(p, start), axis)) / magnitude <= EPS))
      return { end, control: null, valid: false };
    const project = (p: Point) => ((p.x - start.x) * axis.x + (p.y - start.y) * axis.y) / magnitude;
    let from = 0;
    let low = 0;
    let high = 0;
    for (const segment of segments) {
      const to = project(segment.end);
      const values = [from, to];
      if (segment.control) {
        const c = project(segment.control);
        const denominator = from - 2 * c + to;
        const t = denominator === 0 ? 0 : (from - c) / denominator;
        if (t > 0 && t < 1) values.push((1 - t) ** 2 * from + 2 * (1 - t) * t * c + t * t * to);
      }
      low = Math.min(low, ...values);
      high = Math.max(high, ...values);
      from = to;
    }
    if (low < -EPS && high > EPS) return { end, control: null, valid: false };
    const far = Math.abs(low) > Math.abs(high) ? low : high;
    return {
      end,
      control: {
        x: start.x + (2 * axis.x * far) / magnitude,
        y: start.y + (2 * axis.y * far) / magnitude,
      },
      valid: true,
    };
  }
  const projected = (p: Point) =>
    ((p.x - start.x) * chord.x + (p.y - start.y) * chord.y) / (length * length);
  const collinear = (p: Point) => Math.abs(cross(subtract(p, start), chord)) / length <= EPS;
  const points = segments.flatMap((s) => (s.control ? [s.control, s.end] : [s.end]));
  if (points.every(collinear)) {
    let from = 0;
    let valid = true;
    for (const s of segments) {
      const to = projected(s.end);
      const samples = [from, to];
      if (s.control) {
        const c = projected(s.control);
        const t = (from - c) / (from - 2 * c + to);
        if (t > 0 && t < 1) samples.push((1 - t) ** 2 * from + 2 * (1 - t) * t * c + t * t * to);
      }
      if (samples.some((t) => t * length < -EPS || (t - 1) * length > EPS)) valid = false;
      from = to;
    }
    return { end, control: null, valid };
  }
  const first = segments[0]?.control;
  const last = segments.at(-1)?.control;
  if (!first || !last || segments.some((s) => s.control === null))
    return { end, control: null, valid: false };
  const r = subtract(first, start);
  const s = subtract(last, end);
  const determinant = cross(r, s);
  if (Math.abs(determinant) < 1e-12) return { end, control: null, valid: false };
  const scale = cross(chord, s) / determinant;
  const control = { x: start.x + scale * r.x, y: start.y + scale * r.y };
  const A = { x: start.x - 2 * control.x + end.x, y: start.y - 2 * control.y + end.y };
  const B = { x: 2 * (control.x - start.x), y: 2 * (control.y - start.y) };
  const q = (t: number) => ({
    x: start.x + B.x * t + A.x * t * t,
    y: start.y + B.y * t + A.y * t * t,
  });
  const axis = Math.abs(A.x) + Math.abs(B.x) > Math.abs(A.y) + Math.abs(B.y) ? 'x' : 'y';
  let t0 = 0;
  let valid = true;
  for (const segment of segments) {
    const candidates = roots(A[axis], B[axis], start[axis] - segment.end[axis]).filter(
      (t) => t >= -EPS && t <= 1 + EPS && close(q(t), segment.end),
    );
    const t1 = candidates.find((t) => {
      const c = {
        x: q(t0).x + ((t - t0) * (B.x + 2 * A.x * t0)) / 2,
        y: q(t0).y + ((t - t0) * (B.y + 2 * A.y * t0)) / 2,
      };
      return segment.control !== null && close(c, segment.control);
    });
    if (t1 === undefined) {
      valid = false;
      break;
    }
    t0 = t1;
  }
  return { end, control, valid: valid && Math.abs(t0 - 1) <= EPS };
};
