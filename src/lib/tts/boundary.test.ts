import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToBoundary } from './boundary'
import type { BoundaryEvent } from './boundary'

/**
 * Fake utterance that mirrors the `SpeechSynthesisUtterance` surface we touch.
 * We invoke handlers manually from the test body to drive the lifecycle.
 *
 * Keep this minimal — the subscribeToBoundary contract is a small subset of
 * the real API and we want the test fixture to reflect that.
 */
class FakeUtterance {
  text: string
  onstart:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void)
    | null = null
  onend:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void)
    | null = null
  onerror:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => void)
    | null = null
  onboundary:
    | ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void)
    | null = null

  constructor(text: string) {
    this.text = text
  }

  fireStart() {
    this.onstart?.call(
      this as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
  }

  fireBoundary(charIndex: number, charLength: number, name = 'word') {
    this.onboundary?.call(
      this as unknown as SpeechSynthesisUtterance,
      { charIndex, charLength, name } as unknown as SpeechSynthesisEvent,
    )
  }

  fireEnd() {
    this.onend?.call(
      this as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
  }
}

describe('subscribeToBoundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('native onboundary path', () => {
    it('fires callback for each word with index + word + charIndex', () => {
      const utterance = new FakeUtterance('Hi! I am Melody.')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireStart()
      // Engine reports word boundaries with charIndex pointing at each word's
      // first character. "Hi!" at 0, "I" at 4, "am" at 6, "Melody." at 9.
      utterance.fireBoundary(0, 3) // Hi!
      utterance.fireBoundary(4, 1) // I
      utterance.fireBoundary(6, 2) // am
      utterance.fireBoundary(9, 7) // Melody.

      expect(events).toHaveLength(4)
      expect(events[0]).toEqual({ wordIndex: 0, word: 'Hi!', charIndex: 0 })
      expect(events[1]).toEqual({ wordIndex: 1, word: 'I', charIndex: 4 })
      expect(events[2]).toEqual({ wordIndex: 2, word: 'am', charIndex: 6 })
      expect(events[3]).toEqual({ wordIndex: 3, word: 'Melody.', charIndex: 9 })
    })

    it('maps charIndex landing on whitespace to the nearest preceding word', () => {
      // Some engines round charIndex to a space character between words.
      // We should still resolve that to the preceding word rather than drop
      // the event.
      const utterance = new FakeUtterance('hello world')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireStart()
      utterance.fireBoundary(5, 1) // charIndex 5 is the space between 'hello' and 'world'

      expect(events).toEqual([{ wordIndex: 0, word: 'hello', charIndex: 0 }])
    })

    it('ignores non-word boundary events (sentence)', () => {
      const utterance = new FakeUtterance('Hi. Bye.')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireStart()
      utterance.fireBoundary(0, 3, 'word') // Hi.
      utterance.fireBoundary(0, 3, 'sentence') // Engine emits sentence boundary; ignore.
      utterance.fireBoundary(4, 4, 'word') // Bye.

      expect(events).toHaveLength(2)
      expect(events.map((e) => e.word)).toEqual(['Hi.', 'Bye.'])
    })

    it('does not fire fallback events while native onboundary is healthy', () => {
      // When the engine delivers boundaries within the watchdog window, the
      // fallback interval must never run — captions stay perfectly in sync
      // with the engine, no synthetic ticks bleed through.
      const utterance = new FakeUtterance('one two three')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 60_000 }, // 1 word/ms in fallback — would be obvious if active
      )

      utterance.fireStart()
      // Engine delivers each word well before the 250ms watchdog window.
      vi.advanceTimersByTime(50)
      utterance.fireBoundary(0, 3)
      vi.advanceTimersByTime(50)
      utterance.fireBoundary(4, 3)
      vi.advanceTimersByTime(50)
      utterance.fireBoundary(8, 5)

      expect(events.map((e) => e.word)).toEqual(['one', 'two', 'three'])
      // Verify nothing extra leaks out as the utterance ends.
      utterance.fireEnd()
      vi.advanceTimersByTime(2000)
      expect(events).toHaveLength(3)
    })
  })

  describe('Safari fallback (onboundary never fires)', () => {
    it('fires word events at configured WPM cadence after onstart', () => {
      const utterance = new FakeUtterance('one two three four')
      const events: BoundaryEvent[] = []
      // 600 WPM → 100ms per word. Easy math for fake timers.
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 },
      )

      utterance.fireStart()
      // After ~250ms with no onboundary, fallback engages.
      vi.advanceTimersByTime(250)

      // First fallback word should fire at the moment the fallback arms.
      expect(events.map((e) => e.word)).toEqual(['one'])

      vi.advanceTimersByTime(100)
      vi.advanceTimersByTime(100)
      vi.advanceTimersByTime(100)

      expect(events.map((e) => e.word)).toEqual(['one', 'two', 'three', 'four'])
      expect(events[1].wordIndex).toBe(1)
      expect(events[3].charIndex).toBeGreaterThan(events[2].charIndex)
    })

    it('uses the default WPM when none is provided', () => {
      // 165 WPM → 1 word every ~363ms.
      const utterance = new FakeUtterance('alpha beta gamma')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250) // arm fallback, fire 'alpha'
      expect(events.map((e) => e.word)).toEqual(['alpha'])

      vi.advanceTimersByTime(363)
      vi.advanceTimersByTime(363)

      expect(events.map((e) => e.word)).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('does not over-fire past the end of the word array', () => {
      const utterance = new FakeUtterance('one two')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 },
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250)
      vi.advanceTimersByTime(100)
      vi.advanceTimersByTime(2000) // way past the last word

      expect(events.map((e) => e.word)).toEqual(['one', 'two'])
    })
  })

  describe('hybrid path (onboundary fires, then stops mid-utterance)', () => {
    it('switches to fallback after the gap exceeds threshold', () => {
      const utterance = new FakeUtterance('one two three four five')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 }, // 100ms per word in fallback
      )

      utterance.fireStart()
      utterance.fireBoundary(0, 3) // 'one' arrives natively
      utterance.fireBoundary(4, 3) // 'two' arrives natively
      // Engine goes silent. After ~250ms of no onboundary, fallback resumes.
      vi.advanceTimersByTime(300)

      // Fallback picks up at word index 2 immediately on arming.
      expect(events.map((e) => e.word)).toEqual(['one', 'two', 'three'])

      vi.advanceTimersByTime(100)
      vi.advanceTimersByTime(100)

      expect(events.map((e) => e.word)).toEqual([
        'one',
        'two',
        'three',
        'four',
        'five',
      ])
    })

    it('does not fire duplicate words if onboundary catches up after fallback engaged', () => {
      // Defensive: if the engine starts emitting again after fallback took over,
      // we should not replay words already delivered. Engine wakes up and
      // reports 'one' again belatedly — that must be deduped.
      const utterance = new FakeUtterance('one two three four')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 }, // 100ms per word in fallback
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250) // fallback arms, fires 'one'
      vi.advanceTimersByTime(100) // fires 'two'
      // Engine wakes up but reports 'one' again, behind us. Must be deduped.
      utterance.fireBoundary(0, 3)
      // Engine then reports 'three' on the actual word it just spoke.
      vi.advanceTimersByTime(50)
      utterance.fireBoundary(8, 5)
      // Engine goes silent again; fallback resumes and delivers 'four'.
      vi.advanceTimersByTime(300)

      expect(events.map((e) => e.word)).toEqual(['one', 'two', 'three', 'four'])
    })
  })

  describe('cancel / unsubscribe', () => {
    it('stops firing when unsubscribe is called mid-utterance', () => {
      const utterance = new FakeUtterance('one two three')
      const events: BoundaryEvent[] = []
      const unsubscribe = subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 },
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250) // fallback arms, fires 'one'
      unsubscribe()
      vi.advanceTimersByTime(1000)

      expect(events.map((e) => e.word)).toEqual(['one'])
    })

    it('unsubscribe is idempotent', () => {
      const utterance = new FakeUtterance('hi.')
      const events: BoundaryEvent[] = []
      const unsubscribe = subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      expect(() => {
        unsubscribe()
        unsubscribe()
        unsubscribe()
      }).not.toThrow()

      utterance.fireStart()
      utterance.fireBoundary(0, 3)
      expect(events).toEqual([])
    })

    it('cleans up on the natural end event (fallback timer stops)', () => {
      const utterance = new FakeUtterance('one two three')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 },
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250) // fires 'one'
      utterance.fireEnd()
      vi.advanceTimersByTime(1000)

      expect(events.map((e) => e.word)).toEqual(['one'])
    })

    it('cleans up on an error event', () => {
      const utterance = new FakeUtterance('one two three')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 600 },
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250)
      utterance.onerror?.call(
        utterance as unknown as SpeechSynthesisUtterance,
        { error: 'canceled' } as SpeechSynthesisErrorEvent,
      )
      vi.advanceTimersByTime(1000)

      expect(events.map((e) => e.word)).toEqual(['one'])
    })

    it('does not leak the subscription across utterances', () => {
      // Subscribe to one utterance, never start it, and verify subscribing to
      // a second utterance is fully independent (no shared state).
      const a = new FakeUtterance('alpha beta')
      const b = new FakeUtterance('gamma delta')
      const aEvents: BoundaryEvent[] = []
      const bEvents: BoundaryEvent[] = []
      subscribeToBoundary(a as unknown as SpeechSynthesisUtterance, (e) =>
        aEvents.push(e),
      )
      subscribeToBoundary(b as unknown as SpeechSynthesisUtterance, (e) =>
        bEvents.push(e),
      )

      b.fireStart()
      b.fireBoundary(0, 5)

      expect(aEvents).toEqual([])
      expect(bEvents).toHaveLength(1)
      expect(bEvents[0].word).toBe('gamma')
    })
  })

  describe('multiple subscribers', () => {
    it('fan-outs to each subscriber independently and unsubscribes are independent', () => {
      const utterance = new FakeUtterance('one two three')
      const a: BoundaryEvent[] = []
      const b: BoundaryEvent[] = []
      const unsubA = subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => a.push(e),
      )
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => b.push(e),
      )

      utterance.fireStart()
      utterance.fireBoundary(0, 3)
      expect(a.map((e) => e.word)).toEqual(['one'])
      expect(b.map((e) => e.word)).toEqual(['one'])

      unsubA()
      utterance.fireBoundary(4, 3)
      expect(a.map((e) => e.word)).toEqual(['one'])
      expect(b.map((e) => e.word)).toEqual(['one', 'two'])
    })

    it('a subscriber added after start still receives subsequent words', () => {
      // Late-binding case: a caption component might mount slightly after
      // speech starts. It should still get the next boundary.
      const utterance = new FakeUtterance('one two three')
      const events: BoundaryEvent[] = []

      utterance.fireStart()
      utterance.fireBoundary(0, 3) // first word fires before subscription

      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireBoundary(4, 3)
      expect(events.map((e) => e.word)).toEqual(['two'])
    })

    it('throwing in one subscriber does not break others', () => {
      // Suppress the deliberate console.error from the bad subscriber so the
      // test output stays readable; we still assert the spy fired.
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const utterance = new FakeUtterance('one two')
      const calls: string[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        () => {
          calls.push('a')
          throw new Error('boom')
        },
      )
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        () => {
          calls.push('b')
        },
      )

      utterance.fireStart()
      utterance.fireBoundary(0, 3)

      expect(calls).toEqual(['a', 'b'])
      expect(errSpy).toHaveBeenCalledOnce()
      errSpy.mockRestore()
    })
  })

  describe('input sanity', () => {
    it('handles empty text gracefully', () => {
      const utterance = new FakeUtterance('')
      const events: BoundaryEvent[] = []
      const unsubscribe = subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireStart()
      vi.advanceTimersByTime(2000)

      expect(events).toEqual([])
      unsubscribe()
    })

    it('handles whitespace-only text gracefully', () => {
      const utterance = new FakeUtterance('   \n  ')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
      )

      utterance.fireStart()
      vi.advanceTimersByTime(2000)

      expect(events).toEqual([])
    })

    it('clamps WPM to a sane positive value', () => {
      // Defensive: a caller passing 0 or negative shouldn't divide-by-zero or hang.
      const utterance = new FakeUtterance('one two')
      const events: BoundaryEvent[] = []
      subscribeToBoundary(
        utterance as unknown as SpeechSynthesisUtterance,
        (e) => events.push(e),
        { wpm: 0 },
      )

      utterance.fireStart()
      vi.advanceTimersByTime(250)
      vi.advanceTimersByTime(2000)

      expect(events.map((e) => e.word)).toEqual(['one', 'two'])
    })
  })
})
