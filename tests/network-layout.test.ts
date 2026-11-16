// Blind g4 grader from .agent/contracts/g4.md; independent geometry, shaping and focus oracles.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import * as geometryModule from '../src/network/geometry.js';
import * as focusModule from '../src/network/focus.js';
import {
  boxes as focusBoxes,
  directions as focusDirections,
  frame as focusFrame,
  sets as focusSets,
  sized as focusSized,
  type FocusInput,
  type FocusSet,
  type FocusView,
} from './support/network-layout-focus-oracle.js';
import * as layoutModule from '../tools/kb/layout.mjs';
import { advance, fontPath, measured } from './support/network-layout-font.js';
import {
  anchors,
  at,
  collision,
  components,
  extent,
  intersect,
  lexical,
  metrics,
  node,
  offsets,
  priority,
  revelation,
  separation,
  synthetic,
  type Blocks,
  type Canvas,
  type Frame,
  type Layout,
  type Network,
  type Node,
  type Rect,
  type Size,
} from './support/network-layout-oracle.js';
import { holds, SEED } from './support/property.js';

type Closure = { digest: string; parts: Record<string, string> };
type FilePart = [string, string];
type BuildOptions = {
  force?: boolean;
  deadlineMs?: number;
  postLayoutMs?: number;
  child?: string;
  cacheDir?: string;
  closureFiles?: FilePart[];
};
type Build = { path: string; bytes: Uint8Array; cached: boolean; cacheFile: string };
type LayoutAPI = {
  CLOSURE_FILES: FilePart[];
  focusSets: (network: Network) => FocusSet[];
  measureLabel: (text: string) => Promise<{ lines: string[]; W: number; H: number }>;
  closureOf: (network: Network, files?: FilePart[]) => Closure;
  buildLayout: (network: Network, options: BuildOptions) => Promise<Build>;
  validateLayout: (body: Layout, network: Network) => string[];
  layoutNetwork: (network: Network) => Promise<Layout>;
};
type GeometryAPI = {
  METRICS: typeof metrics;
  ANCHORS: string[];
  labelWidth: (advance: number) => number;
  labelHeight: (lines: number) => number;
  boxOf: (n: Size, block?: Size) => Rect;
  overlaps: (a: Node, b: Node, zoom: number, blocks?: Blocks) => boolean;
  sep: (a: Node, b: Node, blocks?: Blocks) => number;
  byPriority: (a: Node, b: Node) => number;
  reveals: (nodes: Node[]) => { id: string; reveal: number }[];
  frameFull: (layout: { nodes: Node[] }, canvas: Canvas) => Frame;
};
type FocusAPI = {
  FOCUS_SEED: number;
  FOCUS_ROUNDS: number;
  seeded: <T>(seed: number, run: () => T) => T;
  directionEdges: (input: FocusInput) => [string, string][];
  layoutFocus: (input: FocusInput, sizes: Map<string, Size>, block: Size | null) => FocusView;
  frameFocus: (
    view: FocusView,
    sizes: Map<string, Size>,
    block: Size | null,
    canvas: Canvas,
  ) => Frame;
};
const focus = focusModule as unknown as FocusAPI;
const geometry = geometryModule as unknown as GeometryAPI;
const producer = layoutModule as unknown as LayoutAPI;
const root = fileURLToPath(new URL('../', import.meta.url));
const network = JSON.parse(
  readFileSync(join(root, 'kb/generated/graph/clinical-network.json'), 'utf8'),
) as Network;
const layout = JSON.parse(
  readFileSync(
    process.env['NETWORK_LAYOUT_FILE'] ??
      join(root, 'kb/generated/graph/clinical-network-layout.json'),
    'utf8',
  ),
) as Layout;
const sha = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
const closureDigest = (parts: Record<string, string>): string =>
  sha(
    Object.entries(parts)
      .map(([name, hex]) => `${name}:${hex}\n`)
      .join(''),
  );
const hashFiles = (net: Network, files: FilePart[]): Closure => {
  const parts: Record<string, string> = { network: sha(JSON.stringify(net)) };
  for (const [name, path] of files) parts[name] = sha(readFileSync(path));
  parts['runtime'] = sha(`${process.version} ${process.platform} ${process.arch}`);
  return { parts, digest: closureDigest(parts) };
};
const directories: string[] = [];
const temporary = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'network-layout-contract-'));
  directories.push(dir);
  return dir;
};
const originalRandom = Math.random;
afterEach(() => {
  Math.random = originalRandom;
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
// A normal child runs under the suite's load envelope (`.claude/rules/gate.md`): its deadlines keep
// the production scale; only the planted children's deadlines are short.
const cacheOptions = (): BuildOptions => ({
  cacheDir: temporary(),
  force: false,
  deadlineMs: 60000,
  postLayoutMs: 10000,
});
const childPath = (name: string): string => join(root, `tests/support/network-layout-${name}.ts`);
const decode = (result: Build): Layout =>
  JSON.parse(Buffer.from(result.bytes).toString('utf8')) as Layout;
const checkedNode = (id: string): Node => {
  const n = layout.nodes.find((candidate) => candidate.id === id);
  if (n === undefined) throw new Error(`missing layout node ${id}`);
  return n;
};
const pairProblems = (nodes: Node[], predicate: (a: Node, b: Node) => boolean): string[] => {
  const problems: string[] = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a !== undefined && b !== undefined && !predicate(a, b) && problems.length < 12)
        problems.push(`${a.id} / ${b.id}`);
    }
  return problems;
};
const frameProblems = (nodes: Node[], canvas: Canvas, frame: Frame): string[] => {
  const problems: string[] = [];
  if (!Number.isFinite(frame.zoom) || frame.zoom <= 0 || frame.zoom > 1)
    problems.push(`zoom ${String(frame.zoom)}`);
  if (!Number.isFinite(frame.pan.x) || !Number.isFinite(frame.pan.y))
    problems.push('non-finite pan');
  for (const n of nodes) {
    const r =
      n.reveal <= frame.zoom
        ? at(n, frame.zoom)
        : {
            left: n.x * frame.zoom - 9,
            right: n.x * frame.zoom + 9,
            top: n.y * frame.zoom - 9,
            bottom: n.y * frame.zoom + 9,
          };
    if (
      r.left + frame.pan.x < 12 - 1e-7 ||
      r.right + frame.pan.x > canvas.width - 12 + 1e-7 ||
      r.top + frame.pan.y < 12 - 1e-7 ||
      r.bottom + frame.pan.y > canvas.height - 12 + 1e-7
    )
      problems.push(n.id);
  }
  return problems;
};
const close = (actual: number, expected: number, context?: string): void => {
  if (Number.isFinite(expected))
    expect(Math.abs(actual - expected), context).toBeLessThanOrEqual(1e-9);
  else expect(actual, context).toBe(expected);
};
const sameReveals = (
  actual: { id: string; reveal: number }[],
  expected: { id: string; reveal: number }[],
): void => {
  expect(actual.map((n) => n.id)).toEqual(expected.map((n) => n.id));
  actual.forEach((n, i) => close(n.reveal, expected[i]?.reveal ?? NaN, n.id));
};
const blocksOf = (a?: Size, b?: Size): Blocks => ({
  ...(a === undefined ? {} : { a }),
  ...(b === undefined ? {} : { b }),
});
const finite = fc.double({ min: -100000, max: 100000, noNaN: true, noDefaultInfinity: true });
const size = fc.record({
  W: fc.integer({ min: 1, max: 1000 }),
  H: fc.integer({ min: 1, max: 500 }),
});
const optionalBlock = fc.option(size, { nil: undefined });
const generatedNode = fc.record({
  x: finite,
  y: finite,
  W: fc.integer({ min: 1, max: 1000 }),
  H: fc.integer({ min: 1, max: 500 }),
  degree: fc.integer({ min: 0, max: 100 }),
});
const defects = ['missing-node', 'bad-row', 'overlap', 'bad-reveal', 'hidden-anchor'] as const;
const corrupt = (source: Layout, defect: (typeof defects)[number]): Layout => {
  const broken = structuredClone(source);
  const a = broken.nodes[0];
  const b = broken.nodes[1];
  if (a === undefined || b === undefined) throw new Error('layout must contain anchors');
  if (defect === 'missing-node') broken.nodes.pop();
  if (defect === 'bad-row') a.y -= 1;
  if (defect === 'overlap') {
    b.x = a.x;
    b.y = a.y;
  }
  if (defect === 'bad-reveal') {
    expect(broken.nodes.some((n) => !anchors.includes(n.id) && n.reveal > 0)).toBe(true);
    for (const n of broken.nodes) if (!anchors.includes(n.id)) n.reveal = 0;
  }
  if (defect === 'hidden-anchor') a.reveal = 1;
  return broken;
};

// Asset predicates use independent geometry/shaping, not validateLayout's verdict.
// Asset-wide cases grade every pair and every focus view of the real asset (≈1 s each unloaded);
// the bound keeps the gate's load envelope from reading a slow host as a red.
describe('clinical network layout asset', { timeout: 30_000 }, () => {
  it('G1 structure, metrics, exact concept inventory, incident degree and priority order', () => {
    expect(layout.schemaVersion).toBe(1);
    expect(layout.metrics).toEqual(metrics);
    expect(layout.nodes.map((n) => n.id).sort(lexical)).toEqual(
      network.concepts.map((c) => c.id).sort(lexical),
    );
    const degree = new Map(network.concepts.map((c) => [c.id, 0]));
    for (const line of network.lines)
      for (const id of new Set([line.source, line.target]))
        degree.set(id, (degree.get(id) ?? 0) + 1);
    for (const n of layout.nodes) {
      expect([n.x, n.y, n.W, n.H, n.reveal].every(Number.isFinite), n.id).toBe(true);
      expect(n.degree, n.id).toBe(degree.get(n.id));
      expect(n.reveal, n.id).toBeGreaterThanOrEqual(0);
      // The producer rounds positions before the separation/reveal calculation.
      expect(Math.abs(n.x * 100 - Math.round(n.x * 100)), n.id).toBeLessThan(1e-6);
      expect(Math.abs(n.y * 100 - Math.round(n.y * 100)), n.id).toBeLessThan(1e-6);
    }
    expect(layout.nodes.map((n) => n.id)).toEqual(
      [...layout.nodes].sort(priority).map((n) => n.id),
    );
  });

  it('G1 labels and distinct loop readings keep every word and their independent HarfBuzz boxes', () => {
    for (const c of network.concepts) {
      const n = checkedNode(c.id);
      const expected = measured(c.label);
      expect(n.label.join(' '), c.id).toBe(c.label);
      expect(n.label, c.id).toEqual(expected.lines);
      expect(n.W, c.id).toBeCloseTo(expected.W, 8);
      expect(n.H, c.id).toBeCloseTo(expected.H, 8);
    }
    const readings = new Map<string, Set<string>>();
    for (const loop of network.loops) {
      const own = readings.get(loop.concept) ?? new Set<string>();
      own.add(loop.reading);
      readings.set(loop.concept, own);
    }
    expect(layout.blocks.map((b) => b.id).sort(lexical)).toEqual(
      [...readings.keys()].sort(lexical),
    );
    for (const block of layout.blocks) {
      const expected = [...(readings.get(block.id) ?? [])].sort(lexical).map(measured);
      expect(block.readings, block.id).toEqual(expected.map((r) => r.lines));
      expect(block.W, block.id).toBeCloseTo(Math.max(...expected.map((r) => r.W)), 8);
      expect(block.H, block.id).toBeCloseTo(
        19 + (expected.flatMap((r) => r.lines).length - 1) * 15.6,
        8,
      );
    }
  });

  it('G1 envelope includes the network and the ordered closure digest', () => {
    expect(layout.envelope.network).toEqual(network.envelope);
    expect(Object.keys(layout.envelope.parts)).toEqual([
      'network',
      'font',
      'geometry',
      'focus',
      'layout',
      'child',
      'lockfile',
      'runtime',
    ]);
    for (const hex of Object.values(layout.envelope.parts)) expect(hex).toMatch(/^[a-f0-9]{64}$/u);
    expect(layout.envelope.parts['network']).toBe(sha(JSON.stringify(network)));
    expect(layout.envelope.parts['runtime']).toBe(
      sha(`${process.version} ${process.platform} ${process.arch}`),
    );
    expect(layout.envelope.digest).toBe(closureDigest(layout.envelope.parts));
  });

  it('G1 closure parts re-derive from local file bytes, network and runtime', () => {
    const expectedPaths: FilePart[] = [
      ['font', fileURLToPath(fontPath)],
      ['geometry', join(root, 'src/network/geometry.ts')],
      ['focus', join(root, 'src/network/focus.ts')],
      ['layout', join(root, 'tools/kb/layout.mjs')],
      ['child', join(root, 'tools/kb/layout-child.mjs')],
      ['lockfile', join(root, 'pnpm-lock.yaml')],
    ];
    expect(producer.CLOSURE_FILES).toEqual(expectedPaths);
    const expected = hashFiles(network, expectedPaths);
    expect(producer.closureOf(network)).toEqual(expected);
    expect(layout.envelope.parts).toEqual(expected.parts);
    expect(layout.envelope.digest).toBe(expected.digest);
  });

  it('G2 the ordered pain row is above every other point and bounds the main component horizontally', () => {
    const [acute, subacute, chronic] = anchors.map(checkedNode);
    if (acute === undefined || subacute === undefined || chronic === undefined)
      throw new Error('three anchors required');
    expect(acute.y).toBe(layout.row.y);
    expect(subacute.y).toBe(acute.y);
    expect(chronic.y).toBe(acute.y);
    expect(acute.x).toBeLessThan(subacute.x);
    expect(subacute.x).toBeLessThan(chronic.x);
    for (const n of layout.nodes.filter((n) => !anchors.includes(n.id))) {
      expect(n.y, n.id).toBeGreaterThan(layout.row.y);
      if (n.component === acute.component) {
        expect(n.x, n.id).toBeGreaterThanOrEqual(acute.x);
        expect(n.x, n.id).toBeLessThanOrEqual(chronic.x);
      }
    }
  });

  it('G3 every rounded box pair separates by zoom 1 and every reveal is reachable', () => {
    expect(pairProblems(layout.nodes, (a, b) => separation(a, b) <= 1)).toEqual([]);
    expect(layout.nodes.filter((n) => n.reveal > 1).map((n) => n.id)).toEqual([]);
  });

  it('G4 every visible pair is safe and every positive reveal has a higher-priority witness', () => {
    expect(
      pairProblems(
        layout.nodes,
        (a, b) =>
          (anchors.includes(a.id) && anchors.includes(b.id)) ||
          Math.max(a.reveal, b.reveal) + 1e-9 >= separation(a, b),
      ),
    ).toEqual([]);
    const ordered = [...layout.nodes].sort(priority);
    for (let i = 0; i < ordered.length; i++) {
      const n = ordered[i];
      if (n === undefined || n.reveal === 0 || anchors.includes(n.id)) continue;
      const witnesses = ordered
        .slice(0, i)
        .filter((p) => p.reveal < separation(n, p) && Math.abs(n.reveal - separation(n, p)) < 1e-9);
      expect(witnesses.length, n.id).toBeGreaterThan(0);
    }
    const expected = revelation(layout.nodes);
    expect(layout.nodes.map((n) => n.id)).toEqual(expected.map((n) => n.id));
    for (let i = 0; i < expected.length; i++)
      expect(layout.nodes[i]?.reveal, expected[i]?.id).toBeCloseTo(expected[i]?.reveal ?? NaN, 12);
  });

  it('G5 anchors reveal at zero and clear one another at the smallest canvas full frame', () => {
    const pain = anchors.map(checkedNode);
    expect(pain.map((n) => n.reveal)).toEqual([0, 0, 0]);
    const frame = geometry.frameFull(layout, { width: 288, height: 320 });
    expect(frame.zoom).toBeGreaterThan(0);
    expect(pairProblems(pain, (a, b) => !collision(a, b, frame.zoom))).toEqual([]);
  });

  it('G7 line components keep separate boxes below the main box and shelf rows fit its width', () => {
    const groups = components(network);
    const mainIds = groups.find((ids) => ids.includes('acute-pain'));
    expect(mainIds).toBeDefined();
    const boxes = groups.map((ids) => {
      const members = ids.map(checkedNode);
      expect(new Set(members.map((n) => n.component)).size, ids[0]).toBe(1);
      return { ids, key: members[0]?.component, box: extent(members.map((n) => at(n, 1))) };
    });
    expect(new Set(boxes.map((c) => c.key)).size).toBe(boxes.length);
    const main = boxes.find((c) => c.ids.includes('acute-pain'));
    if (main === undefined) throw new Error('main component missing');
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a !== undefined && b !== undefined)
          expect(intersect(a.box, b.box), `${a.ids[0] ?? ''}/${b.ids[0] ?? ''}`).toBe(false);
      }
    const others = boxes.filter((c) => c !== main);
    for (const c of others) expect(c.box.top, c.ids[0]).toBeGreaterThan(main.box.bottom);
    // A shelf row is a connected interval of vertical component-box overlap.
    const shelves: (typeof boxes)[] = [];
    for (const c of [...others].sort((a, b) => a.box.top - b.box.top)) {
      const shelf = shelves.at(-1);
      if (shelf === undefined || c.box.top >= Math.max(...shelf.map((r) => r.box.bottom)))
        shelves.push([c]);
      else shelf.push(c);
    }
    for (const shelf of shelves) {
      const row = extent(shelf.map((c) => c.box));
      if (row.right - row.left > main.box.right - main.box.left + 0.02)
        expect(shelf, shelf[0]?.ids[0]).toHaveLength(1);
    }
  }, 30000);

  it.each([
    [288, 320],
    [343, 440],
    [1152, 660],
  ])(
    'G9 full frame contains dots and shown labels at %i x %i with anchors visible',
    (width, height) => {
      const canvas = { width, height };
      const frame = geometry.frameFull(layout, canvas);
      expect(frameProblems(layout.nodes, canvas, frame)).toEqual([]);
      expect(anchors.map(checkedNode).every((n) => n.reveal <= frame.zoom)).toBe(true);
    },
  );
});

describe('clinical network layout validator', { timeout: 30_000 }, () => {
  it.each(defects)('G1 validator grades the real asset then rejects %s under G1-G5', (defect) => {
    expect(producer.validateLayout(layout, network)).toEqual([]);
    expect(producer.validateLayout(corrupt(layout, defect), network).length).toBeGreaterThan(0);
  });
});

describe('clinical network shared geometry', { timeout: 30_000 }, () => {
  it('G6 metrics, width, height and optional block offsets follow the screen box model (property)', () => {
    expect(geometry.METRICS).toEqual(metrics);
    expect(geometry.ANCHORS).toEqual(anchors);
    holds(
      fc.property(
        size,
        optionalBlock,
        fc.integer({ min: 1, max: 40 }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (s, block, lines, width) => {
          close(geometry.labelWidth(width), width + 8);
          close(geometry.labelHeight(lines), 19 + (lines - 1) * 15.6);
          Object.entries(offsets(s, block)).forEach(([key, value]) =>
            close(geometry.boxOf(s, block)[key as keyof Rect], value),
          );
        },
      ),
    );
  });

  it('G6 separation matches independent rectangles and overlaps on both sides of the boundary (property)', () => {
    holds(
      fc.property(generatedNode, generatedNode, optionalBlock, optionalBlock, (a0, b0, ab, bb) => {
        const a = node('a', a0);
        const b = node('b', b0);
        const blocks = blocksOf(ab, bb);
        const boundary = separation(a, b, blocks);
        close(geometry.sep(a, b, blocks), boundary);
        expect(Object.is(geometry.sep(a, b, blocks), geometry.sep(b, a, blocksOf(bb, ab)))).toBe(
          true,
        );
        if (Number.isFinite(boundary))
          for (const z of [boundary * (1 - 1e-6), boundary * (1 + 1e-6)]) {
            expect(geometry.overlaps(a, b, z, blocks)).toBe(collision(a, b, z, blocks));
            expect(geometry.overlaps(a, b, z, blocks)).toBe(z < geometry.sep(a, b, blocks));
          }
      }),
    );
  });

  it('G6 coincident, horizontal and vertical pairs retain zero-axis infinity and upper-box asymmetry (property)', () => {
    holds(
      fc.property(
        size,
        size,
        optionalBlock,
        optionalBlock,
        fc.integer({ min: 1, max: 5000 }),
        (sa, sb, ab, bb, distance) => {
          const a = node('a', sa);
          const blocks = blocksOf(ab, bb);
          for (const b of [
            node('b', sb),
            node('b', { ...sb, x: distance }),
            node('b', { ...sb, y: distance }),
            node('b', { ...sb, y: -distance }),
          ]) {
            close(geometry.sep(a, b, blocks), separation(a, b, blocks));
            for (const z of [0, 0.01, 1, 10])
              expect(geometry.overlaps(a, b, z, blocks)).toBe(collision(a, b, z, blocks));
          }
        },
      ),
    );
  });

  it('G6 priority and minimal reveals match an independent greedy oracle under input permutation (property)', () => {
    holds(
      fc.property(
        fc.array(generatedNode, { minLength: 1, maxLength: 15 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 3, maxLength: 3 }),
        (values, degrees) => {
          const nodes = [
            ...values.map((v, i) => node(`concept-${String(i)}`, v)),
            ...anchors.map((id, i) => node(id, { x: i * 10000, degree: degrees[i] ?? 0 })),
          ];
          const original = structuredClone(nodes);
          expect([...nodes].sort(geometry.byPriority).map((n) => n.id)).toEqual(
            [...nodes].sort(priority).map((n) => n.id),
          );
          const expected = revelation(nodes);
          sameReveals(geometry.reveals(nodes), expected);
          sameReveals(geometry.reveals([...nodes].reverse()), expected);
          expect(nodes).toEqual(original);
        },
      ),
    );
  });

  it('G6 pinned minimal counterexamples retain coincident boxes and anchor-first reveal order', () => {
    const a = node('a', { W: 1, H: 1 });
    const b = node('b', { W: 1, H: 1 });
    expect(geometry.sep(a, b)).toBe(Infinity);
    expect(geometry.overlaps(a, b, 1)).toBe(true);
    expect(geometry.reveals([b, a])).toEqual([
      { id: 'a', reveal: 0 },
      { id: 'b', reveal: Infinity },
    ]);
    const nodes = [
      node('concept-0', { W: 1, H: 1 }),
      ...anchors.map((id, i) => node(id, { x: i * 10000 })),
    ];
    sameReveals(geometry.reveals(nodes), revelation(nodes));
  });

  it('G4 generated reveal schedules stay collision-free at every threshold and reachable midpoint (property)', () => {
    holds(
      fc.property(fc.array(generatedNode, { minLength: 2, maxLength: 12 }), (values) => {
        const nodes = values.map((v, i) => node(`node-${String(i)}`, v));
        const schedule = geometry.reveals(nodes);
        const shown = nodes.map((n) => ({
          ...n,
          reveal: schedule.find((s) => s.id === n.id)?.reveal ?? NaN,
        }));
        sameReveals(schedule, revelation(nodes));
        const thresholds = [
          0,
          1,
          ...schedule.map((s) => s.reveal).filter((z) => Number.isFinite(z) && z >= 0 && z <= 1),
        ].sort((a, b) => a - b);
        const zooms = [
          ...thresholds,
          ...thresholds.slice(1).map((z, i) => (z + (thresholds[i] ?? 0)) / 2),
        ];
        for (const z of zooms)
          expect(
            pairProblems(
              shown.filter((n) => n.reveal <= z),
              (a, b) => !collision(a, b, z * (1 + 1e-9)),
            ),
          ).toEqual([]);
      }),
    );
  });

  it('G9 full-frame containment survives model translation, scaling and supported canvas sizes (property)', () => {
    holds(
      fc.property(
        fc.integer({ min: -100000, max: 100000 }),
        fc.integer({ min: -100000, max: 100000 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 288, max: 1600 }),
        fc.integer({ min: 320, max: 1000 }),
        (dx, dy, scale, width, height) => {
          const nodes = layout.nodes.map((n) => ({
            ...n,
            x: n.x * scale + dx,
            y: n.y * scale + dy,
            reveal: n.reveal / scale,
          }));
          const canvas = { width, height };
          const frame = geometry.frameFull({ nodes }, canvas);
          expect(frameProblems(nodes, canvas, frame)).toEqual([]);
          expect(
            nodes.filter((n) => anchors.includes(n.id)).every((n) => n.reveal <= frame.zoom),
          ).toBe(true);
        },
      ),
    );
  }, 30000);
});

describe('clinical network label measurement', { timeout: 30_000 }, () => {
  it('G1 measureLabel uses the shipped face at weight 600 and preserves oversized words (generated inputs)', async () => {
    const words = [
      'acute',
      'pain',
      'opioid',
      'therapy',
      'follow-up',
      'assessment',
      'W'.repeat(35),
      'iiiiiiii',
      'fi',
      'AV',
    ];
    const cases = [
      'pain pain iiiiiiii fi acute fi assessment iiiiiiii assessment',
      ...fc.sample(
        fc
          .array(fc.constantFrom(...words), { minLength: 1, maxLength: 12 })
          .map((parts) => parts.join(' ')),
        { seed: SEED, numRuns: 200 },
      ),
    ];
    const results = new Map(
      await Promise.all(
        cases.map(async (text) => [text, await producer.measureLabel(text)] as const),
      ),
    );
    const check = (text: string): void => {
      const actual = results.get(text);
      if (actual === undefined) throw new Error(`unmeasured input ${text}`);
      const expected = measured(text);
      expect(actual.lines, text).toEqual(expected.lines);
      expect(actual.W, text).toBeCloseTo(expected.W, 8);
      expect(actual.H, text).toBeCloseTo(expected.H, 8);
      expect(actual.lines.join(' '), text).toBe(text);
      for (const line of actual.lines)
        expect(advance(line) <= 130 || !line.includes(' '), text).toBe(true);
    };
    cases.forEach(check);
    holds(fc.property(fc.constantFrom(...cases), check));
  });

  it('G1 measureLabel refuses a code point absent from the shipped latin face', async () => {
    await expect(Promise.resolve().then(() => producer.measureLabel('pain 🧬'))).rejects.toThrow();
  });
});

describe('clinical network build child and cache', () => {
  it('G2 anchors in separate line components refuse the build by name', async () => {
    const net = synthetic();
    net.lines = net.lines.filter(
      (line) => line.source !== 'acute-pain' && line.target !== 'acute-pain',
    );
    await expect(producer.buildLayout(net, { ...cacheOptions(), force: true })).rejects.toThrow(
      /anchor/iu,
    );
  }, 120000);

  it('G10 two fresh forced children produce byte-identical complete assets', async () => {
    const net = synthetic();
    const original = structuredClone(net);
    const options = { ...cacheOptions(), force: true };
    const first = await producer.buildLayout(net, options);
    const second = await producer.buildLayout(net, options);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(false);
    expect(first.path).toBe('graph/clinical-network-layout.json');
    expect(second.path).toBe(first.path);
    expect(Buffer.compare(Buffer.from(first.bytes), Buffer.from(second.bytes))).toBe(0);
    expect(readFileSync(first.cacheFile)).toEqual(Buffer.from(second.bytes));
    expect(
      decode(first)
        .nodes.map((n) => n.id)
        .sort(lexical),
    ).toEqual(net.concepts.map((c) => c.id).sort(lexical));
    expect(net).toEqual(original);
  }, 120000);

  it('G11 held timer after layout-end refuses by its post-layout exit deadline', async () => {
    const run = producer.buildLayout(synthetic(), {
      ...cacheOptions(),
      force: true,
      postLayoutMs: 100,
      child: childPath('held-timer'),
    });
    await expect(run).rejects.toThrow('post-layout exit deadline');
    await expect(run).rejects.toHaveProperty('name', 'LayoutError');
  }, 120000);

  it('G11 endless layout refuses by its whole-run deadline', async () => {
    const run = producer.buildLayout(synthetic(), {
      ...cacheOptions(),
      force: true,
      deadlineMs: 150,
      postLayoutMs: 100,
      child: childPath('endless'),
    });
    await expect(run).rejects.toThrow('whole-run deadline');
    await expect(run).rejects.toHaveProperty('name', 'LayoutError');
  }, 120000);

  it('G11 normal child exits on its own and returns a usable artifact before the deadlines', async () => {
    const net = synthetic();
    const result = await producer.buildLayout(net, { ...cacheOptions(), force: true });
    expect(result.cached).toBe(false);
    const asset = decode(result);
    expect(asset.nodes.map((n) => n.id).sort(lexical)).toEqual(
      net.concepts.map((c) => c.id).sort(lexical),
    );
    expect(pairProblems(asset.nodes, (a, b) => !collision(a, b, 1))).toEqual([]);
    expect(asset.envelope.network).toEqual(net.envelope);
  }, 120000);

  it('G12 hit skips even an endless child while force bypasses that same entry', async () => {
    const net = synthetic();
    const options = cacheOptions();
    const first = await producer.buildLayout(net, options);
    const hit = await producer.buildLayout(net, {
      ...options,
      child: childPath('endless'),
      deadlineMs: 150,
    });
    expect(first.cached).toBe(false);
    expect(hit.cached).toBe(true);
    expect(Buffer.from(hit.bytes)).toEqual(Buffer.from(first.bytes));
    await expect(
      producer.buildLayout(net, {
        ...options,
        force: true,
        child: childPath('endless'),
        deadlineMs: 150,
      }),
    ).rejects.toThrow('whole-run deadline');
  }, 120000);

  it.each(defects)(
    'G12 cache hit grades G1-G5 and refuses planted %s',
    async (defect) => {
      const net = synthetic();
      const options = cacheOptions();
      const first = await producer.buildLayout(net, options);
      const broken = corrupt(decode(first), defect);
      writeFileSync(first.cacheFile, JSON.stringify(broken));
      await expect(
        producer.buildLayout(net, { ...options, child: childPath('endless'), deadlineMs: 150 }),
      ).rejects.toThrow();
    },
    120000,
  );

  it.each(['network', 'font', 'geometry', 'focus', 'layout', 'child', 'lockfile'])(
    'G12 changing only closure part %s recomputes its digest and misses the cache',
    async (changed) => {
      const net = synthetic();
      const options = cacheOptions();
      const dir = temporary();
      const files: FilePart[] = ['font', 'geometry', 'focus', 'layout', 'child', 'lockfile'].map(
        (name) => {
          const path = join(dir, name);
          writeFileSync(path, `${name}:original`);
          return [name, path];
        },
      );
      const before = hashFiles(net, files);
      expect(producer.closureOf(net, files)).toEqual(before);
      const first = await producer.buildLayout(net, { ...options, closureFiles: files });
      if (changed === 'network') net.envelope['input'] = 'changed-network-envelope-alone';
      else {
        const part = files.find(([name]) => name === changed);
        if (part === undefined) throw new Error(`missing closure part ${changed}`);
        writeFileSync(part[1], `${changed}:changed`);
      }
      const after = hashFiles(net, files);
      expect(producer.closureOf(net, files)).toEqual(after);
      expect(
        Object.keys(after.parts).filter((name) => before.parts[name] !== after.parts[name]),
      ).toEqual([changed]);
      expect(after.digest).not.toBe(before.digest);
      const second = await producer.buildLayout(net, { ...options, closureFiles: files });
      expect(first.cached).toBe(false);
      expect(second.cached).toBe(false);
      expect(second.cacheFile).not.toBe(first.cacheFile);
      expect(decode(second).envelope.digest).toBe(after.digest);
      expect(decode(second).envelope.parts).toEqual(after.parts);
      const hit = await producer.buildLayout(net, {
        ...options,
        closureFiles: files,
        child: childPath('endless'),
        deadlineMs: 150,
      });
      expect(hit.cached).toBe(true);
    },
    120000,
  );

  it.each(['version', 'platform', 'arch'] as const)(
    'G12 runtime closure changes with process.%s alone and misses the cache',
    async (key) => {
      const net = synthetic();
      const options = cacheOptions();
      const first = await producer.buildLayout(net, options);
      const original = Object.getOwnPropertyDescriptor(process, key);
      if (original === undefined) throw new Error(`process.${key} descriptor missing`);
      const before = producer.closureOf(net);
      try {
        Object.defineProperty(process, key, {
          ...original,
          value: `${String(process[key])}-contract-change`,
        });
        const expected = hashFiles(net, producer.CLOSURE_FILES);
        expect(producer.closureOf(net)).toEqual(expected);
        expect(
          Object.keys(expected.parts).filter((name) => before.parts[name] !== expected.parts[name]),
        ).toEqual(['runtime']);
        const miss = await producer.buildLayout(net, options);
        expect(miss.cached).toBe(false);
        expect(miss.cacheFile).not.toBe(first.cacheFile);
        expect(decode(miss).envelope.digest).toBe(expected.digest);
      } finally {
        Object.defineProperty(process, key, original);
      }
    },
    120000,
  );
});

const expectedFocusSets = focusSets(network);
const focusSizes = new Map(layout.nodes.map((n) => [n.id, { W: n.W, H: n.H }]));
const focusBlocks = new Map(layout.blocks.map((b) => [b.id, { W: b.W, H: b.H }]));
const assetView = (set: FocusSet): FocusView => {
  const tuples = layout.focus[set.key];
  if (tuples === undefined) throw new Error(`missing focus view ${set.key}`);
  return { subject: set.subject, nodes: tuples.map(([id, x, y]) => ({ id, x, y })) };
};
const subjectBlock = (set: FocusInput): Size | null =>
  set.subject === null ? null : (focusBlocks.get(set.subject) ?? null);
const focusPairProblems = (
  view: FocusView,
  sizes: Map<string, Size>,
  block: Size | null,
): string[] =>
  pairProblems(
    focusSized(view, sizes),
    (a, b) =>
      !collision(a, b, 1, {
        a: a.id === view.subject ? block : null,
        b: b.id === view.subject ? block : null,
      }),
  );
const directionProblems = (input: FocusInput, view: FocusView): [string, string][] => {
  const ys = new Map(view.nodes.map((n) => [n.id, n.y]));
  return focusDirections(input).filter(
    ([source, target]) => !((ys.get(source) ?? Infinity) < (ys.get(target) ?? -Infinity)),
  );
};
const focused = fc.array(
  fc.record({ W: fc.integer({ min: 1, max: 180 }), H: fc.integer({ min: 1, max: 100 }) }),
  { minLength: 1, maxLength: 6 },
);
const arbitraryFocus = (
  values: Size[],
  subject: boolean,
): { input: FocusInput; sizes: Map<string, Size> } => {
  const ids = values.map((_, i) => `c${String(i)}`);
  return {
    input: {
      subject: subject ? (ids[0] ?? null) : null,
      ids,
      lines: ids
        .slice(1)
        .map((id, i) => ({ id: `line-${String(i)}`, source: ids[i] ?? '', target: id })),
    },
    sizes: new Map(values.map((s, i) => [ids[i] ?? '', s])),
  };
};

describe('clinical network focus views', { timeout: 30_000 }, () => {
  it('G8 every source focus set has exactly one finite asset view in set order with its origin retained', () => {
    expect(Object.keys(layout.focus)).toEqual(expectedFocusSets.map((s) => s.key));
    for (const set of expectedFocusSets) {
      const view = assetView(set);
      expect(
        view.nodes.map((n) => n.id),
        set.key,
      ).toEqual(set.ids);
      expect(
        view.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
        set.key,
      ).toBe(true);
      const origin = view.nodes.find((n) => n.id === (set.subject ?? set.ids[0]));
      expect(origin, set.key).toMatchObject({ x: 0, y: 0 });
    }
  });

  it('G8 every asset focus box separates at zoom 1 including its loop block and every direction edge points down', () => {
    for (const set of expectedFocusSets) {
      const view = assetView(set);
      expect(focusPairProblems(view, focusSizes, subjectBlock(set)), set.key).toEqual([]);
      expect(directionProblems(set, view), set.key).toEqual([]);
    }
  });

  it('G8 focusSets derives concept neighbours and complete sentence line-loop unions in canonical order', () => {
    expect(producer.focusSets(network)).toEqual(expectedFocusSets);
    holds(
      fc.property(
        fc.array(
          fc.tuple(
            fc.integer({ min: 0, max: 4 }),
            fc.integer({ min: 0, max: 4 }),
            fc.integer({ min: 1, max: 3 }),
          ),
          { maxLength: 20 },
        ),
        (records) => {
          const net: Network = {
            schemaVersion: 1,
            envelope: {},
            concepts: Array.from({ length: 5 }, (_, i) => ({
              id: `c${String(i)}`,
              label: `concept ${String(i)}`,
            })),
            lines: [],
            loops: [],
            occurrences: [],
          };
          records.forEach(([from, to, sentence], i) => {
            const key = `demo:${String(sentence)}#1@ref(${String(i + 1)})`;
            net.occurrences?.push({ key, document: 'demo', sentence });
            if (from === to)
              net.loops.push({
                id: `loop:${String(i)}`,
                concept: `c${String(from)}`,
                reading: 'advice',
                occurrences: [key],
              });
            else
              net.lines.push({
                id: `line:${String(i)}`,
                source: `c${String(from)}`,
                target: `c${String(to)}`,
                occurrences: [key],
              });
          });
          const before = structuredClone(net);
          expect(producer.focusSets(net)).toEqual(focusSets(net));
          expect(net).toEqual(before);
        },
      ),
    );
  });

  it('G8 pinned minimal inputs keep a two-node direction, nonoverlap, seed zero and a one-box frame', () => {
    const { input, sizes } = arbitraryFocus(
      [
        { W: 1, H: 1 },
        { W: 1, H: 1 },
      ],
      false,
    );
    expect(focus.directionEdges(input)).toEqual([['c0', 'c1']]);
    const view = focus.layoutFocus(input, sizes, null);
    expect(focusPairProblems(view, sizes, null)).toEqual([]);
    expect(directionProblems(input, view)).toEqual([]);
    const sample = (): number[] => [Math.random(), Math.random()];
    expect(focus.seeded(0, sample)).toEqual(focus.seeded(0, sample));
    const one: FocusView = { subject: null, nodes: [{ id: 'c0', x: 0, y: 0 }] };
    const frame = focus.frameFocus(one, sizes, null, { width: 288, height: 320 });
    expect(frame.zoom).toBe(1);
    close(frame.pan.x, 144);
    close(frame.pan.y, 157.5);
  });

  it('G8 directionEdges deduplicates, excludes outside/self lines and admits the canonical maximal DAG (property)', () => {
    holds(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })), {
          maxLength: 30,
        }),
        (pairs) => {
          const input: FocusInput = {
            subject: null,
            ids: ['c0', 'c1', 'c2', 'c3'],
            lines: pairs.map(([a, b], i) => ({
              id: String(i),
              source: `c${String(a)}`,
              target: `c${String(b)}`,
            })),
          };
          const before = structuredClone(input);
          expect(focus.directionEdges(input)).toEqual(focusDirections(input));
          expect(focus.directionEdges({ ...input, lines: [...input.lines].reverse() })).toEqual(
            focusDirections(input),
          );
          expect(input).toEqual(before);
        },
      ),
    );
  });

  it('G8 layoutFocus preserves generated sets, origin, block clearance and downward directions (property)', () => {
    holds(
      fc.property(
        focused,
        fc.boolean(),
        fc.option(size, { nil: null }),
        (values, subject, block) => {
          const { input, sizes } = arbitraryFocus(values, subject);
          const ownBlock = subject ? block : null;
          const before = structuredClone({ input, sizes });
          const view = focus.layoutFocus(input, sizes, ownBlock);
          expect(view.subject).toBe(input.subject);
          expect(view.nodes.map((n) => n.id)).toEqual(input.ids);
          expect(view.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
          expect(view.nodes.find((n) => n.id === (input.subject ?? input.ids[0]))).toMatchObject({
            x: 0,
            y: 0,
          });
          expect(focusPairProblems(view, sizes, ownBlock)).toEqual([]);
          expect(directionProblems(input, view)).toEqual([]);
          expect({ input, sizes }).toEqual(before);
        },
      ),
    );
  }, 30000);

  it('G8 rerunning layoutFocus reproduces every asset focus view byte for byte', () => {
    for (const set of expectedFocusSets) {
      const view = focus.layoutFocus(set, focusSizes, subjectBlock(set));
      const tuples = view.nodes.map((n) => [n.id, n.x, n.y]);
      expect(
        Buffer.compare(
          Buffer.from(JSON.stringify(tuples)),
          Buffer.from(JSON.stringify(layout.focus[set.key])),
        ),
        set.key,
      ).toBe(0);
    }
  }, 45000);

  it('G8 seeded restores Math.random on success, nesting and throw while repeating each seed (property)', () => {
    holds(
      fc.property(fc.integer({ min: -1000000, max: 1000000 }), (seed) => {
        const original = Math.random;
        const sample = (): number[] => Array.from({ length: 8 }, () => Math.random());
        const first = focus.seeded(seed, sample);
        expect(Math.random).toBe(original);
        expect(first.every((v) => v >= 0 && v < 1)).toBe(true);
        expect(focus.seeded(seed, sample)).toEqual(first);
        focus.seeded(seed, () => {
          const outer = Math.random;
          focus.seeded(seed + 1, sample);
          expect(Math.random).toBe(outer);
        });
        expect(Math.random).toBe(original);
        const sentinel = new Error('seeded throw witness');
        try {
          expect(() =>
            focus.seeded(seed, () => {
              throw sentinel;
            }),
          ).toThrow(sentinel);
        } finally {
          expect(Math.random).toBe(original);
        }
      }),
    );
  });

  it.each([
    [288, 320],
    [343, 440],
    [1152, 660],
  ])(
    'G8 frameFocus anchors the subject or topmost box and contains every fitting view at %i x %i',
    (width, height) => {
      const canvas = { width, height };
      for (const set of expectedFocusSets) {
        const view = assetView(set);
        const block = subjectBlock(set);
        const actual = focus.frameFocus(view, focusSizes, block, canvas);
        const expected = focusFrame(view, focusSizes, block, canvas);
        expect(actual.zoom, set.key).toBe(1);
        close(actual.pan.x, expected.pan.x, set.key);
        close(actual.pan.y, expected.pan.y, set.key);
        const boxes = focusBoxes(view, focusSizes, block);
        const all = extent(boxes);
        if (all.right - all.left <= width - 24 && all.bottom - all.top <= height - 24) {
          expect(
            boxes.every(
              (r) =>
                r.left + actual.pan.x >= 12 - 1e-9 &&
                r.right + actual.pan.x <= width - 12 + 1e-9 &&
                r.top + actual.pan.y >= 12 - 1e-9 &&
                r.bottom + actual.pan.y <= height - 12 + 1e-9,
            ),
            set.key,
          ).toBe(true);
        }
      }
    },
  );

  it('G8 frameFocus obeys fit and overflow rules for generated boxes, subjects and canvases (property)', () => {
    holds(
      fc.property(
        focused,
        fc.boolean(),
        fc.option(size, { nil: null }),
        fc.integer({ min: 288, max: 1400 }),
        fc.integer({ min: 320, max: 900 }),
        fc.integer({ min: 0, max: 1000 }),
        (values, subject, block, width, height, spacing) => {
          const { input, sizes } = arbitraryFocus(values, subject);
          const view: FocusView = {
            subject: input.subject,
            nodes: input.ids.map((id, i) => ({
              id,
              x: i % 2 === 0 ? -spacing : spacing,
              y: i * spacing,
            })),
          };
          const canvas = { width, height };
          const ownBlock = subject ? block : null;
          const actual = focus.frameFocus(view, sizes, ownBlock, canvas);
          const expected = focusFrame(view, sizes, ownBlock, canvas);
          expect(actual.zoom).toBe(1);
          close(actual.pan.x, expected.pan.x);
          close(actual.pan.y, expected.pan.y);
        },
      ),
    );
  });
});

// MAIN, from consultant-13's r2 boundary findings (`.scratch/agents/consultant-13.md` FOCUS): a
// singleton view has no pair to expose a broken coordinate, and an empty set has no box to frame.
describe('clinical network focus boundaries', { timeout: 30_000 }, () => {
  it('G8 a focus view with a non-finite coordinate is refused, a singleton included', () => {
    const key = Object.keys(layout.focus).find(
      (k) => k.startsWith('concept:') && layout.focus[k]?.length === 1,
    );
    expect(key).toBeDefined();
    const broken = structuredClone(layout);
    const tuple = broken.focus[key as string]?.[0];
    if (tuple === undefined) throw new Error('no singleton view');
    tuple[1] = Number.NaN;
    expect(producer.validateLayout(layout, network)).toEqual([]);
    expect(producer.validateLayout(broken, network).join('\n')).toMatch(key as string);
  });

  it('G8 an empty focus set is refused by name, never framed', () => {
    expect(() => focus.layoutFocus({ subject: null, ids: [], lines: [] }, new Map(), null)).toThrow(
      /no concept/u,
    );
  });
});
