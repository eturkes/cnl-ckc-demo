import { performance } from 'node:perf_hooks';

import { expect, it } from 'vitest';

import { QUESTION_CATALOG } from './catalog.js';
import { assertCatalogMatchesBag } from './oracle.js';

it('fails the gate when a bag-exported catalog record drifts', () => {
  const started = performance.now();
  const categoryA = QUESTION_CATALOG['category-a-recommendations'];
  const catalog =
    process.env.SRC_MUTATE_GOAL === '1'
      ? {
          ...QUESTION_CATALOG,
          'category-a-recommendations': {
            ...categoryA,
            goal: categoryA.goal.replace('category-A-recommendation', 'category-Z-recommendation'),
          },
        }
      : QUESTION_CATALOG;
  expect(() => assertCatalogMatchesBag(catalog)).not.toThrow();
  console.log(`SRC_CATALOG_CHECK\tpass\tinProcessMs=${(performance.now() - started).toFixed(3)}`);
});
