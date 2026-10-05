/**
 * nodeProgress — display model for a step. Every expectation that the
 * display agrees with the rule is checked against `applyMasteryRule`
 * itself, so a drift between the two fails here.
 */
import { describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import { applyMasteryRule } from './mastery'
import { nodeProgress } from './nodeProgress'
import type {
  LetterSoundsVowel,
  Progress,
  SessionHistoryEntry,
  SkillLevels,
  SkillNode,
  VowelSubMasteryState,
} from './types'

function levels(overrides: Partial<SkillLevels> = {}): SkillLevels {
  const base = defaultProgress().skillLevels
  const allLocked = Object.fromEntries(
    Object.keys(base).map((k) => [k, 'locked']),
  ) as SkillLevels
  return { ...allLocked, ...overrides }
}

function build(
  skillLevels: SkillLevels,
  history: SessionHistoryEntry[] = [],
  extra: Partial<Progress> = {},
): Progress {
  return { ...defaultProgress(), skillLevels, history, ...extra }
}

/** Day `d` of May 2026 at local noon, so calendar-day dedupe is TZ-proof. */
function day(d: number, hour = 12): string {
  return new Date(2026, 4, d, hour).toISOString()
}

function entry(
  d: number,
  node: SkillNode,
  successRate: number,
  more: Partial<SessionHistoryEntry> = {},
): SessionHistoryEntry {
  return { dateISO: day(d), skillFocus: [node], successRate, ...more }
}

describe('nodeProgress — basic fields', () => {
  it('locked step: 0 good days, no score, names what it unlocks', () => {
    const p = build(levels({ 'number-recog': 'practicing' }))
    expect(nodeProgress(p, 'add-to-10')).toEqual({
      level: 'locked',
      goodDays: 0,
      requiredDays: 3,
      lastSuccessRate: null,
      unlocksNext: 'add-to-20',
      awaitingNovelWordCheck: false,
    })
  })

  it('last step of each tree unlocks nothing', () => {
    const p = build(levels())
    expect(nodeProgress(p, 'mult-6-9').unlocksNext).toBeNull()
    expect(nodeProgress(p, 'simple-sentences').unlocksNext).toBeNull()
  })

  it('lastSuccessRate is the most recent session on THIS step only', () => {
    const p = build(levels({ 'add-to-10': 'practicing' }), [
      entry(1, 'add-to-10', 0.5),
      entry(2, 'add-to-10', 0.75),
      entry(3, 'letter-names', 1),
    ])
    expect(nodeProgress(p, 'add-to-10').lastSuccessRate).toBe(0.75)
  })

  it('mastered step reports all required days', () => {
    const p = build(levels({ 'add-to-10': 'mastered' }))
    const np = nodeProgress(p, 'add-to-10')
    expect([np.goodDays, np.requiredDays]).toEqual([3, 3])
  })
})

describe('nodeProgress — good days follow the rule (3 days at 7/8+, any order)', () => {
  it('counts good days', () => {
    const p = build(levels({ 'add-to-10': 'practicing' }), [
      entry(1, 'add-to-10', 1),
      entry(2, 'add-to-10', 1),
    ])
    expect(nodeProgress(p, 'add-to-10').goodDays).toBe(2)
  })

  it('a weak day does not reset the count; 7/8 counts as good', () => {
    const p = build(levels({ 'add-to-10': 'practicing' }), [
      entry(1, 'add-to-10', 1),
      entry(2, 'add-to-10', 0.5),
      entry(3, 'add-to-10', 0.875),
      entry(4, 'add-to-10', 0.75),
    ])
    expect(nodeProgress(p, 'add-to-10').goodDays).toBe(2)
  })

  it('reads the cumulative counter: banked days that aged out of history still count', () => {
    const p = build(
      levels({ 'add-to-10': 'practicing' }),
      [entry(3, 'add-to-10', 1)],
      { goodDays: { 'add-to-10': ['2026-04-01'] } },
    )
    expect(nodeProgress(p, 'add-to-10').goodDays).toBe(2)
  })

  it('two good sessions on one calendar day count once', () => {
    const p = build(levels({ 'add-to-10': 'practicing' }), [
      { ...entry(1, 'add-to-10', 1), dateISO: day(1, 9) },
      { ...entry(1, 'add-to-10', 1), dateISO: day(1, 18) },
    ])
    expect(nodeProgress(p, 'add-to-10').goodDays).toBe(1)
  })

  it('caps at requiredDays', () => {
    const p = build(levels({ 'add-to-10': 'practicing' }), [
      entry(1, 'add-to-10', 1),
      entry(2, 'add-to-10', 1),
      entry(3, 'add-to-10', 1),
      entry(4, 'add-to-10', 1),
      entry(5, 'add-to-10', 1),
    ])
    expect(nodeProgress(p, 'add-to-10').goodDays).toBe(3)
  })

  it('full good days ⇔ the rule promotes (display cannot drift)', () => {
    const fixtures: SessionHistoryEntry[][] = [
      [entry(1, 'add-to-10', 1), entry(2, 'add-to-10', 1)],
      [
        entry(1, 'add-to-10', 1),
        entry(2, 'add-to-10', 1),
        entry(3, 'add-to-10', 1),
      ],
      [
        entry(1, 'add-to-10', 1),
        entry(2, 'add-to-10', 0.9),
        entry(3, 'add-to-10', 1),
      ],
      [
        entry(1, 'add-to-10', 0.5),
        entry(2, 'add-to-10', 1),
        entry(3, 'add-to-10', 1),
        entry(4, 'add-to-10', 1),
      ],
      [
        entry(1, 'add-to-10', 1),
        entry(2, 'add-to-10', 0.5),
        entry(3, 'add-to-10', 0.875),
        entry(4, 'add-to-10', 0.25),
      ],
      [
        entry(1, 'add-to-10', 0.875),
        entry(2, 'add-to-10', 0.5),
        entry(3, 'add-to-10', 0.875),
        entry(4, 'add-to-10', 0.25),
        entry(5, 'add-to-10', 0.875),
      ],
    ]
    const outcomes = fixtures.map((history) => {
      const p = build(levels({ 'add-to-10': 'practicing' }), history)
      const np = nodeProgress(p, 'add-to-10')
      const promoted =
        applyMasteryRule(p).skillLevels['add-to-10'] === 'mastered'
      expect(np.goodDays === np.requiredDays).toBe(promoted)
      return promoted
    })
    expect(outcomes).toEqual([false, true, true, true, false, true])
  })
})

describe('nodeProgress — cvc-words novel-pool gate', () => {
  const threeCanonicalDays = [
    entry(1, 'cvc-words', 1),
    entry(2, 'cvc-words', 1),
    entry(3, 'cvc-words', 1),
  ]

  it('days banked but no novel-word check yet → awaiting, rule does not promote', () => {
    const p = build(levels({ 'cvc-words': 'practicing' }), threeCanonicalDays)
    const np = nodeProgress(p, 'cvc-words')
    expect([np.goodDays, np.requiredDays, np.awaitingNovelWordCheck]).toEqual([
      3,
      3,
      true,
    ])
    expect(applyMasteryRule(p).skillLevels['cvc-words']).toBe('practicing')
  })

  it('novel-word check failed (<0.8) → still awaiting', () => {
    const p = build(levels({ 'cvc-words': 'practicing' }), [
      ...threeCanonicalDays,
      entry(4, 'cvc-words', 1, { novelPoolSuccessRate: 0.5 }),
    ])
    expect(nodeProgress(p, 'cvc-words').awaitingNovelWordCheck).toBe(true)
    expect(applyMasteryRule(p).skillLevels['cvc-words']).toBe('practicing')
  })

  it('novel-word check cleared → not awaiting, rule promotes', () => {
    const p = build(levels({ 'cvc-words': 'practicing' }), [
      ...threeCanonicalDays,
      entry(4, 'cvc-words', 1, { novelPoolSuccessRate: 1 }),
    ])
    expect(nodeProgress(p, 'cvc-words').awaitingNovelWordCheck).toBe(false)
    expect(applyMasteryRule(p).skillLevels['cvc-words']).toBe('mastered')
  })

  it('days not yet banked → not awaiting', () => {
    const p = build(
      levels({ 'cvc-words': 'practicing' }),
      threeCanonicalDays.slice(0, 2),
    )
    const np = nodeProgress(p, 'cvc-words')
    expect([np.goodDays, np.awaitingNovelWordCheck]).toEqual([2, false])
  })

  it('a non-gated step is never awaiting', () => {
    const p = build(levels({ 'cvc-words-short-o': 'practicing' }), [
      entry(1, 'cvc-words-short-o', 1),
      entry(2, 'cvc-words-short-o', 1),
      entry(3, 'cvc-words-short-o', 1),
    ])
    expect(nodeProgress(p, 'cvc-words-short-o').awaitingNovelWordCheck).toBe(
      false,
    )
  })
})

describe('nodeProgress — letter-sounds per-vowel sub-states', () => {
  function vowelStates(
    s: Partial<Record<LetterSoundsVowel, VowelSubMasteryState>>,
  ): Record<LetterSoundsVowel, VowelSubMasteryState> {
    return {
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
      ...s,
    }
  }
  function withVowels(
    states: Record<LetterSoundsVowel, VowelSubMasteryState>,
    history: SessionHistoryEntry[],
  ): Progress {
    const base = defaultProgress()
    return build(levels({ 'letter-sounds': 'practicing' }), history, {
      literacy: { ...base.literacy, letterSoundsVowelStates: states },
    })
  }

  it('active tracking: four vowel sub-steps with their own good days', () => {
    const p = withVowels(
      vowelStates({ '/o/': 'mastered', '/u/': 'practicing' }),
      [
        entry(1, 'letter-sounds', 1, { currentTargetVowel: '/o/' }),
        entry(2, 'letter-sounds', 1, { currentTargetVowel: '/u/' }),
        entry(3, 'letter-sounds', 1, { currentTargetVowel: '/u/' }),
      ],
    )
    const np = nodeProgress(p, 'letter-sounds')
    expect(np.vowels).toHaveLength(4)
    expect(np.vowels!.map((v) => [v.vowel, v.state, v.goodDays])).toEqual([
      ['/o/', 'mastered', 3],
      ['/u/', 'practicing', 2],
      ['/i/', 'intro', 0],
      ['/e/', 'intro', 0],
    ])
    expect([np.goodDays, np.requiredDays]).toEqual([5, 12])
    expect(np.lastSuccessRate).toBe(1)
  })

  it('a /o/-tagged day never counts toward /u/', () => {
    const p = withVowels(
      vowelStates({ '/o/': 'practicing', '/u/': 'practicing' }),
      [
        entry(1, 'letter-sounds', 1, { currentTargetVowel: '/o/' }),
        entry(2, 'letter-sounds', 1, { currentTargetVowel: '/o/' }),
      ],
    )
    const v = nodeProgress(p, 'letter-sounds').vowels!
    expect(v.map((x) => x.goodDays)).toEqual([2, 0, 0, 0])
  })

  it('per-vowel promotion lines up with the rule', () => {
    const p = withVowels(vowelStates({ '/o/': 'practicing' }), [
      entry(1, 'letter-sounds', 1, { currentTargetVowel: '/o/' }),
      entry(2, 'letter-sounds', 1, { currentTargetVowel: '/o/' }),
      entry(3, 'letter-sounds', 1, { currentTargetVowel: '/o/' }),
    ])
    expect(nodeProgress(p, 'letter-sounds').vowels![0]!.goodDays).toBe(3)
    expect(applyMasteryRule(p).literacy!.letterSoundsVowelStates!['/o/']).toBe(
      'mastered',
    )
  })

  it('inactive (no vowel-tagged session yet): composite only, no vowels field', () => {
    const p = withVowels(vowelStates({}), [entry(1, 'letter-sounds', 1)])
    const np = nodeProgress(p, 'letter-sounds')
    expect(np.vowels).toBeUndefined()
    expect([np.goodDays, np.requiredDays]).toEqual([1, 3])
  })
})
