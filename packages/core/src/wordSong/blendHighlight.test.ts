/**
 * Unit tests for the CVC phoneme-blend prompt letter-highlight token map
 * (ticket 86c9qa6n3). Pure-function coverage — the tokenizer-robustness is
 * the whole point, so we exercise the ASCII-7 stored form, Kyle's em-dash
 * spec form, and the `/ks/` (box/fox) grapheme-count edge.
 */

import { describe, expect, it } from 'vitest'

import { buildBlendHighlightSteps } from './blendHighlight'

describe('buildBlendHighlightSteps (ticket 86c9qa6n3)', () => {
  it('maps the ASCII-7 stored form "c - a - t ... cat" to per-letter then whole-word', () => {
    // Raw tokens: ["c","-","a","-","t","...","cat"] (indices 0..6).
    // Graphemes c/a/t → letter indices 0/1/2; whole word → index 3.
    const steps = buildBlendHighlightSteps('c - a - t ... cat', 'cat')
    expect(steps).toEqual([0, undefined, 1, undefined, 2, undefined, 3])
  })

  it('maps Kyle’s em-dash/ellipsis spec form "c — a — t … cat" identically', () => {
    // Defensive: the synth + highlight accept the unicode form too, even
    // though the lint-clean ASCII form is the one to bake.
    const steps = buildBlendHighlightSteps('c — a — t … cat', 'cat')
    expect(steps).toEqual([0, undefined, 1, undefined, 2, undefined, 3])
  })

  it('handles the /ks/ grapheme (box) — 3 graphemes, whole-word beat at 3', () => {
    // "b - o - x ... box": graphemes b/o/x → 0/1/2; whole word → 3 (=
    // word.length, even though `x` is the /ks/ cluster — token count is
    // word.length + 1 = 4 per Kyle's spec caveat).
    const steps = buildBlendHighlightSteps('b - o - x ... box', 'box')
    expect(steps).toEqual([0, undefined, 1, undefined, 2, undefined, 3])
  })

  it('the whole-word beat index equals word.length for every CVC word', () => {
    // The render uses `blendActiveLetterIndex === word.length` to pulse ALL
    // letters; pin that the last step is exactly word.length.
    for (const [text, word] of [
      ['c - a - t ... cat', 'cat'],
      ['d - o - g ... dog', 'dog'],
      ['f - o - x ... fox', 'fox'],
    ] as const) {
      const steps = buildBlendHighlightSteps(text, word)
      expect(steps[steps.length - 1]).toBe(word.length)
    }
  })

  it('separator tokens never highlight a letter (undefined)', () => {
    const steps = buildBlendHighlightSteps('m - o - p ... mop', 'mop')
    // Indices 1, 3, 5 are the separators.
    expect(steps[1]).toBeUndefined()
    expect(steps[3]).toBeUndefined()
    expect(steps[5]).toBeUndefined()
  })

  it('per-letter indices walk 0→1→2 in order (the AC: highlight sequences)', () => {
    const steps = buildBlendHighlightSteps('h - a - t ... hat', 'hat')
    const letterSteps = steps.filter(
      (s): s is number => s !== undefined && s < 'hat'.length,
    )
    expect(letterSteps).toEqual([0, 1, 2])
  })

  it('clamps a grapheme index that would exceed the letter count (defensive)', () => {
    // A malformed blend with MORE grapheme tokens than letters must never
    // produce an out-of-range letter index — clamp to word.length - 1.
    const steps = buildBlendHighlightSteps('c - a - t - x ... cat', 'cat')
    const max = Math.max(...steps.filter((s): s is number => s !== undefined))
    // Whole-word beat is word.length (3); no per-letter index exceeds 2.
    const letterSteps = steps.filter(
      (s): s is number => s !== undefined && s !== 'cat'.length,
    )
    expect(Math.max(...letterSteps)).toBeLessThanOrEqual('cat'.length - 1)
    expect(max).toBe('cat'.length)
  })
})
