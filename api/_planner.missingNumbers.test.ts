/**
 * @vitest-environment node
 *
 * The planner's add-to-10 directive carries content wave 1's missing-number
 * rules (`design/native/content-wave-1.md` § 1.2–§ 1.3): of the two adding
 * steps only add-to-10 reaches the live planner (when Leitner or slow facts
 * are due), so its shape block gets the same three rules and the § 1.3
 * templates. The slots and the whole come from
 * `packages/core/src/wire/missingNumbers.ts`, not from literals.
 */
import { describe, expect, it } from 'vitest'
import { MISSING_NUMBER_SLOTS } from '../packages/core/src/wire/missingNumbers.js'
import { MATH_TRACK_GUIDE } from './_planner.js'

const block = MATH_TRACK_GUIDE.slice(
  MATH_TRACK_GUIDE.indexOf('- add-to-10:'),
  MATH_TRACK_GUIDE.indexOf('- add-to-20:'),
)

describe('add-to-10 directive: missing numbers (content wave 1)', () => {
  it('names the slots from the shared constant', () => {
    expect(MISSING_NUMBER_SLOTS).toEqual([4, 6, 8])
    expect(block).toContain(
      'problems P4, P6 and P8 are MISSING-NUMBER problems',
    )
    expect(block).toContain('The whole is ALWAYS 10 (bonds to ten)')
  })

  it('carries the § 1.3 line templates', () => {
    for (const line of [
      'read: "<A> and what make <T>?" e.g. "Seven and what make ten?"',
      'correct: "Yes! <A> and <B> make <T>!" e.g. "Yes! Seven and three make ten!"',
      'hint1: "Look at the flowers." (verbatim)',
      'hint2: "<A> flowers." e.g. "Seven flowers."',
      'hint3: "How many more make <T>?" e.g. "How many more make ten?"',
      'giveAnswer: "This one is <B>." e.g. "This one is three."',
    ]) {
      expect(block).toContain(line)
    }
  })

  it('no bond twice, in either shape or order; a due fact may take either shape', () => {
    expect(block).toContain('NO BOND TWICE <rule band="hard">')
    expect(block).toContain(
      '{7, 3} as "Seven plus three", "Three plus seven" or "Seven and what make ten?" counts once.',
    )
    expect(block).not.toContain('"2+3" and "3+2" are NOT duplicates')
    expect(block).toContain('A due Leitner fact may be written in either shape')
  })

  it('add-to-20 (always served from canon) has no missing-number block', () => {
    const add20 = MATH_TRACK_GUIDE.slice(
      MATH_TRACK_GUIDE.indexOf('- add-to-20:'),
      MATH_TRACK_GUIDE.indexOf('- sub-to-10:'),
    )
    expect(add20).not.toContain('MISSING-NUMBER PROBLEMS')
  })
})
