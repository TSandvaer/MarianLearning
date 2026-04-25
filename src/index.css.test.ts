import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The body's background-color must match Tailwind's `my-cream` token. Without
 * a body bg, AnimatePresence route transitions fade through the default white
 * UA backdrop and produce a cream → white → cream flash between Splash and
 * Greet — see Kevin's review on PR #13 and design/session-1.md line 79
 * ("shared layout — no hard cut").
 *
 * Vitest runs with `css: false`, so we can't assert via getComputedStyle in
 * jsdom. Instead we lock the invariant at the source level: index.css must
 * declare the rule, and the value must match `tailwind.config.js`.
 */
describe('index.css body background (route-transition flash guard)', () => {
  const repoRoot = resolve(__dirname, '..')
  const indexCss = readFileSync(resolve(repoRoot, 'src/index.css'), 'utf8')
  const tailwindConfig = readFileSync(
    resolve(repoRoot, 'tailwind.config.js'),
    'utf8',
  )

  function extractMyCreamFromTailwind(): string {
    // Match: 'my-cream': '#FFF5F0',  (single or double quotes, any case)
    const match = tailwindConfig.match(
      /['"]my-cream['"]\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/,
    )
    if (!match)
      throw new Error('my-cream token not found in tailwind.config.js')
    return match[1].toLowerCase()
  }

  function extractBodyBgFromIndexCss(): string {
    // Match the first `background-color: <hex>;` inside a `body { ... }` block.
    const bodyBlock = indexCss.match(/body\s*\{([^}]*)\}/)
    if (!bodyBlock) throw new Error('No body { ... } block in index.css')
    const bgMatch = bodyBlock[1].match(
      /background-color\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/,
    )
    if (!bgMatch)
      throw new Error('No background-color declaration on body in index.css')
    return bgMatch[1].toLowerCase()
  }

  it('declares a body background-color', () => {
    expect(() => extractBodyBgFromIndexCss()).not.toThrow()
  })

  it('uses the same value as tailwind.config.js → my-cream', () => {
    // If this fails, update both files together — the comment in index.css
    // calls out the lockstep requirement.
    expect(extractBodyBgFromIndexCss()).toBe(extractMyCreamFromTailwind())
  })
})
