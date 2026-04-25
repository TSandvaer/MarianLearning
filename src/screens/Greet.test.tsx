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
  })

  afterEach(() => {
    vi.useRealTimers()
    mediaSpy?.mockRestore()
    mediaSpy = undefined
  })

  it('renders Melody (idle pose), the cloud bg, and the speech ribbon on mount', () => {
    mediaSpy = stubReducedMotion(false)
    const h = makeSpeakHarness()
    render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

    expect(screen.getByTestId('greet')).toBeInTheDocument()
    expect(screen.getByTestId('greet-clouds')).toBeInTheDocument()
    expect(screen.getByTestId('greet-ribbon')).toBeInTheDocument()
    // Initial pose is idle. (Only one Melody element on first paint — the
    // pose-swap cross-fade only kicks in after a wiggle trigger.)
    const melodyEls = screen.getAllByTestId('greet-melody')
    expect(melodyEls).toHaveLength(1)
    expect(melodyEls[0]).toHaveAttribute('data-pose', 'idle')
    expect(melodyEls[0]).toHaveAttribute('alt', 'Melody')
    // Heart is not yet rendered; spec line 197.
    expect(screen.queryByTestId('greet-heart')).toBeNull()
  })

  it('starts the TTS sequence with line 0 ("Hi!") on mount', () => {
    mediaSpy = stubReducedMotion(false)
    const h = makeSpeakHarness()
    render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].text).toBe('Hi!')
  })

  it('reveals caption words progressively as boundary events fire', async () => {
    mediaSpy = stubReducedMotion(false)
    const h = makeSpeakHarness()
    render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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

  it('forces the line fully revealed at line-end (covers the punctuation/no-boundary fallback)', async () => {
    mediaSpy = stubReducedMotion(false)
    const h = makeSpeakHarness()
    render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

    // Resolve line 0 without ever firing a boundary — line should still
    // appear fully revealed because of the line-end fallback.
    await completeLine(h)

    const ribbon = screen.getByTestId('greet-ribbon')
    const revealed = within(ribbon)
      .getAllByTestId('greet-caption-word')
      .filter((el) => el.getAttribute('data-revealed') === 'true')
    // "Hi!" tokenises to a single word in our caption renderer.
    expect(revealed).toHaveLength(1)
    // Greet's active line moved to 1 ("I'm Melody.") because the gap timer
    // fires the next speak(); we only asserted the ribbon content, which
    // by the time of assertion shows line 1's progress (0 revealed). The
    // important guarantee is that line 0 was filled before we advanced.
  })

  it('triggers the ear-wiggle when the "Hi!" boundary arrives', async () => {
    mediaSpy = stubReducedMotion(false)
    const h = makeSpeakHarness()
    render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

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

    // AnimatePresence cross-fades idle ↔ happy without mode="wait", so for
    // a few frames both elements are in the DOM. Asserting via the set of
    // poses present is more robust than getByTestId during the swap.
    let poses = screen
      .getAllByTestId('greet-melody')
      .map((el) => el.getAttribute('data-pose'))
    expect(poses).toContain('happy')

    // After ~600ms the wiggle ends and Melody returns to idle.
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

    await completeLine(h)
    await crossGap()

    // Line 1: "I'm Melody." — neither word should trigger the wiggle.
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

    // Lines 0, 1, 2: heart must NOT appear during these.
    for (let i = 0; i <= HEART_REVEAL_AFTER_LINE_INDEX; i++) {
      expect(screen.queryByTestId('greet-heart')).toBeNull()
      await completeLine(h)
      if (i < HEART_REVEAL_AFTER_LINE_INDEX) {
        // Still pre-reveal: heart should still be gone.
        expect(screen.queryByTestId('greet-heart')).toBeNull()
        await crossGap()
      }
    }

    // Line 2 just completed — heart must now exist.
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

    const revealed = screen
      .getAllByTestId('greet-caption-word')
      .filter((el) => el.getAttribute('data-revealed') === 'true')
    expect(revealed).toHaveLength(0)
  })

  it('caption text font-size is comfortably above the 28pt floor', () => {
    mediaSpy = stubReducedMotion(false)
    const h = makeSpeakHarness()
    render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

    const caption = screen.getByTestId('greet-caption')
    // Tailwind text-[2.4rem] on the <p>; classList carries the arbitrary value.
    expect(caption.className).toMatch(/text-\[2\.4rem\]/)
    // 2.4rem at the default 16px root = 38.4px ≈ 28.8pt — above the 28pt floor.
  })

  describe('heart tap (happy path)', () => {
    async function advanceToHeart(h: ReturnType<typeof makeSpeakHarness>) {
      // Lines 0..2 must complete to reveal the heart.
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
      fireEvent.click(heart)

      // Chime fired exactly once.
      expect(sfxState.last?.play).toHaveBeenCalledTimes(1)

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
      expect(missingChime.play).toHaveBeenCalledTimes(1)
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
      fireEvent.click(heart)
      fireEvent.click(heart)
      fireEvent.click(heart)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(onAdvance).toHaveBeenCalledTimes(1)
      // Chime also debounced.
      expect(sfxState.last?.play).toHaveBeenCalledTimes(1)
    })

    it('triggers ear-wiggle (wave) on tap per spec line 179', async () => {
      mediaSpy = stubReducedMotion(false)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      await advanceToHeart(h)
      // Pre-tap: we never fired the 'Hi!' boundary so Melody is still idle.
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

  describe('20s no-tap re-prompt', () => {
    async function advanceToHeart(h: ReturnType<typeof makeSpeakHarness>) {
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
      // The re-prompt timer was armed when the heart became visible. From
      // here we still need to cross the inter-line gap and complete line 3
      // before we have a quiet "heart-ready, no taps yet" state. Track the
      // elapsed-since-arming so we can sit just below the 20s threshold.
      let elapsedSinceArm = 0
      await crossGap()
      elapsedSinceArm += LINE_GAP_MS
      await completeLine(h)

      const speaksBefore = h.calls.length
      expect(speaksBefore).toBe(GREET_LINES.length) // all 4 lines spoken once

      // Advance to one tick before the re-prompt fires.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          REPROMPT_AFTER_MS - elapsedSinceArm - 1,
        )
      })
      expect(h.calls.length).toBe(speaksBefore) // still no re-prompt

      // Cross the threshold — re-prompt fires exactly once.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(h.calls.length).toBe(speaksBefore + 1)
      expect(h.calls[h.calls.length - 1].text).toBe(
        "Tap the heart when you're ready.",
      )

      // Cross another 20s — must NOT fire again. Spec line 200.
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
      // Now wait far past the 20s window.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(REPROMPT_AFTER_MS * 2)
      })
      // No new TTS line was spoken.
      expect(h.calls.length).toBe(speaksBefore)
    })
  })

  describe('reduced motion', () => {
    it('still renders core surfaces and runs the sequence', () => {
      mediaSpy = stubReducedMotion(true)
      const h = makeSpeakHarness()
      render(withMotion(<Greet onAdvance={vi.fn()} speakFn={h.speakFn} />))

      expect(screen.getByTestId('greet')).toBeInTheDocument()
      expect(screen.getByTestId('greet-clouds')).toBeInTheDocument()
      expect(screen.getByTestId('greet-melody')).toBeInTheDocument()
      // Sequence still ticks in reduced-motion mode.
      expect(h.calls).toHaveLength(1)
      expect(h.calls[0].text).toBe('Hi!')
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
