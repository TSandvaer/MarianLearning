/**
 * Unit tests for `useRequestPersistentStorageOnGesture` (ticket
 * 86c9pkfth — harden progress localStorage).
 *
 * Hook contract:
 *   - Call `navigator.storage.persist()` ONCE on the first
 *     pointerdown, never on boot.
 *   - Idempotent across re-renders / re-mounts (sentinel ref).
 *   - Fire-and-forget — no UI, no error toast, no rejection bubble.
 *   - No-op when `navigator.storage.persist` is unavailable
 *     (iOS Safari < 16.4, jsdom without polyfill).
 *
 * Tests use the `requestPersist` test seam to assert dispatch shape
 * without touching real navigator APIs.
 */

import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRequestPersistentStorageOnGesture } from './useRequestPersistentStorageOnGesture'

function Probe(props: {
  requestPersist?: () => Promise<boolean> | boolean | undefined
}): ReactElement {
  useRequestPersistentStorageOnGesture({ requestPersist: props.requestPersist })
  return <div data-testid="probe" />
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRequestPersistentStorageOnGesture', () => {
  it('does NOT dispatch on mount alone (defers to first gesture)', () => {
    const seam = vi.fn(() => Promise.resolve(true))
    render(<Probe requestPersist={seam} />)
    expect(seam).not.toHaveBeenCalled()
  })

  it('dispatches exactly once on the first pointerdown', () => {
    const seam = vi.fn(() => Promise.resolve(true))
    render(<Probe requestPersist={seam} />)

    document.dispatchEvent(new Event('pointerdown'))
    expect(seam).toHaveBeenCalledTimes(1)

    // Subsequent gestures must NOT re-dispatch — once-per-page-lifetime.
    document.dispatchEvent(new Event('pointerdown'))
    document.dispatchEvent(new Event('pointerdown'))
    expect(seam).toHaveBeenCalledTimes(1)
  })

  it('swallows a rejected persist Promise (fire-and-forget)', async () => {
    const seam = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    render(<Probe requestPersist={seam} />)

    document.dispatchEvent(new Event('pointerdown'))
    expect(seam).toHaveBeenCalledTimes(1)

    // Drain the microtask queue so the rejection settles. No error
    // bubbles — the test simply completes without an unhandled
    // promise rejection.
    await Promise.resolve()
    await Promise.resolve()
  })

  it('swallows a thrown error from the seam', () => {
    const seam = vi.fn(() => {
      throw new Error('synchronous-throw')
    })
    render(<Probe requestPersist={seam} />)

    expect(() => {
      document.dispatchEvent(new Event('pointerdown'))
    }).not.toThrow()
    expect(seam).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when seam returns undefined (API unavailable path)', () => {
    const seam = vi.fn(() => undefined)
    render(<Probe requestPersist={seam} />)

    expect(() => {
      document.dispatchEvent(new Event('pointerdown'))
    }).not.toThrow()
    expect(seam).toHaveBeenCalledTimes(1)
  })

  it('does not dispatch a second time after a re-render', () => {
    const seam = vi.fn(() => Promise.resolve(true))
    const { rerender } = render(<Probe requestPersist={seam} />)

    document.dispatchEvent(new Event('pointerdown'))
    expect(seam).toHaveBeenCalledTimes(1)

    rerender(<Probe requestPersist={seam} />)
    document.dispatchEvent(new Event('pointerdown'))
    expect(seam).toHaveBeenCalledTimes(1)
  })

  it('falls back to navigator.storage.persist when no seam is provided', () => {
    const persist = vi.fn(() => Promise.resolve(true))
    const originalStorage = (
      navigator as Navigator & {
        storage?: { persist?: () => Promise<boolean> }
      }
    ).storage
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    })
    try {
      render(<Probe />)
      document.dispatchEvent(new Event('pointerdown'))
      expect(persist).toHaveBeenCalledTimes(1)
    } finally {
      // Restore — `delete` then re-define if there was an original.
      if (originalStorage === undefined) {
        delete (navigator as unknown as Record<string, unknown>).storage
      } else {
        Object.defineProperty(navigator, 'storage', {
          configurable: true,
          value: originalStorage,
        })
      }
    }
  })

  it('is a no-op when navigator.storage.persist is undefined', () => {
    const originalStorage = (
      navigator as Navigator & {
        storage?: { persist?: () => Promise<boolean> }
      }
    ).storage
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {},
    })
    try {
      // No seam supplied → reads navigator.storage.persist; undefined
      // → fast no-op return. Just verify the gesture doesn't throw.
      render(<Probe />)
      expect(() => {
        document.dispatchEvent(new Event('pointerdown'))
      }).not.toThrow()
    } finally {
      if (originalStorage === undefined) {
        delete (navigator as unknown as Record<string, unknown>).storage
      } else {
        Object.defineProperty(navigator, 'storage', {
          configurable: true,
          value: originalStorage,
        })
      }
    }
  })
})
