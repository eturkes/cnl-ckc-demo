// Reproduce asset-side RED witnesses: node tests/support/network-layout-plant.ts <kind> <output>.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Layout } from './network-layout-oracle.js';
const [kind = '', output = ''] = process.argv.slice(2);
const asset = JSON.parse(
  readFileSync(
    new URL('../../kb/generated/graph/clinical-network-layout.json', import.meta.url),
    'utf8',
  ),
) as Layout;
const first = asset.nodes[0];
const second = asset.nodes[1];
if (first === undefined || second === undefined)
  throw new Error('positive control: two anchors required');
if (kind === 'G1-inventory') asset.nodes.pop();
else if (kind === 'G1-label') first.label = ['wrong label'];
else if (kind === 'G1-envelope') asset.envelope.network['input'] = 'wrong-network';
else if (kind === 'G2') second.y -= 1;
else if (kind === 'G3') {
  const pair = asset.nodes
    .filter((n) => !['acute-pain', 'subacute-pain', 'chronic-pain'].includes(n.id))
    .slice(0, 2);
  const [a, b] = pair;
  if (a === undefined || b === undefined)
    throw new Error('positive control: non-anchor pair required');
  b.x = a.x;
  b.y = a.y;
} else if (kind === 'G4') {
  const n = asset.nodes.find((n) => n.reveal > 0);
  if (n === undefined) throw new Error('positive control: positive reveal required');
  n.reveal = 0;
} else if (kind === 'G5') second.x = first.x;
else if (kind === 'G7') {
  const n = asset.nodes.find((n) => n.component !== first.component);
  if (n === undefined) throw new Error('positive control: secondary component required');
  n.x = first.x;
  n.y = first.y;
} else if (kind === 'G8-inventory') {
  const key = Object.keys(asset.focus)[0];
  if (key === undefined) throw new Error('positive control: focus view required');
  delete asset.focus[key];
} else if (kind === 'G8-overlap') {
  const pair = Object.values(asset.focus).find((points) => points.length >= 2);
  const a = pair?.[0];
  const b = pair?.[1];
  if (a === undefined || b === undefined)
    throw new Error('positive control: two focus points required');
  b[1] = a[1];
  b[2] = a[2];
} else if (kind === 'G9') first.W = 4000;
else throw new Error(`unknown planted defect ${kind}`);
writeFileSync(output, JSON.stringify(asset));
process.stdout.write(`${kind}: one defective asset written\n`);
