import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

/*
 * ────────────────────────────────────────────────────────────────────────
 * FAILING-FIRST spec — Wave 14 Track B (ClickUp 86ca8kq7r).  WordSong sibling
 * of src/screens/Math/__tests__/emma-pose-beats.test.tsx.
 *
 * Pins the two never-set EmmaPose values at their intended beats:
 *   - `listening`          — Emma-speaking (read-aloud) beat.
 *   - `attentive-pointing` — hint / pre-canned-explanation beat.
 *
 * RED on current `main` (poses never set; `data-pose` stays `idle` at these
 * beats). Makeable-GREEN by WordSong.tsx `setPose()` wiring ALONE — no change
 * to EmmaCharacter.tsx or emmaPose.ts.
 *
 * The `data-pose` selector lives on the EmmaCharacter `<m.img>`
 * (`data-testid="word-song-emma"`).
 * ────────────────────────────────────────────────────────────────────────
 */

// Stub the SFX factory so jsdom never tries to construct a real Howl.
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
vi.mock('../../../lib/sfx', () => ({
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

import WordSong from '../WordSong'
import type { PlayWordSongUtteranceFn } from '../WordSong'
import type { WordSongSessionPlan } from '../wordSessionPlans'
import { type StorageAdapter } from '../../_shared/stardust'
import { getWordEntry } from '../wordPack'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** Force the matchMedia query for prefers-reduced-motion. */
function stubReducedMotion(matches: boolean) {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: matches && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }))
}

/** A fixed plan using real word entries. Problem 1 target = `cat`. */
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

/** Controllable PlayWordSongUtteranceFn fake (mirrors WordSong.test.tsx). */
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
    resolveByText(text: string): void {
      for (const c of calls) if (c.text === text) c.resolve()
    },
    resolveAll(): void {
      for (const c of calls) c.resolve()
    },
  }
}

/**
 * Read the CURRENT LIVE pose from the SCREEN ROOT
 * (`data-testid="word-song"`, which mirrors `data-pose={pose}` straight off
 * React state — see WordSong.tsx). The screen root is the single source of
 * truth and reflects exactly the committed `pose` state, with no
 * AnimatePresence lifecycle in the way.
 *
 * Why NOT read `word-song-emma` (`getAllByTestId(...).at(-1)`): the
 * EmmaCharacter `<m.img>` is wrapped in `<AnimatePresence>` with a 0.15s
 * exit. When a pose RETURNS to a previously-used key (listening → idle,
 * attentive-pointing → idle), Framer revives the original `idle` element in
 * its ORIGINAL slot (first) and the exiting non-idle img lingers as the
 * LAST DOM node — its exit never completes under fake timers, ~150ms under
 * real timers. `.at(-1)` then returns the STALE exiting pose, not the live
 * one. The screen-root selector sidesteps the AnimatePresence lifecycle
 * entirely and reads true React state. `emmaEl` below still reads
 * `word-song-emma` for `src` / `data-wiggling` attribute checks, which only
 * assert on the single freshly-mounted non-idle element.
 */
const POSE = (testid = 'word-song') => {
  return screen.getByTestId(testid).getAttribute('data-pose')
}
/** Read the live EmmaCharacter element (newest mount) for attribute checks. */
const emmaEl = (testid = 'word-song-emma') => {
  const all = screen.getAllByTestId(testid)
  return all[all.length - 1]
}

describe('Word Song — Emma pose beats (Wave 14 Track B)', () => {
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

  // ── RED-on-base lever #1: listening during the read-aloud beat ──────────
  it('shows `listening` while Emma reads the word aloud, clears to `idle` on speak onEnd', async () => {
    const harness = makePlayHarness({ autoResolve: false })
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Drain the read-aloud dispatch chain WITHOUT resolving the speak().
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(harness.spoken()).toEqual(['Tap the cat.'])

    // RED-on-base lever: pose is `listening` while Emma speaks.
    expect(POSE()).toBe('listening')

    await act(async () => {
      harness.resolveByText('Tap the cat.')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(POSE()).toBe('idle')
  })

  // ── RED-on-base lever #2: attentive-pointing during the hint beat ───────
  it('shows `attentive-pointing` while the hint plays, clears to `idle` on hint onEnd', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness({ autoResolve: false })
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongTap = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const wrongChip = chips.find(
        (c) => c.getAttribute('data-word') !== 'cat',
      )!
      await act(async () => {
        fireEvent.click(wrongChip)
        await Promise.resolve()
      })
    }

    // Two wrong taps → second crosses HINT_AFTER_WRONG_COUNT.
    await wrongTap()
    await act(async () => {
      harness.resolveByText('Hmm... try again?')
      await Promise.resolve()
    })
    await wrongTap()
    await act(async () => {
      harness.resolveByText('Hmm... try again?')
      await Promise.resolve()
    })

    // Fire the 600ms hint-delay timer → speak(hint).
    await act(async () => {
      vi.advanceTimersByTime(600)
      await Promise.resolve()
    })

    expect(harness.spoken()).toContain("Let's look. Cat.")

    // RED-on-base lever: pose is `attentive-pointing` while the hint plays.
    expect(POSE()).toBe('attentive-pointing')

    await act(async () => {
      harness.resolveByText("Let's look. Cat.")
      // Drain the await-chain microtasks (speak()'s finally → the hint
      // speak().then() callback) so the setTimeout(0) idle-clear is
      // SCHEDULED before we advance the fake clock. A single flush lands
      // between the two hops and would advance the timer before the clear
      // is queued.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      // pose clear uses a setTimeout(0).
      vi.advanceTimersByTime(0)
      await Promise.resolve()
    })

    expect(POSE()).toBe('idle')
  })

  // ── Regression-lock: puzzled-tilt still fires on a wrong tap ────────────
  //
  // The reprompt speak() is held pending (autoResolve:false) so puzzled-tilt
  // is the LIVE committed `pose` state at assertion time — faithful to
  // production, where the reprompt TTS runs ~2s before the pose returns to
  // idle. (With an auto-resolving reprompt the pose would clear to idle on
  // the reprompt's setTimeout(0) onEnd before we read, and only a lingering
  // AnimatePresence exit element would still carry the pose.) POSE reads the
  // screen-root `data-pose` = true React state — see the POSE helper above.
  it('regression-lock: wrong tap still swaps Emma to `puzzled-tilt`', async () => {
    const harness = makePlayHarness({ autoResolve: false })
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const wrongChip = chips.find((c) => c.getAttribute('data-word') !== 'cat')!
    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    expect(POSE()).toBe('puzzled-tilt')
  })

  // ── Regression-lock: celebration still fires on a correct tap ───────────
  it('regression-lock: correct tap still swaps Emma to `celebration`', async () => {
    const harness = makePlayHarness({ autoResolve: false })
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
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
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // celebration set synchronously on correct tap (before the celebration
    // speak() resolves — held pending here so auto-advance doesn't fire).
    expect(POSE()).toBe('celebration')
  })

  // ── Reduce-motion: pose SVG still swaps; tilt skipped ───────────────────
  it('reduce-motion: `listening` SVG swaps but tilt is skipped (data-wiggling=false)', async () => {
    stubReducedMotion(true)
    const harness = makePlayHarness({ autoResolve: false })
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const emma = emmaEl('word-song-emma')
    expect(emma.getAttribute('data-pose')).toBe('listening')
    expect(emma.getAttribute('src')).toBe('/assets/emma-listening.svg')
    expect(emma.getAttribute('data-wiggling')).toBe('false')
  })
})
