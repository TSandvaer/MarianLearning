import { describe, expect, it, vi } from 'vitest'
import {
  awaitHowlerContextResume,
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
 * Phase-4 fix tests (ticket 86c9gvd0y).
 *
 * `awaitHowlerContextResume` is the awaited counterpart to
 * `resumeHowlerContextOnGesture` — same gesture-context contract but
 * waits for the resume promise to settle (bounded by a timeout) so
 * `Howl.play()` doesn't fire against a still-suspended context.
 */
describe('awaitHowlerContextResume', () => {
  it('resolves immediately when ctx is unavailable', async () => {
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: undefined },
    })
    expect(result.stateBefore).toBe('unavailable')
    expect(result.resumeAwaited).toBe(false)
    expect(result.timedOut).toBe(false)
  })

  it('resolves immediately when ctx is already running (no await)', async () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'running'
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('running')
    expect(result.resumeAwaited).toBe(false)
    expect(ctx.resumeCalls).toBe(0)
  })

  it('resolves immediately when ctx is closed (resume on closed is illegal)', async () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'closed'
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('closed')
    expect(result.resumeAwaited).toBe(false)
    expect(ctx.resumeCalls).toBe(0)
  })

  it('awaits the resume() promise when ctx is suspended', async () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'suspended'
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('awaits the resume() promise when ctx is interrupted (WebKit-only state)', async () => {
    const ctx = new FakeAudioContext()
    ctx.state = 'interrupted'
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('interrupted')
    expect(result.resumeAwaited).toBe(true)
    expect(ctx.resumeCalls).toBe(1)
  })

  it('does not resolve until the resume promise actually settles', async () => {
    // Drive the timeline manually with a controllable resume promise.
    let resolveResume!: () => void
    const resumePromise = new Promise<void>((resolve) => {
      resolveResume = resolve
    })
    const ctx = {
      state: 'suspended' as const,
      resume: vi.fn(() => resumePromise),
    }

    let settled = false
    const promise = awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      // Plenty of headroom — we want to prove the resume is the gating
      // step, not the timeout.
      timeoutMs: 10_000,
    }).then((r) => {
      settled = true
      return r
    })

    // Microtask flush — resume() has been called but the promise is
    // pending, so awaitHowlerContextResume must NOT have resolved yet.
    await Promise.resolve()
    await Promise.resolve()
    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    resolveResume()
    const result = await promise
    expect(settled).toBe(true)
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)
  })

  it('returns timedOut=true when resume() never settles within the timeout', async () => {
    // A resume promise that never resolves — simulating a worst-case
    // iOS edge where the resume promise hangs. The bounded timeout is
    // the safety valve.
    const neverPromise = new Promise<void>(() => {})
    const ctx = {
      state: 'suspended' as const,
      resume: vi.fn(() => neverPromise),
    }

    // Drive the timeout deterministically with an injected scheduler.
    // We fire the timeout immediately so the test doesn't actually wait.
    const scheduleOnce = vi.fn((cb: () => void) => {
      cb()
      return 1
    })
    const cancelScheduleOnce = vi.fn()

    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 500,
      scheduleOnce,
      cancelScheduleOnce,
    })
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(true)
    expect(scheduleOnce).toHaveBeenCalledWith(expect.any(Function), 500)
  })

  it('treats a rejecting resume() promise as settled (not timeout)', async () => {
    const ctx = {
      state: 'suspended' as const,
      resume: vi.fn(() =>
        Promise.reject(new Error('synthetic resume rejection')),
      ),
    }
    // Bind unhandled-rejection probe to verify we swallow the rejection.
    const unhandled: unknown[] = []
    const handler = (ev: PromiseRejectionEvent) => {
      unhandled.push(ev.reason)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handler)
    }

    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      timeoutMs: 10_000,
    })
    expect(result.resumeAwaited).toBe(true)
    expect(result.timedOut).toBe(false)

    // Drain microtasks so any leaked rejection has a chance to fire.
    await Promise.resolve()
    await Promise.resolve()
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
    }
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(false)
    expect(result.resumeThrew).toBe(true)
    expect(result.timedOut).toBe(false)
  })

  it('handles a legacy resume() that returns void (no promise to await)', async () => {
    const ctx = {
      state: 'suspended' as const,
      resume: vi.fn(() => undefined as unknown as Promise<void>),
    }
    const result = await awaitHowlerContextResume({
      howlerLike: { ctx: ctx as unknown as AudioContext },
    })
    // We tried to resume — but there was no promise to wait for. Caller
    // proceeds to play() immediately, which is fine for browsers where
    // resume() takes effect synchronously.
    expect(result.stateBefore).toBe('suspended')
    expect(result.resumeAwaited).toBe(false)
    expect(result.timedOut).toBe(false)
    expect(ctx.resume).toHaveBeenCalledTimes(1)
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
})
