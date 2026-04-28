/**
 * Guard test: ensures gameplay constants match spec-locked values.
 *
 * These constants are the single source of truth for both Math and Word
 * Song. A drift here silently changes behavior in both screens. The test
 * makes accidental edits visible at CI time.
 */
import { describe, it, expect } from 'vitest'
import {
  HINT_AFTER_WRONG_COUNT,
  GUIDED_AFTER_WRONG_COUNT,
  ADVANCE_AFTER_CORRECT_MS,
  ADVANCE_HARD_CEILING_MS,
  WRONG_SHAKE_MS,
  HINT_DELAY_AFTER_WRONG_MS,
  STREAK_FADE_OUT_MS,
  FIRST_UTTERANCE_RETRY_MS,
  STREAK_BONUS_THRESHOLDS,
  CHIP_TAP_SPRING,
} from './gameplayConstants'

describe('gameplay constants (spec-locked values)', () => {
  it('wrong-answer escalation thresholds', () => {
    expect(HINT_AFTER_WRONG_COUNT).toBe(2)
    expect(GUIDED_AFTER_WRONG_COUNT).toBe(3)
  })

  it('timing constants', () => {
    expect(ADVANCE_AFTER_CORRECT_MS).toBe(1200)
    expect(ADVANCE_HARD_CEILING_MS).toBe(4000)
    expect(WRONG_SHAKE_MS).toBe(400)
    expect(HINT_DELAY_AFTER_WRONG_MS).toBe(600)
    expect(STREAK_FADE_OUT_MS).toBe(400)
    expect(FIRST_UTTERANCE_RETRY_MS).toBe(6000)
  })

  it('streak bonus thresholds are [3, 5, 8]', () => {
    expect([...STREAK_BONUS_THRESHOLDS]).toEqual([3, 5, 8])
  })

  it('chip tap spring preset', () => {
    expect(CHIP_TAP_SPRING).toEqual({
      type: 'spring',
      stiffness: 300,
      damping: 18,
    })
  })
})
