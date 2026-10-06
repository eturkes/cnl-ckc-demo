// Queue row `Condition-supports dedup is scope-blind`, second arm. The synthesized `condition
// supports` shortcut keys on document, sentence, condition event and head alone, so an occurrence
// inside a negation folds into a twin from another world. A fold that hides a negation — its own
// world negated, the kept twin's not — is honest only if the twin is a support its sentence states
// unnegated. This check reads the kept edge's OWN clause text, independently of the producer's
// world map, and proves its condition event sits under no `-` operator. A fold whose kept twin is
// negated too hides nothing: the shown edge already carries the negation.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { verifyBag } from '../tools/kb/bag.mjs';
import { deriveSemanticGraph } from '../tools/kb/graph.mjs';
import { ROOT } from '../tools/kb/paths.mjs';

type Derived = ReturnType<typeof deriveSemanticGraph>;
type Fold = Derived['conditionMerges'][number];
interface Scope {
  document: string;
  sentence: number;
  reference: string;
  operator: string;
  chain: string[];
}

let folds: Fold[];
let scopes: Scope[];
const labels = new Map<string, string>();
const clauseText = new Map<number, string>();

beforeAll(() => {
  const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) throw new Error('vendored bag is missing');
  const derived = deriveSemanticGraph(verifyBag(readFileSync(join(ROOT, 'kb', archive))).files);
  folds = derived.conditionMerges;
  scopes = derived.model.scopes as unknown as Scope[];
  for (const node of derived.model.nodes) labels.set(node.id, node.label);
  const chunks = join(ROOT, 'kb', 'generated', 'provenance', 'documents');
  for (const file of readdirSync(chunks)) {
    const chunk = JSON.parse(readFileSync(join(chunks, file), 'utf8')) as {
      clauses: { line: number; text: string }[];
    };
    for (const clause of chunk.clauses) clauseText.set(clause.line, clause.text);
  }
}, 120_000);

/** The producer's own reading of a world, used only to pick the folds that hide a negation. */
const negatedWorld = (index: number): boolean => {
  if (index < 0) return false;
  const scope = scopes[index];
  if (scope === undefined) throw new Error(`no scope ${String(index)}`);
  return scope.chain
    .slice(1)
    .some(
      (reference) =>
        scopes.find(
          (link) =>
            link.document === scope.document &&
            link.sentence === scope.sentence &&
            link.reference === reference,
        )?.operator === '-',
    );
};

/** Operators, outermost first, from `actual` down to `variable`'s world, read from clause text. */
const chainTo = (text: string, variable: string): string[] => {
  const chain: string[] = [];
  for (let world = variable; world !== 'actual';) {
    const literal = new RegExp(`guideline_operator\\((\\w+),${world},([^)]+)\\)`, 'u').exec(text);
    if (literal === null) return [...chain, `<no operator scopes ${world}>`];
    chain.unshift((literal[2] ?? '').replace(/^'|'$/gu, ''));
    world = literal[1] ?? 'actual';
  }
  return chain;
};

const hiding = (all: readonly Fold[]): Fold[] =>
  all.filter((fold) => negatedWorld(fold.world) && !negatedWorld(fold.keptWorld));

/** Each negation-hiding fold whose kept twin its own clause does not state unnegated. */
const unjustified = (all: readonly Fold[], textOf: (line: number) => string): string[] =>
  hiding(all).flatMap((fold) => {
    const line = Number(/^edge:(\d+):/u.exec(fold.kept)?.[1]);
    const text = textOf(line);
    const verb = labels.get(fold.source) ?? '';
    const call = new RegExp(`guideline_event\\((\\w+),\\w+,'?${verb}'?\\)`, 'u').exec(text);
    const chain = call === null ? ['<no condition event>'] : chainTo(text, call[1] ?? '');
    return chain.includes('-') || chain.some((operator) => operator.startsWith('<'))
      ? [
          `${fold.document}:${String(fold.sentence)} ${fold.source} → ${fold.target}: ${chain.join(',')}`,
        ]
      : [];
  });

describe('condition-supports folds', () => {
  it('records 25 negated folds: 18 hide a negation behind an unnegated twin, 7 fold into a negated one', () => {
    const negated = folds.filter((fold) => negatedWorld(fold.world));
    expect(negated).toHaveLength(25);
    expect(hiding(folds)).toHaveLength(18);
  });

  it('every negation-hiding fold keeps a twin its own clause states unnegated', () => {
    expect(unjustified(folds, (line) => clauseText.get(line) ?? '')).toEqual([]);
  });

  it('refuses a kept twin whose clause text puts its condition event under a negation', () => {
    const [victim] = hiding(folds);
    if (victim === undefined) throw new Error('no negation-hiding fold');
    const keptLine = Number(/^edge:(\d+):/u.exec(victim.kept)?.[1]);
    const verb = labels.get(victim.source) ?? '';
    const refused = unjustified([victim], (line) => {
      const text = clauseText.get(line) ?? '';
      if (line !== keptLine) return text;
      // Re-scope the condition event's world under a planted `-` operator.
      return text.replace(
        new RegExp(`guideline_event\\((\\w+),(\\w+),'?${verb}'?\\)`, 'u'),
        `guideline_event(Zz,$2,${verb}),guideline_operator(actual,Zz,'-')`,
      );
    });
    expect(refused).toHaveLength(1);
  });
});
