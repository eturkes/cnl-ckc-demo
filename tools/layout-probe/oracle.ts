import type { Call, State } from './observe.js';
import { canCullAll } from './path.js';
import { normalizePath, type Segment } from './shape.js';
import { predicateFailure } from './failure.mjs';

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface NodeModel extends Point {
  id: string;
  W: number;
  H: number;
  label: readonly string[];
  reveal: number;
}
export interface Block {
  id: string;
  W: number;
  H: number;
  readings: readonly (readonly string[])[];
}
export interface Line {
  id: string;
  source: string;
  target: string;
}
export interface Camera {
  zoom: number;
  pan: Point;
  minZoom: number;
  maxZoom: number;
}
export type Ink = Record<string, { top: number; bottom: number }>;
export interface Result {
  errors: Record<string, string[]>;
  counts: Record<string, number>;
}
export interface Unit {
  id: string;
  part: 'label' | 'block';
  index: number;
  text: string;
  x: number;
  y: number;
  region: Rect;
}
export interface TextReading {
  unit: Unit;
  ink: Rect;
  kind: string;
}
export const TOL = 1e-6;
export const near = (a: number, b: number) => Number.isFinite(a) && Math.abs(a - b) <= TOL;
export const inside = (a: Rect, b: Rect) =>
  b.left >= a.left - TOL &&
  b.right <= a.right + TOL &&
  b.top >= a.top - TOL &&
  b.bottom <= a.bottom + TOL;
export const meets = (a: Rect, b: Rect) =>
  a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
export const point = (n: Point, camera: Camera) => ({
  x: n.x * camera.zoom + camera.pan.x,
  y: n.y * camera.zoom + camera.pan.y,
});
export const labelRegion = (n: NodeModel, p: Point): Rect => ({
  left: p.x - n.W / 2,
  right: p.x + n.W / 2,
  top: p.y + 13,
  bottom: p.y + 13 + n.H,
});
export const blockRegion = (n: NodeModel, b: Block, p: Point): Rect => ({
  left: p.x - b.W / 2,
  right: p.x + b.W / 2,
  top: p.y + 13 + n.H + 4,
  bottom: p.y + 13 + n.H + 4 + b.H,
});
const radius = (id: string) =>
  ['acute-pain', 'subacute-pain', 'chronic-pain'].includes(id) ? 9 : 5;
const pair = (a: string, b: string) => [a, b].sort().join('\0');
const key = (p: Point) => `${p.x.toFixed(3)}:${p.y.toFixed(3)}`;
const transform = (s: State, p: Point, dpr: number): Point => {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = s.transform;
  return { x: (a * p.x + c * p.y + e) / dpr, y: (b * p.x + d * p.y + f) / dpr };
};
const rectTransform = (s: State, r: Rect, dpr: number): Rect => {
  const ps = [
    { x: r.left, y: r.top },
    { x: r.right, y: r.top },
    { x: r.left, y: r.bottom },
    { x: r.right, y: r.bottom },
  ].map((p) => transform(s, p, dpr));
  return {
    left: Math.min(...ps.map((p) => p.x)),
    right: Math.max(...ps.map((p) => p.x)),
    top: Math.min(...ps.map((p) => p.y)),
    bottom: Math.max(...ps.map((p) => p.y)),
  };
};
export const unitsOf = (
  nodes: readonly NodeModel[],
  subject: string | null,
  blocks: readonly Block[],
  camera: Camera,
): Unit[] =>
  nodes.flatMap((n) => {
    const p = point(n, camera);
    const label = labelRegion(n, p);
    const units: Unit[] = n.label.map((text, index) => ({
      id: n.id,
      part: 'label',
      index,
      text,
      x: p.x,
      y: p.y + 26 + index * 15.6,
      region: label,
    }));
    const b = n.id === subject ? blocks.find((b) => b.id === n.id) : undefined;
    if (b)
      units.push(
        ...b.readings.flat().map((text, index) => ({
          id: n.id,
          part: 'block' as const,
          index,
          text,
          x: p.x,
          y: p.y + 26 + n.H + 4 + index * 15.6,
          region: blockRegion(n, b, p),
        })),
      );
    return units;
  });

export const grade = (input: {
  calls: Call[];
  nodes: readonly NodeModel[];
  lines: readonly Line[];
  subject: string | null;
  blocks: readonly Block[];
  camera: Camera;
  width: number;
  height: number;
  dpr: number;
  font: string;
  colours: Record<string, string>;
  ink: Ink;
  at: string;
  overlap?: boolean;
  failFast?: boolean;
}): Result & { texts: TextReading[]; dots: Map<string, Point> } => {
  const {
    calls,
    nodes,
    lines,
    subject,
    blocks,
    camera,
    width,
    height,
    dpr,
    font,
    colours,
    ink,
    at,
  } = input;
  const result: Result = { errors: {}, counts: { frames: 1 } };
  const req = (ok: boolean, rule: string, detail: string) => {
    if (!ok) {
      if (input.failFast) throw predicateFailure(rule, `${at}/${detail}`);
      const row = (result.errors[rule] ??= []);
      if (row.length < 3) row.push(`${at}/${detail}`);
    }
  };
  const add = (name: string, n = 1) => {
    result.counts[name] = (result.counts[name] ?? 0) + n;
  };
  const screen = { left: 0, top: 0, right: width, bottom: height };
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const proposals = nodes.map((n) => ({ n, p: point(n, camera) }));
  const proposalMap = new Map(proposals.map((p) => [p.n.id, p]));
  const buckets = new Map<string, typeof proposals>();
  for (const p of proposals) {
    const group = buckets.get(key(p.p)) ?? [];
    group.push(p);
    buckets.set(key(p.p), group);
  }
  const matchPoint = (p: Point) => {
    const local = (buckets.get(key(p)) ?? []).filter((q) => near(q.p.x, p.x) && near(q.p.y, p.y));
    return local.length ? local : proposals.filter((q) => near(q.p.x, p.x) && near(q.p.y, p.y));
  };
  const dots = new Map<string, Point>();
  const arrows: { vertices: Point[]; state: State }[] = [];
  const paths: { start: Point; end: Point; control: Point | null; state: State }[] = [];
  let path: Call[] = [];
  const transforms = new Set<readonly number[]>();
  for (const call of calls) {
    const m = call.state.transform;
    if (
      [
        'arc',
        'moveTo',
        'lineTo',
        'quadraticCurveTo',
        'stroke',
        'fill',
        'fillRect',
        'fillText',
        'strokeText',
      ].includes(call.name) ||
      call === calls[0]
    )
      if (!transforms.has(m)) {
        transforms.add(m);
        req(
          m.length === 6 &&
            near(m[0] ?? 0, dpr) &&
            near(m[1] ?? 0, 0) &&
            near(m[2] ?? 0, 0) &&
            near(m[3] ?? 0, dpr) &&
            near(m[4] ?? 0, 0) &&
            near(m[5] ?? 0, 0),
          'R3',
          `DPR transform ${JSON.stringify(m)} expected ${String(dpr)}`,
        );
      }
    if (call.name === 'beginPath') {
      path = [];
      continue;
    }
    if (['moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'closePath'].includes(call.name)) {
      path.push(call);
      continue;
    }
    if (call.name === 'fill') {
      for (const arc of path.filter((p) => p.name === 'arc')) {
        const p = transform(arc.state, { x: Number(arc.args[0]), y: Number(arc.args[1]) }, dpr);
        const matches = matchPoint(p);
        req(matches.length === 1, 'R3', `unidentified/ambiguous dot at ${JSON.stringify(p)}`);
        const found = matches[0];
        if (!found) continue;
        req(
          Math.abs(Number(arc.args[4]) - Number(arc.args[3])) >= 2 * Math.PI - TOL,
          'R3',
          `${found.n.id}: dot arc is not a whole circle`,
        );
        dots.set(found.n.id, p);
        req(
          near((Number(arc.args[2]) * Math.hypot(m[0] ?? 0, m[1] ?? 0)) / dpr, radius(found.n.id)),
          'R3',
          `${found.n.id}: dot radius not screen-fixed`,
        );
        req(
          call.state.fill === colours[found.n.id],
          'R3',
          `${found.n.id}: dot fill differs from token`,
        );
        add('dots');
      }
      if (!path.some((p) => p.name === 'arc')) {
        let vertices: Point[] = [];
        for (const segment of [...path, { ...call, name: 'moveTo', args: [] }]) {
          if (segment.name === 'moveTo' && vertices.length) {
            if (vertices.length === 3) arrows.push({ vertices, state: call.state });
            vertices = [];
          }
          if ((segment.name === 'moveTo' || segment.name === 'lineTo') && segment.args.length >= 2)
            vertices.push(
              transform(
                segment.state,
                { x: Number(segment.args[0]), y: Number(segment.args[1]) },
                dpr,
              ),
            );
        }
      }
    }
    if (call.name === 'stroke') {
      let start: Point | undefined;
      let segments: Segment[] = [];
      const finish = () => {
        if (start && segments.length) {
          const shape = normalizePath(start, segments);
          req(
            shape.valid,
            'R6',
            'stroked subpath is neither the declared straight line nor a quadratic',
          );
          paths.push({ start, end: shape.end, control: shape.control, state: call.state });
        }
        start = undefined;
        segments = [];
      };
      for (const segment of path) {
        if (segment.name === 'moveTo') {
          finish();
          start = transform(
            segment.state,
            { x: Number(segment.args[0]), y: Number(segment.args[1]) },
            dpr,
          );
        }
        if (segment.name === 'lineTo')
          segments.push({
            end: transform(
              segment.state,
              { x: Number(segment.args[0]), y: Number(segment.args[1]) },
              dpr,
            ),
            control: null,
          });
        if (segment.name === 'quadraticCurveTo')
          segments.push({
            control: transform(
              segment.state,
              { x: Number(segment.args[0]), y: Number(segment.args[1]) },
              dpr,
            ),
            end: transform(
              segment.state,
              { x: Number(segment.args[2]), y: Number(segment.args[3]) },
              dpr,
            ),
          });
        if (segment.name === 'closePath' && start) segments.push({ end: start, control: null });
        if (segment.name === 'arc') req(false, 'R6', 'unexpected stroked arc');
      }
      finish();
    }
  }
  req(
    calls[0]?.name === 'setTransform' && calls.some((c) => c.name === 'fillRect'),
    'R2',
    'no observed full-canvas frame',
  );
  for (const { n, p } of proposals) {
    const r = radius(n.id);
    if (meets(screen, { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r }))
      req(dots.has(n.id), 'R3', `${n.id}: dot meets canvas but no filled arc`);
  }
  const units = unitsOf(nodes, subject, blocks, camera);
  const indexed = new Map<string, Unit[]>();
  for (const unit of units) {
    const k = unit.text;
    const group = indexed.get(k) ?? [];
    group.push(unit);
    indexed.set(k, group);
  }
  const seen = new Map<string, { fills: number; strokes: number; last: string }>();
  const texts: TextReading[] = [];
  const drawn = new Set<string>();
  const parts = new Set<string>();
  for (const call of calls.filter((c) => c.name === 'fillText' || c.name === 'strokeText')) {
    req(
      call.state.font === font && call.state.textRendering === 'geometricPrecision',
      'R1',
      `text ${JSON.stringify(call.args[0])}: font ${call.state.font} rendering ${call.state.textRendering} expected ${font} geometricPrecision`,
    );
    req(
      call.state.align === 'center' &&
        call.state.baseline === 'alphabetic' &&
        (call.args[3] === undefined || Number(call.args[3]) >= (call.advance ?? Infinity)),
      'R2',
      `text ${JSON.stringify(call.args[0])}: alignment/baseline/maxWidth differs`,
    );
    const p = transform(call.state, { x: Number(call.args[1]), y: Number(call.args[2]) }, dpr);
    const candidates = (indexed.get(String(call.args[0])) ?? [])
      .filter((u) => near(u.x, p.x))
      .sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y));
    const unit = candidates[0];
    req(!!unit, 'R2', `unassigned text ${JSON.stringify(call.args[0])} at ${JSON.stringify(p)}`);
    if (!unit) continue;
    req(
      near(p.y, unit.y),
      'R2',
      `${unit.id}/${unit.part}/${String(unit.index)}: baseline ${String(p.y)} expected ${String(unit.y)}`,
    );
    const ext = ink[unit.text];
    if (!ext) throw new Error(`no HB ink ${unit.text}`);
    const fontSize = Number(/([\d.]+)px/u.exec(call.state.font)?.[1] ?? NaN);
    const scale = fontSize / 13;
    const halo = call.name === 'strokeText' ? call.state.width / 2 : 0;
    const rect = rectTransform(
      call.state,
      {
        left: Number(call.args[1]) - (call.left ?? NaN) - halo,
        right: Number(call.args[1]) + (call.right ?? NaN) + halo,
        top: Number(call.args[2]) + ext.top * scale - halo,
        bottom: Number(call.args[2]) + ext.bottom * scale + halo,
      },
      dpr,
    );
    req(
      inside(unit.region, rect),
      'R2',
      `${unit.id}/${unit.part}/${String(unit.index)}: ink ${JSON.stringify(rect)} outside ${JSON.stringify(unit.region)}`,
    );
    if (call.name === 'fillText')
      req(
        call.state.fill === colours[unit.part === 'label' ? '--text' : '--text-muted'],
        'R2',
        `${unit.id}/${unit.part}: text colour differs from token`,
      );
    else
      req(
        call.state.stroke === colours['--surface-sunken'],
        'R2',
        `${unit.id}: halo colour differs from token`,
      );
    if (call.name === 'strokeText')
      req(
        near(call.state.width, 6) && call.state.join === 'round',
        'R3',
        `${unit.id}: halo width/join not fixed`,
      );
    req(call.state.alpha === 1, 'R2', `${unit.id}: transparent text call`);
    const id = `${unit.id}\0${unit.part}\0${String(unit.index)}`;
    const record = seen.get(id) ?? { fills: 0, strokes: 0, last: '' };
    if (call.name === 'fillText') {
      req(record.strokes > 0, 'R2', `${unit.id}: halo must precede fill`);
      record.fills++;
    } else record.strokes++;
    if (unit.part === 'label') drawn.add(unit.id);
    parts.add(`${unit.id}\0${unit.part}`);
    record.last = call.name;
    seen.set(id, record);
    texts.push({ unit, ink: rect, kind: call.name });
    add('textCalls');
  }
  for (const unit of units) {
    const eligible =
      unit.part === 'block' ||
      unit.id === subject ||
      (nodeMap.get(unit.id)?.reveal ?? Infinity) <= camera.zoom;
    const any = parts.has(`${unit.id}\0${unit.part}`);
    const required = unit.part === 'block' && eligible && meets(screen, unit.region);
    const record = seen.get(`${unit.id}\0${unit.part}\0${String(unit.index)}`);
    if (required || any)
      req(
        (record?.fills ?? 0) >= 1 && (record?.strokes ?? 0) >= 1 && record?.last === 'fillText',
        'R2',
        `${unit.id}/${unit.part}/${String(unit.index)}: missing/duplicate/wrong line`,
      );
  }
  const expectedSet = new Set(
    proposals
      .filter(({ n, p }) => n.reveal <= camera.zoom && meets(screen, labelRegion(n, p)))
      .map(({ n }) => n.id),
  );
  const actualSet = new Set(
    [...drawn].filter((id) => {
      const n = nodeMap.get(id);
      return n !== undefined && meets(screen, labelRegion(n, point(n, camera)));
    }),
  );
  const missing = [...expectedSet].find((id) => !actualSet.has(id));
  const extra = [...actualSet].find((id) => !expectedSet.has(id));
  req(
    missing === undefined && extra === undefined,
    'R3',
    `shown-set missing=${missing ?? 'none'} extra=${extra ?? 'none'}`,
  );
  add('shownSets');
  if (input.overlap) {
    const regions = [...actualSet].map((id) => {
      const n = nodeMap.get(id) as NodeModel;
      return { id, rect: labelRegion(n, point(n, camera)) };
    });
    if (subject) {
      const n = nodeMap.get(subject);
      const b = blocks.find((b) => b.id === subject);
      if (n && b && seen.has(`${subject}\0block\0${0}`))
        regions.push({ id: `block:${subject}`, rect: blockRegion(n, b, point(n, camera)) });
    }
    regions.sort((a, b) => a.rect.left - b.rect.left);
    for (let i = 0; i < regions.length; i++) {
      const a = regions[i];
      if (!a) continue;
      for (let j = i + 1; j < regions.length; j++) {
        const b = regions[j];
        if (!b || b.rect.left >= a.rect.right - TOL) break;
        req(
          !(a.rect.top < b.rect.bottom - TOL && b.rect.top < a.rect.bottom - TOL),
          'R3',
          `label-region overlap ${a.id}/${b.id}`,
        );
      }
    }
    add('overlapFrames');
  }
  const groups = new Map<string, Line[]>();
  const outgoing = new Map<string, Line[]>();
  for (const line of lines) {
    const k = pair(line.source, line.target);
    const group = groups.get(k) ?? [];
    group.push(line);
    groups.set(k, group);
    const incident = outgoing.get(line.source) ?? [];
    incident.push(line);
    outgoing.set(line.source, incident);
  }
  const observed = new Map<string, typeof paths>();
  const usedArrows = new Set<number>();
  const arrowTips = new Map<string, number[]>();
  arrows.forEach((arrow, index) => {
    for (const vertex of arrow.vertices) {
      const k = key(vertex);
      const ids = arrowTips.get(k) ?? [];
      ids.push(index);
      arrowTips.set(k, ids);
    }
  });
  for (const path of paths) {
    const source = matchPoint(path.start);
    const s = source[0];
    req(source.length === 1, 'R6', `path source not a concept ${JSON.stringify(path.start)}`);
    if (!s) continue;
    const possible = (outgoing.get(s.n.id) ?? []).filter((l) => {
      const target = proposalMap.get(l.target);
      return (
        target &&
        near(Math.hypot(path.end.x - target.p.x, path.end.y - target.p.y), radius(l.target) + 1)
      );
    });
    const targets = [...new Set(possible.map((l) => l.target))];
    req(targets.length === 1, 'R6', `path from ${s.n.id}: end is not one target rim`);
    const target = targets[0];
    if (!target) continue;
    const k = pair(s.n.id, target);
    const group = observed.get(k) ?? [];
    group.push(path);
    observed.set(k, group);
    req(
      near(
        (path.state.width *
          Math.hypot(path.state.transform[0] ?? 0, path.state.transform[1] ?? 0)) /
          dpr,
        1.5,
      ),
      'R3',
      `${s.n.id}/${target}: line width differs`,
    );
    const matching = (arrowTips.get(key(path.end)) ?? []).filter((index) =>
      arrows[index]?.vertices.some((v) => near(v.x, path.end.x) && near(v.y, path.end.y)),
    );
    req(matching.length > 0, 'R6', `${s.n.id}/${target}: arrowhead missing`);
    for (const index of matching) {
      usedArrows.add(index);
      const arrow = arrows[index];
      if (!arrow) continue;
      const rest = arrow.vertices.filter((v) => !(near(v.x, path.end.x) && near(v.y, path.end.y)));
      const a = rest[0];
      const b = rest[1];
      if (a && b) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        req(
          near(Math.hypot(a.x - b.x, a.y - b.y), 6) &&
            near(Math.hypot(mid.x - path.end.x, mid.y - path.end.y), 7) &&
            near((a.x - b.x) * (mid.x - path.end.x) + (a.y - b.y) * (mid.y - path.end.y), 0),
          'R6',
          `${s.n.id}/${target}: arrow dimensions differ`,
        );
      } else req(false, 'R6', `${s.n.id}/${target}: arrow is not a triangle`);
      req(
        arrow.state.fill === colours['--graph-edge'],
        'R6',
        `${s.n.id}/${target}: arrow colour differs from token`,
      );
    }
    req(
      path.state.stroke === colours['--graph-edge'],
      'R6',
      `${s.n.id}/${target}: line colour differs from token`,
    );
    add('paths');
  }
  req(usedArrows.size === arrows.length, 'R6', 'unexpected/unassigned arrowhead');
  for (const [k, group] of groups) {
    const first = group[0];
    if (!first) continue;
    const a = proposalMap.get(first.source)?.p;
    const b = proposalMap.get(first.target)?.p;
    if (!a || !b) continue;
    const drawnPaths: typeof paths = [];
    const samePoint = (a: Point, b: Point) => near(a.x, b.x) && near(a.y, b.y);
    for (const path of observed.get(k) ?? [])
      if (
        !drawnPaths.some(
          (p) =>
            samePoint(p.start, path.start) &&
            samePoint(p.end, path.end) &&
            (p.control === null
              ? path.control === null
              : path.control !== null && samePoint(p.control, path.control)),
        )
      )
        drawnPaths.push(path);
    req(drawnPaths.length <= group.length, 'R6', `${k.replaceAll('\0', '/')}: extra path`);
    const expectedOffsets = group.map((_, i) => Math.abs((i - (group.length - 1) / 2) * 10));
    const actualOffsets: number[] = [];
    for (const path of drawnPaths) {
      const dx = path.end.x - path.start.x;
      const dy = path.end.y - path.start.y;
      const len = Math.hypot(dx, dy);
      const middle = path.control
        ? {
            x: (path.start.x + 2 * path.control.x + path.end.x) / 4,
            y: (path.start.y + 2 * path.control.y + path.end.y) / 4,
          }
        : { x: (path.start.x + path.end.x) / 2, y: (path.start.y + path.end.y) / 2 };
      const offset =
        len <= TOL
          ? Math.hypot(middle.x - path.start.x, middle.y - path.start.y)
          : Math.abs(((middle.x - path.start.x) * dy - (middle.y - path.start.y) * dx) / len);
      actualOffsets.push(offset);
    }
    for (const value of actualOffsets) {
      const i = expectedOffsets.findIndex((v) => near(v, value));
      req(i >= 0, 'R6', `${k.replaceAll('\0', '/')}: unexpected midpoint offset ${String(value)}`);
      if (i >= 0) expectedOffsets.splice(i, 1);
    }
    const remaining = [...group];
    for (const path of drawnPaths) {
      const source = matchPoint(path.start)[0]?.n.id;
      const i = remaining.findIndex((line) => line.source === source);
      req(i >= 0, 'R6', `${k.replaceAll('\0', '/')}: unexpected direction count`);
      if (i >= 0) remaining.splice(i, 1);
    }
    const directions = remaining.map((line) => ({
      source: proposalMap.get(line.source)?.p as Point,
      target: proposalMap.get(line.target)?.p as Point,
      radius: radius(line.target),
    }));
    req(
      canCullAll(expectedOffsets, directions, screen),
      'R6',
      `${k.replace('\0', '/')}: missing path must cross canvas in every legal placement`,
    );
  }
  return { ...result, texts, dots };
};
