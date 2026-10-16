/**
 * @vitest-environment node
 *
 * Drift test for core's `CANON_MATH_FACTS` (native spec
 * `design/native/review-mode-and-warmup-native.md` § 7.1, AC 7): the
 * committed table must equal what `scripts/generateCanonMathFacts.ts`
 * derives from `public/canon/math/level-1/*.json` today. A math canon
 * re-bake without a re-run of the script fails here, not as a mis-picked
 * review block on a device.
 */
import { describe, expect, it } from 'vitest'
import { CANON_MATH_FACTS } from '@marian/core/progress/canonMathFacts.generated'
import { MATH_TREE } from '@marian/core/progress/mastery'
import { deriveCanonMathFacts } from './generateCanonMathFacts'

describe('CANON_MATH_FACTS (generated from the math canon)', () => {
  const derived = deriveCanonMathFacts()

  it('matches the committed canon, step by step and problem by problem', () => {
    expect(CANON_MATH_FACTS).toEqual(derived)
  })

  it('has 8 entries for every Number Garden step, in tree order', () => {
    expect(Object.keys(CANON_MATH_FACTS)).toEqual([...MATH_TREE])
    for (const node of MATH_TREE) {
      expect(CANON_MATH_FACTS[node]).toHaveLength(8)
    }
  })

  it('reads the canon blocks the spec examples name', () => {
    // add-to-10 #3 is 3+2; #4 is the missing number 7 + ? = 10, which
    // records the bond 7+3 (content wave 1 AC 3, K4).
    expect(CANON_MATH_FACTS['add-to-10'][2]).toEqual({ a: 3, b: 2, op: '+' })
    expect(CANON_MATH_FACTS['add-to-10'][3]).toEqual({ a: 7, b: 3, op: '+' })
    // Number recognition and skip counting are not a/b facts.
    expect(CANON_MATH_FACTS['number-recog']).toEqual(Array(8).fill(null))
    expect(CANON_MATH_FACTS['skip-counting'].every((f) => f === null)).toBe(
      true,
    )
    // Multiplication keeps its order (2*3 is not 3*2).
    expect(
      CANON_MATH_FACTS['mult-2-5-10'].every((f) => f !== null && f.op === '*'),
    ).toBe(true)
  })
})
