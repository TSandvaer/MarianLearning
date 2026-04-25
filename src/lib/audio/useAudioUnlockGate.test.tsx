import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioUnlockGate } from './useAudioUnlockGate'

describe('useAudioUnlockGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in idle state, gate hidden', () => {
    const { result } = renderHook(() => useAudioUnlockGate())
    expect(result.current.state).toBe('idle')
    expect(result.current.showGate).toBe(false)
  })

  it('transitions idle → pending on wrapSpeak', () => {
    const { result } = renderHook(() => useAudioUnlockGate())
    const runSpeak = vi.fn()

    act(() => {
      result.current.wrapSpeak(runSpeak)
    })

    expect(result.current.state).toBe('pending')
    expect(result.current.showGate).toBe(false)
    expect(runSpeak).toHaveBeenCalledTimes(1)
  })

  it('runs the wrapped speak synchronously inside wrapSpeak', () => {
    // The whole point of this hook on iPad Safari: the runSpeak callback
    // must be invoked in the same JS tick as the user gesture. We assert
    // that wrapSpeak() returns AFTER runSpeak has been called.
    const { result } = renderHook(() => useAudioUnlockGate())
    const callOrder: string[] = []

    act(() => {
      result.current.wrapSpeak(() => callOrder.push('runSpeak'))
      callOrder.push('after-wrap')
    })

    expect(callOrder).toEqual(['runSpeak', 'after-wrap'])
  })

  it('transitions pending → unlocked on reportSpeechStart', () => {
    const { result } = renderHook(() => useAudioUnlockGate())

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      result.current.reportSpeechStart()
    })

    expect(result.current.state).toBe('unlocked')
    expect(result.current.showGate).toBe(false)
  })

  it('clears the watchdog when speech starts so we never go to relock late', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      result.current.reportSpeechStart()
    })
    // Even after the would-be watchdog window, we stay unlocked.
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.state).toBe('unlocked')
  })

  it('transitions pending → relock when watchdog expires without speech start', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    expect(result.current.state).toBe('pending')

    act(() => {
      vi.advanceTimersByTime(99)
    })
    expect(result.current.state).toBe('pending')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.state).toBe('relock')
    expect(result.current.showGate).toBe(true)
  })

  it('default watchdog is 5000ms (round-5 first-utterance retry contract)', () => {
    // Bumped from 2000ms in round 5 (ticket 86c9gp99a) after Thomas iPad QA
    // showed first-speech routinely takes 3-5s on cold-cache PWA loads. The
    // previous 2s value was firing relock BEFORE the engine actually started
    // speaking; Marian saw the ring re-pulse, tapped again, and queued
    // competing speak() calls — the "eventually one wins" pattern.
    const { result } = renderHook(() => useAudioUnlockGate())

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(result.current.state).toBe('pending')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.state).toBe('relock')
  })

  it('dispatchGesture returns false when not in relock state', () => {
    const { result } = renderHook(() => useAudioUnlockGate())

    let consumed: boolean | undefined
    act(() => {
      consumed = result.current.dispatchGesture()
    })
    expect(consumed).toBe(false)

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    // pending: still false
    act(() => {
      consumed = result.current.dispatchGesture()
    })
    expect(consumed).toBe(false)
  })

  it('dispatchGesture in relock state synchronously runs the registered retry', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))
    const retry = vi.fn()

    act(() => {
      result.current.registerRetry(retry)
    })
    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.state).toBe('relock')

    let consumed: boolean | undefined
    act(() => {
      consumed = result.current.dispatchGesture()
    })
    expect(retry).toHaveBeenCalledTimes(1)
    expect(consumed).toBe(true)
  })

  it('dispatchGesture in relock without a registered retry returns false', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.state).toBe('relock')

    let consumed: boolean | undefined
    act(() => {
      consumed = result.current.dispatchGesture()
    })
    expect(consumed).toBe(false)
  })

  it('retry callback can re-arm the gate by calling wrapSpeak again', () => {
    // This is the core flow for the first-utterance miss recovery: after
    // 2s with no onstart, the next gesture re-runs the speak — and on this
    // pass it succeeds, so we transition to unlocked.
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))
    const runSpeak = vi.fn()

    // First attempt: speak silently rejected.
    act(() => {
      result.current.registerRetry(() => {
        result.current.wrapSpeak(runSpeak)
      })
      result.current.wrapSpeak(runSpeak)
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.state).toBe('relock')

    // User taps. Retry fires synchronously inside dispatchGesture.
    act(() => {
      result.current.dispatchGesture()
    })
    expect(runSpeak).toHaveBeenCalledTimes(2)
    // The retry put us back in pending.
    expect(result.current.state).toBe('pending')

    // Second attempt: this time onstart fires.
    act(() => {
      result.current.reportSpeechStart()
    })
    expect(result.current.state).toBe('unlocked')
  })

  it('reset() returns the hook to idle and forgets the registered retry', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))
    const retry = vi.fn()

    act(() => {
      result.current.registerRetry(retry)
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.state).toBe('relock')

    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toBe('idle')
    // dispatchGesture after reset should not fire the previously-registered retry.
    let consumed: boolean | undefined
    act(() => {
      consumed = result.current.dispatchGesture()
    })
    expect(consumed).toBe(false)
    expect(retry).not.toHaveBeenCalled()
  })

  it('cross-screen soft re-gate uses 250ms watchdog (Implementation Notes)', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 250 }))

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(result.current.state).toBe('pending')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.state).toBe('relock')
  })

  it('clears the watchdog on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useAudioUnlockGate({ watchdogMs: 100 }),
    )

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    unmount()

    // Advance the timers past the watchdog. We can't observe state after
    // unmount, but the test passes if no "update on unmounted component"
    // warning blows up in act/jsdom.
    act(() => {
      vi.advanceTimersByTime(500)
    })
  })

  describe('reportSpeechError (ticket 86c9gr43t — Howler load/play failure)', () => {
    it('transitions pending → relock immediately on reportSpeechError', () => {
      // Pre-onstart failure path: the engine never even acknowledged the
      // call, then rejected. Skip the watchdog entirely; flip straight to
      // relock so Marian sees the ring before the 1.5s window even elapses.
      const { result } = renderHook(() =>
        useAudioUnlockGate({ watchdogMs: 1_500 }),
      )

      act(() => {
        result.current.wrapSpeak(() => {})
      })
      expect(result.current.state).toBe('pending')

      act(() => {
        result.current.reportSpeechError()
      })
      expect(result.current.state).toBe('relock')
      expect(result.current.showGate).toBe(true)
    })

    it('transitions unlocked → relock on reportSpeechError (mid-sequence MP3 failure)', () => {
      // The actual GBUG-7 surface: line 0 played fine (gate reached
      // unlocked), but line 2's MP3 failed to load. The orchestrator
      // forwards the rejection to us; we need to surface relock just as
      // cleanly as if line 0 had silently missed.
      const { result } = renderHook(() => useAudioUnlockGate())

      act(() => {
        result.current.wrapSpeak(() => {})
      })
      act(() => {
        result.current.reportSpeechStart()
      })
      expect(result.current.state).toBe('unlocked')

      act(() => {
        result.current.reportSpeechError()
      })
      expect(result.current.state).toBe('relock')
    })

    it('clears the in-flight watchdog so a late expiry does not redundantly fire', () => {
      // Defensive: post-error we're already in `relock`. The watchdog's
      // expiry no-ops in the current impl (it only flips pending → relock)
      // but leaving a live handle around is sloppy and would surface as a
      // leaked timer in a more aggressive test harness.
      const { result } = renderHook(() =>
        useAudioUnlockGate({ watchdogMs: 100 }),
      )

      act(() => {
        result.current.wrapSpeak(() => {})
      })
      act(() => {
        result.current.reportSpeechError()
      })
      // Past the would-be watchdog window: still relock, no thrash.
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current.state).toBe('relock')
    })

    it('a registered retry is preserved across reportSpeechError → dispatchGesture', () => {
      // The whole point of the relock path: the next gesture should fire
      // the registered retry. Make sure reportSpeechError doesn't clobber
      // the retryRef the way reset() does.
      const { result } = renderHook(() => useAudioUnlockGate())
      const retry = vi.fn()

      act(() => {
        result.current.registerRetry(retry)
        result.current.wrapSpeak(() => {})
        result.current.reportSpeechError()
      })
      expect(result.current.state).toBe('relock')

      let consumed: boolean | undefined
      act(() => {
        consumed = result.current.dispatchGesture()
      })
      expect(consumed).toBe(true)
      expect(retry).toHaveBeenCalledTimes(1)
    })

    it('reportSpeechError from idle is a no-op-ish forced relock (defensive)', () => {
      // Edge case: caller invokes reportSpeechError without ever wrapping a
      // speak. Not a real production path, but we don't want a thrown error
      // — just put us in relock so the next gesture has somewhere to go.
      // (If a future call site introduces this pattern, this test catches
      // any silent regression to the no-op behaviour.)
      const { result } = renderHook(() => useAudioUnlockGate())

      act(() => {
        result.current.reportSpeechError()
      })
      expect(result.current.state).toBe('relock')
    })
  })

  it('a second wrapSpeak before the first has resolved cancels the prior watchdog', () => {
    const { result } = renderHook(() => useAudioUnlockGate({ watchdogMs: 100 }))

    act(() => {
      result.current.wrapSpeak(() => {})
    })
    act(() => {
      // Halfway through the watchdog, fire a fresh wrapSpeak — e.g. retry.
      vi.advanceTimersByTime(50)
      result.current.wrapSpeak(() => {})
    })
    // The new watchdog has its full 100ms, so at the original would-have-been
    // expiry (100ms total elapsed) we should still be pending.
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current.state).toBe('pending')
    // 100ms from the second wrapSpeak: relock.
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current.state).toBe('relock')
  })
})
