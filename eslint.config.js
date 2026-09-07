import js from '@eslint/js';
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
  // Config files sit outside tsconfig's project graph, so type-aware rules cannot resolve them.
  { files: ['**/*.js'], extends: [ts.configs.disableTypeChecked] },
);
