/**
 * Drift checks for code the native app copies verbatim from the web app
 * (pure logic that is not in `@marian/core` yet): read a function's source
 * from both files and compare them with comments and layout removed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The repo root (`mobile/..`). */
export const REPO_ROOT = resolve(__dirname, '..', '..')

/** `function <name>(…) {…}` from `file`, comments and whitespace removed. */
export function functionSource(file: string, name: string): string {
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const start = text.indexOf(`function ${name}`)
  if (start < 0) throw new Error(`no function ${name} in ${file}`)
  // The body starts at the first `{` after the parameter list's `)` that
  // is followed by the return type (if any) and the body brace.
  let depth = 0
  let opened = false
  let i = text.indexOf(') {', start)
  const typed = text.indexOf('): ', start)
  if (typed >= 0 && typed < i) i = text.indexOf(' {', typed)
  for (i = text.indexOf('{', i); i < text.length; i++) {
    if (text[i] === '{') {
      depth += 1
      opened = true
    } else if (text[i] === '}') {
      depth -= 1
      if (opened && depth === 0) {
        return text
          .slice(start, i + 1)
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
  }
  throw new Error(`unbalanced braces in ${name}`)
}
