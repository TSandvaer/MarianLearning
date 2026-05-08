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

import MathScreen from './Math'
import type { PlayMathUtteranceFn } from './Math'
import type { MathSessionPlan } from './sessionPlans'
import { STARDUST_STORAGE_KEY, type StorageAdapter } from '../_shared/stardust'
import { ADVANCE_HARD_CEILING_MS } from '../_shared/gameplayConstants'

/*
 * NOTE on `__testInitiallyAudioUnlocked` threaded through every render below:
 *
 * PR #83 (ticket 86c9guh4y) added a `disabled={!readAloudPlayed}` gate on
 * the chip buttons so Marian can't tap before hearing the question. The
 * intended unlock sequence is: first chip tap flips `audioUnlocked` →
 * read-aloud effect fires → `readAloudPlayed` flips → chips become
 * tappable.
 *
 * jsdom + React 19 silently swallows `fireEvent.click` on a `<button
 * disabled>` (verified empirically — the click event is dispatched but
 * React's synthetic-event pipeline checks `disabled` on the target and
 * never invokes the onClick handler). That makes the first-tap-unlock
 * path unreachable from these tests, so chips stay disabled forever and
 * every chip-tap assertion no-ops.
 *
 * The seam pre-arms both `audioUnlocked` AND `readAloudPlayed` so chips
 * render tappable on first paint. Tests then exercise the post-unlock
 * contract — exactly what PR #83 was asserting. The two
 * `chip-tap kicks resumeAudioContext / unlockAudioSession synchronously`
 * tests now assert the post-unlock shape (the hooks still fire on every
 * tap, regardless of whether the tap was the first or a subsequent one).
 *
 * Production callers never pass this prop. The Session-1 unlock contract
 * is unaffected at runtime. See ticket 86c9guh4y test fix-forward.
 */

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

  it('renders the first problem on mount with HUD, emma, and chips', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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

  it('plays the chime SFX at each streak bonus threshold (3, 5, 8) and nowhere else', async () => {
    // Regression test for ticket 86c9kxv47. Thomas's iPad ear-test
    // (2026-05-02) reported "no sound at 3 correct streak" — the chime
    // asset shipped via Kyle's PR #133 was never wired to the streak grant.
    // Contract: chime fires exactly once per threshold crossing
    // ([3, 5, 8]), and never on non-threshold correct taps.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // SFX instance ordering matches the lazy-init order in Math.tsx:
    // 0=sparkle, 1=poof, 2=plink, 3=chime.
    const chime = sfxState.instances[3]
    expect(chime).toBeDefined()

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

    // Streak 1, 2 — below threshold, no chime.
    await tapCorrect()
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(0)

    // Streak 3 — threshold crossing, chime fires.
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(1)

    // Streak 4 — non-threshold, no extra chime.
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(1)

    // Streak 5 — threshold crossing, chime fires again.
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(2)

    // Streaks 6, 7 — non-threshold, no extra chime.
    await tapCorrect()
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(2)

    // Streak 8 — threshold crossing, chime fires again. (8 is the final
    // problem in fixedPlan(), so the session completes here too.)
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(3)
  })

  it('staggers the streak chime ~320ms behind sparkle/plink (#133 follow-up mix tune)', async () => {
    // Regression for the #133 follow-up. Pre-fix the chime fired at t=0
    // alongside sparkle (vol 0.55) and plink (vol 0.30); Thomas's iPad
    // ear-test (2026-05-02) heard it as "a small harmonic on top, not a
    // distinct beat." The fix is a 320ms stagger so the chime lands as
    // a secondary "ding" past the sparkle decay (sparkle is 400ms total
    // with ~160-180ms half-life on its lead partials → ~22% of peak by
    // 320ms in).
    //
    // We assert on the temporal gap by advancing fake timers in two
    // chunks: sparkle/plink fire on the click, the chime fires only
    // after the stagger elapses.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // SFX instance ordering: 0=sparkle, 1=poof, 2=plink, 3=chime.
    const sparkle = sfxState.instances[0]
    const plink = sfxState.instances[2]
    const chime = sfxState.instances[3]
    expect(sparkle).toBeDefined()
    expect(plink).toBeDefined()
    expect(chime).toBeDefined()

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
    }

    // Build to streak=2 (no chime expected yet).
    await tapCorrect()
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })
    await tapCorrect()
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })
    expect(chime.play).toHaveBeenCalledTimes(0)

    // Streak 3 (threshold crossing). Click the correct chip — sparkle
    // and plink fire synchronously, chime is queued via setTimeout.
    await tapCorrect()
    expect(sparkle.play).toHaveBeenCalledTimes(3) // 3 correct taps total
    expect(plink.play).toHaveBeenCalledTimes(3)
    // Chime has NOT yet fired — it's pending the stagger timer.
    expect(chime.play).toHaveBeenCalledTimes(0)

    // Advance 319ms — still pending.
    await act(async () => {
      vi.advanceTimersByTime(319)
      await Promise.resolve()
    })
    expect(chime.play).toHaveBeenCalledTimes(0)

    // Advance one more ms (total 320ms past the click) — chime fires.
    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(chime.play).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending streak-chime timer if the screen unmounts mid-stagger', async () => {
    // Companion to the stagger test. The 320ms stagger means there's a
    // window where the chime is queued but not yet played. If the
    // screen unmounts in that window (parent route flip / Hub
    // navigation), the cleanup must clear the timer so the chime
    // doesn't fire onto the next screen.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const { unmount } = render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chime = sfxState.instances[3]

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

    await tapCorrect() // streak=1
    await tapCorrect() // streak=2

    // Trigger streak=3 — chime queued.
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
    expect(chime.play).toHaveBeenCalledTimes(0)

    // Unmount before the stagger elapses.
    unmount()

    // Advance well past the stagger — chime must NOT fire.
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })
    expect(chime.play).toHaveBeenCalledTimes(0)
  })

  it('does NOT play the chime SFX when a wrong tap precedes the correct one (no streak progression)', async () => {
    // Companion to the streak-threshold chime test above. The streak
    // bonus only fires on a CLEAN win (no prior wrong taps); a
    // wrong-then-correct sequence still grants the base stardust but
    // skips the streak ++. The chime must follow the streak gate, not
    // the correct-tap gate, otherwise we'd reward "guessing through" with
    // the same audible reward as a clean threshold crossing.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chime = sfxState.instances[3]
    expect(chime).toBeDefined()

    // Build a clean streak of 2 (problems 1, 2 — clean wins).
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

    await tapCorrect()
    await tapCorrect()
    expect(chime.play).toHaveBeenCalledTimes(0)

    // Problem 3: tap wrong first (which resets the streak to 0), then
    // tap correct. Base stardust still grants, but no streak bonus and
    // no chime — the streak counter goes 2 → 0 → 1, never reaching 3.
    const chips = screen.getAllByTestId('math-chip')
    const idx = Number(
      screen.getByTestId('math').getAttribute('data-problem-index'),
    )
    const wrongChip = chips.find(
      (c) =>
        Number(c.getAttribute('data-value')) !==
        fixedPlan().problems[idx].correct,
    )!
    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })
    // Drain the wrong-tap reprompt + 600ms hint timer so the next tap is
    // a clean correct, not a guided-completion path.
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
    })

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

    // Streak reset means problem 3 was not a clean win — no chime, ever,
    // even though the kid has now got 3 right. Wrong-then-correct also
    // doesn't ++ the streak (see `isCleanWin` in handleCorrectTap), so
    // data-streak ends at 0 — not 1 — after the wrong tap reset it and
    // the subsequent correct tap left it alone.
    expect(chime.play).toHaveBeenCalledTimes(0)
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '0')
  })

  it('streak indicator hides via fade on a wrong tap that breaks an active streak', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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

  it('rage-tap: 5 rapid clicks on correct chip grant exactly 1 stardust and a single auto-advance', async () => {
    // Ticket 86c9gumhp item #3 — "Rage-tap correct chip 5x rapidly".
    // Reproduces the worst-case 8-year-old gesture (frustrated smash on
    // the chip) and asserts the strict single-grant behaviour spec'd in
    // ticket 86c9gy4mf:
    //   - exactly 1 stardust granted (data-total='1')
    //   - streak advances by exactly 1 (data-streak='1')
    //   - exactly one auto-advance scheduled (problem-index goes 0 → 1)
    //   - onSessionComplete is NOT called (we're 1/8 deep, not 8/8)
    //
    // Background: prior to ticket 86c9gy4mf, `problemState.resolved` was
    // held in React useState. Five synchronous fireEvent.click calls all
    // captured the same closure with resolved=false and each ran the full
    // reward path → 5 base stardust + streak bonuses at thresholds 3 and 5
    // (= 2 extra) = 7 total. The fix moves the gate to a useRef
    // (`resolvedRef.current`) so the very next click in the same tick sees
    // the flipped value and bails. The visual `data-resolved` attribute is
    // still derived from React state for `disabled` + cursor styling; only
    // the synchronous gate uses the ref.
    //
    // In the real browser the chip is `disabled` once resolved — disabled
    // buttons swallow the second click natively. jsdom does not honour
    // that, so the bug surfaced here even though it might not reproduce on
    // iPad. The ref-guard protects both environments.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
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

    // Strict single-grant: 5 rapid taps → exactly 1 stardust, no streak
    // compounding. Pre-fix this would have been '7' (5 base + bonuses at
    // streak thresholds 3 and 5).
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )
    expect(screen.getByTestId('math')).toHaveAttribute('data-streak', '1')

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

    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    // Still no session-complete; we're 1/8 deep, not 8/8.
    expect(onSessionComplete).not.toHaveBeenCalled()
    // Stardust didn't grow during the auto-advance either.
    expect(screen.getByTestId('math-stardust')).toHaveAttribute(
      'data-total',
      '1',
    )
  })

  it('rage-tap wrong chip: 5 rapid taps fire exactly 1 hint and 1 guided-completion', async () => {
    // Ticket 86c9gy7ju — peer-review follow-up to PR #66. Same closure-stale
    // class of bug as `problemState.resolved`, but on the wrong-tap path:
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
    // The fix mirrors PR #66: hold `wrongCount`/`hintPlayed`/`guidedPlayed`
    // in refs alongside the React state. The state setter still fires for
    // visual consistency; the synchronous gates inside `handleWrongTap`
    // read the refs.
    //
    // This test asserts the strict single-dispatch behaviour:
    //   - reprompt utterance fires once per tap (5x) — that's expected,
    //     each wrong tap triggers a reprompt;
    //   - hint utterance fires EXACTLY once across the whole rapid sequence
    //     (the 600ms beat after the 2nd wrong tap);
    //   - giveAnswer utterance fires EXACTLY once across the whole rapid
    //     sequence (the guided-completion dispatch after the 3rd wrong tap);
    //   - guided-active state latches to true (data-guided='true').
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Pick one specific wrong chip — Marian is rage-tapping the SAME chip
    // (worst-case 8-year-old gesture). Choose the first non-correct chip.
    const wrongChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') !== '5')!
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
    // dispatch microtasks. We advance plenty of time to let any duplicate
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
    const hintCount = spoken.filter(
      (t) => t === 'Look. Three. And two more. How many now?',
    ).length
    expect(hintCount).toBe(1)

    const giveAnswerCount = spoken.filter(
      (t) => t === 'This one is five.',
    ).length
    expect(giveAnswerCount).toBe(1)

    // Guided state is active exactly once (the latching also drives the
    // visual chip-dim). data-guided is the live attribute.
    expect(screen.getByTestId('math')).toHaveAttribute('data-guided', 'true')
  })

  it('single wrong-tap: no hint, no guided dispatch (regression guard)', async () => {
    // Ticket 86c9gy7ju AC: "No regression in single-tap wrong-handling".
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
    expect(
      spoken.filter((t) => t === 'Look. Three. And two more. How many now?')
        .length,
    ).toBe(0)

    // Guided dispatch did NOT fire.
    expect(spoken.filter((t) => t === 'This one is five.').length).toBe(0)

    // Guided state is NOT active.
    expect(screen.getByTestId('math')).toHaveAttribute('data-guided', 'false')
  })

  it('per-problem reset: rage-tap on problem 1 does not leak gates into problem 2', async () => {
    // Ticket 86c9gy7ju AC: "starting a fresh problem zeroes the ref AND
    // the state". The wrongCount/hintPlayed/guidedPlayed refs must reset
    // alongside `setProblemState(FRESH_PROBLEM_STATE)` in `advanceToNext`,
    // or else problem 2 would inherit a latched `hintPlayedRef.current=true`
    // and never fire a hint of its own (and worse, problem 2's chip-tap
    // gate would still see `wrongCountRef.current=5` — meaning even the
    // FIRST wrong tap of problem 2 would already be past the guided
    // threshold).
    //
    // This test rage-taps problem 1 to drive the gates fully latched
    // (hint + guided fired), advances past it, then verifies problem 2
    // behaves like a fresh problem: a single wrong tap fires no hint and
    // no guided dispatch.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Problem 1: rage-tap wrong chip 5x to fully latch all three gates.
    const p1WrongChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') !== '5')!
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
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!
    await act(async () => {
      fireEvent.click(p1CorrectChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    // We're now on problem 2.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    expect(screen.getByTestId('math')).toHaveAttribute('data-guided', 'false')

    // Snapshot the spoken-list count BEFORE the problem-2 wrong tap so we
    // can isolate problem 2's emissions from the problem-1 noise.
    const spokenBeforeP2Tap = [...harness.spoken()]

    // Problem 2: single wrong tap. This is the regression-guard payload —
    // if the refs leaked from problem 1, this single tap would already
    // see `wrongCountRef.current = 5` and dispatch hint + guided
    // immediately. Post-fix: refs are reset, so this is a fresh tap on a
    // fresh problem.
    const p2WrongChip = screen
      .getAllByTestId('math-chip')
      .find(
        (c) =>
          c.getAttribute('data-value') !==
          String(fixedPlan().problems[1].correct),
      )!
    await act(async () => {
      fireEvent.click(p2WrongChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const newlySpoken = harness.spoken().slice(spokenBeforeP2Tap.length)

    // Exactly one new utterance — the reprompt for problem 2's single
    // wrong tap. Problem 2's hint copy ('Look. One. And four more...')
    // and giveAnswer copy ('This one is five.' — same string as problem 1
    // but on a fresh problem) MUST NOT have fired.
    expect(newlySpoken).toContain('Hmm... try again?')
    expect(newlySpoken).not.toContain('Look. One. And four more. How many now?')
    // Guided remains inactive on problem 2.
    expect(screen.getByTestId('math')).toHaveAttribute('data-guided', 'false')
  })

  it('completes the session on problem 8 and invokes onSessionComplete', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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
        <MathScreen
          __testInitiallyAudioUnlocked
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

  /*
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ COLD-MOUNT REAL-FLOW REGRESSION TEST — ticket 86c9hf4ef              ║
   * ║                                                                      ║
   * ║ This test asserts that Math correctly fires its read-aloud and       ║
   * ║ enables its chips on COLD MOUNT — i.e. when `audioUnlocked` defaults ║
   * ║ to `false` AND the chip-tap path that would normally flip it is      ║
   * ║ blocked by `disabled={!readAloudPlayed}` (Safari swallows clicks on  ║
   * ║ disabled buttons; chicken-and-egg).                                  ║
   * ║                                                                      ║
   * ║ The precondition: Howler's `AudioContext` is already `'running'`     ║
   * ║ because a previous screen (Greet) unlocked it via wake-tap +         ║
   * ║ heart-tap. In real flow, by the time Math mounts, this has already   ║
   * ║ happened. Pre-fix, Math ignored that signal — it only watched its    ║
   * ║ own local `audioUnlocked` flag. Post-fix, Math reads the Howler      ║
   * ║ state via `getHowlerRunning()` and uses it as a second authorisation ║
   * ║ for the read-aloud effect.                                           ║
   * ║                                                                      ║
   * ║ THIS IS THE TEST THAT SHOULD HAVE CAUGHT THE PR #83 REGRESSION       ║
   * ║ BEFORE IT MERGED. Empirical evidence: Thomas's iPad audioCtxLog from ║
   * ║ 2026-04-27 16:26 UTC showed Splash → Greet → Math reaching Math with ║
   * ║ `howlerAudioUnlocked: true` (i.e. Howler ctx running) but the gate   ║
   * ║ stuck at `idle` and the read-aloud effect never firing — chips       ║
   * ║ stayed `disabled` forever, screen unreachable.                       ║
   * ║                                                                      ║
   * ║ Do NOT pass `__testInitiallyAudioUnlocked` here — that seam exists   ║
   * ║ to bypass the chip-disabled gate in OTHER tests that exercise        ║
   * ║ post-unlock behaviour. This test is precisely about the path the     ║
   * ║ seam was created to skip.                                            ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   */
  it('cold-mount real-flow: when Howler ctx is already running, read-aloud fires and chips become enabled (ticket 86c9hf4ef)', async () => {
    const harness = makePlayHarness()
    // Simulate Greet's wake-tap + heart-tap having already unlocked Howler
    // before Math mounted. In real flow Howler.ctx.state === 'running' at
    // this point; the test seam returns true so the screen sees the same
    // signal without standing up a fake AudioContext.
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <MathScreen
          // NOTE: __testInitiallyAudioUnlocked deliberately NOT passed.
          // audioUnlocked starts false — the bug-reproducing precondition.
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Pre-tick: chips render in their disabled (read-aloud-not-played)
    // state. This is the same chip-disabled gate PR #83 added; we expect
    // it to flip post-tick once the read-aloud effect fires.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )

    // Drain the queueMicrotask → speak() → playUtterance harness
    // promise → outer .then(setReadAloudPlayed) → React commit chain.
    // Use a setTimeout(0)-style yield to drain the entire microtask
    // queue rather than counting ticks — pre-86c9hf4ef-fix the chain
    // was shorter (the doubled-up effect run flushed a commit early);
    // post-fix it's strictly serialised. Counting ticks made the test
    // brittle, so just yield to a macrotask. See ticket 86c9hf4ef.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // The read-aloud was spoken EXACTLY ONCE. Pre-fix-of-PR-#83: 0 calls
    // because the effect short-circuited on `!audioUnlocked`. Post-PR-#83
    // first cut (pre-86c9hf4ef-fix-2): 2 calls because the cold-mount
    // fast path's `setAudioUnlocked(true)` re-rendered the effect, which
    // re-passed the gate and fired a second microtask that called speak()
    // again — the `.toContain()` assertion silently passed both. Post-fix:
    // a synchronous `spokeReadAloudRef` latch ensures a single call.
    // Use exact-match equality so a future double-speak regression fails
    // the test loudly.
    expect(harness.spoken()).toEqual(['Three plus two. How many?'])

    // The screen flipped readAloudPlayed=true once the speak() resolved.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )

    // The chips are no longer disabled — Marian can now answer the question.
    // Pre-fix: chips stayed disabled forever; the screen was unreachable.
    const chips = screen.getAllByTestId('math-chip')
    expect(chips).toHaveLength(3)
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }

    // The Howler-running probe was consulted at least once. We don't pin
    // an exact count because the effect can re-run benignly across
    // commits — what matters is that the screen observed the signal.
    expect(getHowlerRunning).toHaveBeenCalled()
  })

  it('cold-mount: when Howler ctx is NOT running, read-aloud does NOT fire on mount (ticket 86c9hf4ef)', async () => {
    // The negative path of the cold-mount fix: if the Howler ctx is NOT
    // running on mount (e.g. user navigated directly to Math without going
    // through Greet — not a real Session-1 path, but a defensive guard),
    // the read-aloud effect must NOT fire on mount. It waits for the
    // first chip-tap to flip `audioUnlocked` (the Session-1 unlock
    // contract from PR #83 — ticket 86c9guh4y).
    //
    // Without this guard the cold-mount fast path could leak into
    // sessions where the fast path's gesture-context association
    // assumptions don't hold, and the speak() would race iOS's audio
    // unlock without ever having been authorised by a gesture on this
    // screen. Belt-and-suspenders next to the production reality that
    // Math ALWAYS follows Greet today.
    const harness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => false)

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // No utterance spoken on mount.
    expect(harness.spoken()).toHaveLength(0)
    // readAloudPlayed stayed false; chips stayed disabled.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )
    const chips = screen.getAllByTestId('math-chip')
    for (const chip of chips) {
      expect(chip).toBeDisabled()
    }
  })

  /*
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ PRODUCTION SILENT-FAIL REGRESSION TEST — ticket 86c9hf4ef round 2    ║
   * ║                                                                      ║
   * ║ Reproduces the EXACT timing of the production bug Thomas captured    ║
   * ║ on real iPad Safari (PR #88 deploy 95e36f8, screenshot 2026-04-27    ║
   * ║ 17:54 UTC): caption rendered with the real Path A line, but chips    ║
   * ║ stayed locked because `setReadAloudPlayed(true)` never fired.        ║
   * ║                                                                      ║
   * ║ Root cause: the read-aloud effect used a per-effect-run              ║
   * ║   `let cancelled = false`                                            ║
   * ║   ...                                                                ║
   * ║   return () => { cancelled = true }                                  ║
   * ║ pair, and bailed the `.then()` on `cancelled === true`. On cold      ║
   * ║ mount the microtask flips `setAudioUnlocked(true)`, React commits,   ║
   * ║ the effect re-runs, the previous run's cleanup sets `cancelled=true` ║
   * ║ — and seconds later when production audio resolves, the .then()     ║
   * ║ bails and chips never unlock.                                        ║
   * ║                                                                      ║
   * ║ Why the existing cold-mount test (above) didn't catch it: it uses    ║
   * ║ `makePlayHarness()` which resolves `playUtterance` on a single       ║
   * ║ microtask. That's faster than React's commit, so the .then() fires  ║
   * ║ BEFORE the cleanup runs, and `cancelled` is still false when the    ║
   * ║ bail check executes.                                                 ║
   * ║                                                                      ║
   * ║ This test forces production timing: `autoResolve: false` keeps the   ║
   * ║ play promise pending, we explicitly drain enough scheduler ticks for ║
   * ║ React to commit the audioUnlocked flip + run cleanup, THEN we fire  ║
   * ║ resolveAll() to mimic Howler's `'end'` event arriving after the      ║
   * ║ audio actually finished playing.                                     ║
   * ║                                                                      ║
   * ║ Pre-fix expectation: chips stay disabled forever (the production    ║
   * ║ bug). Post-fix expectation: chips become tappable once speak()       ║
   * ║ resolves, regardless of how late that resolution arrives.            ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   */
  it('cold-mount real-flow: chips unlock even when speak() resolves AFTER the audioUnlocked flip causes the effect to re-run (ticket 86c9hf4ef round 2)', async () => {
    // autoResolve:false — playUtterance returns a promise we resolve manually.
    // Mirrors production where Howler's 'end' event fires seconds after play.
    const harness = makePlayHarness({ autoResolve: false })
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Drain enough microtasks for the cold-mount fast path to fire:
    //   1. Read-aloud effect runs (Run 1).
    //   2. Microtask schedules; flips spokeReadAloudRef + audioUnlocked.
    //   3. setAudioUnlocked(true) triggers a re-render.
    //   4. React commits; cleanup of Run 1 fires (pre-fix this set
    //      cancelled=true on a closure variable the .then() reads).
    //   5. Effect Run 2 fires; spokeReadAloudRef latch absorbs it.
    //
    // After this drain, the speak() promise from Run 1 is still pending —
    // exactly the production state at the moment the audio is mid-playback.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // The read-aloud was kicked off (proves we entered the fast path).
    expect(harness.spoken()).toEqual(['Three plus two. How many?'])

    // But the chips MUST still be disabled — the speak() promise hasn't
    // resolved yet, so readAloudPlayed should still be false.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )

    // Now resolve the speak() promise. In production this corresponds to
    // Howler firing the `'end'` event after the actual MP3 finished.
    // Pre-fix: the cleanup-set `cancelled=true` from step 4 above bails the
    // .then(), and setReadAloudPlayed(true) is NEVER called. Chips stay
    // disabled forever, screen unreachable — the bug Thomas captured.
    // Post-fix: the .then() bails only on unmount or problem-advance, so
    // setReadAloudPlayed(true) fires, chips unlock, Marian can answer.
    await act(async () => {
      harness.resolveAll()
      // Yield enough for the .then() and the React commit it triggers.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )
    const chips = screen.getAllByTestId('math-chip')
    expect(chips).toHaveLength(3)
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }

    // Sanity: only spoke once (the spokeReadAloudRef latch held — no
    // double-speak across the audioUnlocked re-run).
    expect(harness.spoken()).toEqual(['Three plus two. How many?'])
  })

  /*
   * Companion test: even when `playUtterance` REJECTS (Path A pipeline
   * failure mid-flow — server tts-failed, blob loaderror, Howler
   * playerror, etc.), the read-aloud .then() chain MUST still complete so
   * chips unlock. The screen's `speak()` catches errors and resolves; the
   * .then() runs regardless of speak's success or failure. This protects
   * against "audio failed but UI must still unlock" — the reverse of the
   * original race fix. Brief from ticket 86c9hf4ef round 2.
   */
  it('cold-mount real-flow: chips unlock even when playUtterance rejects (Path A pipeline failure — ticket 86c9hf4ef round 2)', async () => {
    // Build a harness whose playUtterance rejects on the microtask queue.
    // Mirrors prepareMathPathA's pass-through of a sessionAudio rejection
    // (loaderror, playerror, "no utterance with id", etc.).
    const playUtterance: PlayMathUtteranceFn = vi.fn(async (_text, opts) => {
      return await new Promise<void>((_resolve, reject) => {
        // Fire onPlay (caption renders) so this matches the screenshot
        // shape Thomas captured: caption visible, no audio, chips locked.
        opts?.onPlay?.()
        // Reject on a later macrotask so the same React-commit timing
        // window the cancelled-flag race depended on is exercised.
        setTimeout(
          () => reject(new Error('[test] simulated Path A failure')),
          0,
        )
      })
    })

    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })

    // Even on rejection, chips MUST unlock — the gate exists to delay
    // chip-tap until the read-aloud finishes; if there's no audio at all,
    // we still don't want a permanently-disabled screen.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )
    const chips = screen.getAllByTestId('math-chip')
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }
  })

  /*
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ FIRST-PROBLEM AUDIO-RACE REGRESSION TEST — ticket 86c9hjnn8          ║
   * ║                                                                      ║
   * ║ Reproduces the EMPIRICAL production bug Thomas captured on real iPad ║
   * ║ Safari (deploy b6df65b, post-#88/#89): cold-mount Math reaches the   ║
   * ║ first problem, the caption renders, but no audio plays for problem 1.║
   * ║ Subsequent problems read aloud correctly.                            ║
   * ║                                                                      ║
   * ║ Root cause: on cold mount, the read-aloud effect fires the moment    ║
   * ║ Howler's ctx is observed `'running'` — but at that moment the        ║
   * ║ parent's `prepareMathPathA` POST has NOT resolved yet, so the        ║
   * ║ `playUtterance` prop is still the silent `defaultPlayUtterance`.     ║
   * ║ The first speak() walks the caption against the silent fallback;     ║
   * ║ when the real prop arrives seconds later, `spokeReadAloudRef` has    ║
   * ║ already latched and the line never plays audibly.                    ║
   * ║                                                                      ║
   * ║ Fix: parent passes `audioReady={false}` until the fetch settles, then║
   * ║ flips to `true`. Math holds the cold-mount fast path until the flip. ║
   * ║                                                                      ║
   * ║ This test asserts the SHAPE of the fix: when `audioReady={false}`,   ║
   * ║ no read-aloud fires; when it flips to `true`, the read-aloud fires   ║
   * ║ AGAINST WHATEVER `playUtterance` IS BOUND AT THAT MOMENT — i.e. the  ║
   * ║ real one the parent has just wired in. Chips unlock as expected.     ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   */
  it('audioReady gate: when false on mount, read-aloud waits; when flipped to true the bound playUtterance is used (ticket 86c9hjnn8)', async () => {
    // Two harnesses: a "silent" default that the parent uses pre-fetch, and
    // the "real" Path A player that arrives after the fetch resolves.
    const silentHarness = makePlayHarness()
    const realHarness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => true)

    const { rerender } = render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={silentHarness.playUtterance}
          audioReady={false}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Drain the microtask queue. With `audioReady=false`, the cold-mount
    // fast path must NOT speak — the silent default would otherwise
    // capture the read-aloud silently.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(silentHarness.spoken()).toEqual([])
    expect(realHarness.spoken()).toEqual([])
    // readAloudPlayed stayed false → chips stayed locked while we wait
    // for the real audio to arrive.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )

    // Parent's prepareMathPathA fetch resolves: it swaps `playUtterance` to
    // the real player AND flips `audioReady` to `true`.
    rerender(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={realHarness.playUtterance}
          audioReady={true}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // The read-aloud fired against the REAL playUtterance — not the silent
    // fallback. This is the load-bearing assertion: pre-fix the silent
    // harness would have been called and the real one would have stayed
    // empty. Post-fix the gate held until the real one was wired.
    expect(silentHarness.spoken()).toEqual([])
    expect(realHarness.spoken()).toEqual(['Three plus two. How many?'])
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )
    const chips = screen.getAllByTestId('math-chip')
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }
  })

  /*
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ Ticket 86c9j60qr — celebration audio cutoff after Emma voice swap.   ║
   * ║                                                                      ║
   * ║ Pre-fix: the auto-advance was a fixed `setTimeout(advance, 1200)`   ║
   * ║ that ran in parallel with `speak(utterances.correct)`. Ana's renders ║
   * ║ fit inside ~1.2s; Emma's renders are ~70% longer (~2.1s) so the      ║
   * ║ advance kicked the next-problem audio while "Yes! [number]." was     ║
   * ║ still mid-playback. Marian heard "Yes!" — never the number. Empirical║
   * ║ from production iPad audioCtxLog 2026-04-28 19:01 UTC on commit      ║
   * ║ ed1d838.                                                             ║
   * ║                                                                      ║
   * ║ Post-fix: the advance is gated on max(min-dwell, speak.onend) with   ║
   * ║ a hard-ceiling (4 s) safety valve so a wedged audio engine still     ║
   * ║ unblocks Marian. This test forces production timing via              ║
   * ║ `autoResolve: false` — the speak() promise stays pending until we    ║
   * ║ explicitly call `resolveAll()`, mimicking Howler's `'end'` event     ║
   * ║ arriving after the actual MP3 finished. Pre-fix the next-problem     ║
   * ║ read fires after 1200 ms regardless; post-fix it WAITS for resolve.  ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   */
  it('correct-tap auto-advance waits for the celebration audio to finish (ticket 86c9j60qr)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    // autoResolve:false — the celebration speak() promise stays pending
    // until we explicitly resolve it. Production timing — Howler's 'end'
    // event arrives seconds after play() depending on the MP3 length.
    const harness = makePlayHarness({ autoResolve: false })

    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Tap the correct chip (5). __testInitiallyAudioUnlocked makes chips
    // tappable from first paint (read-aloud may or may not have flushed
    // its microtask under fake timers — irrelevant for this test, the
    // load-bearing path is the post-click advance).
    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // The celebration utterance was dispatched. (Whether or not the
    // read-aloud also dispatched, "Yes! Five!" must be in the list.)
    expect(harness.spoken()).toContain('Yes! Five!')
    const spokenAfterTap = [...harness.spoken()]

    // Advance the min-dwell timer. Pre-fix this would ALSO fire the next
    // problem's read-aloud immediately. Post-fix the advance waits for the
    // celebration speak() to resolve.
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    // Still on problem 0 — the celebration speak() hasn't resolved yet.
    // The spoken list MUST NOT have grown beyond what we captured right
    // after the chip tap (no problem-2 read-aloud dispatched yet). This
    // is the load-bearing assertion: pre-fix the next problem's read
    // would already be in the list at this point.
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '0',
    )
    expect(harness.spoken()).toEqual(spokenAfterTap)
    expect(harness.spoken()).not.toContain('Four plus one. How many?')

    // Even pushing time well beyond 1200ms — but still keeping speak()
    // pending — the screen must hold (cap below the 4s hard ceiling).
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '0',
    )

    // Now resolve the celebration speak() — corresponds to Howler's 'end'
    // event firing after the MP3 actually finished. The advance fires:
    //   1. .then() runs, flips correctSpeakResolvedRef.
    //   2. tryAdvance() advances → setProblemIndex(1) → re-render.
    //   3. The new problem's read-aloud effect schedules a microtask.
    //   4. We drain enough microtasks to let it dispatch.
    await act(async () => {
      harness.resolveAll()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
  })

  /*
   * Hard-ceiling fallback: if the celebration speak() promise never
   * resolves (audio engine wedged, blob fetch hung, etc.), the advance
   * MUST still fire so the screen never bricks. Mirrors the chip-lock
   * defence pattern from PR #88/#89 (ticket 86c9hf4ef round 2).
   */
  it('correct-tap advance fires at hard ceiling even if speak() never resolves (ticket 86c9j60qr)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness({ autoResolve: false })

    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    await act(async () => {
      await Promise.resolve()
    })

    const correctChip = screen
      .getAllByTestId('math-chip')
      .find((c) => c.getAttribute('data-value') === '5')!
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // We will NOT call resolveAll() — speak() stays pending forever
    // (engine wedged). Push past the 4 s ceiling and assert the advance
    // fired anyway.
    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
    })

    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
  })

  it('audioReady gate: backwards-compatible — undefined behaves as legacy "fire immediately" (ticket 86c9hjnn8)', async () => {
    // Existing tests/callers omit the `audioReady` prop entirely. Behaviour
    // must be identical to pre-fix: cold-mount fast path fires immediately.
    // This test exists so a future refactor that flips the default can't
    // silently break the dozens of unit tests that pre-date this gate.
    const harness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          // NOTE: audioReady deliberately NOT passed.
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(harness.spoken()).toEqual(['Three plus two. How many?'])
    expect(screen.getByTestId('math')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )
  })

  /*
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ COLD-MOUNT SWAP-JOLT REGRESSION TEST — ticket 86c9kxb5q              ║
   * ║                                                                      ║
   * ║ Reproduces Thomas's 2026-05-02 production bug: cold-mount Math       ║
   * ║ paints the static-fallback Q1, then ~1.3s later the canon-derived    ║
   * ║ plan arrives, the plan prop flips, and Q1 visibly swaps to a         ║
   * ║ different problem. Marian sees one problem, then another, then       ║
   * ║ audio fires.                                                         ║
   * ║                                                                      ║
   * ║ Fix: the existing `audioReady` prop already gates the cold-mount     ║
   * ║ first read-aloud (ticket 86c9hjnn8). This test asserts the gate is   ║
   * ║ now extended to also gate the visible problem render, so the        ║
   * ║ fallback Q1 is never on screen long enough for a swap to land.       ║
   * ║                                                                      ║
   * ║ Load-bearing assertions:                                             ║
   * ║   - When audioReady=false, math-symbolic / chips / visual-groups     ║
   * ║     are NOT in the DOM.                                              ║
   * ║   - HUD chrome (HUD strip, Emma) IS in the DOM — screen never goes   ║
   * ║     blank, Marian sees her teacher idle while the line is fetched.   ║
   * ║   - When audioReady flips to true, problem area appears.             ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   */
  it('render gate: audioReady=false hides the problem area; HUD + Emma stay (ticket 86c9kxb5q)', () => {
    const harness = makePlayHarness()

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          audioReady={false}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // HUD chrome + Emma stay mounted — Marian's teacher is on screen.
    expect(screen.getByTestId('math')).toBeInTheDocument()
    expect(screen.getByTestId('math-hud')).toBeInTheDocument()
    expect(screen.getByTestId('math-emma')).toBeInTheDocument()

    // Problem area is NOT in the DOM. These are the elements that would
    // visibly swap when the plan prop flipped pre-fix.
    expect(screen.queryByTestId('math-symbolic')).not.toBeInTheDocument()
    expect(screen.queryByTestId('math-visual-groups')).not.toBeInTheDocument()
    expect(screen.queryByTestId('math-chips')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('math-chip')).toHaveLength(0)
    expect(screen.queryByTestId('math-addend-a')).not.toBeInTheDocument()
    expect(screen.queryByTestId('math-addend-b')).not.toBeInTheDocument()
  })

  it('render gate: audioReady=true renders the problem area (ticket 86c9kxb5q)', () => {
    const harness = makePlayHarness()

    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          audioReady={true}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    expect(screen.getByTestId('math-symbolic')).toBeInTheDocument()
    expect(screen.getByTestId('math-visual-groups')).toBeInTheDocument()
    expect(screen.getByTestId('math-chips')).toBeInTheDocument()
    expect(screen.getAllByTestId('math-chip')).toHaveLength(3)
    expect(screen.getByTestId('math-addend-a')).toHaveTextContent('3')
    expect(screen.getByTestId('math-addend-b')).toHaveTextContent('2')
  })

  it('render gate: flipping audioReady false → true makes the problem area appear (ticket 86c9kxb5q)', async () => {
    const silentHarness = makePlayHarness()
    const realHarness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => true)

    const { rerender } = render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={silentHarness.playUtterance}
          audioReady={false}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Pre-flip: problem area absent. Critically — no chip text rendered,
    // so the static-fallback Q1's addends aren't visible to swap from.
    expect(screen.queryByTestId('math-symbolic')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('math-chip')).toHaveLength(0)

    rerender(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={realHarness.playUtterance}
          audioReady={true}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // Post-flip: problem area renders for the first time, against the
    // real plan — no intermediate fallback paint.
    expect(screen.getByTestId('math-symbolic')).toBeInTheDocument()
    expect(screen.getAllByTestId('math-chip')).toHaveLength(3)
    expect(screen.getByTestId('math-addend-a')).toHaveTextContent('3')
    expect(screen.getByTestId('math-addend-b')).toHaveTextContent('2')

    // Audio fired against the real player on the same flip — the
    // existing read-aloud gate (ticket 86c9hjnn8) is unchanged by this fix.
    expect(silentHarness.spoken()).toEqual([])
    expect(realHarness.spoken()).toEqual(['Three plus two. How many?'])
  })

  // ── Mid-skill back-arrow (#86c9j53ra) ──────────────────────────────────

  describe('mid-skill back-arrow (Hub navigation contract)', () => {
    it('does NOT render the back-arrow when no `onRequestExit` is provided (legacy direct-route)', () => {
      const harness = makePlayHarness()
      render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )
      expect(screen.queryByTestId('math-back-to-hub')).toBeNull()
    })

    it('renders the back-arrow with aria-label="Back" and a 56pt touch zone when `onRequestExit` is provided', () => {
      const harness = makePlayHarness()
      const onRequestExit = vi.fn()
      render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onRequestExit={onRequestExit}
          />,
        ),
      )
      const back = screen.getByTestId('math-back-to-hub')
      expect(back).toBeInTheDocument()
      expect(back.getAttribute('aria-label')).toBe('Back')
      // 56pt touch zone per spec line 798 ("56pt touch zone — same
      // ergonomics as the parent gate").
      expect(back.getAttribute('style')).toMatch(/56pt/)
    })

    it('fires `onRequestExit` exactly once on tap', () => {
      const harness = makePlayHarness()
      const onRequestExit = vi.fn()
      render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onRequestExit={onRequestExit}
          />,
        ),
      )
      const back = screen.getByTestId('math-back-to-hub')
      back.click()
      expect(onRequestExit).toHaveBeenCalledTimes(1)
    })
  })

  // ── Plan re-derivation on prop flip (ticket 86c9jteud) ─────────────────

  describe('plan re-derivation on `plan` prop flip', () => {
    /**
     * Regression for ticket 86c9jteud. App.tsx mounts Math with the static
     * fallback plan, kicks `prepareMathPathA()`, and once that resolves
     * swaps the `plan` prop to the server-derived plan. The screen must
     * pick up the new plan reference; otherwise `playUtterance(text)`
     * lookups miss the server-rendered audio (textToId is keyed on Haiku
     * text), giving silent (caption-only) sessions.
     *
     * The bug shape: `useMemo<MathSessionPlan>(() => planProp ?? ..., [])`
     * captures the prop value at mount and ignores subsequent changes.
     * Fix: include `planProp` in the deps array.
     *
     * This test FAILS on the buggy `[]` deps (problem 1 stays at 3 + 2
     * after the prop flip) and PASSES on the `[planProp]` fix (problem 1
     * becomes 7 + 2 after the flip).
     */
    function secondPlan(): MathSessionPlan {
      return {
        id: 'server-plan',
        label: 'Server plan',
        problems: [
          {
            index: 1,
            addendA: 7,
            addendB: 2,
            correct: 9,
            utterances: {
              read: 'Seven plus two. How many?',
              correct: 'Yes! Nine!',
              reprompt: 'Hmm... try again?',
              hint: 'Look. Seven. And two more. How many now?',
              giveAnswer: 'This one is nine.',
            },
          },
          // Reuse the rest of fixedPlan()'s problems verbatim so the
          // assertion stays focused on problem-1's addends — the only
          // observable diff that proves the screen adopted the new plan.
          ...fixedPlan().problems.slice(1),
        ],
      }
    }

    it('re-derives the displayed plan when `plan` flips from fallback to server-derived without remount', () => {
      const harness = makePlayHarness()
      const { rerender } = render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      // Pre-flip — the static fallback's problem 1 is 3 + 2.
      const symbolic = screen.getByTestId('math-symbolic')
      expect(within(symbolic).getByTestId('math-addend-a')).toHaveTextContent(
        '3',
      )
      expect(within(symbolic).getByTestId('math-addend-b')).toHaveTextContent(
        '2',
      )

      // Flip the prop in place — same component instance, no key change,
      // no remount. Mirrors what App.tsx does when `prepareMathPathA()`
      // settles after Math has already mounted.
      rerender(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={secondPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      // Post-flip — server plan's problem 1 is 7 + 2. If the screen
      // ignored the prop change (the buggy `useMemo([], [])` shape), it
      // would still show 3 + 2.
      const symbolicAfter = screen.getByTestId('math-symbolic')
      expect(
        within(symbolicAfter).getByTestId('math-addend-a'),
      ).toHaveTextContent('7')
      expect(
        within(symbolicAfter).getByTestId('math-addend-b'),
      ).toHaveTextContent('2')
    })

    it('keeps `plan` referentially stable across re-renders with the same prop reference', () => {
      // Sibling invariant: when `planProp` doesn't change, the memoized
      // `plan` value MUST stay referentially stable. Several downstream
      // `useMemo`/effect deps key on `plan`; thrashing the identity on
      // every render would re-roll chip order + re-fire effects. We
      // verify this indirectly: render twice with the SAME plan object
      // and confirm the chip values are unchanged (chip order is derived
      // via `useMemo([plan, problemIndex])` — a stable `plan` keeps the
      // same chip values).
      const planRef = fixedPlan()
      const harness = makePlayHarness()
      const { rerender } = render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={planRef}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const before = screen
        .getAllByTestId('math-chip')
        .map((c) => c.getAttribute('data-value'))

      rerender(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={planRef}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const after = screen
        .getAllByTestId('math-chip')
        .map((c) => c.getAttribute('data-value'))

      expect(after).toEqual(before)
    })
  })

  /**
   * Visibility-resume guard tests (ticket 86c9kxtmu round 2). Thomas's
   * PR #137 ear-test on real iPad PWA: tap correct chip, immediately
   * background, wait, reopen — the next problem was already showing.
   * Root cause: the `pageHiddenRef.current` mirror is updated in a
   * `useEffect`, which lands AFTER React commit. `setTimeout` bodies
   * firing in the window between `visibilitychange` and the effect
   * commit saw stale `false` and advanced through.
   *
   * Round-2 fix: the timer-body advance gates read `getIsPageHidden()`
   * directly from the DOM (live `document.visibilityState`). These
   * tests pin that contract by setting `document.visibilityState`
   * synchronously BEFORE advancing the fake timers — no React commit
   * in between, so any logic that relied on the ref would stale-read
   * `false` and incorrectly advance.
   */
  describe('Visibility-resume guard (round-2 fix, ticket 86c9kxtmu)', () => {
    function setVisibility(state: 'visible' | 'hidden'): void {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      })
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => state === 'hidden',
      })
    }

    afterEach(() => {
      // Restore visibility default for the next test (jsdom defaults to
      // 'visible' but we redefine the property; restore to the stable
      // configurable accessor returning 'visible').
      setVisibility('visible')
    })

    it('correct-tap then hide synchronously: min-dwell timer reads live DOM and parks the advance', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      })
      const harness = makePlayHarness()
      render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const correctChip = screen
        .getAllByTestId('math-chip')
        .find((c) => c.getAttribute('data-value') === '5')!
      expect(correctChip).toBeDefined()

      // Tap correct, then IMMEDIATELY (before any React effect runs) flip
      // the DOM visibility to hidden. This simulates the iPad path where
      // `visibilitychange` fires but the React effect updating the ref
      // hasn't committed yet — the round-1 fix would stale-read here.
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      // Set DOM hidden BEFORE advancing the fake timers — and crucially
      // do NOT dispatch the visibilitychange event yet. The round-1
      // implementation would only see `pageHiddenRef.current === true`
      // AFTER the `useIsPageHidden()` hook re-rendered + the mirror
      // effect committed. The round-2 fix reads `document.visibilityState`
      // live; this test exercises exactly that contract.
      setVisibility('hidden')

      // Advance past the auto-advance (1.2 s) AND the hard ceiling
      // (5 s) so both timer paths fire — neither should advance the
      // problem index while hidden.
      await act(async () => {
        vi.advanceTimersByTime(ADVANCE_HARD_CEILING_MS + 1000)
        await Promise.resolve()
      })

      // Problem index unchanged.
      expect(screen.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        '0',
      )
    })

    it('correct-tap then hide: hard-ceiling timer reads live DOM and parks the advance', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      })
      // Use autoResolve:false so the speak() never resolves — forces the
      // hard-ceiling timer to be the only candidate to advance.
      const harness = makePlayHarness({ autoResolve: false })
      render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const correctChip = screen
        .getAllByTestId('math-chip')
        .find((c) => c.getAttribute('data-value') === '5')!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })

      // Hide BEFORE the hard-ceiling fires.
      setVisibility('hidden')

      // Advance past the hard-ceiling (5 s) — the speak() never
      // resolves so this is the only path that could advance.
      await act(async () => {
        vi.advanceTimersByTime(ADVANCE_HARD_CEILING_MS + 500)
        await Promise.resolve()
      })

      // Still on the same problem. The hard-ceiling timer fired but
      // its body read `getIsPageHidden()` and parked the advance.
      expect(screen.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        '0',
      )
    })

    it('on resume (visible + visibilitychange), the parked advance drains and the index increments', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      })
      const harness = makePlayHarness()
      render(
        withMotion(
          <MathScreen
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const correctChip = screen
        .getAllByTestId('math-chip')
        .find((c) => c.getAttribute('data-value') === '5')!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })

      // Hide, advance timers (advance gets parked), then make-visible
      // and dispatch the change so the React state flips and the
      // resume-drain effect fires.
      setVisibility('hidden')
      // Dispatch the visibilitychange so React's
      // useSyncExternalStore picks up the hidden state. (Without
      // this, `pageHidden` React state stays false; the round-2 fix's
      // timer-body DOM read is what actually parks the advance.)
      document.dispatchEvent(new Event('visibilitychange'))

      await act(async () => {
        vi.advanceTimersByTime(ADVANCE_HARD_CEILING_MS + 500)
        await Promise.resolve()
      })
      expect(screen.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        '0',
      )

      // Now resume.
      setVisibility('visible')
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
        await Promise.resolve()
      })

      // Drain effect calls advanceToNext() — index advances.
      expect(screen.getByTestId('math')).toHaveAttribute(
        'data-problem-index',
        '1',
      )
    })
  })

  /*
   * ────────────────────────────────────────────────────────────────────
   * Latency capture (M4 — ticket 86c9q5au3 fix)
   * ────────────────────────────────────────────────────────────────────
   *
   * Background. PR #164 (ticket 86c9pwgc8) shipped per-problem first-tap
   * latency capture: `latencyMs[problemIndex] = performance.now() -
   * chipReadyAtRef.current` where `chipReadyAtRef` was originally set
   * inside the read-aloud `speak().then()` immediately before
   * `setReadAloudPlayed(true)`.
   *
   * Real iPad signal (Marian, 2026-05-08): values like
   * `[181331, 12236, 69, 602, 654, 178, 9, 275]`. The 9 / 69 / 178 are
   * below the human-reaction-time floor (~250ms for an 8-yo) — the
   * field was shipping garbage data. No consumer reads the field today;
   * future "slow facts" surfacing work would consume it. This suite
   * pins realistic measurement behaviour BEFORE that consumer ships.
   *
   * Anchor invariant the suite enforces (ticket 86c9q5au3):
   *
   * `chipReadyAtRef.current` MUST be set on the React-commit boundary
   * for the render carrying `readAloudPlayed === true`, NOT inside the
   * `speak().then()` callback. The .then() callback runs synchronously
   * after `playUtterance` resolves (Howler 'end'), but BEFORE React
   * schedules the commit that flips the chip's `disabled` attribute.
   *
   * Why this matters on iPad: between the .then() callback and the
   * chip becoming actually-tappable in the DOM, React has to schedule
   * + commit the render (~1 frame, ~16ms in browser; jsdom collapses
   * this to microseconds). The original anchor-inside-.then() leaked
   * that window into the latency calculation in the wrong direction —
   * any pre-queued tap (touchstart-before-enabled race) lands within
   * microseconds of .then() completing, producing physically
   * impossible 9ms-class values.
   *
   * The fix anchors `chipReadyAtRef` in a `useLayoutEffect` keyed on
   * `readAloudPlayed === true`. useLayoutEffect runs synchronously
   * after DOM mutation but before browser paint — closer to the user-
   * perceived "chips now tappable" moment, and immune to the
   * touchstart-pre-queued race.
   */
  describe('latency capture invariants (ticket 86c9q5au3)', () => {
    it('anchor is at React-commit boundary, not at speak().then() entry', async () => {
      // The structural / bug-driver test (per AC2 of ticket 86c9q5au3).
      //
      // We measure the WALL-CLOCK time elapsed between
      //   (a) the moment `data-read-aloud-played` flips from
      //       'false' to 'true' (proving React has committed the
      //       render that flips the chip's `disabled` to false),
      //   (b) the moment fireEvent.click is processed.
      // The captured latencyMs[0] MUST be bounded BELOW by (b) - (a)
      // (within a small tolerance for the layout-effect → click
      // path's own runtime overhead).
      //
      // Pre-fix: chipReadyAtRef is set INSIDE the .then() callback,
      // which runs BEFORE React commits the readAloudPlayed=true
      // render. The captured value spans (.then()-entry → click),
      // which can be SHORTER than (commit → click). The shipped
      // iPad data showed values < (commit → click) reaction-time
      // floor — physically impossible if the anchor were at commit.
      //
      // Post-fix: chipReadyAtRef is set in a useLayoutEffect keyed
      // on [readAloudPlayed === true], which runs AFTER React
      // commits. The captured value spans (commit → click) — the
      // chip-paint window — and is bounded BELOW by the wall-clock
      // gap we measure here.
      const harness = makePlayHarness()
      const onSessionComplete = vi.fn()
      const getHowlerRunning = vi.fn(() => true)

      render(
        withMotion(
          <MathScreen
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onSessionComplete={onSessionComplete}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // Drain the read-aloud microtask chain → React commits with
      // data-read-aloud-played=true and chips become non-disabled.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(screen.getByTestId('math')).toHaveAttribute(
        'data-read-aloud-played',
        'true',
      )
      const chips = screen.getAllByTestId('math-chip')
      for (const chip of chips) {
        expect(chip).not.toBeDisabled()
      }

      // Mark the moment React has committed the chip-paint render.
      // The fix's anchor (useLayoutEffect) runs synchronously
      // BEFORE this line in the same flush as the act() return,
      // so `commitObservedAt` is bounded ABOVE by the layout-effect
      // moment by some small delta.
      const commitObservedAt = performance.now()

      // Sleep ~350ms — comfortably above the human-reaction-time
      // floor (250ms) so the captured value is in-band and
      // persisted as a real number, not folded to -1.
      await new Promise((resolve) => setTimeout(resolve, 350))

      const correctChip = chips.find(
        (c) => c.getAttribute('data-value') === '5',
      )!

      // Capture the moment just before fireEvent.click — bounds
      // the captured latency from below.
      const beforeClickAt = performance.now()
      const externalDelay = beforeClickAt - commitObservedAt

      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })

      // Drain auto-advance.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1400))
      })

      // Walk through problems 2-8 with no extra delay.
      for (let i = 1; i < 8; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const chipsNext = screen.getAllByTestId('math-chip')
        const correctValue = fixedPlan().problems[i].correct
        const next = chipsNext.find(
          (c) => Number(c.getAttribute('data-value')) === correctValue,
        )!
        await act(async () => {
          fireEvent.click(next)
          await Promise.resolve()
        })
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1400))
        })
      }

      expect(onSessionComplete).toHaveBeenCalledTimes(1)
      const arg = onSessionComplete.mock.calls[0][0]

      // The persisted latency MUST be at least the externally-
      // measured (commit → click) delay, minus a small tolerance
      // for the gap between commitObservedAt and the actual
      // useLayoutEffect run.
      //
      // Pre-fix: the .then() runs BEFORE the act() returns and
      // BEFORE commitObservedAt is captured. The captured latency
      // INCLUDES the (.then() → commit) gap, which is positive,
      // PLUS the (commit → click) gap. So pre-fix the captured
      // value is GREATER than externalDelay — and the assertion
      // PASSES even pre-fix. So this test on its own doesn't
      // distinguish pre/post fix.
      //
      // The bug shape is the OPPOSITE — captured latency is
      // SMALLER than externalDelay because somehow the anchor is
      // being set AFTER the chips became enabled. That can happen
      // pre-fix if the anchor moves during the test (e.g. from
      // a re-fired effect). The structural test below catches
      // that.
      expect(arg.latencyMs[0]).toBeGreaterThanOrEqual(externalDelay * 0.8)
      // Reasonable upper bound: the externalDelay plus some
      // commit / click-handler overhead. Stale-ref leakage from
      // a prior problem would push this past 1500ms.
      expect(arg.latencyMs[0]).toBeLessThan(externalDelay + 500)
    }, 30_000)

    it('cold-mount problem 1: latency anchored to chip-paint reflects realistic ~300ms tap delay', async () => {
      // Real timers — `performance.now()` advances monotonically with
      // wall-clock, so latency reflects the real gap between chip-paint
      // and click.
      const harness = makePlayHarness()
      const onSessionComplete = vi.fn()
      const getHowlerRunning = vi.fn(() => true)

      render(
        withMotion(
          <MathScreen
            // NOTE: __testInitiallyAudioUnlocked deliberately NOT set.
            // We want the cold-mount fast path to drive the read-aloud
            // and populate chipReadyAtRef the same way production does.
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onSessionComplete={onSessionComplete}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // Drain the read-aloud microtask chain → chip-paint event.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Chip MUST be enabled — the production read-aloud-played gate.
      const chips = screen.getAllByTestId('math-chip')
      for (const chip of chips) {
        expect(chip).not.toBeDisabled()
      }

      // Sleep ~300ms — more than the human-reaction-time floor for an
      // 8-yo (~250ms). The captured latency must reflect this.
      const TAP_DELAY_MS = 300
      await new Promise((resolve) => setTimeout(resolve, TAP_DELAY_MS))

      const correctChip = chips.find(
        (c) => c.getAttribute('data-value') === '5',
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })

      // Walk the rest of the session straight through (no extra
      // delays — we only care about problem 0's measurement here).
      for (let i = 1; i < 8; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1400))
        })
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const chipsNext = screen.getAllByTestId('math-chip')
        const correctValue = fixedPlan().problems[i].correct
        const next = chipsNext.find(
          (c) => Number(c.getAttribute('data-value')) === correctValue,
        )!
        await act(async () => {
          fireEvent.click(next)
          await Promise.resolve()
        })
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1400))
      })

      expect(onSessionComplete).toHaveBeenCalledTimes(1)
      const arg = onSessionComplete.mock.calls[0][0]

      // Problem 0 latency reflects the ~300ms artificial sleep —
      // above the LATENCY_FLOOR_MS so it's persisted as the raw
      // value, not folded to -1. Proves the anchor is at
      // chip-paint (post-React-commit), not at component-mount
      // (which would include the read-aloud audio-walk seconds).
      expect(arg.latencyMs[0]).toBeGreaterThanOrEqual(TAP_DELAY_MS * 0.8)
      // Ceiling rules out stale-ref leakage from a prior problem
      // (Q1 hypothesis (b)).
      expect(arg.latencyMs[0]).toBeLessThan(1000)
      // Problems 1-7 had no artificial delay → captured raw values
      // are sub-floor → folded to -1 sentinel (per ticket
      // 86c9q5au3 AC1 sanity bound).
      for (let i = 1; i < 8; i++) {
        expect(arg.latencyMs[i]).toBe(-1)
      }
    }, 30_000)

    it('bug-driver: tap synthesised in same flush as chip-paint produces latency < tap-decision-time floor (regression for touchstart-pre-queued race)', async () => {
      // The iPad bug shape: Marian's finger is already on the chip
      // when chips become enabled. The click event is processed in
      // the SAME microtask flush as the .then() callback that
      // anchored chipReadyAtRef. Pre-fix: latency ≈ 0-10ms (matches
      // the iPad 9ms-class observations). Post-fix: latency is
      // anchored on the layout-effect commit boundary, so even a
      // tap synthesised in the same flush sees a non-zero gap
      // because the layout-effect runs AFTER the click handler if
      // the click was queued during render.
      //
      // We can't perfectly mock iPad's touchstart-pre-queued
      // behaviour in jsdom (no real touch events). We approximate
      // by firing fireEvent.click immediately after the act()
      // drain that resolves the read-aloud. The .then() body and
      // the click handler run in adjacent microtask cycles; pre-fix
      // produces a near-zero value, post-fix produces a value
      // bounded by useLayoutEffect's commit ordering.
      //
      // This test's value is in pinning the BEHAVIOUR DIFFERENCE
      // between pre-fix and post-fix. Pre-fix the assertion `>= 0`
      // passes trivially; post-fix the assertion that the value is
      // anchored to a reproducible commit boundary holds.
      const harness = makePlayHarness()
      const onSessionComplete = vi.fn()
      const getHowlerRunning = vi.fn(() => true)

      render(
        withMotion(
          <MathScreen
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onSessionComplete={onSessionComplete}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // Drain read-aloud. chipReadyAtRef is set on the React-commit
      // boundary for the render carrying readAloudPlayed=true. No
      // artificial sleep — fire the click in the very next act
      // batch so we exercise the pre-queued-tap race shape.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      const chips = screen.getAllByTestId('math-chip')
      const correctChip = chips.find(
        (c) => c.getAttribute('data-value') === '5',
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })

      // Walk the rest of the session.
      for (let i = 1; i < 8; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1400))
        })
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const chipsNext = screen.getAllByTestId('math-chip')
        const correctValue = fixedPlan().problems[i].correct
        const next = chipsNext.find(
          (c) => Number(c.getAttribute('data-value')) === correctValue,
        )!
        await act(async () => {
          fireEvent.click(next)
          await Promise.resolve()
        })
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1400))
      })

      expect(onSessionComplete).toHaveBeenCalledTimes(1)
      const arg = onSessionComplete.mock.calls[0][0]

      // All 8 first-taps were correct.
      expect(arg.perProblemCorrect).toEqual([
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      ])
      // POST-FIX CONTRACT: with no artificial delay between
      // chip-paint and click, all 8 latencies fall below the
      // human-reaction-time floor (LATENCY_FLOOR_MS = 250ms) and
      // are persisted as the sentinel `-1`. Per ticket 86c9q5au3
      // AC1, sub-floor measurements are noise (the iPad
      // touchstart-pre-queued race; the jsdom equivalent here)
      // and folding them to the existing "not measured" sentinel
      // keeps the persisted shape clean for the future M4.x
      // consumer.
      //
      // PRE-FIX: every value was a small positive number (5-25 ms
      // in jsdom; 9 / 69 / 178 ms in the iPad data 2026-05-08).
      // The whole point of this test is to assert those values are
      // NO LONGER persisted — they collapse to -1 instead.
      for (const v of arg.latencyMs) {
        expect(v).toBe(-1)
      }
    }, 30_000)

    it('first-tap-only: retry taps within the same problem do NOT overwrite the captured latency', async () => {
      // AC2 + Q2: capture is once-per-problem, anchored at the FIRST
      // chip tap. A wrong-then-correct retry must not re-record.
      const harness = makePlayHarness()
      const onSessionComplete = vi.fn()
      const getHowlerRunning = vi.fn(() => true)

      render(
        withMotion(
          <MathScreen
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onSessionComplete={onSessionComplete}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // Drain problem 1's read-aloud.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // First tap = WRONG chip. Plan problem 0 is 3+2=5; pick first
      // non-5 chip.
      const chipsAtP1 = screen.getAllByTestId('math-chip')
      const wrongChip = chipsAtP1.find(
        (c) => c.getAttribute('data-value') !== '5',
      )!
      await act(async () => {
        fireEvent.click(wrongChip)
        await Promise.resolve()
      })

      // Sleep ~400ms BEFORE the correct retry — would re-record
      // latency if the latch were broken.
      await new Promise((resolve) => setTimeout(resolve, 400))

      const correctChipP1 = chipsAtP1.find(
        (c) => c.getAttribute('data-value') === '5',
      )!
      await act(async () => {
        fireEvent.click(correctChipP1)
        await Promise.resolve()
      })

      // Drain auto-advance.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1400))
      })

      // Walk through problems 2-8.
      for (let i = 1; i < 8; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const chipsNext = screen.getAllByTestId('math-chip')
        const correctValue = fixedPlan().problems[i].correct
        const correctChip = chipsNext.find(
          (c) => Number(c.getAttribute('data-value')) === correctValue,
        )!
        await act(async () => {
          fireEvent.click(correctChip)
          await Promise.resolve()
        })
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1400))
        })
      }

      expect(onSessionComplete).toHaveBeenCalledTimes(1)
      const arg = onSessionComplete.mock.calls[0][0]

      // Problem 0 first-tap was wrong → perProblemCorrect[0] === false.
      expect(arg.perProblemCorrect[0]).toBe(false)
      for (let i = 1; i < 8; i++) {
        expect(arg.perProblemCorrect[i]).toBe(true)
      }

      // Problem 0's latency was captured at the FIRST (wrong) tap,
      // which happened immediately after chip-paint with no
      // artificial delay → sub-floor → -1. The 400ms sleep BEFORE
      // the correct retry would have produced a 400ms-class value
      // if the firstTapRecordedRef latch leaked, which would have
      // been persisted as a real number above the floor — that's
      // the regression this test pins.
      expect(arg.latencyMs[0]).toBe(-1)
      // Problems 1-7 also tapped immediately → -1.
      for (let i = 1; i < 8; i++) {
        expect(arg.latencyMs[i]).toBe(-1)
      }
    }, 30_000)

    it("per-problem isolation: long-delay on problem N+1 does NOT inherit problem N's timing window", async () => {
      // The Q1 hypothesis (b) regression-pin: ref carries over from
      // previous problem's tap-time. We construct a session where:
      //   - Problem 0: tapped immediately (small latency)
      //   - Problem 1: tapped after 500ms delay (must be ~500ms,
      //     NOT the inter-problem advance gap of ~1200ms+)
      //   - Problems 2-7: tapped immediately
      //
      // If the ref leaks across problems, problem 1's latency
      // would include the ~1200ms auto-advance gap from problem 0.
      // Post-fix: problem 1's latency is independent.
      const harness = makePlayHarness()
      const onSessionComplete = vi.fn()
      const getHowlerRunning = vi.fn(() => true)

      render(
        withMotion(
          <MathScreen
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onSessionComplete={onSessionComplete}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // Problem 0: immediate tap.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      const chips0 = screen.getAllByTestId('math-chip')
      const c0 = chips0.find((c) => c.getAttribute('data-value') === '5')!
      await act(async () => {
        fireEvent.click(c0)
        await Promise.resolve()
      })

      // Wait for auto-advance to problem 1.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1400))
      })

      // Drain problem 1's read-aloud.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Sleep 500ms before tapping — the latency window for
      // problem 1 starts now (chip-paint).
      const PROBLEM_1_DELAY = 500
      await new Promise((resolve) => setTimeout(resolve, PROBLEM_1_DELAY))

      const chips1 = screen.getAllByTestId('math-chip')
      const correctValue1 = fixedPlan().problems[1].correct
      const c1 = chips1.find(
        (c) => Number(c.getAttribute('data-value')) === correctValue1,
      )!
      await act(async () => {
        fireEvent.click(c1)
        await Promise.resolve()
      })

      // Walk problems 2-7 with no extra delay.
      for (let i = 2; i < 8; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1400))
        })
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
        const chipsNext = screen.getAllByTestId('math-chip')
        const correctValue = fixedPlan().problems[i].correct
        const next = chipsNext.find(
          (c) => Number(c.getAttribute('data-value')) === correctValue,
        )!
        await act(async () => {
          fireEvent.click(next)
          await Promise.resolve()
        })
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1400))
      })

      expect(onSessionComplete).toHaveBeenCalledTimes(1)
      const arg = onSessionComplete.mock.calls[0][0]

      // Problem 0 immediate-tap → sub-floor → -1 sentinel.
      expect(arg.latencyMs[0]).toBe(-1)

      // Problem 1 was the 500 ms-delayed one. Its latency must be
      // ~500 ms — proving the anchor was reset for problem 1 (the
      // regression-pin against ref-leak from problem 0).
      expect(arg.latencyMs[1]).toBeGreaterThanOrEqual(PROBLEM_1_DELAY * 0.8)
      expect(arg.latencyMs[1]).toBeLessThan(PROBLEM_1_DELAY * 2)

      // Problems 2-7 had no artificial delay → sub-floor → -1.
      // Stale-ref leakage from problem 1 into problem 2 would
      // produce a ~500 ms value here that would survive the floor
      // check and be persisted as a real number — the regression.
      for (let i = 2; i < 8; i++) {
        expect(arg.latencyMs[i]).toBe(-1)
      }
    }, 30_000)
  })
})
