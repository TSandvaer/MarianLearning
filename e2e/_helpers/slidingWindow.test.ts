/**
 * Unit tests for `e2e/_helpers/slidingWindow.ts` (ticket 86c9qa0kq AC3).
 *
 * Lives under `e2e/_helpers/` next to the helper. Vitest picks it up via
 * `vite.config.ts`'s narrowed exclude (`e2e/** /*.spec.ts` only —
 * `.test.ts` files are now in scope so the e2e harness can exercise its
 * own helpers without leaving the e2e tree).
 */

import { describe, expect, it } from 'vitest'
import { slidingWindow } from './slidingWindow'
// Import the canonical Hub helper for the parity test below. Crossing
// the e2e/src boundary is safe here because vitest consumes this file
// under the app's bundler resolution (vite.config.ts), and the file's
// only consumer is vitest — Playwright's `testMatch: '**/*.spec.ts'`
// excludes it from the e2e runtime. The e2e tsconfig's typecheck pass
// resolves the import via `moduleResolution: 'bundler'` + the file
// existing on disk; `skipLibCheck` keeps cross-config drift quiet.
//
// Per Kevin's PR #183 review: importing the source-of-truth makes the
// "catches drift if either helper's geometry shifts" promise actually
// hold. An inline transcription of Hub's geometry only catches e2e-side
// drift; this import catches Hub-side drift too.
import { slidingWindow as hubSlidingWindow } from '../../src/screens/Hub/stages'

const NODES = [
  'letter-names',
  'letter-sounds',
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'digraphs',
  'sight-words',
  'simple-sentences',
] as const

describe('slidingWindow — canonical 5-cell path-strip geometry (before=1, after=3)', () => {
  it('returns a 5-cell window centred near the focus when in the interior of the array', () => {
    // focusIndex=4 (cvc-words-short-o); before=1, after=3.
    // desiredOffset = 4 - 1 = 3, maxOffset = 9 - 5 = 4 → offset=3.
    // slice = nodes[3..7] = [cvc-words, cvc-words-short-o,
    // cvc-words-short-u, digraphs, sight-words].
    const result = slidingWindow(NODES, 4, 1, 3)
    expect(result.offset).toBe(3)
    expect(result.items).toEqual([
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs',
      'sight-words',
    ])
  })

  it('returns a 5-cell window when focusIndex=3 (cvc-words / short-a regression case)', () => {
    // focusIndex=3 (cvc-words); before=1, after=3.
    // desiredOffset = 3 - 1 = 2, maxOffset = 9 - 5 = 4 → offset=2.
    // slice = nodes[2..6] = [blending-cv, cvc-words,
    // cvc-words-short-o, cvc-words-short-u, digraphs].
    const result = slidingWindow(NODES, 3, 1, 3)
    expect(result.offset).toBe(2)
    expect(result.items).toEqual([
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs',
    ])
  })

  it('returns a 5-cell window when focusIndex=5 (short-u current — short-u regression case)', () => {
    // focusIndex=5 (cvc-words-short-u); before=1, after=3.
    // desiredOffset = 5 - 1 = 4, maxOffset = 9 - 5 = 4 → offset=4
    // (clamped at right edge).
    // slice = nodes[4..8] = [cvc-words-short-o, cvc-words-short-u,
    // digraphs, sight-words, simple-sentences].
    const result = slidingWindow(NODES, 5, 1, 3)
    expect(result.offset).toBe(4)
    expect(result.items).toEqual([
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs',
      'sight-words',
      'simple-sentences',
    ])
  })

  it('clamps the left edge when focus is near the start (focusIndex=0)', () => {
    // focusIndex=0; before=1, after=3.
    // desiredOffset = -1 → clamp to 0.
    // slice = nodes[0..5) = [letter-names, letter-sounds,
    // blending-cv, cvc-words, cvc-words-short-o].
    const result = slidingWindow(NODES, 0, 1, 3)
    expect(result.offset).toBe(0)
    expect(result.items).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
    ])
  })

  it('clamps the right edge when focus is at the end (focusIndex=arr.length-1)', () => {
    // focusIndex=8; before=1, after=3.
    // desiredOffset = 8 - 1 = 7, maxOffset = 9 - 5 = 4 → clamp to 4.
    // slice = nodes[4..8] = [cvc-words-short-o, cvc-words-short-u,
    // digraphs, sight-words, simple-sentences].
    const result = slidingWindow(NODES, 8, 1, 3)
    expect(result.offset).toBe(4)
    expect(result.items).toEqual([
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs',
      'sight-words',
      'simple-sentences',
    ])
  })
})

describe('slidingWindow — symmetric and asymmetric windows', () => {
  it('supports a symmetric (before=2, after=2) window', () => {
    const result = slidingWindow(NODES, 4, 2, 2)
    expect(result.offset).toBe(2)
    expect(result.items).toEqual([
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs',
    ])
  })

  it('supports a single-cell window (before=0, after=0)', () => {
    const result = slidingWindow(NODES, 3, 0, 0)
    expect(result.offset).toBe(3)
    expect(result.items).toEqual(['cvc-words'])
  })

  it('supports a forward-only window (before=0, after=4)', () => {
    const result = slidingWindow(NODES, 0, 0, 4)
    expect(result.offset).toBe(0)
    expect(result.items).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
    ])
  })

  it('supports a backward-only window (before=4, after=0)', () => {
    const result = slidingWindow(NODES, 8, 4, 0)
    expect(result.offset).toBe(4)
    expect(result.items).toEqual([
      'cvc-words-short-o',
      'cvc-words-short-u',
      'digraphs',
      'sight-words',
      'simple-sentences',
    ])
  })
})

describe('slidingWindow — edge cases', () => {
  it('returns an empty result for an empty input array', () => {
    const result = slidingWindow([], 0, 1, 3)
    expect(result.items).toEqual([])
    expect(result.offset).toBe(0)
  })

  it('returns the full array when window is larger than the array', () => {
    const small = ['a', 'b', 'c'] as const
    const result = slidingWindow(small, 1, 1, 3)
    expect(result.offset).toBe(0)
    expect(result.items).toEqual(['a', 'b', 'c'])
  })

  it('throws on a non-integer focusIndex', () => {
    expect(() => slidingWindow(NODES, 1.5, 1, 3)).toThrow(TypeError)
  })

  it('throws on a negative `before`', () => {
    expect(() => slidingWindow(NODES, 4, -1, 3)).toThrow(TypeError)
  })

  it('throws on a negative `after`', () => {
    expect(() => slidingWindow(NODES, 4, 1, -1)).toThrow(TypeError)
  })

  it('throws when focusIndex is outside the array bounds', () => {
    expect(() => slidingWindow(NODES, -1, 1, 3)).toThrow(RangeError)
    expect(() => slidingWindow(NODES, NODES.length, 1, 3)).toThrow(RangeError)
  })
})

describe('slidingWindow — parity with Hub stages.ts shape', () => {
  // The Hub's `slidingWindow(stages, currentIndex, size = 5)` helper
  // computes `desiredOffset = currentIndex - 1`, which is equivalent
  // to the e2e helper's `(before=1, after=3)` shape when size=5.
  // This case imports the canonical Hub helper (rather than
  // re-implementing it inline) and asserts equivalence for every focus
  // index across the full word-song nodes list — a forward-compat
  // guard that catches drift on EITHER helper. Pre-PR-#183-review the
  // test inlined a copy of Hub's body, which only caught e2e-side
  // drift; the import above closes that asymmetry.
  it('produces identical output to the canonical Hub `slidingWindow` for every focus index in the word-song track', () => {
    for (let i = 0; i < NODES.length; i++) {
      const e2eResult = slidingWindow(NODES, i, 1, 3)
      const hubResult = hubSlidingWindow(NODES, i, 5)
      expect(e2eResult.offset).toBe(hubResult.offset)
      expect(e2eResult.items).toEqual(hubResult.items)
    }
  })
})
