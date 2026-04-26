import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

// Stub the SFX factory so jsdom never tries to construct a real Howl.
// Same pattern as Math.test.tsx.
type FakeSfx = {
  play: ReturnType<typeof vi.fn>
  unload: ReturnType<typeof vi.fn>
  missedPlays: number
  loadFailed: boolean
}
const sfxState: { instances: FakeSfx[]; createCount: number } = {
  instances: [],
  createCount: 0,
}
vi.mock('../../lib/sfx', () => ({
  createSfx: vi.fn(() => {
    const fake: FakeSfx = {
      play: vi.fn(() => true),
      unload: vi.fn(),
      missedPlays: 0,
      loadFailed: false,
    }
    sfxState.instances.push(fake)
    sfxState.createCount += 1
    return fake
  }),
}))

import WordSong from './WordSong'
import type { PlayWordSongUtteranceFn } from './WordSong'
import type { WordSongSessionPlan } from './wordSessionPlans'
import { STARDUST_STORAGE_KEY, type StorageAdapter } from '../Math/stardust'
import { getWordEntry } from './wordPack'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** A fixed plan for tests — uses real word entries so distractor matrix
 *  resolves cleanly. Uses the easiest words across both tiers so every
 *  problem has 3 chips with predictable values. */
function fixedPlan(): WordSongSessionPlan {
  const words = ['cat', 'bag', 'jam', 'fan', 'pan', 'man', 'tag', 'cap']
  return {
    id: 'test-plan',
    label: 'Test plan',
    problems: words.map((word, i) => {
      const target = getWordEntry(word)
      const Word = word[0].toUpperCase() + word.slice(1)
      return {
        index: i + 1,
        target,
        utterances: {
          read: `Tap the ${word}.`,
          correct: `Yes! ${Word}.`,
          reprompt: 'Hmm... try again?',
          hint: `Let's look. ${Word}.`,
          giveAnswer: `This one is ${word}.`,
        },
      }
    }),
  }
}

function makeMemoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

/**
 * Build a controllable PlayWordSongUtteranceFn fake. Captures every call
 * so tests can assert what was spoken.
 */
function makePlayHarness(opts: { autoResolve?: boolean } = {}) {
  const calls: Array<{
    text: string
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const playUtterance: PlayWordSongUtteranceFn = vi.fn(
    async (text, playOpts) => {
      return await new Promise<void>((resolve, reject) => {
        calls.push({ text, resolve, reject })
        playOpts?.onPlay?.()
        const words = text.split(/\s+/).filter(Boolean)
        for (let i = 0; i < words.length; i++) {
          playOpts?.onWordTick?.(i)
        }
        if (opts.autoResolve !== false) {
          Promise.resolve().then(() => resolve())
        }
      })
    },
  )

  return {
    playUtterance,
    calls,
    spoken(): string[] {
      return calls.map((c) => c.text)
    },
    resolveAll(): void {
      for (const c of calls) c.resolve()
    },
  }
}

describe('Word Song screen', () => {
  beforeEach(() => {
    sfxState.instances = []
    sfxState.createCount = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the first problem on mount with HUD, melody, word card, and chips', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    expect(screen.getByTestId('word-song')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-hud')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )

    // Word card with picture + letters
    expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
      'data-word',
      'cat',
    )
    expect(screen.getByTestId('word-song-word-picture')).toBeInTheDocument()
    const letters = screen.getAllByTestId('word-song-letter')
    expect(letters).toHaveLength(3) // c-a-t
    expect(letters[0]).toHaveAttribute('data-letter', 'c')
    expect(letters[1]).toHaveAttribute('data-letter', 'a')
    expect(letters[2]).toHaveAttribute('data-letter', 't')

    // 3 chips total — 1 correct + 2 distractors
    const chips = screen.getAllByTestId('word-song-chip')
    expect(chips).toHaveLength(3)
    const words = chips.map((c) => c.getAttribute('data-word'))
    expect(words).toContain('cat') // correct
    expect(new Set(words).size).toBe(3) // all distinct

    // Streak indicator hidden until streak >= 2.
    expect(screen.queryByTestId('word-song-streak')).not.toBeInTheDocument()
  })

  it("uses Kyle's gentle-tier matrix pair for problem 1 (cat → [bus, sun])", () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const words = chips.map((c) => c.getAttribute('data-word'))
    expect(words).toEqual(expect.arrayContaining(['cat', 'bus', 'sun']))
  })

  it('happy path: tapping correct picture grants stardust, increments streak, advances', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const storage = makeMemoryStorage()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={storage}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!
    expect(correctChip).toBeDefined()

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )
    expect(harness.spoken()).toContain('Yes! Cat.')
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '1')
    expect(screen.queryByTestId('word-song-streak')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )

    const stored = storage.getItem(STARDUST_STORAGE_KEY)
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored!).total).toBe(1)
  })

  it('wrong-then-right: still grants stardust, but streak does not advance', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const correctChip = chips.find(
      (c) => c.getAttribute('data-word') === 'cat',
    )!
    const wrongChip = chips.find((c) => c.getAttribute('data-word') !== 'cat')!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    expect(harness.spoken()).toContain('Hmm... try again?')

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '0')
  })

  it('hint utterance fires after 2 wrong attempts on the same problem', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const wrongChips = chips.filter(
      (c) => c.getAttribute('data-word') !== 'cat',
    )

    await act(async () => {
      fireEvent.click(wrongChips[0])
      await Promise.resolve()
    })
    await act(async () => {
      fireEvent.click(wrongChips[1] ?? wrongChips[0])
      await Promise.resolve()
    })

    // Hint timer (600ms beat) hasn't fired yet — fast-forward.
    await act(async () => {
      vi.advanceTimersByTime(700)
      await Promise.resolve()
    })

    // Per spec line 297: hint TTS = "Let's look. {Word}." — sound-out
    // happens via the per-letter phoneme audio (deferred to phoneme-pipeline
    // workstream), but the hint utterance itself fires now.
    expect(harness.spoken()).toContain("Let's look. Cat.")
  })

  it('streak threshold [3, 5, 8] grants a bonus stardust at streak 3', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    render(
      withMotion(
        <WordSong
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const idx = Number(
        screen.getByTestId('word-song').getAttribute('data-problem-index'),
      )
      const correctWord = plan.problems[idx].target.word
      const correctChip = chips.find(
        (c) => c.getAttribute('data-word') === correctWord,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    await tapCorrect() // streak=1
    await tapCorrect() // streak=2
    await tapCorrect() // streak=3 → +1 bonus

    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '4', // 3 base + 1 bonus
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '3')
    expect(screen.getByTestId('word-song-streak')).toBeInTheDocument()
  })

  it('streak resets to 0 on a wrong tap that breaks an active streak', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    render(
      withMotion(
        <WordSong
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const idx = Number(
        screen.getByTestId('word-song').getAttribute('data-problem-index'),
      )
      const correctWord = plan.problems[idx].target.word
      const correctChip = chips.find(
        (c) => c.getAttribute('data-word') === correctWord,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    await tapCorrect()
    await tapCorrect()
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '2')
    expect(screen.getByTestId('word-song-streak')).toBeInTheDocument()

    // Now tap wrong on problem 3.
    const chips = screen.getAllByTestId('word-song-chip')
    const idx = Number(
      screen.getByTestId('word-song').getAttribute('data-problem-index'),
    )
    const correctWord = plan.problems[idx].target.word
    const wrongChip = chips.find(
      (c) => c.getAttribute('data-word') !== correctWord,
    )!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '0')
  })

  it('after 3 wrong attempts, guided completion dims other chips and disables them', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChips = screen
      .getAllByTestId('word-song-chip')
      .filter((c) => c.getAttribute('data-word') !== 'cat')

    for (let i = 0; i < 3; i++) {
      const ch = wrongChips[i % wrongChips.length]
      await act(async () => {
        fireEvent.click(ch)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(800)
        await Promise.resolve()
      })
    }

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'true',
    )

    const chipsAfter = screen.getAllByTestId('word-song-chip')
    for (const c of chipsAfter) {
      const isCorrect = c.getAttribute('data-word') === 'cat'
      if (isCorrect) {
        expect(c).not.toBeDisabled()
      } else {
        expect(c).toBeDisabled()
      }
    }

    expect(harness.spoken()).toContain('This one is cat.')
  })

  it('completes the session on problem 8 and invokes onSessionComplete with surface=word-song', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <WordSong
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          onSessionComplete={onSessionComplete}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const idx = Number(
        screen.getByTestId('word-song').getAttribute('data-problem-index'),
      )
      const correctWord = plan.problems[idx].target.word
      const correctChip = chips.find(
        (c) => c.getAttribute('data-word') === correctWord,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    for (let i = 0; i < 8; i++) {
      await tapCorrect()
    }

    // 8 base + bonuses at streak 3, 5, 8 = 11 stardust
    expect(onSessionComplete).toHaveBeenCalledTimes(1)
    const arg = onSessionComplete.mock.calls[0][0]
    expect(arg.totalCorrect).toBe(8)
    expect(arg.totalStardust).toBe(11)
    expect(arg.finalStreak).toBe(8)
    expect(arg.earnedThisSession).toBe(11)
    expect(arg.surface).toBe('word-song')
  })

  it("chips have an accessible label with the picture's word", () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    for (const c of chips) {
      const w = c.getAttribute('data-word')
      expect(c).toHaveAttribute('aria-label', `Picture of ${w}`)
    }
  })

  it('does not display any "X" or "wrong" copy on a wrong tap (anti-dark-pattern)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    const screenText = screen.getByTestId('word-song').textContent ?? ''
    expect(screenText.toLowerCase()).not.toContain('wrong')
    expect(screenText.toLowerCase()).not.toContain('incorrect')
  })

  it('letter taps pulse the letter visually, independent of attempt count', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Streak shouldn't change, attempt-count effects shouldn't fire — letter
    // taps are pure exploration affordance per spec §"Letter-tap state".
    const initialStreak = screen
      .getByTestId('word-song')
      .getAttribute('data-streak')

    const letters = screen.getAllByTestId('word-song-letter')
    await act(async () => {
      fireEvent.click(letters[0])
      fireEvent.click(letters[1])
      fireEvent.click(letters[2])
      await Promise.resolve()
    })

    // Tapping letters did NOT advance the problem or break a streak.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '0',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-streak',
      initialStreak ?? '0',
    )

    // Letter elements still tappable (exploration affordance).
    expect(letters[0]).not.toBeDisabled()
  })

  it('chip-tap kicks resumeAudioContext synchronously before audio (ticket 86c9gvd0y Phase 2)', async () => {
    const harness = makePlayHarness()
    const resumeSpy = vi.fn()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          resumeAudioContext={resumeSpy}
        />,
      ),
    )

    expect(resumeSpy).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(resumeSpy).toHaveBeenCalledTimes(1)
    const resumeOrder = resumeSpy.mock.invocationCallOrder[0]
    const playOrder = (
      harness.playUtterance as unknown as {
        mock: { invocationCallOrder: number[] }
      }
    ).mock.invocationCallOrder[0]
    expect(resumeOrder).toBeLessThan(playOrder)
  })

  it('chip-tap kicks unlockAudioSession synchronously before audio (ticket 86c9gvd0y Phase 5)', async () => {
    const harness = makePlayHarness()
    const unlockSpy = vi.fn()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          unlockAudioSession={unlockSpy}
        />,
      ),
    )

    expect(unlockSpy).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(unlockSpy).toHaveBeenCalledTimes(1)
    const unlockOrder = unlockSpy.mock.invocationCallOrder[0]
    const playOrder = (
      harness.playUtterance as unknown as {
        mock: { invocationCallOrder: number[] }
      }
    ).mock.invocationCallOrder[0]
    expect(unlockOrder).toBeLessThan(playOrder)
  })

  it('stardust persists with the SHARED Math/Word Song key (cross-screen accumulation)', async () => {
    // Per spec §"Stardust treatment" → "Cross-screen accumulation": same
    // key as Math (`marian-tutor.stardust.v1`), same schema. A Math
    // session that ended with N stardust should be visible on Word Song
    // mount.
    const storage = makeMemoryStorage()
    // Pre-seed storage as if Math had run first.
    storage.setItem(
      STARDUST_STORAGE_KEY,
      JSON.stringify({
        total: 5,
        lastUpdatedAt: new Date(0).toISOString(),
        schemaVersion: 1,
      }),
    )

    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={storage}
        />,
      ),
    )

    // Word Song mounts and reads the existing total — counter shows 5.
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '5',
    )
  })

  it('renders the picture chip SVG with the correct picture-key data attribute', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Each chip should carry a picture-key matching its target word.
    const chips = screen.getAllByTestId('word-song-chip')
    for (const chip of chips) {
      const word = chip.getAttribute('data-word')
      const pictureKey = chip.getAttribute('data-picture-key')
      // pictureKey defaults to word for the placeholder pack — when real
      // assets land, this assertion still holds (file naming is
      // `picture-{word}.svg`).
      expect(pictureKey).toBe(word)
      // The inner picture SVG renders with the same key.
      const innerPicture = within(chip).getByTestId('word-picture')
      expect(innerPicture).toHaveAttribute('data-picture-key', word)
    }
  })
})
