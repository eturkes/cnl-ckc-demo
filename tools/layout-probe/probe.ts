import '../../src/app.css';
import { flush, frame, observe } from './observe.js';
import { failedPredicate, predicateFailure } from './failure.mjs';
import {
  blockRegion,
  grade,
  inside,
  labelRegion,
  near,
  point,
  unitsOf,
  type Camera,
  type Ink,
  type NodeModel,
  type Rect,
  type Result,
} from './oracle.js';

import type { NetworkScene } from '../../src/network/asset.js';
import { mountNetworkCanvas, type NetworkCanvas } from '../../src/network/canvas.js';
import { frameFocus } from '../../src/network/focus.js';
import { ANCHORS, boxOf, frameFull, METRICS } from '../../src/network/geometry.js';
export type { Result } from './oracle.js';
interface FocusSet {
  key: string;
  subject: string | null;
  ids: string[];
  lines: { id: string }[];
}
const host = document.querySelector<HTMLElement>('#canvas');
if (!host) throw new Error('probe host absent');
let adapter: NetworkCanvas;
let scene: NetworkScene;
let sets: FocusSet[];
let ink: Ink;
let nodes: readonly NodeModel[];
let subject: string | null = null;
let viewLines: NetworkScene['network']['lines'];
let boundaries: NodeModel[];
let canvas: HTMLCanvasElement;
let font: string;
let failFast = false;
let colours: Record<string, string> = {};
let sentinelPart: 'label' | 'block' = 'label';
const selected: string[] = [];
const result: Result = { errors: {}, counts: {} };
const req = (ok: boolean, rule: string, message: string) => {
  if (!ok) {
    if (failFast) throw predicateFailure(rule, message);
    const row = (result.errors[rule] ??= []);
    if (row.length < 4 && !row.includes(message)) row.push(message);
  }
};
const count = (key: string, n = 1) => {
  result.counts[key] = (result.counts[key] ?? 0) + n;
};
const collect = (read: Result) => {
  for (const [rule, messages] of Object.entries(read.errors))
    for (const message of messages) req(false, rule, message);
  for (const [key, n] of Object.entries(read.counts)) count(key, n);
};
const size = () => ({ width: host.clientWidth, height: host.clientHeight });
const layoutForFrame = () => ({
  nodes: scene.layout.nodes.map((n) => ({
    ...n,
    anchor: ANCHORS.some((a) => a === n.id),
    degree: 0,
  })),
});
const frames = new Map<string, ReturnType<typeof frameFull>>();
const fullFrame = () => {
  const dimensions = size();
  const key = `${String(dimensions.width)}:${String(dimensions.height)}`;
  let f = frames.get(key);
  if (!f) {
    f = frameFull(layoutForFrame(), dimensions);
    frames.set(key, f);
  }
  return f;
};
const camera = (): Camera => adapter.camera();
const full = () => {
  try {
    adapter.show({ kind: 'full', scene });
  } catch (cause) {
    throw predicateFailure('R2', `valid full view failed: ${String(cause)}`);
  }
  nodes = scene.layout.nodes;
  subject = null;
  viewLines = scene.network.lines;
};
const focus = (set: FocusSet) => {
  const tuple = scene.layout.focus[set.key];
  if (!tuple) throw new Error(`missing focus ${set.key}`);
  const lookup = new Map(scene.layout.nodes.map((n) => [n.id, n]));
  nodes = tuple.map(([id, x, y]) => {
    const n = lookup.get(id);
    if (!n) throw new Error(`unknown ${id}`);
    return { ...n, x, y, reveal: -Infinity };
  });
  subject = set.subject;
  const wanted = new Set(set.lines.map((l) => l.id));
  viewLines = scene.network.lines.filter((l) => wanted.has(l.id));
  try {
    adapter.show({ kind: 'focus', scene, subject, nodes: tuple, lines: [...wanted] });
  } catch (cause) {
    throw predicateFailure('R2', `valid focus failed: ${String(cause)}`);
  }
};
const draw = () => {
  try {
    flush();
  } catch (cause) {
    if (failedPredicate(cause)) throw cause;
    throw predicateFailure('R2', `draw failed: ${String(cause)}`);
  }
  req(
    canvas.dataset.viewGeneration !== undefined &&
      /^\d+$/u.test(canvas.dataset.viewGeneration) &&
      canvas.dataset.viewGeneration === canvas.dataset.drawnGeneration,
    'R2',
    'view/drawn generation mismatch',
  );
};
const read = (at: string, overlap = false) => {
  draw();
  const reading = grade({
    calls: frame(),
    nodes,
    lines: viewLines,
    subject,
    blocks: scene.layout.blocks,
    camera: camera(),
    ...size(),
    dpr: devicePixelRatio,
    font,
    colours,
    ink,
    at,
    overlap,
    failFast,
  });
  collect(reading);
  return reading;
};
const paint = async () => {
  await Promise.resolve();
  draw();
};
const show = async (key: string) => {
  if (key === 'full') full();
  else {
    const set = sets.find((s) => s.key === key);
    if (!set) throw new Error(`unknown ${key}`);
    focus(set);
  }
  await paint();
  read(`show/${key}`, true);
};
const readColours = () => {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) throw new Error('colour context absent');
  const css = getComputedStyle(host);
  const normal = (key: string) => {
    c.fillStyle = css.getPropertyValue(key).trim();
    return c.fillStyle;
  };
  colours = Object.fromEntries(
    ['--text', '--text-muted', '--surface-sunken', '--graph-edge'].map((k) => [k, normal(k)]),
  );
  for (const n of scene.network.concepts)
    colours[n.id] = normal(
      scene.network.classes.some((c) => c.id === n.class && c.filled)
        ? `--concept-${n.class}`
        : '--concept-other',
    );
};
const boot = async (input: {
  sets: FocusSet[];
  ink: Ink;
  sentinel?: boolean;
  failFast?: boolean;
  canvas: { width: number; height: number; dpr: number };
}) => {
  failFast = input.failFast ?? false;
  if (
    devicePixelRatio !== input.canvas.dpr ||
    host.clientWidth !== input.canvas.width ||
    host.clientHeight !== input.canvas.height
  )
    throw new Error(
      `DPR calibration failed: requested ${JSON.stringify(input.canvas)}, actual ${String(host.clientWidth)}x${String(host.clientHeight)}@${String(devicePixelRatio)}`,
    );
  sets = input.sets;
  frames.clear();
  ink = input.ink;
  scene = {
    network: (await (await fetch('/clinical-network.json')).json()) as NetworkScene['network'],
    layout: (await (await fetch('/clinical-network-layout.json')).json()) as NetworkScene['layout'],
  };
  const query = `${String(METRICS.font.weight)} ${String(METRICS.font.size)}px "${METRICS.font.family}"`;
  await document.fonts.load(query, 'acute pain').catch(() => undefined);
  await document.fonts.ready;
  const loaded = [...document.fonts].some(
    (f) => f.family.replaceAll(/['"]/g, '') === METRICS.font.family && f.status === 'loaded',
  );
  const fetched = performance
    .getEntriesByType('resource')
    .some((r) => r.name.includes('/atkinson-hyperlegible-next-latin-wght-normal.woff2'));
  req(
    loaded && fetched && document.fonts.check(query),
    'R1',
    `${METRICS.font.family}: loaded FontFace=${String(loaded)} shipped latin resource=${String(fetched)} check=${String(document.fonts.check(query))}`,
  );
  const temporary = document.createElement('canvas').getContext('2d');
  if (!temporary) throw new Error('font context absent');
  temporary.font = query;
  font = temporary.font;
  if (input.sentinel) {
    host.style.setProperty('--text', '#ff00ff');
  }
  readColours();
  observe(host);
  try {
    adapter = mountNetworkCanvas(host, (id) => selected.push(id));
  } catch (cause) {
    throw predicateFailure('R2', `mount failed: ${String(cause)}`);
  }
  full();
  canvas = host.querySelector('canvas') as HTMLCanvasElement;
  await document.fonts.ready;
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  draw();
  req(
    host.querySelectorAll('canvas').length === 1,
    'R2',
    'adapter did not append exactly one canvas',
  );
  if (
    canvas.width !== input.canvas.width * input.canvas.dpr ||
    canvas.height !== input.canvas.height * input.canvas.dpr
  )
    throw new Error(
      `canvas backing-store calibration failed: ${String(canvas.width)}x${String(canvas.height)}, expected ${String(input.canvas.width * input.canvas.dpr)}x${String(input.canvas.height * input.canvas.dpr)}`,
    );
  const fit = fullFrame().zoom;
  boundaries = scene.layout.nodes.filter((n) => n.reveal > fit);
  req(boundaries.length >= 5 && sets.length > 0, 'R3', 'empty reveal/focus inventory');
  return { boundaries: boundaries.length, focus: sets.length };
};
const checkFrame = (expected: { zoom: number; pan: { x: number; y: number } }, at: string) => {
  const c = camera();
  req(
    near(c.zoom, expected.zoom) && near(c.pan.x, expected.pan.x) && near(c.pan.y, expected.pan.y),
    'R2',
    `${at}: camera proposal differs from shared frame`,
  );
};
const samples = () => {
  full();
  const fit = fullFrame();
  checkFrame(fit, 'full');
  const c = camera();
  req(near(c.minZoom, fit.zoom) && near(c.maxZoom, 1), 'R3', 'full zoom limits differ');
  for (const z of [
    fit.zoom,
    ...Array.from({ length: 8 }, (_, i) => fit.zoom * (1 / fit.zoom) ** ((i + 1) / 9)),
    1,
  ]) {
    adapter.zoomTo(z);
    read(`sample/${String(z)}`, z === fit.zoom || z === 1);
    count('sampleZooms');
  }
  return result;
};
const revealBatch = (start: number, amount: number, direction: 'in' | 'out') => {
  const ordered = direction === 'in' ? boundaries : [...boundaries].reverse();
  const fit = fullFrame();
  for (const n of ordered.slice(start, start + amount)) {
    const at = { x: n.x * fit.zoom + fit.pan.x, y: n.y * fit.zoom + fit.pan.y };
    full();
    for (const z of direction === 'in'
      ? [n.reveal - 1e-9 * n.reveal, n.reveal]
      : [n.reveal, n.reveal - 1e-9 * n.reveal]) {
      adapter.zoomTo(z, at);
      const ratio = z / fit.zoom;
      checkFrame(
        {
          zoom: z,
          pan: { x: at.x - (at.x - fit.pan.x) * ratio, y: at.y - (at.y - fit.pan.y) * ratio },
        },
        `boundary/${n.id}`,
      );
      read(
        `boundary/${direction}/${n.id}/${String(z)}`,
        boundaries.indexOf(n) % Math.max(1, Math.floor(boundaries.length / 12)) === 0,
      );
      count(`boundaries-${direction}`);
    }
  }
  return result;
};
const focusBatch = (start: number, amount: number, inventory = true) => {
  const sizes = new Map(scene.layout.nodes.map((n) => [n.id, n]));
  for (const set of sets.slice(start, start + amount)) {
    focus(set);
    const tuple = scene.layout.focus[set.key];
    if (!tuple) throw new Error('missing view');
    checkFrame(
      frameFocus(
        { subject: set.subject, nodes: tuple.map(([id, x, y]) => ({ id, x, y })) },
        sizes,
        scene.layout.blocks.find((b) => b.id === set.subject) ?? null,
        size(),
      ),
      set.key,
    );
    req(
      camera().minZoom === 1 && camera().maxZoom === 1,
      'R3',
      `${set.key}: focus limits not fixed`,
    );
    read(set.key, true);
    if (inventory) count('focusViews');
  }
  return result;
};
const interfaceChecks = () => {
  const a = scene.layout.nodes[0];
  const line = scene.network.lines[0];
  if (!a || !line) throw new Error('empty interface input');
  const refused = (id: string, call: () => void) => {
    let named = false;
    try {
      call();
    } catch (error) {
      named = error instanceof Error && error.message.includes(id);
    }
    req(named, 'R6', `invalid view was not refused by name: ${id}`);
  };
  refused('missing:concept', () =>
    adapter.show({
      kind: 'focus',
      scene,
      subject: null,
      nodes: [['missing:concept', 0, 0]],
      lines: [],
    }),
  );
  refused('missing:line', () =>
    adapter.show({
      kind: 'focus',
      scene,
      subject: a.id,
      nodes: [[a.id, 0, 0]],
      lines: ['missing:line'],
    }),
  );
  refused(line.id, () =>
    adapter.show({
      kind: 'focus',
      scene,
      subject: null,
      nodes: [[line.source, 0, 0]],
      lines: [line.id],
    }),
  );
  refused('missing:subject', () =>
    adapter.show({
      kind: 'focus',
      scene,
      subject: 'missing:subject',
      nodes: [[a.id, 0, 0]],
      lines: [],
    }),
  );
  for (const token of [
    '--graph-edge',
    ...scene.network.classes
      .filter((c) => c.filled)
      .slice(0, 1)
      .map((c) => `--concept-${c.id}`),
  ]) {
    const prior = host.style.getPropertyValue(token);
    host.style.setProperty(token, 'initial');
    refused(token, () => adapter.show({ kind: 'full', scene: { ...scene } }));
    if (prior) host.style.setProperty(token, prior);
    else host.style.removeProperty(token);
  }
  full();
  let seed = 0x47b;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let i = 0; i < 16; i++) {
    const at =
      i === 0
        ? { x: host.clientWidth / 2, y: host.clientHeight / 2 }
        : { x: random() * host.clientWidth, y: random() * host.clientHeight };
    const before = camera();
    const requested = i === 0 ? -1 : i === 1 ? 0 : i === 2 ? 2 : random();
    const expected = Math.max(before.minZoom, Math.min(before.maxZoom, requested));
    const ratio = expected / before.zoom;
    if (i === 0) adapter.zoomTo(requested);
    else adapter.zoomTo(requested, at);
    const after = camera();
    req(
      near(after.zoom, expected) &&
        near(after.pan.x, at.x - (at.x - before.pan.x) * ratio) &&
        near(after.pan.y, at.y - (at.y - before.pan.y) * ratio),
      'R3',
      `generated zoom invariant ${String(i)}`,
    );
    read(`zoom-property/${String(i)}`);
    count('zoomProperties');
  }
  full();
};
type Trial =
  | { kind: 'zoom'; zoom: number; x: number; y: number; name?: string }
  | { kind: 'concept' | 'line' | 'subject' | 'leaving'; id: string };
const propertyCase = (trial: Trial) => {
  full();
  let ok = false;
  let detail: string;
  if (trial.kind === 'zoom') {
    const before = camera();
    const at = { x: trial.x, y: trial.y };
    const z = Math.max(before.minZoom, Math.min(before.maxZoom, trial.zoom));
    const ratio = z / before.zoom;
    adapter.zoomTo(trial.zoom, at);
    const after = camera();
    ok =
      near(after.zoom, z) &&
      near(after.pan.x, at.x - (at.x - before.pan.x) * ratio) &&
      near(after.pan.y, at.y - (at.y - before.pan.y) * ratio);
    detail = `zoom point invariant ${JSON.stringify(trial)}`;
    if (!ok && failFast) throw predicateFailure('R3', detail);
    read(trial.name ?? 'generated zoom');
    count('generatedZooms');
  } else {
    const first = scene.layout.nodes[0];
    if (!first) throw new Error('no concept');
    try {
      const line =
        trial.kind === 'leaving' ? scene.network.lines.find((l) => l.id === trial.id) : undefined;
      const id = line ? line.source : first.id;
      adapter.show({
        kind: 'focus',
        scene,
        subject: trial.kind === 'subject' ? trial.id : null,
        nodes: trial.kind === 'concept' ? [[trial.id, 0, 0]] : [[id, 0, 0]],
        lines: trial.kind === 'line' || trial.kind === 'leaving' ? [trial.id] : [],
      });
    } catch (cause) {
      ok = cause instanceof Error && cause.message.includes(trial.id);
    }
    detail = `unknown ${trial.kind} not refused by name ${JSON.stringify(trial.id)}`;
    count('generatedViews');
    if (!ok && failFast) throw predicateFailure('R6', detail);
  }
  full();
  return { ok, detail };
};
const contact = () => {
  full();
  const fit = fullFrame();
  const lookup = new Map(scene.layout.nodes.map((n) => [n.id, n]));
  const pairs = new Map<string, number>();
  for (const line of scene.network.lines) {
    const key = [line.source, line.target].sort().join('\0');
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  for (const line of scene.network.lines) {
    const a = lookup.get(line.source);
    const b = lookup.get(line.target);
    if (!a || !b) continue;
    const radius = ANCHORS.some((id) => id === b.id) ? 9 : 5;
    const zoom = (radius + 1) / Math.hypot(b.x - a.x, b.y - a.y);
    if (zoom < fit.zoom || zoom > 1) continue;
    count('contacts');
    return propertyCase({
      kind: 'zoom',
      zoom,
      x: a.x * fit.zoom + fit.pan.x,
      y: a.y * fit.zoom + fit.pan.y,
      name: `contact/${line.id}`,
    });
  }
  return { ok: true, detail: 'no reachable single-line contact on this canvas' };
};
const preflight = () => {
  interfaceChecks();
  contact();
  for (const key of ['concept:acute-pain', 'concept:opioid-therapy']) {
    const i = sets.findIndex((s) => s.key === key);
    if (i < 0) throw new Error(`missing ${key}`);
    focusBatch(i, 1, false);
  }
  full();
  return result;
};
const pixelCases = () => {
  const n = scene.layout.nodes.find((n) => n.label.length === 3);
  if (!n) throw new Error('no three-line label');
  const sampled = Array.from(
    { length: 5 },
    (_, i) => boundaries[Math.floor(((boundaries.length - 1) * i) / 4)] as NodeModel,
  );
  return {
    labels: [ANCHORS[0], n.id],
    boundaries: sampled.map((n) => ({ id: n.id, reveal: n.reveal })),
  };
};
const regionOf = (id: string, block = false) => {
  const n = nodes.find((n) => n.id === id);
  if (!n) throw new Error(`missing ${id}`);
  const p = point(n, camera());
  if (!block) return labelRegion(n, p);
  const b = scene.layout.blocks.find((b) => b.id === id);
  if (!b) throw new Error('no block');
  return blockRegion(n, b, p);
};
const pixelPrepare = async (id: string, z: number, block = false) => {
  if (block) await show(`concept:${id}`);
  else {
    full();
    const n = nodes.find((n) => n.id === id);
    if (!n) throw new Error('no pixel subject');
    const fit = fullFrame();
    adapter.zoomTo(z, { x: n.x * fit.zoom + fit.pan.x, y: n.y * fit.zoom + fit.pan.y });
  }
  read(`pixel/${id}`, true);
  return regionOf(id, block);
};
const pixelRead = (id: string, block = false) => {
  const target = regionOf(id, block);
  const dpr = devicePixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('pixel context absent');
  const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const colourProbe = document.createElement('canvas').getContext('2d');
  if (!colourProbe) throw new Error('colour context absent');
  colourProbe.fillStyle = getComputedStyle(host).getPropertyValue('--surface-sunken');
  colourProbe.fillRect(0, 0, 1, 1);
  const background = colourProbe.getImageData(0, 0, 1, 1).data;
  const red = background[0] ?? 0;
  const green = background[1] ?? 0;
  const blue = background[2] ?? 0;
  const isSentinel = (r: number, g: number, b: number) => {
    const a = (green - g) / green;
    return (
      a > 0 &&
      (r > red || b > blue) &&
      Math.abs(r - (red + (255 - red) * a)) <= 1 &&
      Math.abs(b - (blue + (255 - blue) * a)) <= 1
    );
  };
  req(
    isSentinel(255, 0, 255) && !isSentinel(180, 25, 162),
    'R3PX',
    'sentinel blend discriminator control failed',
  );
  const allowed = [
    ...new Map(
      unitsOf(nodes, subject, scene.layout.blocks, camera())
        .filter((u) => u.part === sentinelPart)
        .map((u) => [`${u.id}:${u.part}`, u.region]),
    ).values(),
  ];
  let insideTarget = 0;
  let outside = 0;
  let total = 0;
  const expanded = (r: Rect, x: number, y: number) =>
    x >= r.left * dpr - 1 &&
    x <= r.right * dpr + 1 &&
    y >= r.top * dpr - 1 &&
    y <= r.bottom * dpr + 1;
  const search = {
    left: Math.floor(target.left * dpr) - 2,
    right: Math.ceil(target.right * dpr) + 2,
    top: Math.floor(target.top * dpr) - 2,
    bottom: Math.ceil(target.bottom * dpr) + 2,
  };
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const at = (y * canvas.width + x) * 4;
      const r = bytes[at] ?? 0;
      const g = bytes[at + 1] ?? 0;
      const b = bytes[at + 2] ?? 0;
      if (!isSentinel(r, g, b)) continue;
      total++;
      if (expanded(target, x + 0.5, y + 0.5)) insideTarget++;
      if (
        x >= search.left &&
        x <= search.right &&
        y >= search.top &&
        y <= search.bottom &&
        !expanded(target, x + 0.5, y + 0.5)
      )
        outside++;
      if (!allowed.some((r) => expanded(r, x + 0.5, y + 0.5)))
        req(
          false,
          'R3PX',
          `sentinel pixel outside every region ${String(x)},${String(y)} at DPR ${String(dpr)}`,
        );
    }
  count('pixelReads');
  return { id, inside: insideTarget, outside, total, layers: 1 };
};
const pixelMode = async (part: 'label' | 'block') => {
  adapter.destroy();
  host.style.removeProperty('--text');
  host.style.removeProperty('--text-muted');
  host.style.setProperty(part === 'label' ? '--text' : '--text-muted', '#ff00ff');
  sentinelPart = part;
  readColours();
  observe(host);
  try {
    adapter = mountNetworkCanvas(host, (id) => selected.push(id));
  } catch (cause) {
    throw predicateFailure('R2', `mount failed: ${String(cause)}`);
  }
  full();
  canvas = host.querySelector('canvas') as HTMLCanvasElement;
  await document.fonts.ready;
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  draw();
};
const panStart = async () => {
  const b = [...scene.layout.blocks].sort((a, b) => b.H - a.H || a.id.localeCompare(b.id))[0];
  if (!b) throw new Error('no tallest block');
  await show(`concept:${b.id}`);
  const n = nodes.find((n) => n.id === b.id);
  if (!n) throw new Error('subject absent');
  const box = boxOf(n, b);
  req(
    box.bottom - box.top > host.clientHeight - 24,
    'R5',
    `${b.id}: tallest block does not exceed inner height`,
  );
  return {
    id: b.id,
    before: camera().pan,
    distance: Math.max(40, regionOf(b.id, true).bottom - (host.clientHeight - 12)),
  };
};
const panEnd = (id: string, before: { x: number; y: number }) => {
  const reading = read('R5/after-drag');
  const b = scene.layout.blocks.find((b) => b.id === id);
  if (!b) throw new Error('no block');
  const last = reading.texts.find(
    (t) =>
      t.unit.id === id &&
      t.unit.part === 'block' &&
      t.unit.index === b.readings.flat().length - 1 &&
      t.kind === 'strokeText',
  );
  req(!!last, 'R5', `${id}: final reading missing/capped`);
  if (last)
    req(
      inside({ left: 0, top: 0, right: host.clientWidth, bottom: host.clientHeight }, last.ink),
      'R5',
      `${id}: last ink outside canvas`,
    );
  req(camera().pan.y < before.y - 5, 'R5', `${id}: pointer drag did not pan`);
  count('panReadings');
  return result;
};
const interactionTargets = async () => {
  await show('concept:acute-pain');
  const reading = read('tap-targets');
  const n = nodes.find((n) => n.id === 'acute-pain');
  if (!n) throw new Error('no anchor');
  const p = reading.dots.get(n.id);
  if (!p) {
    req(false, 'R6', 'acute-pain: no observed anchor dot for a real pointer target');
    return null;
  }
  const r = labelRegion(n, p);
  return {
    id: n.id,
    dot: p,
    label: { x: p.x, y: (r.top + r.bottom) / 2 },
    empty: { x: 2, y: 2 },
    before: selected.length,
  };
};
const selection = (expected: string | null, before: number) => {
  req(
    selected.length === before + (expected === null ? 0 : 1) &&
      (expected === null || selected.at(-1) === expected),
    'R6',
    `tap expected ${expected ?? 'nothing'} got ${selected.slice(before).join(',')}`,
  );
  count('taps');
  return selected.length;
};
const reset = () => {
  adapter.destroy();
  flush();
  req(host.querySelector('canvas') === null, 'EXIT', 'destroy left its canvas');
};
const status = () => result;
declare global {
  interface Window {
    layoutProbe: {
      boot: typeof boot;
      samples: typeof samples;
      preflight: typeof preflight;
      propertyCase: typeof propertyCase;
      contact: typeof contact;
      revealBatch: typeof revealBatch;
      focusBatch: typeof focusBatch;
      show: typeof show;
      pixelCases: typeof pixelCases;
      pixelPrepare: typeof pixelPrepare;
      pixelRead: typeof pixelRead;
      pixelMode: typeof pixelMode;
      panStart: typeof panStart;
      panEnd: typeof panEnd;
      interactionTargets: typeof interactionTargets;
      selection: typeof selection;
      reset: typeof reset;
      result: typeof status;
      paint: typeof paint;
    };
  }
}
window.layoutProbe = {
  boot,
  samples,
  preflight,
  propertyCase,
  contact,
  revealBatch,
  focusBatch,
  show,
  pixelCases,
  pixelPrepare,
  pixelRead,
  pixelMode,
  panStart,
  panEnd,
  interactionTargets,
  selection,
  reset,
  result: status,
  paint,
};
