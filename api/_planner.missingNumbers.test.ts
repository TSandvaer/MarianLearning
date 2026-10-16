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
import { problemFact } from '../packages/core/src/math/extendedProblems.js'
import { mathSessionPlanFromServer } from '../packages/core/src/math/planFromServer.js'
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

  it('a due fact keeps its order: its first addend is the part Emma names (Leitner keys are ordered, and the recorder reads the given part first)', () => {
    expect(block).toContain(
      '3+7 -> "Three and what make ten?", 7+3 -> "Seven and what make ten?"',
    )
    // The recorder's reading, which the directive must match.
    const fact = (read: string) => {
      const plan = mathSessionPlanFromServer(
        {
          id: 'x',
          label: 'x',
          utterances: [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) =>
            ['read', 'correct', 'reprompt', 'hint', 'giveAnswer'].map(
              (slot) => ({
                id: `math.p${n}.${slot}`,
                text:
                  slot !== 'read'
                    ? slot
                    : n === 4
                      ? read
                      : 'One plus two. How many?',
              }),
            ),
          ),
        },
        { extendedKinds: true },
      )
      return problemFact(plan.problems[3]!)
    }
    expect(fact('Three and what make ten?')).toEqual({ a: 3, b: 7, op: '+' })
    expect(fact('Seven and what make ten?')).toEqual({ a: 7, b: 3, op: '+' })
  })

  it('the missing bonds to ten satisfy rules 4 and 7, so the plain problems need no sums-to-10 fact', () => {
    expect(block).toContain(
      'The three missing-number bonds to ten SATISFY the HIGH-LEVERAGE COVERAGE RULE (rule 4) and rule 7\'s "never 0"',
    )
    expect(block).toContain(
      "rule 7's cap of 2 and the other category caps count the plain problems only",
    )
  })

  it('add-to-20 (always served from canon) has no missing-number block', () => {
    const add20 = MATH_TRACK_GUIDE.slice(
      MATH_TRACK_GUIDE.indexOf('- add-to-20:'),
      MATH_TRACK_GUIDE.indexOf('- sub-to-10:'),
    )
    expect(add20).not.toContain('MISSING-NUMBER PROBLEMS')
  })
})
