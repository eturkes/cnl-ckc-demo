// g2 asset fields + role edges the N1–N12 suite leaves unasserted (Stryker survivors ruled
// `specified` by classifier-4/5/6, `.agent/contracts/mnt5-stryker.md` `## g2`). Expected values
// come from `.agent/contracts/g2.md` and independent reads of the bag, never from the producer.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveFrames, frameKey } from '../tools/kb/frames.mjs';
import { census, deriveClinicalNetwork, networkAsset, NETWORK_PATH } from '../tools/kb/network.mjs';
import * as tables from '../tools/kb/network-tables.mjs';
import { parseClauseSites } from '../tools/kb/provenance.mjs';
import {
  concept,
  consumed,
  oracleFrame,
  owned,
  readable,
  roles,
  sentenceKey,
} from './support/network-oracle.js';
import {
  envelope,
  fact,
  files,
  gid,
  project,
  root,
  type Network,
} from './support/network-subject.js';

const asset: Network = project();
const framed = deriveFrames(files);
const byDocument = (
  a: { document: string; sentence: number },
  b: { document: string; sentence: number },
): number => (a.document < b.document ? -1 : a.document > b.document ? 1 : a.sentence - b.sentence);

/** A bag of payload files under one guideline, each document with its own coverage section. */
const bag = (
  docs: {
    id: string;
    section?: string;
    sentences: { n?: number; text: string; clauses: string[] }[];
  }[],
  extra: Record<string, string> = {},
): Map<string, Uint8Array> => {
  const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
  const out = new Map<string, Uint8Array>();
  for (const { id, sentences } of docs) {
    const pl = sentences
      .map((s, i) => `% S${String(s.n ?? i + 1)}: ${s.text}\n${s.clauses.join('\n')}\n`)
      .join('\n');
    out.set(`data/guidelines/network/pl/${id}.pl`, encode(pl));
  }
  const rows = docs.map(
    ({ id, section = 'BOX 1 > Recommendation 1' }, i) =>
      `R${String(i + 1)}\tsource.txt\tp1\t${section}\tace(${id})`,
  );
  out.set(
    'data/guidelines/network/coverage.tsv',
    encode(`id\tfile\tpage\tsection\tstatus\n${rows.join('\n')}\n`),
  );
  for (const [path, text] of Object.entries(extra)) out.set(path, encode(text));
  return out;
};
const derive = (input: Map<string, Uint8Array>): Network =>
  deriveClinicalNetwork(input, envelope, tables);

/** One `should` claim: <actor> should <verb> <object>, under an optional condition body. */
const claim = (
  document: string,
  n: number,
  {
    actor = 'clinician',
    verb = 'consider',
    object = "'opioid-therapy'",
    body = '',
    op = 'should',
  } = {},
): { n: number; text: string; clauses: string[] } => {
  const b = gid(document, n, 'box', 1);
  const r = (k: number): string => gid(document, n, 'ref', k);
  const tail = body === '' ? '' : ` :- ${body}`;
  const c = (name: string, ...args: string[]): string =>
    `${fact(name, ...args).slice(0, -1)}${tail}.`;
  return {
    n,
    text: `It is recommended that a ${actor} ${verb}s a ${object.replaceAll("'", '')}.`,
    clauses: [
      c('operator', 'actual', b, op),
      c('entity', b, r(1), actor, 'countable'),
      c('entity', b, r(2), object, 'countable'),
      c('event', b, r(3), verb),
      c('arg', b, r(3), '1', r(1)),
      c('arg', b, r(3), '2', r(2)),
    ],
  };
};

describe('clinical network fields', () => {
  it('F1 a payload holds exactly the owned literals no role consumes', () => {
    const oracles = new Map(framed.frames.map((f) => [frameKey(f), oracleFrame(f)]));
    expect(asset.occurrences.length).toBeGreaterThan(0);
    for (const occ of asset.occurrences) {
      const o = oracles.get(occ.key.split('@')[0] ?? '');
      const e = o?.events.find((x) => x.id === occ.event);
      if (o === undefined || e === undefined) throw new Error(`${occ.key}: no oracle event`);
      // g2.md Payload keeps every property; the reading consumes a T2 property alone. The oracle's
      // `consumed` also counts the actor's and target's properties, which N6 (a union) tolerates.
      const t2 =
        roles(o, e, tables).rule.target === 'T2'
          ? e.args.find((a) => a.args[2] === '2')?.args[3]
          : undefined;
      const used = new Set(
        [...consumed(o, e, tables)].filter((line) => {
          const head = o.heads.find((h) => h.line === line);
          return head?.name !== 'property' || head.args[1] === t2;
        }),
      );
      const free = new Set(
        owned(o, e)
          .map((h) => h.line)
          .filter((line) => !used.has(line)),
      );
      expect(
        occ.payload.map((p) => p.line).sort((a, b) => a - b),
        occ.key,
      ).toEqual([...free].sort((a, b) => a - b));
    }
  });

  it('F2 each coverage row states its form, variant count and grades from the frames', () => {
    const excluded = new Set(
      framed.records.filter((r) => r.name === 'guideline_exclusion').map((r) => sentenceKey(r)),
    );
    const frames = new Map<string, (typeof framed.frames)[number][]>();
    for (const f of framed.frames)
      frames.set(sentenceKey(f), [...(frames.get(sentenceKey(f)) ?? []), f]);
    expect(asset.coverage).toHaveLength(1813);
    for (const row of asset.coverage) {
      const key = sentenceKey(row);
      const own = frames.get(key) ?? [];
      expect(row.variants, key).toBe(own.length);
      const graded = own.some((f) => f.heads.some((h) => h.name === 'guideline_grade'));
      const eventless = own.every((f) => !f.heads.some((h) => h.name === 'guideline_event'));
      const cyclic = own.some((f) => oracleFrame(f).cyclic);
      const form = excluded.has(key)
        ? 'exclusion'
        : graded
          ? 'grade'
          : eventless
            ? 'eventless'
            : cyclic
              ? 'fallback'
              : 'advice';
      expect(row.form, key).toBe(form);
      if (form === 'grade') {
        const heads = own.flatMap((f) => f.heads);
        expect(
          row.grades?.map((g) => [g.name, g.line]),
          key,
        ).toEqual(heads.map((h) => [h.name.replace(/^guideline_/u, ''), h.line]));
      } else expect(row.grades, key).toBeUndefined();
    }
    expect(asset.coverage.filter((r) => r.form === 'exclusion')).toHaveLength(12);
    expect(asset.coverage.filter((r) => r.form === 'grade')).toHaveLength(12);
  });

  it('F3 a statement names its sentence, form and occurrences, and its document only when it names no concept', () => {
    const occurrences = new Map(asset.occurrences.map((o) => [o.key, o]));
    const documents = new Set(asset.documents.map((d) => d.id));
    expect(asset.statements.length).toBeGreaterThan(0);
    for (const s of asset.statements) {
      expect(s.document, s.id).toBe(
        s.concepts.length === 0 ? (s.sentence.split(':')[0] ?? '') : null,
      );
      if (s.document !== null) expect(documents.has(s.document), s.id).toBe(true);
      if (s.form === 'eventless' || s.form === 'fallback') expect(s.occurrences, s.id).toEqual([]);
      else expect(s.occurrences.length, s.id).toBeGreaterThan(0);
      for (const key of s.occurrences) {
        const o = occurrences.get(key);
        expect(o?.bucket, `${s.id} ${key}`).toBe(s.form === 'shared' ? 'shared' : 'statement');
        expect(sentenceKey(o ?? { document: '', sentence: 0 }), s.id).toBe(s.sentence);
      }
      for (const c of s.concepts) expect(concept(c), `${s.id} ${c}`).toBe(true);
    }
    const statementBucket = asset.occurrences.filter((o) => o.bucket === 'statement');
    expect(
      statementBucket.every((o) =>
        asset.statements.some((s) => s.form === 'statement' && s.occurrences.includes(o.key)),
      ),
    ).toBe(true);
  });

  it('F4 every document, occurrence, line and loop carries the kind its coverage section names', () => {
    const kinds = new Map<string, string>();
    const coverage = Buffer.from(
      files.get('data/guidelines/cdc-2022-opioid/coverage.tsv') ?? [],
    ).toString('utf8');
    for (const row of coverage.split('\n')) {
      const [, , , section = '', status = ''] = row.split('\t');
      const id = /^ace\((.+)\)$/u.exec(status)?.[1];
      if (id === undefined) continue;
      const parts = section.split(' > ');
      kinds.set(
        id,
        parts.some((p) => /^Recommendation \d+$/u.test(p))
          ? 'recommendation'
          : parts.includes('Implementation considerations')
            ? 'implementation'
            : 'supporting',
      );
    }
    const ids = [...new Set(asset.coverage.map((c) => c.document))].sort();
    expect(asset.documents).toEqual(ids.map((id) => ({ id, kind: kinds.get(id) })));
    expect(new Set(asset.documents.map((d) => d.kind))).toEqual(
      new Set(['recommendation', 'implementation', 'supporting']),
    );
    const occurrences = new Map(asset.occurrences.map((o) => [o.key, o]));
    for (const o of asset.occurrences) expect(o.kind, o.key).toBe(kinds.get(o.document));
    for (const l of [...asset.lines, ...asset.loops])
      for (const k of l.occurrences) expect(l.kind, l.id).toBe(occurrences.get(k)?.kind);
  });

  it('F5 coverage sorts by document then sentence number, documents by id, whatever the file order', () => {
    expect(asset.coverage.slice().sort(byDocument)).toEqual(asset.coverage);
    const model = derive(
      bag([
        {
          id: 'z-doc',
          sentences: [claim('z-doc', 10), claim('z-doc', 2)],
        },
        { id: 'a-doc', section: 'Background', sentences: [claim('a-doc', 1)] },
      ]),
    );
    expect(model.coverage.map((c) => sentenceKey(c))).toEqual(['a-doc:1', 'z-doc:2', 'z-doc:10']);
    expect(model.documents).toEqual([
      { id: 'a-doc', kind: 'supporting' },
      { id: 'z-doc', kind: 'recommendation' },
    ]);
  });

  it('F6 concepts are exactly the line, loop, statement and boundary nouns plus recommendation', () => {
    const expected = new Set([
      ...asset.lines.flatMap((l) => [l.source, l.target]),
      ...asset.loops.map((l) => l.concept),
      ...asset.statements.flatMap((s) => s.concepts),
      ...asset.boundaries.lines.map((l) => l.source),
      'recommendation',
    ]);
    expect(asset.concepts.map((c) => c.id)).toEqual([...expected].sort());
    for (const c of asset.concepts) expect(c.label, c.id).toBe(readable(c.id));
  });

  it('F7 each boundary condition joins every concept noun its exclusion clause names', () => {
    const sites = parseClauseSites(files).filter((s) => s.predicate === 'guideline_exclusion');
    const ENTITY = /guideline_entity\([^,()]+,[^,()]+,('(?:[^']|'')*'|[A-Za-z0-9_-]+)/gu;
    const expected = asset.boundaries.conditions.flatMap(({ id, sources }) => {
      const nouns = new Set<string>();
      for (const { document, sentence } of sources)
        for (const site of sites.filter((s) => s.document === document && s.sentence === sentence))
          for (const m of site.text.matchAll(ENTITY)) {
            const noun = (m[1] ?? '').replace(/^'(.*)'$/u, '$1').replaceAll("''", "'");
            if (concept(noun)) nouns.add(noun);
          }
      return [...nouns].sort().map((source) => `${id} ${source}`);
    });
    expect(expected.length).toBeGreaterThan(0);
    expect(asset.boundaries.lines.map((l) => `${l.condition} ${l.source}`).sort()).toEqual(
      expected.sort(),
    );
    expect(asset.boundaries.concept).toBe('recommendation');
    expect(asset.boundaries.reading).toBe('recommendations do not apply');
  });

  it('F8 a line or loop is superseded and date-guarded exactly as its occurrences are', () => {
    const occurrences = new Map(asset.occurrences.map((o) => [o.key, o]));
    const superseded = asset.occurrences.filter((o) => o.superseded !== null);
    expect(superseded).toHaveLength(3);
    for (const o of superseded) expect(o.guards.supersession, o.key).not.toBeNull();
    let flagged = 0;
    const drawn = superseded.filter((o) => o.bucket === 'line' || o.bucket === 'loop');
    for (const l of [...asset.lines, ...asset.loops]) {
      for (const k of l.occurrences) {
        const o = occurrences.get(k);
        expect(l.superseded, l.id).toBe(o?.superseded !== null);
        expect(l.guarded, l.id).toBe(o?.guards.supersession !== null);
      }
      if (l.guarded) flagged += 1;
    }
    expect(flagged > 0).toBe(drawn.length > 0);
  });

  it('F9 a supersession source decodes its quoted law and URL', () => {
    const doc = 'network-superseded';
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            {
              ...claim(doc, 1),
              clauses: [
                ...claim(doc, 1).clauses,
                `guideline_supersession('${doc}',1,source('Law of the People''s Act','https://example.org/a''b'),20221229).`,
              ],
            },
          ],
        },
      ]),
    );
    const o = model.occurrences.find((x) => x.sentence === 1);
    expect(o?.superseded).toEqual({
      law: "Law of the People's Act",
      url: "https://example.org/a'b",
      date: 20221229,
    });
  });

  it('F10 networkAsset writes the projection under its digest envelope', () => {
    const input = 'f'.repeat(64);
    const read = (name: string): Buffer => readFileSync(join(root, 'tools', 'kb', name));
    const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
    const written = networkAsset(files, input);
    const expectedEnvelope = {
      input,
      producer: sha(Buffer.concat([read('network.mjs'), read('frames.mjs')])),
      tables: sha(read('network-tables.mjs')),
    };
    expect(written.path).toBe(NETWORK_PATH);
    const model = JSON.parse(Buffer.from(written.bytes).toString('utf8')) as Network;
    expect(model.envelope).toEqual(expectedEnvelope);
    expect(model).toEqual(
      JSON.parse(JSON.stringify(deriveClinicalNetwork(files, expectedEnvelope, tables))),
    );
    expect(written.stats).toEqual({
      sentences: model.coverage.length,
      lines: model.lines.length,
      loops: model.loops.length,
    });
  });

  it('F11 a document kind follows its section heading alone', () => {
    const sections = {
      'k-rec': 'BOX 1 > Recommendation 12',
      'k-imp': 'Rec 3 > Implementation considerations',
      'k-sup': 'Rec 3 > Supporting rationale',
      'k-odd': 'Recommendation x',
      'k-nested': 'Recommendations > Recommendation 4',
      'k-prefix': 'BOX 2 > Recommendation 1 discussion',
      'k-suffix': 'Discussion of Recommendation 1',
    };
    const model = derive(
      bag(
        Object.entries(sections).map(([id, section]) => ({
          id,
          section,
          sentences: [claim(id, 1)],
        })),
        {
          'xdata/guidelines/network/coverage.tsv':
            'id\tfile\tpage\tsection\tstatus\nX\ts\tp1\tBOX 1 > Recommendation 1\tace(k-sup)\n',
          'data/guidelines/network/coverage.tsv.bak':
            'id\tfile\tpage\tsection\tstatus\nX\ts\tp1\tBOX 1 > Recommendation 1\tace(k-imp)\n',
        },
      ),
    );
    expect(Object.fromEntries(model.documents.map((d) => [d.id, d.kind]))).toEqual({
      'k-imp': 'implementation',
      'k-nested': 'recommendation',
      'k-odd': 'supporting',
      'k-prefix': 'supporting',
      'k-rec': 'recommendation',
      'k-suffix': 'supporting',
      'k-sup': 'supporting',
    });
  });

  it('F12 only a column-one marker in a payload file is a sentence', () => {
    const doc = 'network-markers';
    const real = claim(doc, 1);
    const model = derive(
      bag(
        [
          {
            id: doc,
            sentences: [{ ...real, clauses: [...real.clauses, '% note % S99: not a marker'] }],
          },
        ],
        {
          'xdata/guidelines/network/pl/other.pl': '% S1: A decoy sentence.\n',
          'data/guidelines/network/pl/other.pl.bak': '% S1: A backup sentence.\n',
          'README.md': '% S1: Read me.\n',
        },
      ),
    );
    expect(model.coverage.map((c) => sentenceKey(c))).toEqual([`${doc}:1`]);
  });

  it('F13 a treatment-in-course condition starts a line whoever gives or receives it', () => {
    const doc = 'network-course';
    const verbs = ['start', 'continue', 'prescribe', 'give', 'receive'];
    const model = derive(
      bag([
        {
          id: doc,
          sentences: verbs.map((verb, i) =>
            claim(doc, i + 1, {
              object: 'naloxone',
              body: [
                'guideline_entity(actual,C,clinician,countable)',
                "guideline_entity(actual,T,'opioid-therapy',countable)",
                `guideline_event(actual,E,${verb})`,
                'guideline_arg(actual,E,1,C)',
                'guideline_arg(actual,E,2,T)',
              ].join(', '),
            }),
          ),
        },
      ]),
    );
    for (let n = 1; n <= verbs.length; n += 1) {
      const o = model.occurrences.find((x) => x.sentence === n);
      expect(o?.sources, verbs[n - 1]).toEqual(['opioid-therapy']);
      expect(o?.bucket, verbs[n - 1]).toBe('line');
    }
  });

  it('F14 a quoted KB noun keeps its apostrophe as a concept', () => {
    const doc = 'network-quote';
    const model = derive(
      bag([
        { id: doc, sentences: [claim(doc, 1, { object: "'patient''s-pain'", actor: 'naloxone' })] },
      ]),
    );
    expect(model.concepts.map((c) => c.id)).toContain("patient's-pain");
    expect(model.occurrences[0]?.target).toBe("patient's-pain");
  });

  it('F15 a fact reads the finite form its own sentence spells', () => {
    const doc = 'network-facts';
    const fact1 = (
      n: number,
      verb: string,
      text: string,
    ): { n: number; text: string; clauses: string[] } => {
      const r = (k: number): string => gid(doc, n, 'ref', k);
      return {
        n,
        text,
        clauses: [
          fact('entity', 'actual', r(1), "'opioid-therapy'", 'countable'),
          fact('entity', 'actual', r(2), "'chronic-pain'", 'countable'),
          fact('event', 'actual', r(3), verb),
          fact('arg', 'actual', r(3), '1', r(1)),
          fact('arg', 'actual', r(3), '2', r(2)),
        ],
      };
    };
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            fact1(1, 'be', 'Opioid-therapies are a chronic-pain.'),
            fact1(2, 'have', 'Opioid-therapies have a chronic-pain.'),
            fact1(3, 'cycle', 'An opioid-therapy cycles a chronic-pain.'),
            fact1(4, 'carry', 'An opioid-therapy carries a chronic-pain.'),
            fact1(5, 'reach', 'An opioid-therapy reaches a chronic-pain.'),
          ],
        },
      ]),
    );
    expect(model.occurrences.map((o) => o.reading)).toEqual([
      'are',
      'have',
      'cycles',
      'carries',
      'reaches',
    ]);
  });

  it('F16 a T3 complement prefers the concept phrase whatever its order, and a bare property target is none', () => {
    const doc = 'network-complement';
    const b = (n: number): string => gid(doc, n, 'box', 1);
    const r = (n: number, k: number): string => gid(doc, n, 'ref', k);
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            {
              n: 1,
              text: 'It is recommended that a clinician collaborates with a patient on an opioid-taper-plan.',
              clauses: [
                fact('operator', 'actual', b(1), 'should'),
                fact('entity', b(1), r(1, 1), 'clinician', 'countable'),
                fact('entity', b(1), r(1, 2), 'patient', 'countable'),
                fact('entity', b(1), r(1, 3), "'opioid-taper-plan'", 'countable'),
                fact('event', b(1), r(1, 4), 'collaborate'),
                fact('arg', b(1), r(1, 4), '1', r(1, 1)),
                fact('pp', b(1), r(1, 4), 'with', r(1, 2)),
                fact('pp', b(1), r(1, 4), 'on', r(1, 3)),
              ],
            },
            {
              n: 2,
              text: 'It is recommended that an opioid-therapy is appropriate.',
              clauses: [
                fact('operator', 'actual', b(2), 'should'),
                fact('entity', b(2), r(2, 1), "'opioid-therapy'", 'countable'),
                fact('property', b(2), r(2, 2), 'appropriate', 'pos'),
                fact('event', b(2), r(2, 3), 'be'),
                fact('arg', b(2), r(2, 3), '1', r(2, 1)),
                fact('arg', b(2), r(2, 3), '2', r(2, 2)),
              ],
            },
          ],
        },
      ]),
    );
    const [first, second] = model.occurrences;
    expect(first?.target).toBe('opioid-taper-plan');
    expect(first?.rule.target).toBe('T3');
    expect(second?.target).toBeNull();
    expect(second?.rule.target).toBeNull();
  });

  it('F17 a consequent fact is never a start, and an actor without a noun sources nothing', () => {
    const doc = 'network-heads';
    const r = (k: number): string => gid(doc, 1, 'ref', k);
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            {
              n: 1,
              text: 'A patient has a chronic-pain and a clinician treats a severe-pain and it helps a severe-pain.',
              clauses: [
                fact('entity', 'actual', r(1), 'patient', 'countable'),
                fact('entity', 'actual', r(2), "'chronic-pain'", 'countable'),
                fact('event', 'actual', r(3), 'have'),
                fact('arg', 'actual', r(3), '1', r(1)),
                fact('arg', 'actual', r(3), '2', r(2)),
                fact('entity', 'actual', r(4), 'clinician', 'countable'),
                fact('entity', 'actual', r(5), "'severe-pain'", 'countable'),
                fact('event', 'actual', r(6), 'treat'),
                fact('arg', 'actual', r(6), '1', r(4)),
                fact('arg', 'actual', r(6), '2', r(5)),
                fact('event', 'actual', r(7), 'help'),
                fact('arg', 'actual', r(7), '1', r(8)),
                fact('arg', 'actual', r(7), '2', r(5)),
              ],
            },
          ],
        },
      ]),
    );
    const treat = model.occurrences.find((o) => o.event === 'ref(6)');
    expect(treat?.sources).toEqual([]);
    expect(treat?.rule.sources).toBe('S4');
    const help = model.occurrences.find((o) => o.event === 'ref(7)');
    expect(help?.actor).toBeNull();
    expect(help?.sources).toEqual([]);
    expect(help?.bucket).toBe('loop');
  });

  it('F18 a joint box counts main events alone, and its statement names only its members', () => {
    const doc = 'network-joint';
    const b = (n: number, k = 1): string => gid(doc, n, 'box', k);
    const r = (n: number, k: number): string => gid(doc, n, 'ref', k);
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            {
              n: 1,
              text: 'A clinician may ask a patient and the patient tapers an opioid-therapy.',
              clauses: [
                fact('operator', 'actual', b(1), 'may'),
                fact('entity', b(1), r(1, 1), 'clinician', 'countable'),
                fact('entity', b(1), r(1, 2), 'patient', 'countable'),
                fact('entity', b(1), r(1, 3), "'opioid-therapy'", 'countable'),
                fact('event', b(1), r(1, 4), 'ask'),
                fact('arg', b(1), r(1, 4), '1', r(1, 1)),
                fact('arg', b(1), r(1, 4), '2', r(1, 2)),
                fact('event', b(1), r(1, 5), 'taper'),
                fact('arg', b(1), r(1, 5), '1', r(1, 2)),
                fact('arg', b(1), r(1, 5), '2', r(1, 3)),
              ],
            },
            {
              n: 2,
              text: 'An opioid-therapy may treat a chronic-pain and work, and a clinician should give a naloxone.',
              clauses: [
                fact('operator', 'actual', b(2), 'may'),
                fact('entity', b(2), r(2, 1), "'opioid-therapy'", 'countable'),
                fact('entity', b(2), r(2, 2), "'chronic-pain'", 'countable'),
                fact('event', b(2), r(2, 3), 'treat'),
                fact('arg', b(2), r(2, 3), '1', r(2, 1)),
                fact('arg', b(2), r(2, 3), '2', r(2, 2)),
                fact('event', b(2), r(2, 4), 'work'),
                fact('arg', b(2), r(2, 4), '1', r(2, 1)),
                fact('operator', 'actual', b(2, 2), 'should'),
                fact('entity', b(2, 2), r(2, 5), 'clinician', 'countable'),
                fact('entity', b(2, 2), r(2, 6), 'naloxone', 'countable'),
                fact('event', b(2, 2), r(2, 7), 'give'),
                fact('arg', b(2, 2), r(2, 7), '1', r(2, 5)),
                fact('arg', b(2, 2), r(2, 7), '2', r(2, 6)),
              ],
            },
          ],
        },
      ]),
    );
    const first = model.occurrences.filter((o) => o.sentence === 1);
    expect(first.map((o) => [o.event, o.bucket])).toEqual([['ref(4)', 'statement']]);
    expect(first[0]?.payload.some((p) => p.name === 'event' && p.args.includes('taper'))).toBe(
      true,
    );
    const shared = model.statements.filter((s) => s.form === 'shared');
    expect(shared.map((s) => [s.sentence, s.concepts])).toEqual([
      [`${doc}:2`, ['chronic-pain', 'opioid-therapy']],
    ]);
    expect(model.occurrences.find((o) => o.event === 'ref(7)')?.bucket).toBe('loop');
  });

  it('F19 the table census reads a nounless time quantity as no subject and no situation, and a nounless actor as no concept', () => {
    // README-dist `Comparison conditions`: a condition's time quantity has no entity literal, so
    // `at least 3 days elapse` gives `elapse` a subject with no noun; a consequent may name it.
    const doc = 'network-quantity';
    const body =
      'guideline_event(actual,E,elapse), guideline_arg(actual,E,1,F), guideline_cardinality(actual,F,na,G,H), guideline_unit(actual,F,I), guideline_satisfies(G,H,I,geq,3,day)';
    const sentence = (n: number, text: string, heads: (id: (k: number) => string) => string[]) => ({
      n,
      text,
      clauses: heads(
        (k) => `'$guideline_id'(product,'${doc}',${String(n)},ref(${String(k)}),[E,F,G,H,I])`,
      ).map((head) => `${head} :- ${body}.`),
    });
    const input = bag([
      {
        id: doc,
        sentences: [
          sentence(
            1,
            'If at least 3 days elapse then a clinician reassesses an opioid-therapy.',
            (id) => [
              `guideline_entity(actual,${id(1)},clinician,countable)`,
              `guideline_entity(actual,${id(2)},'opioid-therapy',countable)`,
              `guideline_event(actual,${id(3)},reassess)`,
              `guideline_arg(actual,${id(3)},1,${id(1)})`,
              `guideline_arg(actual,${id(3)},2,${id(2)})`,
            ],
          ),
          sentence(2, 'If at least 3 days elapse then they suffice for an acute-pain.', (id) => [
            `guideline_entity(actual,${id(1)},'acute-pain',countable)`,
            `guideline_event(actual,${id(2)},suffice)`,
            `guideline_arg(actual,${id(2)},1,F)`,
            `guideline_pp(actual,${id(2)},for,${id(1)})`,
          ]),
          sentence(
            3,
            'If at least 3 days elapse then a clinician reassesses an opioid-therapy for them.',
            (id) => [
              `guideline_entity(actual,${id(1)},clinician,countable)`,
              `guideline_entity(actual,${id(2)},'opioid-therapy',countable)`,
              `guideline_event(actual,${id(3)},reassess)`,
              `guideline_arg(actual,${id(3)},1,${id(1)})`,
              `guideline_arg(actual,${id(3)},2,${id(2)})`,
              `guideline_pp(actual,${id(3)},for,F)`,
            ],
          ),
        ],
      },
    ]);
    const c = census(deriveFrames(input).frames, tables);
    expect([...c.subjects.keys()]).toEqual([]);
    expect([...c.situations.keys()]).toEqual(['acute-pain']);
    expect(c.situations.get('acute-pain')).toEqual(new Map([['suffice', [`${doc}:2#1`]]]));
  });

  /** A sentence of fact heads built from box and ref ids of its own document and number. */
  const facts = (
    doc: string,
    n: number,
    text: string,
    heads: (b: (k: number) => string, r: (k: number) => string) => string[][],
  ): { n: number; text: string; clauses: string[] } => ({
    n,
    text,
    clauses: heads(
      (k) => gid(doc, n, 'box', k),
      (k) => gid(doc, n, 'ref', k),
    ).map(([name = '', ...args]) => fact(name, ...args)),
  });

  it('F20 an event embeds by its subject or a nested referent, never by the parent actor or an equal subject', () => {
    const doc = 'network-embed';
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            // A nested event naming the parent's actor alone stays a main event.
            facts(
              doc,
              1,
              'A clinician should tell a patient and a naloxone may help the clinician.',
              (b, r) => [
                ['operator', 'actual', b(1), 'should'],
                ['entity', b(1), r(1), 'clinician', 'countable'],
                ['entity', b(1), r(2), 'patient', 'countable'],
                ['event', b(1), r(3), 'tell'],
                ['arg', b(1), r(3), '1', r(1)],
                ['arg', b(1), r(3), '2', r(2)],
                ['operator', b(1), b(2), 'may'],
                ['entity', b(2), r(4), 'naloxone', 'countable'],
                ['event', b(2), r(5), 'help'],
                ['arg', b(2), r(5), '1', r(4)],
                ['arg', b(2), r(5), '2', r(1)],
              ],
            ),
            // Two operator levels below its parent, an event naming the parent's object embeds.
            facts(
              doc,
              2,
              'A clinician should tell a patient that it may be possible that a naloxone can help the patient.',
              (b, r) => [
                ['operator', 'actual', b(1), 'should'],
                ['entity', b(1), r(1), 'clinician', 'countable'],
                ['entity', b(1), r(2), 'patient', 'countable'],
                ['event', b(1), r(3), 'tell'],
                ['arg', b(1), r(3), '1', r(1)],
                ['arg', b(1), r(3), '2', r(2)],
                ['operator', b(1), b(2), 'may'],
                ['operator', b(2), b(3), 'can'],
                ['entity', b(3), r(4), 'naloxone', 'countable'],
                ['event', b(3), r(5), 'help'],
                ['arg', b(3), r(5), '1', r(4)],
                ['arg', b(3), r(5), '2', r(2)],
              ],
            ),
            // The same actor never embeds, whatever object it shares.
            facts(
              doc,
              3,
              'A clinician should assess a patient and the clinician may reassess the patient.',
              (b, r) => [
                ['operator', 'actual', b(1), 'should'],
                ['entity', b(1), r(1), 'clinician', 'countable'],
                ['entity', b(1), r(2), 'patient', 'countable'],
                ['event', b(1), r(3), 'assess'],
                ['arg', b(1), r(3), '1', r(1)],
                ['arg', b(1), r(3), '2', r(2)],
                ['operator', b(1), b(2), 'may'],
                ['event', b(2), r(4), 'reassess'],
                ['arg', b(2), r(4), '1', r(1)],
                ['arg', b(2), r(4), '2', r(2)],
              ],
            ),
            // A nested event linked to its parent's object by a phrase alone embeds.
            facts(
              doc,
              4,
              'A clinician should treat a chronic-pain and a patient may sleep for the chronic-pain.',
              (b, r) => [
                ['operator', 'actual', b(1), 'should'],
                ['entity', b(1), r(1), 'clinician', 'countable'],
                ['entity', b(1), r(2), "'chronic-pain'", 'countable'],
                ['event', b(1), r(3), 'treat'],
                ['arg', b(1), r(3), '1', r(1)],
                ['arg', b(1), r(3), '2', r(2)],
                ['operator', b(1), b(2), 'may'],
                ['entity', b(2), r(4), 'patient', 'countable'],
                ['event', b(2), r(5), 'sleep'],
                ['arg', b(2), r(5), '1', r(4)],
                ['pp', b(2), r(5), 'for', r(2)],
              ],
            ),
          ],
        },
      ]),
    );
    const main = (n: number): string[] =>
      model.occurrences.filter((o) => o.sentence === n).map((o) => o.event);
    const payloadEvents = (n: number): string[] =>
      model.occurrences
        .filter((o) => o.sentence === n)
        .flatMap((o) => o.payload.filter((p) => p.name === 'event').map((p) => p.args.join(',')));
    expect(main(1)).toEqual(['ref(3)', 'ref(5)']);
    expect(main(2)).toEqual(['ref(3)']);
    expect(payloadEvents(2)).toEqual(['ref(5),help']);
    expect(main(3)).toEqual(['ref(3)', 'ref(4)']);
    expect(main(4)).toEqual(['ref(3)']);
    expect(payloadEvents(4)).toEqual(['ref(5),sleep']);
  });

  it('F21 a parent chain running into a cycle falls back whole to one statement', () => {
    const doc = 'network-cycle';
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            // affect → help(1) → help(2) → help(1): the first event only leads into the cycle.
            facts(
              doc,
              1,
              'It is recommended that a chronic-pain affects a naloxone and an opioid-therapy helps the chronic-pain and the chronic-pain helps the opioid-therapy.',
              (b, r) => [
                ['operator', 'actual', b(1), 'should'],
                ['entity', b(1), r(1), "'opioid-therapy'", 'countable'],
                ['entity', b(1), r(2), "'chronic-pain'", 'countable'],
                ['entity', b(1), r(4), 'naloxone', 'countable'],
                ['event', b(1), r(5), 'affect'],
                ['arg', b(1), r(5), '1', r(2)],
                ['arg', b(1), r(5), '2', r(4)],
                ['event', b(1), r(6), 'help'],
                ['arg', b(1), r(6), '1', r(1)],
                ['arg', b(1), r(6), '2', r(2)],
                ['event', b(1), r(7), 'help'],
                ['arg', b(1), r(7), '1', r(2)],
                ['arg', b(1), r(7), '2', r(1)],
              ],
            ),
          ],
        },
      ]),
    );
    expect(model.occurrences.filter((o) => o.document === doc)).toEqual([]);
    expect(model.coverage.find((c) => c.document === doc)?.form).toBe('fallback');
    expect(model.statements.filter((s) => s.sentence === `${doc}:1`)).toEqual([
      {
        id: `${doc}:1#1#fallback`,
        form: 'fallback',
        sentence: `${doc}:1`,
        occurrences: [],
        concepts: ['chronic-pain', 'naloxone', 'opioid-therapy'],
        document: null,
      },
    ]);
  });

  it('F22 a sentence with no consequent event is one eventless statement, its document named when it names no concept', () => {
    const doc = 'network-eventless';
    const body = [
      'guideline_entity(actual,A,patient,countable)',
      "guideline_entity(actual,B,'chronic-pain',countable)",
      'guideline_event(actual,C,have)',
      'guideline_arg(actual,C,1,A)',
      'guideline_arg(actual,C,2,B)',
    ].join(', ');
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            {
              n: 1,
              text: 'If a patient has a chronic-pain then there is a naloxone.',
              clauses: [
                `${fact('entity', 'actual', gid(doc, 1, 'ref', 4), 'naloxone', 'countable').slice(0, -1)} :- ${body}.`,
              ],
            },
            {
              n: 2,
              text: 'There is a clinician.',
              clauses: [fact('entity', 'actual', gid(doc, 2, 'ref', 1), 'clinician', 'countable')],
            },
          ],
        },
      ]),
    );
    expect(model.coverage.filter((c) => c.document === doc).map((c) => c.form)).toEqual([
      'eventless',
      'eventless',
    ]);
    expect(model.statements.filter((s) => s.sentence.startsWith(`${doc}:`))).toEqual([
      {
        id: `${doc}:1#1#eventless`,
        form: 'eventless',
        sentence: `${doc}:1`,
        occurrences: [],
        concepts: ['chronic-pain', 'naloxone'],
        document: null,
      },
      {
        id: `${doc}:2#1#eventless`,
        form: 'eventless',
        sentence: `${doc}:2`,
        occurrences: [],
        concepts: [],
        document: doc,
      },
    ]);
  });

  it('F23 a T2 line consumes its own property and its chosen phrase alone', () => {
    const doc = 'network-t2';
    const model = derive(
      bag([
        {
          id: doc,
          sentences: [
            facts(
              doc,
              1,
              'It is recommended that a naloxone is available for a severe chronic-pain and for an acute-pain and with the chronic-pain and a patient needs a naloxone-dose for the chronic-pain.',
              (b, r) => [
                ['operator', 'actual', b(1), 'should'],
                ['entity', b(1), r(1), 'naloxone', 'countable'],
                ['property', b(1), r(2), 'available', 'pos'],
                ['entity', b(1), r(3), "'chronic-pain'", 'countable'],
                ['property', b(1), r(3), 'severe', 'pos'],
                ['entity', b(1), r(4), "'acute-pain'", 'countable'],
                ['entity', b(1), r(5), 'patient', 'countable'],
                ['event', b(1), r(6), 'be'],
                ['arg', b(1), r(6), '1', r(1)],
                ['arg', b(1), r(6), '2', r(2)],
                ['pp', b(1), r(6), 'for', r(3)],
                ['pp', b(1), r(6), 'for', r(4)],
                ['pp', b(1), r(6), 'with', r(3)],
                ['pp', b(1), r(6), 'about', r(5)],
                ['event', b(1), r(7), 'need'],
                ['arg', b(1), r(7), '1', r(5)],
                ['entity', b(1), r(8), "'naloxone-dose'", 'countable'],
                ['arg', b(1), r(7), '2', r(8)],
                ['pp', b(1), r(7), 'for', r(3)],
              ],
            ),
          ],
        },
      ]),
    );
    const line = model.occurrences.find((o) => o.document === doc && o.event === 'ref(6)');
    expect(line?.rule.target).toBe('T2');
    expect(line?.target).toBe('chronic-pain');
    expect(line?.reading).toBe('should be available for');
    expect(line?.payload.map((p) => `${p.name}(${p.args.join(',')})`).sort()).toEqual(
      [
        'arg(ref(7),1,patient)',
        'arg(ref(7),2,naloxone-dose)',
        'entity(naloxone-dose,naloxone-dose,countable)',
        'entity(acute-pain,acute-pain,countable)',
        'entity(patient,patient,countable)',
        'event(ref(7),need)',
        'pp(ref(6),about,patient)',
        'pp(ref(6),for,acute-pain)',
        'pp(ref(6),with,chronic-pain)',
        'pp(ref(7),for,chronic-pain)',
        'property(chronic-pain,severe,pos)',
      ].sort(),
    );
  });

  it('F24 a date guard on the operator alone reaches the occurrence under it', () => {
    const doc = 'network-dated';
    const plain = claim(doc, 1);
    const guarded = plain.clauses.map((c) =>
      c.startsWith('guideline_operator(')
        ? `${c.slice(0, -1)} :- guideline_evaluation_date(V), guideline_satisfies(exactly,V,less,20221229).`
        : c,
    );
    const model = derive(bag([{ id: doc, sentences: [{ ...plain, clauses: guarded }] }]));
    const o = model.occurrences.find((x) => x.document === doc);
    expect(o?.guards).toEqual({ scope: null, supersession: '20221229' });
  });
});
