/**
 * Hub suggestion (Guidance G1, 123jpnbca4r): the world that can still
 * earn today's flower, closest to its unlock first; null when both have
 * today's flower. The rule itself is unit-tested in hubGuidance.test.ts;
 * this covers the history adapter.
 */
import { describe, expect, it } from 'vitest'
import { computeSuggestion, recordSuggestionOutcome } from './hubSuggestion'
import {
  defaultProgress,
  type Progress,
  type SessionHistoryEntry,
  type SkillNode,
} from '@marian/core/progress'
import {
  emptySessionHistory,
  type SessionHistoryV2,
} from '@marian/core/sessionEnd/sessionHistory'

function makeHistory(
  overrides: Partial<SessionHistoryV2> = {},
): SessionHistoryV2 {
  return { ...emptySessionHistory(), ...overrides }
}

/** Day `d` of May 2026 at local noon. */
function entry(d: number, node: SkillNode, rate = 1): SessionHistoryEntry {
  return {
    dateISO: new Date(2026, 4, d, 12).toISOString(),
    skillFocus: [node],
    successRate: rate,
  }
}

/** Every step locked except the first of each tree (intro), so the
 *  current steps are number-recog and letter-names. */
function withHistory(history: SessionHistoryEntry[] = []): Progress {
  const p = defaultProgress()
  const allLocked = Object.fromEntries(
    Object.keys(p.skillLevels).map((k) => [k, 'locked']),
  ) as Progress['skillLevels']
  return {
    ...p,
    skillLevels: {
      ...allLocked,
      'number-recog': 'intro',
      'letter-names': 'intro',
    },
    history,
  }
}

const may5 = new Date(2026, 4, 5, 15, 0)

describe('computeSuggestion', () => {
  it('fresh progress (a tie): Word Song by default, then alternates from lastSuggestion', () => {
    const p = withHistory()
    expect(computeSuggestion(makeHistory(), may5, p)).toBe('word-song')
    expect(
      computeSuggestion(makeHistory({ lastSuggestion: 'word-song' }), may5, p),
    ).toBe('number-garden')
    expect(
      computeSuggestion(
        makeHistory({ lastSuggestion: 'number-garden' }),
        may5,
        p,
      ),
    ).toBe('word-song')
  })

  it('the world closer to its unlock wins over the alternation', () => {
    const p = withHistory([entry(1, 'number-recog')])
    expect(
      computeSuggestion(
        makeHistory({ lastSuggestion: 'number-garden' }),
        may5,
        p,
      ),
    ).toBe('number-garden')
  })

  it("a world that already has today's flower is not suggested", () => {
    const p = withHistory([entry(5, 'number-recog')])
    expect(computeSuggestion(makeHistory(), may5, p)).toBe('word-song')
  })

  it("null when both worlds have today's flower", () => {
    const p = withHistory([entry(5, 'number-recog'), entry(5, 'letter-names')])
    expect(computeSuggestion(makeHistory(), may5, p)).toBeNull()
  })

  it('ignores the retired override cool-down', () => {
    const p = withHistory([entry(1, 'number-recog')])
    const coolingDown = makeHistory({
      suggestionCooldownUntil: may5.getTime() + 60_000,
    })
    expect(computeSuggestion(coolingDown, may5, p)).toBe('number-garden')
  })
})

describe('recordSuggestionOutcome', () => {
  it('records the suggestion she was shown and clears the override counters', () => {
    const prev = makeHistory({
      consecutiveOverrides: 2,
      suggestionCooldownUntil: 123,
      lastSuggestion: 'word-song',
    })
    expect(recordSuggestionOutcome(prev, 'number-garden')).toEqual({
      lastSuggestion: 'number-garden',
      consecutiveOverrides: 0,
      suggestionCooldownUntil: null,
    })
  })

  it('keeps the previous lastSuggestion when nothing was suggested', () => {
    const prev = makeHistory({ lastSuggestion: 'word-song' })
    expect(recordSuggestionOutcome(prev, null).lastSuggestion).toBe('word-song')
  })
})
