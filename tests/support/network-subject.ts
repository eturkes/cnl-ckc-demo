// The public producer is always the subject. Expected semantics live in network-oracle.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBag } from '../../tools/kb/bag.mjs';
import { deriveClinicalNetwork } from '../../tools/kb/network.mjs';
import * as tables from '../../tools/kb/network-tables.mjs';

export type Network = ReturnType<typeof deriveClinicalNetwork>;
export type Occurrence = Network['occurrences'][number];
export const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const archive = readdirSync(join(root, 'kb')).find((s) => s.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('network subject: bag missing');
export const files = verifyBag(readFileSync(join(root, 'kb', archive))).files;
export const envelope = { input: '0'.repeat(64), producer: '1'.repeat(64), tables: '2'.repeat(64) };
export const project = (input = files): Network => deriveClinicalNetwork(input, envelope, tables);

export const synthetic = (
  document: string,
  sentences: { text: string; clauses: string[] }[],
): Map<string, Uint8Array> => {
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  const pl = sentences
    .map((s, i) => `% S${String(i + 1)}: ${s.text}\n${s.clauses.join('\n')}\n`)
    .join('\n');
  return new Map([
    [`data/guidelines/network/pl/${document}.pl`, encode(pl)],
    [
      'data/guidelines/network/coverage.tsv',
      encode(
        `id\tfile\tpage\tsection\tstatus\nR1\tsource.txt\tp1\tRecommendation 1\tace(${document})\n`,
      ),
    ],
  ]);
};
export const gid = (document: string, sentence: number, kind: 'ref' | 'box', n: number): string =>
  `'$guideline_id'(${kind === 'box' ? 'context' : 'product'},'${document}',${String(sentence)},${kind}(${String(n)}),[])`;
export const fact = (name: string, ...args: string[]): string =>
  `guideline_${name}(${args.join(',')}).`;
