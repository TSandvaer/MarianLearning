import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COLD_CAP_MS,
  WARM_CAP_MS,
  __WARM_FLAG_KEY,
  detectColdStart,
  markWarm,
  splashCapMs,
} from './splashTiming'

describe('splashTiming', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('splashCapMs', () => {
    it('returns the warm cap (1500 ms) for warm starts', () => {
      expect(splashCapMs(false)).toBe(WARM_CAP_MS)
      expect(splashCapMs(false)).toBe(1500)
    })

    it('returns the cold cap (3000 ms) for cold starts', () => {
      expect(splashCapMs(true)).toBe(COLD_CAP_MS)
      expect(splashCapMs(true)).toBe(3000)
    })
  })

  describe('detectColdStart', () => {
    it('returns true on first visit (no warm flag, fresh nav)', () => {
      // jsdom default navigation type is "navigate", not "reload".
      expect(detectColdStart()).toBe(true)
    })

    it('returns false when sessionStorage already has the warm flag', () => {
      window.sessionStorage.setItem(__WARM_FLAG_KEY, '1')
      expect(detectColdStart()).toBe(false)
    })

    it('returns false when navigation type is "reload"', () => {
      const fakeEntry: Partial<PerformanceNavigationTiming> = {
        type: 'reload',
      }
      vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([
        fakeEntry as PerformanceNavigationTiming,
      ])
      expect(detectColdStart()).toBe(false)
    })

    it('defaults to cold when storage throws (private mode) and nav type is unknown', () => {
      // Force sessionStorage.getItem to throw (Safari private-mode style failure).
      const original = Storage.prototype.getItem
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('SecurityError')
      })
      try {
        // Make perf.getEntriesByType return nothing too — total uncertainty.
        vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([])
        expect(detectColdStart()).toBe(true)
      } finally {
        Storage.prototype.getItem = original
      }
    })
  })

  describe('markWarm', () => {
    it('writes the warm flag to sessionStorage', () => {
      markWarm()
      expect(window.sessionStorage.getItem(__WARM_FLAG_KEY)).toBe('1')
    })

    it('does not throw when storage is unavailable', () => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError')
      })
      try {
        expect(() => markWarm()).not.toThrow()
      } finally {
        Storage.prototype.setItem = original
      }
    })

    it('makes a subsequent detectColdStart() return false in the same session', () => {
      expect(detectColdStart()).toBe(true)
      markWarm()
      expect(detectColdStart()).toBe(false)
    })
  })
})
