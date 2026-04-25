import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GREET_LINES,
  HEART_REVEAL_AFTER_LINE_INDEX,
  LINE_GAP_MS,
  REPROMPT_AFTER_MS,
  REPROMPT_LINE_INDEX,
  runGreetSequence,
  speakReprompt,
  type SpeakFn,
  type SpeakLikeOptions,
} from './greetSequence'

/**
 * Build a controllable speak() fake. Each call returns a deferred promise
 * the test can resolve/reject manually, plus we capture the args so tests
 * can assert on line ordering and boundary forwarding.
 */
function makeSpeakHarness() {
  const calls: Array<{
    text: string
    opts: SpeakLikeOptions | undefined
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const speak: SpeakFn = (text, opts) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ text, opts, resolve, reject })
    })

  return {
    speak,
    calls,
    /** Resolve the most recent in-flight speak() to simulate line completion. */
    resolveLast() {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending speak() to resolve')
      call.resolve()
    },
    rejectLast(message = 'canceled') {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending speak() to reject')
      call.reject(new Error(message))
    },
  }
}

describe('runGreetSequence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes the four spec lines in order', () => {
    expect(GREET_LINES).toEqual([
      'Hi!',
      "I'm Melody.",
      "It's so nice to meet you.",
      "Tap the heart when you're ready.",
    ])
    expect(HEART_REVEAL_AFTER_LINE_INDEX).toBe(2)
  })

  it('uses 400 ms between lines', () => {
    expect(LINE_GAP_MS).toBe(400)
  })

  it('does NOT speak line 0 on construction — only after start() is called (iPad Safari gesture-gate)', () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    // Construction is the screen-mount tick; we must remain silent here.
    expect(h.calls).toHaveLength(0)
    handle.start()
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].text).toBe('Hi!')
  })

  it('start() is idempotent — calling it twice does not re-speak line 0', () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.start()
    handle.start()
    expect(h.calls).toHaveLength(1)
  })

  it('start(fromIndex) seeds the sequence at the given line — used by the relock retry path', () => {
    // Ticket 86c9gr43t: when line 2 errors, Greet builds a fresh sequence
    // and calls start(2) so Marian retries the failed line rather than
    // re-hearing "Hi!" + "I'm Melody." again.
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.start(2)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].text).toBe(GREET_LINES[2])
  })

  it('start(fromIndex) clamps a negative seed to 0', () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.start(-3)
    expect(h.calls[0].text).toBe(GREET_LINES[0])
  })

  it('start(fromIndex) clamps an out-of-range seed to the last line', () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.start(99)
    expect(h.calls[0].text).toBe(GREET_LINES[GREET_LINES.length - 1])
  })

  it('start() after cancel() is a no-op', () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.cancel()
    handle.start()
    expect(h.calls).toHaveLength(0)
  })

  it('schedules line 1 exactly LINE_GAP_MS after line 0 ends', async () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.start()

    // Resolve line 0 — line 1 should be scheduled, not yet fired.
    await vi.runAllTimersAsync()
    expect(h.calls).toHaveLength(1)
    h.resolveLast()

    // Microtask flush so the .then chain that schedules line 1 runs.
    await Promise.resolve()
    await Promise.resolve()
    expect(h.calls).toHaveLength(1)

    // Just under the gap: still nothing.
    vi.advanceTimersByTime(LINE_GAP_MS - 1)
    expect(h.calls).toHaveLength(1)

    // Cross the gap: line 1 starts.
    vi.advanceTimersByTime(1)
    expect(h.calls).toHaveLength(2)
    expect(h.calls[1].text).toBe("I'm Melody.")
  })

  it('plays all four lines in order with onLineStart/onLineEnd callbacks', async () => {
    const h = makeSpeakHarness()
    const lineStarts: number[] = []
    const lineEnds: number[] = []
    let completed = false

    const handle = runGreetSequence({
      speak: h.speak,
      onLineStart: (i) => lineStarts.push(i),
      onLineEnd: (i) => lineEnds.push(i),
      onComplete: () => {
        completed = true
      },
    })
    handle.start()

    for (let i = 0; i < GREET_LINES.length; i++) {
      // Each iteration: line i is in flight. Resolve it, advance the gap,
      // observe the next line was queued.
      expect(h.calls).toHaveLength(i + 1)
      expect(h.calls[i].text).toBe(GREET_LINES[i])
      h.resolveLast()
      // Flush microtasks then bridge the inter-line gap.
      await Promise.resolve()
      await Promise.resolve()
      if (i < GREET_LINES.length - 1) {
        vi.advanceTimersByTime(LINE_GAP_MS)
      }
    }

    expect(lineStarts).toEqual([0, 1, 2, 3])
    expect(lineEnds).toEqual([0, 1, 2, 3])
    expect(completed).toBe(true)
  })

  it('fires onHeartReady exactly once, after line 2 (the spec heart-reveal line)', async () => {
    const h = makeSpeakHarness()
    const heartFired = vi.fn()

    const handle = runGreetSequence({
      speak: h.speak,
      onHeartReady: heartFired,
    })
    handle.start()

    // Lines 0 + 1: no heart yet.
    h.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
    vi.advanceTimersByTime(LINE_GAP_MS)
    expect(heartFired).not.toHaveBeenCalled()

    h.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
    vi.advanceTimersByTime(LINE_GAP_MS)
    expect(heartFired).not.toHaveBeenCalled()

    // Line 2 ends → heart appears.
    h.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
    expect(heartFired).toHaveBeenCalledTimes(1)

    // Line 3 ends → heart-ready does NOT fire again.
    vi.advanceTimersByTime(LINE_GAP_MS)
    h.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
    expect(heartFired).toHaveBeenCalledTimes(1)
  })

  it('forwards word boundaries to onWordBoundary with the line index', () => {
    const h = makeSpeakHarness()
    const events: Array<{ line: number; word: string }> = []

    const handle = runGreetSequence({
      speak: h.speak,
      onWordBoundary: (line, ev) => events.push({ line, word: ev.word }),
    })
    handle.start()

    h.calls[0].opts?.onBoundary?.({ wordIndex: 0, word: 'Hi!', charIndex: 0 })
    expect(events).toEqual([{ line: 0, word: 'Hi!' }])
  })

  it('cancel() prevents pending lines from being queued', async () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak })
    handle.start()

    h.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
    handle.cancel()
    vi.advanceTimersByTime(LINE_GAP_MS * 5)
    // Only the very first speak() ever fired.
    expect(h.calls).toHaveLength(1)
  })

  it('cancel() suppresses callbacks after cancellation, even if a speak() resolves late', async () => {
    const h = makeSpeakHarness()
    const onLineEnd = vi.fn()
    const handle = runGreetSequence({
      speak: h.speak,
      onLineEnd,
    })
    handle.start()

    handle.cancel()
    h.resolveLast() // late resolve
    await Promise.resolve()
    await Promise.resolve()

    expect(onLineEnd).not.toHaveBeenCalled()
  })

  it('a rejected speak() halts the sequence without throwing', async () => {
    const h = makeSpeakHarness()
    const onComplete = vi.fn()

    const handle = runGreetSequence({ speak: h.speak, onComplete })
    handle.start()

    h.rejectLast('canceled')
    await Promise.resolve()
    await Promise.resolve()
    vi.advanceTimersByTime(LINE_GAP_MS * 5)

    expect(h.calls).toHaveLength(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  describe('onLineError (ticket 86c9gr43t — GBUG-7 silent-halt fix)', () => {
    it('fires onLineError with index + error when a speak() rejects', async () => {
      // The load-bearing test for the silent-halt regression. Pre-86c9gr43t
      // the rejection was caught and discarded; the orchestrator just
      // stopped advancing and the heart never appeared. Now the caller
      // gets the signal so it can route to the gate's relock pathway.
      const h = makeSpeakHarness()
      const onLineError = vi.fn()

      const handle = runGreetSequence({ speak: h.speak, onLineError })
      handle.start()

      h.rejectLast(
        '[preRecorded] loaderror for "/assets/audio/greet/greet-01-hi.mp3"',
      )
      await Promise.resolve()
      await Promise.resolve()

      expect(onLineError).toHaveBeenCalledTimes(1)
      const [index, err] = onLineError.mock.calls[0]
      expect(index).toBe(0)
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toMatch(/loaderror/)
    })

    it('fires onLineError for a mid-sequence failure (not just line 0)', async () => {
      // The actual GBUG-7 repro: line 0 plays fine, line 2's MP3 404s.
      // Without this, only the line-0 failure path got testing.
      const h = makeSpeakHarness()
      const onLineError = vi.fn()
      const onLineEnd = vi.fn()

      const handle = runGreetSequence({
        speak: h.speak,
        onLineError,
        onLineEnd,
      })
      handle.start()

      // Line 0 + 1 succeed.
      h.resolveLast()
      await Promise.resolve()
      await Promise.resolve()
      vi.advanceTimersByTime(LINE_GAP_MS)
      h.resolveLast()
      await Promise.resolve()
      await Promise.resolve()
      vi.advanceTimersByTime(LINE_GAP_MS)
      expect(onLineEnd).toHaveBeenCalledTimes(2)

      // Line 2 errors (the heart-reveal line — extra-painful failure mode
      // because the heart depends on this line completing).
      expect(h.calls).toHaveLength(3)
      h.rejectLast(
        '[preRecorded] loaderror for ".../greet-03-nice-to-meet-you.mp3"',
      )
      await Promise.resolve()
      await Promise.resolve()

      expect(onLineError).toHaveBeenCalledTimes(1)
      expect(onLineError.mock.calls[0][0]).toBe(2)
    })

    it('does NOT fire onLineError when cancel() runs before the speak rejects', async () => {
      // Cancellations are intentional (unmount, heart-tap mid-line). We
      // don't want to surface them as errors and trigger the relock path.
      const h = makeSpeakHarness()
      const onLineError = vi.fn()

      const handle = runGreetSequence({ speak: h.speak, onLineError })
      handle.start()

      handle.cancel()
      h.rejectLast('cancelled')
      await Promise.resolve()
      await Promise.resolve()

      expect(onLineError).not.toHaveBeenCalled()
    })

    it('does NOT advance to the next line after onLineError fires', async () => {
      // Symmetry with the existing "rejected speak halts" test, but
      // explicitly asserts behaviour AFTER the onLineError call. The
      // recovery (relock + retry) is the caller's responsibility; the
      // orchestrator stays halted.
      const h = makeSpeakHarness()
      const onLineError = vi.fn()
      const onLineEnd = vi.fn()
      const onComplete = vi.fn()

      const handle = runGreetSequence({
        speak: h.speak,
        onLineError,
        onLineEnd,
        onComplete,
      })
      handle.start()

      h.rejectLast('boom')
      await Promise.resolve()
      await Promise.resolve()
      vi.advanceTimersByTime(LINE_GAP_MS * 5)

      expect(onLineError).toHaveBeenCalledTimes(1)
      expect(onLineEnd).not.toHaveBeenCalled()
      expect(onComplete).not.toHaveBeenCalled()
      // No further speak() calls were queued.
      expect(h.calls).toHaveLength(1)
    })

    it('wraps a non-Error rejection value into an Error before forwarding', async () => {
      // Defensive: anything reaching the catch should be normalised to an
      // Error so callers' `err.message` access is always safe. Some Howler
      // builds reject with a numeric error code or a string.
      const h = makeSpeakHarness()
      const onLineError = vi.fn()

      const handle = runGreetSequence({ speak: h.speak, onLineError })
      handle.start()

      // Reject with a non-Error string. Bypass rejectLast() (which builds an
      // Error) and reach into the harness directly.
      h.calls[h.calls.length - 1].reject('raw string' as unknown as Error)
      await Promise.resolve()
      await Promise.resolve()

      expect(onLineError).toHaveBeenCalledTimes(1)
      expect(onLineError.mock.calls[0][1]).toBeInstanceOf(Error)
    })
  })

  it('forwards the configured boundaryWPM to speak()', () => {
    const h = makeSpeakHarness()
    const handle = runGreetSequence({ speak: h.speak, boundaryWPM: 200 })
    handle.start()
    expect(h.calls[0].opts?.boundaryWPM).toBe(200)
  })

  it('uses the injected scheduler when one is provided', async () => {
    const h = makeSpeakHarness()
    const schedule = vi.fn((cb: () => void) => {
      // Run synchronously so we can assert ordering deterministically.
      cb()
      return 1
    })

    const handle = runGreetSequence({ speak: h.speak, schedule })
    handle.start()

    h.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), LINE_GAP_MS)
    expect(h.calls).toHaveLength(2)
  })
})

describe('speakReprompt', () => {
  it('speaks GREET_LINES[REPROMPT_LINE_INDEX]', async () => {
    const h = makeSpeakHarness()
    void speakReprompt({ speak: h.speak })
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].text).toBe(GREET_LINES[REPROMPT_LINE_INDEX])
    expect(h.calls[0].text).toBe("Tap the heart when you're ready.")
  })

  it('swallows engine errors so the caller never sees a rejection', async () => {
    const h = makeSpeakHarness()
    const promise = speakReprompt({ speak: h.speak })
    h.rejectLast('canceled')
    await expect(promise).resolves.toBeUndefined()
  })

  it('forwards onBoundary so captions can mirror the re-prompt', () => {
    const h = makeSpeakHarness()
    const onBoundary = vi.fn()
    void speakReprompt({ speak: h.speak, onBoundary })
    h.calls[0].opts?.onBoundary?.({ wordIndex: 0, word: 'Tap', charIndex: 0 })
    expect(onBoundary).toHaveBeenCalledWith({
      wordIndex: 0,
      word: 'Tap',
      charIndex: 0,
    })
  })
})

describe('REPROMPT_AFTER_MS', () => {
  it('is 20 seconds per spec', () => {
    expect(REPROMPT_AFTER_MS).toBe(20_000)
  })
})
