/**
 * The drift helper itself: each of the four web-copy checks must compare
 * the real function, never two empty strings (review of #532).
 */
import { resolve } from 'node:path'
import { functionSource, REPO_ROOT } from './webSource'

const CASES: [file: string, name: string, minLength: number][] = [
  ['src/screens/Math/Math.tsx', 'buildChipOrder', 1000],
  ['src/screens/Math/Math.tsx', 'lcg', 100],
  ['src/lib/audio/sessionStartFallback.ts', 'startSessionWithFallback', 1000],
  ['src/lib/audio/sessionStartFallback.ts', 'linkedController', 150],
]

it.each(CASES)(
  '%s %s: the whole function, not an empty match',
  (file, name, min) => {
    const source = functionSource(resolve(REPO_ROOT, file), name)
    expect(source.startsWith(`function ${name}`)).toBe(true)
    expect(source.endsWith('}')).toBe(true)
    expect(source.length).toBeGreaterThan(min)
  },
)

it('an unknown or prefix-only name throws instead of matching', () => {
  const file = resolve(REPO_ROOT, 'src/screens/Math/Math.tsx')
  expect(() => functionSource(file, 'lc')).toThrow('no function lc')
  expect(() => functionSource(file, 'noSuchFunction')).toThrow()
})
