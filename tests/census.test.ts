// The stable censuses `.claude/rules/` states, re-derived from the build and compared with the
// number written in the rules text. Prose does not run, so every one of these drifted silently
// before; here a figure that no longer matches names its rules file and line.
//
// Derivations come from the verified bag, the live saved image, the twelve live clinical proofs,
// the generated intake vocabulary and the graph model the app itself projects — never from the
// rules text being graded.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PROOF_BUDGET_MAX, type ProofStep } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { decodeOnce, type PlTerm } from '../src/engine/terms.js';
import { parseSemanticGraph, SemanticGraphModel } from '../src/graph/model.js';
import { verifyBag } from '../tools/kb/bag.mjs';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { ROOT } from '../tools/kb/paths.mjs';

const require = createRequire(import.meta.url);
const GENERATED = join(ROOT, 'kb', 'generated');
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
  source: { bag: string };
  assets: unknown[];
};

interface Figure {
  label: string;
  /** One capture group: the number as the rules text writes it, thousands commas allowed. */
  pattern: RegExp;
  derived: () => number;
}
interface Row {
  file: string;
  /** A substring that occurs in exactly one line of `file`: the claim unit's first line. */
  anchor: string;
  figures: Figure[];
}

/** The anchored line plus its continuation lines, up to a blank line, bullet or heading. */
const unitOf = (text: string, anchor: string): { line: number; text: string } | string => {
  const lines = text.split('\n');
  const hits = lines.flatMap((line, index) => (line.includes(anchor) ? [index] : []));
  if (hits.length !== 1)
    return `anchor ${JSON.stringify(anchor)} occurs ${String(hits.length)} times`;
  const [start = 0] = hits;
  const unit = [lines[start] ?? ''];
  for (const next of lines.slice(start + 1)) {
    if (next.trim() === '' || /^\s*(?:[-*] |#)/u.test(next)) break;
    unit.push(next);
  }
  return { line: start + 1, text: unit.join(' ') };
};

/** Every figure that disagrees with its derivation, named by rules file and line. */
const grade = (rows: readonly Row[], read: (file: string) => string): string[] => {
  if (rows.length === 0) return ['CENSUS table is empty, so no stated figure is graded'];
  return rows.flatMap(({ file, anchor, figures }) => {
    const unit = unitOf(read(file), anchor);
    if (typeof unit === 'string') return [`${file}: ${unit}`];
    return figures.flatMap(({ label, pattern, derived }) => {
      const stated = pattern.exec(unit.text)?.[1];
      if (stated === undefined) return [`${file}:${String(unit.line)} no longer states ${label}`];
      const value = Number(stated.replaceAll(',', ''));
      const actual = derived();
      return value === actual
        ? []
        : [
            `${file}:${String(unit.line)} states ${label} = ${String(value)}, derived ${String(actual)}`,
          ];
    });
  });
};

const derived = new Map<string, number>();
const of =
  (key: string): (() => number) =>
  () => {
    const value = derived.get(key);
    if (value === undefined) throw new Error(`no derivation for ${key}`);
    return value;
  };

const PREDICATES = {
  version: 'guideline_schema_version(_)',
  document: 'guideline_document(_,_,_)',
  entity: 'guideline_entity(_,_,_,_)',
  cardinality: 'guideline_cardinality(_,_,_,_,_)',
  event: 'guideline_event(_,_,_)',
  arg: 'guideline_arg(_,_,_,_)',
  pp: 'guideline_pp(_,_,_,_)',
  property: 'guideline_property(_,_,_,_)',
  operator: 'guideline_operator(_,_,_)',
} as const;

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as {
    default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
  };
  return factory.default(image)({});
};

beforeAll(async () => {
  // Bag: members, payload and tag entries, and the documents the payload compiles.
  const { files, payload, tags } = verifyBag(readFileSync(join(ROOT, 'kb', manifest.source.bag)));
  derived.set('bag.members', files.size);
  derived.set('bag.payload', payload.length);
  derived.set('bag.tags', tags.length);
  // The compiled guideline documents: the bag's `queries/pl/` goals are payload too, not documents.
  derived.set(
    'bag.documents',
    payload.filter((path) => /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u.test(path)).length,
  );
  derived.set('generated.files', manifest.assets.length + 1);

  // Live image: clause sites, rule bodies, derivable solutions, vocabulary, clinical records.
  const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
  const engine = await loadImage(image);
  const count = (goal: string): number => {
    const result = decodeOnce(engine.prolog.query(goal).once());
    const n = result.kind === 'bindings' ? result.bindings.N : undefined;
    if (n?.kind !== 'integer') throw new Error(`no count from ${goal}`);
    return Number(n.value);
  };
  let clauses = 0;
  for (const [name, head] of Object.entries(PREDICATES)) {
    const total = count(`predicate_property(${head},number_of_clauses(N)).`);
    clauses += total;
    derived.set(`clauses.${name}`, total);
    derived.set(`rules.${name}`, count(`findall(x,(clause(${head},B),B\\==true),L),length(L,N).`));
  }
  derived.set('clauses.total', clauses);
  derived.set('solutions.entity', count('findall(x,guideline_entity(_,_,_,_),L),length(L,N).'));
  derived.set('solutions.event', count('findall(x,guideline_event(_,_,_),L),length(L,N).'));
  derived.set(
    'vocabulary.nouns',
    count('findall(T,clause(guideline_entity(_,_,T,_),_),L),sort(L,S),length(S,N).'),
  );
  derived.set(
    'vocabulary.verbs',
    count('findall(V,clause(guideline_event(_,_,V),_),L),sort(L,S),length(S,N).'),
  );
  derived.set('clinical.rules', count('findall(x,clinical_rule(_,_,_),L),length(L,N).'));
  derived.set('clinical.premises', count('findall(x,clinical_premise(_,_,_,_),L),length(L,N).'));
  // Read off the stored gate heads: calling a gate demands the premises it cites.
  const gates = decodeOnce(
    engine.prolog.query('findall(g(D,S,Ls),clause(clinical_gate(D,S,_,Ls),_),G).').once(),
  );
  const heads = gates.kind === 'bindings' ? gates.bindings.G : undefined;
  if (heads?.kind !== 'list') throw new Error('no gate heads');
  const sites: number[] = [];
  const documents = new Set<string>();
  for (const head of heads.items) {
    if (head.kind !== 'compound') throw new Error('malformed gate head');
    const [doc, , lines] = head.args as [PlTerm, PlTerm, PlTerm];
    if (doc.kind === 'atom') documents.add(doc.value);
    if (lines.kind !== 'list') throw new Error('gate lines are not a list');
    for (const line of lines.items) if (line.kind === 'integer') sites.push(Number(line.value));
  }
  derived.set('clinical.gates', heads.items.length);
  derived.set('clinical.documents', documents.size);
  derived.set('clinical.sites', sites.length);
  derived.set('clinical.uniqueLines', new Set(sites).size);

  // Twelve live proofs, one per prepared source contribution, through the production RPC.
  const session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
  const flatten = (steps: readonly ProofStep[]): ProofStep[] =>
    steps.flatMap((step) => (step.kind === 'clause' ? [step, ...flatten(step.children)] : [step]));
  const steps: ProofStep[] = [];
  for (const { id, sources } of CLINICAL_QUESTIONS) {
    for (const { document } of sources) {
      const constrainedGoal = `clinical_advice('${id}',_,clinical_answer('${document}',_,_))`;
      const proof = await session.prove({ constrainedGoal }, PROOF_BUDGET_MAX);
      if (proof.kind !== 'proof') throw new Error(`${id}/${document}: ${proof.kind}`);
      steps.push(...flatten(proof.steps));
    }
  }
  derived.set('proof.clauses', steps.filter((step) => step.kind === 'clause').length);
  derived.set('proof.assumptions', steps.filter((step) => step.kind === 'assumption').length);
  derived.set('proof.negations', steps.filter((step) => step.kind === 'negation').length);

  // Intake vocabulary: the selection model's rules, conditions and section-triggered rules.
  const intake = JSON.parse(readFileSync(join(GENERATED, 'intake-vocabulary.json'), 'utf8')) as {
    rules: { document: string; trigger: { kind: string } }[];
    conditions: unknown[];
  };
  derived.set('intake.rules', intake.rules.length);
  derived.set('intake.conditions', intake.conditions.length);
  derived.set(
    'intake.unconditional',
    intake.rules.filter((rule) => rule.trigger.kind === 'section').length,
  );
  derived.set('intake.documents', new Set(intake.rules.map((rule) => rule.document)).size);

  // Graph: the generated asset as data, and the projection the app's own model computes.
  const model = new SemanticGraphModel(
    parseSemanticGraph(
      JSON.parse(readFileSync(join(GENERATED, 'graph', 'semantic-graph.json'), 'utf8')),
    ),
  );
  const { nodes, edges } = model.data;
  // The model composes scope into the shown label; the producer's own relation is `relation`.
  const shortcut = (edge: (typeof edges)[number]): boolean =>
    (edge.relation ?? edge.label) === 'condition supports';
  derived.set('graph.nodes', nodes.length);
  derived.set('graph.edges', edges.length);
  derived.set('graph.selfEdges', edges.filter((edge) => edge.source === edge.target).length);
  derived.set('graph.implies', edges.filter((edge) => edge.kind === 'implies').length);
  // The explicit schemas: every clause predicate a non-`implies` edge records.
  derived.set(
    'graph.schemas',
    new Set(
      edges
        .filter((edge) => edge.kind !== 'implies' && edge.predicate.startsWith('guideline_'))
        .map((edge) => edge.predicate),
    ).size,
  );
  derived.set('graph.shortcuts', edges.filter((edge) => shortcut(edge)).length);
  derived.set(
    'graph.ruleContext',
    edges.filter((edge) => edge.kind === 'implies' && !shortcut(edge)).length,
  );
  // Modal census: one scope record per operator context, and the contexts no edge touches.
  const scopes = (
    JSON.parse(readFileSync(join(GENERATED, 'graph', 'semantic-graph.json'), 'utf8')) as {
      scopes: { operator: string }[];
    }
  ).scopes;
  for (const operator of ['-', 'should', 'may', 'can', 'must']) {
    derived.set(`modal.${operator}`, scopes.filter((scope) => scope.operator === operator).length);
  }
  const touched = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const contexts = nodes.filter((node) => node.kind === 'operator-context');
  derived.set('modal.contexts', contexts.length);
  derived.set('modal.orphaned', contexts.filter((node) => !touched.has(node.id)).length);
  const projected = nodes.filter((node) => model.conceptIncident(node.id).length > 0);
  derived.set('projection.nodes', projected.length);
  for (const kind of ['entity', 'event', 'value'] as const) {
    derived.set(`projection.${kind}`, projected.filter((node) => node.kind === kind).length);
  }
  derived.set('projection.concepts', model.conceptNodeCount);
  derived.set('projection.groups', model.conceptEdgeCount);
  const representatives = new Map(
    projected.flatMap((node) =>
      model.conceptIncident(node.id).map((edge) => [edge.id, edge] as const),
    ),
  );
  const groups = [...representatives.values()];
  derived.set(
    'projection.scoped',
    // A group carries an ordered scope when either end of its representative does.
    groups.filter(
      (edge) => (edge.scopeOperators?.length ?? 0) > 0 || (edge.farScopeOperators?.length ?? 0) > 0,
    ).length,
  );
  derived.set(
    'projection.far',
    groups.filter((edge) => (edge.farScopeOperators?.length ?? 0) > 0).length,
  );
  derived.set(
    'projection.farOccurrences',
    edges.filter((edge) => (edge.farScopeOperators?.length ?? 0) > 0).length,
  );
}, 180_000);

const N = '(\\d[\\d,]*)';
const fig = (label: string, pattern: string, key: string): Figure => ({
  label,
  pattern: new RegExp(pattern, 'u'),
  derived: of(key),
});

const KB = '.claude/rules/kb-build.md';
const PROOF = '.claude/rules/proof.md';
const GRAPH = '.claude/rules/graph.md';
const WAVES = '.claude/rules/waves.md';

const CENSUS: Row[] = [
  {
    file: KB,
    anchor: 'payload + 5 tag entries + the tagmanifest',
    figures: [
      fig('payload entries', `${N} payload \\+`, 'bag.payload'),
      fig('tag entries', `\\+ ${N} tag entries`, 'bag.tags'),
      fig('members', `= ${N} members`, 'bag.members'),
    ],
  },
  {
    file: KB,
    anchor: '- Payload = ',
    figures: [fig('documents', `Payload = ${N} docs`, 'bag.documents')],
  },
  {
    file: KB,
    anchor: 'Clause counts: version',
    figures: Object.keys(PREDICATES).map((name) =>
      fig(`${name} clauses`, `${name} ${N}`, `clauses.${name}`),
    ),
  },
  {
    file: KB,
    anchor: '**Counting vocabulary, kept distinct.**',
    figures: [
      fig('entity sites', `${N} \`guideline_entity/4\` sites`, 'clauses.entity'),
      fig('derivable entity solutions', `yield ${N} derivable entity`, 'solutions.entity'),
      fig('event sites', `${N} event sites`, 'clauses.event'),
      fig('derivable event solutions', `event sites yield ${N}`, 'solutions.event'),
      fig('noun atoms', `${N} noun atoms`, 'vocabulary.nouns'),
      fig('verbs', `${N} verbs`, 'vocabulary.verbs'),
      fig('documents', `${N} docs\\*\\*`, 'bag.documents'),
    ],
  },
  {
    file: PROOF,
    anchor: 'Rules dominate: arg',
    figures: (
      ['arg', 'cardinality', 'entity', 'event', 'operator', 'pp', 'property'] as const
    ).flatMap((name) => [
      fig(`${name} rules`, `${name} ${N}/`, `rules.${name}`),
      fig(`${name} clauses`, `${name} \\d+/${N}`, `clauses.${name}`),
    ]),
  },
  {
    file: PROOF,
    anchor: 'Identity = `clause/3` reference',
    figures: [
      fig('clause lines', `All ${N} \`L\` values`, 'clauses.total'),
      fig('recovered clauses', `recovers ${N}/`, 'clauses.total'),
    ],
  },
  {
    file: PROOF,
    anchor: 'A clinical premise is universal-instantiation scaffolding',
    figures: [
      fig('raw premises', `${N} raw`, 'clinical.premises'),
      fig('conditions', `carries ${N} distinct conditions`, 'intake.conditions'),
      fig('rules', `over ${N} rules`, 'intake.rules'),
      fig('unconditional rules', `${N} of them unconditional`, 'intake.unconditional'),
      fig('documents', `across ${N} documents`, 'intake.documents'),
    ],
  },
  {
    file: PROOF,
    anchor: '- Census: ',
    figures: [
      fig('documents', `Census: ${N} documents`, 'clinical.documents'),
      fig('content sentences', `${N} content sentences`, 'clinical.gates'),
      fig('sites', `\\*\\*${N} sites`, 'clinical.sites'),
      fig('unique lines', `/ ${N} unique lines`, 'clinical.uniqueLines'),
    ],
  },
  {
    file: PROOF,
    anchor: '- Measured over the shipped image: **',
    figures: [
      fig('clause nodes', `\\*\\*${N} clause nodes`, 'proof.clauses'),
      fig('assumption leaves', `\\*\\*${N} assumption leaves`, 'proof.assumptions'),
      fig('NAF marks', `\\*\\*${N} NAF`, 'proof.negations'),
    ],
  },
  {
    file: GRAPH,
    anchor: 'self-edges of',
    figures: [
      fig('self-edges', `\\*\\*${N} self-edges`, 'graph.selfEdges'),
      fig('edges', `self-edges of ${N}\\*\\*`, 'graph.edges'),
    ],
  },
  {
    file: GRAPH,
    anchor: '- Deterministic full graph = ',
    figures: [
      fig('typed nodes', `\\*\\*${N} typed nodes`, 'graph.nodes'),
      fig('typed edges', `/ ${N} typed edges`, 'graph.edges'),
    ],
  },
  {
    file: GRAPH,
    anchor: '- Explicit edge schemas = ',
    figures: [
      fig('edge schemas', `edge schemas = ${N}`, 'graph.schemas'),
      fig('implies edges', `\\*\\*${N} \`implies\` edges`, 'graph.implies'),
      fig('rule-context implications', `\\*\\*${N} rule-context`, 'graph.ruleContext'),
      fig('synthesized shortcuts', `\\+ ${N} synthesized`, 'graph.shortcuts'),
    ],
  },
  {
    file: GRAPH,
    anchor: '- Projection = ',
    figures: [
      fig('projected nodes', `\\*\\*${N} nodes`, 'projection.nodes'),
      fig('grouped edges', `/ ${N} grouped edges`, 'projection.groups'),
      fig('entity nodes', `${N} entity \\+`, 'projection.entity'),
      fig('event nodes', `\\+ ${N} event`, 'projection.event'),
      fig('value nodes', `\\+ ${N} value`, 'projection.value'),
      fig('concept headline', `counts the ${N} entity/event`, 'projection.concepts'),
    ],
  },
  {
    file: GRAPH,
    anchor: 'groups carry an ordered scope',
    figures: [
      fig('scoped groups', `\\*\\*${N} of the`, 'projection.scoped'),
      fig('far-scope groups', `\\*\\*${N} of them carry a far scope`, 'projection.far'),
      fig('far-scope occurrences', `\\(${N} edge occurrences\\)`, 'projection.farOccurrences'),
    ],
  },
  {
    file: GRAPH,
    anchor: '- Modal census, ',
    figures: [
      fig('negation contexts', `${N} \`-\` \\(negation\\)`, 'modal.-'),
      fig('should contexts', `${N} \`should\``, 'modal.should'),
      fig('may contexts', `${N} \`may\``, 'modal.may'),
      fig('can contexts', `${N} \`can\``, 'modal.can'),
      fig('must contexts', `${N} \`must\``, 'modal.must'),
      fig('operator contexts', `\\*\\*${N} operator contexts`, 'modal.contexts'),
      fig('orphaned contexts', `of which ${N} carry no edge`, 'modal.orphaned'),
    ],
  },
  {
    file: WAVES,
    anchor: 'Seed it with `cp -a --reflink=auto kb/generated',
    figures: [fig('generated files', `— ${N} files`, 'generated.files')],
  },
];

const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

describe('stated censuses', () => {
  it('every figure the rules state equals its derivation, named by file and line on drift', () => {
    expect(grade(CENSUS, read)).toEqual([]);
  });

  it('refuses a figure altered in the real rules text, and an emptied table', () => {
    const altered = grade(CENSUS, (file) =>
      file === KB ? read(file).replace('entity 1834,', 'entity 1835,') : read(file),
    );
    expect(altered).toEqual([
      expect.stringMatching(
        /^\.claude\/rules\/kb-build\.md:\d+ states entity clauses = 1835, derived 1834$/u,
      ),
    ]);
    expect(grade([], read)).toEqual(['CENSUS table is empty, so no stated figure is graded']);
  });
});
