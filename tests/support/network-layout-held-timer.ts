// g4 G11: valid artifact + layout-end, then an event-loop handle that must be refused.
import { readFileSync, writeFileSync } from 'node:fs';
import { layoutNetwork } from '../../tools/kb/layout.mjs';
const [input = '', output = ''] = process.argv.slice(2);
const { network, envelope } = JSON.parse(readFileSync(input, 'utf8')) as {
  network: import('./network-layout-oracle.js').Network;
  envelope: import('./network-layout-oracle.js').Layout['envelope'];
};
const produce = layoutNetwork as unknown as (
  network: import('./network-layout-oracle.js').Network,
) => Promise<object>;
const body = await produce(network);
writeFileSync(output, JSON.stringify({ schemaVersion: 1, envelope, ...body }));
process.stdout.write(`${JSON.stringify({ event: 'layout-end' })}\n`);
setInterval(() => {}, 1000);
