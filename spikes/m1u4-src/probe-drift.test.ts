import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { QUESTION_CATALOG, type QuestionId, type QuestionRecord } from './catalog.js';
import { assertCatalogMatchesBag, readCatalogOracle } from './oracle.js';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
type Catalog = { readonly [K in QuestionId]: QuestionRecord };

const withCategoryAGoal = (goal: string): Catalog => ({
  ...QUESTION_CATALOG,
  'category-a-recommendations': { ...QUESTION_CATALOG['category-a-recommendations'], goal },
});

const rejected = (catalog: Catalog, oracle: ReturnType<typeof readCatalogOracle>): boolean => {
  try {
    assertCatalogMatchesBag(catalog, oracle);
    return false;
  } catch {
    return true;
  }
};

it('measures exact goal drift granularity and fresh-clone independence', () => {
  const oracle = readCatalogOracle();
  assertCatalogMatchesBag(QUESTION_CATALOG, oracle);
  const original = QUESTION_CATALOG['category-a-recommendations'].goal;
  const atom = original.replace('category-A-recommendation', 'category-Z-recommendation');
  const whitespace = ` ${original}`;
  const variableRename = original.replace(/(?<=[,(])A(?=[,)])/g, 'X');
  const first = 'guideline_entity(actual,A,recommendation,countable)';
  const second = 'guideline_cardinality(actual,A,na,eq,1)';
  const orderedPrefix = `','(${first},','(${second},`;
  const reorderedPrefix = `','(${second},','(${first},`;
  const operatorReorder = original.replace(orderedPrefix, reorderedPrefix);
  expect(operatorReorder).not.toBe(original);

  const outcomes = {
    atom: rejected(withCategoryAGoal(atom), oracle),
    whitespace: rejected(withCategoryAGoal(whitespace), oracle),
    variableRename: rejected(withCategoryAGoal(variableRename), oracle),
    operatorReorder: rejected(withCategoryAGoal(operatorReorder), oracle),
  };
  expect(outcomes).toEqual({
    atom: true,
    whitespace: true,
    variableRename: true,
    operatorReorder: true,
  });

  const fresh = mkdtempSync(join(ROOT, '.spike-m1u4-src-fresh-'));
  let freshPass: boolean;
  try {
    const kb = join(fresh, 'kb');
    mkdirSync(kb);
    const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
    if (archives.length !== 1) throw new Error(`expected one bag, found ${archives.length}`);
    copyFileSync(join(ROOT, 'kb', archives[0] as string), join(kb, archives[0] as string));
    expect(existsSync(join(kb, 'generated'))).toBe(false);
    assertCatalogMatchesBag(QUESTION_CATALOG, readCatalogOracle(fresh));
    freshPass = true;
  } finally {
    rmSync(fresh, { recursive: true, force: true });
  }

  console.log(
    `SRC_DRIFT\tbaseline=pass\tatom=${outcomes.atom ? 'fail' : 'miss'}\twhitespace=${outcomes.whitespace ? 'fail' : 'miss'}\tvariableRename=${outcomes.variableRename ? 'fail' : 'miss'}\toperatorReorder=${outcomes.operatorReorder ? 'fail' : 'miss'}\tfreshNoGenerated=${freshPass ? 'pass' : 'fail'}`,
  );
});
