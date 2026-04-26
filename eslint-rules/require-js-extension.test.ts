/**
 * Unit tests for the custom `require-js-extension` ESLint rule.
 *
 * Uses ESLint's built-in RuleTester. We bind RuleTester's test functions to
 * Vitest's globals (it / describe) so the suite shows up in `yarn test`
 * output alongside everything else, and so coverage instrumentation runs
 * over the rule source.
 */

import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'vitest'
import rule from './require-js-extension.js'

// RuleTester reaches for Mocha-shaped globals by default; point it at
// Vitest's instead so the suite reports through `vitest run`.
RuleTester.it = it
RuleTester.describe = describe

// Parse with @typescript-eslint/parser so test fixtures can use TS-only
// syntax (e.g. `import type { T } from ...`) — same parser that lints the
// real api/*.ts files at lint time.
const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2023,
    sourceType: 'module',
  },
})

const expectedMessage = (source: string) =>
  `Relative import "${source}" must use an explicit ".js" extension ` +
  `(e.g. "${source}.js"). Node ESM strict-resolution at the Vercel runtime ` +
  `requires explicit extensions; bare specifiers crash the function at ` +
  `module-load. See memory/project_vercel_runtime_config.md.`

// RuleTester types are JS-style; cast to `unknown` to bridge to its
// generic Rule shape without dragging ESLint's RuleModule typing into the
// test surface. The runtime contract is exercised by RuleTester itself.
tester.run(
  'require-js-extension',
  rule as unknown as Parameters<typeof tester.run>[1],
  {
    valid: [
      // .js extension on relative imports — the canonical correct form.
      { code: `import x from './foo.js'` },
      { code: `import { a, b } from './bar.js'` },
      { code: `import type { T } from './_types.js'` },
      { code: `import x from '../sibling/foo.js'` },

      // Other allowed extensions.
      { code: `import x from './foo.mjs'` },
      { code: `import x from './foo.cjs'` },
      { code: `import data from './data.json'` },

      // Bare-package specifiers — not relative, not our concern.
      { code: `import x from 'some-pkg'` },
      { code: `import x from '@scope/pkg'` },
      { code: `import x from '@scope/pkg/sub'` },

      // node: protocol — not our concern.
      { code: `import { createHash } from 'node:crypto'` },

      // Re-exports with explicit extension.
      { code: `export { x } from './foo.js'` },
      { code: `export * from './foo.js'` },

      // Dynamic imports with explicit extension.
      { code: `const m = await import('./foo.js')` },

      // vi.mock with explicit extension.
      {
        code: `vi.mock('./foo.js', () => ({ default: 1 }))`,
      },

      // vi.mock targeting a bare package (not a relative path) — not our concern.
      { code: `vi.mock('node:crypto', () => ({}))` },
      { code: `vi.mock('some-pkg', () => ({}))` },

      // Side-effect imports of bare packages.
      { code: `import 'some-pkg/setup'` },
    ],

    invalid: [
      // The canonical regression: bare relative import.
      {
        code: `import x from './foo'`,
        errors: [{ message: expectedMessage('./foo') }],
      },
      {
        code: `import { a } from './_types'`,
        errors: [{ message: expectedMessage('./_types') }],
      },
      {
        code: `import type { T } from './_types'`,
        errors: [{ message: expectedMessage('./_types') }],
      },
      {
        code: `import x from '../shared/util'`,
        errors: [{ message: expectedMessage('../shared/util') }],
      },

      // .ts extension — also invalid at Node ESM runtime.
      {
        code: `import x from './foo.ts'`,
        errors: [{ message: expectedMessage('./foo.ts') }],
      },

      // Re-exports without extension.
      {
        code: `export { x } from './foo'`,
        errors: [{ message: expectedMessage('./foo') }],
      },
      {
        code: `export * from './foo'`,
        errors: [{ message: expectedMessage('./foo') }],
      },

      // Dynamic import without extension.
      {
        code: `const m = await import('./foo')`,
        errors: [{ message: expectedMessage('./foo') }],
      },

      // vi.mock without extension — same Node resolver path as a real import,
      // so it must follow the same rule.
      {
        code: `vi.mock('./_session', () => ({}))`,
        errors: [{ message: expectedMessage('./_session') }],
      },
      {
        code: `vi.doMock('./_session', () => ({}))`,
        errors: [{ message: expectedMessage('./_session') }],
      },

      // Side-effect import of a relative path without extension.
      {
        code: `import './side-effect'`,
        errors: [{ message: expectedMessage('./side-effect') }],
      },
    ],
  },
)
