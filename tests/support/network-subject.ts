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

/** README-dist Skolem identity: coordinates plus the citing clause's dependency terms. */
export const dependentGid = (
  document: string,
  sentence: number,
  kind: 'ref' | 'box',
  n: number,
  deps: readonly string[],
): string => gid(document, sentence, kind, n).replace(',[])', `,[${deps.join(',')}])`);

/** g2r W2 verbatim; the optional ordinary argument also cites Low but owns no time pattern. */
export const inheritedRange = (ordinaryArgument = false): Map<string, Uint8Array> => {
  const document = 'range-inherited';
  const id = (kind: 'ref' | 'box', n: number): string =>
    dependentGid(document, 1, kind, n, ['Q', 'B', 'C']);
  const context = id('box', 1);
  const high = id('ref', 4);
  const event = id('ref', 5);
  const other = id('ref', 6);
  const body = [
    'guideline_event(actual,B,elapse)',
    'guideline_arg(actual,B,1,Q)',
    'guideline_cardinality(actual,Q,na,D,N)',
    'guideline_unit(actual,Q,U)',
    'guideline_satisfies(D,N,U,geq,8,hour)',
    'guideline_entity(actual,C,clinician,countable)',
    'guideline_cardinality(actual,C,na,eq,1)',
  ].join(', ');
  const heads = [
    fact('operator', 'actual', context, 'should'),
    fact('entity', context, high, 'hour', 'countable'),
    fact('cardinality', context, high, 'na', 'eq', '12'),
    fact('unit', context, high, 'hour'),
    fact('event', context, event, 'wait'),
    fact('arg', context, event, '1', 'C'),
    fact('pp', context, event, 'to', high),
    fact('range', context, 'Q', high),
    fact('pp', context, event, 'for', 'Q'),
    fact('interval', context, event, 'duration', 'Q', 'hour', 'none'),
    ...(ordinaryArgument
      ? [
          fact('event', context, other, 'mention'),
          fact('arg', context, other, '1', 'C'),
          fact('arg', context, other, '2', 'Q'),
        ]
      : []),
  ];
  return synthetic(document, [
    {
      text: ordinaryArgument
        ? 'If at least 8 hours elapse then every clinician should wait for the hours to 12 hours and mention the hours.'
        : 'If at least 8 hours elapse then every clinician should wait for the hours to 12 hours.',
      clauses: heads.map((head) => `${head.slice(0, -1)} :- ${body}.`),
    },
  ]);
};

/** S2 cites S1's product with bound Deps; its own same-slot product names another noun. */
export const earlierReference = (
  kind: 'order' | 'arg',
  slot = 1,
  noun = 'opioid-therapy',
): Map<string, Uint8Array> => {
  const document = `earlier-${kind}`;
  const first = dependentGid(document, 1, 'ref', slot, ['X']);
  const earlier = dependentGid(document, 1, 'ref', slot, ['B']);
  const current = (n: number): string => dependentGid(document, 2, 'ref', n, ['A', 'B']);
  const context = dependentGid(document, 2, 'box', 1, ['A', 'B']);
  const body1 =
    'guideline_entity(actual,X,patient,countable), guideline_cardinality(actual,X,na,eq,1)';
  const body2 = [
    'guideline_entity(actual,A,clinician,countable)',
    'guideline_cardinality(actual,A,na,eq,1)',
    'guideline_entity(actual,B,patient,countable)',
    'guideline_cardinality(actual,B,na,eq,1)',
  ].join(', ');
  const target = kind === 'arg' ? earlier : current(slot + 2);
  const heads = [
    fact('operator', 'actual', context, 'should'),
    fact('entity', context, current(slot), 'naloxone', 'countable'),
    fact('cardinality', context, current(slot), 'na', 'eq', '1'),
    ...(kind === 'order'
      ? [
          fact('entity', context, target, "'opioid-therapy'", 'countable'),
          fact('cardinality', context, target, 'na', 'eq', '1'),
        ]
      : []),
    fact('event', context, current(slot + 1), 'consider'),
    fact('arg', context, current(slot + 1), '1', 'A'),
    fact('arg', context, current(slot + 1), '2', target),
    fact('pp', context, current(slot + 1), 'with', current(slot)),
    ...(kind === 'order'
      ? [
          fact('pp', context, current(slot + 1), 'before', earlier),
          fact('order', context, current(slot + 1), 'before', earlier),
        ]
      : []),
  ];
  return synthetic(document, [
    {
      text: `If there is a patient then there is an ${noun}.`,
      clauses: [
        fact('entity', 'actual', first, `'${noun}'`, 'countable'),
        fact('cardinality', 'actual', first, 'na', 'eq', '1'),
      ].map((head) => `${head.slice(0, -1)} :- ${body1}.`),
    },
    {
      text: `If there is a clinician and there is a patient then the clinician should consider ${kind === 'arg' ? `the ${noun}` : 'an opioid-therapy'} with a naloxone${kind === 'order' ? ` before the ${noun}` : ''}.`,
      clauses: heads.map((head) => `${head.slice(0, -1)} :- ${body2}.`),
    },
  ]);
};

/** Every `% S` block and every id of a synthetic bag moved `shift` sentences on (g2r, Stryker R18/R32). */
export const renumbered = (
  input: Map<string, Uint8Array>,
  shift: number,
): Map<string, Uint8Array> => {
  const move = (n: string): string => String(Number(n) + shift);
  return new Map(
    [...input].map(([path, bytes]) => [
      path,
      path.endsWith('.pl')
        ? new TextEncoder().encode(
            new TextDecoder()
              .decode(bytes)
              .replace(/^% S([0-9]+):/gmu, (_, n: string) => `% S${move(n)}:`)
              .replace(
                /('\$guideline_id'\((?:context|product|witness),'[^']+',)([0-9]+),/gu,
                (_, id: string, n: string) => `${id}${move(n)},`,
              ),
          )
        : bytes,
    ]),
  );
};

/**
 * D8 under a conditional S2 (Deps [A,B]) in the actual context: the range's first id = S1's
 * quantity Low (Deps `lowDeps`, bound by S2's body), its second = S2's own High; `count` adds a
 * second event naming Low as its ordinary argument 2, no interval (D2's trap, Stryker Q26).
 */
export const earlierRange = (
  lowDeps: readonly string[],
  count = false,
): Map<string, Uint8Array> => {
  const document = 'g2r-conditional-range';
  const conditional = lowDeps.length > 0;
  const first = (n: number): string =>
    dependentGid(document, 1, 'ref', n, conditional ? ['X'] : []);
  const low = dependentGid(document, 1, 'ref', 1, lowDeps);
  const own = (n: number): string => dependentGid(document, 2, 'ref', n, ['A', 'B']);
  const body1 =
    'guideline_entity(actual,X,patient,countable), guideline_cardinality(actual,X,na,eq,1)';
  const body2 = [
    'guideline_entity(actual,A,clinician,countable)',
    'guideline_cardinality(actual,A,na,eq,1)',
    'guideline_entity(actual,B,patient,countable)',
    'guideline_cardinality(actual,B,na,eq,1)',
  ].join(', ');
  const s1 = [
    fact('entity', 'actual', first(1), 'hour', 'countable'),
    fact('cardinality', 'actual', first(1), 'na', 'geq', '8'),
    fact('unit', 'actual', first(1), 'hour'),
    fact('event', 'actual', first(2), 'elapse'),
    fact('arg', 'actual', first(2), '1', first(1)),
  ];
  const s2 = [
    fact('entity', 'actual', own(2), 'hour', 'countable'),
    fact('cardinality', 'actual', own(2), 'na', 'eq', '12'),
    fact('unit', 'actual', own(2), 'hour'),
    fact('event', 'actual', own(3), 'wait'),
    fact('arg', 'actual', own(3), '1', 'A'),
    fact('pp', 'actual', own(3), 'for', low),
    fact('interval', 'actual', own(3), 'duration', low, 'hour', 'none'),
    fact('pp', 'actual', own(3), 'to', own(2)),
    ...(count
      ? [
          fact('event', 'actual', own(4), 'count'),
          fact('arg', 'actual', own(4), '1', 'A'),
          fact('arg', 'actual', own(4), '2', low),
        ]
      : []),
    fact('range', 'actual', low, own(2)),
  ];
  return synthetic(document, [
    {
      text: conditional
        ? 'If there is a patient then at least 8 hours elapse.'
        : 'At least 8 hours elapse.',
      clauses: conditional ? s1.map((h) => `${h.slice(0, -1)} :- ${body1}.`) : s1,
    },
    {
      text: `If there is a clinician and there is a patient then the clinician waits for the hours to 12 hours${count ? ' and counts the hours' : ''}.`,
      clauses: s2.map((h) => `${h.slice(0, -1)} :- ${body2}.`),
    },
  ]);
};
