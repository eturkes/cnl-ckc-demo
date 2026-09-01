import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../../tools/kb/bag.mjs';
import { QUESTION_CATALOG, type QuestionId, type QuestionRecord } from './catalog.js';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const QUERY_ROOT = 'data/guidelines/cdc-2022-opioid/queries/pl';
const PROJECTION_PREFIX = "'$guideline_query_projection'(goal(";
const ANSWERS_BOUNDARY = '),answers(';

export const EXPORTED_IDS = [
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
] as const satisfies readonly QuestionId[];

type ExportedId = (typeof EXPORTED_IDS)[number];
type Catalog = { readonly [K in QuestionId]: QuestionRecord };
type OracleProjection =
  | { readonly kind: 'bindings'; readonly variables: readonly string[] }
  | { readonly kind: 'boolean'; readonly variables: readonly [] };
export type CatalogOracle = Readonly<
  Record<ExportedId, { readonly goal: string; readonly projection: OracleProjection }>
>;

const projectionLine = (source: string): string => {
  const found = source.split('\n').find((line) => line.startsWith(PROJECTION_PREFIX));
  if (found === undefined) throw new Error('query source omitted its projection');
  return found;
};

const projectionOf = (
  source: string,
): { readonly goal: string; readonly projection: OracleProjection } => {
  const line = projectionLine(source);
  let depth = 0;
  let quoted = false;
  let boundary = -1;

  for (let index = PROJECTION_PREFIX.length; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === "'" && line[index + 1] === "'") index += 1;
      else if (character === "'") quoted = false;
      continue;
    }
    if (character === "'") quoted = true;
    else if (character === '(') depth += 1;
    else if (character === ')' && depth === 0 && line.startsWith(ANSWERS_BOUNDARY, index)) {
      boundary = index;
      break;
    } else if (character === ')') depth -= 1;
  }

  if (boundary === -1 || !line.endsWith(')).')) throw new Error('query projection is malformed');
  const goal = line.slice(PROJECTION_PREFIX.length, boundary);
  const answers = line.slice(boundary + ANSWERS_BOUNDARY.length, -3);
  if (answers === '[]') return { goal, projection: { kind: 'boolean', variables: [] } };
  const variables = [...answers.matchAll(/answer\(([A-Z][A-Za-z0-9_]*),/g)].map(
    (match) => match[1] as string,
  );
  if (variables.length === 0) throw new Error('query projection has no answer variables');
  return { goal, projection: { kind: 'bindings', variables } };
};

export const readCatalogOracle = (root = ROOT): CatalogOracle => {
  const kb = join(root, 'kb');
  const archives = readdirSync(kb).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) throw new Error(`expected one bag, found ${archives.length}`);
  const files = verifyBag(readFileSync(join(kb, archives[0] as string))).files;
  const entries = EXPORTED_IDS.map((id) => {
    const path = `${QUERY_ROOT}/${id}.pl`;
    const bytes = files.get(path);
    if (bytes === undefined) throw new Error(`bag omitted ${path}`);
    return [id, projectionOf(Buffer.from(bytes).toString('utf8'))] as const;
  });
  return Object.fromEntries(entries) as unknown as CatalogOracle;
};

export const catalogDrifts = (
  catalog: Catalog = QUESTION_CATALOG,
  oracle: CatalogOracle = readCatalogOracle(),
): readonly string[] => {
  const drifts: string[] = [];
  for (const id of EXPORTED_IDS) {
    const record = catalog[id];
    const expected = oracle[id];
    if (record.id !== id) drifts.push(`${id}: record id is ${record.id}`);
    if (record.source !== 'bag-export') drifts.push(`${id}: source is ${record.source}`);
    if (record.goal !== expected.goal) drifts.push(`${id}: goal differs byte-for-byte`);
    if (record.projection.kind !== expected.projection.kind) {
      drifts.push(`${id}: projection kind differs`);
    } else if (
      record.projection.kind === 'bindings' &&
      expected.projection.kind === 'bindings' &&
      (record.projection.variables.length !== expected.projection.variables.length ||
        record.projection.variables.some(
          ({ name }, index) => name !== expected.projection.variables[index],
        ))
    ) {
      drifts.push(`${id}: projection variables differ`);
    }
  }
  return drifts;
};

export const assertCatalogMatchesBag = (
  catalog: Catalog = QUESTION_CATALOG,
  oracle: CatalogOracle = readCatalogOracle(),
): void => {
  const drifts = catalogDrifts(catalog, oracle);
  if (drifts.length !== 0) throw new Error(`catalog drift: ${drifts.join('; ')}`);
};
