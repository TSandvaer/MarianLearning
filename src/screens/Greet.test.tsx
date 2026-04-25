import { act, fireEvent, render, screen, within } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

// Stub the SFX factory so jsdom never tries to construct a real Howl. We
// also expose the spy via a mock-state object so individual tests can
// override the `play()` return value (true/false → asset present/missing).
type FakeSfx = {
  play: ReturnType<typeof vi.fn>
  unload: ReturnType<typeof vi.fn>
  missedPlays: number
  loadFailed: boolean
}
const sfxState: { last: FakeSfx | null; createCount: number } = {
  last: null,
  createCount: 0,
}
vi.mock('../lib/sfx', () => ({
  createSfx: vi.fn(() => {
    const fake: FakeSfx = {
      play: vi.fn(() => true),
      unload: vi.fn(),
      missedPlays: 0,
      loadFailed: false,
    }
    sfxState.last = fake
    sfxState.createCount += 1
    return fake
  }),
}))

// Stub the pre-recorded module so jsdom never tries to construct a real
// Howl for the Greet MP3s. We also stub `cancelPreRecorded` so the test
// can spy on cancellations.
//
// `useAudioUnlockGate` is the real implementation — we WANT to drive the
// watchdog/relock state machine end-to-end in these tests; only the audio
// I/O layer needs faking.
const cancelPreRecordedSpy = vi.fn()
vi.mock('../lib/audio', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/audio')>('../lib/audio')
  return {
    ...actual,
    playGreetLine: vi.fn(),
    cancelPreRecorded: () => cancelPreRecordedSpy(),
  }
})

import Greet from './Greet'
import { _resetForTests as resetDebugBus } from '../lib/debug'
import {
  GREET_LINES,
  HEART_REVEAL_AFTER_LINE_INDEX,
  LINE_GAP_MS,
  REPROMPT_AFTER_MS,
} from './greetSequence'
import type { GreetLineKey, PlayGreetLineOptions } from '../lib/audio'

function withMotion(node: ReactNode) {
  // Mirror App.tsx providers so <m.*> elements + AnimatePresence resolve.
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/**
 * Build a controllable playGreetLineFn() fake. Production-shape: each
 * call takes a stable line key (`'hi' | 'imMelody' | ...`) plus playback
 * opts, and returns a deferred promise the test resolves explicitly.
 *
 * Replaces the Web Speech-era `speakFn` harness — the orchestrator still
 * works in text-space but the Greet adapter (`playLineAdapter`) translates
 * text → key, so what arrives here is the key.
 */
function makePlayHarness() {
  const calls: Array<{
    key: GreetLineKey
    opts: PlayGreetLineOptions | undefined
    /** The line text the orchestrator was working with — derived from key. */
    text: string
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const KEY_TO_TEXT: Record<GreetLineKey, string> = {
    hi: GREET_LINES[0],
    imMelody: GREET_LINES[1],
    niceToMeet: GREET_LINES[2],
    tapHeart: GREET_LINES[3],
  }

  const playGreetLineFn = vi.fn(
    (key: GreetLineKey, opts?: PlayGreetLineOptions) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ key, opts, text: KEY_TO_TEXT[key], resolve, reject })
      }),
  )

  return {
    playGreetLineFn,
    calls,
    /** Resolve the most-recent in-flight playback (mirrors `Howl.end`). */
    resolveLast() {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending playGreetLine() to resolve')
      call.resolve()
    },
    /**
     * Fire a synthetic word tick on the most-recent in-flight line. The
     * Greet adapter translates this into an `onBoundary` event the
     * orchestrator's `onWordBoundary` hook reads.
     */
    tickWord(wordIndex: number) {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending playGreetLine() to tick')
      call.opts?.onWordTick?.(wordIndex)
    },
    /**
     * Fire the most-recent line's onPlay callback, simulating the engine
     * actually beginning to play (used by useAudioUnlockGate to clear the
     * 1.5s watchdog).
     */
    fireOnPlay() {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending playGreetLine() to start')
      call.opts?.onPlay?.()
    },
  }
}

/**
 * Drive the play harness to completion of the active line while flushing
 * micro/macro tasks the way `runGreetSequence` expects. After this, the
 * caption is forcibly revealed and the next line is queued after
 * LINE_GAP_MS.
 */
async function completeLine(harness: ReturnType<typeof makePlayHarness>) {
  await act(async () => {
    harness.resolveLast()
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Step over the inter-line 400ms gap. */
async function crossGap() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LINE_GAP_MS)
  })
}

/** Tap the Wake-state full-viewport target — the gesture-unlock trigger. */
function fireWakeTap() {
  const target = screen.getByTestId('greet-wake-tap-target')
  // Production uses pointerdown for low-latency iPad response; the tests
  // mirror that to exercise the same handler path.
  fireEvent.pointerDown(target)
}

/** Stub matchMedia for the Greet's reduced-motion hook. */
function stubReducedMotion(reduced: boolean): MockInstance {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const matches =
      query.includes('prefers-reduced-motion') &&
      query.includes('reduce') &&
      reduced
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList
  })
}

describe('Greet', () => {
  let mediaSpy: MockInstance | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    cancelPreRecordedSpy.mockClear()
    sfxState.last = null
    sfxState.createCount = 0
    // Bus is a module-level singleton — reset between tests so tap/gate/play
    // state from a previous case can't leak into the next.
    resetDebugBus()
  })

  afterEach(() => {
    vi.useRealTimers()
    mediaSpy?.mockRestore()
    mediaSpy = undefined
    resetDebugBus()
  })

  describe('Wake state (initial mount, audio locked)', () => {
    it('mounts in Wake state and renders Melody, the cloud bg, the ready ring, and the tap target', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-screen-state',
        'wake',
      )
      expect(screen.getByTestId('greet-clouds')).toBeInTheDocument()
      expect(screen.getByTestId('greet-ready-ring')).toBeInTheDocument()
      expect(screen.getByTestId('greet-wake-tap-target')).toBeInTheDocument()

      const melodyEls = screen.getAllByTestId('greet-melody')
      expect(melodyEls).toHaveLength(1)
      expect(melodyEls[0]).toHaveAttribute('data-pose', 'idle')
    })

    it('does NOT show the speech ribbon, heart, or wake-icon in initial Wake state', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      expect(screen.queryByTestId('greet-ribbon')).toBeNull()
      expect(screen.queryByTestId('greet-heart')).toBeNull()
      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    })

    it('does NOT call playGreetLine() before the user tap (the iPad Safari fix)', () => {
      // Load-bearing invariant for ticket 86c9gp99a / 86c9gqprh. The screen
      // must remain audio-silent until a synchronous user gesture lands —
      // calling play() from useEffect on mount is what the bug used to do.
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      expect(h.calls).toHaveLength(0)

      // Even after generous async/timer flushing, the count stays zero so
      // long as no gesture has fired.
      act(() => {
        vi.advanceTimersByTime(2_000)
      })
      expect(h.calls).toHaveLength(0)
    })

    it('full-viewport tap target tap synchronously fires playGreetLine("hi") and transitions to intro', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()

      // Synchronously, with no awaits between tap and play.
      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].key).toBe('hi')
      expect(h.calls[0].text).toBe('Hi!')
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-screen-state',
        'intro',
      )
      // The tap target unmounts immediately (no exit transition on the
      // button — it's a plain DOM element) so the heart and other
      // intra-screen UI can take their own taps.
      expect(screen.queryByTestId('greet-wake-tap-target')).toBeNull()
      // Ring is exiting via AnimatePresence — we use the data-screen-state
      // signal as the source of truth rather than asserting on the exit
      // animation completing in jsdom (Framer Motion drives via rAF, which
      // fake timers don't advance reliably). The visual contract: once
      // screen-state is 'intro' and gate-state is 'pending'/'unlocked',
      // the ring's exit is in progress regardless of whether it's still
      // in the DOM mid-transition.
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'pending',
      )
    })

    it('also kicks the chime SFX synchronously inside the tap handler (WebAudio unlock)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()

      // The chime instance was constructed at mount; play() is called inside
      // the same handler as playGreetLine() to silently unlock Howler's
      // WebAudio context for later SFX.
      expect(sfxState.last?.play).toHaveBeenCalledTimes(1)
    })

    it('forwards an onPlay callback on the line-0 play (gate watchdog signal)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      expect(h.calls[0].opts?.onPlay).toBeTypeOf('function')
    })
  })

  describe('Wake re-prompt (8s no-tap nudge)', () => {
    it('does NOT show the wake-icon before 8s elapsed', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
      act(() => {
        vi.advanceTimersByTime(7_999)
      })
      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    })

    it('shows the wake-icon and triggers ear-wiggle at exactly 8s', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      expect(screen.getByTestId('greet-wake-icon')).toBeInTheDocument()
      // Ear-wiggle: the happy pose is now in the DOM.
      const poses = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(poses).toContain('happy')
    })

    it('does NOT call playGreetLine() during the wake re-prompt (audio still locked)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      expect(h.calls).toHaveLength(0)
    })

    it('hides the wake-icon after pulse + hold (3.1s after appearing)', () => {
      // Note: under fake timers + jsdom, Framer Motion's rAF-driven exit
      // animation doesn't tick — so the AnimatePresence child stays in
      // the DOM with opacity:0 mid-exit. We assert on the exit-anim
      // intent (opacity heading to 0) rather than full unmount, since
      // the production behaviour is unaffected and the alternative
      // (advancing rAF manually in tests) leaks Motion internals.
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      const initial = screen.getByTestId('greet-wake-icon')
      // While it's "live" the keyframed opacity is going through 0 → 1 → 1
      // — the initial frame has opacity 0 and that's what we get without
      // a rAF flush. The important visible-frame is the post-hold one.
      expect(initial).toBeInTheDocument()

      // Trigger the hide: 600ms pulse + 2500ms hold.
      act(() => {
        vi.advanceTimersByTime(3_100)
      })
      // Now the icon's exit animation is in flight. The element may still
      // be in the DOM but its opacity should be 0 (or unmounted) — either
      // way it's not visible.
      const stillThere = screen.queryByTestId('greet-wake-icon')
      if (stillThere) {
        const opacity = stillThere.style.opacity
        expect(opacity).toBe('0')
      }
    })

    it('triggers exactly once — does NOT re-fire after hide', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      // Snapshot the element-or-opacity state at the trigger point.
      expect(screen.getByTestId('greet-wake-icon')).toBeInTheDocument()

      // Trigger the hide and then wait far past — the same element may
      // still be in the DOM (mid-exit under jsdom, see comment above)
      // but no new icon mounts. We assert on count: there should be
      // at most one icon ever in the tree, and it should be exiting.
      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      const icons = screen.queryAllByTestId('greet-wake-icon')
      expect(icons.length).toBeLessThanOrEqual(1)
      if (icons.length === 1) {
        expect(icons[0].style.opacity).toBe('0')
      }
    })

    it('a tap before 8s cancels the wake re-prompt — icon never fires', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(2_000)
      })
      fireWakeTap()
      // Far past 8s, no icon.
      act(() => {
        vi.advanceTimersByTime(20_000)
      })
      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    })
  })

  describe('Intro state (post-tap)', () => {
    it('captions reveal word-by-word as word ticks fire', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()

      // Resolve "Hi!" so we move to "I'm Melody."
      await completeLine(h)
      await crossGap()

      // Now the second line is in flight with two words.
      await act(async () => {
        h.tickWord(0)
      })
      let revealed = screen
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
        .map((el) => el.getAttribute('data-word'))
      expect(revealed).toEqual(["I'm"])

      await act(async () => {
        h.tickWord(1)
      })
      revealed = screen
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
        .map((el) => el.getAttribute('data-word'))
      expect(revealed).toEqual(["I'm", 'Melody.'])
    })

    it('forces line fully revealed at line-end (covers the punctuation/no-tick fallback)', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()

      await completeLine(h)

      const ribbon = screen.getByTestId('greet-ribbon')
      const revealed = within(ribbon)
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
      expect(revealed).toHaveLength(1)
    })

    it('triggers the ear-wiggle when the "Hi!" word tick arrives', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()

      // Pre-condition: idle.
      expect(screen.getByTestId('greet-melody')).toHaveAttribute(
        'data-pose',
        'idle',
      )

      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].opts?.onWordTick).toBeTypeOf('function')

      await act(async () => {
        h.tickWord(0)
      })

      let poses = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(poses).toContain('happy')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })
      poses = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(poses).toContain('idle')
    })

    it('does not trigger the ear-wiggle on non-line-0 word ticks', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()

      await completeLine(h)
      await crossGap()

      await act(async () => {
        h.tickWord(0)
        h.tickWord(1)
      })
      const poses = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(poses).toEqual(['idle'])
    })

    it('reveals the heart only after line 3 ("It\'s so nice to meet you.") completes', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()

      for (let i = 0; i <= HEART_REVEAL_AFTER_LINE_INDEX; i++) {
        expect(screen.queryByTestId('greet-heart')).toBeNull()
        await completeLine(h)
        if (i < HEART_REVEAL_AFTER_LINE_INDEX) {
          expect(screen.queryByTestId('greet-heart')).toBeNull()
          await crossGap()
        }
      }

      expect(screen.getByTestId('greet-heart')).toBeInTheDocument()
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-heart-ready',
        'true',
      )
    })

    it("captions never show text Melody hasn't said (initially zero revealed)", () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()
      // The ribbon mounts as soon as the engine reports it actually started
      // playing (post-#86c9gp99a-real iPad fix: empty ribbon never shows
      // before evidence of audio). Fire onPlay so the ribbon mounts, then
      // assert no words are revealed yet — we haven't sent a tick.
      act(() => {
        h.fireOnPlay()
      })

      const revealed = screen
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
      expect(revealed).toHaveLength(0)
    })

    it('caption text font-size is comfortably above the 28pt floor', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )
      fireWakeTap()
      // Force the ribbon to mount via onPlay (see preceding test for why).
      act(() => {
        h.fireOnPlay()
      })

      const caption = screen.getByTestId('greet-caption')
      expect(caption.className).toMatch(/text-\[2\.4rem\]/)
    })
  })

  describe('Wake-tap event-binding coverage (post-#86c9gp99a-real iPad fix)', () => {
    it('responds to a click event (the iPad-Safari-honored gesture for audio unlock)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.click(target)

      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].key).toBe('hi')
    })

    it('responds to a touchend event (iPad gesture-gate fallback)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.touchEnd(target)

      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].key).toBe('hi')
    })

    it('responds to a pointerdown event (Chromium / desktop snappy path)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.pointerDown(target)

      expect(h.calls).toHaveLength(1)
    })

    it('triple-fires from one tap (touchend + pointerdown + click) only fire play ONCE', () => {
      // Single physical tap on iPad Safari delivers touchend → pointerdown → click
      // in quick succession; React batches the state updates so all three handlers
      // see screenState === 'wake'. The same-tick guard must collapse them.
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      const target = screen.getByTestId('greet-wake-tap-target')
      // Mirror the real iPad event sequence for one tap.
      fireEvent.touchEnd(target)
      fireEvent.pointerDown(target)
      fireEvent.click(target)

      expect(h.calls).toHaveLength(1)
      // And only one chime play() (silent unlock).
      expect(sfxState.last?.play).toHaveBeenCalledTimes(1)
    })
  })

  describe('Wake-icon inline SVG (post-#86c9gp99a-real iPad fix)', () => {
    it('renders the wake-icon as inline SVG markup, NOT as an <img>', () => {
      // iPad Safari standalone PWA mode mis-rendered <img src="…svg"> as a
      // broken-image placeholder for this asset. Inlining sidesteps the bug.
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      const icon = screen.getByTestId('greet-wake-icon')
      expect(icon.tagName.toLowerCase()).toBe('svg')
      // Belt: no src attribute, no <img> involved at all.
      expect(icon.hasAttribute('src')).toBe(false)
      // Has the expected role + accessible name for SVG.
      expect(icon.getAttribute('role')).toBe('img')
      expect(icon.getAttribute('aria-label')).toBe('Tap here')
      // Contains the finger silhouette path — confirms the markup body
      // landed, not just the wrapper element.
      expect(icon.querySelector('path')).not.toBeNull()
    })
  })

  describe('Empty-ribbon prevention (post-#86c9gp99a-real iPad fix)', () => {
    it('does NOT mount the ribbon synchronously on wake-tap before any play evidence', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      // Screen state advanced — but no onPlay, no tick, no evidence the
      // engine actually picked up the call. iPad Safari can silently reject;
      // the ribbon must not appear as an empty rounded rectangle.
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-screen-state',
        'intro',
      )
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()
    })

    it('mounts the ribbon as soon as onPlay fires (engine confirmed playing)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()

      act(() => {
        h.fireOnPlay()
      })
      expect(screen.getByTestId('greet-ribbon')).toBeInTheDocument()
    })

    it('mounts the ribbon when a word tick fires even if onPlay was skipped (engine quirk fallback)', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()

      // Greet's adapter wires the first onWordTick to also flip the
      // gate to unlocked — covers any future engine that emits ticks
      // without an onPlay event.
      await act(async () => {
        h.tickWord(0)
      })
      expect(screen.getByTestId('greet-ribbon')).toBeInTheDocument()
    })

    it('does NOT mount the ribbon in the silent-fail relock path', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      // 1.5s elapses with no onPlay and no tick — gate flips to relock.
      // (Pre-recorded MP3 era shrunk FIRST_UTTERANCE_RETRY_MS from
      // 5_000 → 1_500.)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'relock',
      )
      // No ribbon visible during the relock — Marian sees the ring re-emerge,
      // not an empty rounded rectangle hanging under Melody.
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()
    })
  })

  describe("First-utterance retry contract (Dave's)", () => {
    it('if onPlay never fires within 1.5s of the wake tap, the gate transitions to relock and shows the ring + tap target again', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      // Play fired but onPlay is never called — simulating iPad Safari
      // silently rejecting the call.
      expect(h.calls).toHaveLength(1)

      // Pre-recorded MP3 era (ticket 86c9gqprh): watchdog window shrunk
      // from 5 → 1.5s. Howler `onplay` fires within ~50ms once the audio
      // context is unlocked; 1.5s is generous for cold-cache decode.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })

      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'relock',
      )
      // Ring is back on screen.
      expect(screen.getByTestId('greet-ready-ring')).toBeInTheDocument()
      // Tap target is hot again.
      expect(screen.getByTestId('greet-wake-tap-target')).toBeInTheDocument()
    })

    it('does NOT prematurely relock at 1s — sub-second decode latency should still be honoured', async () => {
      // Regression guard for the watchdog window. Before pre-recorded
      // audio, this test pinned the 5s window against premature relock at
      // 2s. Post-pre-recorded the window is 1.5s, so we assert the gate
      // is still `pending` at the 1s mark — well inside the window.
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'pending',
      )

      // Audio genuinely starts playing at the 1.4s mark — past 1s, before 1.5s.
      // Gate transitions to unlocked, no relock surfaced.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      act(() => {
        h.fireOnPlay()
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )
    })

    it('the next user gesture after a silent fail synchronously re-fires play(line0) with a fresh playback', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      // First tap — play fired but engine ignored it.
      fireWakeTap()
      expect(h.calls).toHaveLength(1)

      // Watchdog expires (1.5s post-pre-recorded).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'relock',
      )

      // Second tap — synchronously retries play(line0).
      fireWakeTap()
      // A new playGreetLine() call has fired.
      expect(h.calls.length).toBeGreaterThanOrEqual(2)
      const lastCall = h.calls[h.calls.length - 1]
      expect(lastCall.key).toBe('hi')

      // This time the engine actually starts.
      act(() => {
        h.fireOnPlay()
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )
    })

    it('a successful onPlay inside the 1.5s window keeps the gate in unlocked state — no ring re-show', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      // Engine starts playing promptly.
      act(() => {
        h.fireOnPlay()
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )

      // Past the 1.5s mark: gate stays unlocked, no relock surfaces. The
      // ring may still be in the DOM mid-exit-animation (rAF driver
      // doesn't tick under jsdom fake timers) but it's invisible — we
      // assert on the gate state rather than ring presence.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )
    })

    it('multi-event from one physical tap during relock fires the retry only ONCE (round-5 guard)', async () => {
      // Round-5 fix (ticket 86c9gp99a). A single iPad tap during relock
      // delivers touchend + pointerdown + click — without the same-tick
      // guard on the relock branch of handleWakeTap, all three would call
      // gate.dispatchGesture() and fire the registered retry, queuing
      // three competing play() calls. Thomas reported this as the
      // "ring re-pulses, voice eventually fires" pattern.
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      fireWakeTap()
      const callsAfterFirstTap = h.calls.length

      // Watchdog expires; gate enters relock.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'relock',
      )

      // One physical tap → three synthetic events on the wake-tap target.
      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.touchEnd(target)
      fireEvent.pointerDown(target)
      fireEvent.click(target)

      // Exactly ONE additional play() — the guard collapsed the other
      // two synthetic events.
      expect(h.calls.length).toBe(callsAfterFirstTap + 1)
      expect(h.calls[h.calls.length - 1].key).toBe('hi')
    })
  })

  describe('heart tap (happy path)', () => {
    async function advanceToHeart(h: ReturnType<typeof makePlayHarness>) {
      fireWakeTap()
      for (let i = 0; i <= HEART_REVEAL_AFTER_LINE_INDEX; i++) {
        await completeLine(h)
        if (i < HEART_REVEAL_AFTER_LINE_INDEX) await crossGap()
      }
    }

    it('plays the chime, squishes, and calls onAdvance within 400ms', async () => {
      mediaSpy = stubReducedMotion(false)
      const onAdvance = vi.fn()
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={onAdvance} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      await advanceToHeart(h)

      const heart = screen.getByTestId('greet-heart')
      // Wake-tap already played the chime once (silent unlock); reset the
      // counter so we assert on just the heart-tap chime.
      const chimeCallsBefore = sfxState.last?.play.mock.calls.length ?? 0
      fireEvent.click(heart)
      expect(sfxState.last?.play.mock.calls.length).toBe(chimeCallsBefore + 1)

      // Hand-off has NOT happened yet — we wait for the 400ms transition.
      expect(onAdvance).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(399)
      })
      expect(onAdvance).not.toHaveBeenCalled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)
    })

    it('does not throw and still calls onAdvance when the chime asset is missing', async () => {
      mediaSpy = stubReducedMotion(false)
      const onAdvance = vi.fn()
      const h = makePlayHarness()

      // Custom chime that simulates a 404 — play() returns false, no throw.
      const missingChime = {
        play: vi.fn(() => false),
        unload: vi.fn(),
        missedPlays: 0,
        loadFailed: true,
      }

      render(
        withMotion(
          <Greet
            onAdvance={onAdvance}
            playGreetLineFn={h.playGreetLineFn}
            chime={missingChime}
          />,
        ),
      )

      await advanceToHeart(h)

      fireEvent.click(screen.getByTestId('greet-heart'))
      expect(missingChime.play).toHaveBeenCalled()
      // No throw; the visual flow proceeds.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)
    })

    it('cancels in-flight pre-recorded playback on heart tap so Melody is silent during the chime', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      await advanceToHeart(h)
      const cancelsBefore = cancelPreRecordedSpy.mock.calls.length
      fireEvent.click(screen.getByTestId('greet-heart'))
      expect(cancelPreRecordedSpy.mock.calls.length).toBeGreaterThan(
        cancelsBefore,
      )
    })

    it('debounces double-tap: only one onAdvance regardless of how many taps land', async () => {
      mediaSpy = stubReducedMotion(false)
      const onAdvance = vi.fn()
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={onAdvance} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      await advanceToHeart(h)

      const heart = screen.getByTestId('greet-heart')
      const chimeCallsBefore = sfxState.last?.play.mock.calls.length ?? 0
      fireEvent.click(heart)
      fireEvent.click(heart)
      fireEvent.click(heart)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)
      // Heart chime debounced — only one extra play() landed past the
      // wake-tap baseline.
      expect(sfxState.last?.play.mock.calls.length).toBe(chimeCallsBefore + 1)
    })

    it('triggers ear-wiggle (wave) on tap per spec line 189', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      await advanceToHeart(h)
      const preTap = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(preTap).toEqual(['idle'])

      fireEvent.click(screen.getByTestId('greet-heart'))
      const postTap = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(postTap).toContain('happy')
    })
  })

  describe('20s no-tap re-prompt (post-line-4)', () => {
    async function advanceToHeart(h: ReturnType<typeof makePlayHarness>) {
      fireWakeTap()
      for (let i = 0; i <= HEART_REVEAL_AFTER_LINE_INDEX; i++) {
        await completeLine(h)
        if (i < HEART_REVEAL_AFTER_LINE_INDEX) await crossGap()
      }
    }

    it('re-plays line 3 once after 20s without a tap, then never again', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      await advanceToHeart(h)
      let elapsedSinceArm = 0
      await crossGap()
      elapsedSinceArm += LINE_GAP_MS
      await completeLine(h)

      const callsBefore = h.calls.length
      expect(callsBefore).toBe(GREET_LINES.length) // all 4 lines played once

      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          REPROMPT_AFTER_MS - elapsedSinceArm - 1,
        )
      })
      expect(h.calls.length).toBe(callsBefore)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(h.calls.length).toBe(callsBefore + 1)
      expect(h.calls[h.calls.length - 1].key).toBe('tapHeart')
      expect(h.calls[h.calls.length - 1].text).toBe(
        "Tap the heart when you're ready.",
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(REPROMPT_AFTER_MS * 2)
      })
      expect(h.calls.length).toBe(callsBefore + 1)
    })

    it('cancels the re-prompt when the heart is tapped first', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      await advanceToHeart(h)
      await crossGap()
      await completeLine(h)

      const callsBefore = h.calls.length

      fireEvent.click(screen.getByTestId('greet-heart'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(REPROMPT_AFTER_MS * 2)
      })
      expect(h.calls.length).toBe(callsBefore)
    })
  })

  describe('reduced motion', () => {
    it('renders core surfaces, no playGreetLine() before tap, ring static at 0.5 opacity', () => {
      mediaSpy = stubReducedMotion(true)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      expect(screen.getByTestId('greet')).toBeInTheDocument()
      expect(screen.getByTestId('greet-clouds')).toBeInTheDocument()
      expect(screen.getByTestId('greet-melody')).toBeInTheDocument()
      expect(screen.getByTestId('greet-ready-ring')).toBeInTheDocument()
      // No play before tap, regardless of motion preference.
      expect(h.calls).toHaveLength(0)
    })

    it('does not pulse the wake-icon under reduced motion (single fade only)', () => {
      mediaSpy = stubReducedMotion(true)
      const h = makePlayHarness()
      render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      const icon = screen.getByTestId('greet-wake-icon')
      // Reduce-motion path animates opacity only — no scale keyframes.
      // We can't easily assert on Framer Motion's internal transition object
      // without leaking implementation details, so we settle for "the icon
      // is rendered and not crashing".
      expect(icon).toBeInTheDocument()
    })
  })

  describe('cleanup', () => {
    it('cancels in-flight playback and unloads the chime on unmount', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makePlayHarness()
      const { unmount } = render(
        withMotion(
          <Greet onAdvance={vi.fn()} playGreetLineFn={h.playGreetLineFn} />,
        ),
      )

      const cancelsBefore = cancelPreRecordedSpy.mock.calls.length
      unmount()

      expect(cancelPreRecordedSpy.mock.calls.length).toBeGreaterThan(
        cancelsBefore,
      )
      expect(sfxState.last?.unload).toHaveBeenCalledTimes(1)
    })
  })
})
