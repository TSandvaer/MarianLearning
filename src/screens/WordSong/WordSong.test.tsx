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

  it('rage-tap: 5 rapid clicks on correct picture chip grant exactly 1 stardust and a single auto-advance', async () => {
    // Strict single-grant on rapid tap, mirrors Math's PR #66 fix to
    // ticket 86c9gy4mf.
    //
    // Reproduces the worst-case 8-year-old gesture (frustrated smash on
    // the correct picture chip) and asserts the strict single-grant
    // behaviour:
    //   - exactly 1 stardust granted (data-total='1')
    //   - streak advances by exactly 1 (data-streak='1')
    //   - exactly one auto-advance scheduled (problem-index goes 0 → 1)
    //   - onSessionComplete is NOT called (we're 1/8 deep, not 8/8)
    //
    // Background: prior to the ref-guard, `problemState.resolved` was
    // held in React useState. Five synchronous fireEvent.click calls all
    // captured the same closure with resolved=false and each ran the full
    // reward path → 5 base stardust + streak bonuses at thresholds 3 and
    // 5 (= 2 extra) = 7 total. The fix moves the gate to a useRef
    // (`resolvedRef.current`) so the very next click in the same tick
    // sees the flipped value and bails. The visual `disabled` chip
    // styling still derives from React state; only the synchronous gate
    // uses the ref.
    //
    // In the real browser the chip is `disabled` once resolved — disabled
    // buttons swallow the second click natively. jsdom does not honour
    // that, so the bug surfaced here even though it might not reproduce
    // on iPad. The ref-guard protects both environments.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          onSessionComplete={onSessionComplete}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    // 5 synchronous clicks — no awaits between them.
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(correctChip)
      }
      await Promise.resolve()
    })

    // Strict single-grant: 5 rapid taps → exactly 1 stardust, no streak
    // compounding. Pre-fix this would have been '7' (5 base + bonuses at
    // streak thresholds 3 and 5).
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '1')

    // onSessionComplete has NOT yet fired — auto-advance is scheduled but
    // the timer hasn't elapsed. This is problem 1 of 8; the session ends
    // only when the 8th problem's auto-advance lands.
    expect(onSessionComplete).not.toHaveBeenCalled()

    // Drain the auto-advance timer (1200ms). Exactly one advance should
    // fire — we land on problem index 1 (the second problem), not 2+.
    // The clearTimeout guard collapses repeated setTimeout calls into a
    // single pending advance, and the ref-guard ensures only the first
    // click ever schedules one.
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    // Still no session-complete; we're 1/8 deep, not 8/8.
    expect(onSessionComplete).not.toHaveBeenCalled()
    // Stardust didn't grow during the auto-advance either.
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )
  })

  it('rage-tap wrong chip: 5 rapid taps fire exactly 1 hint and 1 guided-completion', async () => {
    // Ticket 86c9gyb2v — peer-review follow-up to PR #69 (Word Song impl)
    // and the rage-tap fix in 86c9gy4mf. Same closure-stale class of bug as
    // `problemState.resolved`, but on the wrong-tap path:
    // `problemState.{wrongCount,hintPlayed,guidedPlayed}` were all read from
    // a captured closure inside `handleWrongTap`. 5 rapid wrong-taps in the
    // same React batch window all read pre-batch values:
    //   - each computed `nextWrongCount = 0 + 1 = 1` (stale wrongCount=0)
    //   - or all simultaneously crossed the hint/guided thresholds on a
    //     later batch when the closure refreshed
    //   - `!problemState.hintPlayed` / `!problemState.guidedPlayed` guards
    //     absorbed most damage but could still queue duplicate hint timers
    //     and duplicate guided dispatches.
    //
    // Direct mirror of Math 86c9gy7ju / PR #74. The Word Song-specific
    // wrinkle is a repromptInFlightRef lock that guards the .then() after
    // speak(reprompt) — if the problem advances while the reprompt is
    // in-flight, the stale .then() is a no-op instead of dispatching
    // hint/guided into the next problem.
    //
    // Each rapid tap DOES fire its own reprompt (5 taps → 5 reprompts).
    // Deduplication is at the hint/guided level via the ref-mirror gates,
    // not at the reprompt level. This test asserts:
    //   - reprompt fires once per tap (5 total);
    //   - hint fires EXACTLY once (ref gate deduplicates);
    //   - guided fires EXACTLY once (ref gate deduplicates);
    //   - guided-active state latches to true.
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

    // Pick one specific wrong chip — Marian is rage-tapping the SAME chip
    // (worst-case 8-year-old gesture). Choose the first non-correct chip.
    const wrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!
    expect(wrongChip).toBeDefined()

    // 5 synchronous clicks on the same wrong chip — no awaits between them.
    // This is the closure-stale-window: every click runs in the same React
    // batch, so without the ref fix every click reads the pre-batch state.
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(wrongChip)
      }
      await Promise.resolve()
    })

    // Drain the hint timer (600ms beat) AND the reprompt-then guided
    // dispatch microtasks. Advance plenty of time to let any duplicate
    // timers that the bug WOULD have queued elapse — if the gate is
    // working, only one of each fires regardless.
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const spoken = harness.spoken()

    // Reprompt fires once per tap — that's correct behaviour, not a bug.
    // Each wrong tap reprompts, even rapid ones; the deduplication is at
    // the hint/guided level, not at the reprompt level.
    const repromptCount = spoken.filter((t) => t === 'Hmm... try again?').length
    expect(repromptCount).toBe(5)

    // The load-bearing assertions: hint and giveAnswer each fire EXACTLY
    // once. Pre-fix: with batched closures crossing the threshold together,
    // multiple hint timers / guided dispatches could queue, producing
    // counts >1.
    const hintCount = spoken.filter((t) => t === "Let's look. Cat.").length
    expect(hintCount).toBe(1)

    const giveAnswerCount = spoken.filter(
      (t) => t === 'This one is cat.',
    ).length
    expect(giveAnswerCount).toBe(1)

    // Guided state is active exactly once (the latching also drives the
    // visual chip-dim). data-guided is the live attribute.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'true',
    )
  })

  it('single wrong-tap: no hint, no guided dispatch (regression guard)', async () => {
    // Ticket 86c9gyb2v AC: "No regression in single-tap wrong-handling".
    // After exactly ONE wrong tap, only the reprompt should have spoken;
    // the hint threshold is 2 and the guided threshold is 3, so neither
    // should fire. This guards against a refactor that accidentally moves
    // the gate from "==2" to ">=2" or similar.
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

    // Generous timer drain — even the longest hint-beat path (600ms +
    // hint utterance + post-hint pose timer) would have elapsed by now.
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const spoken = harness.spoken()

    // Reprompt fired exactly once.
    expect(spoken.filter((t) => t === 'Hmm... try again?').length).toBe(1)

    // Hint did NOT fire.
    expect(spoken.filter((t) => t === "Let's look. Cat.").length).toBe(0)

    // Guided dispatch did NOT fire.
    expect(spoken.filter((t) => t === 'This one is cat.').length).toBe(0)

    // Guided state is NOT active.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'false',
    )
  })

  it('per-problem reset: rage-tap on problem 1 does not leak gates into problem 2', async () => {
    // Ticket 86c9gyb2v AC: "starting a fresh problem zeroes the ref AND
    // the state". The wrongCount/hintPlayed/guidedPlayed refs (and the
    // in-flight reprompt lock) must reset alongside
    // `setProblemState(FRESH_PROBLEM_STATE)` in `advanceToNext`, or else
    // problem 2 would inherit a latched `hintPlayedRef.current=true` and
    // never fire a hint of its own (and worse, problem 2's chip-tap gate
    // would still see `wrongCountRef.current=5` — meaning even the FIRST
    // wrong tap of problem 2 would already be past the guided threshold).
    //
    // This test rage-taps problem 1 to drive the gates fully latched
    // (hint + guided fired), advances past it, then verifies problem 2
    // behaves like a fresh problem: a single wrong tap fires no hint and
    // no guided dispatch.
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

    // Problem 1: rage-tap wrong chip 5x to fully latch all three gates.
    const p1WrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(p1WrongChip)
      }
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    // Tap the correct chip on problem 1 (guided-completion path makes it
    // the only enabled one). This advances to problem 2 after the 1200ms
    // auto-advance timer.
    const p1CorrectChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!
    await act(async () => {
      fireEvent.click(p1CorrectChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    // We're now on problem 2.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'false',
    )

    // Snapshot the spoken-list count BEFORE the problem-2 wrong tap so we
    // can isolate problem 2's emissions from the problem-1 noise.
    const spokenBeforeP2Tap = [...harness.spoken()]

    // Problem 2: single wrong tap. This is the regression-guard payload —
    // if the refs leaked from problem 1, this single tap would already
    // see `wrongCountRef.current = 5` and dispatch hint + guided
    // immediately. Post-fix: refs are reset, so this is a fresh tap on a
    // fresh problem.
    const p2TargetWord = plan.problems[1].target.word
    const p2WrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== p2TargetWord)!
    await act(async () => {
      fireEvent.click(p2WrongChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const newlySpoken = harness.spoken().slice(spokenBeforeP2Tap.length)

    // Exactly the reprompt for problem 2's single wrong tap. Problem 2's
    // hint copy ("Let's look. Bag.") and giveAnswer copy ("This one is
    // bag.") MUST NOT have fired — those would only fire if the refs
    // leaked from problem 1.
    const p2WordCap = p2TargetWord[0].toUpperCase() + p2TargetWord.slice(1)
    expect(newlySpoken).toContain('Hmm... try again?')
    expect(newlySpoken).not.toContain(`Let's look. ${p2WordCap}.`)
    expect(newlySpoken).not.toContain(`This one is ${p2TargetWord}.`)
    // Guided remains inactive on problem 2.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'false',
    )
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

  // ── Celebration UX bug fix: SFX call site + visible animation markers ──
  //
  // Background: Thomas's iPad test pass reported the correct-tap celebration
  // was "practically not visible" and there was no reward sound. Causes:
  //  - HUD pop was 250ms — too brief next to the 1200ms auto-advance
  //  - Sparkle burst was a spring with ~600ms tail — undershot the 800ms target
  //  - Melody pose-swap was a 200ms cross-fade — no perceptible "wiggle"
  // Tests below verify the fix without coupling to the exact frame-by-frame
  // timing values (those live as named constants and can be tweaked).

  it('reward SFX (sparkle + plink) fire on correct tap', async () => {
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

    // Three SFX instances are created at mount: sparkle, poof, plink.
    // Order matches the createSfx call order in WordSong.tsx.
    expect(sfxState.createCount).toBe(3)
    const [sparkle, poof, plink] = sfxState.instances
    expect(sparkle.play).not.toHaveBeenCalled()
    expect(plink.play).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Reward SFX both fired exactly once. Poof (wrong-tap SFX) did NOT fire.
    expect(sparkle.play).toHaveBeenCalledTimes(1)
    expect(plink.play).toHaveBeenCalledTimes(1)
    expect(poof.play).not.toHaveBeenCalled()
  })

  it('reward SFX is wired to the sfx-sparkle.mp3 asset path', async () => {
    // Documents the asset contract: the sparkle SFX MUST be sourced from
    // /assets/sfx-sparkle.mp3 (per Math symmetry + assets-todo.md). If the
    // file path drifts, the test catches it before iPad QA does.
    const { createSfx } = (await import('../../lib/sfx')) as unknown as {
      createSfx: ReturnType<typeof vi.fn>
    }
    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={makePlayHarness().playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Three calls — sparkle, poof, plink — and the sparkle one points at
    // /assets/sfx-sparkle.mp3.
    const calls = createSfx.mock.calls.map((c) => c[0])
    const sparkleCall = calls.find((c) => c.src === '/assets/sfx-sparkle.mp3')
    expect(sparkleCall).toBeDefined()
    expect(sparkleCall.volume).toBeGreaterThan(0)
  })

  it('Melody ear-wiggle is suppressed under prefers-reduced-motion', async () => {
    const matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))

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

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // AnimatePresence keeps the exiting (idle) and entering (happy)
    // <m.img> in the DOM concurrently during the cross-fade. Pick the
    // happy one explicitly — under reduced-motion its wiggle marker is
    // false even though the pose still flipped.
    const melodies = screen.getAllByTestId('word-song-melody')
    const melodyHappy = melodies.find(
      (el) => el.getAttribute('data-pose') === 'happy',
    )
    expect(melodyHappy).toBeDefined()
    expect(melodyHappy).toHaveAttribute('data-wiggling', 'false')

    matchMediaSpy.mockRestore()
  })

  it('Melody plays an ear-wiggle on correct tap (data-wiggling=true)', async () => {
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

    // Idle state: only one Melody node, with no wiggle.
    const melodyIdle = screen.getByTestId('word-song-melody')
    expect(melodyIdle).toHaveAttribute('data-pose', 'idle')
    expect(melodyIdle).toHaveAttribute('data-wiggling', 'false')

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // After correct tap, AnimatePresence keeps both the exiting (idle)
    // and the entering (happy) <m.img> in the tree during the
    // cross-fade. Find the happy one — it carries the wiggle marker.
    const melodies = screen.getAllByTestId('word-song-melody')
    const melodyHappy = melodies.find(
      (el) => el.getAttribute('data-pose') === 'happy',
    )
    expect(melodyHappy).toBeDefined()
    expect(melodyHappy).toHaveAttribute('data-wiggling', 'true')
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
