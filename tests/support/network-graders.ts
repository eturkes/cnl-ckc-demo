// Pure g2 predicates. Inputs = produced asset + independently prepared frame reference + tables.
// Standalone authoring scripts and Vitest call these same functions; no producer or file I/O.
import assert from 'node:assert/strict';
import type { Frame, SentenceRecord } from '../../tools/kb/frames.mjs';
import { canonicalClause, readClause, referent, renderClause } from '../../tools/kb/frames.mjs';
import type * as Tables from '../../tools/kb/network-tables.mjs';
import type { Network, Occurrence } from './network-subject.js';
import {
  atom,
  bodyEvents,
  chain,
  concept,
  consumed,
  embeddedUnder,
  key,
  oracleFrame,
  owned,
  readable,
  reading,
  roles,
  sentenceKey,
  shared,
  starts,
  unique,
  type Event,
  type OracleFrame,
} from './network-oracle.js';

export type RuleTables = typeof Tables;
export interface Reference {
  frames: Frame[];
  records: SentenceRecord[];
  texts: Map<string, string>;
  files: Map<string, Uint8Array>;
  envelope: Network['envelope'];
  oracle: OracleFrame[];
  expected: { o: OracleFrame; e: Event; key: string }[];
  byFrame: Map<string, OracleFrame>;
}
export type Grader = (asset: Network, reference: Reference, tables: RuleTables) => void;
export const scan = (input: Map<string, Uint8Array>): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [path, bytes] of input) {
    const document = /data\/guidelines\/[^/]+\/pl\/([^/]+)\.pl$/u.exec(path)?.[1];
    if (document === undefined) continue;
    for (const line of new TextDecoder('utf8', { fatal: true }).decode(bytes).split('\n')) {
      const m = /^% S([1-9][0-9]*): (.*)$/u.exec(line);
      if (m === null) continue;
      const k: string = `${document}:${m[1] ?? ''}`;
      assert.equal(out.has(k), false, `duplicate input sentence ${k}`);
      out.set(k, m[2] ?? '');
    }
  }
  return out;
};
export const reference = (
  framed: { frames: Frame[]; records: SentenceRecord[] },
  files: Map<string, Uint8Array>,
  envelope: Network['envelope'],
): Reference => {
  const texts = scan(files);
  const oracle = framed.frames.map(oracleFrame);
  const excluded = new Set(
    framed.records.filter((r) => r.name === 'guideline_exclusion').map(sentenceKey),
  );
  const expected = oracle.flatMap((o) =>
    o.heads.some((h) => h.name === 'grade') || excluded.has(sentenceKey(o.frame))
      ? []
      : o.main.map((e) => ({ o, e, key: key(o, e) })),
  );
  return {
    ...framed,
    files,
    envelope,
    texts,
    oracle,
    expected,
    byFrame: new Map(oracle.map((o) => [`${sentenceKey(o.frame)}#${String(o.frame.variant)}`, o])),
  };
};
const index = (asset: Network): Map<string, Occurrence> =>
  new Map(asset.occurrences.map((o) => [o.key, o]));
const source = (r: Reference, occ: Occurrence): { o: OracleFrame; e: Event } => {
  const o = r.byFrame.get(`${sentenceKey(occ)}#${String(occ.variant)}`);
  const e = o?.events.find((e) => e.id === occ.event);
  assert.ok(o !== undefined && e !== undefined, `unresolvable occurrence ${occ.key}`);
  return { o, e };
};
const nonempty = <T>(xs: readonly T[], label: string): void => {
  assert.ok(xs.length > 0, `${label} is empty`);
};
export const N1: Grader = (asset, r) => {
  const actual = asset.coverage.map(sentenceKey);
  assert.equal(new Set(actual).size, actual.length, 'coverage duplicates');
  assert.deepEqual([...actual].sort(), [...r.texts.keys()].sort(), 'independent sentence ids');
  assert.equal(asset.schemaVersion, 1);
  assert.deepEqual(asset.envelope, r.envelope);
  assert.deepEqual(
    asset.coverage,
    [...asset.coverage].sort(
      (a, b) => a.document.localeCompare(b.document) || a.sentence - b.sentence,
    ),
  );
  const variants = new Map<string, number>();
  for (const o of r.oracle)
    variants.set(sentenceKey(o.frame), (variants.get(sentenceKey(o.frame)) ?? 0) + 1);
  const keys = new Map<string, string[]>();
  for (const o of asset.occurrences)
    keys.set(sentenceKey(o), [...(keys.get(sentenceKey(o)) ?? []), o.key]);
  for (const c of asset.coverage) {
    assert.equal(c.variants, variants.get(sentenceKey(c)) ?? 0, sentenceKey(c));
    assert.deepEqual(
      [...c.occurrences].sort(),
      [...(keys.get(sentenceKey(c)) ?? [])].sort(),
      sentenceKey(c),
    );
  }
};
export const N2: Grader = (asset, r, tables) => {
  const occurrences = index(asset);
  assert.deepEqual(
    asset.occurrences.map((o) => o.key).sort(),
    r.expected.map((o) => o.key).sort(),
    'main-event occurrence keys',
  );
  assert.equal(occurrences.size, asset.occurrences.length, 'duplicate occurrences');
  nonempty(r.expected, 'main events');
  for (const { o, e, key: k } of r.expected) {
    const actual = occurrences.get(k);
    assert.ok(actual, k);
    assert.equal(actual.bucket, roles(o, e, tables).bucket, k);
    for (const embedded of embeddedUnder(o, e)) {
      assert.equal(occurrences.has(key(o, embedded)), false, key(o, embedded));
      assert.equal(
        actual.payload.some((h) => h.line === embedded.head.line),
        true,
        `${k}: embedded ${embedded.id}`,
      );
    }
    const locations = {
      line: asset.lines.filter((x) => x.occurrences.includes(k)).length,
      loop: asset.loops.filter((x) => x.occurrences.includes(k)).length,
      shared: asset.statements.filter((x) => x.form === 'shared' && x.occurrences.includes(k))
        .length,
      statement: asset.statements.filter((x) => x.form === 'statement' && x.occurrences.includes(k))
        .length,
      example: asset.examples.filter((x) => x.occurrence === k).length,
    };
    for (const [bucket, count] of Object.entries(locations))
      assert.equal(count > 0, bucket === actual.bucket, `${k} in ${bucket}`);
  }
};
export const N3: Grader = (asset, r, tables) => {
  const occurrences = index(asset);
  nonempty(asset.occurrences, 'occurrences');
  for (const occ of asset.occurrences) {
    const { o, e } = source(r, occ);
    assert.deepEqual(occ.chain, chain(o, e), occ.key);
    assert.equal(occ.reading, reading(o, e, r.texts.get(sentenceKey(occ)) ?? '', tables), occ.key);
  }
  for (const line of [...asset.lines, ...asset.loops]) {
    nonempty(line.occurrences, line.id);
    for (const k of line.occurrences) assert.equal(line.reading, occurrences.get(k)?.reading, k);
  }
  const negative = asset.occurrences.filter((o) => o.chain[0] === 'should' && o.chain[1] === '-');
  nonempty(negative, 'should-not witness');
  for (const o of negative) assert.match(o.reading, /^should not /u, o.key);
};
export const N4: Grader = (asset, r, tables) => {
  nonempty(asset.occurrences, 'occurrences');
  for (const occ of asset.occurrences) {
    const { o, e } = source(r, occ);
    assert.deepEqual(occ.sources, roles(o, e, tables).sources, occ.key);
  }
};
export const N5: Grader = (asset, r, tables) => {
  nonempty(asset.occurrences, 'occurrences');
  for (const occ of asset.occurrences) {
    const { o, e } = source(r, occ);
    const expected = roles(o, e, tables);
    assert.deepEqual(
      {
        actor: occ.actor,
        target: occ.target,
        sources: occ.sources,
        rule: occ.rule,
        bucket: occ.bucket,
      },
      {
        actor: expected.actor,
        target: expected.target,
        sources: expected.sources,
        rule: expected.rule,
        bucket: expected.bucket,
      },
      occ.key,
    );
  }
};
export const N6: Grader = (asset, r, tables) => {
  nonempty(asset.occurrences, 'occurrences');
  for (const occ of asset.occurrences) {
    const { o, e } = source(r, occ);
    const used = consumed(o, e, tables);
    for (const h of owned(o, e)) {
      assert.ok(occ.lines.includes(h.line), `${occ.key} owned ${String(h.line)}`);
      if (used.has(h.line)) continue;
      const p = occ.payload.find((p) => p.line === h.line);
      assert.ok(p, `${occ.key} payload ${String(h.line)} ${h.name}`);
      assert.equal(p.name, h.name, occ.key);
      assert.deepEqual(
        p.args,
        h.args.slice(1).map((a) => o.nouns.get(a) ?? o.properties.get(a) ?? a),
        `${occ.key} args ${String(h.line)}`,
      );
    }
    assert.equal(new Set(occ.lines).size, occ.lines.length, occ.key);
    assert.equal(new Set(occ.payload.map((p) => p.line)).size, occ.payload.length, occ.key);
  }
};
export const N7: Grader = (asset, r) => {
  const occurrences = index(asset);
  const cases = r.expected.filter(({ o, e }) => shared(o, e));
  nonempty(cases, 'shared scope cases');
  for (const { key: k } of cases) assert.equal(occurrences.get(k)?.bucket, 'shared', k);
};
const operatorAncestors = (o: OracleFrame, e: Event): Frame['heads'] => {
  const ancestors = new Set<string>([e.context]);
  let ctx = e.context;
  while (ctx !== 'actual') {
    const parent = o.contexts.get(ctx)?.parent;
    if (parent === undefined) break;
    ancestors.add(parent);
    ctx = parent;
  }
  return o.frame.heads.filter(
    (h) => h.name === 'guideline_operator' && ancestors.has(referent(o.frame, h.args[1] ?? '')),
  );
};
export const N8: Grader = (asset, r) => {
  const occurrences = index(asset);
  nonempty(asset.lines, 'lines');
  const signature = (occ: Occurrence): unknown => {
    const { o, e } = source(r, occ);
    const eventIds = [e.id, ...embeddedUnder(o, e).map((x) => x.id)];
    const canonical = (arg: string): string =>
      eventIds.includes(arg) ? `event(${String(eventIds.indexOf(arg))})` : arg;
    return {
      reading: occ.reading,
      kind: occ.kind,
      superseded: occ.superseded,
      condition: r.texts.get(sentenceKey(occ)),
      guards: operatorAncestors(o, e).map((h) => h.guards),
      payload: occ.payload.map((h) => ({ name: h.name, args: h.args.map(canonical) })),
    };
  };
  for (const line of asset.lines) {
    let first: unknown;
    for (const k of line.occurrences) {
      const occ = occurrences.get(k);
      assert.ok(occ, k);
      assert.ok(occ.sources.includes(line.source), k);
      assert.equal(occ.target, line.target, k);
      assert.equal(occ.kind, line.kind, k);
      assert.equal(occ.superseded !== null, line.superseded, k);
      const complete = signature(occ);
      if (first === undefined) first = complete;
      else assert.deepEqual(complete, first, `${line.id}: unlike complete readings merged at ${k}`);
    }
  }
};
export const N9: Grader = (asset, r) => {
  const exclusion = r.records.filter((record) => record.name === 'guideline_exclusion');
  const supersession = r.records.filter((record) => record.name === 'guideline_supersession');
  assert.equal(exclusion.length, 12);
  assert.equal(asset.boundaries.conditions.length, 8);
  assert.equal(asset.boundaries.concept, 'recommendation');
  assert.equal(asset.boundaries.reading, 'recommendations do not apply');
  assert.deepEqual(
    asset.boundaries.conditions.flatMap((c) => c.sources.map(sentenceKey)).sort(),
    exclusion.map(sentenceKey).sort(),
  );
  const bodyKey = (record: SentenceRecord): string => {
    const path = [...r.files.keys()].find((p) => p.endsWith(`/pl/${record.document}.pl`));
    const lines = new TextDecoder().decode(r.files.get(path ?? '')).split('\n');
    let s = 0;
    const text = lines.find((line) => {
      const m = /^% S([0-9]+):/u.exec(line);
      if (m !== null) s = Number(m[1]);
      return s === record.sentence && line.startsWith('guideline_exclusion(');
    });
    assert.ok(text, 'exclusion clause missing');
    const { head, body } = readClause(text);
    const canonical = canonicalClause(head, body);
    return renderClause(canonical.head, canonical.body);
  };
  const groups = new Map<string, string[]>();
  for (const record of exclusion)
    groups.set(bodyKey(record), [...(groups.get(bodyKey(record)) ?? []), sentenceKey(record)]);
  assert.deepEqual(
    asset.boundaries.conditions.map((c) => c.sources.map(sentenceKey).sort().join('\0')).sort(),
    [...groups.values()].map((g) => g.sort().join('\0')).sort(),
  );
  for (const c of asset.boundaries.conditions) {
    assert.ok(c.sources[0]);
    assert.equal(c.id, sentenceKey(c.sources[0]));
    assert.equal(c.text, r.texts.get(c.id));
  }
  assert.equal(supersession.length, 3);
  for (const record of supersession) {
    const os = asset.occurrences.filter((o) => sentenceKey(o) === sentenceKey(record));
    nonempty(os, sentenceKey(record));
    const recordSource = /^source\('((?:[^']|'')*)','((?:[^']|'')*)'\)$/u.exec(
      record.args[2] ?? '',
    );
    assert.ok(recordSource, sentenceKey(record));
    for (const o of os)
      assert.deepEqual(
        o.superseded,
        {
          law: (recordSource[1] ?? '').replaceAll("''", "'"),
          url: (recordSource[2] ?? '').replaceAll("''", "'"),
          date: Number(record.args[3]),
        },
        o.key,
      );
  }
  for (const occ of asset.occurrences) {
    const { o, e } = source(r, occ);
    const guards = operatorAncestors(o, e);
    const scope = unique(guards.map((h) => h.guards.scope).filter((s): s is string => s !== null));
    const dates = unique(
      guards.map((h) => h.guards.supersession).filter((s): s is string => s !== null),
    );
    assert.equal(occ.guards.scope === null, scope.length === 0, occ.key);
    if (scope.length > 0) assert.equal(atom(String(occ.guards.scope)), atom(scope[0]), occ.key);
    assert.equal(occ.guards.supersession === null, dates.length === 0, occ.key);
    if (dates.length > 0) assert.equal(Number(occ.guards.supersession), Number(dates[0]), occ.key);
  }
};
export const N10: Grader = (asset, r, tables) => {
  const cases = r.expected.filter(({ o, e }) => roles(o, e, tables).bucket === 'example');
  nonempty(cases, 'example cases');
  assert.equal(asset.examples.length, cases.length);
  for (const { o, e, key: k } of cases) {
    const example = asset.examples.find((x) => x.occurrence === k);
    assert.ok(example, k);
    assert.equal(example.sentence, sentenceKey(o.frame), k);
    const items = unique([
      o.nouns.get(e.subject ?? '') ?? '',
      ...e.args.filter((a) => a.args[2] === '2').map((a) => o.nouns.get(a.args[3] ?? '') ?? ''),
    ]);
    assert.deepEqual([...example.items].sort(), items.sort(), k);
    assert.ok(
      asset.coverage.find((c) => sentenceKey(c) === sentenceKey(o.frame))?.occurrences.includes(k),
      k,
    );
    for (const item of example.items) {
      assert.ok(
        asset.examples.filter((x) => x.items.includes(item)).some((x) => x.occurrence === k),
        item,
      );
      assert.equal(
        asset.concepts.some((c) => c.id === item),
        false,
        item,
      );
    }
    assert.equal(
      asset.lines.some((l) => l.occurrences.includes(k)),
      false,
      k,
    );
    assert.equal(
      asset.loops.some((l) => l.occurrences.includes(k)),
      false,
      k,
    );
  }
};
export const N11: Grader = (asset, r) => {
  nonempty(asset.coverage, 'coverage');
  nonempty(asset.concepts, 'concepts');
  for (const c of asset.coverage) assert.equal(c.text, r.texts.get(sentenceKey(c)), sentenceKey(c));
  const nouns = new Set(r.oracle.flatMap((o) => [...o.nouns.values()]));
  for (const c of asset.concepts) {
    assert.equal(c.label, readable(c.id), c.id);
    assert.equal(concept(c.id), true, c.id);
    assert.equal(nouns.has(c.id), true, c.id);
  }
};
export const tableCensus = (
  r: Reference,
  tables: RuleTables,
): {
  subjects: Set<string>;
  complements: Set<string>;
  situations: Set<string>;
  time: Set<string>;
} => {
  const subjects = new Set<string>();
  const complements = new Set<string>();
  const situations = new Set<string>();
  const time = new Set<string>();
  for (const o of r.oracle) {
    for (const e of bodyEvents(o).filter((e) => e.context === 'actual' && !e.head.negated)) {
      const noun = o.nouns.get(e.subject ?? '');
      if (noun !== undefined) subjects.add(noun);
    }
    for (const e of o.main) {
      const role = roles(o, e, tables);
      if (e.args.every((a) => a.args[2] !== '2')) {
        for (const p of e.phrases) complements.add(`${e.verb} ${p.args[2] ?? ''}`);
        assert.ok(
          e.phrases.filter(
            (p) =>
              tables.COMPLEMENTS.has(`${e.verb} ${p.args[2] ?? ''}`) &&
              concept(o.nouns.get(p.args[3] ?? '') ?? null),
          ).length <= 1,
          key(o, e),
        );
      }
      if (!concept(role.actor) && starts(o, tables).filter((s) => s !== role.target).length === 0)
        for (const p of e.phrases.filter((p) => p.args[2] === 'for')) {
          const noun = o.nouns.get(p.args[3] ?? '');
          if (noun !== undefined) situations.add(noun);
        }
      const object = e.args.find((a) => a.args[2] === '2');
      const nouns =
        object !== undefined && o.nouns.has(object.args[3] ?? '')
          ? [o.nouns.get(object.args[3] ?? '')]
          : object !== undefined && o.properties.has(object.args[3] ?? '')
            ? e.phrases.filter((p) => p.args[2] === 'for').map((p) => o.nouns.get(p.args[3] ?? ''))
            : object === undefined
              ? e.phrases
                  .filter((p) => tables.COMPLEMENTS.has(`${e.verb} ${p.args[2] ?? ''}`))
                  .map((p) => o.nouns.get(p.args[3] ?? ''))
              : [];
      for (const n of nouns) if (n !== undefined && tables.TIME_WORD.test(n)) time.add(n);
    }
  }
  return { subjects, complements, situations, time };
};
export const N12: Grader = (_asset, r, tables) => {
  const c = tableCensus(r, tables);
  const partition = (
    name: string,
    candidates: Set<string>,
    included: Iterable<string>,
    excluded: Record<string, string[]>,
  ): void => {
    const yes = [...included];
    const no = Object.values(excluded).flat();
    assert.equal(
      new Set([...yes, ...no]).size,
      yes.length + no.length,
      `${name} overlaps or duplicates`,
    );
    assert.deepEqual([...yes, ...no].sort(), [...candidates].sort(), name);
  };
  partition('patient roles', c.subjects, tables.PATIENT_ROLES, tables.PATIENT_ROLE_EXCLUSIONS);
  partition('complements', c.complements, tables.COMPLEMENTS, tables.COMPLEMENT_EXCLUSIONS);
  partition('situations', c.situations, tables.SITUATIONS.keys(), tables.SITUATION_EXCLUSIONS);
  partition('time data', c.time, tables.TIME_DATA, tables.TIME_DATA_EXCLUSIONS);
};
export const GRADERS = { N1, N2, N3, N4, N5, N6, N7, N8, N9, N10, N11, N12 };
