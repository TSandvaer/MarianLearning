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

  it('renders the first problem on mount with HUD, melody, and chips', () => {
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

    // Drain the queueMicrotask + the playUtterance promise + the post-resolve
    // setReadAloudPlayed commit. One act() pass is enough because the
    // makePlayHarness fake resolves on the microtask queue (see
    // `Promise.resolve().then(() => resolve())` in makePlayHarness).
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // The read-aloud was spoken. Pre-fix: spoken().length === 0 here
    // because the effect short-circuited on `!audioUnlocked`. Post-fix:
    // the Howler-running fast path authorises the speak.
    expect(harness.spoken()).toContain('Three plus two. How many?')

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
})
