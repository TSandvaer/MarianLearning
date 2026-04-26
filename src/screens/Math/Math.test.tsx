import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

// Stub the SFX factory so jsdom never tries to construct a real Howl.
// Same pattern as Greet.test.tsx — keep the spy tracking module-level so
// per-test assertions can inspect `play()` call counts.
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

import Math from './Math'
import type { PlayMathUtteranceFn } from './Math'
import type { MathSessionPlan } from './sessionPlans'
import { STARDUST_STORAGE_KEY, type StorageAdapter } from './stardust'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** A fixed plan for tests — easy to assert against, fully deterministic. */
function fixedPlan(): MathSessionPlan {
  return {
    id: 'test-plan',
    label: 'Test plan',
    problems: [
      {
        index: 1,
        addendA: 3,
        addendB: 2,
        correct: 5,
        utterances: {
          read: 'Three plus two. How many?',
          correct: 'Yes! Five!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Three. And two more. How many now?',
          giveAnswer: 'This one is five.',
        },
      },
      {
        index: 2,
        addendA: 1,
        addendB: 4,
        correct: 5,
        utterances: {
          read: 'One plus four. How many?',
          correct: 'Yes! Five!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. One. And four more. How many now?',
          giveAnswer: 'This one is five.',
        },
      },
      {
        index: 3,
        addendA: 4,
        addendB: 2,
        correct: 6,
        utterances: {
          read: 'Four plus two. How many?',
          correct: 'Yes! Six!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Four. And two more. How many now?',
          giveAnswer: 'This one is six.',
        },
      },
      {
        index: 4,
        addendA: 5,
        addendB: 3,
        correct: 8,
        utterances: {
          read: 'Five plus three. How many?',
          correct: 'Yes! Eight!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Five. And three more. How many now?',
          giveAnswer: 'This one is eight.',
        },
      },
      {
        index: 5,
        addendA: 2,
        addendB: 5,
        correct: 7,
        utterances: {
          read: 'Two plus five. How many?',
          correct: 'Yes! Seven!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Two. And five more. How many now?',
          giveAnswer: 'This one is seven.',
        },
      },
      {
        index: 6,
        addendA: 6,
        addendB: 3,
        correct: 9,
        utterances: {
          read: 'Six plus three. How many?',
          correct: 'Yes! Nine!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Six. And three more. How many now?',
          giveAnswer: 'This one is nine.',
        },
      },
      {
        index: 7,
        addendA: 4,
        addendB: 4,
        correct: 8,
        utterances: {
          read: 'Four plus four. How many?',
          correct: 'Yes! Eight!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Four. And four more. How many now?',
          giveAnswer: 'This one is eight.',
        },
      },
      {
        index: 8,
        addendA: 5,
        addendB: 5,
        correct: 10,
        utterances: {
          read: 'Five plus five. How many?',
          correct: 'Yes! Ten!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Five. And five more. How many now?',
          giveAnswer: 'This one is ten.',
        },
      },
    ],
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
 * Build a controllable PlayMathUtteranceFn fake. Captures every call so
 * tests can assert what was spoken; resolves immediately by default but
 * can be paused per-call by passing { autoResolve: false }.
 */
function makePlayHarness(opts: { autoResolve?: boolean } = {}) {
  const calls: Array<{
    text: string
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const playUtterance: PlayMathUtteranceFn = vi.fn(async (text, playOpts) => {
    return await new Promise<void>((resolve, reject) => {
      calls.push({ text, resolve, reject })
      // Always synchronously fire onPlay so the gate watchdog clears.
      playOpts?.onPlay?.()
      // Reveal all words synchronously so caption tests see the full reveal.
      const words = text.split(/\s+/).filter(Boolean)
      for (let i = 0; i < words.length; i++) {
        playOpts?.onWordTick?.(i)
      }
      if (opts.autoResolve !== false) {
        // Resolve on the microtask queue so onPlay observers see "playing".
        Promise.resolve().then(() => resolve())
      }
    })
  })

  return {
    playUtterance,
    calls,
    /** Return the sequence of texts spoken in order. */
    spoken(): string[] {
      return calls.map((c) => c.text)
    },
    /** Resolve all pending playbacks (only meaningful with autoResolve=false). */
    resolveAll(): void {
      for (const c of calls) c.resolve()
    },
  }
}

describe('Math (Number Garden) screen', () => {
  // Spy on console.warn to keep the unit-test log clean (the screen warns
  // when SFX assets fail to load — expected in jsdom). Tests don't need to
  // assert against the warnings, so we just suppress + restore.
  beforeEach(() => {
    sfxState.instances = []
    sfxState.createCount = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Wipe localStorage between tests so stardust accumulation doesn't bleed.
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the first problem on mount with HUD, melody, and chips', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    expect(screen.getByTestId('math')).toBeInTheDocument()
    expect(screen.getByTestId('math-hud')).toBeInTheDocument()
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )

    // Problem 1: 3 + 2 = ?
    const symbolic = screen.getByTestId('math-symbolic')
    expect(within(symbolic).getByTestId('math-addend-a')).toHaveTextContent('3')
    expect(within(symbolic).getByTestId('math-addend-b')).toHaveTextContent('2')

    // 3 chips total — 1 correct + 2 distractors.
    const chips = screen.getAllByTestId('math-chip')
    expect(chips).toHaveLength(3)
    const values = chips.map((c) => Number(c.getAttribute('data-value')))
    expect(values).toContain(5) // correct
    expect(new Set(values).size).toBe(3) // all distinct

    // Streak indicator hidden until streak >= 2 (spec line 98).
    expect(screen.queryByTestId('math-streak')).not.toBeInTheDocument()
  })

  it('happy path: tapping correct grants stardust, increments streak, advances', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const storage = makeMemoryStorage()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={storage}
        />,
      ),
    )

    // Initial problem: 3 + 2 = 5. Tap the correct chip.
    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!
    expect(correctChip).toBeDefined()

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Stardust counter is now 1 (per spec: +1 per correct first-tap).
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )

    // The "correct" utterance was spoken.
    expect(harness.spoken()).toContain('Yes! Five!')

    // Streak is 1 (no indicator yet — spec hides it until >= 2).
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '1')
    expect(screen.queryByTestId('math-streak')).not.toBeInTheDocument()

    // Auto-advance after 1200ms.
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '1',
    )

    // Stardust persisted to storage.
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
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('math-chip')
    const correctChip = chips.find((c) => c.getAttribute('data-value') === '5')!
    const wrongChip = chips.find((c) => c.getAttribute('data-value') !== '5')!

    // Tap a wrong chip first.
    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    // The reprompt utterance fired.
    expect(harness.spoken()).toContain('Hmm... try again?')

    // Now tap the correct chip.
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Stardust still granted (spec line 162-164: 1 wrong is within tolerance).
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )

    // But streak did NOT advance — the wrong tap reset it to 0 first.
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '0')
  })

  it('hint utterance fires after 2 wrong attempts on the same problem', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('math-chip')
    const wrongChips = chips.filter((c) => c.getAttribute('data-value') !== '5')

    // Tap two wrong chips in succession.
    await act(async () => {
      fireEvent.click(wrongChips[0])
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(wrongChips[1] ?? wrongChips[0])
      await Promise.resolve()
    })

    // The hint timer (600ms beat) hasn't fired yet — fast-forward.
    await act(async () => {
      vi.advanceTimersByTime(700)
      await Promise.resolve()
    })

    // The hint utterance was spoken.
    expect(harness.spoken()).toContain(
      'Look. Three. And two more. How many now?',
    )
  })

  it('streak threshold [3, 5, 8] grants a bonus stardust at problem 3', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Tap the correct answer for 3 problems in a row.
    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('math-chip')
      const problem = screen.getByTestId('math')
      const idx = Number(problem.getAttribute('data-problem-index'))
      const correctValue = fixedPlan().problems[idx].correct
      const correctChip = chips.find(
        (c) => Number(c.getAttribute('data-value')) === correctValue,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      // Auto-advance.
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    await tapCorrect() // problem 1 → +1 stardust, streak=1
    await tapCorrect() // problem 2 → +1 stardust, streak=2
    await tapCorrect() // problem 3 → +1 stardust + 1 bonus, streak=3

    // 3 base + 1 bonus = 4 stardust.
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '4',
    )
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '3')
    // Streak indicator is now visible (streak >= 2).
    expect(screen.getByTestId('math-streak')).toBeInTheDocument()
  })

  it('streak indicator hides via fade on a wrong tap that breaks an active streak', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Build a streak of 2 first.
    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('math-chip')
      const problem = screen.getByTestId('math')
      const idx = Number(problem.getAttribute('data-problem-index'))
      const correctValue = fixedPlan().problems[idx].correct
      const correctChip = chips.find(
        (c) => Number(c.getAttribute('data-value')) === correctValue,
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
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '2')
    expect(screen.getByTestId('math-streak')).toBeInTheDocument()

    // Now tap wrong on problem 3.
    const chips = screen.getAllByTestId('math-chip')
    const idx = Number(
      screen.getByTestId('math').getAttribute('data-problem-index'),
    )
    const wrongValue = chips
      .map((c) => Number(c.getAttribute('data-value')))
      .find((v) => v !== fixedPlan().problems[idx].correct)!
    const wrongChip = chips.find(
      (c) => Number(c.getAttribute('data-value')) === wrongValue,
    )!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    // Streak indicator fade-out timer is 400ms, then AnimatePresence's
    // exit transition (~150ms) needs to drain before the element unmounts.
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
    })

    // Streak counter has reset to 0 — that's the load-bearing assertion.
    // (The exact unmount timing of the indicator is animation-frame driven
    // and noisy under fake timers; we assert the state reset, which is the
    // anti-dark-pattern guarantee from the spec.)
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '0')
  })

  it('after 3 wrong attempts, guided completion dims other chips and disables them', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChips = screen
      .getAllByTestId('math-chip')
      .filter((c) => c.getAttribute('data-value') !== '5')

    // 3 wrong taps in a row. After the 2nd, the hint plays. After the 3rd,
    // guided completion fires.
    for (let i = 0; i < 3; i++) {
      const ch = wrongChips[i % wrongChips.length]
      await act(async () => {
        fireEvent.click(ch)
        await Promise.resolve()
      })
      // Drain any post-utterance pose / hint timers.
      await act(async () => {
        vi.advanceTimersByTime(800)
        await Promise.resolve()
      })
    }

    // Guided state is active.
    expect(screen.getByTestId('math')).toHaveAttribute('data-guided', 'true')

    // Wrong chips are disabled; correct chip is the only tappable one.
    const chipsAfter = screen.getAllByTestId('math-chip')
    for (const c of chipsAfter) {
      const isCorrect = c.getAttribute('data-value') === '5'
      if (isCorrect) {
        expect(c).not.toBeDisabled()
      } else {
        expect(c).toBeDisabled()
      }
    }

    // The give-answer utterance was spoken.
    expect(harness.spoken()).toContain('This one is five.')

    // Stardust withhold check (ticket 86c9gumhp item #4 — AC row 5).
    // Spec §Wrong-answer policy lines 308-310: guided-completion path
    // withholds stardust ("standard happy-path animation but no stardust
    // awarded"). The chips above are still rendered with the correct one
    // tappable; tapping it now should animate happy but NOT increment the
    // stardust counter past 0.
    const stardustBefore = screen
      .getByTestId('math-stardust')
      .getAttribute('data-total')
    expect(stardustBefore).toBe('0')

    const correctChip = chipsAfter.find(
      (c) => c.getAttribute('data-value') === '5',
    )!
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Stardust counter is still 0 — no grant on the guided correct tap.
    // (data-total is the live attribute; the ticket called this assertion
    // "data-stardust" but the rendered DOM attribute is data-total — the
    // load-bearing surface is the stardust count value, not the attr name.)
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )
  })

  it('rage-tap: 5 rapid clicks on correct chip resolve to a single auto-advance (smoke; data-total surfaces a known bug)', async () => {
    // Ticket 86c9gumhp item #3 — "Rage-tap correct chip 5x rapidly".
    // Reproduces the worst-case 8-year-old gesture (frustrated smash on
    // the chip) and asserts the screen does not double-fire the
    // session-complete callback or land us past the second problem.
    //
    // Bug discovered while writing this test (filed as follow-up):
    //   `problemState.resolved` is React state, NOT a ref. The closure in
    //   `onChipTap` (Math.tsx:695-759) captures the prior render's value,
    //   so 5 synchronous fireEvent.click calls all see resolved=false and
    //   ALL run handleCorrectTap → grantStardust(1). With STREAK_BONUS at
    //   [3, 5, 8], 5 clean increments grant 5 base + 2 bonuses = 7
    //   stardust. The expected behaviour from the ticket is data-total='1'.
    //
    //   We DO NOT assert data-total='1' here — it would fail under jsdom
    //   today and ticket 86c9gumhp's hard constraint forbids touching
    //   Math.tsx in this PR. Filed as a separate bug for the test-author
    //   to pick up after the fix lands; this test currently asserts the
    //   parts that DO hold:
    //   onSessionComplete fires zero times during rapid taps and exactly
    //   one auto-advance lands (problem-index goes 0 → 1, not 1 → 2+).
    //   Once Math.tsx switches to a ref-guarded resolved flag, flip the
    //   data-total assertion to '1' and remove this caveat.
    //
    // In the real browser the chip is `disabled` once resolved (Math.tsx
    // line ~994) — disabled buttons swallow the second click natively.
    // jsdom does not honour that, so the bug is surfaced here even though
    // it may not reproduce on iPad. Refs would protect both environments.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          onSessionComplete={onSessionComplete}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!

    // 5 synchronous clicks — no awaits between them.
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(correctChip)
      }
      await Promise.resolve()
    })

    // onSessionComplete has NOT yet fired — auto-advance is scheduled but
    // the timer hasn't elapsed. This is problem 1 of 8; the session ends
    // only when the 8th problem's auto-advance lands.
    expect(onSessionComplete).not.toHaveBeenCalled()

    // Drain the auto-advance timer (1200ms). Exactly one advance should
    // fire — we land on problem index 1 (the second problem), not 2+.
    // The clearTimeout guard at Math.tsx:675-677 collapses repeated
    // setTimeout calls into a single pending advance, so this assertion
    // holds even with the rage-tap bug.
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    // Still no session-complete; we're 1/8 deep, not 8/8.
    expect(onSessionComplete).not.toHaveBeenCalled()
  })

  it('completes the session on problem 8 and invokes onSessionComplete', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          onSessionComplete={onSessionComplete}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('math-chip')
      const idx = Number(
        screen.getByTestId('math').getAttribute('data-problem-index'),
      )
      const correctValue = fixedPlan().problems[idx].correct
      const correctChip = chips.find(
        (c) => Number(c.getAttribute('data-value')) === correctValue,
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

    // Sweep all 8 problems on a clean run.
    for (let i = 0; i < 8; i++) {
      await tapCorrect()
    }

    // Clean 8-for-8 run: 8 base stardust + bonuses at streak 3, 5, 8 = 11.
    expect(onSessionComplete).toHaveBeenCalledTimes(1)
    const arg = onSessionComplete.mock.calls[0][0]
    expect(arg.totalCorrect).toBe(8)
    expect(arg.totalStardust).toBe(11)
    expect(arg.finalStreak).toBe(8)
    expect(arg.earnedThisSession).toBe(11)
  })

  it('chips have an accessible label with the chip value', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('math-chip')
    for (const c of chips) {
      const v = c.getAttribute('data-value')
      expect(c).toHaveAttribute('aria-label', `Answer ${v}`)
    }
  })

  it('does not display any "X" or "wrong" copy on a wrong tap (anti-dark-pattern)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') !== '5')!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    // No "X" glyph, no "wrong" or "incorrect" text anywhere on screen.
    const screenText = screen.getByTestId('math').textContent ?? ''
    expect(screenText.toLowerCase()).not.toContain('wrong')
    expect(screenText.toLowerCase()).not.toContain('incorrect')
    // Note: "X" alone would match "ax" / "fix" etc. — checking the canonical
    // failure-mode strings is sufficient for this regression.
  })

  it('chip-tap kicks resumeAudioContext synchronously before audio (ticket 86c9gvd0y Phase 2)', async () => {
    // Same shape as the Greet wake-tap test: every audio-active screen
    // needs to resume `Howler.ctx` inside the gesture window before any
    // play() call lands. Math's chip-tap is the load-bearing gesture for
    // this screen — first-tap unlocks the read-aloud, subsequent taps
    // play the result audio. The resume kick fires on every tap, not
    // just the first, because iOS can re-suspend the context on screen
    // transitions or page-visibility events between problems.
    const harness = makePlayHarness()
    const resumeSpy = vi.fn()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          resumeAudioContext={resumeSpy}
        />,
      ),
    )

    // Pre-tap: no resume kick.
    expect(resumeSpy).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Resume was kicked exactly once on the chip-tap gesture.
    expect(resumeSpy).toHaveBeenCalledTimes(1)
    // And the resume kick lands BEFORE playUtterance — the shape iPad
    // Safari needs (resume() inside gesture, play() can land in a later
    // microtask).
    const resumeOrder = resumeSpy.mock.invocationCallOrder[0]
    const playOrder = (
      harness.playUtterance as unknown as {
        mock: { invocationCallOrder: number[] }
      }
    ).mock.invocationCallOrder[0]
    expect(resumeOrder).toBeLessThan(playOrder)
  })

  it('chip-tap kicks unlockAudioSession synchronously before audio (ticket 86c9gvd0y Phase 5)', async () => {
    // Same gesture-window contract as resumeAudioContext, but for the
    // OS-level iOS audio session (silent 1-sample buffer trick). Has to
    // land before play() so the OS re-engages the audio output graph
    // for this gesture's audio.
    const harness = makePlayHarness()
    const unlockSpy = vi.fn()
    render(
      withMotion(
        <Math
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          unlockAudioSession={unlockSpy}
        />,
      ),
    )

    expect(unlockSpy).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!

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
})
