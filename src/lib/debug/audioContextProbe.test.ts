import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIO_CTX_LOG_STORAGE_KEY,
  _resetAudioContextProbeForTests,
  activateAudioContextProbe,
  sampleAudioCtxOnTap,
  startAudioContextProbe,
} from './audioContextProbe'
import { _resetForTests, snapshot } from './debugBus'

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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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
      speechSynthLike: null,
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

  it('records synthPaused alongside ctx state when speechSynthLike is provided', () => {
    const ctx = new FakeAudioContext()
    const synth = { paused: false }
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      speechSynthLike: synth,
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })

    expect(snapshot().audioCtxEvents[0]).toMatchObject({
      cause: 'init',
      synthPaused: false,
    })

    synth.paused = true
    vi.advanceTimersByTime(1000)
    expect(snapshot().audioCtxEvents.at(-1)).toMatchObject({
      cause: 'poll',
      synthPaused: true,
    })
    probe.stop()
  })

  it('omits synthPaused when speechSynthLike is null', () => {
    const probe = startAudioContextProbe({
      howlerLike: { ctx: new FakeAudioContext() as unknown as AudioContext },
      speechSynthLike: null,
      pollIntervalMs: 1000,
      pollWindowMs: 90_000,
      storage: null,
    })
    expect(snapshot().audioCtxEvents[0].synthPaused).toBeUndefined()
    probe.stop()
  })

  it('stops idempotently and ignores further timer ticks', () => {
    const ctx = new FakeAudioContext()
    const probe = startAudioContextProbe({
      howlerLike: { ctx: ctx as unknown as AudioContext },
      speechSynthLike: null,
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
        speechSynthLike: null,
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
        speechSynthLike: null,
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
        speechSynthLike: null,
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
})
