import { describe, expect, it } from 'vitest'
import {
  HUB_LINES,
  HUB_LINE_WORD_COUNTS,
  pickHubGreeting,
  pseudoRandom,
  isLastSessionRecent,
  shouldShowDayStreak,
} from './hubLines'
import type { HubLineId } from './hubLines'

describe('HUB_LINES manifest', () => {
  it("has exactly 18 entries (9 anchor + 7 rotation + 2 enter — first-ever / pick-again / pick-next anchors don't rotate)", () => {
    // Spec says 20 MP3s; 7 rotation per the variants table + 11 anchor lines = 18 distinct ids.
    // (Three 'first-ever' / 'session-end' / 'mid-skill-back' anchors have no rotation pool.)
    expect(Object.keys(HUB_LINES)).toHaveLength(18)
  })

  it('every line has a unique src URL', () => {
    const srcs = Object.values(HUB_LINES).map((e) => e.src)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  it('every line src lives under /assets/audio/hub/', () => {
    for (const entry of Object.values(HUB_LINES)) {
      expect(entry.src.startsWith('/assets/audio/hub/')).toBe(true)
      expect(entry.src.endsWith('.mp3')).toBe(true)
    }
  })

  it('caption text never contains "Melody" — Phase 3b character pivot', () => {
    for (const entry of Object.values(HUB_LINES)) {
      expect(entry.text).not.toMatch(/melody/i)
    }
  })

  it('word-count map matches the actual line text', () => {
    for (const id of Object.keys(HUB_LINES) as HubLineId[]) {
      const expected = HUB_LINES[id].text.split(/\s+/).filter(Boolean).length
      expect(HUB_LINE_WORD_COUNTS[id]).toBe(expected)
    }
  })
})

describe('pseudoRandom', () => {
  it('is deterministic for the same seed', () => {
    expect(pseudoRandom(0)).toBe(pseudoRandom(0))
    expect(pseudoRandom(42)).toBe(pseudoRandom(42))
  })

  it('returns values in [0, 1)', () => {
    for (const seed of [0, 1, 2, 5, 17, 99, 1234]) {
      const r = pseudoRandom(seed)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })

  it('different seeds produce different values across a small range', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 50; i++) seen.add(pseudoRandom(i))
    // Allow a handful of collisions but the distribution should spread.
    expect(seen.size).toBeGreaterThan(45)
  })
})

describe('pickHubGreeting', () => {
  it('returns null lineId when suppressed', () => {
    const choice = pickHubGreeting({
      path: 'app-open',
      suggestion: null,
      seed: 0,
      suppressed: true,
    })
    expect(choice.lineId).toBeNull()
  })

  it('first-ever path is anchor-only ("Hi again!")', () => {
    for (const seed of [0, 1, 99, 12345]) {
      const choice = pickHubGreeting({
        path: 'first-ever',
        suggestion: null,
        seed,
      })
      expect(choice.lineId).toBe('hub.welcome.first-again')
      expect(choice.isAnchor).toBe(true)
    }
  })

  it('session-end path is anchor-only ("Pick again?")', () => {
    for (const seed of [0, 5, 100]) {
      const choice = pickHubGreeting({
        path: 'session-end',
        suggestion: 'word-song', // suggestion ignored on session-end
        seed,
      })
      expect(choice.lineId).toBe('hub.welcome.pick-again')
    }
  })

  it('mid-skill-back path is anchor-only ("Pick what\'s next.")', () => {
    const choice = pickHubGreeting({
      path: 'mid-skill-back',
      suggestion: null,
      seed: 7,
    })
    expect(choice.lineId).toBe('hub.welcome.pick-next')
  })

  it('app-open + null suggestion uses what-today anchor or its rotation', () => {
    const allowed: HubLineId[] = [
      'hub.welcome.what-today',
      'hub.welcome.what-today.alt-1',
      'hub.welcome.what-today.alt-2',
      'hub.welcome.what-today.alt-3',
    ]
    for (let seed = 0; seed < 50; seed++) {
      const choice = pickHubGreeting({
        path: 'app-open',
        suggestion: null,
        seed,
      })
      expect(choice.lineId).not.toBeNull()
      expect(allowed).toContain(choice.lineId as HubLineId)
    }
  })

  it('app-open + non-null suggestion uses the suggestion-aware table', () => {
    // Force the anchor by picking a seed whose pseudoRandom < 0.8.
    // We don't know the exact mapping, but iterate a few seeds and
    // assert the result always lives in the suggested table.
    const numberAllowed: HubLineId[] = [
      'hub.welcome.try-number-garden',
      'hub.welcome.try-number-garden.alt-1',
      'hub.welcome.try-number-garden.alt-2',
    ]
    const wordAllowed: HubLineId[] = [
      'hub.welcome.try-word-song',
      'hub.welcome.try-word-song.alt-1',
      'hub.welcome.try-word-song.alt-2',
    ]

    for (let seed = 0; seed < 50; seed++) {
      const ng = pickHubGreeting({
        path: 'app-open',
        suggestion: 'number-garden',
        seed,
      })
      expect(numberAllowed).toContain(ng.lineId as HubLineId)

      const ws = pickHubGreeting({
        path: 'app-open',
        suggestion: 'word-song',
        seed,
      })
      expect(wordAllowed).toContain(ws.lineId as HubLineId)
    }
  })

  it('approximately 80% of a wide seed sweep land on the anchor (app-open variant)', () => {
    let anchors = 0
    const n = 500
    for (let seed = 0; seed < n; seed++) {
      const choice = pickHubGreeting({
        path: 'app-open',
        suggestion: null,
        seed,
      })
      if (choice.isAnchor) anchors++
    }
    // 80% target with healthy slack for the splitmix distribution.
    expect(anchors / n).toBeGreaterThan(0.7)
    expect(anchors / n).toBeLessThan(0.9)
  })

  it('seed N picks the same variant on subsequent calls (deterministic)', () => {
    const a = pickHubGreeting({ path: 'app-open', suggestion: null, seed: 17 })
    const b = pickHubGreeting({ path: 'app-open', suggestion: null, seed: 17 })
    expect(a).toEqual(b)
  })

  it('app-open-recent + suggestion still uses the suggestion table', () => {
    const choice = pickHubGreeting({
      path: 'app-open-recent',
      suggestion: 'number-garden',
      seed: 1,
    })
    expect(
      [
        'hub.welcome.try-number-garden',
        'hub.welcome.try-number-garden.alt-1',
        'hub.welcome.try-number-garden.alt-2',
      ].includes(choice.lineId as string),
    ).toBe(true)
  })
})

describe('isLastSessionRecent', () => {
  const now = new Date(2026, 3, 29, 12, 0, 0)

  it('returns true for a session within the last 24h', () => {
    const recent = new Date(2026, 3, 29, 6, 0, 0).toISOString()
    expect(isLastSessionRecent(recent, now)).toBe(true)
  })

  it('returns false for a session more than 24h ago', () => {
    const old = new Date(2026, 3, 28, 6, 0, 0).toISOString() // 30h ago
    expect(isLastSessionRecent(old, now)).toBe(false)
  })

  it('returns false for an empty timestamp', () => {
    expect(isLastSessionRecent('', now)).toBe(false)
  })

  it('returns false for a malformed timestamp', () => {
    expect(isLastSessionRecent('not-a-date', now)).toBe(false)
  })
})

describe('shouldShowDayStreak', () => {
  const now = new Date(2026, 3, 29, 12, 0, 0)

  it('returns false when streak is 0 (silent reset rule)', () => {
    const yesterday = new Date(2026, 3, 28, 12, 0).toISOString()
    expect(shouldShowDayStreak(0, yesterday, now)).toBe(false)
  })

  it('returns true for streak >= 1 with a session today', () => {
    const today = new Date(2026, 3, 29, 8, 0).toISOString()
    expect(shouldShowDayStreak(1, today, now)).toBe(true)
    expect(shouldShowDayStreak(5, today, now)).toBe(true)
  })

  it('returns true for streak >= 1 with a session yesterday', () => {
    const yesterday = new Date(2026, 3, 28, 18, 0).toISOString()
    expect(shouldShowDayStreak(2, yesterday, now)).toBe(true)
  })

  it('returns false for streak >= 1 but session was 2+ days ago', () => {
    const twoDaysAgo = new Date(2026, 3, 27, 12, 0).toISOString()
    expect(shouldShowDayStreak(3, twoDaysAgo, now)).toBe(false)
  })

  it('returns false for empty / malformed timestamps', () => {
    expect(shouldShowDayStreak(3, '', now)).toBe(false)
    expect(shouldShowDayStreak(3, 'bogus', now)).toBe(false)
  })
})
