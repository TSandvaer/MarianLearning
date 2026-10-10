/**
 * Drift checks for code the native app copies verbatim from the web app
 * (pure logic that is not in `@marian/core` yet): read a function's source
 * from both files and compare them with comments and layout removed.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The repo root (`mobile/..`). */
export const REPO_ROOT = resolve(__dirname, '..', '..')

/** Index of the bracket closing the one at `open` (same kind). */
function matching(text: string, open: number, pair: '()' | '<>'): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === pair[0]) depth += 1
    else if (text[i] === pair[1]) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * `function <name>…(…)…{…}` from `file`, comments and whitespace removed.
 * Throws unless it finds exactly that function with a non-empty body, so
 * a check can never pass by comparing two empty strings.
 */
export function functionSource(file: string, name: string): string {
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const head = new RegExp(`\\bfunction ${name}\\s*[(<]`).exec(text)
  if (!head) throw new Error(`no function ${name} in ${file}`)
  const start = head.index
  let i = head.index + head[0].length - 1
  if (text[i] === '<') i = text.indexOf('(', matching(text, i, '<>'))
  const paramsEnd = matching(text, i, '()')
  // The body opens at the first `{` that ends a line after the parameter
  // list (Prettier output); a return type never does.
  const bodyOpen = paramsEnd < 0 ? -1 : text.indexOf('{\n', paramsEnd)
  if (bodyOpen < 0) throw new Error(`no body for function ${name} in ${file}`)
  let depth = 0
  for (let j = bodyOpen; j < text.length; j++) {
    if (text[j] === '{') depth += 1
    else if (text[j] === '}') {
      depth -= 1
      if (depth === 0) {
        const source = text
          .slice(start, j + 1)
          .replace(/\s+/g, ' ')
          .trim()
        if (!source.startsWith(`function ${name}`) || source.length < 40) {
          throw new Error(`function ${name} in ${file} came out as "${source}"`)
        }
        return source
      }
    }
  }
  throw new Error(`unbalanced braces in function ${name} in ${file}`)
}
