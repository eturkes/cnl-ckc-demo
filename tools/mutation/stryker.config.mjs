// `pnpm stryker` — default-operator mutation over the modules one base-green suite imports.
//
// `CLAUDE.md` `Engineering` credits a suite that already passes once the stack's mutation
// tool, at its default operators, kills mutants in the files the suite imports or calls;
// `pnpm mutate`'s hand-written mutants are firing records and never earn that credit. The suite
// is u6's legacy export lane (`tools/mutation/vitest.config.mjs`), green at base since it shipped.

export default {
  // The default `@stryker-mutator/*` glob searches beside core's own install, where pnpm's
  // isolated layout holds no runner, so the runner is resolved from here.
  plugins: [import.meta.resolve('@stryker-mutator/vitest-runner')],
  testRunner: 'vitest',
  // `related: false`: every mutant runs that one suite, never the suites vitest relates to it.
  vitest: { configFile: 'tools/mutation/vitest.config.mjs', related: false },
  // The production modules the suite imports; `tests/clinical-test-support.ts` is test code.
  mutate: ['tools/kb/exports.mjs', 'tools/kb/paths.mjs', 'tools/kb/produce.mjs'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  // D5 builds a whole image per run; more workers on 8 cores stretch a run past its timeout.
  concurrency: 4,
  // Untracked machine state stays out of the sandbox, the retired key file above all.
  ignorePatterns: [
    '/.scratch',
    '/dist',
    '/.probe',
    '/.vite',
    '/.claude',
    '/.dev.vars',
    '/.vitest-attachments',
  ],
};
