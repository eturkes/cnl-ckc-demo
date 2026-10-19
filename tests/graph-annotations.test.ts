// `.agent/contracts/sync-u2.md` A1–A4: the time, strength and unit annotations and the comparison
// conditions project faithfully. A1 re-derives every annotation edge from the clauses through a
// second mapping that shares no emit code; A2 reads them from both ends under their scope; A3
// finds no raw reference node a property or a converted unit types; A4 holds each threshold to its
// bound and to the world of the cardinality it constrains.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  graphRelationLabel,
  parseSemanticGraph,
  SemanticGraphModel,
  type SemanticGraphEdge,
} from '../src/graph/model.js';
import { edgeLabelFrom, edgeViewsOf } from '../src/graph/view.js';
import { verifyBag } from '../tools/kb/bag.mjs';
import { deriveSemanticGraph } from '../tools/kb/graph.mjs';
import { parseClauseSites } from '../tools/kb/provenance.mjs';

import { ROOT } from './clinical-test-support.js';

interface Call {
  name: string;
  args: string[];
}
interface Site {
  line: number;
  document: string;
  sentence: number | null;
  predicate: string;
  kind: string;
  head: Call;
  body: Call[];
}
interface RawEdge {
  id: string;
  kind: string;
  source: string;
  target: string;
  label: string;
  document: string;
  sentence: number | null;
  scope?: number;
}
interface RawGraph {
  nodes: { id: string; kind: string; label: string }[];
  edges: RawEdge[];
}

const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('vendored bag is missing');
const files = verifyBag(readFileSync(join(ROOT, 'kb', archive))).files;
const sites = parseClauseSites(files) as Site[];
// Derived in process, so the grade binds the producer code itself (`pnpm mutate` rebuilds no
// asset); `kb:asset-check` holds the shipped asset equal to this derivation.
const shipped = deriveSemanticGraph(files).model as unknown as RawGraph;
const clone = (): RawGraph & { stats: { edges: number; byEdgeKind: Record<string, number> } } =>
  structuredClone(shipped) as RawGraph & {
    stats: { edges: number; byEdgeKind: Record<string, number> };
  };

const ANNOTATION_KINDS = new Set(['grade', 'preference', 'qualifier', 'time', 'threshold']);
const WORDS: Readonly<Record<string, string>> = {
  eq: '',
  exactly: 'exactly ',
  geq: 'at least ',
  greater: 'more than ',
  leq: 'at most ',
  less: 'less than ',
  about: 'about ',
};

const text = (term: string | undefined): string => (term ?? '').trim();
const isVariable = (term: string | undefined): boolean => /^[A-Z_]/u.test(text(term));
const atom = (term: string | undefined): string => {
  const value = text(term);
  return value.startsWith("'") && value.endsWith("'")
    ? value.slice(1, -1).replaceAll("''", "'")
    : value;
};
const bound = (comparison: string | undefined, count: string | undefined): string =>
  `${WORDS[atom(comparison)] ?? `<${text(comparison)}>`}${text(count)}`;

interface Facts {
  labels: Map<string, string>;
  cards: Map<string, { comparison: string; count: string; context: string }>;
  ranges: Map<string, string>;
  units: Map<string, string>;
  operators: Map<string, { outer: string; operator: string }>;
}
const emptyFacts = (): Facts => ({
  labels: new Map(),
  cards: new Map(),
  ranges: new Map(),
  units: new Map(),
  operators: new Map(),
});

/** One scope's facts, read from its calls alone: declared nouns and verbs first, then the rest. */
const factsOf = (calls: readonly Call[], facts: Facts = emptyFacts()): Facts => {
  for (const call of calls) {
    const [context, subject, second, third, fourth] = call.args;
    if (call.name === 'guideline_entity' || call.name === 'guideline_event') {
      facts.labels.set(text(subject), atom(second));
    }
    if (call.name === 'guideline_cardinality') {
      facts.cards.set(text(subject), {
        comparison: text(third),
        count: text(fourth),
        context: text(context),
      });
    }
    if (call.name === 'guideline_range') facts.ranges.set(text(subject), text(second));
    if (call.name === 'guideline_unit') facts.units.set(text(subject), text(second));
    if (call.name === 'guideline_operator') {
      facts.operators.set(text(subject), { outer: text(context), operator: atom(second) });
    }
  }
  return facts;
};

/** Per document: every head's facts, the scope a skolem names reading across sentences. */
const documentFacts = new Map<string, Facts>();
for (const site of sites) {
  let facts = documentFacts.get(site.document);
  if (facts === undefined) {
    facts = emptyFacts();
    documentFacts.set(site.document, facts);
  }
  factsOf([site.head], facts);
}

/** `B(Q)` read independently: comparison words + count, a range's upper count, the unit. */
const reading = (scopes: readonly Facts[], reference: string, unit: string): string | null => {
  const card = scopes.map((facts) => facts.cards.get(reference)).find(Boolean);
  if (card === undefined) return `<no cardinality ${reference}>`;
  if (isVariable(card.comparison) || isVariable(card.count)) return null;
  const high = scopes.map((facts) => facts.ranges.get(reference)).find(Boolean);
  const upper = high === undefined ? undefined : scopes.map((f) => f.cards.get(high)).find(Boolean);
  const value = `${bound(card.comparison, card.count)}${upper === undefined ? '' : ` to ${upper.count}`}`;
  return isVariable(unit) ? value : `${value} ${atom(unit)}`;
};

/** A reference's node label in one clause: unit-typed quantity, declared noun/verb, property. */
const labelOf = (site: Site, scopes: readonly Facts[], reference: string | undefined): string => {
  const ref = text(reference);
  if (ref === 'actual') return site.document;
  const local = scopes[0];
  const unit = scopes.map((facts) => facts.units.get(ref)).find((value) => value !== undefined);
  if (unit !== undefined) return reading(scopes, ref, unit) ?? 'time quantity';
  const declared = scopes.map((facts) => facts.labels.get(ref)).find(Boolean);
  if (declared !== undefined) return declared;
  const property = [site.head, ...site.body].find(
    (call) => call.name === 'guideline_property' && text(call.args[1]) === ref,
  );
  if (property !== undefined) return `${atom(property.args[2])}: ${atom(property.args[3])}`;
  const headProperty = sites.find(
    (other) =>
      other.document === site.document &&
      other.predicate === 'guideline_property' &&
      text(other.head.args[1]) === ref,
  );
  if (headProperty !== undefined) {
    return `${atom(headProperty.head.args[2])}: ${atom(headProperty.head.args[3])}`;
  }
  return local === undefined ? `<${ref}>` : `<unresolved ${ref}>`;
};

/** Operators outermost first, from `actual` down to `context`. */
const chainOf = (scopes: readonly Facts[], context: string | undefined): string[] => {
  const chain: string[] = [];
  const seen = new Set<string>();
  for (let world = text(context); world !== 'actual' && !seen.has(world);) {
    seen.add(world);
    const operator = scopes.map((facts) => facts.operators.get(world)).find(Boolean);
    if (operator === undefined) return [`<no operator for ${world}>`, ...chain];
    chain.unshift(operator.operator);
    world = operator.outer;
  }
  return chain;
};

const OFFSET: Readonly<Record<string, string>> = {
  duration: 'duration',
  after: 'after offset',
  before: 'before offset',
  within: 'distance',
};

/** The tuple one annotation call projects, or `undefined` for a unit or a range (a fold). */
const expectedTuple = (site: Site, call: Call, scopes: readonly Facts[]): string | undefined => {
  const [context, subject, second, third, fourth, fifth, sixth] = call.args;
  const at = `${site.document}|${String(site.sentence)}`;
  const tuple = (kind: string, source: string, relation: string, target: string, ctx = context) =>
    [at, kind, source, relation, target, chainOf(scopes, ctx).join(',')].join('|');
  const label = (reference: string | undefined) => labelOf(site, scopes, reference);
  switch (call.name) {
    case 'guideline_grade':
      return tuple('grade', label(subject), 'grade', `${atom(second)}: ${atom(third)}`);
    case 'guideline_preference':
      return text(third) === 'none'
        ? tuple('preference', label(second), 'preference', 'preferred')
        : tuple('preference', label(second), 'preferred over', label(third));
    case 'guideline_qualifier':
      return tuple('qualifier', label(subject), atom(second), atom(third));
    case 'guideline_interval': {
      if (text(fifth) === 'none') {
        return tuple('preposition', label(subject), OFFSET[atom(second)] ?? '<role>', label(third));
      }
      const b = String(reading(scopes, text(third), text(fourth)));
      const role = atom(second);
      const relation = role === 'within' ? `${b} apart from` : `${b} ${role}`;
      return tuple('time', label(subject), relation, label(fifth));
    }
    case 'guideline_order':
      return tuple('preposition', label(subject), `occurs ${atom(second)}`, label(third));
    case 'guideline_recurrence':
      return tuple('time', label(subject), 'recurrence gap', label(second));
    case 'guideline_frequency': {
      const counted = scopes.map((facts) => facts.cards.get(text(second))).find(Boolean);
      const per = `count ${bound(counted?.comparison, counted?.count)} per ${String(reading(scopes, text(third), text(fourth)))}`;
      return tuple('time', label(subject), per, label(second));
    }
    case 'guideline_recurrence_window': {
      const gap = String(reading(scopes, text(second), text(third)));
      const length = String(reading(scopes, text(fifth), text(sixth)));
      return tuple(
        'time',
        label(subject),
        `recurrence gap ${gap}; window ${length} from`,
        label(fourth),
      );
    }
    case 'guideline_satisfies': {
      const local = scopes[0];
      const card = [...(local?.cards.entries() ?? [])].find(
        ([, value]) =>
          value.comparison === text(call.args[0]) && value.count === text(call.args[1]),
      );
      if (card === undefined) return `${at}|threshold|<no cardinality>`;
      const limit =
        call.args.length === 6
          ? `${bound(call.args[3], call.args[4])} ${atom(call.args[5])}`
          : bound(call.args[2], call.args[3]);
      return tuple('threshold', label(card[0]), 'condition bound', limit, card[1].context);
    }
    default:
      return undefined;
  }
};

/** Every tuple the clauses call for, each beside the first line that calls for it. */
const expectedTuples = (): Map<string, number> => {
  const out = new Map<string, number>();
  const add = (tuple: string | undefined, line: number) => {
    if (tuple !== undefined && !out.has(tuple)) out.set(tuple, line);
  };
  for (const site of sites) {
    // A rule head may name an antecedent variable, so heads read the body's facts too.
    const scopes = [factsOf(site.body), documentFacts.get(site.document) ?? emptyFacts()];
    add(expectedTuple(site, site.head, scopes), site.line);
    if (site.kind !== 'rule') continue;
    for (const call of site.body) add(expectedTuple(site, call, scopes), site.line);
  }
  return out;
};

const modelOf = (graph: unknown): SemanticGraphModel =>
  new SemanticGraphModel(parseSemanticGraph(graph));

/** The tuples the asset shows: annotation edges and the pp edges an annotation types. */
const shownTuples = (model: SemanticGraphModel): Set<string> =>
  new Set(
    model.data.edges
      .filter(
        (edge) =>
          ANNOTATION_KINDS.has(edge.kind) ||
          (edge.kind === 'preposition' && edge.inverse !== undefined),
      )
      .map((edge) =>
        [
          `${edge.document}|${String(edge.sentence)}`,
          edge.kind,
          model.node(edge.source)?.label ?? `<${edge.source}>`,
          edge.relation ?? edge.label,
          model.node(edge.target)?.label ?? `<${edge.target}>`,
          (edge.scopeOperators ?? []).join(','),
        ].join('|'),
      ),
  );

/** A1 grader: each side's tuples the other lacks, named by line or by tuple. */
const gradeProjection = (model: SemanticGraphModel): string[] => {
  const expected = expectedTuples();
  const shown = shownTuples(model);
  return [
    ...[...expected]
      .filter(([tuple]) => !shown.has(tuple))
      .map(([tuple, line]) => `line ${String(line)} not shown: ${tuple}`),
    ...[...shown]
      .filter((tuple) => !expected.has(tuple))
      .map((tuple) => `shown, no clause: ${tuple}`),
  ];
};

const shippedModel = modelOf(shipped);

const findEdge = (
  model: SemanticGraphModel,
  match: (edge: SemanticGraphEdge, target: string) => boolean,
): SemanticGraphEdge | undefined =>
  model.data.edges.find((edge) => match(edge, model.node(edge.target)?.label ?? ''));

/**
 * A2 grader: the readings each fixture must give from its source end and its target end. The
 * scope is the source end's (reader-relative ruling, `.claude/rules/graph.md`): from the target it
 * follows `→`, the end away from the reader.
 */
const gradeReadings = (model: SemanticGraphModel): string[] => {
  const fixtures: {
    name: string;
    match: (edge: SemanticGraphEdge, target: string) => boolean;
    fromSource: string;
    fromTarget: string;
    dashed: boolean;
  }[] = [
    {
      name: 'rec05 S7 abruptly',
      match: (edge, target) =>
        edge.kind === 'qualifier' &&
        edge.document === 'cdc2022-opioid-rec05' &&
        edge.sentence === 7 &&
        target === 'abruptly',
      fromSource: 'manner · should · negated',
      fromTarget: 'manner of → should · negated',
      dashed: true,
    },
    {
      name: 'rec07 S2 after',
      match: (edge, target) =>
        edge.kind === 'time' &&
        edge.document === 'cdc2022-opioid-rec07' &&
        edge.sentence === 2 &&
        target === 'therapy-start' &&
        (edge.relation ?? '').endsWith('after'),
      fromSource: 'at least 1 week after · should',
      fromTarget: 'at least 1 week before → should',
      dashed: false,
    },
    {
      name: 'rec07 S2 within',
      match: (edge, target) =>
        edge.kind === 'time' &&
        edge.document === 'cdc2022-opioid-rec07' &&
        edge.sentence === 2 &&
        target === 'therapy-start' &&
        (edge.relation ?? '').endsWith('apart from'),
      fromSource: 'at most 4 week apart from · should',
      fromTarget: 'at most 4 week apart from → should',
      dashed: false,
    },
    {
      name: 'rec01 strength grade',
      match: (edge, target) =>
        edge.kind === 'grade' &&
        edge.document === 'cdc2022-opioid-rec01' &&
        target === 'strength: conditional',
      fromSource: 'grade',
      fromTarget: 'grade of',
      dashed: false,
    },
  ];
  return fixtures.flatMap(({ name, match, fromSource, fromTarget, dashed }) => {
    const edge = findEdge(model, match);
    if (edge === undefined) return [`${name}: no such edge`];
    const [view] = edgeViewsOf(
      { nodes: model.data.nodes, edges: [edge], truncatedNodes: false, truncatedEdges: false },
      null,
    );
    if (view === undefined) return [`${name}: no edge view`];
    const readings = {
      source: edgeLabelFrom(view, edge.source),
      target: edgeLabelFrom(view, edge.target),
      list: graphRelationLabel(edge, edge.target),
      dashed: view.dashed,
    };
    const want = { source: fromSource, target: fromTarget, list: fromTarget, dashed };
    return JSON.stringify(readings) === JSON.stringify(want)
      ? []
      : [
          `${name} (${edge.id}): read ${JSON.stringify(readings)}, expected ${JSON.stringify(want)}`,
        ];
  });
};

/** A3 grader: raw reference nodes whose referent a property or a converted unit types. */
const typedReferents = new Set(
  sites.flatMap((site) =>
    [site.head, ...site.body].flatMap((call) =>
      call.name === 'guideline_property' ||
      (call.name === 'guideline_unit' && isVariable(call.args[2]))
        ? [`${site.document}:${String(site.sentence ?? 0)}:${text(call.args[1])}`]
        : [],
    ),
  ),
);
/** The producer's reference-node id for a `document:sentence:reference` key. */
const referenceId = (key: string): string =>
  `value:reference:${encodeURIComponent(key).replace(/%/gu, '.')}`;
const typedIds = new Set([...typedReferents].map(referenceId));
const gradeReferences = (graph: RawGraph): string[] =>
  graph.nodes.filter(({ id }) => typedIds.has(id)).map(({ id }) => id);

/** A4 grader: every negated comparison's threshold reads negated, named by its first goal line. */
/** Each negated comparison tuple beside the first goal line that states it. */
const negatedComparisons: { line: number; tuple: string }[] = [];
for (const site of sites) {
  const facts = [factsOf(site.body), documentFacts.get(site.document) ?? emptyFacts()];
  for (const call of site.body) {
    if (call.name !== 'guideline_satisfies') continue;
    const tuple = expectedTuple(site, call, facts);
    if (tuple === undefined || tuple.split('|').at(-1)?.includes('-') !== true) continue;
    if (!negatedComparisons.some((entry) => entry.tuple === tuple)) {
      negatedComparisons.push({ line: site.line, tuple });
    }
  }
}
const gradeThresholds = (model: SemanticGraphModel): string[] => {
  const shown = shownTuples(model);
  return negatedComparisons
    .filter(({ tuple }) => !shown.has(tuple))
    .map(({ line, tuple }) => `line ${String(line)}: threshold lost its negation: ${tuple}`);
};

describe('graph annotations', () => {
  it('A1 every annotation clause and goal projects exactly its row', () => {
    expect(gradeProjection(shippedModel)).toEqual([]);
    expect(expectedTuples().size).toBeGreaterThan(400);
    const dropped = clone();
    const victim = dropped.edges.findIndex(({ kind }) => kind === 'grade');
    const [removed] = dropped.edges.splice(victim, 1);
    dropped.stats.edges -= 1;
    dropped.stats.byEdgeKind.grade = (dropped.stats.byEdgeKind.grade ?? 1) - 1;
    expect(
      gradeProjection(modelOf(dropped)).some((line) =>
        line.includes(`not shown: ${String(removed?.document)}|1|grade|`),
      ),
    ).toBe(true);
  });

  it('A2 reads each fixture from both ends under its scope, dashed where negated', () => {
    expect(gradeReadings(shippedModel)).toEqual([]);
    const rescoped = clone();
    const target = findEdge(
      shippedModel,
      (edge, label) =>
        edge.kind === 'qualifier' &&
        edge.document === 'cdc2022-opioid-rec05' &&
        edge.sentence === 7 &&
        label === 'abruptly',
    );
    const raw = rescoped.edges.find(({ id }) => id === target?.id);
    if (raw === undefined) throw new Error('no abruptly qualifier to re-scope');
    delete raw.scope;
    expect(gradeReadings(modelOf(rescoped))).toEqual([
      expect.stringMatching(/^rec05 S7 abruptly \(edge:\d+:\d+\): read .*"manner"/u),
    ]);
  });

  it('A3 leaves no raw reference node a property or a converted unit types', () => {
    expect(typedReferents.size).toBeGreaterThan(100);
    expect(gradeReferences(shipped)).toEqual([]);
    const [planted] = [...typedReferents];
    if (planted === undefined) throw new Error('no typed referent to plant');
    const id = referenceId(planted);
    const withRaw = clone();
    withRaw.nodes.push({ id, kind: 'value', label: planted });
    expect(gradeReferences(withRaw)).toEqual([id]);
  });

  it('A4 holds every threshold to the world of the cardinality it constrains', () => {
    expect(negatedComparisons.length).toBeGreaterThan(0);
    expect(gradeThresholds(shippedModel)).toEqual([]);
    const flattened = clone();
    const [first] = negatedComparisons;
    const shownThreshold = shippedModel.data.edges.find(
      (edge) =>
        edge.kind === 'threshold' &&
        (edge.scopeOperators ?? []).includes('-') &&
        `${edge.document}|${String(edge.sentence)}` ===
          first?.tuple.split('|').slice(0, 2).join('|'),
    );
    const raw = flattened.edges.find(({ id }) => id === shownThreshold?.id);
    if (raw === undefined || first === undefined)
      throw new Error('no negated threshold to flatten');
    delete raw.scope;
    expect(gradeThresholds(modelOf(flattened))).toEqual([
      expect.stringMatching(
        new RegExp(`^line ${String(first.line)}: threshold lost its negation`, 'u'),
      ),
    ]);
  });

  it('refuses a range that pairs with no interval, by name', () => {
    const [path, bytes] = [...files].find(([name]) =>
      name.endsWith('/pl/cdc2022-opioid-s47-16.pl'),
    ) ?? [undefined, undefined];
    if (path === undefined || bytes === undefined) throw new Error('no ranged document to plant');
    const lines = Buffer.from(bytes).toString('utf8').split('\n');
    const range = lines.find((line) => line.startsWith('guideline_range('));
    const low =
      /^guideline_range\('\$guideline_id'\(context,[^)]*\),\[[^\]]*\]\),(.*?\[[^\]]*\]\)),/u.exec(
        range ?? '',
      )?.[1];
    if (low === undefined) throw new Error('no range low to unpair');
    const planted = new Map(files);
    planted.set(
      path,
      Buffer.from(
        lines
          .filter((line) => !(line.startsWith('guideline_interval(') && line.includes(`,${low},`)))
          .join('\n'),
      ),
    );
    expect(() => deriveSemanticGraph(planted)).toThrow(/pairs with no interval/u);
  });

  it('refuses a constant unit its quantity noun does not restate, by name', () => {
    const [path, bytes] = [...files].find(
      ([name, content]) =>
        name.endsWith('/pl/cdc2022-opioid-rec01-imp03.pl') &&
        Buffer.from(content).toString('utf8').includes(',hour).'),
    ) ?? [undefined, undefined];
    if (path === undefined || bytes === undefined) throw new Error('no unit head to plant');
    const planted = new Map(files);
    planted.set(
      path,
      Buffer.from(Buffer.from(bytes).toString('utf8').replace(',hour).', ',day).')),
    );
    expect(() => deriveSemanticGraph(planted)).toThrow(/guideline_unit types hour as day/u);
  });
});
