import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIO_CTX_LOG_STORAGE_KEY,
  _resetAudioContextProbeForTests,
  activateAudioContextProbe,
  recordHandlerErrorEvent,
  recordSpeakCallEvent,
  recordSpeakOnPlayEvent,
  recordSpeakSkippedEvent,
  recordUnlockStateEvent,
  sampleAudioCtxOnTap,
  startAudioContextProbe,
} from './audioContextProbe'
import { _resetForTests, recordGateState, snapshot } from './debugBus'

/**
 * Minimal AudioContext stub that lets tests flip `state` and dispatch a
 * `statechange` event the same way WebKit does.
 */
class FakeAudioContext {
  state: 'running' | 'suspended' | 'interrupted' | 'closed' = 'running'
  private listeners: Map<string, Set<EventListener>> = new Map()

  addEventListener(type: string, listener: EventListener): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  /** Test helper — flip state and fire statechange the way iOS does. */
  setState(newState: typeof this.state): void {
    this.state = newState
    for (const l of this.listeners.get('statechange') ?? []) {
      try {
        l(new Event('statechange'))
      } catch {
        // ignore listener errors in tests
      }
    }
  }
}

interface InMemoryStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  store: Map<string, string>
}

function makeStorage(): InMemoryStorage {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, v)
    },
    removeItem: (k) => {
      store.delete(k)
    },
  }
}

describe('audioContextProbe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetForTests()
    _resetAudioContextProbeForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    _resetForTests()
    _resetAudioContextProbeForTests()
  })

  it('emits an init sample with `unavailable` when Howler.ctx is missing at start', () => {
    const probe = startAudioContextProbe({
      howlerLike: { ctx: undefined },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })
    const snap = snapshot()
    expect(snap.audioCtxEvents).toHaveLength(1)
    expect(snap.audioCtxEvents[0].cause).toBe('init')
    expect(snap.audioCtxEvents[0].ctxState).toBe('unavailable')
    expect(snap.audioCtxState).toBe('unavailable')
    probe.stop()
  })

  it('emits an init sample with `running` when Howler.ctx is present at start', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })
    const snap = snapshot()
    expect(snap.audioCtxEvents[0]).toMatchObject({
      cause: 'init',
      ctxState: 'running',
    })
    probe.stop()
  })

  it('polls at the configured interval and records a sample per tick', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 5000,
      storage: null,
    })

    // init sample on start.
    expect(snapshot().audioCtxEvents).toHaveLength(1)

    vi.advanceTimersByTime(1000)
    expect(snapshot().audioCtxEvents).toHaveLength(2)
    expect(snapshot().audioCtxEvents[1].cause).toBe('poll')

    vi.advanceTimersByTime(2000)
    expect(snapshot().audioCtxEvents).toHaveLength(4)
    probe.stop()
  })

  it('captures statechange events from the AudioContext', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })

    // Simulate iOS firing statechange to suspended (the hypothesis under
    // test for ticket 86c9gvd0y).
    ctx.setState('suspended')

    const events = snapshot().audioCtxEvents
    const stateChangeEvent = events.find((e) => e.cause === 'statechange')
    expect(stateChangeEvent).toBeDefined()
    expect(stateChangeEvent?.ctxState).toBe('suspended')
    expect(snapshot().audioCtxState).toBe('suspended')
    probe.stop()
  })

  it('maps the WebKit-only `interrupted` state through to the bus', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })
    ctx.setState('interrupted')
    expect(snapshot().audioCtxState).toBe('interrupted')
    probe.stop()
  })

  it('attaches the statechange listener lazily once Howler.ctx appears', () => {
    const howlerLike: { ctx?: AudioContext } = { ctx: undefined }
    const probe = startAudioContextProbe({
      howlerLike,
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })

    // First poll — still no ctx.
    vi.advanceTimersByTime(1000)
    expect(snapshot().audioCtxState).toBe('unavailable')

    // Howler initializes between ticks (e.g. first play() lands).
    const ctx = new FakeAudioContext()
    howlerLike.ctx = ctx as unknown as AudioContext

    vi.advanceTimersByTime(1000)
    expect(snapshot().audioCtxState).toBe('running')

    // Statechange now wired.
    ctx.setState('suspended')
    expect(snapshot().audioCtxState).toBe('suspended')
    expect(
      snapshot().audioCtxEvents.some((e) => e.cause === 'statechange'),
    ).toBe(true)
    probe.stop()
  })

  it('stops polling at the pollWindowMs mark but keeps recording statechange', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 3000,
      storage: null,
    })

    vi.advanceTimersByTime(3500)
    const beforeManualEvents = snapshot().audioCtxEvents.length
    // Past the window — no more poll samples.
    vi.advanceTimersByTime(5000)
    expect(snapshot().audioCtxEvents.length).toBe(beforeManualEvents)

    // But statechange still records.
    ctx.setState('suspended')
    expect(snapshot().audioCtxEvents.length).toBe(beforeManualEvents + 1)
    expect(snapshot().audioCtxEvents.at(-1)?.cause).toBe('statechange')
    probe.stop()
  })

  it('writes samples to localStorage under the documented key', () => {
    const storage = makeStorage()
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage,
    })

    // After the init sample, the log should have one entry.
    const raw = storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as Array<{
      cause: string
      ctxState: string
    }>
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({ cause: 'init', ctxState: 'running' })

    // Statechange + poll add to the log.
    ctx.setState('suspended')
    vi.advanceTimersByTime(1000)
    const parsed2 = JSON.parse(
      storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)!,
    ) as Array<{ cause: string }>
    expect(parsed2.length).toBeGreaterThanOrEqual(3)
    expect(parsed2.some((r) => r.cause === 'statechange')).toBe(true)
    expect(parsed2.some((r) => r.cause === 'poll')).toBe(true)
    probe.stop()
  })

  it('rotates the localStorage log at maxLogEntries', () => {
    const storage = makeStorage()
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 100,
      pollWindowMs: 10_000,
      storage,
      maxLogEntries: 4,
    })

    // 1 init + many polls. 4 cap.
    vi.advanceTimersByTime(1000) // 10 polls
    const parsed = JSON.parse(
      storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)!,
    ) as Array<unknown>
    expect(parsed.length).toBe(4)
    probe.stop()
  })

  it('clears the localStorage log on probe start so a new capture is contiguous', () => {
    const storage = makeStorage()
    storage.setItem(
      AUDIO_CTX_LOG_STORAGE_KEY,
      JSON.stringify([
        { timestamp: 1, ctxState: 'running', cause: 'poll' },
        { timestamp: 2, ctxState: 'suspended', cause: 'statechange' },
      ]),
    )

    const probe = startAudioContextProbe({
      howlerLike: { ctx: new FakeAudioContext() as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage,
    })

    const parsed = JSON.parse(
      storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)!,
    ) as Array<{ cause: string }>
    // Only the new probe's init sample — the prior log was wiped.
    expect(parsed).toHaveLength(1)
    expect(parsed[0].cause).toBe('init')
    probe.stop()
  })

  it('stops idempotently and ignores further timer ticks', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })
    probe.stop()
    probe.stop()
    const before = snapshot().audioCtxEvents.length
    vi.advanceTimersByTime(5000)
    expect(snapshot().audioCtxEvents.length).toBe(before)
    // Statechange after stop should also be a no-op.
    ctx.setState('suspended')
    expect(snapshot().audioCtxEvents.length).toBe(before)
  })

  describe('sampleAudioCtxOnTap singleton', () => {
    it('returns `unavailable` and records nothing when no probe is active', () => {
      const before = snapshot().audioCtxEvents.length
      expect(sampleAudioCtxOnTap()).toBe('unavailable')
      expect(snapshot().audioCtxEvents.length).toBe(before)
    })

    it('records a tap-cause sample synchronously when a probe is active', () => {
      const ctx = new FakeAudioContext()
      activateAudioContextProbe({
        howlerLike: { ctx: ctx as unknown as AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      ctx.state = 'suspended'
      const result = sampleAudioCtxOnTap()
      expect(result).toBe('suspended')

      const events = snapshot().audioCtxEvents
      expect(events.at(-1)).toMatchObject({
        cause: 'tap',
        ctxState: 'suspended',
      })
    })

    it('replaces the prior probe when activate is called twice', () => {
      const ctx1 = new FakeAudioContext()
      activateAudioContextProbe({
        howlerLike: { ctx: ctx1 as unknown as AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      // Second activation — previous probe should be stopped, new one
      // started against the new ctx.
      const ctx2 = new FakeAudioContext()
      ctx2.state = 'interrupted'
      activateAudioContextProbe({
        howlerLike: { ctx: ctx2 as unknown as AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      expect(sampleAudioCtxOnTap()).toBe('interrupted')

      // The first ctx's statechange should NOT propagate to the bus
      // anymore (its listener was detached).
      const beforeFirstFire = snapshot().audioCtxEvents.length
      ctx1.setState('suspended')
      expect(snapshot().audioCtxEvents.length).toBe(beforeFirstFire)
    })
  })

  describe('Phase-3 (ticket 86c9gvd0y) — gateState mirror + speak instrumentation', () => {
    it('attaches the latest gateState to every emitted record once the gate has reported', () => {
      const ctx = new FakeAudioContext()
      const probe = startAudioContextProbe({
        howlerLike: { ctx: ctx as unknown as AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      // Before the gate has reported, records carry no gateState — we
      // omit the field rather than fabricate a value.
      expect(snapshot().audioCtxEvents[0].gateState).toBeUndefined()

      // Gate transitions and pushes its state into the bus (mirrors what
      // `useAudioUnlockGate` does on every state change).
      recordGateState('pending')
      vi.advanceTimersByTime(1000)
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'poll',
        gateState: 'pending',
      })

      recordGateState('relock')
      ctx.setState('suspended')
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'statechange',
        gateState: 'relock',
      })
      probe.stop()
    })

    it('records a speak-call row carrying the soundId and lineKey', () => {
      const ctx = new FakeAudioContext()
      activateAudioContextProbe({
        howlerLike: { ctx: ctx as unknown as AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordSpeakCallEvent(42, 'hi')
      const row = snapshot().audioCtxEvents.at(-1)
      expect(row).toMatchObject({
        cause: 'speak-call',
        ctxState: 'running',
        speakResult: 42,
        lineKey: 'hi',
      })
      // Phase-4 cleanup (ticket 86c9gvd0y): speak-call rows MUST NOT
      // emit `skipReason` — that field is reserved for speak-skipped
      // rows. A regression here would be the bug we just fixed.
      expect(row).not.toHaveProperty('skipReason')
    })

    it('records a speak-call row with speakResult=null when play threw', () => {
      activateAudioContextProbe({
        howlerLike: {
          ctx: new FakeAudioContext() as unknown as AudioContext,
        },

        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordSpeakCallEvent(null, 'imMelody')
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'speak-call',
        speakResult: null,
        lineKey: 'imMelody',
      })
    })

    it('records a speak-onplay row for the Howler `play` event arrival', () => {
      activateAudioContextProbe({
        howlerLike: {
          ctx: new FakeAudioContext() as unknown as AudioContext,
        },

        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordSpeakOnPlayEvent('niceToMeet')
      const row = snapshot().audioCtxEvents.at(-1)
      expect(row).toMatchObject({
        cause: 'speak-onplay',
        lineKey: 'niceToMeet',
      })
      // Phase-4 cleanup: same reservation — speak-onplay carries lineKey,
      // not skipReason.
      expect(row).not.toHaveProperty('skipReason')
    })

    it('records a speak-skipped row carrying the early-return reason', () => {
      activateAudioContextProbe({
        howlerLike: {
          ctx: new FakeAudioContext() as unknown as AudioContext,
        },

        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordSpeakSkippedEvent('non-wake-dispatch-not-consumed')
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'speak-skipped',
        skipReason: 'non-wake-dispatch-not-consumed',
      })
    })

    it('records a handler-error row carrying the Error message', () => {
      activateAudioContextProbe({
        howlerLike: {
          ctx: new FakeAudioContext() as unknown as AudioContext,
        },

        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordHandlerErrorEvent(new Error('kaboom'))
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'handler-error',
        errorMessage: 'kaboom',
      })
    })

    it('records a handler-error row with a fallback message for non-Error throws', () => {
      activateAudioContextProbe({
        howlerLike: {
          ctx: new FakeAudioContext() as unknown as AudioContext,
        },

        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordHandlerErrorEvent('string-throw')
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'handler-error',
        errorMessage: 'string-throw',
      })

      recordHandlerErrorEvent({ weird: true })
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'handler-error',
        errorMessage: '(non-Error thrown)',
      })
    })

    it('all four singleton Phase-3 wrappers are no-ops when no probe is active', () => {
      // No activate call. Each wrapper should silently no-op.
      const before = snapshot().audioCtxEvents.length
      recordSpeakCallEvent(7, 'hi')
      recordSpeakOnPlayEvent('hi')
      recordSpeakSkippedEvent('whatever')
      recordHandlerErrorEvent(new Error('nope'))
      // Phase-5 wrapper too — same no-op contract.
      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.length).toBe(before)
    })

    it('Phase-3 records are persisted to localStorage alongside poll/tap rows', () => {
      const storage = makeStorage()
      activateAudioContextProbe({
        howlerLike: {
          ctx: new FakeAudioContext() as unknown as AudioContext,
        },

        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage,
      })

      recordSpeakSkippedEvent('wake-in-flight-guard')
      recordSpeakCallEvent(99, 'tapHeart')
      recordHandlerErrorEvent(new Error('boom'))
      recordSpeakOnPlayEvent('tapHeart')

      const parsed = JSON.parse(
        storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)!,
      ) as Array<{ cause: string }>
      const causes = parsed.map((r) => r.cause)
      expect(causes).toContain('speak-skipped')
      expect(causes).toContain('speak-call')
      expect(causes).toContain('handler-error')
      expect(causes).toContain('speak-onplay')
    })
  })

  describe('Phase-5 (ticket 86c9gvd0y) — Howler unlock-state diagnostic', () => {
    it('records an unlock-state row carrying Howler audio-unlock flags', () => {
      // Compose a fake Howler-shaped object that exposes the same
      // private flags Howler uses. The probe defensively reads them via
      // the howlerLike override (we test the override path here; the
      // production path reads the same fields off the real `Howler`).
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        _audioUnlocked: true,
        _html5AudioPool: ['a', 'b', 'c'],
        _scratchBuffer: { fakeScratch: true },
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'unlock-state',
        howlerAudioUnlocked: true,
        howlerHtml5PoolSize: 3,
        howlerHasScratchBuffer: true,
      })
    })

    it('records the false / empty / null shapes correctly', () => {
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        _audioUnlocked: false,
        _html5AudioPool: [],
        _scratchBuffer: null,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'unlock-state',
        howlerAudioUnlocked: false,
        howlerHtml5PoolSize: 0,
        howlerHasScratchBuffer: false,
      })
    })

    it('omits flag fields when Howler hasnt populated them', () => {
      // Mid-init Howler exposes ctx but not yet the unlock fields. The
      // probe should record an unlock-state row anyway with no flag
      // fields, so the export-log timeline isn't broken.
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      const last = snapshot().audioCtxEvents.at(-1)!
      expect(last.cause).toBe('unlock-state')
      expect(last).not.toHaveProperty('howlerAudioUnlocked')
      expect(last).not.toHaveProperty('howlerHtml5PoolSize')
      // hasScratchBuffer is set unconditionally in the helper because
      // `null` (the field absent) maps to `false` cleanly. Acceptable
      // to surface that as an explicit `false`.
      expect(last.howlerHasScratchBuffer).toBe(false)
    })

    it('persists unlock-state rows to localStorage with their flag fields', () => {
      const storage = makeStorage()
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        _audioUnlocked: true,
        _html5AudioPool: ['x', 'y'],
        _scratchBuffer: { fake: true },
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage,
      })

      recordUnlockStateEvent()
      const parsed = JSON.parse(
        storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)!,
      ) as Array<{
        cause: string
        howlerAudioUnlocked?: boolean
        howlerHtml5PoolSize?: number
        howlerHasScratchBuffer?: boolean
      }>
      const unlockRows = parsed.filter((r) => r.cause === 'unlock-state')
      expect(unlockRows).toHaveLength(1)
      expect(unlockRows[0]).toMatchObject({
        cause: 'unlock-state',
        howlerAudioUnlocked: true,
        howlerHtml5PoolSize: 2,
        howlerHasScratchBuffer: true,
      })
    })
  })

  /**
   * Phase-8 fix tests (ticket 86c9gvd0y).
   *
   * The unlock-state row now also captures `Howler.state` (the Howler-
   * internal state machine, NOT `AudioContext.state`), `Howler.autoSuspend`
   * (should be `false` post-Phase-8 boot), and a producer-supplied
   * `howlerUnlockMethodCalled` outcome from `unlockIosAudioSession`.
   */
  describe('Phase-8 (ticket 86c9gvd0y) — Howler state + autoSuspend in unlock-state row', () => {
    it('records Howler.state and Howler.autoSuspend when present', () => {
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        _audioUnlocked: true,
        _html5AudioPool: ['a'],
        _scratchBuffer: { fake: true },
        state: 'running' as const,
        autoSuspend: false,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'unlock-state',
        howlerState: 'running',
        howlerAutoSuspend: false,
      })
    })

    it("records Howler.state === 'suspended' when the autoSuspend timer fired (failing-session repro)", () => {
      // The pre-Phase-8 failing case: autoSuspend ran the timer, flipped
      // Howler.state to 'suspended' even though ctx.state is 'running'
      // because we resumed it upstream via Phase-7. The unlock-state
      // row pairs this with the iPad export so the diagnostic delta is
      // unambiguous.
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        _audioUnlocked: true,
        _html5AudioPool: [],
        _scratchBuffer: null,
        state: 'suspended' as const,
        autoSuspend: true, // not yet disabled — this is the bug shape
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'unlock-state',
        howlerState: 'suspended',
        howlerAutoSuspend: true,
      })
    })

    it("buckets unknown Howler.state values into 'unavailable'", () => {
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        state: 'definitely-not-a-real-state',
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.at(-1)?.howlerState).toBe('unavailable')
    })

    it('omits howlerState / howlerAutoSuspend when Howler does not expose them', () => {
      // Pre-Howler-init or stripped-down stub. Probe records the row
      // anyway with no Howler.state / autoSuspend fields, so missing
      // data is unambiguous in the export.
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      const last = snapshot().audioCtxEvents.at(-1)!
      expect(last).not.toHaveProperty('howlerState')
      expect(last).not.toHaveProperty('howlerAutoSuspend')
    })

    it('threads producer-supplied howlerUnlockMethodCalled into the row', () => {
      // Producers (Greet/Math/WordSong gesture handlers) call
      // unlockIosAudioSession() and pass the resulting
      // `howlerUnlockMethodCalled` field to recordUnlockStateEvent so
      // the iPad export shows whether Howler._unlockAudio() was reachable
      // / called / threw on this gesture.
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        state: 'running' as const,
        autoSuspend: false,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent({ howlerUnlockMethodCalled: 'called' })
      expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
        cause: 'unlock-state',
        howlerUnlockMethodCalled: 'called',
      })

      recordUnlockStateEvent({ howlerUnlockMethodCalled: 'missing' })
      expect(snapshot().audioCtxEvents.at(-1)?.howlerUnlockMethodCalled).toBe(
        'missing',
      )

      recordUnlockStateEvent({ howlerUnlockMethodCalled: 'threw' })
      expect(snapshot().audioCtxEvents.at(-1)?.howlerUnlockMethodCalled).toBe(
        'threw',
      )
    })

    it('omits howlerUnlockMethodCalled when no producer extra is passed', () => {
      // Pre-call snapshots (the "before unlockIosAudioSession" rows) call
      // recordUnlockStateEvent() with no args — no method-called outcome
      // exists yet at that point. The row must not lie by emitting a
      // stale value.
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage: null,
      })

      recordUnlockStateEvent()
      expect(snapshot().audioCtxEvents.at(-1)).not.toHaveProperty(
        'howlerUnlockMethodCalled',
      )
    })

    it('persists Phase-8 fields to localStorage alongside the rest of the row', () => {
      const storage = makeStorage()
      const fakeHowler = {
        ctx: new FakeAudioContext() as unknown as AudioContext,
        _audioUnlocked: true,
        _html5AudioPool: ['x', 'y'],
        _scratchBuffer: { fake: true },
        state: 'running' as const,
        autoSuspend: false,
      }
      activateAudioContextProbe({
        howlerLike: fakeHowler as unknown as { ctx?: AudioContext },
        pollIntervalMs: 1000,
        pollWindowMs: 90_000,
        storage,
      })

      recordUnlockStateEvent({ howlerUnlockMethodCalled: 'called' })
      const parsed = JSON.parse(
        storage.getItem(AUDIO_CTX_LOG_STORAGE_KEY)!,
      ) as Array<{
        cause: string
        howlerState?: string
        howlerAutoSuspend?: boolean
        howlerUnlockMethodCalled?: string
      }>
      const unlockRows = parsed.filter((r) => r.cause === 'unlock-state')
      expect(unlockRows).toHaveLength(1)
      expect(unlockRows[0]).toMatchObject({
        cause: 'unlock-state',
        howlerState: 'running',
        howlerAutoSuspend: false,
        howlerUnlockMethodCalled: 'called',
      })
    })
  })
})
