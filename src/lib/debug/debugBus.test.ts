import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetForTests,
  readGateState,
  recordAudioCtxEvent,
  recordGateState,
  recordRawTapEvent,
  recordSpeakAttempt,
  recordSpeakStatus,
  recordTap,
  snapshot,
  subscribe,
  type DebugSnapshot,
} from './debugBus'

/**
 * Unit coverage for the diagnostic-only debug bus. The bus is a module-level
 * singleton so every test starts with `_resetForTests` to flush state and
 * listeners — without that, tests would leak state across cases through the
 * shared module-level `state` object and `listeners` Set.
 *
 * Contract notes (asserted below):
 *
 * - Buffers are FIFO with newest at the END of the array. `recordTap` and
 *   `recordRawTapEvent` truncate by keeping the last (MAX-1) entries and
 *   appending the new one. The DebugOverlay reverses on render to display
 *   newest-first; the bus itself does not.
 * - `recordSpeakStatus` is a no-op when no attempt has been recorded yet.
 *   This is deliberate: dropping a status update is cheaper than rendering
 *   a half-formed record.
 * - `subscribe` pushes the current snapshot synchronously to the listener
 *   so the consumer has something to render before the next event fires.
 * - `snapshot()` returns a fresh object with sliced array copies on every
 *   call — mutating the returned object never leaks back into the bus.
 */
describe('debugBus', () => {
  beforeEach(() => {
    _resetForTests()
  })

  afterEach(() => {
    _resetForTests()
  })

  describe('_resetForTests', () => {
    it('clears all snapshot slices to their initial values', () => {
      recordSpeakAttempt('hi', 'queued')
      recordTap('click', 'wake')
      recordRawTapEvent('touchstart', 'wake')
      recordGateState('pending')
      recordAudioCtxEvent({
        timestamp: 1,
        ctxState: 'running',
        cause: 'init',
      })

      _resetForTests()

      expect(snapshot()).toEqual<DebugSnapshot>({
        lastSpeak: null,
        recentTaps: [],
        recentRawEvents: [],
        gateState: null,
        audioCtxState: null,
        audioCtxEvents: [],
      })
    })

    it('removes all listeners so prior subscribers do not receive new events', () => {
      const listener = vi.fn()
      subscribe(listener)
      // subscribe invokes the listener once on attach with the current
      // snapshot; clear that initial call so we only assert post-reset
      // behaviour.
      listener.mockClear()

      _resetForTests()

      recordTap('click', 'wake')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('recordTap MAX_TAPS=5 truncation', () => {
    it('keeps newest-at-end ordering when under the cap', () => {
      recordTap('pointerdown', 'a')
      recordTap('touchend', 'b')
      recordTap('click', 'c')

      const taps = snapshot().recentTaps
      expect(taps).toHaveLength(3)
      expect(taps[0]?.target).toBe('a')
      expect(taps[1]?.target).toBe('b')
      expect(taps[2]?.target).toBe('c')
    })

    it('drops the oldest entry when a 6th tap arrives', () => {
      recordTap('click', 'a')
      recordTap('click', 'b')
      recordTap('click', 'c')
      recordTap('click', 'd')
      recordTap('click', 'e')
      recordTap('click', 'f')

      const taps = snapshot().recentTaps
      expect(taps).toHaveLength(5)
      // Oldest ('a') was dropped. Newest ('f') is at the end.
      expect(taps.map((t) => t.target)).toEqual(['b', 'c', 'd', 'e', 'f'])
    })

    it('caps at exactly 5 even after many pushes', () => {
      for (let i = 0; i < 50; i++) {
        recordTap('click', `tap-${i}`)
      }
      const taps = snapshot().recentTaps
      expect(taps).toHaveLength(5)
      // Last five pushed: tap-45 .. tap-49.
      expect(taps.map((t) => t.target)).toEqual([
        'tap-45',
        'tap-46',
        'tap-47',
        'tap-48',
        'tap-49',
      ])
    })

    it('records type, target, and a timestamp on each entry', () => {
      const before = Date.now()
      recordTap('touchend', 'wake-target')
      const after = Date.now()

      const tap = snapshot().recentTaps[0]
      expect(tap).toBeDefined()
      expect(tap?.type).toBe('touchend')
      expect(tap?.target).toBe('wake-target')
      expect(tap?.timestamp).toBeGreaterThanOrEqual(before)
      expect(tap?.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('recordRawTapEvent MAX_RAW_EVENTS=8 truncation', () => {
    it('keeps newest-at-end ordering when under the cap', () => {
      recordRawTapEvent('touchstart', 'a')
      recordRawTapEvent('touchend', 'b')
      recordRawTapEvent('pointerdown', 'c')

      const events = snapshot().recentRawEvents
      expect(events).toHaveLength(3)
      expect(events.map((e) => e.target)).toEqual(['a', 'b', 'c'])
    })

    it('drops the oldest entry when a 9th raw event arrives', () => {
      for (let i = 0; i < 9; i++) {
        recordRawTapEvent('touchstart', `r-${i}`)
      }
      const events = snapshot().recentRawEvents
      expect(events).toHaveLength(8)
      // Oldest (r-0) dropped; newest (r-8) at end.
      expect(events.map((e) => e.target)).toEqual([
        'r-1',
        'r-2',
        'r-3',
        'r-4',
        'r-5',
        'r-6',
        'r-7',
        'r-8',
      ])
    })

    it('caps at exactly 8 even after many pushes', () => {
      for (let i = 0; i < 100; i++) {
        recordRawTapEvent('click', `e-${i}`)
      }
      const events = snapshot().recentRawEvents
      expect(events).toHaveLength(8)
      expect(events[0]?.target).toBe('e-92')
      expect(events[7]?.target).toBe('e-99')
    })

    it('records type, target, and a timestamp on each entry', () => {
      const before = Date.now()
      recordRawTapEvent('pointerdown', 'wake-target')
      const after = Date.now()

      const ev = snapshot().recentRawEvents[0]
      expect(ev).toBeDefined()
      expect(ev?.type).toBe('pointerdown')
      expect(ev?.target).toBe('wake-target')
      expect(ev?.timestamp).toBeGreaterThanOrEqual(before)
      expect(ev?.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('recordSpeakAttempt / recordSpeakStatus lifecycle', () => {
    it('records a fresh attempt with timestamp and status', () => {
      const before = Date.now()
      recordSpeakAttempt('Hi! I am Melody.', 'queued')
      const after = Date.now()

      const last = snapshot().lastSpeak
      expect(last).not.toBeNull()
      expect(last?.text).toBe('Hi! I am Melody.')
      expect(last?.status).toBe('queued')
      expect(last?.error).toBeUndefined()
      expect(last?.timestamp).toBeGreaterThanOrEqual(before)
      expect(last?.timestamp).toBeLessThanOrEqual(after)
    })

    it('replaces lastSpeak entirely on a second attempt', () => {
      recordSpeakAttempt('first', 'queued')
      recordSpeakAttempt('second', 'queued')
      expect(snapshot().lastSpeak?.text).toBe('second')
    })

    it('progresses queued -> started -> ended via recordSpeakStatus', () => {
      recordSpeakAttempt('Hi', 'queued')
      expect(snapshot().lastSpeak?.status).toBe('queued')

      recordSpeakStatus('started')
      expect(snapshot().lastSpeak?.status).toBe('started')
      expect(snapshot().lastSpeak?.text).toBe('Hi')

      recordSpeakStatus('ended')
      expect(snapshot().lastSpeak?.status).toBe('ended')
      // Text and timestamp survive the status updates.
      expect(snapshot().lastSpeak?.text).toBe('Hi')
    })

    it('progresses queued -> errored carrying an error message', () => {
      recordSpeakAttempt('Hi', 'queued')
      recordSpeakStatus('errored', 'audio-busy')
      const last = snapshot().lastSpeak
      expect(last?.status).toBe('errored')
      expect(last?.error).toBe('audio-busy')
      expect(last?.text).toBe('Hi')
    })

    it('preserves a previous error when status is updated without a new error message', () => {
      recordSpeakAttempt('Hi', 'queued', 'init-error')
      recordSpeakStatus('errored')
      // status was provided, error was not — previous error is retained.
      expect(snapshot().lastSpeak?.error).toBe('init-error')
    })

    it('is a no-op when recordSpeakStatus is called before any attempt', () => {
      recordSpeakStatus('started')
      expect(snapshot().lastSpeak).toBeNull()
    })
  })

  describe('recordGateState', () => {
    it('updates the gate-state snapshot field', () => {
      expect(snapshot().gateState).toBeNull()
      recordGateState('pending')
      expect(snapshot().gateState).toBe('pending')
      recordGateState('unlocked')
      expect(snapshot().gateState).toBe('unlocked')
      recordGateState('relock')
      expect(snapshot().gateState).toBe('relock')
    })

    it('is readable via the readGateState accessor', () => {
      expect(readGateState()).toBeNull()
      recordGateState('pending')
      expect(readGateState()).toBe('pending')
      recordGateState('idle')
      expect(readGateState()).toBe('idle')
    })
  })

  describe('recordAudioCtxEvent', () => {
    it('updates audioCtxState to the most-recent ctxState and appends to the rolling log', () => {
      expect(snapshot().audioCtxState).toBeNull()

      recordAudioCtxEvent({
        timestamp: 1,
        ctxState: 'running',
        cause: 'init',
      })
      expect(snapshot().audioCtxState).toBe('running')
      expect(snapshot().audioCtxEvents).toHaveLength(1)

      recordAudioCtxEvent({
        timestamp: 2,
        ctxState: 'suspended',
        cause: 'statechange',
      })
      expect(snapshot().audioCtxState).toBe('suspended')
      expect(snapshot().audioCtxEvents).toHaveLength(2)
      // Newest-at-end FIFO.
      expect(snapshot().audioCtxEvents[1]?.cause).toBe('statechange')
    })

    it('caps the rolling log at 128 entries', () => {
      for (let i = 0; i < 200; i++) {
        recordAudioCtxEvent({
          timestamp: i,
          ctxState: 'running',
          cause: 'poll',
        })
      }
      const events = snapshot().audioCtxEvents
      expect(events).toHaveLength(128)
      // Oldest 72 dropped; first surviving entry has timestamp 72, last has 199.
      expect(events[0]?.timestamp).toBe(72)
      expect(events[127]?.timestamp).toBe(199)
    })
  })

  describe('subscribe / unsubscribe', () => {
    it('pushes the current snapshot synchronously on attach', () => {
      recordGateState('pending')
      const listener = vi.fn()
      subscribe(listener)
      expect(listener).toHaveBeenCalledTimes(1)
      const arg = listener.mock.calls[0]?.[0] as DebugSnapshot
      expect(arg.gateState).toBe('pending')
    })

    it('notifies on every record* call', () => {
      const listener = vi.fn()
      subscribe(listener)
      listener.mockClear()

      recordTap('click', 'a')
      recordRawTapEvent('touchstart', 'a')
      recordSpeakAttempt('hi', 'queued')
      recordSpeakStatus('started')
      recordGateState('unlocked')
      recordAudioCtxEvent({ timestamp: 1, ctxState: 'running', cause: 'poll' })

      // 6 calls: each record* triggers exactly one notify.
      expect(listener).toHaveBeenCalledTimes(6)
    })

    it('does not notify after the unsubscribe function is invoked', () => {
      const listener = vi.fn()
      const unsubscribe = subscribe(listener)
      listener.mockClear()

      unsubscribe()
      recordTap('click', 'a')

      expect(listener).not.toHaveBeenCalled()
    })

    it('isolates listeners — one unsubscribing does not silence the others', () => {
      const a = vi.fn()
      const b = vi.fn()
      const unsubscribeA = subscribe(a)
      subscribe(b)
      a.mockClear()
      b.mockClear()

      unsubscribeA()
      recordTap('click', 'x')

      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalledTimes(1)
    })

    it('does not let a throwing listener break sibling listeners during notify', () => {
      // Contract: `notify()` (called by every record*) tolerates listener
      // throws so a misbehaving overlay subscriber cannot take down TTS or
      // tap handlers. The initial-snapshot push inside `subscribe()` itself
      // is unguarded by design — listeners must accept their first snapshot
      // cleanly — so this test only asserts the notify-path guarantee.
      const sibling = vi.fn()
      let attached = false
      subscribe(() => {
        if (!attached) {
          // First invocation is the initial-snapshot push; let it through.
          attached = true
          return
        }
        throw new Error('listener-blew-up')
      })
      subscribe(sibling)
      sibling.mockClear()

      expect(() => recordTap('click', 'wake')).not.toThrow()
      expect(sibling).toHaveBeenCalledTimes(1)
    })

    it('hands the listener a snapshot whose array slices are independent copies', () => {
      recordTap('click', 'a')

      let captured: DebugSnapshot | null = null
      subscribe((snap) => {
        captured = snap
      })

      // Mutate the snapshot the listener received.
      expect(captured).not.toBeNull()
      ;(captured as DebugSnapshot | null)?.recentTaps.push({
        type: 'click',
        timestamp: 999,
        target: 'mutated',
      })

      // Push another tap; the bus should report only the genuine taps,
      // not the mutated extra entry the listener tried to inject.
      recordTap('click', 'b')
      const taps = snapshot().recentTaps
      expect(taps.map((t) => t.target)).toEqual(['a', 'b'])
    })
  })

  describe('snapshot() immutability', () => {
    it('returns array slices that can be mutated without affecting the bus', () => {
      recordTap('click', 'a')
      recordRawTapEvent('touchstart', 'a')
      recordAudioCtxEvent({ timestamp: 1, ctxState: 'running', cause: 'init' })

      const snap = snapshot()
      snap.recentTaps.push({ type: 'click', timestamp: 9, target: 'inject' })
      snap.recentRawEvents.push({
        type: 'click',
        timestamp: 9,
        target: 'inject',
      })
      snap.audioCtxEvents.push({
        timestamp: 9,
        ctxState: 'closed',
        cause: 'poll',
      })

      const fresh = snapshot()
      expect(fresh.recentTaps.map((t) => t.target)).toEqual(['a'])
      expect(fresh.recentRawEvents.map((e) => e.target)).toEqual(['a'])
      expect(fresh.audioCtxEvents).toHaveLength(1)
      expect(fresh.audioCtxEvents[0]?.cause).toBe('init')
    })

    it('returns a fresh object on each call (different reference)', () => {
      recordGateState('pending')
      const a = snapshot()
      const b = snapshot()
      expect(a).not.toBe(b)
      expect(a.recentTaps).not.toBe(b.recentTaps)
      expect(a.recentRawEvents).not.toBe(b.recentRawEvents)
      expect(a.audioCtxEvents).not.toBe(b.audioCtxEvents)
      // Value equality still holds.
      expect(a).toEqual(b)
    })
  })
})
