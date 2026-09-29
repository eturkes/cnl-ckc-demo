import { vi } from 'vitest';

// Run the unchanged D suite against planted service mutants without editing source.
vi.mock('../src/intake/service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/intake/service.js')>();
  if (process.env.REVIEW_MUTANT === 'lookup') {
    process.env.INTAKE_REFERENCE_MUTANT = 'lookup';
    return import('./intake-service-reference.js');
  }
  if (process.env.REVIEW_MUTANT === 'preflight') {
    const { referenceVocabulary } = await import('./intake-backend-support.js');
    const fallback = referenceVocabulary().rules[0]?.id;
    const legal = new Set(referenceVocabulary().rules.map(({ id }) => id));
    class MutantService extends actual.IntakeService {
      override derive(ruleIds: readonly unknown[], signal?: AbortSignal) {
        return super.derive(
          ruleIds.map((id) => (typeof id === 'string' && legal.has(id) ? id : fallback)),
          signal,
        );
      }
    }
    return { ...actual, IntakeService: MutantService };
  }
  return actual;
});

await import('./intake-service.test.js');
