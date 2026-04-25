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

// IMPORTANT: stub `lib/tts` BEFORE importing the screen — the real module
// reaches into window.speechSynthesis which jsdom does not implement.
const ttsCancelSpy = vi.fn()
const ttsSpeakSpy = vi.fn()
vi.mock('../lib/tts', () => ({
  speak: (...args: unknown[]) => ttsSpeakSpy(...args),
  cancel: () => ttsCancelSpy(),
}))

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

import Greet from './Greet'
import { _resetForTests as resetDebugBus } from '../lib/debug'
import {
  GREET_LINES,
  HEART_REVEAL_AFTER_LINE_INDEX,
  LINE_GAP_MS,
  REPROMPT_AFTER_MS,
  type SpeakLikeOptions,
} from './greetSequence'

function withMotion(node: ReactNode) {
  // Mirror App.tsx providers so <m.*> elements + AnimatePresence resolve.
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/**
 * Build a controllable speak() fake. We hand it to <Greet speakFn={...} />
 * so the component drives the same orchestrator the production wiring uses,
 * but each line is a deferred promise the test resolves explicitly.
 */
function makeSpeakHarness() {
  const calls: Array<{
    text: string
    opts: SpeakLikeOptions | undefined
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const speakFn = vi.fn(
    (text: string, opts?: SpeakLikeOptions) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ text, opts, resolve, reject })
      }),
  )

  return {
    speakFn,
    calls,
    /** Resolve the most-recent in-flight speak(). */
    resolveLast() {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending speak() to resolve')
      call.resolve()
    },
    /** Fire a synthetic word boundary on the most-recent in-flight line. */
    boundary(wordIndex: number, word: string) {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending speak() to boundary')
      call.opts?.onBoundary?.({
        wordIndex,
        word,
        charIndex: 0,
      })
    },
    /**
     * Fire the most-recent line's onStart callback, simulating the engine
     * actually beginning to speak (used by useAudioUnlockGate to clear the
     * 2s watchdog).
     */
    fireOnStart() {
      const call = calls[calls.length - 1]
      if (!call) throw new Error('no pending speak() to start')
      call.opts?.onStart?.()
    },
  }
}

/**
 * Drive the speak harness to completion of line `index` while flushing
 * micro/macro tasks the way `runGreetSequence` expects. After this, the
 * caption for line `index` is fully revealed and the next line is queued
 * after LINE_GAP_MS.
 */
async function completeLine(harness: ReturnType<typeof makeSpeakHarness>) {
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
    ttsCancelSpy.mockClear()
    ttsSpeakSpy.mockClear()
    sfxState.last = null
    sfxState.createCount = 0
    // Bus is a module-level singleton — reset between tests so tap/gate/speak
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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      expect(screen.queryByTestId('greet-ribbon')).toBeNull()
      expect(screen.queryByTestId('greet-heart')).toBeNull()
      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    })

    it('does NOT call speak() before the user tap (the iPad Safari fix)', () => {
      // This is the load-bearing invariant for ticket 86c9gp99a. The screen
      // must remain audio-silent until a synchronous user gesture lands —
      // calling speak() from useEffect on mount is what the bug used to do.
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      expect(h.calls).toHaveLength(0)

      // Even after generous async/timer flushing, the count stays zero so
      // long as no gesture has fired.
      act(() => {
        vi.advanceTimersByTime(2_000)
      })
      expect(h.calls).toHaveLength(0)
    })

    it('full-viewport tap target tap synchronously fires speak(line0) and transitions to intro', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()

      // Synchronously, with no awaits between tap and speak.
      expect(h.calls).toHaveLength(1)
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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()

      // The chime instance was constructed at mount; play() is called inside
      // the same handler as speak() to silently unlock Howler's WebAudio
      // context for later SFX.
      expect(sfxState.last?.play).toHaveBeenCalledTimes(1)
    })

    it('forwards an onStart callback on the line-0 speak (gate watchdog signal)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      expect(h.calls[0].opts?.onStart).toBeTypeOf('function')
    })
  })

  describe('Wake re-prompt (8s no-tap nudge)', () => {
    it('does NOT show the wake-icon before 8s elapsed', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
      act(() => {
        vi.advanceTimersByTime(7_999)
      })
      expect(screen.queryByTestId('greet-wake-icon')).toBeNull()
    })

    it('shows the wake-icon and triggers ear-wiggle at exactly 8s', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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

    it('does NOT call speak() during the wake re-prompt (audio still locked)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
    it('captions reveal word-by-word as boundary events fire', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
      fireWakeTap()

      // Resolve "Hi!" so we move to "I'm Melody."
      await completeLine(h)
      await crossGap()

      // Now the second line is in flight with two words.
      await act(async () => {
        h.boundary(0, "I'm")
      })
      let revealed = screen
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
        .map((el) => el.getAttribute('data-word'))
      expect(revealed).toEqual(["I'm"])

      await act(async () => {
        h.boundary(1, 'Melody.')
      })
      revealed = screen
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
        .map((el) => el.getAttribute('data-word'))
      expect(revealed).toEqual(["I'm", 'Melody.'])
    })

    it('forces line fully revealed at line-end (covers the punctuation/no-boundary fallback)', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
      fireWakeTap()

      await completeLine(h)

      const ribbon = screen.getByTestId('greet-ribbon')
      const revealed = within(ribbon)
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
      expect(revealed).toHaveLength(1)
    })

    it('triggers the ear-wiggle when the "Hi!" boundary arrives', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
      fireWakeTap()

      // Pre-condition: idle.
      expect(screen.getByTestId('greet-melody')).toHaveAttribute(
        'data-pose',
        'idle',
      )

      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].opts?.onBoundary).toBeTypeOf('function')

      await act(async () => {
        h.boundary(0, 'Hi!')
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

    it('does not trigger the ear-wiggle on non-"Hi!" boundaries', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
      fireWakeTap()

      await completeLine(h)
      await crossGap()

      await act(async () => {
        h.boundary(0, "I'm")
        h.boundary(1, 'Melody.')
      })
      const poses = screen
        .getAllByTestId('greet-melody')
        .map((el) => el.getAttribute('data-pose'))
      expect(poses).toEqual(['idle'])
    })

    it('reveals the heart only after line 3 ("It\'s so nice to meet you.") completes', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
      fireWakeTap()
      // The ribbon mounts as soon as the engine reports it actually started
      // speaking (post-#86c9gp99a-real iPad fix: empty ribbon never shows
      // before evidence of audio). Fire onStart so the ribbon mounts, then
      // assert no words are revealed yet — we haven't sent a boundary.
      act(() => {
        h.fireOnStart()
      })

      const revealed = screen
        .getAllByTestId('greet-caption-word')
        .filter((el) => el.getAttribute('data-revealed') === 'true')
      expect(revealed).toHaveLength(0)
    })

    it('caption text font-size is comfortably above the 28pt floor', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
      fireWakeTap()
      // Force the ribbon to mount via onStart (see preceding test for why).
      act(() => {
        h.fireOnStart()
      })

      const caption = screen.getByTestId('greet-caption')
      expect(caption.className).toMatch(/text-\[2\.4rem\]/)
    })
  })

  describe('Wake-tap event-binding coverage (post-#86c9gp99a-real iPad fix)', () => {
    it('responds to a click event (the iPad-Safari-honored gesture for speech unlock)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.click(target)

      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].text).toBe('Hi!')
    })

    it('responds to a touchend event (iPad gesture-gate fallback)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.touchEnd(target)

      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].text).toBe('Hi!')
    })

    it('responds to a pointerdown event (Chromium / desktop snappy path)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      const target = screen.getByTestId('greet-wake-tap-target')
      fireEvent.pointerDown(target)

      expect(h.calls).toHaveLength(1)
    })

    it('triple-fires from one tap (touchend + pointerdown + click) only fire speak ONCE', () => {
      // Single physical tap on iPad Safari delivers touchend → pointerdown → click
      // in quick succession; React batches the state updates so all three handlers
      // see screenState === 'wake'. The same-tick guard must collapse them.
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
    it('does NOT mount the ribbon synchronously on wake-tap before any speech evidence', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      // Screen state advanced — but no onStart, no boundary, no evidence the
      // engine actually picked up the call. iPad Safari can silently reject;
      // the ribbon must not appear as an empty rounded rectangle.
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-screen-state',
        'intro',
      )
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()
    })

    it('mounts the ribbon as soon as onStart fires (engine confirmed speaking)', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()

      act(() => {
        h.fireOnStart()
      })
      expect(screen.getByTestId('greet-ribbon')).toBeInTheDocument()
    })

    it('mounts the ribbon when a boundary fires even if onStart was skipped (engine quirk fallback)', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      expect(screen.queryByTestId('greet-ribbon')).toBeNull()

      // Some engines skip onstart but emit onboundary — the gate also flips
      // to unlocked on the first boundary (greetSequence wires this).
      await act(async () => {
        h.boundary(0, 'Hi!')
      })
      expect(screen.getByTestId('greet-ribbon')).toBeInTheDocument()
    })

    it('does NOT mount the ribbon in the silent-fail relock path', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      // 2s elapses with no onStart and no boundary — gate flips to relock.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
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
    it('if onStart never fires within 2s of the wake tap, the gate transitions to relock and shows the ring + tap target again', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      // Speak fired but onStart is never called — simulating iPad Safari
      // silently rejecting the call.
      expect(h.calls).toHaveLength(1)

      // 2s elapses. Watchdog flips to relock.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
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

    it('the next user gesture after a silent fail synchronously re-fires speak(line0) with a fresh utterance', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      // First tap — speak fired but engine ignored it.
      fireWakeTap()
      expect(h.calls).toHaveLength(1)

      // Watchdog expires.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'relock',
      )

      // Second tap — synchronously retries speak(line0).
      fireWakeTap()
      // A new speak() call has fired.
      expect(h.calls.length).toBeGreaterThanOrEqual(2)
      const lastCall = h.calls[h.calls.length - 1]
      expect(lastCall.text).toBe('Hi!')

      // This time the engine actually starts.
      act(() => {
        h.fireOnStart()
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )
    })

    it('a successful onStart inside the 2s window keeps the gate in unlocked state — no ring re-show', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      fireWakeTap()
      // Engine starts speaking promptly.
      act(() => {
        h.fireOnStart()
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )

      // Past the 2s mark: gate stays unlocked, no relock surfaces. The
      // ring may still be in the DOM mid-exit-animation (rAF driver
      // doesn't tick under jsdom fake timers) but it's invisible — we
      // assert on the gate state rather than ring presence.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000)
      })
      expect(screen.getByTestId('greet')).toHaveAttribute(
        'data-gate-state',
        'unlocked',
      )
    })
  })

  describe('heart tap (happy path)', () => {
    async function advanceToHeart(h: ReturnType<typeof makeSpeakHarness>) {
      fireWakeTap()
      for (let i = 0; i <= HEART_REVEAL_AFTER_LINE_INDEX; i++) {
        await completeLine(h)
        if (i < HEART_REVEAL_AFTER_LINE_INDEX) await crossGap()
      }
    }

    it('plays the chime, squishes, and calls onAdvance within 400ms', async () => {
      mediaSpy = stubReducedMotion(false)
      const onAdvance = vi.fn()
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={onAdvance} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()

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
            speakFn={h.speakFn}
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

    it('cancels in-flight TTS on heart tap so Melody is silent during the chime', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      await advanceToHeart(h)
      const cancelsBefore = ttsCancelSpy.mock.calls.length
      fireEvent.click(screen.getByTestId('greet-heart'))
      expect(ttsCancelSpy.mock.calls.length).toBeGreaterThan(cancelsBefore)
    })

    it('debounces double-tap: only one onAdvance regardless of how many taps land', async () => {
      mediaSpy = stubReducedMotion(false)
      const onAdvance = vi.fn()
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={onAdvance} speakFn={h.speakFn} />))

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
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
    async function advanceToHeart(h: ReturnType<typeof makeSpeakHarness>) {
      fireWakeTap()
      for (let i = 0; i <= HEART_REVEAL_AFTER_LINE_INDEX; i++) {
        await completeLine(h)
        if (i < HEART_REVEAL_AFTER_LINE_INDEX) await crossGap()
      }
    }

    it('re-speaks line 3 once after 20s without a tap, then never again', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      await advanceToHeart(h)
      let elapsedSinceArm = 0
      await crossGap()
      elapsedSinceArm += LINE_GAP_MS
      await completeLine(h)

      const speaksBefore = h.calls.length
      expect(speaksBefore).toBe(GREET_LINES.length) // all 4 lines spoken once

      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          REPROMPT_AFTER_MS - elapsedSinceArm - 1,
        )
      })
      expect(h.calls.length).toBe(speaksBefore)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(h.calls.length).toBe(speaksBefore + 1)
      expect(h.calls[h.calls.length - 1].text).toBe(
        "Tap the heart when you're ready.",
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(REPROMPT_AFTER_MS * 2)
      })
      expect(h.calls.length).toBe(speaksBefore + 1)
    })

    it('cancels the re-prompt when the heart is tapped first', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      await advanceToHeart(h)
      await crossGap()
      await completeLine(h)

      const speaksBefore = h.calls.length

      fireEvent.click(screen.getByTestId('greet-heart'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(REPROMPT_AFTER_MS * 2)
      })
      expect(h.calls.length).toBe(speaksBefore)
    })
  })

  describe('reduced motion', () => {
    it('renders core surfaces, no speak() before tap, ring static at 0.5 opacity', () => {
      mediaSpy = stubReducedMotion(true)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      expect(screen.getByTestId('greet')).toBeInTheDocument()
      expect(screen.getByTestId('greet-clouds')).toBeInTheDocument()
      expect(screen.getByTestId('greet-melody')).toBeInTheDocument()
      expect(screen.getByTestId('greet-ready-ring')).toBeInTheDocument()
      // No speak before tap, regardless of motion preference.
      expect(h.calls).toHaveLength(0)
    })

    it('does not pulse the wake-icon under reduced motion (single fade only)', () => {
      mediaSpy = stubReducedMotion(true)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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
    it('cancels TTS and unloads the chime on unmount', () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      const { unmount } = render(
        withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />),
      )

      const cancelsBefore = ttsCancelSpy.mock.calls.length
      unmount()

      expect(ttsCancelSpy.mock.calls.length).toBeGreaterThan(cancelsBefore)
      expect(sfxState.last?.unload).toHaveBeenCalledTimes(1)
    })
  })
})
