import js from '@eslint/js';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import security from 'eslint-plugin-security';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

export default ts.config(
  // `.vite/` is the root-resolved build cache; it holds bundled dependency code.
  { ignores: ['dist/', 'kb/', '.scratch/', '.vite/'] },
  js.configs.recommended,
  ts.configs.recommendedTypeChecked,
  svelte.configs.recommended,
  // The gate's static-analysis layer. ESLint is the only analyzer in the stack that parses
  // `.svelte`, so the sink rules have to live here: `svelte/no-at-html-tags` (from the svelte
  // preset above) covers `{@html}`, `no-unsanitized` covers the DOM sinks, and
  // `eslint-plugin-security` covers the Node-side build scripts.
  security.configs.recommended,
  noUnsanitized.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        // The project service rejects non-standard extensions unless they are declared here.
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
  },
  // A split label's two halves must share one signature across every locale, so the
  // half that ignores the count still has to declare it (`src/i18n/en.ts`). The
  // underscore is what marks that as deliberate rather than as a forgotten read.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // `detect-object-injection` reads every computed member access as a sink. It cannot see
  // TypeScript's index signatures, which is what actually decides the access here, so all 150
  // of its findings across `src/` and `tools/` were typed lookups. A rule at zero signal
  // hides the rules that have some.
  { rules: { 'security/detect-object-injection': 'off' } },
  // `advice.ts` is byte-frozen against `22053ef` by `clinical-records`' T9, so its one
  // exception cannot be an inline disable. The pattern is `[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+`:
  // star height 2, but the inner branch must open on `-`, which the outer class cannot match,
  // so the two are disjoint at every position and the match stays linear.
  { files: ['src/questions/advice.ts'], rules: { 'security/detect-unsafe-regex': 'off' } },
  // Build scripts and tests take no untrusted input: every path they read and every pattern
  // they assemble comes from a committed constant under the repo root. `src/` keeps all three
  // rules on, because that is the surface a browser actually loads.
  {
    files: ['tools/**/*.mjs', 'tests/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-non-literal-require': 'off',
    },
  },
  // Config files sit outside tsconfig's project graph, so type-aware rules cannot resolve them.
  { files: ['**/*.js'], extends: [ts.configs.disableTypeChecked] },
);
