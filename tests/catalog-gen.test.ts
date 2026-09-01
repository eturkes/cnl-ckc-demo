// Hostile-input contract for the build-time catalog generator. Every mutation starts
// from the verified vendored bag's in-memory file map; no extracted copy is an input.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { verifyBag } from '../tools/kb/bag.mjs';
import * as catalogGenerator from '../tools/kb/catalog.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`expected one vendored bag, found ${archives.length}`);
const verified = verifyBag(readFileSync(join(ROOT, 'kb', archives[0] as string))).files;

const freshFiles = (): Map<string, Uint8Array> => new Map(verified);

const member = (files: ReadonlyMap<string, Uint8Array>, suffix: string): string => {
  const matches = [...files.keys()].filter((path) => path.endsWith(suffix));
  if (matches.length !== 1)
    throw new Error(`${suffix}: expected one bag member, found ${matches.length}`);
  return matches[0] as string;
};

const queryPath = (files: ReadonlyMap<string, Uint8Array>, id: string): string =>
  member(files, `/queries/pl/${id}.pl`);

const replaceOnce = (source: string, from: string, to: string): string => {
  if (source.split(from).length !== 2) throw new Error(`${from}: expected exactly one test token`);
  return source.replace(from, to);
};

const mutateQuery = (
  files: Map<string, Uint8Array>,
  id: string,
  mutate: (source: string) => string,
): void => {
  const path = queryPath(files, id);
  const source = Buffer.from(files.get(path) as Uint8Array).toString('utf8');
  files.set(path, Buffer.from(mutate(source), 'utf8'));
};

describe('catalog generator fails closed', () => {
  it('t.gen-mutate P1.10 rejects a changed goal and an unexpected projection functor', () => {
    const cases: [string, (files: Map<string, Uint8Array>) => void][] = [
      [
        'goal atom drift',
        (files) =>
          mutateQuery(files, 'category-a-recommendations', (source) =>
            replaceOnce(source, "'category-A-recommendation'", "'category-Z-recommendation'"),
          ),
      ],
      [
        'projection functor drift',
        (files) =>
          mutateQuery(files, 'dosage-reduction-content', (source) =>
            replaceOnce(source, 'answers([answer(C,wh(what))])', 'outputs([answer(C,wh(what))])'),
          ),
      ],
    ];
    for (const [label, mutate] of cases) {
      const files = freshFiles();
      mutate(files);
      expect(() => catalogGenerator.generateCatalogSource(files), label).toThrow();
    }
  });

  it('t.gen-missing P1.7/P1.10 rejects a missing or extra compiled query member', () => {
    const missing = freshFiles();
    missing.delete(queryPath(missing, 'recommendation-exists'));
    expect(() => catalogGenerator.generateCatalogSource(missing), 'missing query').toThrow();

    const extra = freshFiles();
    const exemplar = queryPath(extra, 'recommendation-exists');
    const extraPath = exemplar.replace(/[^/]+$/, 'unexpected-query.pl');
    extra.set(extraPath, extra.get(exemplar) as Uint8Array);
    expect(() => catalogGenerator.generateCatalogSource(extra), 'extra query').toThrow();
  });
});
