// Build-time layout of the clinical network (contract `.agent/contracts/g4.md`): label boxes from
// HarfBuzz over the shipped font, seeded fcose over the main component with the three pain anchors
// in one row and every other concept below it, an overlap pass whose last step stacks downward so
// no box pair overlaps at zoom 1, an explicit shelf packer for every other component, and reveal
// zooms. `layoutNetwork` runs inside a bounded child (`layout-child.mjs`); `buildLayout` owns the
// child, its deadlines and the cache keyed by the input closure.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import fontverter from 'fontverter';
import { Blob, Buffer as ShapeBuffer, Face, Font, Variation, shape } from 'harfbuzzjs';

import { directionEdges, focusSets, layoutFocus, seeded } from '../../src/network/focus.ts';
import { ANCHORS, METRICS, boxOf, frameFull, labelHeight, labelWidth, overlaps, reveals, sep } from '../../src/network/geometry.ts';
import { ROOT } from './paths.mjs';

// The page derives a view's lines by the same function (`src/network/focus.ts`).
export { focusSets };

cytoscape.use(fcose);

export const LAYOUT_PATH = 'graph/clinical-network-layout.json';
export const LAYOUT_SCHEMA_VERSION = 1;
export const SEED = 1;
/**
 * The first pass's anchor spacing; the second puts acute and chronic at the ends of a row as wide as
 * the first pass (`D` = half its width) with every other node between and below them, so the three
 * anchor labels clear each other at the full fit of the narrowest canvas.
 */
export const D0 = 1000;
export const ROW_GAP = 60;
export const COLUMN_GAP = 40;
/** Room the passes keep above the pair gap, so rounding to 0.01 model px never closes a gap. */
const SLACK = 0.05;

export class LayoutError extends Error {
  /** @override */
  name = 'LayoutError';
}

const FONT_FILE = join(
  ROOT,
  'node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2',
);
const CHILD = new URL('./layout-child.mjs', import.meta.url);
/** @type {readonly (readonly [string, string])[]} */
export const CLOSURE_FILES = Object.freeze([
  ['font', FONT_FILE],
  ['geometry', join(ROOT, 'src/network/geometry.ts')],
  ['focus', join(ROOT, 'src/network/focus.ts')],
  ['layout', new URL(import.meta.url).pathname],
  ['child', CHILD.pathname],
  ['lockfile', join(ROOT, 'pnpm-lock.yaml')],
]);
const CACHE_DIR = join(ROOT, 'node_modules/.cache/cnl-ckc-demo/layout');

/** @param {string | Uint8Array} bytes */
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// HarfBuzz reads sfnt alone; the shipped face is woff2.
const face = new Face(new Blob(await fontverter.convert(readFileSync(FONT_FILE), 'sfnt')));
const font = new Font(face);
font.setVariations([new Variation('wght', METRICS.font.weight)]);
const mapped = new Set(face.collectUnicodes());

/** @param {string} text */
const advance = (text) => {
  const buffer = new ShapeBuffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  shape(font, buffer);
  return (buffer.getGlyphPositions().reduce((sum, glyph) => sum + glyph.xAdvance, 0) / face.upem) * METRICS.font.size;
};

/**
 * A label wrapped at word boundaries to the wrap width (a longer word keeps its own line) and its
 * box size.
 *
 * @param {string} text
 * @returns {{ lines: string[], W: number, H: number }}
 */
export const measureLabel = (text) => {
  for (const char of text) {
    const code = /** @type {number} */ (char.codePointAt(0));
    if (!mapped.has(code)) throw new LayoutError(`label "${text}": U+${code.toString(16).toUpperCase()} is not in the shipped face`);
  }
  /** @type {string[]} */
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && advance(next) > METRICS.wrap) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  return { lines, W: labelWidth(Math.max(...lines.map(advance))), H: labelHeight(lines.length) };
};

/**
 * A focus subject's loop block: each reading wrapped like a label, stacked as one label; `readings`
 * keeps each reading's own lines, so a reading's boundary survives the stacking.
 *
 * @param {readonly string[]} readings
 */
const measureBlock = (readings) => {
  const parts = readings.map(measureLabel);
  const lines = parts.flatMap((part) => part.lines);
  return { readings: parts.map((part) => part.lines), W: Math.max(...parts.map((part) => part.W)), H: labelHeight(lines.length) };
};

/**
 * @typedef {{ id: string, x: number, y: number, W: number, H: number, degree: number, anchor: boolean,
 *   lines: string[], component: number }} Placed
 */

/** Box height at zoom 1, dot to label bottom. @param {Placed} n */
const height = (n) => {
  const box = boxOf(n);
  return box.bottom - box.top;
};

/** Box width at zoom 1. @param {Placed} n */
const width = (n) => {
  const box = boxOf(n);
  return box.right - box.left;
};

/**
 * fcose over one node set; positions returned as points (a node's fcose body is its box, centred
 * on the box; the point sits `(gap + H) / 2` above that centre).
 *
 * @param {Placed[]} nodes @param {[string, string][]} pairs @param {object} constraints
 * @returns {Map<string, { x: number, y: number }>}
 */
const fcoseRun = (nodes, pairs, constraints) => {
  const offset = (/** @type {Placed} */ n) => (METRICS.labelGap + n.H) / 2;
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      ...nodes.map((n) => ({ data: { id: n.id, w: width(n) + METRICS.pairGap, h: height(n) + METRICS.pairGap } })),
      ...pairs.map(([source, target], i) => ({ data: { id: `pair:${String(i)}`, source, target } })),
    ],
    style: [{ selector: 'node', style: { width: 'data(w)', height: 'data(h)' } }],
  });
  try {
    seeded(SEED, () =>
      cy
        .layout(
          /** @type {import('cytoscape').LayoutOptions} */ ({
            name: 'fcose',
            animate: false,
            fit: false,
            randomize: true,
            quality: 'proof',
            nodeRepulsion: () => 900000,
            idealEdgeLength: () => 220,
            edgeElasticity: () => 0.15,
            nodeSeparation: 120,
            gravity: 0.05,
            numIter: 5000,
            ...constraints,
          }),
        )
        .run(),
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return new Map(
      cy.nodes().map((element) => {
        const { x, y } = element.position();
        return [element.id(), { x, y: y - offset(/** @type {Placed} */ (byId.get(element.id()))) }];
      }),
    );
  } finally {
    // Style-enabled headless Cytoscape runs a recurring animation timer that holds the process open.
    cy.destroy();
  }
};

/**
 * Overlap pass at zoom 1: a downward stacking pass in (y, id) order moves each node that overlaps a
 * box placed before it to just below that box. A move passes one placed box for good, so the pass
 * ends, with no overlapping pair; x never moves, so the side constraints hold. `fixed` nodes never
 * move; every other node ends below `floor`.
 *
 * @param {Placed[]} nodes @param {(n: Placed) => boolean} fixed @param {number} floor
 */
const separate = (nodes, fixed, floor) => {
  const clash = (/** @type {Placed} */ a, /** @type {Placed} */ b) =>
    (width(a) + width(b)) / 2 + METRICS.pairGap + SLACK > Math.abs(a.x - b.x) &&
    height(a.y <= b.y ? a : b) + METRICS.pairGap + SLACK > Math.abs(a.y - b.y);
  for (const n of nodes) if (!fixed(n) && n.y <= floor) n.y = floor + SLACK;
  /** @type {Placed[]} */
  const placed = nodes.filter(fixed);
  const stack = nodes.filter((n) => !fixed(n)).sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1));
  for (const n of stack) {
    for (let hit = placed.find((p) => clash(n, p)); hit !== undefined; hit = placed.find((p) => clash(n, p))) {
      n.y = Math.max(n.y, hit.y + height(hit) + METRICS.pairGap + 2 * SLACK);
    }
    placed.push(n);
  }
};

/** @param {Placed[]} nodes */
const bounds = (nodes) => {
  const boxes = nodes.map((n) => ({ n, box: boxOf(n) }));
  return {
    left: Math.min(...boxes.map(({ n, box }) => n.x + box.left)),
    right: Math.max(...boxes.map(({ n, box }) => n.x + box.right)),
    top: Math.min(...boxes.map(({ n, box }) => n.y + box.top)),
    bottom: Math.max(...boxes.map(({ n, box }) => n.y + box.bottom)),
  };
};

/** @param {number} value */
const round = (value) => Math.round(value * 100) / 100 + 0;

/**
 * @typedef {{ concepts: { id: string, label: string }[],
 *   lines: { source: string, target: string, occurrences?: string[] }[],
 *   loops: { concept: string, reading: string, occurrences?: string[] }[] }} NetworkInput
 */

/**
 * The layout asset body (envelope added by `buildLayout`).
 *
 * @param {NetworkInput} network
 */
export const layoutNetwork = (network) => {
  const degree = new Map(network.concepts.map((c) => [c.id, 0]));
  for (const line of network.lines) {
    degree.set(line.source, (degree.get(line.source) ?? 0) + 1);
    degree.set(line.target, (degree.get(line.target) ?? 0) + 1);
  }
  const parent = new Map(network.concepts.map((c) => [c.id, c.id]));
  const find = (/** @type {string} */ id) => {
    let root = id;
    while (parent.get(root) !== root) root = /** @type {string} */ (parent.get(root));
    for (let at = id; parent.get(at) !== root; ) {
      const next = /** @type {string} */ (parent.get(at));
      parent.set(at, root);
      at = next;
    }
    return root;
  };
  for (const line of network.lines) {
    const [a, b] = [find(line.source), find(line.target)].sort();
    if (a !== b) parent.set(/** @type {string} */ (b), /** @type {string} */ (a));
  }
  const anchorRoots = new Set(ANCHORS.map((id) => (parent.has(id) ? find(id) : `missing:${id}`)));
  if (anchorRoots.size !== 1 || [...anchorRoots][0]?.startsWith('missing:')) {
    throw new LayoutError(`the pain anchors ${ANCHORS.join(', ')} are not one component of the network`);
  }
  /** @type {Map<string, Placed>} */
  const nodes = new Map(
    network.concepts.map((c) => {
      const label = measureLabel(c.label);
      const anchor = /** @type {readonly string[]} */ (ANCHORS).includes(c.id);
      return [c.id, { id: c.id, x: 0, y: 0, W: label.W, H: label.H, lines: label.lines, degree: degree.get(c.id) ?? 0, anchor, component: 0 }];
    }),
  );
  /** @type {Map<string, Placed[]>} */
  const members = new Map();
  for (const n of nodes.values()) {
    const root = find(n.id);
    members.set(root, [...(members.get(root) ?? []), n]);
  }
  const pairsOf = (/** @type {Set<string>} */ ids) =>
    /** @type {[string, string][]} */ (
      [...new Set(network.lines.filter((l) => ids.has(l.source) && l.source !== l.target).map((l) => [l.source, l.target].sort().join('\u0000')))]
        .sort()
        .map((key) => key.split('\u0000'))
    );

  // Main component: the anchors in one row, every other node below the acute anchor.
  const main = /** @type {Placed[]} */ (members.get([...anchorRoots][0] ?? ''));
  const mainIds = new Set(main.map((n) => n.id));
  const mainPairs = pairsOf(mainIds);
  // With acute and chronic at the row's ends, the narrowest canvas's fit leaves the three labels a
  // fixed screen width whatever D is; subacute splits it in proportion to the clearance each side
  // needs, so the slack is shared rather than all on the narrower side.
  const [acuteNode, subacuteNode, chronicNode] = ANCHORS.map((id) => /** @type {Placed} */ (nodes.get(id)));
  const need = (/** @type {Placed} */ a, /** @type {Placed} */ b) => (width(a) + width(b)) / 2 + METRICS.pairGap;
  const subacuteX = (/** @type {number} */ D) => {
    const left = need(/** @type {Placed} */ (acuteNode), /** @type {Placed} */ (subacuteNode));
    const right = need(/** @type {Placed} */ (subacuteNode), /** @type {Placed} */ (chronicNode));
    return -D + (2 * D * left) / (left + right);
  };
  const row = (/** @type {number} */ D, /** @type {boolean} */ sides) => ({
    fixedNodeConstraint: ANCHORS.map((nodeId, i) => {
      const n = /** @type {Placed} */ (nodes.get(nodeId));
      return { nodeId, position: { x: i === 1 ? subacuteX(D) : (i - 1) * D, y: (METRICS.labelGap + n.H) / 2 } };
    }),
    relativePlacementConstraint: main
      .filter((n) => !n.anchor)
      .flatMap((n) => [
        { top: ANCHORS[0], bottom: n.id, gap: METRICS.pairGap },
        ...(sides ? [{ left: ANCHORS[0], right: n.id, gap: 0 }, { left: n.id, right: ANCHORS[2], gap: 0 }] : []),
      ]),
  });
  const first = fcoseRun(main, mainPairs, row(D0, false));
  const xs = [...first.values()].map((p) => p.x);
  const D = Math.round((Math.max(...xs) - Math.min(...xs)) / 2);
  for (const [id, p] of fcoseRun(main, mainPairs, row(D, true))) Object.assign(/** @type {Placed} */ (nodes.get(id)), p);
  separate(main, (n) => n.anchor, 0);

  // Every other component: one unconstrained fcose run for their shapes, each packed by the shelf.
  const rest = [...members.values()].filter((group) => group !== main);
  const many = rest.filter((group) => group.length >= 3);
  if (many.length > 0) {
    const all = many.flat();
    for (const [id, p] of fcoseRun(all, pairsOf(new Set(all.map((n) => n.id))), {})) {
      Object.assign(/** @type {Placed} */ (nodes.get(id)), p);
    }
  }
  for (const group of rest) {
    if (group.length === 2) {
      const [a, b] = /** @type {[Placed, Placed]} */ ([...group].sort((p, q) => (p.id < q.id ? -1 : 1)));
      Object.assign(a, { x: 0, y: 0 });
      Object.assign(b, { x: (width(a) + width(b)) / 2 + METRICS.pairGap + SLACK, y: 0 });
    } else if (group.length === 1) Object.assign(/** @type {Placed} */ (group[0]), { x: 0, y: 0 });
    else separate(group, () => false, -Infinity);
  }
  const mainBox = bounds(main);
  const ordered = rest
    .map((group) => ({ group, box: bounds(group), first: [...group].map((n) => n.id).sort()[0] ?? '' }))
    .sort(
      (a, b) =>
        b.group.length - a.group.length ||
        b.box.bottom - b.box.top - (a.box.bottom - a.box.top) ||
        (a.first < b.first ? -1 : 1),
    );
  let cursorX = mainBox.left;
  let rowTop = mainBox.bottom + ROW_GAP;
  let rowHeight = 0;
  for (const [index, { group, box }] of ordered.entries()) {
    const w = box.right - box.left;
    if (cursorX > mainBox.left && cursorX + w > mainBox.right) {
      cursorX = mainBox.left;
      rowTop += rowHeight + ROW_GAP;
      rowHeight = 0;
    }
    for (const n of group) {
      n.x += cursorX - box.left;
      n.y += rowTop - box.top;
      n.component = index + 1;
    }
    cursorX += w + COLUMN_GAP;
    rowHeight = Math.max(rowHeight, box.bottom - box.top);
  }

  for (const n of nodes.values()) Object.assign(n, { x: round(n.x), y: round(n.y) });
  const ranked = [...nodes.values()];
  for (const [i, a] of ranked.entries()) {
    for (const b of ranked.slice(i + 1)) {
      if (overlaps(a, b, METRICS.maxZoom)) throw new LayoutError(`${a.id} and ${b.id} overlap at zoom ${String(METRICS.maxZoom)}`);
    }
  }
  const reveal = new Map(reveals(ranked).map(({ id, reveal: z }) => [id, z]));
  /** @type {Map<string, Set<string>>} */
  const readings = new Map();
  for (const loop of network.loops) readings.set(loop.concept, new Set([...(readings.get(loop.concept) ?? []), loop.reading]));
  const blockSizes = new Map([...readings].map(([id, set]) => [id, measureBlock([...set].sort())]));
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    metrics: METRICS,
    row: { y: 0, D },
    nodes: [...reveals(ranked)].map(({ id }) => {
      const n = /** @type {Placed} */ (nodes.get(id));
      return { id, x: n.x, y: n.y, label: n.lines, W: n.W, H: n.H, reveal: reveal.get(id) ?? 0, degree: n.degree, component: n.component };
    }),
    blocks: [...readings].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, set]) => ({ id, ...measureBlock([...set].sort()) })),
    focus: focusViews(network, new Map([...nodes].map(([id, n]) => [id, { W: n.W, H: n.H }])), blockSizes),
  };
};

/**
 * @param {NetworkInput} network @param {Map<string, { W: number, H: number }>} sizes
 * @param {Map<string, { W: number, H: number }>} blocks
 * @returns {Record<string, [string, number, number][]>}
 */
const focusViews = (network, sizes, blocks) =>
  Object.fromEntries(
    focusSets(network).map(({ key, subject, ids, lines }) => {
      const view = layoutFocus({ subject, ids, lines }, sizes, subject === null ? null : (blocks.get(subject) ?? null));
      return [key, view.nodes.map((n) => /** @type {[string, number, number]} */ ([n.id, n.x, n.y]))];
    }),
  );

/**
 * The layout's input read back from the network asset's bytes.
 *
 * @param {Uint8Array} bytes @returns {NetworkInput & { envelope?: unknown }}
 */
export const networkInput = (bytes) => {
  /** @type {unknown} */
  const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
  return /** @type {NetworkInput & { envelope?: unknown }} */ (parsed);
};

/**
 * The input closure: every byte the asset is a function of.
 *
 * @param {NetworkInput & { envelope?: unknown }} network
 * @param {readonly (readonly [string, string])[]} [files] the file parts, `[name, path]` (tests point them at copies)
 */
export const closureOf = (network, files = CLOSURE_FILES) => {
  // The whole network asset, envelope included: the layout records that envelope for the page's
  // compatibility check, so a producer edit that leaves the content alone still re-keys the cache.
  /** @type {[string, string][]} */
  const parts = [
    ['network', sha256(JSON.stringify(network))],
    ...files.map(([name, path]) => /** @type {[string, string]} */ ([name, sha256(readFileSync(path))])),
    // Same-host determinism is what the spike measured; another platform or architecture is another closure.
    ['runtime', sha256(`${process.version} ${process.platform} ${process.arch}`)],
  ];
  return { digest: sha256(parts.map(([name, digest]) => `${name}:${digest}\n`).join('')), parts: Object.fromEntries(parts) };
};

/**
 * G1 over an asset body: every concept once, finite coordinates, labels and blocks re-measured
 * equal, the metrics current. Returns the problems found.
 *
 * @param {ReturnType<typeof layoutNetwork>} body @param {NetworkInput} network @returns {string[]}
 */
export const validateLayout = (body, network) => {
  /** @type {string[]} */
  const problems = [];
  if (body.schemaVersion !== LAYOUT_SCHEMA_VERSION) problems.push(`schemaVersion ${String(body.schemaVersion)}`);
  if (JSON.stringify(body.metrics) !== JSON.stringify(METRICS)) problems.push('metrics differ from geometry.ts');
  const labels = new Map(network.concepts.map((c) => [c.id, c.label]));
  const seen = new Set();
  for (const n of body.nodes) {
    if (seen.has(n.id)) problems.push(`${n.id} laid out twice`);
    seen.add(n.id);
    const label = labels.get(n.id);
    if (label === undefined) {
      problems.push(`${n.id} is no concept`);
      continue;
    }
    if (![n.x, n.y, n.reveal].every(Number.isFinite)) problems.push(`${n.id} has a non-finite coordinate or reveal`);
    const measured = measureLabel(label);
    if (n.label.join(' ') !== label || JSON.stringify(n.label) !== JSON.stringify(measured.lines)) problems.push(`${n.id} label lines differ`);
    if (n.W !== measured.W || n.H !== measured.H) problems.push(`${n.id} box ${String(n.W)}×${String(n.H)} differs from ${String(measured.W)}×${String(measured.H)}`);
  }
  for (const id of labels.keys()) if (!seen.has(id)) problems.push(`${id} has no position`);
  /** @type {Map<string, Set<string>>} */
  const readings = new Map();
  for (const loop of network.loops) readings.set(loop.concept, new Set([...(readings.get(loop.concept) ?? []), loop.reading]));
  const blocks = new Map(body.blocks.map((b) => [b.id, b]));
  for (const [id, set] of readings) {
    const block = blocks.get(id);
    const measured = measureBlock([...set].sort());
    if (block === undefined) problems.push(`${id} has loops but no block`);
    else if (JSON.stringify(block.readings) !== JSON.stringify(measured.readings) || block.W !== measured.W || block.H !== measured.H) problems.push(`${id} block differs`);
  }
  for (const id of blocks.keys()) if (!readings.has(id)) problems.push(`${id} has a block but no loop`);
  if (problems.length > 0) return problems;
  return [...gradeGeometry(body, network), ...gradeFocus(body, network)];
};

/**
 * G8: every focus set has its view, holding exactly its concepts; no two of its boxes (the subject's
 * loop block included) overlap at zoom 1; every kept direction edge points down.
 *
 * @param {ReturnType<typeof layoutNetwork>} body @param {NetworkInput} network @returns {string[]}
 */
const gradeFocus = (body, network) => {
  /** @type {string[]} */
  const problems = [];
  const sizes = new Map(body.nodes.map((n) => [n.id, n]));
  const blocks = new Map(body.blocks.map((b) => [b.id, b]));
  const sets = focusSets(network);
  if (Object.keys(body.focus).length !== sets.length) problems.push(`${String(Object.keys(body.focus).length)} focus views for ${String(sets.length)} focus sets`);
  for (const set of sets) {
    const view = body.focus[set.key];
    if (view === undefined) {
      problems.push(`${set.key} has no focus view`);
      continue;
    }
    if (JSON.stringify(view.map(([id]) => id)) !== JSON.stringify(set.ids)) problems.push(`${set.key} holds other concepts than its set`);
    // A singleton view has no pair to expose a broken coordinate.
    if (!view.every(([, x, y]) => Number.isFinite(x) && Number.isFinite(y))) problems.push(`${set.key} has a non-finite coordinate`);
    const placed = view.map(([id, x, y]) => ({ id, x, y, W: sizes.get(id)?.W ?? 0, H: sizes.get(id)?.H ?? 0 }));
    const blockOf = (/** @type {string} */ id) => (id === set.subject ? (blocks.get(id) ?? null) : null);
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        if (overlaps(a, b, 1, { a: blockOf(a.id), b: blockOf(b.id) })) problems.push(`${set.key}: ${a.id} and ${b.id} overlap`);
      }
    }
    const at = new Map(placed.map((n) => [n.id, n]));
    for (const [source, target] of directionEdges(set)) {
      if (!((at.get(source)?.y ?? 0) < (at.get(target)?.y ?? 0))) problems.push(`${set.key}: ${source} does not sit above ${target}`);
    }
    if (problems.length > 20) break;
  }
  return problems.slice(0, 20);
};

/** The narrowest canvas the page supports: the anchors must clear each other at its full fit. */
export const NARROWEST = Object.freeze({ width: 288, height: 320 });

/**
 * The geometry a valid asset holds (G2–G5): the anchor row, no box pair overlapping at the maximum
 * zoom, the reveals the rule gives (anchors 0), the anchors clear at the narrowest canvas's fit, the
 * degrees the lines give.
 *
 * @param {ReturnType<typeof layoutNetwork>} body @param {NetworkInput} network @returns {string[]}
 */
const gradeGeometry = (body, network) => {
  /** @type {string[]} */
  const problems = [];
  const degree = new Map(network.concepts.map((c) => [c.id, 0]));
  for (const line of network.lines) {
    degree.set(line.source, (degree.get(line.source) ?? 0) + 1);
    degree.set(line.target, (degree.get(line.target) ?? 0) + 1);
  }
  const nodes = body.nodes.map((n) => ({ ...n, anchor: /** @type {readonly string[]} */ (ANCHORS).includes(n.id) }));
  const [acute, subacute, chronic] = ANCHORS.map((id) => nodes.find((n) => n.id === id));
  if (acute === undefined || subacute === undefined || chronic === undefined) return ['an anchor has no position'];
  if (!(acute.y === subacute.y && subacute.y === chronic.y)) problems.push('the anchors do not share one row');
  if (!(acute.x < subacute.x && subacute.x < chronic.x)) problems.push('the anchors are not ordered acute, subacute, chronic');
  for (const n of nodes) {
    if (!n.anchor && n.y <= acute.y) problems.push(`${n.id} is not below the anchor row`);
    if (n.degree !== degree.get(n.id)) problems.push(`${n.id} degree ${String(n.degree)} is not its ${String(degree.get(n.id))} lines`);
  }
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      if (overlaps(a, b, METRICS.maxZoom)) problems.push(`${a.id} and ${b.id} overlap at zoom ${String(METRICS.maxZoom)}`);
    }
  }
  const expected = reveals(nodes);
  if (JSON.stringify(expected.map((r) => r.id)) !== JSON.stringify(nodes.map((n) => n.id))) problems.push('nodes are not in priority order');
  for (const [i, { id, reveal }] of expected.entries()) {
    if (nodes[i]?.reveal !== reveal) problems.push(`${id} reveal ${String(nodes[i]?.reveal)} is not ${String(reveal)}`);
  }
  const fit = frameFull({ nodes }, NARROWEST).zoom;
  for (const [a, b] of /** @type {const} */ ([[acute, subacute], [subacute, chronic], [acute, chronic]])) {
    if (sep(a, b) > fit) problems.push(`${a.id} and ${b.id} labels overlap at the ${String(NARROWEST.width)} px full fit (zoom ${String(fit)})`);
  }
  return problems.slice(0, 20);
};

/**
 * @typedef {{ force?: boolean, deadlineMs?: number, postLayoutMs?: number, child?: URL | string,
 *   cacheDir?: string, closureFiles?: readonly (readonly [string, string])[] }} BuildOptions
 */

/**
 * Whole-run deadline: 3 × the slowest run the load envelope allows — the spike's single pass took
 * 75 s on this desktop under load, and the layout runs two.
 */
export const DEADLINE_MS = 450_000;
/**
 * A child that reported its layout must exit by itself: the spike measured 43–46 ms; 10 s keeps a
 * held timer refused under the gate's load envelope without refusing a slow exit.
 */
export const POST_LAYOUT_MS = 10_000;

/**
 * Runs the child under both deadlines and returns its artifact bytes; refuses by name a child that
 * outlives the whole-run deadline, one still alive `postLayoutMs` after it reported the layout's
 * end (a held timer), and one exiting without a valid artifact.
 *
 * @param {URL | string} child @param {string} input @param {string} output
 * @param {{ deadlineMs: number, postLayoutMs: number }} limits @returns {Promise<Buffer>}
 */
const runChild = (child, input, output, { deadlineMs, postLayoutMs }) =>
  new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [child instanceof URL ? child.pathname : child, input, output], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    /** @type {string | null} */
    let refusal = null;
    const kill = (/** @type {string} */ why) => {
      refusal ??= why;
      proc.kill('SIGKILL');
    };
    const whole = setTimeout(() => kill(`whole-run deadline ${String(deadlineMs)} ms`), deadlineMs);
    /** @type {NodeJS.Timeout | undefined} */
    let after;
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (/** @type {string} */ chunk) => {
      if (after === undefined && chunk.includes('"event":"layout-end"')) {
        after = setTimeout(() => kill(`post-layout exit deadline ${String(postLayoutMs)} ms`), postLayoutMs);
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (/** @type {string} */ chunk) => {
      stderr += chunk;
    });
    proc.on('close', (code) => {
      clearTimeout(whole);
      clearTimeout(after);
      if (refusal !== null) reject(new LayoutError(`layout child refused: ${refusal}`));
      else if (code !== 0) {
        // Node ends an uncaught error's report with its version line; the error itself is the line naming it.
        const cause = stderr.split('\n').find((line) => /^\w*Error\b/u.test(line)) ?? stderr.trim().split('\n')[0] ?? '';
        reject(new LayoutError(`layout child exited ${String(code)}: ${cause}`));
      }
      else if (after === undefined) reject(new LayoutError('layout child exited without reporting the layout end'));
      else if (!existsSync(output)) reject(new LayoutError('layout child wrote no artifact'));
      else resolve(readFileSync(output));
    });
  });

/**
 * The layout asset through the cache and the bounded child: `{ path, bytes, cached, cacheFile }` —
 * `path` under `kb/generated`, like every build asset, `cacheFile` the cache entry. A hit is
 * validated like a fresh run; `force` bypasses the cache (the cache is still refreshed).
 *
 * @param {NetworkInput & { envelope?: unknown }} network @param {BuildOptions} [options]
 */
export const buildLayout = async (network, options = {}) => {
  const { force = false, deadlineMs = DEADLINE_MS, postLayoutMs = POST_LAYOUT_MS, child = CHILD, cacheDir = CACHE_DIR, closureFiles = CLOSURE_FILES } = options;
  const closure = closureOf(network, closureFiles);
  const cached = join(cacheDir, `${closure.digest}.json`);
  const finish = (/** @type {Buffer} */ bytes, /** @type {boolean} */ hit) => {
    /** @type {{ envelope: { digest: string } } & ReturnType<typeof layoutNetwork>} */
    /** @type {unknown} */
    const parsed = JSON.parse(bytes.toString('utf8'));
    const asset = /** @type {{ envelope: { digest: string } } & ReturnType<typeof layoutNetwork>} */ (parsed);
    const problems = [
      ...(asset.envelope.digest === closure.digest ? [] : ['envelope digest differs from the input closure']),
      ...validateLayout(asset, network),
    ];
    if (problems.length > 0) throw new LayoutError(`layout ${hit ? 'cache entry' : 'artifact'} invalid: ${problems.slice(0, 5).join('; ')}`);
    return { path: LAYOUT_PATH, bytes: new Uint8Array(bytes), cached: hit, cacheFile: cached };
  };
  if (!force && existsSync(cached)) return finish(readFileSync(cached), true);
  const scratch = mkdtempSync(join(tmpdir(), 'cnl-ckc-layout-'));
  try {
    const input = join(scratch, 'network.json');
    writeFileSync(input, JSON.stringify({ network, envelope: { digest: closure.digest, parts: closure.parts, network: network.envelope ?? null } }));
    const bytes = await runChild(child, input, join(scratch, 'layout.json'), { deadlineMs, postLayoutMs });
    const result = finish(bytes, false);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(`${cached}.tmp`, bytes);
    renameSync(`${cached}.tmp`, cached);
    return result;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};
