import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

describe('usePrefersReducedMotion', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  function stubMatchMedia(matches: boolean) {
    const listeners: Array<(ev: MediaQueryListEvent) => void> = []
    const addFn = vi.fn(
      (_event: string, cb: (ev: MediaQueryListEvent) => void) => {
        listeners.push(cb)
      },
    )
    const removeFn = vi.fn(
      (_event: string, cb: (ev: MediaQueryListEvent) => void) => {
        const idx = listeners.indexOf(cb)
        if (idx >= 0) listeners.splice(idx, 1)
      },
    )
    const mql = {
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: addFn,
      removeEventListener: removeFn,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList

    window.matchMedia = vi.fn().mockReturnValue(mql)
    return { mql, listeners, addFn, removeFn }
  }

  it('returns false when prefers-reduced-motion is not set', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-reduced-motion: reduce is active', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })

  it('tracks live changes via the change event', () => {
    const { listeners } = stubMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
      for (const cb of listeners) {
        cb({ matches: true } as MediaQueryListEvent)
      }
    })
    expect(result.current).toBe(true)
  })

  it('cleans up the event listener on unmount', () => {
    const { removeFn } = stubMatchMedia(false)
    const { unmount } = renderHook(() => usePrefersReducedMotion())
    unmount()
    expect(removeFn).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
