/**
 * Unit tests for the page-visibility module.
 *
 * Ticket 86c9kxtmu (Jessica e2e batch — Bug B). The hook + Howler-bridge
 * have their own tests; this file pins the underlying subscribe/dispatch
 * primitive.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetPageVisibilityForTests,
  getIsPageHidden,
  subscribeToVisibilityChange,
} from './pageVisibility'

function setDocumentVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => state === 'hidden',
  })
}

describe('pageVisibility', () => {
  beforeEach(() => {
    setDocumentVisibility('visible')
  })

  afterEach(() => {
    _resetPageVisibilityForTests()
    setDocumentVisibility('visible')
  })

  describe('getIsPageHidden', () => {
    it('returns false when document.visibilityState is visible', () => {
      setDocumentVisibility('visible')
      expect(getIsPageHidden()).toBe(false)
    })

    it('returns true when document.visibilityState is hidden', () => {
      setDocumentVisibility('hidden')
      expect(getIsPageHidden()).toBe(true)
    })
  })

  describe('subscribeToVisibilityChange', () => {
    it('fires the callback on a visibilitychange event', () => {
      const cb = vi.fn()
      subscribeToVisibilityChange(cb)
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('returns an unsubscribe function that stops dispatch', () => {
      const cb = vi.fn()
      const unsubscribe = subscribeToVisibilityChange(cb)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(cb).toHaveBeenCalledTimes(1)
      unsubscribe()
      document.dispatchEvent(new Event('visibilitychange'))
      // Still 1 — the unsubscribed callback must not fire on subsequent
      // dispatches.
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('supports multiple subscribers fed by a single document listener', () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      subscribeToVisibilityChange(cb1)
      subscribeToVisibilityChange(cb2)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(cb1).toHaveBeenCalledTimes(1)
      expect(cb2).toHaveBeenCalledTimes(1)
    })

    it('does NOT crash the dispatch loop when a subscriber throws', () => {
      const throwingCb = vi.fn(() => {
        throw new Error('boom')
      })
      const otherCb = vi.fn()
      subscribeToVisibilityChange(throwingCb)
      subscribeToVisibilityChange(otherCb)
      document.dispatchEvent(new Event('visibilitychange'))
      expect(throwingCb).toHaveBeenCalledTimes(1)
      // The throwing callback must not stop sibling dispatches.
      expect(otherCb).toHaveBeenCalledTimes(1)
    })

    it('handles subscribe-then-unsubscribe cycles without leaking', () => {
      const cb = vi.fn()
      const unsubscribe = subscribeToVisibilityChange(cb)
      unsubscribe()
      unsubscribe() // double-unsubscribe is a no-op
      document.dispatchEvent(new Event('visibilitychange'))
      expect(cb).not.toHaveBeenCalled()
    })

    it('exposes the live state inside the callback', () => {
      let observed: boolean | null = null
      subscribeToVisibilityChange(() => {
        observed = getIsPageHidden()
      })
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(observed).toBe(true)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(observed).toBe(false)
    })
  })
})
