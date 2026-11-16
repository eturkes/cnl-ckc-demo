// The bounded layout child (`buildLayout`): reads the network + envelope, lays it out, writes the
// asset, reports the layout's end, and must then exit on its own — `layoutNetwork` destroys every
// Cytoscape core it makes, whose animation timer would otherwise hold the process open.

import { readFileSync, writeFileSync } from 'node:fs';

import { layoutNetwork } from './layout.mjs';

const [input = '', output = ''] = process.argv.slice(2);
/** @type {unknown} */
const parsed = JSON.parse(readFileSync(input, 'utf8'));
const { network, envelope } = /** @type {{ network: import('./layout.mjs').NetworkInput, envelope: unknown }} */ (parsed);
const { schemaVersion, ...body } = layoutNetwork(network);
writeFileSync(output, JSON.stringify({ schemaVersion, envelope, ...body }));
process.stdout.write(`${JSON.stringify({ event: 'layout-end' })}\n`);
