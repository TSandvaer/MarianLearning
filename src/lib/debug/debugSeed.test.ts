import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeApplyDebugSeed, readDebugSeedParam } from './debugSeed'

const PROGRESS_KEY = 'marian-tutor:progress:v1'
const SESSION_HISTORY_KEY = 'marian-tutor.session-history.v1'

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
      const progress = JSON.parse(
        window.localStorage.getItem(PROGRESS_KEY) ?? '{}',
      ) as { skillLevels?: Record<string, string> }
      expect(progress.skillLevels?.['blending-cv']).toBe('mastered')
      expect(progress.skillLevels?.['cvc-words']).toBe('practicing')
    })

    it('preserves any pre-existing skillLevels not in the patch', () => {
      window.localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ skillLevels: { 'add-to-10': 'mastered' } }),
      )
      maybeApplyDebugSeed()
      const progress = JSON.parse(
        window.localStorage.getItem(PROGRESS_KEY) ?? '{}',
      ) as { skillLevels?: Record<string, string> }
      expect(progress.skillLevels?.['add-to-10']).toBe('mastered')
      expect(progress.skillLevels?.['blending-cv']).toBe('mastered')
      expect(progress.skillLevels?.['cvc-words']).toBe('practicing')
    })

    it('inserts a fake session-history entry so sessionCount > 0 (skip Greet)', () => {
      maybeApplyDebugSeed()
      const history = JSON.parse(
        window.localStorage.getItem(SESSION_HISTORY_KEY) ?? '{}',
      ) as { version?: number; sessions?: Array<Record<string, unknown>> }
      expect(history.version).toBe(2)
      expect(history.sessions).toHaveLength(1)
      expect(history.sessions?.[0]?.['__debug_seed__']).toBe(true)
      expect(history.sessions?.[0]?.['surface']).toBe('math')
      expect(history.sessions?.[0]?.['focusNode']).toBe('add-to-10')
    })

    it('is idempotent — calling twice does not double-insert sessions or re-write unchanged progress', () => {
      maybeApplyDebugSeed()
      const after1 = window.localStorage.getItem(SESSION_HISTORY_KEY)
      maybeApplyDebugSeed()
      const after2 = window.localStorage.getItem(SESSION_HISTORY_KEY)
      expect(after2).toBe(after1)
      const history = JSON.parse(after2 ?? '{}') as {
        sessions?: unknown[]
      }
      expect(history.sessions).toHaveLength(1)
    })

    it('does not displace a real session that already exists', () => {
      window.localStorage.setItem(
        SESSION_HISTORY_KEY,
        JSON.stringify({
          version: 2,
          sessions: [
            {
              surface: 'math',
              dateISO: '2026-05-01T10:00:00.000Z',
              totalCorrect: 7,
              totalStardust: 9,
              finalStreak: 5,
              earnedThisSession: 9,
              focusNode: 'add-to-10',
              // No __debug_seed__ marker — this is a "real" session.
            },
          ],
        }),
      )
      maybeApplyDebugSeed()
      const history = JSON.parse(
        window.localStorage.getItem(SESSION_HISTORY_KEY) ?? '{}',
      ) as { sessions?: Array<Record<string, unknown>> }
      // Real session preserved + 1 seeded session inserted.
      expect(history.sessions).toHaveLength(2)
      expect(history.sessions?.[0]?.['__debug_seed__']).toBeUndefined()
      expect(history.sessions?.[1]?.['__debug_seed__']).toBe(true)
    })
  })
})
