/**
 * ESLint custom rule: require-js-extension
 *
 * Forbids bare relative imports (no extension) inside files this rule is
 * scoped to. Intended for `api/*.ts` only — see `eslint.config.js`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `package.json` declares `"type": "module"`, so the deployed `claude.js`
 * (compiled from `api/claude.ts`) is ESM. Node ESM strict-resolution at the
 * Vercel runtime requires explicit file extensions on every relative import.
 * `from './_types'` does NOT resolve at runtime — Node throws
 * `ERR_MODULE_NOT_FOUND` at module-load and Vercel surfaces it as
 * `FUNCTION_INVOCATION_FAILED` (HTTP 500) on every request.
 *
 * TypeScript bundler-resolution AND Vitest both forgive bare specifiers, so
 * unit tests pass green, type-check passes, lint passes — and prod is dead.
 * That trap took three hot-fix rounds (PRs #32, #34, #36) to close on
 * ticket 86c9grnj4. This rule prevents the next contributor from re-tripping
 * the same wire.
 *
 * The canonical spelling is `from './_types.js'` — the `.js` resolves back
 * to the matching `.ts` source under `moduleResolution: "bundler"` for
 * type-check + Vitest, and is what Node ESM expects at runtime. One spelling
 * works in dev, test, and prod.
 *
 * WHAT IT CHECKS
 * --------------
 *  - `import x from './foo'`            -> error  (use './foo.js')
 *  - `import('./foo')`                  -> error  (use './foo.js')
 *  - `export { x } from './foo'`        -> error
 *  - `export * from './foo'`            -> error
 *  - `vi.mock('./foo', ...)`            -> error  (resolution path is the same)
 *  - `import x from './foo.js'`         -> ok
 *  - `import x from 'some-package'`     -> ok      (bare specifier, not relative)
 *  - `import 'node:crypto'`             -> ok      (node: protocol)
 *
 * Allowed extensions: `.js`, `.mjs`, `.cjs`, `.json`. `.ts` / `.tsx` are
 * NOT allowed because they don't resolve at Node runtime either.
 */

const ALLOWED_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json']

/** True if `source` is a relative specifier ('./x' or '../x'). */
function isRelative(source) {
  return source.startsWith('./') || source.startsWith('../')
}

/** True if `source` ends in one of the allowed file extensions. */
function hasAllowedExtension(source) {
  return ALLOWED_EXTENSIONS.some((ext) => source.endsWith(ext))
}

/** True if the import source is a relative specifier that lacks an
 *  extension we accept. */
function isOffender(source) {
  if (typeof source !== 'string') return false
  if (!isRelative(source)) return false
  if (hasAllowedExtension(source)) return false
  return true
}

/** Build the user-facing report message for a given source string. */
function messageFor(source) {
  return (
    `Relative import "${source}" must use an explicit ".js" extension ` +
    `(e.g. "${source}.js"). Node ESM strict-resolution at the Vercel runtime ` +
    `requires explicit extensions; bare specifiers crash the function at ` +
    `module-load. See memory/project_vercel_runtime_config.md.`
  )
}

/** True if a CallExpression node looks like `vi.mock(...)`. We accept both
 *  `vi.mock` and the rarer `vitest.mock`-style spellings to be safe — but
 *  default to the canonical `vi.mock` only. */
function isViMockCall(node) {
  const callee = node.callee
  if (!callee || callee.type !== 'MemberExpression') return false
  if (callee.computed) return false
  const obj = callee.object
  const prop = callee.property
  if (!obj || obj.type !== 'Identifier' || obj.name !== 'vi') return false
  if (!prop || prop.type !== 'Identifier') return false
  return (
    prop.name === 'mock' || prop.name === 'doMock' || prop.name === 'unmock'
  )
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require explicit ".js" extension on relative imports (Node ESM strict-resolution).',
    },
    schema: [],
    messages: {
      missingExtension: '{{detail}}',
    },
  },
  create(context) {
    /** Report on a node whose `.source` property is a string Literal. */
    function checkSourceNode(node) {
      const sourceNode = node.source
      if (!sourceNode || sourceNode.type !== 'Literal') return
      const value = sourceNode.value
      if (!isOffender(value)) return
      context.report({
        node: sourceNode,
        messageId: 'missingExtension',
        data: { detail: messageFor(value) },
      })
    }

    return {
      ImportDeclaration: checkSourceNode,
      ExportNamedDeclaration(node) {
        if (node.source) checkSourceNode(node)
      },
      ExportAllDeclaration: checkSourceNode,
      ImportExpression(node) {
        const arg = node.source
        if (!arg || arg.type !== 'Literal') return
        const value = arg.value
        if (!isOffender(value)) return
        context.report({
          node: arg,
          messageId: 'missingExtension',
          data: { detail: messageFor(value) },
        })
      },
      CallExpression(node) {
        if (!isViMockCall(node)) return
        const arg = node.arguments[0]
        if (!arg || arg.type !== 'Literal') return
        const value = arg.value
        if (!isOffender(value)) return
        context.report({
          node: arg,
          messageId: 'missingExtension',
          data: { detail: messageFor(value) },
        })
      },
    }
  },
}

export default rule
