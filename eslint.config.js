import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier/recommended'
import { defineConfig, globalIgnores } from 'eslint/config'
import requireJsExtension from './eslint-rules/require-js-extension.js'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    'coverage',
    'public/icons',
    'public/splash',
    'scripts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Kevin's rule: no `any` on public APIs. Internal any is tactical — justify in PR.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['src/pwa/sw.ts'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  // ESM-resolution guard for Vercel /api functions.
  //
  // The deployed code in api/ runs as ESM under "type":"module" in
  // package.json, and Node ESM strict-resolution at the Vercel runtime
  // requires explicit ".js" extensions on relative imports. TypeScript
  // bundler-resolution + Vitest both forgive bare specifiers, so the
  // fault is invisible in dev/test/lint until prod returns
  // FUNCTION_INVOCATION_FAILED on every request. The custom rule below
  // catches it at lint time.
  //
  // Scope is api/**/*.ts ONLY — src/** is bundled by Vite for the browser
  // and does not face the same resolution constraint. See
  // memory/project_vercel_runtime_config.md and PR #36 for the history
  // that motivated this rule.
  {
    files: ['api/**/*.ts'],
    plugins: {
      'marian-api': {
        rules: {
          'require-js-extension': requireJsExtension,
        },
      },
    },
    rules: {
      'marian-api/require-js-extension': 'error',
    },
  },
])
