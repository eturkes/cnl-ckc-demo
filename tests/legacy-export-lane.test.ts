// M5 u6 acceptance — the legacy export lane, graded against the committed answer oracles.
//
// Predicates D1-D5 from `.agent/contracts/m5u6.md`. `kb:export-check` requires every case id
// here to have PASSED, so deleting the file, renaming a case or skipping one fails the gate.
//
// This file reads `queries/answers/*.pl`, which `kb:asset-check` bans everywhere but
// `tests/`: proving live output against the committed answers is exactly what makes them
// oracles, and production reading them would make the demo's answers a lookup.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';
import type { ExportedQuery } from '../tools/kb/exports.mjs';
import { EXPORTED, exportedQueries, statementGoal } from '../tools/kb/exports.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

import { bagFiles, ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;

const BOOT_TIMEOUT = 120_000;
const BUILD_TIMEOUT = 300_000;

const queries = exportedQueries(bagFiles);
let engine: Engine;

beforeAll(async () => {
  engine = await load(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))))({
    arguments: ['-q'],
  });
}, BOOT_TIMEOUT);

/** The statement `target` answers `query` with, rendered by the engine rather than by JS. */
const statement = (target: Engine, query: ExportedQuery): string => {
  const rows = [...target.prolog.query(statementGoal(query))] as Record<string, unknown>[];
  if (rows.length !== 1) throw new Error(`${query.id}: the lane goal is not deterministic`);
  return `${String(rows[0]?.LaneText)}.`;
};

/** The committed oracle statement, read out of the same verified bag. */
const oracle = (id: string): string => {
  const path = [...bagFiles.keys()].find((name) => name.endsWith(`/queries/answers/${id}.pl`));
  if (path === undefined) throw new Error(`${id}: no committed answer oracle`);
  const line = new TextDecoder('utf-8', { fatal: true })
    .decode(bagFiles.get(path))
    .split('\n')
    .find((candidate) => candidate.startsWith("'$guideline_answers'("));
  if (line === undefined) throw new Error(`${id}: the oracle carries no answer statement`);
  return line;
};

const bytesOf = (path: string): Uint8Array => {
  const bytes = bagFiles.get(path);
  if (bytes === undefined) throw new Error(`${path}: absent from the bag`);
  return bytes;
};

describe('legacy export lane', () => {
  it('D1 the declared exports are exactly the compiled queries the bag carries', () => {
    expect(queries.map(({ id }) => id)).toEqual([...EXPORTED]);
    const carried = [...bagFiles.keys()]
      .filter((name) => /\/queries\/pl\/[^/]+\.pl$/u.test(name))
      .map((name) => name.replace(/^.*\/([^/]+)\.pl$/u, '$1'))
      .sort();
    expect(carried).toEqual([...EXPORTED].sort());
  });

  it('D2 a renamed, extra or missing exported query is refused by name', () => {
    const [first] = queries;
    if (first === undefined) throw new Error('the lane declared no exports');
    const rename = (name: string): string => first.path.replace(/[^/]+\.pl$/u, `${name}.pl`);

    const extra = new Map(bagFiles).set(rename('zz-extra'), bytesOf(first.path));
    expect(() => exportedQueries(extra)).toThrow(/unexpected \[zz-extra\]/u);

    const dropped = new Map(bagFiles);
    dropped.delete(first.path);
    expect(() => exportedQueries(dropped)).toThrow(new RegExp(`missing \\[${first.id}\\]`, 'u'));

    const renamed = new Map(dropped).set(rename('zz-renamed'), bytesOf(first.path));
    expect(() => exportedQueries(renamed)).toThrow(
      new RegExp(`unexpected \\[zz-renamed\\]; missing \\[${first.id}\\]`, 'u'),
    );
  });

  it('D3/D4 every exported goal answers its committed oracle byte for byte', () => {
    let graded = 0;
    for (const query of queries) {
      expect(statement(engine, query), query.id).toBe(oracle(query.id));
      graded += 1;
    }
    expect(graded).toBe(EXPORTED.length);
  });

  it(
    'D5 erasing one payload dependency reddens exactly its export',
    async () => {
      // The victim is derived from the goal, not named here: the goal quotes the entity type
      // it joins on, so the erased line is provably a dependency of this export alone.
      const target = queries.find(({ id }) => id === 'category-a-recommendations');
      if (target === undefined) throw new Error('the category-A export is not declared');
      const [, type] =
        /guideline_entity\(actual,[A-Z_][A-Za-z0-9_]*,('[^']+'),countable\)/u.exec(target.goal) ??
        [];
      expect(type).toBeDefined();

      const { source } = payloadSource(bagFiles);
      const dependency = source
        .split('\n')
        .find(
          (line) =>
            line.startsWith('guideline_entity(actual,') &&
            line.endsWith(`,${String(type)},countable).`),
        );
      expect(dependency).toBeDefined();
      const erased = source.replace(`${String(dependency)}\n`, '');
      expect(erased.length).toBeLessThan(source.length);

      // The document the erased line belonged to, so the RED is that solution dropping out
      // rather than the statement differing for any reason at all.
      const [, document] = /'\$guideline_id'\(product,('[^']+')/u.exec(String(dependency)) ?? [];
      expect(oracle(target.id)).toContain(String(document));

      const mutated = await load((await buildImage(erased)).image)({ arguments: ['-q'] });
      const reddened = statement(mutated, target);
      expect(reddened).not.toBe(oracle(target.id));
      expect(reddened).not.toContain(String(document));
      for (const other of queries.filter(({ id }) => id !== target.id)) {
        expect(statement(mutated, other), other.id).toBe(oracle(other.id));
      }
    },
    BUILD_TIMEOUT,
  );
});
