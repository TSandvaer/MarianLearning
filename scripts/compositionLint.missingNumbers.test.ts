/**
 * @vitest-environment node
 *
 * The composition lint's missing-number rules for add-to-10 and add-to-20
 * (content wave 1 `design/native/content-wave-1.md` § 1.2): missing numbers
 * sit at exactly P4, P6 and P8 when a session has any; their bonds keep to
 * the step's range (`packages/core/src/wire/missingNumbers.ts`); no bond
 * twice in one session, in either shape or order. The plain problems keep
 * every rule they had.
 */
import { describe, expect, it } from 'vitest'
import type { SessionStartResponse } from '../api/_types.js'
import {
  lintAddToTenComposition,
  lintAddToTwentyComposition,
  parseMissingNumberReadLine,
} from './compositionLint.ts'

function response(reads: readonly string[]): SessionStartResponse {
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test', label: 'test', utterances: [] },
    utterances: reads.map((text, i) => ({
      id: `math.p${i + 1}.read`,
      text,
      audio: { kind: 'inline', base64: 'AA==', mime: 'audio/mpeg' },
    })),
  }
}

/** § 1.8's suggested add-to-10 canon. */
const ADD_TO_10 = [
  'One plus two. How many?',
  'Two plus two. How many?',
  'Three plus two. How many?',
  'Seven and what make ten?',
  'Four plus four. How many?',
  'Six and what make ten?',
  'Four plus five. How many?',
  'Eight and what make ten?',
]

/** § 1.8's suggested add-to-20 canon. */
const ADD_TO_20 = [
  'Nine plus two. How many?',
  'Eight plus three. How many?',
  'Six plus six. How many?',
  'Nine and what make thirteen?',
  'Eight plus five. How many?',
  'Seven and what make twelve?',
  'Seven plus eight. How many?',
  'Six and what make eleven?',
]

const rules = (vs: { rule: string }[]) => vs.map((v) => v.rule)

describe('parseMissingNumberReadLine', () => {
  it('reads the given part, the whole and the missing part', () => {
    expect(parseMissingNumberReadLine('Seven and what make ten?')).toEqual({
      given: 7,
      total: 10,
      missing: 3,
    })
    expect(parseMissingNumberReadLine('Nine and what make thirteen?')).toEqual({
      given: 9,
      total: 13,
      missing: 4,
    })
    expect(parseMissingNumberReadLine('Seven plus three. How many?')).toBeNull()
  })
})

describe('add-to-10 with missing numbers', () => {
  it('§ 1.8 canon passes: the five plain problems keep their caps and bands; the three bonds to ten cover the make-10 rule', () => {
    expect(lintAddToTenComposition(response(ADD_TO_10))).toEqual([])
  })

  it('a missing number off P4 / P6 / P8 fires missing-number-slot', () => {
    const reads = [...ADD_TO_10]
    reads[4] = 'Five and what make ten?' // P5
    const vs = lintAddToTenComposition(response(reads))
    expect(vs.filter((v) => v.rule === 'missing-number-slot')).toHaveLength(1)
    expect(vs.find((v) => v.rule === 'missing-number-slot')!.problemIndex).toBe(
      5,
    )
  })

  it('a partial shape (only P4) fires missing-number-slot for P6 and P8', () => {
    const reads = [...ADD_TO_10]
    reads[5] = 'Two plus four. How many?'
    reads[7] = 'Five plus five. How many?'
    const vs = lintAddToTenComposition(response(reads)).filter(
      (v) => v.rule === 'missing-number-slot',
    )
    expect(vs.map((v) => v.problemIndex)).toEqual([6, 8])
  })

  it('an all-plain session needs no missing numbers (the legacy shape)', () => {
    const vs = lintAddToTenComposition(
      response([
        'Two plus one. How many?',
        'Two plus two. How many?',
        'Three plus two. How many?',
        'Four plus three. How many?',
        'Five plus three. How many?',
        'Four plus four. How many?',
        'Five plus four. How many?',
        'Five plus five. How many?',
      ]),
    )
    expect(rules(vs)).not.toContain('missing-number-slot')
  })

  it('a whole that is not ten fires missing-number-range', () => {
    const reads = [...ADD_TO_10]
    reads[3] = 'Six and what make nine?'
    expect(rules(lintAddToTenComposition(response(reads)))).toContain(
      'missing-number-range',
    )
  })

  it('a bond twice, in either shape or order, fires same-bond', () => {
    // Plain 3 + 7 at P7 and 7 + ? = 10 at P4: one bond.
    const reads = [...ADD_TO_10]
    reads[6] = 'Three plus seven. How many?'
    const same = lintAddToTenComposition(response(reads)).filter(
      (v) => v.rule === 'same-bond',
    )
    expect(same).toHaveLength(1)
    expect(same[0]!.message).toContain('P4, P7')
    // Two plain problems in both orders.
    const plain = [...ADD_TO_10]
    plain[0] = 'Two plus three. How many?'
    plain[2] = 'Three plus two. How many?'
    expect(rules(lintAddToTenComposition(response(plain)))).toContain(
      'same-bond',
    )
  })
})

describe('add-to-20 with missing numbers', () => {
  it('§ 1.8 canon passes', () => {
    expect(lintAddToTwentyComposition(response(ADD_TO_20))).toEqual([])
  })

  it('a given part below 6 or a missing part above 5 fires missing-number-range', () => {
    const reads = [...ADD_TO_20]
    reads[3] = 'Five and what make thirteen?' // A 5, part 8
    expect(rules(lintAddToTwentyComposition(response(reads)))).toContain(
      'missing-number-range',
    )
  })

  it('the same bond as a plain problem fires same-bond', () => {
    const reads = [...ADD_TO_20]
    reads[3] = 'Eight and what make thirteen?' // 8 + 5, as P5
    expect(rules(lintAddToTwentyComposition(response(reads)))).toContain(
      'same-bond',
    )
  })
})
