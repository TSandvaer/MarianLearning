/**
 * Unit tests for `useHowlerSuspendOnHide`.
 *
 * Ticket 86c9kxtmu (Jessica e2e batch — Bug B + PR #137 round 2). The
 * hook bridges `visibilitychange` to `Howler.ctx.suspend()` on hide and
 * to `markPendingResume()` on show (when iOS handed us a
 * suspended/interrupted ctx). Tests stub `Howler.ctx` to a controllable
 * AudioContext-like object — we don't need a real WebAudio backend for
 * jsdom.
 *
 * Round 2 contract change
 * -----------------------
 * Iteration 1 called `ctx.resume()` + `unlockIosAudioSession()` from
 * inside this `visibilitychange` handler. Thomas's iPad PWA repro
 * proved that path doesn't actually unstick the OS audio session —
 * iOS requires the resume + buffer to fire inside a real user-gesture
 * handler. Iteration 2 marks the `pendingResumeGate` instead and
 * defers the actual recovery to the next chip-tap / hub-node-tap /
 * "tap to continue" affordance.
 */

import { render } from '@testing-library/react'
import { Howler } from 'howler'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetPageVisibilityForTests } from './pageVisibility'
import { useHowlerSuspendOnHide } from './useHowlerSuspendOnHide'
import {
  AUDIO_CTX_LOG_STORAGE_KEY,
  _resetAudioContextProbeForTests,
  activateAudioContextProbe,
} from '../debug/audioContextProbe'
import {
  _resetPendingResumeGateForTests,
  getPendingResumeAffordanceState,
} from '../audio/pendingResumeGate'

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

function Probe(): React.ReactElement {
  useHowlerSuspendOnHide()
  return <div data-testid="probe" />
}

interface FakeCtx {
  state: 'running' | 'suspended' | 'closed' | 'interrupted'
  suspend: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
}

function makeFakeCtx(state: FakeCtx['state']): FakeCtx {
  return {
    state,
    suspend: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
  }
}

describe('useHowlerSuspendOnHide', () => {
  // We stash the original Howler.ctx so each test can restore it.
  let originalCtx: AudioContext | null

  beforeEach(() => {
    originalCtx =
      (Howler as unknown as { ctx?: AudioContext | null }).ctx ?? null
    setDocumentVisibility('visible')
    _resetPendingResumeGateForTests()
  })

  afterEach(() => {
    _resetPageVisibilityForTests()
    setDocumentVisibility('visible')
    ;(Howler as unknown as { ctx?: AudioContext | null }).ctx = originalCtx
    _resetPendingResumeGateForTests()
  })

  it('calls ctx.suspend() when the page transitions to hidden (running ctx)', () => {
    const fakeCtx = makeFakeCtx('running')
    ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
    render(<Probe />)
    expect(fakeCtx.suspend).not.toHaveBeenCalled()

    setDocumentVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fakeCtx.suspend).toHaveBeenCalledTimes(1)
  })

  it('does NOT suspend an already-suspended ctx', () => {
    const fakeCtx = makeFakeCtx('suspended')
    ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
    render(<Probe />)
    setDocumentVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fakeCtx.suspend).not.toHaveBeenCalled()
  })

  it('does NOT call ctx.resume() on visible — round-2 contract defers resume to gesture', () => {
    // Round-2 contract: this hook does NOT call resume() from a
    // system-event handler. iOS WebAudio session-lock requires the
    // resume to fire inside a real user-gesture; calling it here did
    // nothing on real iPad PWA (the iteration-1 bug).
    const fakeCtx = makeFakeCtx('suspended')
    ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
    setDocumentVisibility('hidden')
    render(<Probe />)
    setDocumentVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fakeCtx.resume).not.toHaveBeenCalled()
  })

  it('does NOT touch a closed ctx', () => {
    const fakeCtx = makeFakeCtx('closed')
    ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
    setDocumentVisibility('hidden')
    render(<Probe />)
    setDocumentVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fakeCtx.resume).not.toHaveBeenCalled()
    expect(fakeCtx.suspend).not.toHaveBeenCalled()
  })

  it('is a no-op when Howler.ctx is null/undefined', () => {
    ;(Howler as unknown as { ctx?: AudioContext | null }).ctx = null
    expect(() => {
      render(<Probe />)
      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
    }).not.toThrow()
  })

  it('cleanly unsubscribes on unmount', () => {
    const fakeCtx = makeFakeCtx('running')
    ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
    const { unmount } = render(<Probe />)
    unmount()
    setDocumentVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fakeCtx.suspend).not.toHaveBeenCalled()
  })

  describe('iOS interrupted/suspended recovery (round 2 — ticket 86c9kxtmu)', () => {
    it('on visible-resume with state=interrupted: marks pendingResume gate (no audio-side calls)', () => {
      const fakeCtx = makeFakeCtx('interrupted')
      ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
      setDocumentVisibility('hidden')
      render(<Probe />)
      expect(getPendingResumeAffordanceState()).toBe('idle')

      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      // Round-2 contract: ctx.resume() NOT called from this handler.
      expect(fakeCtx.resume).not.toHaveBeenCalled()
      // Gate is now pending — the next user gesture's drainOnGesture
      // will run resume + unlock + drain queued utterances.
      expect(getPendingResumeAffordanceState()).toBe('pending')
    })

    it('on visible-resume with state=suspended: marks pendingResume gate', () => {
      const fakeCtx = makeFakeCtx('suspended')
      ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
      setDocumentVisibility('hidden')
      render(<Probe />)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      expect(fakeCtx.resume).not.toHaveBeenCalled()
      expect(getPendingResumeAffordanceState()).toBe('pending')
    })

    it('on visible-resume with state=running: does NOT mark pendingResume', () => {
      // Already-running ctx — no iOS preempt this round, no recovery
      // needed.
      const fakeCtx = makeFakeCtx('running')
      ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
      setDocumentVisibility('hidden')
      render(<Probe />)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      expect(fakeCtx.resume).not.toHaveBeenCalled()
      expect(getPendingResumeAffordanceState()).toBe('idle')
    })

    it('audioCtxLog records visibility-* probe rows around suspend/resume', () => {
      const storage = new Map<string, string>()
      const memStorage = {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v)
        },
        removeItem: (k: string) => {
          storage.delete(k)
        },
      }
      activateAudioContextProbe({ storage: memStorage })

      const fakeCtx = makeFakeCtx('running')
      ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
      render(<Probe />)

      setDocumentVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))

      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      const persisted = storage.get(AUDIO_CTX_LOG_STORAGE_KEY)
      expect(persisted).toBeTruthy()
      const log = JSON.parse(persisted!) as Array<{ cause: string }>
      const causes = log.map((row) => row.cause)
      expect(causes).toContain('visibility-hidden-pre')
      expect(causes).toContain('visibility-hidden-post')
      expect(causes).toContain('visibility-visible-pre')
      expect(causes).toContain('visibility-visible-post')
    })

    it('audioCtxLog records visibility-recovery-buffer with bufferStarted=false on deferred-recovery path', () => {
      const storage = new Map<string, string>()
      const memStorage = {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v)
        },
        removeItem: (k: string) => {
          storage.delete(k)
        },
      }
      activateAudioContextProbe({ storage: memStorage })

      const fakeCtx = makeFakeCtx('interrupted')
      ;(Howler as unknown as { ctx?: unknown }).ctx = fakeCtx
      setDocumentVisibility('hidden')
      render(<Probe />)
      setDocumentVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      const persisted = storage.get(AUDIO_CTX_LOG_STORAGE_KEY)
      const log = JSON.parse(persisted!) as Array<{
        cause: string
        bufferStarted?: boolean
      }>
      const recovery = log.find((r) => r.cause === 'visibility-recovery-buffer')
      expect(recovery).toBeDefined()
      // Round-2 contract: bufferStarted=false on the visibility row
      // signals "we deferred the buffer kick to the gesture window".
      // The bufferStarted=true row will appear later, on the actual
      // chip-tap that drains the gate (logged via the existing
      // recordUnlockStateEvent in Math/WordSong onChipTap, not from
      // this hook).
      expect(recovery?.bufferStarted).toBe(false)
    })

    afterEach(() => {
      _resetAudioContextProbeForTests()
    })
  })
})
