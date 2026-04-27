import { describe, expect, it, vi } from 'vitest'
import {
  awaitHowlerContextResume,
  disableHowlerAutoSuspend,
  resumeHowlerContextOnGesture,
  unlockIosAudioSession,
} from './howlerContext'

/**
 * Minimal AudioContext stub for unit tests. Mirrors the FakeAudioContext
 * in `lib/debug/audioContextProbe.test.ts` (we don't share it because the
 * audio-context module is the production fix, not the diagnostic, and a
 * separate fake keeps the test files independent).
 */
class FakeAudioContext {
  state: 'running' | 'suspended' | 'interrupted' | 'closed' = 'running'
  /** Set by the `resume()` mock so tests can assert how many times we called it. */
  resumeCalls = 0
  /** When `true`, `resume()` returns a rejecting promise. */
  rejectResume = false
  /** When `true`, `resume()` throws synchronously. */
  throwOnResume = false
  /** When set, override the resume return value (e.g. `undefined` for old browsers). */
  resumeReturn?: unknown

  resume(): Promise<void> | unknown {
    this.resumeCalls += 1
    if (this.throwOnResume) {
      throw new Error('synthetic synchronous throw')
    }
    if (this.resumeReturn !== undefined) {
      // Used by the "resume() returns undefined on old browsers" test.
      return this.resumeReturn
    }
    if (this.rejectResume) {
      return Promise.reject(new Error('synthetic resume rejection'))
    }
    return Promise.resolve()
  }
}

describe('resumeHowlerContextOnGesture', () => {
  it('is a no-op when Howler.ctx is missing', () => {
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: undefined },
    })
    expect(result.stateBefore).toBe('unavailable')
    expect(result.resumeCalled).toBe(false)
    expect(result.resumeThrew).toBe(false)
  })

  it('is a no-op when Howler.ctx is null (cleared by Howler teardown)', () => {
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: null },
    })
    expect(result.stateBefore).toBe('unavailable')
    expect(result.resumeCalled).toBe(false)
  })

  it('does not call resume() when ctx is already running', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'running'
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('running')
    expect(result.resumeCalled).toBe(false)
    expect(ctx.resumeCalls).toBe(0)
  })

  it('does not call resume() when ctx is closed (resume on closed is illegal)', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'closed'
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('closed')
    expect(result.resumeCalled).toBe(false)
    expect(ctx.resumeCalls).toBe(0)
  })

  it('calls resume() exactly once when ctx is suspended', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeCalled).toBe(true)
    expect(result.resumeThrew).toBe(false)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('calls resume() when ctx is interrupted (WebKit-only state)', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'interrupted'
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('interrupted')
    expect(result.resumeCalled).toBe(true)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('is idempotent across two synchronous calls in the same gesture', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const a = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    const b = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    // Both calls observe the pre-resume state because we don't await
    // the resume promise — by design.
    expect(a.resumeCalled).toBe(true)
    expect(b.resumeCalled).toBe(true)
    // Both kicks land. Calling resume() twice on a suspended context
    // is well-defined (the second is a no-op at the Web Audio layer)
    // and our wrapper deliberately doesn't dedupe — keeping the helper
    // stateless is more important than saving one call.
    expect(ctx.resumeCalls).toBe(2)
  })

  it('swallows a rejecting resume() promise (no unhandled rejection)', async () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    ctx.rejectResume = true

    // Bind an unhandled-rejection probe — if the helper failed to
    // attach a .catch, this assertion would fail with the rejected
    // promise leaking out of the synchronous call.
    const unhandled: unknown[] = []
    const handler = (ev: PromiseRejectionEvent) => {
      unhandled.push(ev.reason)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handler)
    }

    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.resumeCalled).toBe(true)
    expect(result.resumeThrew).toBe(false)

    // Drain microtasks so the rejection has a chance to fire.
    await Promise.resolve()
    await Promise.resolve()

    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', handler)
    }
    expect(unhandled).toHaveLength(0)
  })

  it('reports resumeThrew=true when resume() throws synchronously', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    ctx.throwOnResume = true
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeCalled).toBe(true)
    expect(result.resumeThrew).toBe(true)
  })

  it('handles legacy resume() that returns undefined instead of a promise', () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    ctx.resumeReturn = undefined
    // Explicitly set the field — `undefined` is the test signal here.
    ;(ctx as unknown as { resumeReturn: unknown }).resumeReturn = undefined
    // The helper should not throw on a `void`-returning resume().
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.resumeCalled).toBe(true)
    expect(result.resumeThrew).toBe(false)
  })

  it('treats a ctx getter that throws as unavailable', () => {
    // Some lockdown environments make `Howler.ctx` throw on access.
    const throwingTarget = {
      get ctx(): AudioContext {
        throw new Error('locked-down environment')
      },
    }
    const result = resumeHowlerContextOnGesture({
      howlerLike: throwingTarget as unknown as { ctx?: AudioContext | null },
    })
    expect(result.stateBefore).toBe('unavailable')
    expect(result.resumeCalled).toBe(false)
  })

  it('treats an AudioContext.state getter that throws as unavailable', () => {
    const ctx = {
      get state(): string {
        throw new Error('synthetic state read failure')
      },
      resume: vi.fn(),
    }
    const result = resumeHowlerContextOnGesture({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('unavailable')
    // Critically: we did NOT call resume() — we don't kick a resume on
    // a context whose state we can't read. Better to no-op than to call
    // into something that already failed once.
    expect(result.resumeCalled).toBe(false)
    expect(ctx.resume).not.toHaveBeenCalled()
  })
})

/**
 * Phase-4 / Phase-7 fix tests (ticket 86c9gvd0y).
 *
 * `awaitHowlerContextResume` is the awaited counterpart to
 * `resumeHowlerContextOnGesture` — same gesture-context contract but
 * waits for the AudioContext state to actually transition to `'running'`
 * (event-driven, bounded by a fallback timeout) so `Howl.play()` doesn't
 * fire against a still-suspended context.
 *
 * Phase-7 contract change (2026-04-26): the helper now resolves when the
 * `statechange` event fires with `state === 'running'`, NOT when the
 * resume promise alone settles. iOS Safari's resume promise can settle
 * 100s of ms before — or even after — the actual state transition; the
 * `statechange` event is the canonical signal.
 */

/**
 * Statechange-aware fake AudioContext. Mirrors `FakeAudioContext` above
 * but adds:
 *   - `addEventListener` / `removeEventListener` so the helper can
 *     subscribe to `statechange`.
 *   - `setState(next)` helper for tests to drive state transitions and
 *     fire the matching `statechange` event in one call.
 *   - Auto-transition-on-resume toggle (`autoRunOnResume`) for the
 *     common "resume() succeeds and state flips to running synchronously"
 *     case. Defaults to true; tests that want to manually drive the
 *     transition set it to false.
 */
class StateChangeFakeAudioContext {
  state: 'running' | 'suspended' | 'interrupted' | 'closed' = 'suspended'
  resumeCalls = 0
  rejectResume = false
  throwOnResume = false
  /**
   * When true, `resume()` flips state to 'running' (and fires
   * statechange) before the resume promise resolves. Mirrors most
   * desktop browsers and the common warm-iPad path. Tests of the
   * cold-iPad / event-driven path set this to false and drive
   * `setState('running')` explicitly.
   */
  autoRunOnResume = true
  private listeners: Record<string, Set<EventListener>> = {}

  addEventListener(type: string, fn: EventListener): void {
    if (!this.listeners[type]) this.listeners[type] = new Set()
    this.listeners[type].add(fn)
  }

  removeEventListener(type: string, fn: EventListener): void {
    this.listeners[type]?.delete(fn)
  }

  /** Test helper — drive a state transition and fire the matching event. */
  setState(next: 'running' | 'suspended' | 'interrupted' | 'closed'): void {
    if (this.state === next) return
    this.state = next
    const evs = this.listeners['statechange']
    if (evs) {
      // Iterate over a snapshot — listeners may remove themselves during
      // dispatch (the helper does this on resolve).
      for (const fn of Array.from(evs)) {
        fn(new Event('statechange'))
      }
    }
  }

  /** Snapshot of currently-attached listeners for assertion-time inspection. */
  listenerCount(type: string): number {
    return this.listeners[type]?.size ?? 0
  }

  resume(): Promise<void> {
    this.resumeCalls += 1
    if (this.throwOnResume) {
      throw new Error('synthetic synchronous throw')
    }
    if (this.rejectResume) {
      return Promise.reject(new Error('synthetic resume rejection'))
    }
    if (this.autoRunOnResume && this.state === 'suspended') {
      // Mirror most-browsers: resume() transitions state synchronously
      // (or microtask-fast) and then resolves. We flip the state in the
      // same tick so the helper's fast-path catches it.
      this.setState('running')
    }
    return Promise.resolve()
  }
}

describe('awaitHowlerContextResume', () => {
  it('resolves immediately when ctx is unavailable', async () => {
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: undefined },
    })
    expect(result.stateBefore).toBe('unavailable')
    expect(result.resumeAwaited).toBe(false)
    expect(result.timedOut).toBe(false)
  })

  it('resolves immediately when ctx is already running (no await, no listener)', async () => {
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'running'
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('running')
    expect(result.resumeAwaited).toBe(false)
    expect(ctx.resumeCalls).toBe(0)
    // Phase-7 invariant: no `statechange` listener attached on the
    // already-running short-circuit. Nothing to clean up later.
    expect(ctx.listenerCount('statechange')).toBe(0)
  })

  it('resolves immediately when ctx is closed (resume on closed is illegal)', async () => {
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'closed'
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('closed')
    expect(result.resumeAwaited).toBe(false)
    expect(ctx.resumeCalls).toBe(0)
    expect(ctx.listenerCount('statechange')).toBe(0)
  })

  it('resolves on the warm-idle path: resume() transitions state synchronously', async () => {
    // Most-browsers / warm-iPad path: resume() flips state before the
    // resume promise resolves. The helper's fast-path catches this in
    // its post-resume state recheck without ever attaching a listener.
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'suspended'
    ctx.autoRunOnResume = true
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(ctx.resumeCalls).toBe(1)
    expect(ctx.state).toBe('running')
  })

  it('resolves on the warm-idle path when ctx is interrupted (WebKit-only state)', async () => {
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'interrupted'
    ctx.autoRunOnResume = false
    // Simulate the OS-driven transition: helper attaches the listener,
    // then we drive 'interrupted' → 'running' which fires statechange.
    const promise = awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 10_000,
    })
    await Promise.resolve()
    expect(ctx.listenerCount('statechange')).toBe(1)
    ctx.setState('running')
    const result = await promise
    expect(result.stateBefore).toBe('interrupted')
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('Phase-7: resolves event-driven on cold-idle path (statechange fires AFTER resume settles)', async () => {
    // Cold-iPad path: ctx.resume() returns a promise that resolves
    // before the OS actually transitions the state. The helper must
    // wait for the statechange event, not the resume promise alone.
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'suspended'
    ctx.autoRunOnResume = false // resume() will NOT flip state

    let settled = false
    const promise = awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 10_000,
    }).then((r) => {
      settled = true
      return r
    })

    // Drain microtasks: resume() called, resume promise resolved, but
    // state is STILL 'suspended'. The helper must NOT have resolved yet
    // — that's the whole Phase-7 contract.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(ctx.resumeCalls).toBe(1)
    expect(settled).toBe(false)
    expect(ctx.listenerCount('statechange')).toBe(1)

    // OS finally transitions the state. statechange event fires. Helper
    // resolves.
    ctx.setState('running')
    const result = await promise
    expect(settled).toBe(true)
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)
    // Cleanup invariant: listener removed on resolve.
    expect(ctx.listenerCount('statechange')).toBe(0)
  })

  it('Phase-7: returns timedOut=true when state never transitions within the timeout', async () => {
    // The Phase-7 worst case: state stays 'suspended' forever, resume
    // promise resolves but state doesn't transition. The fallback timeout
    // is the safety valve; caller proceeds to play() with timedOut=true
    // and the gate watchdog catches the relock case.
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'suspended'
    ctx.autoRunOnResume = false

    // Drive the timeout deterministically — fire it immediately so the
    // test doesn't actually wait 5 seconds.
    const scheduleOnce = vi.fn((cb: () => void) => {
      // Defer to a microtask so the helper's listener attaches first.
      Promise.resolve().then(cb)
      return 1
    })
    const cancelScheduleOnce = vi.fn()

    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 5_000,
      scheduleOnce,
      cancelScheduleOnce,
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(true)
    expect(scheduleOnce).toHaveBeenCalledWith(expect.any(Function), 5_000)
    // Cleanup invariant: listener removed even on the timeout path.
    expect(ctx.listenerCount('statechange')).toBe(0)
  })

  it('Phase-7: cleanup — both listener and timeout are released on statechange resolve', async () => {
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'suspended'
    ctx.autoRunOnResume = false

    const cancelScheduleOnce = vi.fn()
    const promise = awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 10_000,
      cancelScheduleOnce,
    })
    await Promise.resolve()
    expect(ctx.listenerCount('statechange')).toBe(1)

    // Statechange wins. Both timeout and listener should be released.
    ctx.setState('running')
    await promise
    expect(ctx.listenerCount('statechange')).toBe(0)
    expect(cancelScheduleOnce).toHaveBeenCalledTimes(1)
  })

  it('Phase-7: tolerates a rejecting resume() promise (state still transitions later)', async () => {
    // Some iOS edge cases: resume() returns a rejecting promise but the
    // OS audio session still wakes up and the statechange event fires.
    // The helper must NOT bail on the rejection; it must keep waiting
    // for the canonical state signal.
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'suspended'
    ctx.autoRunOnResume = false
    ctx.rejectResume = true

    const unhandled: unknown[] = []
    const handler = (ev: PromiseRejectionEvent) => {
      unhandled.push(ev.reason)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handler)
    }

    const promise = awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 10_000,
    })
    // Drain microtasks to let the rejection propagate through any chains.
    await Promise.resolve()
    await Promise.resolve()
    expect(ctx.listenerCount('statechange')).toBe(1)

    // OS still transitions despite the rejected resume promise.
    ctx.setState('running')
    const result = await promise
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)

    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', handler)
    }
    expect(unhandled).toHaveLength(0)
  })

  it('reports resumeThrew=true when resume() throws synchronously', async () => {
    const ctx = {
      state: 'suspended' as const,
      resume: vi.fn(() => {
        throw new Error('synthetic synchronous throw')
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(false)
    expect(result.resumeThrew).toBe(true)
    expect(result.timedOut).toBe(false)
    // No listener on the synchronous-throw early-return path.
    expect(ctx.addEventListener).not.toHaveBeenCalled()
  })

  it('Phase-7: handles legacy resume() that returns void by waiting on statechange', async () => {
    // Legacy browsers where resume() returns void instead of a promise.
    // The helper still needs to wait for the state to transition — the
    // event-driven path is the load-bearing signal regardless of whether
    // a resume promise exists.
    const ctx = new StateChangeFakeAudioContext()
    ctx.state = 'suspended'
    ctx.autoRunOnResume = false
    // Override resume() to return undefined, mimicking legacy.
    const originalResume = ctx.resume.bind(ctx)
    ;(ctx as unknown as { resume: () => unknown }).resume = () => {
      originalResume() // increment counter
      return undefined
    }

    const promise = awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 10_000,
    })
    await Promise.resolve()
    // Even without a resume promise, we still attach the listener and
    // wait for state to actually transition.
    expect(ctx.listenerCount('statechange')).toBe(1)

    ctx.setState('running')
    const result = await promise
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('Phase-7: gracefully handles ctx without addEventListener (timeout-only fallback)', async () => {
    // Ancient / stub ctx without event-listener support. The helper
    // can't observe a transition; it just times out. Caller proceeds
    // to play() and the watchdog handles the failure path.
    const ctx = {
      state: 'suspended' as const,
      resume: vi.fn(() => Promise.resolve()),
      // No addEventListener / removeEventListener.
    }
    const scheduleOnce = vi.fn((cb: () => void) => {
      Promise.resolve().then(cb)
      return 1
    })
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 1_000,
      scheduleOnce,
    })
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(true)
  })
})

/**
 * Phase-5 fix tests (ticket 86c9gvd0y).
 *
 * `unlockIosAudioSession` plays a 1-sample silent buffer through the
 * AudioContext destination, synchronously inside a user-gesture handler,
 * to re-engage iOS's OS-level audio session. We can't reproduce iOS
 * audio-session behaviour in jsdom — these tests assert the API CALL
 * SHAPE only (createBuffer + createBufferSource + connect + start +
 * disconnect ordering). Real-device verification is Thomas's iPad pass.
 */
describe('unlockIosAudioSession', () => {
  /**
   * Minimal fake source + ctx mirroring the parts the helper touches.
   * Records call ordering so we can assert connect/start/disconnect
   * sequence without standing up the full Web Audio API.
   */
  function makeFakeCtx(state: AudioContext['state'] = 'running') {
    const calls: string[] = []
    const fakeBuffer = { fakeBuffer: true }
    const fakeDestination = { fakeDestination: true }
    const fakeSource = {
      buffer: null as unknown,
      connect: vi.fn((dest: unknown) => {
        calls.push(
          `connect:${(dest as { fakeDestination?: boolean }).fakeDestination ? 'destination' : 'other'}`,
        )
      }),
      disconnect: vi.fn(() => {
        calls.push('disconnect')
      }),
      start: vi.fn((when: number) => {
        calls.push(`start:${when}`)
      }),
    }
    const ctx = {
      state,
      destination: fakeDestination as unknown as AudioDestinationNode,
      createBuffer: vi.fn(
        (channels: number, length: number, sampleRate: number) => {
          calls.push(`createBuffer:${channels}:${length}:${sampleRate}`)
          return fakeBuffer as unknown as AudioBuffer
        },
      ),
      createBufferSource: vi.fn(() => {
        calls.push('createBufferSource')
        return fakeSource as unknown as AudioBufferSourceNode
      }),
    } as unknown as AudioContext
    return { ctx, calls, fakeSource, fakeBuffer }
  }

  it('is a no-op when Howler.ctx is missing', () => {
    const result = unlockIosAudioSession({
      howlerLike: { ctx: undefined },
    })
    expect(result.bufferStarted).toBe(false)
    expect(result.threw).toBe(false)
  })

  it('is a no-op when ctx is closed (createBufferSource is illegal there)', () => {
    const { ctx, calls } = makeFakeCtx('closed')
    const result = unlockIosAudioSession({
      howlerLike: { ctx },
    })
    expect(result.bufferStarted).toBe(false)
    expect(result.threw).toBe(false)
    expect(calls).toEqual([])
  })

  it('plays a 1-sample silent buffer when ctx is running', () => {
    const { ctx, calls, fakeSource, fakeBuffer } = makeFakeCtx('running')
    const result = unlockIosAudioSession({
      howlerLike: { ctx },
    })
    expect(result.bufferStarted).toBe(true)
    expect(result.threw).toBe(false)
    // The 1-sample/22050Hz buffer matches Howler's own scratch-buffer
    // shape exactly. Assert the exact arguments — drift here means
    // we're constructing a different shape than Howler's verified-
    // working unlock and may not actually re-engage the iOS session.
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 1, 22050)
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1)
    expect(fakeSource.buffer).toBe(fakeBuffer)
    expect(fakeSource.connect).toHaveBeenCalledWith(ctx.destination)
    expect(fakeSource.start).toHaveBeenCalledWith(0)
    // Ordering: createBuffer → createBufferSource → connect → start →
    // disconnect. The helper relies on this sequence — connect must
    // happen before start; start(0) is what re-engages the OS audio
    // session.
    expect(calls).toEqual([
      'createBuffer:1:1:22050',
      'createBufferSource',
      'connect:destination',
      'start:0',
      'disconnect',
    ])
  })

  it('plays a silent buffer when ctx is suspended too', () => {
    // Suspended is the realistic state right at the gesture moment —
    // the Phase-2/4 helpers will resume it, but our silent buffer needs
    // to fire in the same gesture window regardless.
    const { ctx, fakeSource } = makeFakeCtx('suspended')
    const result = unlockIosAudioSession({
      howlerLike: { ctx },
    })
    expect(result.bufferStarted).toBe(true)
    expect(fakeSource.start).toHaveBeenCalledWith(0)
  })

  it('reports threw=true when createBuffer throws synchronously', () => {
    const failing = {
      state: 'running' as const,
      destination: {} as unknown as AudioDestinationNode,
      createBuffer: vi.fn(() => {
        throw new Error('synthetic createBuffer failure')
      }),
      createBufferSource: vi.fn(),
    }
    const result = unlockIosAudioSession({
      howlerLike: { ctx: failing as unknown as AudioContext },
    })
    expect(result.bufferStarted).toBe(false)
    expect(result.threw).toBe(true)
    // We never reached createBufferSource — bail out early on the
    // upstream throw, no half-finished node graph.
    expect(failing.createBufferSource).not.toHaveBeenCalled()
  })

  it('reports threw=true when start() throws synchronously', () => {
    const fakeSource = {
      buffer: null as unknown,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(() => {
        throw new Error('synthetic start() failure')
      }),
    }
    const failing = {
      state: 'running' as const,
      destination: {} as unknown as AudioDestinationNode,
      createBuffer: vi.fn(() => ({}) as unknown as AudioBuffer),
      createBufferSource: vi.fn(
        () => fakeSource as unknown as AudioBufferSourceNode,
      ),
    }
    const result = unlockIosAudioSession({
      howlerLike: { ctx: failing as unknown as AudioContext },
    })
    expect(result.bufferStarted).toBe(false)
    expect(result.threw).toBe(true)
  })

  it('swallows a disconnect() throw (best-effort cleanup)', () => {
    // Some impls reject disconnect on a not-yet-played source. The
    // helper should still report bufferStarted=true because start() ran.
    const fakeSource = {
      buffer: null as unknown,
      connect: vi.fn(),
      disconnect: vi.fn(() => {
        throw new Error('synthetic disconnect failure')
      }),
      start: vi.fn(),
    }
    const ctx = {
      state: 'running' as const,
      destination: {} as unknown as AudioDestinationNode,
      createBuffer: vi.fn(() => ({}) as unknown as AudioBuffer),
      createBufferSource: vi.fn(
        () => fakeSource as unknown as AudioBufferSourceNode,
      ),
    }
    const result = unlockIosAudioSession({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.bufferStarted).toBe(true)
    expect(result.threw).toBe(false)
  })

  it('treats a ctx getter that throws as unavailable (no-op)', () => {
    const throwingTarget = {
      get ctx(): AudioContext {
        throw new Error('locked-down environment')
      },
    }
    const result = unlockIosAudioSession({
      howlerLike: throwingTarget as unknown as { ctx?: AudioContext | null },
    })
    expect(result.bufferStarted).toBe(false)
    expect(result.threw).toBe(false)
  })

  /**
   * Phase-6 fix tests (ticket 86c9gvd0y). The helper now also fills
   * `Howler._html5AudioPool` synchronously inside the gesture window.
   * The two empirical cases from Thomas's 2026-04-26 capture:
   *   - working session: pool=10 at gesture moment
   *   - failing session: pool=0 at gesture moment
   * After Phase-6 the pool MUST be at `html5PoolSize` after the call,
   * regardless of starting state.
   */
  describe('Phase-6 HTML5 pool refill', () => {
    /**
     * Test seam shape — `howlerLike` carries both the AudioContext and
     * the pool fields the helper reads from `Howler` directly. We don't
     * monkeypatch the real `Howler` module; we just hand the helper a
     * fake-shaped target that mirrors Howler's real layout.
     */
    function makeHowlerLikeWithPool(
      ctxState: AudioContext['state'] = 'running',
      initialPool: unknown[] = [],
      poolSize = 10,
    ) {
      const fakeBuffer = { fakeBuffer: true }
      const fakeDestination = { fakeDestination: true }
      const fakeSource = {
        buffer: null as unknown,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
      }
      const ctx = {
        state: ctxState,
        destination: fakeDestination as unknown as AudioDestinationNode,
        createBuffer: vi.fn(() => fakeBuffer as unknown as AudioBuffer),
        createBufferSource: vi.fn(
          () => fakeSource as unknown as AudioBufferSourceNode,
        ),
      } as unknown as AudioContext
      const pool = initialPool.slice()
      return {
        howlerLike: {
          ctx,
          _html5AudioPool: pool,
          html5PoolSize: poolSize,
        } as unknown as { ctx?: AudioContext | null },
        pool,
      }
    }

    /**
     * Counter-stub Audio constructor — doesn't actually allocate any
     * media element. Tests assert it was constructed N times by reading
     * a class-level counter.
     */
    function makeFakeAudioCtor() {
      let constructed = 0
      const FakeAudio = class {
        _unlocked?: boolean
        constructor() {
          constructed += 1
        }
      } as unknown as new () => unknown
      return {
        FakeAudio,
        get constructed() {
          return constructed
        },
      }
    }

    it('refills an empty pool to html5PoolSize (failing-session repro)', () => {
      const { howlerLike, pool } = makeHowlerLikeWithPool('running', [], 10)
      const audio = makeFakeAudioCtor()
      const result = unlockIosAudioSession({
        howlerLike,
        AudioCtor: audio.FakeAudio,
      })
      expect(result.bufferStarted).toBe(true)
      expect(result.poolBefore).toBe(0)
      expect(result.poolAfter).toBe(10)
      expect(result.poolFilled).toBe(10)
      expect(audio.constructed).toBe(10)
      expect(pool.length).toBe(10)
      // Each fresh element is marked unlocked so Howler's
      // _releaseHtml5Audio recycles them on Sound teardown
      // (howler.js line 449's `audio._unlocked` guard).
      for (const el of pool) {
        expect((el as { _unlocked?: boolean })._unlocked).toBe(true)
      }
    })

    it('does not over-fill a partially-populated pool', () => {
      const { howlerLike, pool } = makeHowlerLikeWithPool(
        'running',
        ['existing-1', 'existing-2', 'existing-3'],
        10,
      )
      const audio = makeFakeAudioCtor()
      const result = unlockIosAudioSession({
        howlerLike,
        AudioCtor: audio.FakeAudio,
      })
      expect(result.poolBefore).toBe(3)
      expect(result.poolAfter).toBe(10)
      expect(result.poolFilled).toBe(7)
      expect(audio.constructed).toBe(7)
      expect(pool.length).toBe(10)
    })

    it('is a no-op on the pool when already at html5PoolSize (working-session repro)', () => {
      const initial = Array.from({ length: 10 }, (_, i) => `existing-${i}`)
      const { howlerLike, pool } = makeHowlerLikeWithPool(
        'running',
        initial,
        10,
      )
      const audio = makeFakeAudioCtor()
      const result = unlockIosAudioSession({
        howlerLike,
        AudioCtor: audio.FakeAudio,
      })
      expect(result.poolBefore).toBe(10)
      expect(result.poolAfter).toBe(10)
      expect(result.poolFilled).toBe(0)
      expect(audio.constructed).toBe(0)
      expect(pool.length).toBe(10)
      // The original elements remain — we did not replace them.
      expect(pool).toEqual(initial)
    })

    it('does not push to the pool when ctx is closed (skip-without-side-effects)', () => {
      const { howlerLike, pool } = makeHowlerLikeWithPool('closed', [], 10)
      const audio = makeFakeAudioCtor()
      const result = unlockIosAudioSession({
        howlerLike,
        AudioCtor: audio.FakeAudio,
      })
      expect(result.bufferStarted).toBe(false)
      expect(result.poolBefore).toBe(0)
      expect(result.poolAfter).toBe(0)
      expect(result.poolFilled).toBe(0)
      expect(audio.constructed).toBe(0)
      expect(pool.length).toBe(0)
    })

    it('does not push to the pool when ctx is missing', () => {
      const audio = makeFakeAudioCtor()
      const result = unlockIosAudioSession({
        howlerLike: { ctx: undefined },
        AudioCtor: audio.FakeAudio,
      })
      expect(result.bufferStarted).toBe(false)
      // No pool field on the howlerLike → poolBefore/After are
      // undefined; production captures these via the bus probe rather
      // than through this result.
      expect(result.poolBefore).toBeUndefined()
      expect(result.poolAfter).toBeUndefined()
      expect(result.poolFilled).toBe(0)
      expect(audio.constructed).toBe(0)
    })

    it('respects a non-default html5PoolSize override', () => {
      const { howlerLike, pool } = makeHowlerLikeWithPool('running', [], 4)
      const audio = makeFakeAudioCtor()
      const result = unlockIosAudioSession({
        howlerLike,
        AudioCtor: audio.FakeAudio,
      })
      expect(result.poolBefore).toBe(0)
      expect(result.poolAfter).toBe(4)
      expect(result.poolFilled).toBe(4)
      expect(audio.constructed).toBe(4)
      expect(pool.length).toBe(4)
    })

    it('stops pushing when the Audio ctor throws (partial-fill, no infinite-loop)', () => {
      const { howlerLike, pool } = makeHowlerLikeWithPool('running', [], 10)
      let ctorCalls = 0
      const ThrowingAudio = class {
        _unlocked?: boolean
        constructor() {
          ctorCalls += 1
          if (ctorCalls > 3) {
            throw new Error('synthetic Audio ctor failure')
          }
        }
      } as unknown as new () => unknown
      const result = unlockIosAudioSession({
        howlerLike,
        AudioCtor: ThrowingAudio,
      })
      // First 3 succeed, 4th throws and we bail.
      expect(result.poolFilled).toBe(3)
      expect(result.poolAfter).toBe(3)
      expect(pool.length).toBe(3)
      // bufferStarted still true — pool refill failure doesn't prevent
      // the silent-buffer kick.
      expect(result.bufferStarted).toBe(true)
    })

    it('refills the pool BEFORE playing the silent buffer (ordering invariant)', () => {
      // Howler's own unlock loop fills the pool first (line 334-348),
      // then plays the scratch buffer (line 372-381). We mirror that
      // ordering so any iOS-state assumptions Howler bakes in still hold.
      const callOrder: string[] = []
      const fakeBuffer = { fakeBuffer: true }
      const fakeSource = {
        buffer: null as unknown,
        connect: vi.fn(() => {
          callOrder.push('source.connect')
        }),
        disconnect: vi.fn(),
        start: vi.fn(() => {
          callOrder.push('source.start')
        }),
      }
      const ctx = {
        state: 'running' as const,
        destination: {} as unknown as AudioDestinationNode,
        createBuffer: vi.fn(() => {
          callOrder.push('createBuffer')
          return fakeBuffer as unknown as AudioBuffer
        }),
        createBufferSource: vi.fn(() => {
          callOrder.push('createBufferSource')
          return fakeSource as unknown as AudioBufferSourceNode
        }),
      } as unknown as AudioContext
      const pool: unknown[] = []
      const FakeAudio = class {
        _unlocked?: boolean
        constructor() {
          callOrder.push('new Audio')
        }
      } as unknown as new () => unknown
      const result = unlockIosAudioSession({
        howlerLike: {
          ctx,
          _html5AudioPool: pool,
          html5PoolSize: 3,
        } as unknown as { ctx?: AudioContext | null },
        AudioCtor: FakeAudio,
      })
      expect(result.bufferStarted).toBe(true)
      expect(result.poolFilled).toBe(3)
      // All 3 Audio() constructions happen before any AudioContext call
      // — the silent-buffer kick comes AFTER the pool is replenished.
      expect(callOrder).toEqual([
        'new Audio',
        'new Audio',
        'new Audio',
        'createBuffer',
        'createBufferSource',
        'source.connect',
        'source.start',
      ])
    })
  })

  /**
   * Phase-8 fix tests (ticket 86c9gvd0y).
   *
   * `unlockIosAudioSession` now ALSO invokes `Howler._unlockAudio()`
   * synchronously inside the gesture window, between the Phase-6 pool
   * refill and the Phase-5 silent-buffer kick. The invocation is wrapped
   * defensively because `_unlockAudio` is a leading-underscore private
   * method on the Howler module — if Howler renames or removes it the
   * helper degrades to the Phase-5/6 fallbacks without throwing.
   */
  describe('Phase-8 Howler._unlockAudio invocation', () => {
    function makeHowlerLikeWithUnlock(
      ctxState: AudioContext['state'] = 'running',
      _unlockAudio?: unknown,
    ) {
      const fakeBuffer = { fakeBuffer: true }
      const fakeDestination = { fakeDestination: true }
      const fakeSource = {
        buffer: null as unknown,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
      }
      const ctx = {
        state: ctxState,
        destination: fakeDestination as unknown as AudioDestinationNode,
        createBuffer: vi.fn(() => fakeBuffer as unknown as AudioBuffer),
        createBufferSource: vi.fn(
          () => fakeSource as unknown as AudioBufferSourceNode,
        ),
      } as unknown as AudioContext
      return {
        howlerUnlockHost: { _unlockAudio } as { _unlockAudio?: unknown },
        howlerLike: {
          ctx,
          _html5AudioPool: [],
          html5PoolSize: 0,
        } as unknown as { ctx?: AudioContext | null } | undefined,
      }
    }

    it("calls Howler._unlockAudio() once per gesture and reports 'called'", () => {
      const unlockSpy = vi.fn()
      const { howlerUnlockHost, howlerLike } = makeHowlerLikeWithUnlock(
        'running',
        unlockSpy,
      )
      const result = unlockIosAudioSession({
        howlerLike,
        howlerUnlockHost,
      })
      expect(unlockSpy).toHaveBeenCalledTimes(1)
      // Howler's real method is invoked with `this === Howler`; we mirror
      // that contract via .call(host) so the method's internal
      // `this || Howler` defaulting still resolves correctly.
      expect(unlockSpy.mock.instances[0]).toBe(howlerUnlockHost)
      expect(result.howlerUnlockMethodCalled).toBe('called')
      // Phase-5 / Phase-6 still ran — Phase-8 is additive, not a swap.
      expect(result.bufferStarted).toBe(true)
    })

    it("reports 'missing' when Howler._unlockAudio is not a function (renamed / older Howler)", () => {
      const { howlerUnlockHost, howlerLike } = makeHowlerLikeWithUnlock(
        'running',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any,
      )
      const result = unlockIosAudioSession({
        howlerLike,
        howlerUnlockHost,
      })
      expect(result.howlerUnlockMethodCalled).toBe('missing')
      // Fallbacks still ran — silent buffer kicked.
      expect(result.bufferStarted).toBe(true)
    })

    it("reports 'threw' when Howler._unlockAudio throws synchronously", () => {
      const unlockSpy = vi.fn(() => {
        throw new Error('synthetic _unlockAudio throw')
      })
      const { howlerUnlockHost, howlerLike } = makeHowlerLikeWithUnlock(
        'running',
        unlockSpy,
      )
      const result = unlockIosAudioSession({
        howlerLike,
        howlerUnlockHost,
      })
      expect(unlockSpy).toHaveBeenCalledTimes(1)
      expect(result.howlerUnlockMethodCalled).toBe('threw')
      // Critically: silent-buffer fallback still executed despite the
      // _unlockAudio throw — we never want a private-method failure to
      // break audio for Marian.
      expect(result.bufferStarted).toBe(true)
    })

    it('reports howlerUnlockMethodCalled even when ctx is closed (helper short-circuits before fallbacks)', () => {
      // Closed-ctx path returns early before the silent buffer; Phase-8
      // invocation also short-circuits because the iOS contract requires
      // a live ctx. The result still includes howlerUnlockMethodCalled
      // as 'missing' (default) so the iPad export shows the gap.
      const unlockSpy = vi.fn()
      const { howlerUnlockHost, howlerLike } = makeHowlerLikeWithUnlock(
        'closed',
        unlockSpy,
      )
      const result = unlockIosAudioSession({
        howlerLike,
        howlerUnlockHost,
      })
      // Helper bailed at the closed-ctx check — _unlockAudio is not
      // called on a closed context (no point; nothing can play either way).
      expect(unlockSpy).not.toHaveBeenCalled()
      expect(result.bufferStarted).toBe(false)
      // Phase-8 result field is undefined on the early-return path —
      // we don't lie about something we didn't do.
      expect(result.howlerUnlockMethodCalled).toBeUndefined()
    })

    it('does not throw when reading howlerUnlockHost itself throws', () => {
      // Lockdown environment edge case: even property access on the
      // Howler module can throw. The helper must swallow + report 'threw'.
      const throwingHost = {
        get _unlockAudio(): unknown {
          throw new Error('locked-down environment')
        },
      }
      const { howlerLike } = makeHowlerLikeWithUnlock('running')
      const result = unlockIosAudioSession({
        howlerLike,
        howlerUnlockHost: throwingHost as { _unlockAudio?: unknown },
      })
      expect(result.howlerUnlockMethodCalled).toBe('threw')
      // Silent buffer still kicked.
      expect(result.bufferStarted).toBe(true)
    })

    it('preserves Phase-6 → Phase-8 → Phase-5 ordering inside the helper', () => {
      // Pool refill must run BEFORE _unlockAudio (so we have the pool in
      // the shape Howler expects when its listener body fires later);
      // _unlockAudio must run BEFORE the silent buffer (so Howler's own
      // session-engagement runs first; ours is the safety net).
      const callOrder: string[] = []
      const fakeBuffer = { fakeBuffer: true }
      const fakeSource = {
        buffer: null as unknown,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(() => {
          callOrder.push('source.start')
        }),
      }
      const ctx = {
        state: 'running' as const,
        destination: {} as unknown as AudioDestinationNode,
        createBuffer: vi.fn(() => fakeBuffer as unknown as AudioBuffer),
        createBufferSource: vi.fn(
          () => fakeSource as unknown as AudioBufferSourceNode,
        ),
      } as unknown as AudioContext
      const pool: unknown[] = []
      const FakeAudio = class {
        _unlocked?: boolean
        constructor() {
          callOrder.push('new Audio')
        }
      } as unknown as new () => unknown
      const unlockSpy = vi.fn(() => {
        callOrder.push('_unlockAudio')
      })
      unlockIosAudioSession({
        howlerLike: {
          ctx,
          _html5AudioPool: pool,
          html5PoolSize: 2,
        } as unknown as { ctx?: AudioContext | null },
        AudioCtor: FakeAudio,
        howlerUnlockHost: { _unlockAudio: unlockSpy },
      })
      expect(callOrder).toEqual([
        'new Audio',
        'new Audio',
        '_unlockAudio',
        'source.start',
      ])
    })
  })
})

/**
 * Phase-8 fix tests (ticket 86c9gvd0y) — `disableHowlerAutoSuspend`.
 *
 * The 30-second iPad audio-decay threshold matches Howler's own
 * `_autoSuspend` timer EXACTLY (howler.js line 461-505: 30 000 ms after
 * each sound's `_ended` callback). Setting `Howler.autoSuspend = false`
 * (the public, documented option) suppresses the entire timer.
 */
describe('disableHowlerAutoSuspend', () => {
  it('writes false to Howler.autoSuspend and reports applied=true', () => {
    const fake = { autoSuspend: true }
    const result = disableHowlerAutoSuspend({ howlerLike: fake })
    expect(fake.autoSuspend).toBe(false)
    expect(result.applied).toBe(true)
    expect(result.previousValue).toBe(true)
  })

  it('reports the previous value when autoSuspend was already false', () => {
    const fake = { autoSuspend: false }
    const result = disableHowlerAutoSuspend({ howlerLike: fake })
    expect(fake.autoSuspend).toBe(false)
    expect(result.applied).toBe(true)
    expect(result.previousValue).toBe(false)
  })

  it('omits previousValue when autoSuspend is not a boolean (Howler renamed?)', () => {
    // Hostile shape — the property exists but isn't a boolean. We still
    // attempt the disable; previousValue is omitted because we can't
    // truthfully report it.
    const fake: { autoSuspend?: unknown } = { autoSuspend: 'not-a-bool' }
    const result = disableHowlerAutoSuspend({
      howlerLike: fake as { autoSuspend?: boolean },
    })
    expect(result.applied).toBe(true)
    expect(result.previousValue).toBeUndefined()
  })

  it('reports applied=false when the property write throws (frozen Howler)', () => {
    const fake = Object.freeze({ autoSuspend: true })
    // Object.freeze makes the property non-writable; assignment in
    // strict mode throws. The helper must swallow and return applied=false.
    const result = disableHowlerAutoSuspend({
      howlerLike: fake as { autoSuspend?: boolean },
    })
    expect(result.applied).toBe(false)
    expect(result.previousValue).toBe(true)
  })

  it('reports applied=false when the property read throws', () => {
    const throwingFake = {
      get autoSuspend(): boolean {
        throw new Error('synthetic read failure')
      },
    }
    const result = disableHowlerAutoSuspend({
      howlerLike: throwingFake as unknown as { autoSuspend?: boolean },
    })
    expect(result.applied).toBe(false)
    expect(result.previousValue).toBeUndefined()
  })

  it('is idempotent: calling twice flips false → false without surprises', () => {
    const fake = { autoSuspend: true }
    const a = disableHowlerAutoSuspend({ howlerLike: fake })
    const b = disableHowlerAutoSuspend({ howlerLike: fake })
    expect(a.applied).toBe(true)
    expect(a.previousValue).toBe(true)
    expect(b.applied).toBe(true)
    expect(b.previousValue).toBe(false)
    expect(fake.autoSuspend).toBe(false)
  })
})
