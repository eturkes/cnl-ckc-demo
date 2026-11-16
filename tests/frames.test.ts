// `.agent/contracts/g1.md` F1–F7: the compiled bag read back into sentence frames, negation kept.
// Every census figure is derived twice — once through the frames, once by a plain scan of the
// bag's own text — and never transcribed.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  bodyBoxes,
  canonicalClause,
  chainOf,
  deriveFrames,
  FrameError,
  frameKey,
  readClause,
  referent,
  renderClause,
  sentenceFrames,
  type Frame,
  type Item,
} from '../tools/kb/frames.mjs';
import { parseClauseSites, ProvenanceError } from '../tools/kb/provenance.mjs';

import { bagFiles } from './clinical-test-support.js';
import { holds } from './support/property.js';
import {
  dependentGid,
  earlierReference,
  fact,
  gid,
  renumbered,
  synthetic,
} from './support/network-subject.js';

const sites = parseClauseSites(bagFiles);
const { frames, records } = sentenceFrames(sites);
const decoder = new TextDecoder('utf-8', { fatal: true });
const siteText = new Map(sites.map((site) => [site.line, site.text]));

/** The bag's compiled documents scanned as plain text: sentence comments and clause lines. */
const scan = (() => {
  const clauses = new Map<string, string[]>();
  const ace = new Map<string, string>();
  for (const [path, bytes] of bagFiles) {
    const match = /\/pl\/([^/]+)\.pl$/u.exec(path);
    if (match?.[1] === undefined) continue;
    const document = match[1];
    let sentence: number | null = null;
    for (const line of decoder.decode(bytes).split('\n')) {
      const comment = /^% S([1-9][0-9]*): (.*)$/u.exec(line);
      if (comment !== null) {
        sentence = Number(comment[1]);
        ace.set(`${document}:${String(sentence)}`, comment[2] ?? '');
        continue;
      }
      if (sentence === null || !line.startsWith('guideline_')) continue;
      const key = `${document}:${String(sentence)}`;
      clauses.set(key, [...(clauses.get(key) ?? []), /^guideline_[a-z_]+/u.exec(line)?.[0] ?? '']);
    }
  }
  return { clauses, ace };
})();

const sentenceKey = (frame: { document: string; sentence: number }): string =>
  `${frame.document}:${String(frame.sentence)}`;

const nafCount = (items: readonly Item[]): number =>
  items.reduce((n, item) => n + ('naf' in item ? 1 + nafCount(item.naf) : 0), 0);

describe('sentence frames', () => {
  it('F1 every sentence clause lands in exactly one frame or record', () => {
    const lines = [
      ...frames.flatMap((f) => f.heads.map((h) => h.line)),
      ...records.map((r) => r.line),
    ];
    expect(new Set(lines).size).toBe(lines.length);
    const collected = new Map<string, string[]>();
    for (const frame of frames) {
      const key = sentenceKey(frame);
      collected.set(key, [...(collected.get(key) ?? []), ...frame.heads.map((h) => h.name)]);
    }
    for (const record of records) {
      const key = sentenceKey(record);
      collected.set(key, [...(collected.get(key) ?? []), record.name]);
    }
    expect(collected.size).toBe(scan.clauses.size);
    for (const [key, names] of scan.clauses) {
      expect([...(collected.get(key) ?? [])].sort(), key).toEqual([...names].sort());
    }
  });

  it('F2a every site reads back to its own bytes', () => {
    for (const site of sites) {
      if (site.sentence === null) continue;
      const { head, body } = readClause(site.text);
      expect(renderClause(head, body), `line ${String(site.line)}`).toBe(site.text);
    }
  });

  it('F2b every frame clause equals its site up to renaming', () => {
    const canonicalText = (head: { name: string; args: string[] }, body: Item[]): string => {
      const renamed = canonicalClause(head, body);
      return renderClause(renamed.head, renamed.body);
    };
    const guardItems = (scope: string | null, supersession: string | null): Item[] => [
      ...(supersession === null
        ? []
        : [
            { literal: { name: 'guideline_evaluation_date', args: ['G'] } },
            {
              literal: {
                name: 'guideline_satisfies',
                args: ['exactly', 'G', 'less', supersession],
              },
            },
          ]),
      ...(scope === null
        ? []
        : [{ naf: [{ literal: { name: 'guideline_exclusion', args: [scope] } }] }]),
    ];
    for (const frame of frames) {
      for (const head of frame.heads) {
        const original = readClause(siteText.get(head.line) ?? '');
        const body = [...frame.body, ...guardItems(head.guards.scope, head.guards.supersession)];
        expect(
          canonicalText({ name: head.name, args: head.args }, body),
          `line ${String(head.line)}`,
        ).toBe(canonicalText(original.head, original.body));
      }
    }
  });

  it('F3 a sentence splits into variants exactly when its ACE antecedent holds a disjunction', () => {
    const variants = new Map<string, number>();
    for (const frame of frames)
      variants.set(sentenceKey(frame), (variants.get(sentenceKey(frame)) ?? 0) + 1);
    const split = [...variants].filter(([, n]) => n > 1).map(([key]) => key);
    const disjunctive = [...scan.ace]
      .filter(([, text]) => /^If .* or .* then /u.test(text))
      .map(([key]) => key);
    expect(split.length).toBeGreaterThan(0);
    expect([...split].sort()).toEqual([...disjunctive].sort());
    for (const key of split) expect(variants.get(key)).toBe(2);
  });

  it('F4 every consequent chain equals an independent walk of the operator heads in the bag text', () => {
    const box = /^'\$guideline_id'\(context,'([^']+)',([1-9][0-9]*),box\(([1-9][0-9]*)\)/u;
    const boxKey = (term: string): string => {
      const at = box.exec(term);
      return at === null ? term : `${at[1] ?? ''}:${at[2] ?? ''}:${at[3] ?? ''}`;
    };
    const operators = new Map<string, { outer: string; op: string }>();
    for (const site of sites) {
      if (site.predicate !== 'guideline_operator' || site.sentence === null) continue;
      const [outer = '', inner = '', op = ''] = site.head.args;
      operators.set(boxKey(inner), { outer: boxKey(outer), op });
    }
    const walk = (context: string): string[] => {
      const out: string[] = [];
      for (let at = boxKey(context); at !== 'actual';) {
        const step = operators.get(at);
        if (step === undefined) throw new Error(`no operator head for ${at}`);
        out.unshift(step.op);
        at = step.outer;
      }
      return out;
    };
    let events = 0;
    for (const frame of frames) {
      for (const head of frame.heads) {
        if (head.name !== 'guideline_event') continue;
        events += 1;
        const original = readClause(siteText.get(head.line) ?? '');
        expect(chainOf(frame, head.args[0] ?? ''), `line ${String(head.line)}`).toEqual(
          walk(original.head.args[0] ?? ''),
        );
      }
    }
    expect(events).toBe(
      sites.filter((s) => s.predicate === 'guideline_event' && s.sentence !== null).length,
    );
    const planted: Frame = { ...(frames[0] as Frame), heads: [] };
    expect(() => chainOf(planted, "'$guideline_id'(context,'x',1,box(9),[])")).toThrow(FrameError);
  });

  it('F5 negation survives: every \\+ is a NAF item or a scope guard, and body boxes keep their operator', () => {
    for (const frame of frames) {
      for (const head of frame.heads) {
        const text = siteText.get(head.line) ?? '';
        const written = text.split('\\+ ').length - 1;
        expect(nafCount(frame.body) + (head.guards.scope === null ? 0 : 1), frameKey(frame)).toBe(
          written,
        );
      }
    }
    const withdrawal = frames.find(
      (f) => f.document === 'cdc2022-opioid-s39-16' && f.sentence === 2,
    );
    expect(withdrawal).toBeDefined();
    const boxes = bodyBoxes(withdrawal as Frame);
    const have = (withdrawal as Frame).body.find(
      (item) =>
        'literal' in item &&
        item.literal.name === 'guideline_event' &&
        item.literal.args[2] === 'have',
    );
    expect(
      have !== undefined && 'literal' in have ? boxes.get(have.literal.args[0] ?? '') : null,
    ).toBe('-');
  });

  it('F6 the reader inverts the renderer over the corpus syntax and refuses anything else', () => {
    const atom = fc.oneof(
      fc.constantFrom('actual', 'should', 'countable', 'na', 'eq', '-'),
      fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/u).map((s) => `'${s}'`),
      fc.stringMatching(/^[a-z ]{0,6}$/u).map((s) => `'it''s ${s}'`),
      fc.integer({ min: 0, max: 99 }).map(String),
    );
    const variable = fc.stringMatching(/^[A-H]$/u);
    const id = fc
      .tuple(
        fc.constantFrom('product', 'context'),
        fc.integer({ min: 1, max: 9 }),
        fc.array(variable, { maxLength: 3 }),
      )
      .map(
        ([role, n, deps]) =>
          `'$guideline_id'(${role},'doc-a',1,${role === 'context' ? 'box' : 'ref'}(${String(n)}),[${deps.join(',')}])`,
      );
    const arg = fc.oneof(atom, variable, id);
    const literal = fc
      .tuple(
        fc.constantFrom('guideline_entity', 'guideline_event', 'guideline_arg'),
        fc.array(arg, { minLength: 1, maxLength: 4 }),
      )
      .map(([name, args]): Item => ({ literal: { name, args } }));
    const item: fc.Arbitrary<Item> = fc.oneof(
      { weight: 4, arbitrary: literal },
      {
        weight: 1,
        arbitrary: fc.array(literal, { minLength: 1, maxLength: 3 }).map((naf): Item => ({ naf })),
      },
    );
    holds(
      fc.property(literal, fc.array(item, { maxLength: 5 }), (head, body) => {
        const h = (head as { literal: { name: string; args: string[] } }).literal;
        const text = renderClause(h, body);
        const read = readClause(text);
        expect(renderClause(read.head, read.body)).toBe(text);
        expect(read).toEqual({ head: h, body });
      }),
    );
    expect(() =>
      readClause(
        'guideline_entity(actual,A,x,countable) :- guideline_event(actual,B,y) ; guideline_event(actual,C,z).',
      ),
    ).toThrow(FrameError);
    expect(() => readClause('guideline_entity(actual,A,x,countable)')).toThrow(FrameError);
    expect(() =>
      readClause('guideline_entity(actual,A,x,countable :- guideline_event(actual,B,y).'),
    ).toThrow(FrameError);
  });

  it('F7 census: sentences, records and consequent events agree with a plain scan of the bag', () => {
    expect(new Set(frames.map(sentenceKey)).size).toBe(scan.ace.size);
    const scannedRecords = [...scan.clauses.values()]
      .flat()
      .filter((name) => name === 'guideline_exclusion' || name === 'guideline_supersession').length;
    expect(records.length).toBe(scannedRecords);
    const scannedEvents = [...scan.clauses.values()]
      .flat()
      .filter((name) => name === 'guideline_event').length;
    expect(
      frames.reduce((n, f) => n + f.heads.filter((h) => h.name === 'guideline_event').length, 0),
    ).toBe(scannedEvents);
  });

  it('G2R-D5 foreign documents, future sentences and earlier non-product ids stay refused by name', () => {
    const document = 'g2r-invalid';
    const first = gid(document, 1, 'ref', 1);
    const actor = gid(document, 2, 'ref', 1);
    const event = gid(document, 2, 'ref', 2);
    const invalid = [
      gid('another-document', 1, 'ref', 1),
      gid(document, 3, 'ref', 1),
      gid(document, 1, 'box', 1),
      `'$guideline_id'(witness,'${document}',1,ref(1),[])`,
    ];
    for (const id of invalid) {
      const sentences = [
        {
          text: 'There is a naloxone.',
          clauses: [
            fact('entity', 'actual', first, 'naloxone', 'countable'),
            fact('cardinality', 'actual', first, 'na', 'eq', '1'),
          ],
        },
        {
          text: 'A clinician considers the naloxone.',
          clauses: [
            fact('entity', 'actual', actor, 'clinician', 'countable'),
            fact('cardinality', 'actual', actor, 'na', 'eq', '1'),
            fact('event', 'actual', event, 'consider'),
            fact('arg', 'actual', event, '1', actor),
            fact('arg', 'actual', event, '2', id),
          ],
        },
      ];
      const nonFirstPosition = synthetic(document, sentences);
      const firstPosition = synthetic(document, [
        sentences[0] as (typeof sentences)[number],
        {
          text: 'There is a naloxone.',
          clauses: [fact('entity', 'actual', id, 'naloxone', 'countable')],
        },
      ]);
      for (const input of [nonFirstPosition, firstPosition]) {
        for (const read of [deriveFrames, parseClauseSites]) {
          const run = (): unknown => read(input);
          expect(run, id).toThrow(ProvenanceError);
          expect(run, id).toThrow(/prolog-sentence:.*line [0-9]+/u);
        }
      }
    }
  });

  it('G2R-D10 an earlier referent with an unbound dependency is refused by referent and variable', () => {
    const oldId = dependentGid('earlier-arg', 1, 'ref', 1, ['B']);
    for (const variable of ['_', 'Z']) {
      const unbound = dependentGid('earlier-arg', 1, 'ref', 1, [variable]);
      const input = new Map(
        [...earlierReference('arg')].map(([path, bytes]) => [
          path,
          new TextEncoder().encode(decoder.decode(bytes).replaceAll(oldId, unbound)),
        ]),
      );
      const run = (): unknown => deriveFrames(input);
      expect(run, variable).toThrow(FrameError);
      expect(run, variable).toThrow(/unbound/iu);
      expect(run, variable).toThrow(/earlier-arg.*(?:1|ref\(1\))/u);
      expect(run, variable).toThrow(/variable|dep\([0-9]+\)|\b[A-Z]\b|_/u);
    }
  });

  // Stryker survivors consultant-12 ruled `specified` (`.agent/contracts/mnt5-stryker.md` `## g2r`).
  const invalidReference = (id: string, document = 'g2r-invalid'): Map<string, Uint8Array> => {
    const first = gid(document, 1, 'ref', 1);
    const actor = gid(document, 2, 'ref', 1);
    const event = gid(document, 2, 'ref', 2);
    return synthetic(document, [
      {
        text: 'There is a naloxone.',
        clauses: [
          fact('entity', 'actual', first, 'naloxone', 'countable'),
          fact('cardinality', 'actual', first, 'na', 'eq', '1'),
        ],
      },
      {
        text: 'A clinician considers the naloxone.',
        clauses: [
          fact('entity', 'actual', actor, 'clinician', 'countable'),
          fact('cardinality', 'actual', actor, 'na', 'eq', '1'),
          fact('event', 'actual', event, 'consider'),
          fact('arg', 'actual', event, '1', actor),
          fact('arg', 'actual', event, '2', id),
        ],
      },
    ]);
  };
  const invalidIds = [
    gid('another-document', 1, 'ref', 1),
    gid('g2r-invalid', 3, 'ref', 1),
    gid('g2r-invalid', 1, 'box', 1),
    `'$guideline_id'(witness,'g2r-invalid',1,ref(1),[])`,
  ];

  it('G2R-R02 an unbound dependency is named as the line writes it', () => {
    const oldId = dependentGid('earlier-arg', 1, 'ref', 1, ['B']);
    for (const variable of ['_', 'Z']) {
      const unbound = dependentGid('earlier-arg', 1, 'ref', 1, [variable]);
      const input = new Map(
        [...earlierReference('arg')].map(([path, bytes]) => [
          path,
          new TextEncoder().encode(decoder.decode(bytes).replaceAll(oldId, unbound)),
        ]),
      );
      expect(() => deriveFrames(input), variable).toThrow(
        new RegExp(`(?<![A-Za-z0-9_])${variable}(?![A-Za-z0-9_])`, 'u'),
      );
    }
  });

  it('G2R-R08 a box-local existential keeps its canonical variable, an antecedent referent reads dep(k)', () => {
    const variables = (items: Item[]): string[] =>
      items.flatMap((item) =>
        'literal' in item
          ? item.literal.args.filter((arg) => /^V[0-9]+$/u.test(arg))
          : variables(item.naf),
      );
    let local = 0;
    for (const frame of frames) {
      for (const variable of new Set(variables(frame.body))) {
        const k = frame.deps.indexOf(variable);
        if (k < 0) local += 1;
        expect(referent(frame, variable), `${frameKey(frame)} ${variable}`).toBe(
          k < 0 ? variable : `dep(${String(k)})`,
        );
      }
    }
    expect(local).toBeGreaterThan(0);
  });

  it('G2R-R31 a refused id names the physical line of its own clause', () => {
    const valid = gid('g2r-invalid', 2, 'ref', 3);
    const line = parseClauseSites(invalidReference(valid)).find((site) =>
      site.text.includes(valid),
    )?.line;
    expect(line).toBeGreaterThan(0);
    for (const id of invalidIds) {
      expect(() => parseClauseSites(invalidReference(id)), id).toThrow(
        new RegExp(`prolog-sentence: line ${String(line)}(?![0-9])`, 'u'),
      );
    }
  });

  it('G2R-R32 an id citing sentence 10 or later is checked like any other', () => {
    holds(
      fc.property(fc.integer({ min: 9, max: 200 }), fc.constantFrom(...invalidIds), (shift, id) => {
        expect(() => parseClauseSites(renumbered(invalidReference(id), shift))).toThrow(
          ProvenanceError,
        );
      }),
    );
  });
});
