import type { Point, Rect } from './oracle.js';

const quadratic = (a: number, c: number, b: number, t: number) =>
  (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t * t * b;
const roots = (a: number, b: number, c: number): number[] => {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  return [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
};
const curveHits = (a: Point, c: Point, b: Point, box: Rect) => {
  const ts = [0, 1];
  for (const [lo, hi, start, control, end] of [
    [box.left, box.right, a.x, c.x, b.x],
    [box.top, box.bottom, a.y, c.y, b.y],
  ]) {
    if (
      lo === undefined ||
      hi === undefined ||
      start === undefined ||
      control === undefined ||
      end === undefined
    )
      throw new Error('curve axis missing');
    for (const boundary of [lo, hi])
      ts.push(
        ...roots(start - 2 * control + end, 2 * (control - start), start - boundary).filter(
          (t) => t > 0 && t < 1,
        ),
      );
  }
  ts.sort((a, b) => a - b);
  const tests = [...ts, ...ts.slice(1).map((t, i) => (t + (ts[i] ?? 0)) / 2)];
  return tests.some((t) => {
    const x = quadratic(a.x, c.x, b.x, t);
    const y = quadratic(a.y, c.y, b.y, t);
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });
};
const triangleHits = (vertices: Point[], box: Rect) => {
  const corners = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ];
  const axes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    ...vertices.map((p, i) => {
      const q = vertices[(i + 1) % vertices.length] as Point;
      return { x: p.y - q.y, y: q.x - p.x };
    }),
  ];
  return axes.every((axis) => {
    const a = vertices.map((p) => p.x * axis.x + p.y * axis.y);
    const b = corners.map((p) => p.x * axis.x + p.y * axis.y);
    return Math.min(...a) <= Math.max(...b) && Math.min(...b) <= Math.max(...a);
  });
};
/** Missing-path culling considers both reflections, never the renderer's chosen sign or id order. */
export const reflectedPathHits = (
  source: Point,
  target: Point,
  targetRadius: number,
  offset: number,
  screen: Rect,
) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  // G4/G8 separate concept points; a violated premise cannot justify culling through NaN.
  if (length === 0) return true;
  const ux = dx / length;
  const uy = dy / length;
  const end = { x: target.x - (targetRadius + 1) * ux, y: target.y - (targetRadius + 1) * uy };
  const control = {
    x: (source.x + end.x) / 2 - uy * offset * 2,
    y: (source.y + end.y) / 2 + ux * offset * 2,
  };
  const arrow = [
    end,
    { x: end.x - 7 * ux - 3 * uy, y: end.y - 7 * uy + 3 * ux },
    { x: end.x - 7 * ux + 3 * uy, y: end.y - 7 * uy - 3 * ux },
  ];
  if (
    Math.max(source.x, control.x, end.x, ...arrow.map((p) => p.x)) + 0.75 < screen.left ||
    Math.min(source.x, control.x, end.x, ...arrow.map((p) => p.x)) - 0.75 > screen.right ||
    Math.max(source.y, control.y, end.y, ...arrow.map((p) => p.y)) + 0.75 < screen.top ||
    Math.min(source.y, control.y, end.y, ...arrow.map((p) => p.y)) - 0.75 > screen.bottom
  )
    return false;
  return (
    curveHits(source, control, end, {
      left: screen.left - 0.75,
      right: screen.right + 0.75,
      top: screen.top - 0.75,
      bottom: screen.bottom + 0.75,
    }) || triangleHits(arrow, screen)
  );
};
/** Each missing offset needs one remaining direction with an allowed off-canvas placement. */
export const canCullAll = (
  offsets: number[],
  directions: { source: Point; target: Point; radius: number }[],
  screen: Rect,
) => {
  if (offsets.length !== directions.length) return false;
  const owner = new Map<number, number>();
  const place = (i: number, seen: Set<number>): boolean => {
    const offset = offsets[i];
    if (offset === undefined) return false;
    for (let j = 0; j < directions.length; j++) {
      if (seen.has(j)) continue;
      const d = directions[j];
      if (!d) continue;
      if (
        reflectedPathHits(d.source, d.target, d.radius, offset, screen) &&
        reflectedPathHits(d.source, d.target, d.radius, -offset, screen)
      )
        continue;
      seen.add(j);
      const prior = owner.get(j);
      if (prior === undefined || place(prior, seen)) {
        owner.set(j, i);
        return true;
      }
    }
    return false;
  };
  return offsets.every((_, i) => place(i, new Set()));
};
