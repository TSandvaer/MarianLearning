/**
 * Unit tests for `pendingResumeGate` — gesture-deferred AudioContext
 * recovery.
 *
 * Ticket 86c9kxtmu (PR #137 round 2). The five test cases the brief
 * called for, plus a few defensive cases on the same surface area.
 *
 * Because pendingResumeGate is a module singleton, every test must
 * reset state via `_resetPendingResumeGateForTests()` in beforeEach
 * AND afterEach (afterEach belt-and-suspenders against any case that
 * forgets to await an outstanding fallback timer).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  _resetPendingResumeGateForTests,
  cancelPendingResume,
  configurePendingResumeGate,
  drainOnGesture,
  enqueueOnResume,
  getPendingResumeAffordanceState,
  isPendingResume,
  markPendingResume,
  subscribePendingResumeGate,
  type PendingResumeAffordanceState,
} from './pendingResumeGate'

describe('pendingResumeGate', () => {
  beforeEach(() => {
    _resetPendingResumeGateForTests()
  })

  afterEach(() => {
    _resetPendingResumeGateForTests()
  })

  describe('markPendingResume + isPendingResume (visibility-edge contract)', () => {
    it('starts idle; markPendingResume transitions to pending', () => {
      // Brief req #1: simulate visibilitychange → visible with
      // ctx.state === 'interrupted'/'suspended'. Assert pendingResume
      // becomes true; no audio fires (caller's responsibility — we
      // verify the gate state).
      expect(getPendingResumeAffordanceState()).toBe('idle')
      expect(isPendingResume()).toBe(false)

      markPendingResume()

      expect(getPendingResumeAffordanceState()).toBe('pending')
      expect(isPendingResume()).toBe(true)
    })

    it('idempotent: re-marking while pending stays pending', () => {
      markPendingResume()
      const stateAfterFirst = getPendingResumeAffordanceState()
      markPendingResume()
      expect(getPendingResumeAffordanceState()).toBe(stateAfterFirst)
      expect(getPendingResumeAffordanceState()).toBe('pending')
    })
  })

  describe('drainOnGesture (gesture-window recovery)', () => {
    it('runs resume + unlock + drains queued utterance, then clears flag', () => {
      // Brief req #2: set pendingResume=true, fire a synthetic chip-tap
      // (drainOnGesture). Assert: resume + unlock called inside the
      // gesture, queued utterance drained, flag cleared.
      const resumeFn = vi.fn()
      const unlockFn = vi.fn()
      const utteranceFn = vi.fn()

      markPendingResume()
      enqueueOnResume({ label: 'math.p1.read', run: utteranceFn })

      const result = drainOnGesture(resumeFn, unlockFn)

      expect(resumeFn).toHaveBeenCalledTimes(1)
      expect(unlockFn).toHaveBeenCalledTimes(1)
      expect(utteranceFn).toHaveBeenCalledTimes(1)
      expect(result.drainedHandlerCount).toBe(1)
      expect(getPendingResumeAffordanceState()).toBe('idle')
      expect(isPendingResume()).toBe(false)
    })

    it('order-of-operations: resume → unlock → handler', () => {
      const calls: string[] = []
      const resumeFn = vi.fn(() => calls.push('resume'))
      const unlockFn = vi.fn(() => calls.push('unlock'))
      const utteranceFn = vi.fn(() => calls.push('utterance'))

      markPendingResume()
      enqueueOnResume({ label: 'math.p1.read', run: utteranceFn })
      drainOnGesture(resumeFn, unlockFn)

      expect(calls).toEqual(['resume', 'unlock', 'utterance'])
    })

    it('runs resume + unlock even when no handler is queued', () => {
      // Common case: gesture lands with the gate pending but no
      // playSession was queued (the dispatch effect hadn't fired
      // yet). We still want the gesture to drive resume + unlock so
      // subsequent dispatches play normally.
      const resumeFn = vi.fn()
      const unlockFn = vi.fn()

      markPendingResume()
      const result = drainOnGesture(resumeFn, unlockFn)

      expect(resumeFn).toHaveBeenCalledTimes(1)
      expect(unlockFn).toHaveBeenCalledTimes(1)
      expect(result.drainedHandlerCount).toBe(0)
      expect(getPendingResumeAffordanceState()).toBe('idle')
    })

    it('handler error does not abort the gate clear', () => {
      const resumeFn = vi.fn()
      const unlockFn = vi.fn()
      const throwingHandler = vi.fn(() => {
        throw new Error('handler exploded')
      })
      markPendingResume()
      enqueueOnResume({ label: 'broken', run: throwingHandler })

      drainOnGesture(resumeFn, unlockFn)

      expect(throwingHandler).toHaveBeenCalledTimes(1)
      // Gate cleared regardless — leaving the gate stuck after a
      // failed drain would brick subsequent playback.
      expect(getPendingResumeAffordanceState()).toBe('idle')
    })
  })

  describe('enqueueOnResume (most-recent-only queue)', () => {
    it('multiple enqueues during pendingResume → only the most recent fires on drain', () => {
      // Brief req #3. Older queued utterances are stale by the time
      // the user returns; replaying them on top of the most-recent
      // would confuse Marian.
      const stale1 = vi.fn()
      const stale2 = vi.fn()
      const fresh = vi.fn()

      markPendingResume()
      enqueueOnResume({ label: 'stale1', run: stale1 })
      enqueueOnResume({ label: 'stale2', run: stale2 })
      enqueueOnResume({ label: 'fresh', run: fresh })

      drainOnGesture(vi.fn(), vi.fn())

      expect(stale1).not.toHaveBeenCalled()
      expect(stale2).not.toHaveBeenCalled()
      expect(fresh).toHaveBeenCalledTimes(1)
    })

    it('enqueue while gate is idle is a no-op', () => {
      // Defensive: a stray enqueue arriving when the gate is idle
      // (race between the caller's isPendingResume check and our
      // push) is silently dropped — no point queuing for a drain
      // that will never run.
      const handler = vi.fn()
      enqueueOnResume({ label: 'orphan', run: handler })
      // No drain triggers anything because nothing was queued.
      drainOnGesture(vi.fn(), vi.fn())
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('fallback affordance timer', () => {
    it('elapsed without gesture → state transitions pending → awaiting-tap', () => {
      // Brief req #4: no tap within 3-5s; affordance appears.
      vi.useFakeTimers()
      try {
        // Use real-window setTimeout via the fake-timers shim. The
        // module's default `defaultScheduleOnce` references
        // `window.setTimeout`, which fake-timers replaces.
        markPendingResume()
        expect(getPendingResumeAffordanceState()).toBe('pending')

        // Just before the fallback (default 3000 ms): still pending.
        vi.advanceTimersByTime(2_999)
        expect(getPendingResumeAffordanceState()).toBe('pending')

        // Past the fallback: transitions to awaiting-tap.
        vi.advanceTimersByTime(2)
        expect(getPendingResumeAffordanceState()).toBe('awaiting-tap')
      } finally {
        vi.useRealTimers()
      }
    })

    it('drainOnGesture cancels the fallback timer', () => {
      vi.useFakeTimers()
      try {
        markPendingResume()
        vi.advanceTimersByTime(1_000)

        drainOnGesture(vi.fn(), vi.fn())
        expect(getPendingResumeAffordanceState()).toBe('idle')

        // Past the original fallback window: still idle (timer
        // cancelled by drain).
        vi.advanceTimersByTime(5_000)
        expect(getPendingResumeAffordanceState()).toBe('idle')
      } finally {
        vi.useRealTimers()
      }
    })

    it('subscribers see pending → awaiting-tap transition', () => {
      vi.useFakeTimers()
      try {
        const states: PendingResumeAffordanceState[] = []
        const unsubscribe = subscribePendingResumeGate((s) => states.push(s))

        markPendingResume()
        vi.advanceTimersByTime(3_001)

        expect(states).toEqual(['pending', 'awaiting-tap'])
        unsubscribe()
      } finally {
        vi.useRealTimers()
      }
    })

    it('configurable fallback duration', () => {
      vi.useFakeTimers()
      try {
        configurePendingResumeGate({ affordanceFallbackMs: 100 })
        markPendingResume()
        vi.advanceTimersByTime(101)
        expect(getPendingResumeAffordanceState()).toBe('awaiting-tap')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('cancelPendingResume', () => {
    it('drops queued handlers and returns gate to idle', () => {
      // Used by route-change cleanup — when navigating away we don't
      // want a queued handler from the leaving screen to fire on
      // arrival of the next screen's gesture.
      const handler = vi.fn()
      markPendingResume()
      enqueueOnResume({ label: 'leaving-screen', run: handler })

      cancelPendingResume()

      expect(getPendingResumeAffordanceState()).toBe('idle')
      // Subsequent drain should NOT find the cancelled handler.
      drainOnGesture(vi.fn(), vi.fn())
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('subscribePendingResumeGate', () => {
    it('subscribers receive state-transition emissions, can unsubscribe', () => {
      const states: PendingResumeAffordanceState[] = []
      const unsubscribe = subscribePendingResumeGate((s) => states.push(s))

      markPendingResume()
      drainOnGesture(vi.fn(), vi.fn())
      unsubscribe()
      // Post-unsubscribe transitions are not seen.
      markPendingResume()

      expect(states).toEqual(['pending', 'idle'])
    })

    it('throwing subscriber does not break the dispatch loop for others', () => {
      const goodEmissions: PendingResumeAffordanceState[] = []
      subscribePendingResumeGate(() => {
        throw new Error('bad subscriber')
      })
      subscribePendingResumeGate((s) => goodEmissions.push(s))

      markPendingResume()
      expect(goodEmissions).toEqual(['pending'])
    })
  })
})
