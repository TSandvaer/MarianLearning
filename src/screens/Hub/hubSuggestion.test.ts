import { describe, expect, it } from 'vitest'
import {
  computeSuggestion,
  recordSuggestionOutcome,
  SUGGESTION_COOLDOWN_MS,
  SUGGESTION_OVERRIDE_CAP,
} from './hubSuggestion'
import type { SessionHistoryV2 } from '../SessionEnd/sessionHistory'
import { emptySessionHistory } from '../SessionEnd/sessionHistory'

/** Build a v2 history with overridable fields. */
function makeHistory(
  overrides: Partial<SessionHistoryV2> = {},
): SessionHistoryV2 {
  return { ...emptySessionHistory(), ...overrides }
}

describe('computeSuggestion', () => {
  const apr29Noon = new Date(2026, 3, 29, 12, 0)

  it('returns "word-song" by default when nothing has been touched yet', () => {
    expect(computeSuggestion(emptySessionHistory(), apr29Noon)).toBe(
      'word-song',
    )
  })

  it('alternates against the prior suggestion on a fresh day', () => {
    const wasWordSong = makeHistory({ lastSuggestion: 'word-song' })
    expect(computeSuggestion(wasWordSong, apr29Noon)).toBe('number-garden')

    const wasNumber = makeHistory({ lastSuggestion: 'number-garden' })
    expect(computeSuggestion(wasNumber, apr29Noon)).toBe('word-song')
  })

  it('suggests the OTHER tree when one was already touched today', () => {
    const touchedNumber = makeHistory({
      todayTreesTouched: { date: '2026-04-29', trees: ['number-garden'] },
    })
    expect(computeSuggestion(touchedNumber, apr29Noon)).toBe('word-song')

    const touchedWord = makeHistory({
      todayTreesTouched: { date: '2026-04-29', trees: ['word-song'] },
    })
    expect(computeSuggestion(touchedWord, apr29Noon)).toBe('number-garden')
  })

  it('returns null when both trees have been touched today', () => {
    const both = makeHistory({
      todayTreesTouched: {
        date: '2026-04-29',
        trees: ['number-garden', 'word-song'],
      },
    })
    expect(computeSuggestion(both, apr29Noon)).toBeNull()
  })

  it('treats stale todayTreesTouched as if nothing was touched today', () => {
    const yesterdayTouched = makeHistory({
      todayTreesTouched: {
        date: '2026-04-28',
        trees: ['number-garden', 'word-song'],
      },
      lastSuggestion: 'number-garden',
    })
    // Stale → falls into "first of day" branch → alternates from
    // lastSuggestion ('number-garden') → 'word-song'.
    expect(computeSuggestion(yesterdayTouched, apr29Noon)).toBe('word-song')
  })

  it('returns null while suggestionCooldownUntil is in the future', () => {
    const cooled = makeHistory({
      suggestionCooldownUntil: apr29Noon.getTime() + 60_000,
    })
    expect(computeSuggestion(cooled, apr29Noon)).toBeNull()
  })

  it('resumes suggesting once suggestionCooldownUntil has passed', () => {
    const expired = makeHistory({
      suggestionCooldownUntil: apr29Noon.getTime() - 60_000,
      lastSuggestion: 'word-song',
    })
    expect(computeSuggestion(expired, apr29Noon)).toBe('number-garden')
  })

  it('returns null even when one tree is touched today, if cooled down', () => {
    // Cool-down strictly suppresses the nudge regardless of touch state.
    // Both nodes are equal — no suggestion ring, no audio nudge.
    const cooledMid = makeHistory({
      suggestionCooldownUntil: apr29Noon.getTime() + 60_000,
      todayTreesTouched: { date: '2026-04-29', trees: ['number-garden'] },
    })
    expect(computeSuggestion(cooledMid, apr29Noon)).toBeNull()
  })
})

describe('recordSuggestionOutcome', () => {
  const apr29Noon = new Date(2026, 3, 29, 12, 0)

  describe('when the tap MATCHES the suggestion', () => {
    it('resets consecutiveOverrides to 0', () => {
      const prev = makeHistory({ consecutiveOverrides: 2 })
      const patch = recordSuggestionOutcome(
        prev,
        'word-song',
        'word-song',
        apr29Noon,
      )
      expect(patch.consecutiveOverrides).toBe(0)
      expect(patch.suggestionCooldownUntil).toBeNull()
      expect(patch.lastSuggestion).toBe('word-song')
    })

    it('clears any active cool-down', () => {
      const prev = makeHistory({
        suggestionCooldownUntil: apr29Noon.getTime() + 60_000,
        consecutiveOverrides: 1,
      })
      const patch = recordSuggestionOutcome(
        prev,
        'number-garden',
        'number-garden',
        apr29Noon,
      )
      expect(patch.suggestionCooldownUntil).toBeNull()
    })

    it('records the suggestion direction even when null (no override)', () => {
      const prev = makeHistory({ lastSuggestion: 'word-song' })
      // No suggestion (both trees touched, or in cool-down) → tap is a
      // free choice, not an override. lastSuggestion preserved.
      const patch = recordSuggestionOutcome(
        prev,
        null,
        'number-garden',
        apr29Noon,
      )
      expect(patch.consecutiveOverrides).toBe(0)
      expect(patch.lastSuggestion).toBe('word-song')
    })
  })

  describe('when the tap OVERRIDES the suggestion', () => {
    it('bumps consecutiveOverrides by 1 (under cap)', () => {
      const prev = makeHistory({ consecutiveOverrides: 0 })
      const patch = recordSuggestionOutcome(
        prev,
        'word-song',
        'number-garden',
        apr29Noon,
      )
      expect(patch.consecutiveOverrides).toBe(1)
      expect(patch.suggestionCooldownUntil).toBeNull()
      expect(patch.lastSuggestion).toBe('word-song')
    })

    it('continues bumping until the cap', () => {
      let history = makeHistory()

      // Override 1
      const p1 = recordSuggestionOutcome(
        history,
        'word-song',
        'number-garden',
        apr29Noon,
      )
      expect(p1.consecutiveOverrides).toBe(1)
      expect(p1.suggestionCooldownUntil).toBeNull()
      history = { ...history, ...p1 }

      // Override 2
      const p2 = recordSuggestionOutcome(
        history,
        'word-song',
        'number-garden',
        apr29Noon,
      )
      expect(p2.consecutiveOverrides).toBe(2)
      expect(p2.suggestionCooldownUntil).toBeNull()
      history = { ...history, ...p2 }

      // Override 3 — hits cap; cool-down armed; counter resets.
      const p3 = recordSuggestionOutcome(
        history,
        'word-song',
        'number-garden',
        apr29Noon,
      )
      expect(p3.consecutiveOverrides).toBe(0)
      expect(p3.suggestionCooldownUntil).toBe(
        apr29Noon.getTime() + SUGGESTION_COOLDOWN_MS,
      )
      expect(p3.lastSuggestion).toBe('word-song')
    })

    it('cap is exactly 3 (Thomas-locked)', () => {
      expect(SUGGESTION_OVERRIDE_CAP).toBe(3)
    })

    it('cool-down is exactly 2 days in milliseconds', () => {
      expect(SUGGESTION_COOLDOWN_MS).toBe(2 * 24 * 60 * 60 * 1000)
    })

    it('does not arm cool-down on a non-override after the counter is non-zero', () => {
      const prev = makeHistory({ consecutiveOverrides: 2 })
      // She finally takes the suggestion → counter resets, no cool-down.
      const patch = recordSuggestionOutcome(
        prev,
        'word-song',
        'word-song',
        apr29Noon,
      )
      expect(patch.consecutiveOverrides).toBe(0)
      expect(patch.suggestionCooldownUntil).toBeNull()
    })
  })

  describe('integration: cool-down lifecycle', () => {
    it('three overrides → suspended → expires after 2 days → resumes', () => {
      const day1 = new Date(2026, 3, 29, 9, 0)
      const day1b = new Date(2026, 3, 29, 14, 0)
      const day1c = new Date(2026, 3, 29, 18, 0)
      const oneHourLater = new Date(2026, 3, 29, 19, 0)
      const dayPlus2 = new Date(2026, 4, 1, 19, 0) // 2 days + 1h after day1c

      let history = makeHistory()

      // Three consecutive overrides on day 1
      history = {
        ...history,
        ...recordSuggestionOutcome(history, 'word-song', 'number-garden', day1),
      }
      history = {
        ...history,
        ...recordSuggestionOutcome(
          history,
          'word-song',
          'number-garden',
          day1b,
        ),
      }
      history = {
        ...history,
        ...recordSuggestionOutcome(
          history,
          'word-song',
          'number-garden',
          day1c,
        ),
      }

      // Cool-down armed
      expect(history.suggestionCooldownUntil).not.toBeNull()
      expect(computeSuggestion(history, oneHourLater)).toBeNull()

      // Two days later — cool-down expired; suggestions resume.
      // (lastSuggestion was 'word-song' so the alternation flips to
      // 'number-garden'.)
      expect(computeSuggestion(history, dayPlus2)).toBe('number-garden')
    })
  })
})
