import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeApplyDebugSeed, readDebugSeedParam } from './debugSeed'
import {
  STORAGE_KEY as PROGRESS_KEY,
  loadProgress,
  pickFocusNode,
} from '../progress'
import {
  SESSION_HISTORY_KEY,
  readSessionHistory,
} from '../../screens/SessionEnd/sessionHistory'

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, search },
  })
}

describe('readDebugSeedParam', () => {
  beforeEach(() => {
    setSearch('')
    window.localStorage.clear()
  })

  it('returns null when ?debug=1 is absent', () => {
    setSearch('?seed=cvc-words')
    expect(readDebugSeedParam()).toBeNull()
  })

  it('returns null when ?debug=1 is present but ?seed= is absent', () => {
    setSearch('?debug=1')
    expect(readDebugSeedParam()).toBeNull()
  })

  it('returns the seed value when both ?debug=1 and ?seed= are present', () => {
    setSearch('?debug=1&seed=cvc-words')
    expect(readDebugSeedParam()).toBe('cvc-words')
  })

  it('returns the seed value regardless of param order', () => {
    setSearch('?seed=cvc-words&debug=1')
    expect(readDebugSeedParam()).toBe('cvc-words')
  })
})

describe('maybeApplyDebugSeed', () => {
  beforeEach(() => {
    setSearch('')
    window.localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is a no-op when ?debug=1 is absent', () => {
    setSearch('?seed=cvc-words')
    maybeApplyDebugSeed()
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull()
    expect(window.localStorage.getItem(SESSION_HISTORY_KEY)).toBeNull()
  })

  it('is a no-op when ?seed= is absent', () => {
    setSearch('?debug=1')
    maybeApplyDebugSeed()
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull()
    expect(window.localStorage.getItem(SESSION_HISTORY_KEY)).toBeNull()
  })

  it('warns and no-ops on an unrecognized seed value', () => {
    setSearch('?debug=1&seed=banana')
    maybeApplyDebugSeed()
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown seed value: "banana"'),
    )
  })

  describe('cvc-words seed', () => {
    beforeEach(() => {
      setSearch('?debug=1&seed=cvc-words')
    })

    it('writes blending-cv: mastered + cvc-words: practicing into progress', () => {
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.skillLevels['blending-cv']).toBe('mastered')
      expect(progress?.skillLevels['cvc-words']).toBe('practicing')
    })

    it('round-trip integration: maybeApplyDebugSeed → pickFocusNode("word-song") → "cvc-words"', () => {
      // The acceptance criterion the orchestrator's 2026-05-02 partial
      // fix did not cover: the seed must mark every preceding word-song
      // node as mastered, otherwise pickFocusNode walks the tree and
      // stops at the first non-mastered earlier node ("letter-sounds"
      // by default). loadProgress() must also accept the persisted blob
      // (a partial blob fails isProgressV1 → null → undefined hint to
      // the planner → server falls back to the track default
      // "blending-cv", not "cvc-words").
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(pickFocusNode(progress!, 'word-song')).toBe('cvc-words')
    })

    it('preserves any pre-existing skillLevels not in the patch', () => {
      // Apply once to land a fully-shaped Progress blob, then
      // hand-mutate a math node and re-apply. The patch only touches
      // word-song nodes, so the math mutation must round-trip.
      maybeApplyDebugSeed()
      const seeded = loadProgress()
      expect(seeded).not.toBeNull()
      const mutated = {
        ...seeded!,
        skillLevels: {
          ...seeded!.skillLevels,
          'add-to-20': 'mastered' as const,
        },
      }
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(mutated))
      maybeApplyDebugSeed()
      const after = loadProgress()
      expect(after?.skillLevels['add-to-20']).toBe('mastered')
      expect(after?.skillLevels['blending-cv']).toBe('mastered')
      expect(after?.skillLevels['cvc-words']).toBe('practicing')
    })

    it('round-trip integration: maybeApplyDebugSeed → readSessionHistory().sessionCount === 1', () => {
      // This is the regression test for the bug Thomas caught on iPad
      // 2026-05-02. The original seeder wrote {version, sessions} and
      // the canonical readSessionHistory() — which validates strictly
      // against the SessionHistoryV2 shape — fell back to
      // emptySessionHistory() with sessionCount: 0. Splash then routed
      // to Greet instead of Hub. This test exercises the full
      // seeder → reader round-trip; if either side drifts in shape, it
      // fails.
      maybeApplyDebugSeed()
      const history = readSessionHistory()
      expect(history.sessionCount).toBe(1)
      expect(history.schemaVersion).toBe(2)
      // Non-empty timestamp: we wrote new Date().toISOString().
      expect(history.lastSessionCompletedAt).not.toBe('')
    })

    it('is idempotent on session-history — second call does not displace existing seeded state', () => {
      maybeApplyDebugSeed()
      const after1 = window.localStorage.getItem(SESSION_HISTORY_KEY)
      maybeApplyDebugSeed()
      const after2 = window.localStorage.getItem(SESSION_HISTORY_KEY)
      // Same blob — second call's readSessionHistory() returns
      // sessionCount: 1 from the first call, and bumpSessionCountIfZero
      // short-circuits.
      expect(after2).toBe(after1)
    })

    it('does not displace a real session-history that already has sessionCount > 0', () => {
      // Real-ish v2 history that a returning user would have.
      const realHistory = {
        schemaVersion: 2,
        sessionCount: 5,
        lastSessionCompletedAt: '2026-05-01T10:00:00.000Z',
        longestStreakEver: 12,
        cumulativeStardust: 47,
        lastSessionStardust: 9,
        dayStreak: 3,
        todayTreesTouched: { date: '2026-05-01', trees: ['number-garden'] },
        lastSuggestion: null,
        consecutiveOverrides: 0,
        suggestionCooldownUntil: null,
      }
      window.localStorage.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify(realHistory),
      )
      maybeApplyDebugSeed()
      const after = readSessionHistory()
      // Real session count + all real fields preserved verbatim.
      expect(after.sessionCount).toBe(5)
      expect(after.cumulativeStardust).toBe(47)
      expect(after.longestStreakEver).toBe(12)
      expect(after.lastSessionCompletedAt).toBe('2026-05-01T10:00:00.000Z')
    })
  })

  describe('letter-names seed (ticket 86c9y6g6n)', () => {
    beforeEach(() => {
      setSearch('?debug=1&seed=letter-names')
    })

    it('writes letter-names: practicing into progress', () => {
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.skillLevels['letter-names']).toBe('practicing')
    })

    it('round-trip integration: maybeApplyDebugSeed → pickFocusNode("word-song") → "letter-names"', () => {
      // letter-names is the FIRST node in WORD_SONG_NODES_IN_ORDER, so
      // no preceding-node mastery patch is needed — the picker walks
      // the tree and lands on letter-names immediately because it's
      // 'practicing' (i.e. non-mastered). This is the load-bearing AC:
      // without this seed, the natural fresh-launch path can never
      // reach letter-names (defaults.ts ships it as 'mastered' per
      // Marian's diagnostic) and pickFocusNode routes past it.
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(pickFocusNode(progress!, 'word-song')).toBe('letter-names')
    })

    it('bumps session-history sessionCount to 1 (skips Greet on next mount)', () => {
      maybeApplyDebugSeed()
      const history = readSessionHistory()
      expect(history.sessionCount).toBe(1)
      expect(history.schemaVersion).toBe(2)
    })

    it('is idempotent on progress — second call does not change skillLevels', () => {
      maybeApplyDebugSeed()
      const after1 = window.localStorage.getItem(PROGRESS_KEY)
      maybeApplyDebugSeed()
      const after2 = window.localStorage.getItem(PROGRESS_KEY)
      expect(after2).toBe(after1)
    })
  })

  describe('letter-sounds seed (British-voice rollout in-app smoke)', () => {
    beforeEach(() => {
      setSearch('?debug=1&seed=letter-sounds')
    })

    it('writes letter-names: mastered + letter-sounds: practicing into progress', () => {
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.skillLevels['letter-names']).toBe('mastered')
      expect(progress?.skillLevels['letter-sounds']).toBe('practicing')
    })

    it('round-trip integration: maybeApplyDebugSeed → pickFocusNode("word-song") → "letter-sounds"', () => {
      // letter-sounds is the SECOND node in WORD_SONG_NODES_IN_ORDER.
      // With the root letter-names marked 'mastered', the picker walks
      // past it and lands on letter-sounds (the first non-mastered node).
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(pickFocusNode(progress!, 'word-song')).toBe('letter-sounds')
    })

    it('bumps session-history sessionCount to 1 (skips Greet on next mount)', () => {
      maybeApplyDebugSeed()
      const history = readSessionHistory()
      expect(history.sessionCount).toBe(1)
      expect(history.schemaVersion).toBe(2)
    })

    it('is idempotent on progress — second call does not change skillLevels', () => {
      maybeApplyDebugSeed()
      const after1 = window.localStorage.getItem(PROGRESS_KEY)
      maybeApplyDebugSeed()
      const after2 = window.localStorage.getItem(PROGRESS_KEY)
      expect(after2).toBe(after1)
    })
  })

  describe('cvc-words-short-o seed', () => {
    beforeEach(() => {
      setSearch('?debug=1&seed=cvc-words-short-o')
    })

    it('writes cvc-words: mastered + cvc-words-short-o: practicing into progress', () => {
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.skillLevels['cvc-words']).toBe('mastered')
      expect(progress?.skillLevels['cvc-words-short-o']).toBe('practicing')
    })

    it('round-trip integration: maybeApplyDebugSeed → pickFocusNode("word-song") → "cvc-words-short-o"', () => {
      // Every preceding word-song node (letter-names, letter-sounds,
      // blending-cv, cvc-words) must be marked mastered so the picker
      // walks past them and lands on the short-o sibling. Mirrors the
      // cvc-words round-trip test above.
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(pickFocusNode(progress!, 'word-song')).toBe('cvc-words-short-o')
    })

    it('bumps session-history sessionCount to 1 (skips Greet on next mount)', () => {
      maybeApplyDebugSeed()
      const history = readSessionHistory()
      expect(history.sessionCount).toBe(1)
      expect(history.schemaVersion).toBe(2)
    })
  })

  describe('add-to-20 seed (ticket 86c9q5q13)', () => {
    beforeEach(() => {
      setSearch('?debug=1&seed=add-to-20')
    })

    it('writes add-to-10: mastered + add-to-20: practicing into progress', () => {
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.skillLevels['number-recog']).toBe('mastered')
      expect(progress?.skillLevels['add-to-10']).toBe('mastered')
      expect(progress?.skillLevels['add-to-20']).toBe('practicing')
    })

    it('round-trip integration: maybeApplyDebugSeed → pickFocusNode("math") → "add-to-20"', () => {
      // pickFocusNode walks MATH_NODES_IN_ORDER and stops at the first
      // non-mastered node. With number-recog + add-to-10 mastered and
      // add-to-20 set to practicing, the picker must land on add-to-20.
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(pickFocusNode(progress!, 'math')).toBe('add-to-20')
    })

    it('leaves mathFactsLeitner empty (per AC #6 — fresh box for the new tier)', () => {
      // The seed only patches skillLevels; the canonical defaultProgress()
      // initialiser sets mathFactsLeitner to emptyLeitner(). Together
      // these mean the seed lands a Progress where the box is empty —
      // the canon path is hit on the first session-start fetch, no
      // Leitner directive is injected (active scope is add-to-10 only
      // anyway).
      maybeApplyDebugSeed()
      const progress = loadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.mathFactsLeitner.items).toEqual([])
    })

    it('bumps session-history sessionCount to 1 (skips Greet on next mount)', () => {
      maybeApplyDebugSeed()
      const history = readSessionHistory()
      expect(history.sessionCount).toBe(1)
      expect(history.schemaVersion).toBe(2)
    })

    it('is idempotent on progress — second call does not change skillLevels', () => {
      maybeApplyDebugSeed()
      const after1 = window.localStorage.getItem(PROGRESS_KEY)
      maybeApplyDebugSeed()
      const after2 = window.localStorage.getItem(PROGRESS_KEY)
      expect(after2).toBe(after1)
    })

    it('does not displace a real returning-user state (sessionCount > 0)', () => {
      // Same defensive check as the cvc-words seed: a debug URL loaded
      // on a real iPad must not overwrite real Marian state.
      const realHistory = {
        schemaVersion: 2,
        sessionCount: 12,
        lastSessionCompletedAt: '2026-05-08T10:00:00.000Z',
        longestStreakEver: 8,
        cumulativeStardust: 95,
        lastSessionStardust: 7,
        dayStreak: 6,
        todayTreesTouched: { date: '2026-05-08', trees: ['number-garden'] },
        lastSuggestion: null,
        consecutiveOverrides: 0,
        suggestionCooldownUntil: null,
      }
      window.localStorage.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify(realHistory),
      )
      maybeApplyDebugSeed()
      const after = readSessionHistory()
      expect(after.sessionCount).toBe(12)
      expect(after.cumulativeStardust).toBe(95)
    })
  })
})
