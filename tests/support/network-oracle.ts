// Independent reading of g2's roles, embedding and buckets. Imports g1 + ruled data only.
import { chainOf, frameKey, referent, type Frame, type Item } from '../../tools/kb/frames.mjs';
import * as tables from '../../tools/kb/network-tables.mjs';

export const atom = (s = ''): string =>
  s.startsWith("'") ? s.slice(1, -1).replaceAll("''", "'") : s;
export const readable = (s: string): string => atom(s).replaceAll('-', ' ');
export const concept = (s: string | null): s is string =>
  s !== null && !['clinician', 'patient', 'benefit', 'risk'].includes(s);
export const sentenceKey = (f: { document: string; sentence: number }): string =>
  `${f.document}:${String(f.sentence)}`;
export const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
export interface Literal {
  name: string;
  args: string[];
  line: number;
  negated: boolean;
}
export interface Event {
  id: string;
  context: string;
  verb: string;
  head: Literal;
  subject: string | null;
  args: Literal[];
  phrases: Literal[];
}
export interface Role {
  actor: string | null;
  target: string | null;
  sources: string[];
  rule: { target: 'T1' | 'T2' | 'T3' | null; sources: 'S1' | 'S2' | 'S3' | 'S4' };
  bucket: 'line' | 'loop' | 'shared' | 'statement' | 'example';
  selected: Literal | null;
}
export interface OracleFrame {
  frame: Frame;
  heads: Literal[];
  body: Literal[];
  nouns: Map<string, string>;
  properties: Map<string, string>;
  events: Event[];
  main: Event[];
  parents: Map<string, string[]>;
  cyclic: boolean;
  contexts: Map<string, { parent: string; operator: string }>;
}
const normalize = (
  f: Frame,
  name: string,
  args: string[],
  line: number,
  negated = false,
): Literal => ({
  name: name.replace(/^guideline_/u, ''),
  args: args.map((a) => atom(referent(f, a))),
  line,
  negated,
});
const bodyItems = (f: Frame, items: Item[], negated = false): Literal[] =>
  items.flatMap((i): Literal[] =>
    'naf' in i
      ? bodyItems(f, i.naf, true)
      : [normalize(f, i.literal.name, i.literal.args, -1, negated)],
  );
export const isAncestor = (o: OracleFrame, ancestor: string, child: string): boolean => {
  const seen = new Set<string>();
  let at = child;
  while (at !== 'actual' && !seen.has(at)) {
    seen.add(at);
    const p = o.contexts.get(at)?.parent;
    if (p === undefined) return false;
    if (p === ancestor) return true;
    at = p;
  }
  return false;
};
const eventList = (xs: Literal[]): Event[] =>
  xs
    .filter((h) => h.name === 'event')
    .map((h) => {
      const args = xs.filter(
        (a) => a.name === 'arg' && a.args[1] === h.args[1] && a.args[0] === h.args[0],
      );
      return {
        id: h.args[1] ?? '',
        context: h.args[0] ?? '',
        verb: h.args[2] ?? '',
        head: h,
        subject: args.find((a) => a.args[2] === '1')?.args[3] ?? null,
        args,
        phrases: xs.filter(
          (a) => a.name === 'pp' && a.args[1] === h.args[1] && a.args[0] === h.args[0],
        ),
      };
    });
export const oracleFrame = (frame: Frame): OracleFrame => {
  const heads = frame.heads.map((h) => normalize(frame, h.name, h.args, h.line));
  const body = bodyItems(frame, frame.body);
  const nouns = new Map(
    [...body, ...heads]
      .filter((h) => h.name === 'entity')
      .map((h) => [h.args[1] ?? '', h.args[2] ?? '']),
  );
  const properties = new Map(
    [...body, ...heads]
      .filter((h) => h.name === 'property')
      .map((h) => [h.args[1] ?? '', h.args[2] ?? '']),
  );
  const events = eventList(heads);
  const contexts = new Map(
    heads
      .filter((h) => h.name === 'operator')
      .map((h) => [h.args[1] ?? '', { parent: h.args[0] ?? '', operator: h.args[2] ?? '' }]),
  );
  const o: OracleFrame = {
    frame,
    heads,
    body,
    nouns,
    properties,
    events,
    main: [],
    parents: new Map(),
    cyclic: false,
    contexts,
  };
  for (const e of events) {
    const parents = events
      .filter((p) => {
        if (e === p || e.subject === p.subject) return false;
        const objects = [...p.args.filter((a) => a.args[2] !== '1'), ...p.phrases].map(
          (a) => a.args[3],
        );
        if (p.context === e.context) return objects.includes(e.subject ?? '');
        return (
          isAncestor(o, p.context, e.context) &&
          [...e.args, ...e.phrases].some((a) => objects.includes(a.args[3]))
        );
      })
      .map((p) => p.id);
    if (parents.length > 0) o.parents.set(e.id, parents);
  }
  const cycle = (id: string, path: Set<string>): boolean =>
    path.has(id) || (o.parents.get(id) ?? []).some((p) => cycle(p, new Set([...path, id])));
  o.cyclic = events.some((e) => cycle(e.id, new Set()));
  o.main = o.cyclic ? [] : events.filter((e) => !o.parents.has(e.id));
  return o;
};
export const bodyEvents = (o: OracleFrame): Event[] => eventList(o.body);
export const starts = (o: OracleFrame, t: typeof tables = tables): string[] => {
  const eligible = bodyEvents(o).filter((e) => e.context === 'actual' && !e.head.negated);
  const situations = eligible.filter((e) =>
    t.PATIENT_ROLES.has(o.nouns.get(e.subject ?? '') ?? ''),
  );
  const courses = eligible.filter((e) =>
    ['start', 'continue', 'prescribe', 'give', 'receive'].includes(e.verb),
  );
  return unique(
    [...situations, ...courses]
      .flatMap((e) =>
        e.args.filter((a) => a.args[2] === '2').map((a) => o.nouns.get(a.args[3] ?? '') ?? null),
      )
      .filter(concept),
  );
};
export const shared = (o: OracleFrame, e: Event): boolean => {
  for (const [ctx, box] of o.contexts) {
    if (!['-', 'may', 'can'].includes(box.operator)) continue;
    const inside = o.main.filter((m) => m.context === ctx || isAncestor(o, ctx, m.context));
    if (inside.length > 1 && inside.includes(e)) return true;
  }
  return false;
};
export const roles = (o: OracleFrame, e: Event, t: typeof tables = tables): Role => {
  const actor = o.nouns.get(e.subject ?? '') ?? null;
  const object = e.args.find((a) => a.args[2] === '2');
  let selected: Literal | null = null;
  let target: string | null = null;
  let targetRule: Role['rule']['target'] = null;
  if (object !== undefined && o.nouns.has(object.args[3] ?? '')) {
    target = o.nouns.get(object.args[3] ?? '') ?? null;
    selected = object;
    targetRule = 'T1';
  } else if (object !== undefined && o.properties.has(object.args[3] ?? '')) {
    selected = e.phrases.find((p) => p.args[2] === 'for' && o.nouns.has(p.args[3] ?? '')) ?? null;
    if (selected !== null) {
      target = o.nouns.get(selected.args[3] ?? '') ?? null;
      targetRule = 'T2';
    }
  } else if (object === undefined) {
    const complements = e.phrases.filter((p) => t.COMPLEMENTS.has(`${e.verb} ${p.args[2] ?? ''}`));
    selected =
      complements.find((p) => concept(o.nouns.get(p.args[3] ?? '') ?? null)) ??
      complements[0] ??
      null;
    if (selected !== null) {
      target = o.nouns.get(selected.args[3] ?? '') ?? null;
      targetRule = 'T3';
    }
  }
  if (target !== null && t.TIME_DATA.has(target)) {
    target = null;
    targetRule = null;
    selected = null;
  }
  let sources: string[];
  let sourceRule: Role['rule']['sources'];
  if (concept(actor)) {
    sources = [actor];
    sourceRule = 'S1';
  } else {
    sources = starts(o, t).filter((s) => s !== target);
    sourceRule = sources.length > 0 ? 'S2' : 'S4';
    if (sources.length === 0) {
      sources = unique(
        e.phrases
          .filter((p) => p.args[2] === 'for')
          .map((p) => o.nouns.get(p.args[3] ?? '') ?? null)
          .filter((n): n is string => n !== null && t.SITUATIONS.has(n)),
      );
      if (sources.length > 0) sourceRule = 'S3';
    }
  }
  const objects = e.args
    .filter((a) => a.args[2] === '2')
    .map((a) => o.nouns.get(a.args[3] ?? '') ?? '');
  const example =
    actor?.endsWith('-example') === true &&
    objects.length > 0 &&
    objects.every((n) => n.endsWith('-example'));
  const ends = unique([...sources, target].filter(concept));
  const bucket = example
    ? 'example'
    : shared(o, e)
      ? 'shared'
      : sources.length > 0 && concept(target) && sources.every((s) => s !== target)
        ? 'line'
        : ends.length > 0
          ? 'loop'
          : 'statement';
  return {
    actor,
    target,
    sources,
    rule: { target: targetRule, sources: sourceRule },
    bucket,
    selected,
  };
};
export const key = (o: OracleFrame, e: Event): string => `${frameKey(o.frame)}@${e.id}`;
export const chain = (o: OracleFrame, e: Event): string[] => {
  const original = o.frame.heads.find((h) => h.line === e.head.line);
  if (original === undefined) throw new Error('oracle event missing');
  return chainOf(o.frame, original.args[0] ?? '');
};
export const reading = (
  o: OracleFrame,
  e: Event,
  text: string,
  t: typeof tables = tables,
): string => {
  const modal = chain(o, e).map((op, i) =>
    op === '-' ? (i === 0 ? 'it is false that' : 'not') : op,
  );
  const qualifiers = unique(
    o.heads
      .filter((h) => h.name === 'qualifier' && h.args[1] === e.id)
      .map((h) => atom(h.args[3] ?? '')),
  );
  let verb = e.verb;
  if (!modal.some((m) => ['should', 'may', 'can', 'must'].includes(m))) {
    const candidates =
      e.verb === 'be'
        ? ['is', 'are', 'was', 'were']
        : e.verb === 'have'
          ? ['has', 'have', 'had']
          : [
              e.verb.endsWith('y') ? `${e.verb.slice(0, -1)}ies` : '',
              `${e.verb}es`,
              `${e.verb}s`,
              e.verb,
            ];
    const found = candidates.filter(Boolean).find((v) => new RegExp(`\\b${v}\\b`, 'u').test(text));
    if (found === undefined)
      throw new Error(`${sentenceKey(o.frame)}: no finite form of ${e.verb}`);
    verb = found;
  }
  const r = roles(o, e, t);
  const propertyArg = e.args.find((a) => a.args[2] === '2');
  const property =
    r.rule.target === 'T2' ? atom(o.properties.get(propertyArg?.args[3] ?? '') ?? '') : '';
  const prep = r.rule.target === 'T2' || r.rule.target === 'T3' ? (r.selected?.args[2] ?? '') : '';
  return [...modal, ...qualifiers, verb, property, prep].filter(Boolean).join(' ');
};
export const embeddedUnder = (o: OracleFrame, e: Event): Event[] => {
  const descends = (id: string, root: string): boolean =>
    (o.parents.get(id) ?? []).some((p) => p === root || descends(p, root));
  return o.events.filter((x) => x.id !== e.id && descends(x.id, e.id));
};
export const owned = (o: OracleFrame, e: Event): Literal[] => {
  const refs = new Set([e.id, ...embeddedUnder(o, e).map((x) => x.id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const h of o.heads) {
      if (!refs.has(h.args[1] ?? '') || h.name === 'operator') continue;
      for (const arg of h.args.slice(2))
        if (o.nouns.has(arg) || o.properties.has(arg)) {
          if (!refs.has(arg)) {
            refs.add(arg);
            changed = true;
          }
        }
    }
  }
  return o.heads.filter((h) => h.name !== 'operator' && refs.has(h.args[1] ?? ''));
};
export const consumed = (o: OracleFrame, e: Event, t: typeof tables = tables): Set<number> => {
  const r = roles(o, e, t);
  const refs = new Set(
    [e.subject, r.selected?.args[3]].filter((x): x is string => x !== undefined && x !== null),
  );
  if (r.rule.target === 'T2') refs.add(e.args.find((a) => a.args[2] === '2')?.args[3] ?? '');
  return new Set(
    o.heads
      .filter(
        (h) =>
          h.line === e.head.line ||
          h.line === r.selected?.line ||
          (h.name === 'arg' &&
            h.args[1] === e.id &&
            (h.args[2] === '1' || (r.rule.target === 'T2' && h.args[2] === '2'))) ||
          (h.name === 'qualifier' && h.args[1] === e.id) ||
          (refs.has(h.args[1] ?? '') &&
            (h.name === 'entity' ||
              h.name === 'property' ||
              (h.name === 'cardinality' &&
                h.args[2] === 'na' &&
                h.args[3] === 'eq' &&
                h.args[4] === '1'))),
      )
      .map((h) => h.line),
  );
};
